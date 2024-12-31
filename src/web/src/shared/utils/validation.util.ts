// @ts-check
import { isValid } from 'date-fns'; // v2.30.0 - Date validation utilities

// Regular expressions for validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const MAX_STAY_DAYS = 90;

// Credit card validation patterns
const CREDIT_CARD_REGEX = {
  VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
  MASTERCARD: /^5[1-5][0-9]{14}$/,
  AMEX: /^3[47][0-9]{13}$/,
  DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/
};

// Types for validation responses
interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  cardType?: string;
}

/**
 * Validates email format using RFC 5322 standards with security checks
 * @param {string} email - Email address to validate
 * @returns {ValidationResult} Validation result with error message if invalid
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }

  // Remove potential dangerous characters
  const sanitizedEmail = email.trim().toLowerCase();
  
  // Check for common SQL injection patterns
  if (sanitizedEmail.includes('--') || sanitizedEmail.includes(';')) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (!EMAIL_REGEX.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
};

/**
 * Validates phone numbers in E.164 international format
 * @param {string} phone - Phone number to validate
 * @returns {ValidationResult} Validation result with error message if invalid
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-numeric characters except +
  const sanitizedPhone = phone.replace(/[^\d+]/g, '');

  if (!PHONE_REGEX.test(sanitizedPhone)) {
    return { isValid: false, error: 'Invalid phone number format. Use international format (e.g., +1234567890)' };
  }

  // Additional country code validation could be added here
  const countryCode = sanitizedPhone.slice(1, 4);
  if (countryCode.length < 1 || countryCode.length > 3) {
    return { isValid: false, error: 'Invalid country code' };
  }

  return { isValid: true };
};

/**
 * Validates check-in/check-out date ranges with business rules
 * @param {Date} checkIn - Check-in date
 * @param {Date} checkOut - Check-out date
 * @returns {ValidationResult} Validation result with errors and warnings
 */
export const validateDateRange = (checkIn: Date, checkOut: Date): ValidationResult => {
  const warnings: string[] = [];
  
  if (!isValid(checkIn) || !isValid(checkOut)) {
    return { isValid: false, error: 'Invalid date format' };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (checkIn < now) {
    return { isValid: false, error: 'Check-in date cannot be in the past' };
  }

  if (checkOut <= checkIn) {
    return { isValid: false, error: 'Check-out date must be after check-in date' };
  }

  const stayDuration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  
  if (stayDuration > MAX_STAY_DAYS) {
    return { isValid: false, error: `Maximum stay duration is ${MAX_STAY_DAYS} days` };
  }

  // Add warnings for peak seasons or special dates
  const checkInMonth = checkIn.getMonth();
  if (checkInMonth === 11 || checkInMonth === 0) { // December or January
    warnings.push('Peak season rates may apply');
  }

  return { isValid: true, warnings };
};

/**
 * Validates required fields with type-specific validation
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult} Validation result with error message if invalid
 */
export const validateRequired = (value: any, fieldName: string): ValidationResult => {
  if (value === undefined || value === null) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} cannot be empty` };
  }

  if (Array.isArray(value) && value.length === 0) {
    return { isValid: false, error: `At least one ${fieldName} must be selected` };
  }

  return { isValid: true };
};

/**
 * Validates credit card numbers using Luhn algorithm and card-specific patterns
 * @param {string} cardNumber - Credit card number to validate
 * @param {string} [cardType] - Optional card type for specific validation
 * @returns {ValidationResult} Validation result with card type and error message
 */
export const validateCreditCard = (cardNumber: string, cardType?: string): ValidationResult => {
  if (!cardNumber) {
    return { isValid: false, error: 'Credit card number is required' };
  }

  // Remove all non-numeric characters
  const sanitizedCard = cardNumber.replace(/\D/g, '');

  // Luhn algorithm implementation
  const luhnCheck = (num: string): boolean => {
    let sum = 0;
    let isEven = false;

    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  };

  // Determine card type if not provided
  let detectedType = cardType;
  if (!detectedType) {
    for (const [type, regex] of Object.entries(CREDIT_CARD_REGEX)) {
      if (regex.test(sanitizedCard)) {
        detectedType = type;
        break;
      }
    }
  }

  if (!detectedType) {
    return { isValid: false, error: 'Unsupported credit card type' };
  }

  if (!CREDIT_CARD_REGEX[detectedType as keyof typeof CREDIT_CARD_REGEX].test(sanitizedCard)) {
    return { isValid: false, error: 'Invalid credit card number format' };
  }

  if (!luhnCheck(sanitizedCard)) {
    return { isValid: false, error: 'Invalid credit card number' };
  }

  return { isValid: true, cardType: detectedType };
};

/**
 * Validates monetary amounts with currency-specific rules
 * @param {number} amount - Amount to validate
 * @param {string} currency - Currency code (e.g., 'USD', 'EUR')
 * @returns {ValidationResult} Validation result with error message if invalid
 */
export const validateAmount = (amount: number, currency: string): ValidationResult => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { isValid: false, error: 'Invalid amount' };
  }

  if (amount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }

  // Currency-specific decimal place validation
  const currencyDecimals: { [key: string]: number } = {
    USD: 2,
    EUR: 2,
    JPY: 0,
    BHD: 3
  };

  const decimals = currencyDecimals[currency] || 2;
  const multiplier = Math.pow(10, decimals);
  const roundedAmount = Math.round(amount * multiplier) / multiplier;

  if (amount !== roundedAmount) {
    return { 
      isValid: false, 
      error: `Invalid decimal places for ${currency}. Maximum ${decimals} decimal places allowed`
    };
  }

  // Maximum amount validation (example: $1,000,000)
  const maxAmount = 1000000;
  if (amount > maxAmount) {
    return { isValid: false, error: `Amount cannot exceed ${maxAmount} ${currency}` };
  }

  return { isValid: true };
};