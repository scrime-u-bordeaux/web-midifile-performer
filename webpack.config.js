const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const webpack = require('webpack');
const express = require('express');
const path = require('path');
// const config = require('./config');
// console.log(env == 'production' || env == 'none' ? env : 'development',);

// for multiple html files generation, see :
// https://stackoverflow.com/questions/39798095/multiple-html-files-using-webpack

module.exports = {
  performance: { hints: false }, // AVOID MAX ASSETS SIZE WARNING
  mode: process.env.NODE_ENV || 'development',
  entry: [ './src/client/index' ],
  output: {
    publicPath: process.env.PUBLIC_PATH || '/',
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
          // options: {
          //   compilerOptions: {
          //     isCustomElement: (tag) => {
          //       //console.log(`${tag} is a custom element`);
          //       // 'font',
          //       // 'font-face',
          //       // 'glyph',
          //       // 'missing-glyph',
          //     },
          //   },
          // },
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [ 'vue-style-loader', 'css-loader' ]
      }
    ]
  },
  devServer: {
    hot: true,
    // watchOptions: {
    //   poll: true
    // }
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/client/assets', to: '' }
      ]
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
      inject: true
    }),
    new VueLoaderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ],
  resolve: {
    fallback: {
      crypto: false,
      fs: false,
      path: false
    }
  },
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true,
  },
};
