// Jest configuration for Hotel Management System Web Frontend
// Version: Jest 29+
// Dependencies:
// - ts-jest: ^29.1.0
// - jest-environment-jsdom: ^29.5.0
// - @testing-library/jest-dom: ^5.16.5
// - identity-obj-proxy: ^3.0.0

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Use jsdom environment for DOM manipulation
  testEnvironment: 'jsdom',

  // Test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],

  // Module name mapping for clean imports
  moduleNameMapper: {
    // Path aliases matching tsconfig.json
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    
    // Handle style file imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle static asset imports
    '\\.(jpg|jpeg|png|gif|svg|eot|otf|webp|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/tests/__mocks__/fileMock.js'
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '@testing-library/jest-dom',
    '<rootDir>/src/tests/setupTests.ts'
  ],

  // Test file patterns
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/**/types.ts',
    '!src/tests/**/*',
    '!src/mocks/**/*',
    '!src/styles/**/*',
    '!src/assets/**/*'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // TypeScript transformation configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },

  // Global configuration for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: true,
      isolatedModules: true
    }
  },

  // Test timeout configuration
  testTimeout: 10000,

  // Worker thread configuration
  maxWorkers: '50%',

  // Ignore patterns
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/'
  ],

  // Clear mocks between tests
  clearMocks: true,

  // Verbose output for detailed test results
  verbose: true,

  // Enable code coverage collection
  collectCoverage: true,

  // Coverage report formats
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover'
  ]
};

export default config;