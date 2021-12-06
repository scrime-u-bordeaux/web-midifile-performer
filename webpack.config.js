const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const webpack = require('webpack');
const express = require('express');
const path = require('path');
const env = process.env.NODE_ENV;

// for multiple html files generation, see :
// https://stackoverflow.com/questions/39798095/multiple-html-files-using-webpack

module.exports = {
  mode: env == 'production' || env == 'none' ? env : 'development',
  entry: [ './src/client/index' ],
  output: {
    publicPath: '/midifile-performer-web',
  },
  // entry: {
  //   'home':               './src/client/home',
  //   'first-steps':        './src/client/first-steps',
  //   'midifile-performer': './src/client/midifile-performer',
  // },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: 'vue-loader',
        /*
        options: {
          compilerOptions: {
            isCustomElement: (tag) => {
              //console.log(`${tag} is a custom element`);
              return [
                'font',
                'font-face',
                'glyph',
                'missing-glyph',
              ].indexOf(tag) !== -1;
            },
          },
        },
        //*/
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
        { from: 'src/client/assets', to: '' },
        { from: 'node_modules/piano-mp3/piano-mp3', to: 'piano-mp3'}
      ]
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
      inject: true
    }),
    new VueLoaderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ]
};