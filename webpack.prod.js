const TerserPlugin = require("terser-webpack-plugin");
const merge = require("webpack-merge");
const [common_app, common_worker, buildTemplates] = require("./webpack.common.js");

const app = {
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

module.exports = [merge(common_app, app), merge(common_worker, worker), buildTemplates];
