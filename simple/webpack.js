const path = require("path");
const dist = path.resolve(__dirname, "../dist");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const template = {
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

module.exports = ["pcr", "assembly", "genome_viewer"].map(name => ({
    ...template,
    entry: `./simple/${name}.tsx`,
    output: {
        filename: `simple_${name}.js`,
        path: dist
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: `simple_${name}.html`,
            template: path.resolve(__dirname, `${name}.html`)
        })
    ]
}));
