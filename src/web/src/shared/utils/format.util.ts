// date-fns v2.30.0 - Date formatting utilities
import { format } from 'date-fns';
import { DateFormat } from './date.util';

/**
 * Supported currency codes for the hotel management system
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'AUD';

/**
 * Interface for common formatting options with locale support
 */
export interface FormatOptions {
  locale?: string;
  includeSymbol?: boolean;
  decimals?: number;
  preserveWords?: boolean;
  direction?: 'ltr' | 'rtl';
}

// Default formatting constants
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_DECIMALS = 2;
const ROOM_NUMBER_REGEX = /^\d{3,4}$/;

/**
 * Formats monetary values according to locale with currency symbol and proper decimal places
 * @param amount - Numeric amount to format
 * @param currencyCode - ISO currency code
 * @param options - Formatting options
 * @returns Formatted currency string
 * @throws TypeError for invalid amount
 */
export const formatCurrency = (
  amount: number,
  currencyCode: CurrencyCode,
  options: FormatOptions = {}
): string => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new TypeError('Invalid amount provided for currency formatting');
  }

  const locale = options.locale || DEFAULT_LOCALE;
  const decimals = options.decimals ?? (currencyCode === 'JPY' ? 0 : DEFAULT_DECIMALS);

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return formatter.format(amount);
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${currencyCode} ${amount}`;
  }
};

/**
 * Formats phone numbers in standardized international format
 * @param phoneNumber - Raw phone number string
 * @param countryCode - ISO country code
 * @returns Formatted international phone number
 */
export const formatPhoneNumber = (
  phoneNumber: string,
  countryCode: string
): string => {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length < 10) {
    return phoneNumber; // Return original if invalid
  }

  try {
    const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'unit',
      unit: 'phone'
    });

    // Format based on country code
    switch (countryCode) {
      case 'US':
        return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      case 'GB':
        return `+44 ${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
      default:
        return `+${countryCode} ${formatter.format(Number(cleaned))}`;
    }
  } catch (error) {
    console.error('Phone formatting error:', error);
    return phoneNumber;
  }
};

/**
 * Formats room numbers with floor prefix and standardized padding
 * @param roomNumber - Raw room number string
 * @param options - Formatting options
 * @returns Formatted room number
 */
export const formatRoomNumber = (
  roomNumber: string,
  options: FormatOptions = {}
): string => {
  if (!ROOM_NUMBER_REGEX.test(roomNumber)) {
    return 'Invalid Room';
  }

  try {
    const floor = roomNumber.slice(0, 1);
    const number = roomNumber.slice(1).padStart(2, '0');
    
    return options.includeSymbol 
      ? `Floor ${floor} - Room ${number}`
      : `${floor}${number}`;
  } catch (error) {
    console.error('Room number formatting error:', error);
    return roomNumber;
  }
};

/**
 * Formats decimal values as percentages with locale-aware formatting
 * @param value - Decimal value to format as percentage
 * @param options - Formatting options
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  options: FormatOptions = {}
): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new TypeError('Invalid value provided for percentage formatting');
  }

  const locale = options.locale || DEFAULT_LOCALE;
  const decimals = options.decimals ?? DEFAULT_DECIMALS;

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    return formatter.format(value);
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return `${(value * 100).toFixed(decimals)}%`;
  }
};

/**
 * Truncates text with proper ellipsis handling and RTL support
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @param options - Formatting options
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (
  text: string,
  maxLength: number,
  options: FormatOptions = {}
): string => {
  if (!text || maxLength <= 0) {
    return text;
  }

  const direction = options.direction || 'ltr';
  const ellipsis = '...';

  if (text.length <= maxLength) {
    return text;
  }

  try {
    let truncated = text.slice(0, maxLength - ellipsis.length);

    if (options.preserveWords) {
      // Find last complete word
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 0) {
        truncated = truncated.slice(0, lastSpace);
      }
    }

    return direction === 'rtl'
      ? `${ellipsis}${truncated}`
      : `${truncated}${ellipsis}`;
  } catch (error) {
    console.error('Text truncation error:', error);
    return text;
  }
};