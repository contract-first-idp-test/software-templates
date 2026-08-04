module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/', '/test/smoke/', '/test/live/',
    '/test/contracts/consumption.test.js',
  ],
};
