// date-fns v2.30.0 - Core date manipulation utilities
import { 
  format, 
  parse, 
  isValid, 
  differenceInDays, 
  addDays, 
  isBefore, 
  isAfter 
} from 'date-fns';

// date-fns-tz v2.0.0 - Timezone handling utilities
import { 
  zonedTimeToUtc, 
  utcToZonedTime 
} from 'date-fns-tz';

/**
 * Standard date formats used across the frontend application
 */
export enum DateFormat {
  DISPLAY_FORMAT = 'MMM dd, yyyy',
  API_FORMAT = "yyyy-MM-dd'T'HH:mm:ssXXX",
  INPUT_FORMAT = 'yyyy-MM-dd'
}

/**
 * Interface for date formatting options
 */
export interface DateOptions {
  timezone: string;
  format: DateFormat;
  includeTime?: boolean;
  locale?: string;
}

/**
 * Options for booking date validation
 */
export interface BookingValidationOptions {
  maxStayDuration: number;
  minNoticeHours: number;
  restrictedDates?: Date[];
}

/**
 * Type for date validation results with detailed error information
 */
export type DateValidationResult = {
  isValid: boolean;
  error?: string;
  details?: ValidationDetails;
};

/**
 * Type for validation details
 */
type ValidationDetails = {
  code: string;
  message: string;
  params?: Record<string, any>;
};

/**
 * Type for stay duration calculation results with DST handling
 */
export type StayDuration = {
  nights: number;
  hasDstTransition: boolean;
  dstAdjustment: number;
};

/**
 * Formats a date for display in the UI with timezone and locale support
 * @param date - Date to format
 * @param format - Desired output format
 * @param timezone - Target timezone (defaults to 'UTC')
 * @param locale - Locale for formatting (defaults to 'en-US')
 * @returns Formatted date string or error message if invalid
 */
export const formatDisplayDate = (
  date: Date,
  format: DateFormat = DateFormat.DISPLAY_FORMAT,
  timezone: string = 'UTC',
  locale: string = 'en-US'
): string => {
  try {
    if (!date || !isValid(date)) {
      throw new Error('Invalid date provided');
    }

    // Sanitize timezone input
    const sanitizedTimezone = timezone?.trim() || 'UTC';

    // Convert to target timezone
    const zonedDate = utcToZonedTime(date, sanitizedTimezone);

    // Format with locale support
    return format(zonedDate, format, {
      locale: locale,
      timeZone: sanitizedTimezone
    });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid date';
  }
};

/**
 * Validates check-in and check-out dates for hotel bookings
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param options - Validation options
 * @returns Validation result with detailed error information
 */
export const validateBookingDates = (
  checkIn: Date,
  checkOut: Date,
  options: BookingValidationOptions = {
    maxStayDuration: 30,
    minNoticeHours: 24
  }
): DateValidationResult => {
  try {
    // Validate date objects
    if (!isValid(checkIn) || !isValid(checkOut)) {
      return {
        isValid: false,
        error: 'Invalid date format',
        details: {
          code: 'INVALID_DATE_FORMAT',
          message: 'One or both dates are invalid'
        }
      };
    }

    // Check if check-in is in the past
    const now = new Date();
    if (isBefore(checkIn, now)) {
      return {
        isValid: false,
        error: 'Check-in date cannot be in the past',
        details: {
          code: 'PAST_CHECKIN',
          message: 'Check-in date must be in the future'
        }
      };
    }

    // Verify minimum notice period
    const hoursUntilCheckIn = differenceInDays(checkIn, now) * 24;
    if (hoursUntilCheckIn < options.minNoticeHours) {
      return {
        isValid: false,
        error: `Booking requires at least ${options.minNoticeHours} hours notice`,
        details: {
          code: 'INSUFFICIENT_NOTICE',
          message: `Minimum notice period is ${options.minNoticeHours} hours`,
          params: { required: options.minNoticeHours, provided: hoursUntilCheckIn }
        }
      };
    }

    // Verify check-out is after check-in
    if (!isAfter(checkOut, checkIn)) {
      return {
        isValid: false,
        error: 'Check-out must be after check-in',
        details: {
          code: 'INVALID_CHECKOUT',
          message: 'Check-out date must be after check-in date'
        }
      };
    }

    // Validate against maximum stay duration
    const stayDuration = differenceInDays(checkOut, checkIn);
    if (stayDuration > options.maxStayDuration) {
      return {
        isValid: false,
        error: `Stay cannot exceed ${options.maxStayDuration} days`,
        details: {
          code: 'EXCEEDS_MAX_DURATION',
          message: `Maximum stay duration is ${options.maxStayDuration} days`,
          params: { maxDuration: options.maxStayDuration, requested: stayDuration }
        }
      };
    }

    // Check restricted dates if provided
    if (options.restrictedDates?.length) {
      const hasRestrictedDate = options.restrictedDates.some(
        restrictedDate => 
          isValid(restrictedDate) &&
          (
            format(checkIn, DateFormat.INPUT_FORMAT) === format(restrictedDate, DateFormat.INPUT_FORMAT) ||
            format(checkOut, DateFormat.INPUT_FORMAT) === format(restrictedDate, DateFormat.INPUT_FORMAT)
          )
      );

      if (hasRestrictedDate) {
        return {
          isValid: false,
          error: 'Selected dates include restricted dates',
          details: {
            code: 'RESTRICTED_DATES',
            message: 'One or more selected dates are not available for booking'
          }
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Date validation error:', error);
    return {
      isValid: false,
      error: 'Date validation failed',
      details: {
        code: 'VALIDATION_ERROR',
        message: 'An error occurred during date validation'
      }
    };
  }
};

/**
 * Calculates the duration of stay in nights with DST handling
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param timezone - Hotel's timezone
 * @returns Object containing nights count and DST adjustment information
 */
export const calculateStayDuration = (
  checkIn: Date,
  checkOut: Date,
  timezone: string = 'UTC'
): StayDuration => {
  try {
    if (!isValid(checkIn) || !isValid(checkOut)) {
      throw new Error('Invalid date input');
    }

    // Convert dates to hotel's timezone
    const zonedCheckIn = utcToZonedTime(checkIn, timezone);
    const zonedCheckOut = utcToZonedTime(checkOut, timezone);

    // Calculate raw difference in days
    const nights = differenceInDays(zonedCheckOut, zonedCheckIn);

    // Check for DST transitions
    let dstAdjustment = 0;
    let hasDstTransition = false;

    // Iterate through each day to check for DST transitions
    for (let i = 0; i < nights; i++) {
      const currentDay = addDays(zonedCheckIn, i);
      const nextDay = addDays(zonedCheckIn, i + 1);
      
      const currentDayHours = format(currentDay, 'H');
      const nextDayHours = format(nextDay, 'H');
      
      if (currentDayHours !== nextDayHours) {
        hasDstTransition = true;
        dstAdjustment += (Number(nextDayHours) - Number(currentDayHours));
      }
    }

    return {
      nights,
      hasDstTransition,
      dstAdjustment
    };
  } catch (error) {
    console.error('Stay duration calculation error:', error);
    return {
      nights: 0,
      hasDstTransition: false,
      dstAdjustment: 0
    };
  }
};