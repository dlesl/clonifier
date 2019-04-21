const merge = require("webpack-merge");
const [commonApp, commonWorker] = require("./webpack.common.js");
const simpleApps = require("./simple/webpack.js");

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

module.exports = [merge(commonApp, app), merge(commonWorker, worker), ...simpleApps.map(a => merge(a, app))];
