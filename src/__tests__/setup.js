// Test setup file for DOM environment
import '@testing-library/jest-dom';

// Mock window.getComputedStyle globally
Object.defineProperty(window, 'getComputedStyle', {
  value: jest.fn(() => ({
    length: 0,
    getPropertyValue: jest.fn(() => ''),
    ...Array.from({ length: 0 }, (_, i) => i.toString())
  }))
});

// Mock HTMLCanvasElement
Object.defineProperty(window, 'HTMLCanvasElement', {
  value: class {
    constructor() {
      this.width = 100;
      this.height = 100;
      this.getContext = jest.fn(() => ({
        drawImage: jest.fn()
      }));
      this.toDataURL = jest.fn(() => 'data:image/png;base64,test');
    }
  }
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
};

// Polyfill TextEncoder for Node.js environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Dummy test to prevent Jest from treating this as a test file
describe('Setup', () => {
  it('should load setup file', () => {
    expect(true).toBe(true);
  });
}); 