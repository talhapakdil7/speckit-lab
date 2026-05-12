import type { Config } from 'jest';

const base: Pick<
  Config,
  'preset' | 'testEnvironment' | 'moduleFileExtensions' | 'transform' | 'setupFilesAfterEnv'
> = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFilesAfterEnv: [],
};

/**
 * Jest configuration with three projects matching constitution §3
 * (unit / integration / e2e). Coverage thresholds match §2:
 * lines ≥ 80%, branches ≥ 75% globally.
 */
const config: Config = {
  projects: [
    {
      ...base,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.spec.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/db/repositories/**/*.ts',
    'src/middleware/**/*.ts',
    'src/routes/schemas/**/*.ts',
    '!src/index.ts',
    '!src/db/migrations/**',
  ],
  coverageThreshold: {
    global: { lines: 80, branches: 75 },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};

export default config;
