/**
 * @fileoverview Standardized error codes and messages for the Hotel Management ERP system.
 * Provides consistent error handling and reporting across all microservices with enhanced
 * security and debugging capabilities.
 * @version 1.0.0
 */

import { HttpStatusCode } from './status-codes';

/**
 * Enumeration of standardized error codes used across the system.
 * Each code represents a specific category of error for precise error handling.
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
  INVALID_OPERATION = 'INVALID_OPERATION',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION'
}

/**
 * User-friendly error messages that provide clear information without exposing
 * sensitive system details. Messages are designed to be helpful while maintaining security.
 */
export const ErrorMessage = {
  VALIDATION_ERROR: 'The provided data is invalid or incomplete',
  AUTHENTICATION_ERROR: 'Unable to verify your credentials',
  AUTHORIZATION_ERROR: 'You do not have permission to perform this action',
  RESOURCE_NOT_FOUND: 'The requested resource could not be found',
  RESOURCE_CONFLICT: 'A conflict occurred with the requested operation',
  RATE_LIMIT_EXCEEDED: 'Request limit exceeded, please try again later',
  DATABASE_ERROR: 'Unable to complete database operation',
  EXTERNAL_SERVICE_ERROR: 'External service is currently unavailable',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',
  MAINTENANCE_MODE: 'System is currently under maintenance',
  INVALID_OPERATION: 'The requested operation cannot be performed',
  BUSINESS_RULE_VIOLATION: 'Operation violates business rules'
} as const;

/**
 * Maps error codes to their corresponding HTTP status codes for consistent
 * API response status codes across all endpoints.
 */
export const ErrorHttpStatusMap: Record<ErrorCode, HttpStatusCode> = {
  [ErrorCode.VALIDATION_ERROR]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.AUTHENTICATION_ERROR]: HttpStatusCode.UNAUTHORIZED,
  [ErrorCode.AUTHORIZATION_ERROR]: HttpStatusCode.FORBIDDEN,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
  [ErrorCode.RESOURCE_CONFLICT]: HttpStatusCode.CONFLICT,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatusCode.TOO_MANY_REQUESTS,
  [ErrorCode.DATABASE_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: HttpStatusCode.SERVICE_UNAVAILABLE,
  [ErrorCode.INTERNAL_SERVER_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
  [ErrorCode.MAINTENANCE_MODE]: HttpStatusCode.SERVICE_UNAVAILABLE,
  [ErrorCode.INVALID_OPERATION]: HttpStatusCode.BAD_REQUEST,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: HttpStatusCode.BAD_REQUEST
};

/**
 * Interface defining the structure of error details returned to clients.
 * Includes necessary information for debugging while maintaining security.
 */
export interface ErrorDetails {
  /**
   * Standardized error code identifying the type of error
   */
  code: ErrorCode;

  /**
   * User-friendly error message
   */
  message: string;

  /**
   * Additional error context and details
   * @security Ensure no sensitive information is included
   */
  details?: Record<string, unknown>;

  /**
   * ISO timestamp when the error occurred
   */
  timestamp: string;

  /**
   * Unique trace ID for error tracking and debugging
   * @security Do not expose internal system identifiers
   */
  traceId: string;

  /**
   * Request path where the error occurred
   */
  path: string;
}

/**
 * Interface for internal error logging with additional system details
 * @internal
 */
export interface SystemErrorDetails extends ErrorDetails {
  /**
   * Original error stack trace
   */
  stack?: string;

  /**
   * Service name where the error occurred
   */
  service: string;

  /**
   * Environment where the error occurred
   */
  environment: string;

  /**
   * Additional technical details for debugging
   */
  technical?: Record<string, unknown>;
}

/**
 * Type guard to check if an error code is valid
 * @param code - The error code to validate
 */
export function isValidErrorCode(code: string): code is ErrorCode {
  return Object.values(ErrorCode).includes(code as ErrorCode);
}

/**
 * Creates a standardized error details object
 * @param code - Error code
 * @param details - Additional error details
 * @param path - Request path
 * @param traceId - Unique trace ID
 */
export function createErrorDetails(
  code: ErrorCode,
  details?: Record<string, unknown>,
  path = '',
  traceId = ''
): ErrorDetails {
  return {
    code,
    message: ErrorMessage[code],
    details,
    timestamp: new Date().toISOString(),
    traceId,
    path
  };
}

/**
 * Gets the HTTP status code for a given error code
 * @param code - Error code
 */
export function getHttpStatusForError(code: ErrorCode): HttpStatusCode {
  return ErrorHttpStatusMap[code];
}