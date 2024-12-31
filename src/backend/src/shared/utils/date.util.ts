/**
 * @fileoverview Date utility functions for the Hotel Management ERP system.
 * Provides comprehensive date manipulation, formatting, and validation with timezone support.
 * Handles check-in/out dates, booking validations, and standardized date formats.
 * @version 1.0.0
 */

import {
  format,
  parse,
  isValid,
  differenceInDays,
  addDays,
  isBefore,
  isAfter
} from 'date-fns'; // v2.30.0
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'; // v2.0.0
import { ErrorCode } from '../constants/error-codes';

/**
 * Standardized date formats for different application contexts
 */
export enum DateFormat {
  API_FORMAT = "yyyy-MM-dd'T'HH:mm:ssXXX",
  DISPLAY_FORMAT = 'MMM dd, yyyy HH:mm',
  DATABASE_FORMAT = 'yyyy-MM-dd HH:mm:ss'
}

/**
 * Configuration options for date operations
 */
export interface DateOptions {
  timezone?: string;
  format?: DateFormat;
  strict?: boolean;
  maxStayDuration?: number;
  minAdvanceBooking?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<DateOptions> = {
  timezone: 'UTC',
  format: DateFormat.API_FORMAT,
  strict: true,
  maxStayDuration: 30, // Maximum stay duration in days
  minAdvanceBooking: 0  // Minimum days in advance for booking
};

/**
 * Formats a date to a standardized string format with timezone support
 * @param date - Date to format
 * @param format - Target format from DateFormat enum
 * @param timezone - Target timezone (IANA timezone identifier)
 * @returns Formatted date string
 * @throws Error if date is invalid
 */
export function formatDate(
  date: Date,
  format: DateFormat = DateFormat.API_FORMAT,
  timezone: string = DEFAULT_OPTIONS.timezone
): string {
  if (!isValid(date)) {
    throw new Error(`${ErrorCode.VALIDATION_ERROR}: Invalid date provided`);
  }

  const zonedDate = utcToZonedTime(date, timezone);
  return format(zonedDate, format);
}

/**
 * Parses a date string to a Date object with timezone handling
 * @param dateString - Date string to parse
 * @param format - Source format of the date string
 * @param timezone - Source timezone of the date string
 * @returns Parsed Date object in UTC
 * @throws Error if parsing fails
 */
export function parseDate(
  dateString: string,
  format: DateFormat = DateFormat.API_FORMAT,
  timezone: string = DEFAULT_OPTIONS.timezone
): Date {
  const parsedDate = parse(dateString, format, new Date());
  
  if (!isValid(parsedDate)) {
    throw new Error(
      `${ErrorCode.VALIDATION_ERROR}: Invalid date string format. Expected: ${format}`
    );
  }

  return zonedTimeToUtc(parsedDate, timezone);
}

/**
 * Calculates the number of nights between check-in and check-out dates
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 * @throws Error if dates are invalid or if check-out is before check-in
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  if (!isValid(checkIn) || !isValid(checkOut)) {
    throw new Error(`${ErrorCode.VALIDATION_ERROR}: Invalid date objects provided`);
  }

  if (isBefore(checkOut, checkIn)) {
    throw new Error(
      `${ErrorCode.VALIDATION_ERROR}: Check-out date must be after check-in date`
    );
  }

  const nights = differenceInDays(checkOut, checkIn);

  if (nights > DEFAULT_OPTIONS.maxStayDuration) {
    throw new Error(
      `${ErrorCode.VALIDATION_ERROR}: Stay duration exceeds maximum allowed (${DEFAULT_OPTIONS.maxStayDuration} nights)`
    );
  }

  return nights;
}

/**
 * Validates a booking date range against business rules
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param options - Validation options
 * @returns boolean indicating if the booking range is valid
 */
export function isValidBookingRange(
  checkIn: Date,
  checkOut: Date,
  options: DateOptions = DEFAULT_OPTIONS
): boolean {
  const now = new Date();
  const minBookingDate = addDays(now, options.minAdvanceBooking || 0);

  // Validate date objects
  if (!isValid(checkIn) || !isValid(checkOut)) {
    return false;
  }

  // Check if check-in is not in the past and meets minimum advance booking
  if (isBefore(checkIn, minBookingDate)) {
    return false;
  }

  // Ensure check-out is after check-in
  if (!isAfter(checkOut, checkIn)) {
    return false;
  }

  // Validate against maximum stay duration
  const nights = differenceInDays(checkOut, checkIn);
  if (nights > (options.maxStayDuration || DEFAULT_OPTIONS.maxStayDuration)) {
    return false;
  }

  return true;
}

/**
 * Converts a local date to UTC
 * @param date - Local date to convert
 * @param timezone - Source timezone
 * @returns Date in UTC
 */
export function toUTC(date: Date, timezone: string = DEFAULT_OPTIONS.timezone): Date {
  if (!isValid(date)) {
    throw new Error(`${ErrorCode.VALIDATION_ERROR}: Invalid date provided`);
  }
  return zonedTimeToUtc(date, timezone);
}

/**
 * Converts a UTC date to local timezone
 * @param date - UTC date to convert
 * @param timezone - Target timezone
 * @returns Date in local timezone
 */
export function fromUTC(date: Date, timezone: string = DEFAULT_OPTIONS.timezone): Date {
  if (!isValid(date)) {
    throw new Error(`${ErrorCode.VALIDATION_ERROR}: Invalid date provided`);
  }
  return utcToZonedTime(date, timezone);
}

/**
 * Checks if a date is within a valid range
 * @param date - Date to check
 * @param startDate - Start of valid range
 * @param endDate - End of valid range
 * @returns boolean indicating if date is within range
 */
export function isWithinRange(date: Date, startDate: Date, endDate: Date): boolean {
  if (!isValid(date) || !isValid(startDate) || !isValid(endDate)) {
    throw new Error(`${ErrorCode.VALIDATION_ERROR}: Invalid date objects provided`);
  }
  
  return isAfter(date, startDate) && isBefore(date, endDate);
}