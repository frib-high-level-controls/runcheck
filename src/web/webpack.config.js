const path = require('path')
const webpack = require('webpack')

const VueLoaderPlugin = require('vue-loader/lib/plugin')

module.exports = {
  mode: 'development',
  entry: {
    slot: './src/web/ts/slot-action.ts',
    device: './src/web/ts/device-action.ts',
    group: './src/web/ts/slot-group-action.ts',
  },
  output: {
    path: path.resolve(__dirname, '../../public/dist'),
    //publicPath: '/dist/',
    //filename: 'build.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        enforce: 'pre',
        loader: 'tslint-loader',
        options: {
          /* Loader options go here */
          configFile: 'tslint.json',
          emitErrors: false,
          failOnHint: true,
        },
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            // Since sass-loader (weirdly) has SCSS as its default parse mode, we map
            // the "scss" and "sass" values for the lang attribute to the right configs here.
            // other preprocessors should work out of the box, no loader config like this necessary.
            'scss': 'vue-style-loader!css-loader!sass-loader',
            'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
          }
          // other vue-loader options go here
        }
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
        }
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]'
        }
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      ChecklistUtil: './checklistutil.ts',
      WebUtil: './shared/webutil.ts',
    }),
    // initialize the vue-loader
    new VueLoaderPlugin(),
  ],
  resolve: {
    extensions: ['.ts', '.js', '.vue', '.json'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    }
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true
  },
  performance: {
    hints: false
  },
  devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
  module.exports.mode = 'production';
  module.exports.devtool = 'source-map';
}
