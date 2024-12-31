/**
 * @fileoverview Validation utility functions for the Hotel Management ERP system.
 * Provides centralized validation logic with enhanced error tracking and reporting.
 * @version 1.0.0
 */

import Joi from 'joi'; // v17.9.0
import { ErrorCode } from '../constants/error-codes';
import { HttpStatusCode } from '../constants/status-codes';

/**
 * Interface defining the structure of validation results with enhanced tracking
 */
export interface ValidationResult {
  /** Indicates if validation passed */
  isValid: boolean;
  /** Array of validation error messages */
  errors: string[];
  /** Timestamp when validation was performed */
  timestamp: Date;
  /** API endpoint or path where validation occurred */
  requestPath: string;
  /** Context describing what was being validated */
  validationContext: string;
}

/**
 * Custom error class for validation failures with enhanced tracking capabilities
 */
export class ValidationError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly requestPath: string;
  public readonly validationContext: string;

  /**
   * Creates a new validation error instance with enhanced tracking information
   * @param message - Error message describing the validation failure
   * @param details - Additional details about the validation failure
   * @param requestPath - API endpoint or path where validation failed
   * @param validationContext - Context describing what was being validated
   */
  constructor(
    message: string,
    details: Record<string, unknown>,
    requestPath: string,
    validationContext: string
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = ErrorCode.VALIDATION_ERROR;
    this.details = details;
    this.timestamp = new Date();
    this.requestPath = requestPath;
    this.validationContext = validationContext;

    // Ensure proper prototype chain for error instanceof checks
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Validates request data against a Joi schema with enhanced error reporting
 * @param data - Request data to validate
 * @param schema - Joi schema to validate against
 * @param requestPath - API endpoint or path being validated
 * @param context - Description of validation context
 * @returns Validation result with detailed error information
 */
export async function validateRequest(
  data: object,
  schema: Joi.Schema,
  requestPath: string,
  context: string
): Promise<ValidationResult> {
  const options: Joi.ValidationOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: false
  };

  try {
    await schema.validateAsync(data, options);
    return {
      isValid: true,
      errors: [],
      timestamp: new Date(),
      requestPath,
      validationContext: context
    };
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      const errors = error.details.map(detail => detail.message);
      return {
        isValid: false,
        errors,
        timestamp: new Date(),
        requestPath,
        validationContext: context
      };
    }
    
    // Handle unexpected validation errors
    throw new ValidationError(
      'Unexpected validation error occurred',
      { originalError: error },
      requestPath,
      context
    );
  }
}

/**
 * Validates data model against a Joi schema with enhanced error reporting
 * @param model - Data model to validate
 * @param schema - Joi schema to validate against
 * @param context - Description of validation context
 * @returns Validation result with detailed error information
 */
export async function validateModel(
  model: object,
  schema: Joi.Schema,
  context: string
): Promise<ValidationResult> {
  const options: Joi.ValidationOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: false
  };

  try {
    await schema.validateAsync(model, options);
    return {
      isValid: true,
      errors: [],
      timestamp: new Date(),
      requestPath: 'model-validation',
      validationContext: context
    };
  } catch (error) {
    if (error instanceof Joi.ValidationError) {
      const errors = error.details.map(detail => detail.message);
      return {
        isValid: false,
        errors,
        timestamp: new Date(),
        requestPath: 'model-validation',
        validationContext: context
      };
    }

    // Handle unexpected validation errors
    throw new ValidationError(
      'Unexpected model validation error occurred',
      { originalError: error },
      'model-validation',
      context
    );
  }
}

/**
 * Helper function to create a validation error response
 * @internal
 */
function createValidationErrorResponse(
  errors: string[],
  requestPath: string,
  context: string
): ValidationResult {
  return {
    isValid: false,
    errors,
    timestamp: new Date(),
    requestPath,
    validationContext: context
  };
}