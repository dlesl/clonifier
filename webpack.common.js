const path = require("path");
const dist = path.resolve(__dirname, "dist");
const static = path.resolve(__dirname, "static");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const app = {
  entry: "./app/index.tsx",
  output: {
    filename: "[name].bundle.js",
    chunkFilename: "[name].bundle.js",
    path: dist
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".wasm"]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: static, to: dist },
      {
        from: path.resolve(
          __dirname,
          "node_modules",
          "dialog-polyfill",
          "dialog-polyfill.css"
        ),
        to: dist
      }
    ])
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

const worker = {
  entry: "./worker/worker.ts",
  output: {
    path: dist,
    filename: "worker.js",
    // https://github.com/webpack/webpack/issues/6525
    globalObject: "this"
  },
  target: "webworker",
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".wasm"]
  },
  plugins: [
    new WasmPackPlugin({
      crateDirectory: path.resolve(__dirname, "rust")
    })
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

module.exports = [app, worker];
