// @ts-check
import { describe, test, expect } from '@jest/globals'; // v29.0.0
import {
  validateEmail,
  validatePhone,
  validateDateRange,
  validateRequired,
  validateCreditCard,
  validateAmount
} from '../../../src/shared/utils/validation.util';

describe('validateEmail', () => {
  test('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name+tag@example.co.uk',
      '123@domain.com',
      'test.email@subdomain.example.com'
    ];

    validEmails.forEach(email => {
      expect(validateEmail(email).isValid).toBe(true);
    });
  });

  test('should reject invalid email formats', () => {
    const invalidEmails = [
      '',
      'invalid.email',
      '@domain.com',
      'test@',
      'test@.com',
      'test@domain.',
      'test space@domain.com'
    ];

    invalidEmails.forEach(email => {
      expect(validateEmail(email).isValid).toBe(false);
    });
  });

  test('should detect SQL injection patterns', () => {
    const maliciousEmails = [
      "test@domain.com'--",
      'test@domain.com;DROP TABLE users',
      "test'OR'1'='1'@domain.com"
    ];

    maliciousEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });
  });

  test('should enforce maximum length restriction', () => {
    const longEmail = 'a'.repeat(245) + '@domain.com';
    const result = validateEmail(longEmail);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Email is too long');
  });
});

describe('validatePhone', () => {
  test('should validate international phone formats', () => {
    const validPhones = [
      '+1234567890',
      '+442071234567',
      '+61291234567',
      '+85221234567'
    ];

    validPhones.forEach(phone => {
      expect(validatePhone(phone).isValid).toBe(true);
    });
  });

  test('should reject invalid phone formats', () => {
    const invalidPhones = [
      '',
      '1234567890',
      '+123',
      '+abcdefghijk',
      '+0123456789',
      '+1234567890123456'
    ];

    invalidPhones.forEach(phone => {
      expect(validatePhone(phone).isValid).toBe(false);
    });
  });

  test('should validate country codes correctly', () => {
    const phonesWithInvalidCodes = [
      '+0123456789', // Invalid starting with 0
      '+999123456789' // Invalid country code
    ];

    phonesWithInvalidCodes.forEach(phone => {
      const result = validatePhone(phone);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid country code');
    });
  });

  test('should handle formatted phone numbers', () => {
    const formattedPhones = [
      '+1 (234) 567-890',
      '+44 20 7123 4567',
      '+61 2 9123 4567'
    ];

    formattedPhones.forEach(phone => {
      expect(validatePhone(phone).isValid).toBe(true);
    });
  });
});

describe('validateDateRange', () => {
  test('should validate correct date ranges', () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1); // Tomorrow
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 5); // 5 days stay

    const result = validateDateRange(checkIn, checkOut);
    expect(result.isValid).toBe(true);
  });

  test('should reject past check-in dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    const result = validateDateRange(pastDate, futureDate);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Check-in date cannot be in the past');
  });

  test('should enforce maximum stay duration', () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 91); // 91 days stay

    const result = validateDateRange(checkIn, checkOut);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Maximum stay duration is 90 days');
  });

  test('should add warnings for peak seasons', () => {
    const checkIn = new Date('2024-12-20');
    const checkOut = new Date('2024-12-25');

    const result = validateDateRange(checkIn, checkOut);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Peak season rates may apply');
  });
});

describe('validateRequired', () => {
  test('should validate non-empty values', () => {
    const validValues = [
      'test',
      123,
      ['item'],
      { key: 'value' },
      true,
      new Date()
    ];

    validValues.forEach(value => {
      expect(validateRequired(value, 'Field').isValid).toBe(true);
    });
  });

  test('should reject empty or null values', () => {
    const invalidValues = [
      null,
      undefined,
      '',
      '   ',
      [],
      new Array()
    ];

    invalidValues.forEach(value => {
      const result = validateRequired(value, 'TestField');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/TestField/);
    });
  });

  test('should provide appropriate error messages for different types', () => {
    const result1 = validateRequired('', 'Name');
    expect(result1.error).toBe('Name cannot be empty');

    const result2 = validateRequired([], 'Items');
    expect(result2.error).toBe('At least one Items must be selected');
  });
});

describe('validateCreditCard', () => {
  test('should validate different card types', () => {
    const validCards = [
      { number: '4532015112830366', type: 'VISA' },
      { number: '5200828282828210', type: 'MASTERCARD' },
      { number: '371449635398431', type: 'AMEX' },
      { number: '6011000990139424', type: 'DISCOVER' }
    ];

    validCards.forEach(card => {
      const result = validateCreditCard(card.number);
      expect(result.isValid).toBe(true);
      expect(result.cardType).toBe(card.type);
    });
  });

  test('should reject invalid card numbers', () => {
    const invalidCards = [
      '1234567890123456', // Invalid format
      '4532015112830367', // Invalid checksum
      '5200828282828211', // Invalid checksum
      '371449635398432'   // Invalid checksum
    ];

    invalidCards.forEach(card => {
      expect(validateCreditCard(card).isValid).toBe(false);
    });
  });

  test('should handle formatted card numbers', () => {
    const formattedCards = [
      '4532-0151-1283-0366',
      '5200 8282 8282 8210',
      '3714 496353 98431'
    ];

    formattedCards.forEach(card => {
      expect(validateCreditCard(card).isValid).toBe(true);
    });
  });

  test('should validate specific card types', () => {
    const visa = '4532015112830366';
    const mastercard = '5200828282828210';

    expect(validateCreditCard(visa, 'VISA').isValid).toBe(true);
    expect(validateCreditCard(visa, 'MASTERCARD').isValid).toBe(false);
    expect(validateCreditCard(mastercard, 'MASTERCARD').isValid).toBe(true);
  });
});

describe('validateAmount', () => {
  test('should validate amounts with correct decimal places', () => {
    const validAmounts = [
      { amount: 100.00, currency: 'USD' },
      { amount: 99.99, currency: 'EUR' },
      { amount: 1000, currency: 'JPY' },
      { amount: 100.005, currency: 'BHD' }
    ];

    validAmounts.forEach(({ amount, currency }) => {
      expect(validateAmount(amount, currency).isValid).toBe(true);
    });
  });

  test('should reject invalid decimal places', () => {
    const invalidAmounts = [
      { amount: 100.001, currency: 'USD' },
      { amount: 99.999, currency: 'EUR' },
      { amount: 1000.5, currency: 'JPY' },
      { amount: 100.0001, currency: 'BHD' }
    ];

    invalidAmounts.forEach(({ amount, currency }) => {
      const result = validateAmount(amount, currency);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/Invalid decimal places/);
    });
  });

  test('should reject negative and zero amounts', () => {
    const invalidAmounts = [
      0,
      -1,
      -100.00,
      -99.99
    ];

    invalidAmounts.forEach(amount => {
      const result = validateAmount(amount, 'USD');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Amount must be greater than zero');
    });
  });

  test('should enforce maximum amount limits', () => {
    const result = validateAmount(1000001, 'USD');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Amount cannot exceed 1000000 USD');
  });
});