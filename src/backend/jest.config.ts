// Jest configuration for Hotel Management ERP Backend Services
// Version: Jest 29+
// Dependencies: ts-jest@^29.0.0, @types/jest@^29.0.0

import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  
  // Node environment for backend testing
  testEnvironment: 'node',
  
  // Test file locations
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // TypeScript transformation
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module path aliases matching tsconfig.json
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/src/shared/$1',
    '@billing/(.*)': '<rootDir>/src/billing-service/src/$1',
    '@guest/(.*)': '<rootDir>/src/guest-service/src/$1',
    '@reservation/(.*)': '<rootDir>/src/reservation-service/src/$1',
    '@room/(.*)': '<rootDir>/src/room-service/src/$1',
    '@websocket/(.*)': '<rootDir>/src/websocket-service/src/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'clover',
    'html'
  ],
  
  // Strict coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Service-specific thresholds
    './src/billing-service/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/guest-service/**/*.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  
  // Test execution configuration
  clearMocks: true,
  verbose: true,
  testTimeout: 10000,
  
  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'node'
  ],
  
  // Global test configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: {
        warnOnly: false
      }
    }
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Error handling
  bail: 1,
  
  // Parallel test execution for faster results
  maxWorkers: '50%'
};

export default config;