/// <reference types="jest" />
import { formatDate, parseDate, isValidDate, getDaysBetween } from '../../utils/dateUtils';

describe('Date Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-03-15');
      expect(formatDate(date)).toBe('2024-03-15');
    });

    it('should handle invalid dates', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('invalid')).toBe('');
    });
  });

  describe('parseDate', () => {
    it('should parse date string correctly', () => {
      const dateStr = '2024-03-15';
      const result = parseDate(dateStr);
      if (result) {
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(2); // March is 2 (0-based)
        expect(result.getDate()).toBe(15);
      } else {
        fail('Expected result to be a valid Date');
      }
    });

    it('should handle invalid date strings', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
    });
  });

  describe('isValidDate', () => {
    it('should validate correct dates', () => {
      expect(isValidDate('2024-03-15')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate('2024-01-01')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('2024-13-45')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });
  });

  describe('getDaysBetween', () => {
    it('should calculate days between dates correctly', () => {
      const start = '2024-03-15';
      const end = '2024-03-20';
      expect(getDaysBetween(start, end)).toBe(5);
    });

    it('should handle same day', () => {
      const date = '2024-03-15';
      expect(getDaysBetween(date, date)).toBe(0);
    });

    it('should handle invalid dates', () => {
      expect(getDaysBetween('invalid', '2024-03-15')).toBe(0);
      expect(getDaysBetween('2024-03-15', 'invalid')).toBe(0);
      expect(getDaysBetween('', '')).toBe(0);
      expect(getDaysBetween(null, null)).toBe(0);
      expect(getDaysBetween(undefined, undefined)).toBe(0);
    });
  });
}); 