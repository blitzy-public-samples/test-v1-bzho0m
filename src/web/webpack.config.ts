import path from 'path';
import webpack from 'webpack'; // ^5.88.0
import HtmlWebpackPlugin from 'html-webpack-plugin'; // ^5.5.0
import MiniCssExtractPlugin from 'mini-css-extract-plugin'; // ^2.7.0
import TerserPlugin from 'terser-webpack-plugin'; // ^5.3.9
import CompressionPlugin from 'compression-webpack-plugin'; // ^10.0.0
import 'webpack-dev-server'; // ^4.15.0

// Import TypeScript configuration
import { compilerOptions } from './tsconfig.json';

interface BuildEnv {
  production: boolean;
  platform: 'web' | 'mobile';
}

const getConfig = (env: BuildEnv): webpack.Configuration => {
  const isProduction = env.production;
  const isDevelopment = !isProduction;
  const platform = env.platform;

  // Base configuration
  const config: webpack.Configuration = {
    mode: isProduction ? 'production' : 'development',
    target: platform === 'web' ? 'web' : 'node',
    
    // Entry points based on platform
    entry: {
      app: platform === 'web' 
        ? './src/web/index.tsx'
        : './src/mobile/index.tsx',
    },

    // Output configuration with content hashing for cache busting
    output: {
      path: path.resolve(__dirname, '../../dist', platform),
      filename: isProduction 
        ? 'js/[name].[contenthash:8].js'
        : 'js/[name].js',
      chunkFilename: isProduction 
        ? 'js/[name].[chunkhash:8].chunk.js'
        : 'js/[name].chunk.js',
      publicPath: '/',
      clean: true,
      assetModuleFilename: 'assets/[hash][ext][query]',
    },

    // Development tools configuration
    devtool: isProduction ? 'source-map' : 'eval-source-map',

    // Module resolution and compilation rules
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@services': path.resolve(__dirname, 'src/services'),
      },
    },

    module: {
      rules: [
        // TypeScript compilation
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: isDevelopment,
                experimentalWatchApi: true,
                configFile: path.resolve(__dirname, 'tsconfig.json'),
              },
            },
          ],
          exclude: /node_modules/,
        },

        // CSS processing
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  auto: true,
                  localIdentName: isProduction
                    ? '[hash:base64]'
                    : '[path][name]__[local]',
                },
                sourceMap: true,
              },
            },
            'postcss-loader',
          ],
        },

        // Asset handling
        {
          test: /\.(png|jpg|jpeg|gif|svg|woff|woff2|eot|ttf)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
        },
      ],
    },

    // Optimization configuration
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: -10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: 'single',
    },

    // Plugins configuration
    plugins: [
      // Environment variables
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(
          isProduction ? 'production' : 'development'
        ),
        'process.env.PLATFORM': JSON.stringify(platform),
      }),

      // HTML template processing
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        inject: true,
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false,
      }),

      // CSS extraction for production
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: 'css/[name].[contenthash:8].css',
          chunkFilename: 'css/[name].[contenthash:8].chunk.css',
        }),
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 10240,
          minRatio: 0.8,
        }),
      ] : []),
    ],

    // Development server configuration
    devServer: isDevelopment ? {
      host: 'localhost',
      port: 3000,
      hot: true,
      historyApiFallback: true,
      compress: true,
      client: {
        overlay: true,
        progress: true,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          secure: false,
          changeOrigin: true,
        },
      },
      static: {
        directory: path.join(__dirname, 'public'),
      },
    } : undefined,

    // Performance hints
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };

  return config;
};

export default getConfig;