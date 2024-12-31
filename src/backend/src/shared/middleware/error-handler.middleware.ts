/**
 * @fileoverview Express middleware for centralized error handling across all microservices.
 * Provides standardized error responses, logging, and error transformation with environment-specific
 * behavior and security considerations.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorCode, ErrorMessage } from '../constants/error-codes';
import { HttpStatusCode } from '../constants/status-codes';
import { logger } from './logger.middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extended Error interface with additional properties for error handling
 */
interface CustomError extends Error {
  statusCode?: number;
  code?: ErrorCode;
  details?: Record<string, unknown>;
  correlationId?: string;
  timestamp?: Date;
}

/**
 * Standardized error response structure
 */
interface ErrorResponse {
  code: ErrorCode;
  message: string;
  correlationId: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Maps error types to appropriate error codes
 * @param error - The error to be mapped
 * @returns Mapped ErrorCode
 */
const mapErrorToCode = (error: CustomError): ErrorCode => {
  if (error.code && Object.values(ErrorCode).includes(error.code)) {
    return error.code;
  }

  if (error.name === 'ValidationError') {
    return ErrorCode.VALIDATION_ERROR;
  }

  if (error.name === 'MongoError' || error.name === 'SequelizeError') {
    return ErrorCode.DATABASE_ERROR;
  }

  if (error.name === 'AxiosError' || error.name === 'FetchError') {
    return ErrorCode.EXTERNAL_SERVICE_ERROR;
  }

  return ErrorCode.INTERNAL_SERVER_ERROR;
};

/**
 * Maps error codes to HTTP status codes
 * @param code - ErrorCode to map
 * @returns Corresponding HTTP status code
 */
const mapErrorToStatusCode = (code: ErrorCode): number => {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return HttpStatusCode.BAD_REQUEST;
    case ErrorCode.DATABASE_ERROR:
      return HttpStatusCode.INTERNAL_SERVER_ERROR;
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
      return HttpStatusCode.SERVICE_UNAVAILABLE;
    default:
      return HttpStatusCode.INTERNAL_SERVER_ERROR;
  }
};

/**
 * Sanitizes error details based on environment
 * @param details - Error details to sanitize
 * @returns Sanitized error details
 */
const sanitizeErrorDetails = (details: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveFields = ['password', 'token', 'apiKey', 'creditCard'];
  const sanitized = { ...details };

  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

/**
 * Express error handling middleware
 * @param error - Error object
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction
 */
export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = error.correlationId || req.headers['x-correlation-id'] as string || uuidv4();

  // Map error to appropriate error code and status code
  const errorCode = mapErrorToCode(error);
  const statusCode = error.statusCode || mapErrorToStatusCode(errorCode);

  // Create base error response
  const errorResponse: ErrorResponse = {
    code: errorCode,
    message: ErrorMessage[errorCode] || error.message,
    correlationId,
    timestamp: new Date().toISOString(),
    path: req.path,
    details: error.details ? sanitizeErrorDetails(error.details) : undefined
  };

  // Add stack trace in development environment
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Log error with correlation ID
  logger.error('Request error', {
    error: {
      ...errorResponse,
      originalError: error,
      stack: error.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    },
    correlationId
  });

  // Track error metrics if monitoring is enabled
  if (process.env.ENABLE_MONITORING === 'true') {
    // Increment error counter metric
    const errorMetrics = {
      errorCode,
      statusCode,
      path: req.path,
      method: req.method
    };
    // This would be implemented by your metrics collection system
    // trackErrorMetrics(errorMetrics);
  }

  // Send error response
  res
    .status(statusCode)
    .header('X-Correlation-ID', correlationId)
    .json(errorResponse);
};

/**
 * Error handler wrapper for async route handlers
 * @param fn - Async route handler function
 * @returns Express middleware function
 */
export const asyncErrorHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
```

This implementation provides:

1. Standardized error handling across all microservices
2. Environment-specific behavior (development vs. production)
3. Security considerations through error sanitization
4. Integration with logging system
5. Correlation IDs for distributed tracing
6. Error type mapping and HTTP status code mapping
7. Detailed error tracking in development
8. Sanitization of sensitive information
9. Metrics tracking support
10. Async error handling support

The middleware can be used in Express applications by adding it after all route handlers:

```typescript
app.use(errorHandler);
```

For async route handlers, use the asyncErrorHandler wrapper:

```typescript
app.get('/route', asyncErrorHandler(async (req, res) => {
  // Async route logic
}));