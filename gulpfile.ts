require("dotenv").config();

import { Product, RubricQuestion, Contributor } from "./src/parsing/types";

import {
  loadRubric,
  loadProducts,
  loadContributors,
} from "./src/parsing/index";

import {
  hbsFactory,
  getProductPageBuildTasks,
  getDirectoryPagesTasks,
} from "./src/build/utils";

const gulp = require("gulp");
const postcss = require("gulp-postcss");
const rename = require("gulp-rename");
const del = require("del");

const rubric: RubricQuestion[] = loadRubric();
const contributors: Contributor[] = loadContributors();
const products: Product[] = loadProducts(rubric, contributors);

gulp.task("clean", () => {
  return del("./dist/**/*");
});

gulp.task("build api", () => {
  return gulp
    .src(["./src/templates/pages/api/**/*.json"])
    .pipe(hbsFactory({ rubric, contributors, products }))
    .pipe(gulp.dest("./dist/api/"));
});

gulp.task("build general pages", () => {
  return gulp
    .src(["./src/templates/pages/**/*.hbs", "./src/templates/pages/*.hbs"], {
      ignore: [
        "./src/templates/pages/product.hbs",
        "./src/templates/pages/directory.hbs",
      ],
    })
    .pipe(rename({ extname: ".html" }))
    .pipe(hbsFactory({ rubric, contributors, products }))
    .pipe(gulp.dest("./dist/"));
});

gulp.task(
  "build pages",
  gulp.parallel(
      ...getProductPageBuildTasks(products),
      ...getDirectoryPagesTasks(products),
      "build general pages",
      "build api"
  )
);

gulp.task("collect dependencies", () => {
  return gulp
    .src(["./node_modules/lunr/lunr.min.js"])
    .pipe(gulp.dest("./dist/static/deps/"));
});

gulp.task("collect static", () => {
  return gulp
    .src([
      "./src/static/**/*",
      "./node_modules/@fortawesome/fontawesome-free/**/*.{woff2,woff}",
      "!./src/static/**/*.{css,scss}",
    ])
    .pipe(gulp.dest("./dist/static/"));
});

gulp.task("collect root favicon", () => {
  return gulp.src(["./src/static/img/*.ico"]).pipe(gulp.dest("./dist/"));
})

gulp.task("collect product icons", () => {
  return gulp.src(["./icons/**/*"]).pipe(gulp.dest("./dist/static/icons/"));
});

gulp.task("build css", () => {
  return gulp
    .src(["./src/static/css/base.scss"])
    .pipe(postcss())
    .pipe(rename({ extname: ".css" }))
    .pipe(gulp.dest("./dist/static/css/"));
});

gulp.task(
  "default",
  gulp.series([
    "clean",
    "build pages",
    "collect dependencies",
    "collect static",
    "collect product icons",
    "collect root favicon",
    "build css",
  ])
);

if (process.env.NODE_ENV === "debug") {
  gulp.watch(
    ["./src/templates/**/*"],
    gulp.series("build pages", "collect static")
  );
  gulp.watch(["./src/**/*.{css,scss}", "build css"]);
}
