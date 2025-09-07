interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

class ConfigValidator {
  private errors: ValidationError[] = [];

  validateRequired(field: string, value: any, message?: string): this {
    if (value === undefined || value === null || value === '') {
      this.errors.push({
        field,
        message: message || `${field} is required`,
        value,
      });
    }
    return this;
  }

  validateNumber(field: string, value: any, min?: number, max?: number): this {
    if (value === undefined || value === null) {
      return this;
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      this.errors.push({
        field,
        message: `${field} must be a valid number`,
        value,
      });
      return this;
    }

    if (min !== undefined && numValue < min) {
      this.errors.push({
        field,
        message: `${field} must be >= ${min}`,
        value: numValue,
      });
    }

    if (max !== undefined && numValue > max) {
      this.errors.push({
        field,
        message: `${field} must be <= ${max}`,
        value: numValue,
      });
    }

    return this;
  }

  validateString(field: string, value: any, minLength?: number, maxLength?: number): this {
    if (value === undefined || value === null) {
      return this;
    }

    if (typeof value !== 'string') {
      this.errors.push({
        field,
        message: `${field} must be a string`,
        value,
      });
      return this;
    }

    if (minLength !== undefined && value.length < minLength) {
      this.errors.push({
        field,
        message: `${field} must be at least ${minLength} characters`,
        value,
      });
    }

    if (maxLength !== undefined && value.length > maxLength) {
      this.errors.push({
        field,
        message: `${field} must be at most ${maxLength} characters`,
        value,
      });
    }

    return this;
  }

  validateEnum(field: string, value: any, allowedValues: string[]): this {
    if (value === undefined || value === null) {
      return this;
    }

    if (!allowedValues.includes(value)) {
      this.errors.push({
        field,
        message: `${field} must be one of: ${allowedValues.join(', ')}`,
        value,
      });
    }

    return this;
  }

  validateUrl(field: string, value: string): this {
    if (!value) return this;

    // Basic URL format validation (host:port)
    const urlPattern = /^[a-zA-Z0-9.-]+:[0-9]+$/;
    if (!urlPattern.test(value)) {
      this.errors.push({
        field,
        message: `${field} must be in format 'host:port' (e.g., 'localhost:3000')`,
        value,
      });
      return this;
    }

    const [host, portStr] = value.split(':');
    const port = parseInt(portStr, 10);

    // Validate host
    if (!host || host.length === 0) {
      this.errors.push({
        field,
        message: `Invalid host in ${field}`,
        value,
      });
    }

    // Validate port range
    if (port < 1 || port > 65535) {
      this.errors.push({
        field,
        message: `Port in ${field} must be between 1 and 65535`,
        value,
      });
    }

    return this;
  }

  validateUrls(field: string, urls: string[]): this {
    if (!Array.isArray(urls)) {
      this.errors.push({
        field,
        message: `${field} must be an array`,
        value: urls,
      });
      return this;
    }

    if (urls.length === 0) {
      this.errors.push({
        field,
        message: `${field} must contain at least one URL`,
        value: urls,
      });
      return this;
    }

    urls.forEach((url, index) => {
      this.validateUrl(`${field}[${index}]`, url);
    });

    // Check for duplicates
    const uniqueUrls = new Set(urls);
    if (uniqueUrls.size !== urls.length) {
      this.errors.push({
        field,
        message: `${field} contains duplicate URLs`,
        value: urls,
      });
    }

    return this;
  }

  validateHost(field: string, value: string): this {
    if (!value) return this;

    const validHosts = ['0.0.0.0', '127.0.0.1', 'localhost'];
    const isIpPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (!validHosts.includes(value) && !isIpPattern.test(value)) {
      this.errors.push({
        field,
        message: `${field} must be a valid IP address or hostname`,
        value,
      });
    }

    return this;
  }

  getResult(): ValidationResult {
    const result = {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
    };

    // Reset errors for next validation
    this.errors = [];

    return result;
  }
}

export function validateConfiguration(config: any): ValidationResult {
  const validator = new ConfigValidator();

  validator
    .validateRequired(
      'TARGET_URLS',
      process.env.TARGET_URLS,
      'TARGET_URLS environment variable is required'
    )
    .validateUrls('TARGET_URLS', config.targets)
    .validateNumber('TIMEOUT', process.env.TIMEOUT, 100, 30000)
    .validateNumber('PORT', process.env.PORT, 1, 65535)
    .validateHost('HOST', config.host)
    .validateEnum('LOG_LEVEL', config.logLevel, [
      'error',
      'warn',
      'info',
      'http',
      'verbose',
      'debug',
      'silly',
    ]);

  return validator.getResult();
}

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map(error => {
      const valueStr = error.value !== undefined ? ` (got: ${error.value})` : '';
      return `  ❌ ${error.message}${valueStr}`;
    })
    .join('\n');
}

export { ConfigValidator, ValidationError, ValidationResult };
