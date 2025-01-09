const Dotenv = require('dotenv-webpack');
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

module.exports = (env) => { return {
  // AVOID MAX ASSETS SIZE WARNING :
  performance: { hints: false },
  // tell webpack to do its stuff for production or development :
  mode: env.NODE_ENV || 'development', // is this even working ? maybe webpack 5 and webpack-cli 4 make a mess together ?
  entry: [ './src/client/index' ],
  output: {
    // apparently, this is sufficient for all known use cases (for use with createWebHashHistory) ...
    publicPath: '',
    // but if we want to use connect-history with vue-router (using createWebHistory), we need this :
    // publicPath: env.PUBLIC_PATH || '/',
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [ 'vue-style-loader', 'css-loader' ]
      },
      {
        test: /\.png$/,
        type: 'asset/resource',
        generator: {
          filename: '[name][ext]'
        }
      },
    ]
  },
  devServer: {
    hot: true,
    // watchOptions: {
    //   poll: true
    // }
  },
  plugins: [
    new Dotenv(),
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
}};
