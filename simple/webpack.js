const path = require("path");
const dist = path.resolve(__dirname, "../dist");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const app = {
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  }
};

const pcr = {
  ...app,
  entry: "./simple/pcr.tsx",
  output: {
    filename: "simple_pcr.js",
    path: dist
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "simple_pcr.html",
      template: path.resolve(__dirname, "pcr.html")
    })
  ]
};

const assembly = {
  ...app,
  entry: "./simple/assembly.tsx",
  output: {
    filename: "simple_assembly.js",
    path: dist
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "simple_assembly.html",
      template: path.resolve(__dirname, "assembly.html")
    })
  ]
};

module.exports = [pcr, assembly];
