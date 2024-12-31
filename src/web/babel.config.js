// @babel/preset-env@7.22.0
// @babel/preset-react@7.22.0
// @babel/preset-typescript@7.22.0
// core-js@3.30.0

/**
 * Production-ready Babel configuration for Hotel Management ERP Frontend
 * Optimizes JavaScript/TypeScript transpilation with comprehensive preset configurations
 * Supports React 18+, modern JavaScript features, and TypeScript
 */
module.exports = {
  presets: [
    // Optimized preset-env configuration for modern JavaScript features
    ['@babel/preset-env', {
      targets: {
        node: '18',
        browsers: [
          '>0.2%',
          'not dead',
          'not op_mini all'
        ]
      },
      modules: false, // Preserve ES modules for tree shaking
      useBuiltIns: 'usage', // Optimized polyfill injection
      corejs: 3, // Use core-js@3 for polyfills
      debug: false, // Disable debug output in production
      bugfixes: true, // Enable bug fixes for better code output
      shippedProposals: true // Support shipped proposals
    }],

    // React preset configuration with automatic runtime
    ['@babel/preset-react', {
      runtime: 'automatic', // Use new JSX transform
      development: process.env.NODE_ENV === 'development',
      importSource: '@emotion/react', // Support emotion CSS-in-JS
      throwIfNamespace: true, // Error on XML namespaces
      pure: true // Enable pure annotations for better optimization
    }],

    // TypeScript preset with enhanced TSX support
    ['@babel/preset-typescript', {
      isTSX: true, // Enable TSX parsing
      allExtensions: true, // Handle all file extensions
      allowNamespaces: true, // Support TypeScript namespaces
      allowDeclareFields: true, // Support declare field syntax
      onlyRemoveTypeImports: true // Optimize type imports removal
    }]
  ],

  // Environment-specific configurations
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current' // Target current Node version in test
          },
          modules: 'commonjs' // Use CommonJS modules in test
        }]
      ]
    },
    production: {
      presets: [
        ['@babel/preset-env', {
          modules: false, // Preserve ES modules in production
          targets: '> 0.25%, not dead', // Optimized browser targets
          useBuiltIns: 'usage', // Optimized polyfill injection
          corejs: 3,
          bugfixes: true,
          debug: false
        }]
      ]
    }
  },

  // No additional plugins needed as presets provide required functionality
  plugins: []
};