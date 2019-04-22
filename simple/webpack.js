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
      title: "PCR",
      filename: "simple_pcr.html",
      meta: {
        viewport: "width=device-width, initial-scale=1.0"
      }
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
      title: "Assembly",
      filename: "simple_assembly.html",
      meta: {
        viewport: "width=device-width, initial-scale=1.0"
      }
    })
  ]
};

module.exports = [pcr, assembly];
