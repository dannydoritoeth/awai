// Add any global test setup here
// For example, setting up global mocks or test utilities

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console.error to fail tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return;
  }
  originalError.call(console, ...args);
}; 