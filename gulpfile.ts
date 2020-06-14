import {
  Product,
  RubricQuestion,
  RubricSelection,
  Warning,
} from "./src/parsing/types";
import { loadRubric, loadProducts } from "./src/parsing/index";

const gulp = require("gulp");
const postcss = require("gulp-postcss");
const rename = require("gulp-rename");
const del = require("del");
const hb = require("gulp-hb");
const hbHelpers = require("handlebars-helpers");
const through = require("through2");
const toml = require("@iarna/toml");

const rubric: RubricQuestion[] = loadRubric();
const products: Product[] = loadProducts(rubric);
// eslint-disable-next-line @typescript-eslint/ban-types
const api: object = products.map((product) => {
  return {
    name: product.name,
    hostnames: product.hostnames,
    slug: product.slug,
    score: product.score,
    last_updated: product.lastUpdated,
    has_warnings_active: product.warnings.length > 0,
  };
});

// eslint-disable-next-line @typescript-eslint/ban-types
function hbsFactory(additionalData: object): any {
  const GAFAMN = [
    "google",
    "apple",
    "facebook",
    "microsoft",
    "amazon",
    "netflix",
  ];
  const featured = products.filter((item) => {
    return GAFAMN.includes(item.slug);
  });

  return hb()
    .partials("./src/templates/partials/**/*.hbs")
    .data({
      rubric,
      products,
      api,
      ...additionalData,
      featured,
      product_count: products.length,
    })
    .helpers(hbHelpers())
    .helpers({
      ratioColorClass: (ratio: number) => {
        if (ratio < 0.35) {
          return "text-red-500";
        } else if (ratio < 0.7) {
          return "text-yellow-500";
        } else {
          return "text-green-500";
        }
      },
    });
}

gulp.task("clean", () => {
  return del("./dist/**/*");
});

gulp.task("build general pages", () => {
  return gulp
    .src(["./src/templates/pages/**/*.hbs", "./src/templates/pages/*.hbs"], {
      ignore: "./src/templates/pages/product.hbs",
    })
    .pipe(rename({ extname: ".html" }))
    .pipe(gulp.src("./src/templates/**/*.json"))
    .pipe(hbsFactory({}))
    .pipe(gulp.dest("./dist/"));
});

// Product page building
// TODO: Make a bit nicer
const productPageBuildTasks = [];
for (const product of products) {
  const taskName = `build ${product.slug}`;
  gulp.task(taskName, () => {
    return gulp
      .src("./src/templates/pages/product.hbs")
      .pipe(
        hbsFactory({
          product: product,
          timeline: getWarningsTimeline(product.warnings),
          rubricCategories: getRubricCategories(product.rubric),
        })
      )
      .pipe(rename(`/product/${product.slug}/index.html`))
      .pipe(gulp.dest("./dist/"));
  });
  productPageBuildTasks.push(taskName);
}

gulp.task(
  "build pages",
  gulp.parallel(...productPageBuildTasks, "build general pages")
);

gulp.task("collect static", () => {
  return gulp
    .src([
      "./src/static/**/*",
      "!./src/static/**/*.{css,scss}",
      "./node_modules/@fortawesome/fontawesome-free/**/*.{woff2,woff}",
    ])
    .pipe(gulp.dest("./dist/static/"));
});

gulp.task("collect product icons", () => {
  return gulp.src(["./icons/**/*"]).pipe(gulp.dest("./dist/static/icons/"));
});

gulp.task("build css", () => {
  return gulp
    .src(["./src/static/css/base.scss"])
    .pipe(
      postcss(
        [
          require("postcss-import"),
          require("tailwindcss")("tailwind.config.js"),
          require("autoprefixer"),
          // require("@fullhuman/postcss-purgecss")({
          //   content: ["./dist/**/*.html"],
          // })
        ],
        { syntax: require("postcss-scss") }
      )
    )
    .pipe(rename({ extname: ".css" }))
    .pipe(gulp.dest("./dist/static/css/"));
});

gulp.task(
  "default",
  gulp.series([
    "clean",
    "build pages",
    "collect static",
    "collect product icons",
    "build css",
  ])
);

gulp.watch(
  ["./src/templates/**/*", "./rubric/**/*", "./products/**/*"],
  gulp.series("build pages", "collect static")
);

gulp.watch(["./src/**/*.{css,scss}", "build css"]);

// eslint-disable-next-line @typescript-eslint/ban-types
function getWarningsTimeline(warnings: Warning[]): object {
  const timeline = {};

  for (const warning of warnings) {
    const date = warning.date;
    if (date === undefined) {
      (timeline["general"] = timeline["general"] || []).push(warning);
    } else {
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
        dateObj
      );
      if (!(year in timeline)) {
        timeline[year] = {};
      }
      if (!(month in timeline[year])) {
        timeline[year][month] = [];
      }
      timeline[year][month].push(warning);
    }
  }

  return timeline;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function getRubricCategories(selections: RubricSelection[]): object {
  const categories = {};

  for (const selection of selections) {
    (categories[selection.question.category] =
      categories[selection.question.category] || []).push(selection);
  }

  return categories;
}
