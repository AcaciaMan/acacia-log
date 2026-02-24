module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/out/', 'e2e\\.test\\.ts'],
    testMatch: [
      '**/__tests__/**/*.[jt]s?(x)',
      '**/?(*.)+(spec|test).[jt]s?(x)',
      '**/?(*.)+(spec|test).jest.[jt]s?(x)',
    ],
    globals: {
      'ts-jest': {
        tsconfig: 'tsconfig.json'
      }
    },
    moduleNameMapper: {
      '^vscode$': '<rootDir>/__mocks__/vscode.js'
    },
    collectCoverageFrom: [
      'src/**/*.ts',
      '!src/test/**',
      '!src/**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'lcov', 'json'],
    coverageThreshold: {
      global: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
  };