---
name: jest-configuration
description: Use when jest configuration, setup files, module resolution, and project organization for optimal testing environments.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Jest Configuration

Master Jest configuration, setup files, module resolution, and project organization for optimal testing environments. This skill covers all aspects of configuring Jest for modern JavaScript and TypeScript projects, from basic setup to advanced multi-project configurations.

## Installation and Setup

### Basic Installation

```bash
# npm
npm install --save-dev jest

# yarn
yarn add --dev jest

# pnpm
pnpm add -D jest
```

### TypeScript Support

```bash
npm install --save-dev @types/jest ts-jest
```

### React Testing Libraries

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

## Configuration Files

### jest.config.js (Recommended)

```javascript
/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node', // or 'jsdom' for browser-like environment

  // Root directory for tests
  roots: ['<rootDir>/src'],

  // File extensions to consider
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],

  // Transform files before testing
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**'
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

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Module name mapper for imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Verbose output
  verbose: true
};
```

### TypeScript Configuration (jest.config.ts)

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

export default config;
```

### Package.json Configuration

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node"
  }
}
```

## Setup Files

### jest.setup.js

```javascript
// Global test setup
import '@testing-library/jest-dom';

// Set up global test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.API_URL = 'http://localhost:3000';

// Global before/after hooks
beforeAll(() => {
  // Setup code that runs once before all tests
  console.log('Starting test suite');
});

afterAll(() => {
  // Cleanup code that runs once after all tests
  console.log('Test suite completed');
});

// Mock console methods to reduce noise
global.console = {
  ...console,
  error: jest.fn(),
  warning: jest.fn()
};

// Custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});
```

### Setup for React Testing

```javascript
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};
```

## Module Resolution

### Path Mapping

```javascript
// jest.config.js
module.exports = {
  moduleNameMapper: {
    // Alias mapping
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',

    // Style mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',

    // Asset mocks
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(woff|woff2|eot|ttf|otf)$': '<rootDir>/__mocks__/fileMock.js'
  },

  // Module directories
  modulePaths: ['<rootDir>/src'],

  // Module paths to ignore
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/'
  ]
};
```

### File Mocks

```javascript
// __mocks__/fileMock.js
module.exports = 'test-file-stub';
```

```javascript
// __mocks__/styleMock.js
module.exports = {};
```

## Multi-Project Configuration

### Monorepo Setup

```javascript
// jest.config.js
module.exports = {
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/client/**/*.test.{js,jsx,ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/packages/client/jest.setup.js']
    },
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/server/**/*.test.{js,ts}'],
      setupFilesAfterEnv: ['<rootDir>/packages/server/jest.setup.js']
    },
    {
      displayName: 'shared',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/shared/**/*.test.{js,ts}']
    }
  ],
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ]
};
```

### Project-Specific Configuration

```javascript
// packages/client/jest.config.js
module.exports = {
  displayName: 'client',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@babel/preset-react'] }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};
```

## Environment Configuration

### Custom Test Environment

```javascript
// custom-environment.js
const NodeEnvironment = require('jest-environment-node').default;

class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.testPath = context.testPath;
  }

  async setup() {
    await super.setup();
    // Custom setup logic
    this.global.testEnvironmentSetup = true;
  }

  async teardown() {
    // Custom teardown logic
    delete this.global.testEnvironmentSetup;
    await super.teardown();
  }

  getVmContext() {
    return super.getVmContext();
  }
}

module.exports = CustomEnvironment;
```

```javascript
// jest.config.js
module.exports = {
  testEnvironment: './custom-environment.js'
};
```

## Transform Configuration

### Babel Transform

```javascript
// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript',
    '@babel/preset-react'
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-transform-runtime'
  ]
};
```

### Custom Transformer

```javascript
// custom-transformer.js
const { createTransformer } = require('babel-jest');

module.exports = createTransformer({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript'
  ],
  plugins: ['babel-plugin-transform-import-meta']
});
```

## Best Practices

1. **Use TypeScript configuration files for type safety** - Leverage TypeScript config files to catch configuration errors at compile time
2. **Organize tests in `__tests__` directories** - Keep tests close to source files for better discoverability
3. **Set appropriate coverage thresholds** - Define realistic coverage goals that balance thoroughness with maintainability
4. **Use setup files for global configuration** - Centralize common setup logic to avoid repetition across test files
5. **Configure module name mappers for cleaner imports** - Use path aliases to make test imports more readable and maintainable
6. **Separate environment-specific configurations** - Use different configs for Node vs browser environments
7. **Clear mocks between tests** - Prevent test pollution by resetting mocks automatically
8. **Use projects for monorepo setups** - Leverage multi-project configuration for better organization
9. **Configure appropriate timeouts** - Set realistic timeouts for async operations to prevent false failures
10. **Use verbose output during development** - Enable detailed logging to aid in debugging test failures

## Common Pitfalls

1. **Forgetting to install required dependencies** - Missing @types/jest or testing libraries causes cryptic errors
2. **Incorrect module resolution paths** - Misconfigured moduleNameMapper leads to module not found errors
3. **Not clearing mocks between tests** - Shared mock state causes flaky tests and false positives
4. **Overly strict coverage thresholds** - Unrealistic coverage goals discourage testing and slow development
5. **Missing transform configuration** - Files not being transformed leads to syntax errors in tests
6. **Conflicting global and local configurations** - Package.json config overrides jest.config.js unexpectedly
7. **Not configuring test environment correctly** - Using wrong environment (node vs jsdom) causes undefined errors
8. **Ignoring setupFilesAfterEnv** - Missing global setup causes repetitive boilerplate in every test file
9. **Not handling CSS/asset imports** - Unmocked style imports break tests in Node environment
10. **Incorrect testMatch patterns** - Tests not being discovered due to pattern mismatches

## When to Use This Skill

- Setting up Jest in a new project from scratch
- Migrating from another testing framework to Jest
- Configuring Jest for TypeScript projects
- Setting up testing infrastructure for monorepos
- Optimizing Jest configuration for CI/CD pipelines
- Debugging module resolution issues in tests
- Configuring custom test environments
- Setting up path aliases for cleaner imports
- Implementing custom transformers for special file types
- Establishing coverage requirements for your team
