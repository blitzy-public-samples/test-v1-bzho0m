// ESLint configuration for Hotel Management ERP Frontend
// Dependencies:
// @typescript-eslint/eslint-plugin@^6.0.0
// @typescript-eslint/parser@^6.0.0
// eslint-plugin-react@^7.33.0
// eslint-plugin-react-hooks@^4.6.0
// eslint-config-prettier@^8.8.0

module.exports = {
  root: true,
  
  // Use TypeScript parser for enhanced type checking
  parser: '@typescript-eslint/parser',
  
  // Parser options for TypeScript and React support
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },

  // React-specific settings
  settings: {
    react: {
      version: 'detect',
    },
  },

  // Environment configuration
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true,
  },

  // Required plugins for TypeScript and React
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
  ],

  // Extended configurations
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Must be last to override other formatting rules
  ],

  // Custom rule configurations
  rules: {
    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/jsx-key': 'error', // Enforce keys in iterative elements
    'react/no-array-index-key': 'warn', // Discourage using array indices as keys
    'react/jsx-no-target-blank': 'error', // Prevent security issues with target="_blank"
    'react/jsx-pascal-case': 'error', // Enforce PascalCase for components

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error', // Enforce hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Check effect dependencies

    // TypeScript specific rules
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Allow implicit return types
    '@typescript-eslint/no-explicit-any': 'error', // Prevent usage of 'any' type
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-non-null-assertion': 'error', // Prevent non-null assertions
    '@typescript-eslint/consistent-type-imports': 'error', // Enforce consistent type imports
    '@typescript-eslint/no-floating-promises': 'error', // Require promise handling
    '@typescript-eslint/await-thenable': 'error', // Ensure await is used with promises

    // General JavaScript/TypeScript rules
    'no-console': ['warn', {
      allow: ['warn', 'error']
    }],
    'eqeqeq': 'error', // Require === and !==
    'no-var': 'error', // Prefer let/const over var
    'prefer-const': 'error', // Require const for non-reassigned variables
    'arrow-body-style': ['error', 'as-needed'], // Enforce concise arrow functions
    'no-duplicate-imports': 'error', // Prevent duplicate imports
    'no-template-curly-in-string': 'error', // Prevent template literal placeholder syntax in regular strings
    'prefer-template': 'error', // Enforce template literals over string concatenation
    'no-param-reassign': 'error', // Prevent parameter reassignment
    'no-return-await': 'error', // Prevent unnecessary return await
    'no-throw-literal': 'error', // Require throwing Error objects
    'prefer-promise-reject-errors': 'error', // Require rejecting promises with Error objects
    'require-await': 'error', // Prevent async functions without await
    
    // Code style rules
    'curly': ['error', 'all'], // Enforce curly braces for all control statements
    'no-multiple-empty-lines': ['error', {
      max: 1,
      maxEOF: 0,
      maxBOF: 0,
    }],
    'padding-line-between-statements': [
      'error',
      { blankLine: 'always', prev: '*', next: 'return' },
      { blankLine: 'always', prev: ['const', 'let'], next: '*' },
      { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
    ],
  },

  // Override rules for specific file patterns
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      files: ['**/*.stories.tsx'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
  ],
};