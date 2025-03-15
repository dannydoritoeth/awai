/// <reference types="jest" />
import { validateEmail, validatePhone, validateUrl, validateRequired } from '../../utils/validationUtils';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@.com')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('+1-234-567-8900')).toBe(true);
      expect(validatePhone('(123) 456-7890')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('abc')).toBe(false);
      expect(validatePhone(null)).toBe(false);
      expect(validatePhone(undefined)).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://sub.domain.com/path')).toBe(true);
      expect(validateUrl('https://example.com?param=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('')).toBe(false);
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('http://')).toBe(false);
      expect(validateUrl(null)).toBe(false);
      expect(validateUrl(undefined)).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should validate required fields', () => {
      expect(validateRequired('value')).toBe(true);
      expect(validateRequired(0)).toBe(true);
      expect(validateRequired(false)).toBe(true);
    });

    it('should reject empty or null values', () => {
      expect(validateRequired('')).toBe(false);
      expect(validateRequired(null)).toBe(false);
      expect(validateRequired(undefined)).toBe(false);
    });
  });
}); 