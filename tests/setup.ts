// Test setup file
import { jest } from '@jest/globals';

// Mock console to reduce noise during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});