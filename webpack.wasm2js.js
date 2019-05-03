const path = require("path");
const dist = path.resolve(__dirname, "dist");
const static = path.resolve(__dirname, "static");
const TerserPlugin = require("terser-webpack-plugin");
// const CopyWebpackPlugin = require("copy-webpack-plugin");


const worker = {
  entry: "./worker/worker.ts",
  mode: "production",
  optimization: {
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        // sourceMap: true, // Must be set to true if using source-maps in production
        terserOptions: {
          keep_classnames: true,
          keep_fnames: true
        }
      })
    ]
  },
  output: {
    path: dist,
    filename: "worker_wasm2js.js",
    // https://github.com/webpack/webpack/issues/6525
    globalObject: "this"
  },
  target: "webworker",
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".wasm"]
  },
  plugins: [
  ],
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  }
};

module.exports = [worker];
