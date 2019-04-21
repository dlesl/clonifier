const path = require("path");
const dist = path.resolve(__dirname, "../dist");

const app = {
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"]
  },
  plugins: [],
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
    filename: "pcr.js",
    path: dist
  }
};

const assembly = {
  ...app,
  entry: "./simple/assembly.tsx",
  output: {
    filename: "assembly.js",
    path: dist
  }
};

module.exports = [pcr, assembly];
