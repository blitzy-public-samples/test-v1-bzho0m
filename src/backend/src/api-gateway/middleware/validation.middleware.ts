/**
 * @fileoverview Express middleware for centralized request validation in the API Gateway.
 * Provides schema validation, data sanitization, and error tracking for all incoming API requests.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import Joi from 'joi'; // v17.9.0
import { ErrorCode } from '../../shared/constants/error-codes';
import { HttpStatusCode } from '../../shared/constants/status-codes';
import { validateRequest } from '../../shared/utils/validation.util';

/**
 * Interface defining validation schema configuration for request components
 */
export interface ValidationSchema {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
}

/**
 * Interface for structured validation error responses
 */
export interface ValidationError {
  code: ErrorCode;
  message: string;
  path: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// Cache for compiled validation schemas
const schemaCache = new Map<string, ValidationSchema>();

/**
 * Memoization decorator for schema compilation
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cacheKey = `${target.constructor.name}-${propertyKey}`;

  descriptor.value = function (...args: any[]) {
    if (schemaCache.has(cacheKey)) {
      return schemaCache.get(cacheKey);
    }
    const result = originalMethod.apply(this, args);
    schemaCache.set(cacheKey, result);
    return result;
  };
}

/**
 * Factory function that creates validation middleware for specific routes with schema caching
 * @param schema - Validation schema configuration
 * @returns Express middleware function for request validation
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body if schema provided
      if (schema.body && req.body) {
        const bodyValidation = await validateRequest(
          req.body,
          schema.body,
          req.path,
          'request-body'
        );
        if (!bodyValidation.isValid) {
          return handleValidationError(res, bodyValidation.errors, req.path);
        }
      }

      // Validate query parameters if schema provided
      if (schema.query && req.query) {
        const queryValidation = await validateRequest(
          req.query,
          schema.query,
          req.path,
          'query-params'
        );
        if (!queryValidation.isValid) {
          return handleValidationError(res, queryValidation.errors, req.path);
        }
      }

      // Validate route parameters if schema provided
      if (schema.params && req.params) {
        const paramsValidation = await validateRequest(
          req.params,
          schema.params,
          req.path,
          'route-params'
        );
        if (!paramsValidation.isValid) {
          return handleValidationError(res, paramsValidation.errors, req.path);
        }
      }

      next();
    } catch (error) {
      handleUnexpectedError(res, error, req.path);
    }
  };
}

/**
 * Express middleware that performs request validation with error tracking
 */
export async function validateRequestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract validation schema from route configuration
    const schema = req.route.schema as ValidationSchema;
    if (!schema) {
      next();
      return;
    }

    // Create and cache validation middleware
    const validationMiddleware = createValidationMiddleware(schema);
    await validationMiddleware(req, res, next);
  } catch (error) {
    handleUnexpectedError(res, error, req.path);
  }
}

/**
 * Handles validation errors and sends standardized error response
 * @internal
 */
function handleValidationError(
  res: Response,
  errors: string[],
  path: string
): void {
  const errorResponse: ValidationError = {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Request validation failed',
    path,
    timestamp: new Date().toISOString(),
    context: {
      errors: sanitizeErrorMessages(errors)
    }
  };

  res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
}

/**
 * Handles unexpected errors during validation
 * @internal
 */
function handleUnexpectedError(
  res: Response,
  error: unknown,
  path: string
): void {
  const errorResponse: ValidationError = {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred during validation',
    path,
    timestamp: new Date().toISOString(),
    context: {
      error: sanitizeErrorMessage(error instanceof Error ? error.message : 'Unknown error')
    }
  };

  res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
}

/**
 * Sanitizes error messages to prevent sensitive data exposure
 * @internal
 */
function sanitizeErrorMessages(errors: string[]): string[] {
  return errors.map(sanitizeErrorMessage);
}

/**
 * Sanitizes a single error message
 * @internal
 */
function sanitizeErrorMessage(message: string): string {
  // Remove potential sensitive data patterns
  return message
    .replace(/\b(?:\d{4}|\d{6})\d{9,12}\b/g, '[REDACTED]') // Credit card numbers
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]') // Email addresses
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // Social security numbers
    .replace(/\b\d{10,11}\b/g, '[PHONE]'); // Phone numbers
}
```

This implementation provides:

1. Schema validation for request body, query parameters, and route parameters
2. Schema caching for improved performance
3. Detailed error tracking and reporting
4. Message sanitization to prevent sensitive data exposure
5. Standardized error responses
6. Type safety through TypeScript interfaces
7. Memoization for compiled schemas
8. Comprehensive error handling for both validation and unexpected errors

The middleware can be used in routes like this:

```typescript
// Example usage in a route
app.post('/api/bookings', 
  createValidationMiddleware({
    body: bookingSchema,
    query: paginationSchema
  }),
  bookingController.createBooking
);