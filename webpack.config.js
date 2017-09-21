var path = require('path');
var merge = require('webpack-merge');
var TARGET = process.env.npm_lifecycle_event;
var webpack = require('webpack');

var common_player_bits = {
    context: __dirname,
    entry: './src/app.ts',

    output: {
        path: path.join(__dirname, "./output"),
        filename: "bloomPlayer.js"
    },
    resolve: {
        root: ['.'],
        modulesDirectories: [path.resolve(__dirname, 'node_modules')],
        extensions: ['', '.js', '.ts', '.tsx']
    },

    module: {
        preLoaders: [ { test: /\.ts$/, loader: "tslint" } ],
        loaders: [
           { test: /\.ts(x?)$/, loader: 'ts-loader' },
           { test: /\.less$/, loaders: ['style-loader', 'css-loader', 'less-loader'] },
           //{ test: /\.(svg|png)$/, loader: 'file',  include: path.join(__dirname, "./assets")}
            { test: /\.(svg|png)$/, loader: 'url-loader',  include: path.join(__dirname, "./assets")}
        ],
    }
};

var common_page_player_bits = {
    context: __dirname,
    entry: './src/pagePlayer/app.ts',

    output: {
        path: path.join(__dirname, "./output"),
        filename: "bloomPagePlayer.js",
        libraryTarget: "var",
        library: "Root"
    },
    resolve: {
        root: ['.'],
        modulesDirectories: [path.resolve(__dirname, 'node_modules')],
        extensions: ['', '.js', '.ts', '.tsx']
    },

    module: {
        preLoaders: [ { test: /\.ts$/, loader: "tslint" } ],
        loaders: [
           { test: /\.ts(x?)$/, loader: 'ts-loader' },
           { test: /\.less$/, loaders: ['style-loader', 'css-loader', 'less-loader'] },
           //{ test: /\.(svg|png)$/, loader: 'file',  include: path.join(__dirname, "./assets")}
            { test: /\.(svg|png)$/, loader: 'url-loader',  include: path.join(__dirname, "./assets")}
        ],
    }
};

var dev_bits = {
   //devtool: 'source-map', // cannot cache SourceMaps for modules and need to regenerate complete SourceMap for the chunk. It’s something for production.
    devtool: '#cheap-module-eval-source-map', //the 'cheap' here means rows only, not columns
}

var production_bits = {
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        })
    ]
}

//we get this if the build is run via "npm run build:prod"
if (process.env.npm_lifecycle_event == "build:prod") {
     module.exports = [merge(common_player_bits, production_bits), merge(common_page_player_bits, production_bits)];
} else {
    module.exports = [merge(common_player_bits, dev_bits), merge(common_page_player_bits, dev_bits)];
}
