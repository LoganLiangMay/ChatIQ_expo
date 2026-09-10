/**
 * Smoke tests to verify basic functionality
 */

describe('MessageAI App', () => {
  it('should pass smoke test', () => {
    expect(true).toBe(true);
  });

  it('should have valid package.json', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('messageai');
    expect(pkg.version).toBeDefined();
  });
});

describe('Utils', () => {
  it('should import formatters without errors', () => {
    expect(() => require('../utils/formatters')).not.toThrow();
  });

  it('should import validation without errors', () => {
    expect(() => require('../utils/validation')).not.toThrow();
  });
});
