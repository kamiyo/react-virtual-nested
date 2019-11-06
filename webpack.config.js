const path = require('path');
const ForkTsCheckerPlugin = require('fork-ts-checker-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const basePlugins = [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
        template: path.resolve(__dirname, './public/index.html')
    }),
];

const getDevPlugins = () => [
    ...basePlugins,
    new ForkTsCheckerPlugin({
        checkSyntacticErrors: true
    }),
];

module.exports = {
    entry: path.resolve(__dirname, './src/index.tsx'),
    output: {
        path: path.resolve(__dirname, './build'),
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].chunk.js',
    },
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
        rules: [{
            test: /\.(t|j)sx?$/,
            include: path.resolve(__dirname, './src'),
            use: [
                {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                    }
                }
            ]
        }, {
            test: /\.css$/,
            include: path.resolve(__dirname, './src'),
            use: ['style-loader', 'css-loader']
        }]
    },
    devServer: {
        contentBase: path.resolve(__dirname, './build'),
        port: 3000
    },
    plugins: getDevPlugins(),
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
}