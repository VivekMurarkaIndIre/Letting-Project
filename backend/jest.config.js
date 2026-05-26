module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^../../firebase-service-account.json$': '<rootDir>/src/__mocks__/firebase-service-account.json',
  },
};
