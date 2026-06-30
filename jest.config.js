export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: [
    'server/**/*.js',
    'src/**/*.js',
    '!server/**/*.test.js',
    '!src/**/*.test.js',
    '!server/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(localforage|framer-motion)/)'
  ]
}; 