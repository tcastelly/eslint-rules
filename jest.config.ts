import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js'],
  testEnvironment: 'node',
  collectCoverage: true,
  coveragePathIgnorePatterns: [],
  testMatch: ['<rootDir>/tests/**/*.spec.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!dist',
    '!coverage/**',
    '!node_modules/**',
  ],
};

export default config;
