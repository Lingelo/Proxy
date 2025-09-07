import {
  ConfigValidator,
  validateConfiguration,
  formatValidationErrors,
} from '../../src/utils/validation';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateRequired', () => {
    test('should pass for valid values', () => {
      const result = validator.validateRequired('field', 'valid-value').getResult();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail for undefined values', () => {
      const result = validator.validateRequired('field', undefined).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('field is required');
    });

    test('should fail for null values', () => {
      const result = validator.validateRequired('field', null).getResult();

      expect(result.isValid).toBe(false);
    });

    test('should fail for empty string', () => {
      const result = validator.validateRequired('field', '').getResult();

      expect(result.isValid).toBe(false);
    });
  });

  describe('validateNumber', () => {
    test('should pass for valid numbers', () => {
      const result = validator.validateNumber('port', '3000', 1, 65535).getResult();

      expect(result.isValid).toBe(true);
    });

    test('should fail for non-numeric values', () => {
      const result = validator.validateNumber('port', 'not-a-number').getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a valid number');
    });

    test('should fail for numbers below minimum', () => {
      const result = validator.validateNumber('port', '0', 1, 65535).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be >= 1');
    });

    test('should fail for numbers above maximum', () => {
      const result = validator.validateNumber('port', '70000', 1, 65535).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be <= 65535');
    });
  });

  describe('validateString', () => {
    test('should pass for valid strings', () => {
      const result = validator.validateString('name', 'valid-name', 3, 20).getResult();

      expect(result.isValid).toBe(true);
    });

    test('should fail for non-string values', () => {
      const result = validator.validateString('name', 123).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a string');
    });

    test('should fail for strings too short', () => {
      const result = validator.validateString('name', 'ab', 3).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be at least 3 characters');
    });

    test('should fail for strings too long', () => {
      const result = validator.validateString('name', 'very-long-name', 3, 10).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be at most 10 characters');
    });
  });

  describe('validateEnum', () => {
    test('should pass for valid enum values', () => {
      const result = validator
        .validateEnum('level', 'info', ['error', 'warn', 'info', 'debug'])
        .getResult();

      expect(result.isValid).toBe(true);
    });

    test('should fail for invalid enum values', () => {
      const result = validator
        .validateEnum('level', 'invalid', ['error', 'warn', 'info', 'debug'])
        .getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be one of: error, warn, info, debug');
    });
  });

  describe('validateUrl', () => {
    test('should pass for valid URLs', () => {
      const result = validator.validateUrl('target', 'localhost:3000').getResult();

      expect(result.isValid).toBe(true);
    });

    test('should pass for IP addresses with ports', () => {
      const result = validator.validateUrl('target', '192.168.1.1:8080').getResult();

      expect(result.isValid).toBe(true);
    });

    test('should fail for invalid URL format', () => {
      const result = validator.validateUrl('target', 'invalid-url').getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain("must be in format 'host:port'");
    });

    test('should fail for invalid port range', () => {
      const result = validator.validateUrl('target', 'localhost:70000').getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be between 1 and 65535');
    });

    test('should fail for empty host', () => {
      const result = validator.validateUrl('target', ':3000').getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain("must be in format 'host:port'");
    });
  });

  describe('validateUrls', () => {
    test('should pass for valid URL arrays', () => {
      const result = validator
        .validateUrls('targets', ['localhost:3000', 'localhost:3001'])
        .getResult();

      expect(result.isValid).toBe(true);
    });

    test('should fail for non-arrays', () => {
      const result = validator.validateUrls('targets', 'not-an-array' as any).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be an array');
    });

    test('should fail for empty arrays', () => {
      const result = validator.validateUrls('targets', []).getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must contain at least one URL');
    });

    test('should fail for duplicate URLs', () => {
      const result = validator
        .validateUrls('targets', ['localhost:3000', 'localhost:3000'])
        .getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('contains duplicate URLs');
    });

    test('should validate each URL in the array', () => {
      const result = validator
        .validateUrls('targets', ['localhost:3000', 'invalid-url'])
        .getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'targets[1]')).toBe(true);
    });
  });

  describe('validateHost', () => {
    test('should pass for valid hosts', () => {
      const validHosts = ['0.0.0.0', '127.0.0.1', 'localhost', '192.168.1.1'];

      validHosts.forEach(host => {
        const result = new ConfigValidator().validateHost('host', host).getResult();

        expect(result.isValid).toBe(true);
      });
    });

    test('should fail for invalid hosts', () => {
      const result = validator.validateHost('host', 'invalid-host').getResult();

      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a valid IP address or hostname');
    });
  });
});

describe('validateConfiguration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should pass for valid configuration', () => {
    process.env.TARGET_URLS = 'localhost:3000|localhost:3001';
    process.env.TIMEOUT = '5000';
    process.env.PORT = '7777';

    const config = {
      targets: ['localhost:3000', 'localhost:3001'],
      host: '0.0.0.0',
      logLevel: 'info',
    };

    const result = validateConfiguration(config);
    expect(result.isValid).toBe(true);
  });

  test('should fail when TARGET_URLS is missing', () => {
    delete process.env.TARGET_URLS;

    const config = {
      targets: [],
      host: '0.0.0.0',
      logLevel: 'info',
    };

    const result = validateConfiguration(config);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'TARGET_URLS')).toBe(true);
  });
});

describe('formatValidationErrors', () => {
  test('should format errors correctly', () => {
    const errors = [
      { field: 'PORT', message: 'PORT must be a number', value: 'invalid' },
      { field: 'HOST', message: 'HOST is required' },
    ];

    const formatted = formatValidationErrors(errors);

    expect(formatted).toContain('❌ PORT must be a number (got: invalid)');
    expect(formatted).toContain('❌ HOST is required');
  });

  test('should handle errors without values', () => {
    const errors = [{ field: 'HOST', message: 'HOST is required' }];

    const formatted = formatValidationErrors(errors);
    expect(formatted).toBe('  ❌ HOST is required');
  });
});
