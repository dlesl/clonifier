const TerserPlugin = require("terser-webpack-plugin");
const merge = require("webpack-merge");
const [commonApp, commonWorker] = require("./webpack.common.js");
const simpleApps = require("./simple/webpack.js");

const pages = [commonApp, ...simpleApps].map(p =>
  merge(p, {
    mode: "production",
    optimization: {
      minimizer: [
        new TerserPlugin({
          cache: true,
          parallel: true,
          sourceMap: true, // Must be set to true if using source-maps in production
          terserOptions: {
            keep_classnames: true
          }
        })
      ]
    }
  })
);

const worker = {
  mode: "production",
  optimization: {
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: true, // Must be set to true if using source-maps in production
        terserOptions: {
          keep_classnames: true
        }
      })
    ]
  }
};

module.exports = [...pages, merge(commonWorker, worker)];
