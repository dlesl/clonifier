const path = require("path");
const dist = path.resolve(__dirname, "dist");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");

module.exports = {
  mode: "production",
  entry: "./templates/build_templates.ts",
  output: {
    path: path.resolve(dist, "tmp"),
    filename: "build_templates.js"
  },
  target: "node",
  resolve: {
    extensions: [".js", ".ts", ".wasm"]
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
