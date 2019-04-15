const merge = require("webpack-merge");
const [common_app, common_worker, buildTemplates] = require("./webpack.common.js");

const app = {
  mode: "development",
  devtool: "source-map",
  devServer: {
    contentBase: "./dist"
  }
};

const worker = {
  mode: "development",
  devtool: "source-map"
};

module.exports = [merge(common_app, app), merge(common_worker, worker),/* buildTemplates*/];
