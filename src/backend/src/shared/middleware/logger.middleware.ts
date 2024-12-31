import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HttpStatusCode } from '../constants/status-codes';

/**
 * Log levels configuration with numeric priorities
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Interface for structured log metadata
 */
interface LogMetadata {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  correlationId: string;
  serviceId: string;
  environment: string;
}

/**
 * Configuration for log rotation
 */
const ROTATION_CONFIG = {
  frequency: 'daily',
  maxSize: '20m',
  maxFiles: '14d',
  compress: true
};

/**
 * Creates and configures the Winston logger instance with multiple transports
 * @version 1.0.0
 */
const createLogger = () => {
  // Custom log format with timestamp and structured metadata
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp']
    })
  );

  // Configure console transport for development
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  });

  // Configure file transport with rotation
  const fileTransport = new DailyRotateFile({
    filename: 'logs/hotel-erp-%DATE%.log',
    ...ROTATION_CONFIG,
    format: logFormat
  });

  // Configure Elasticsearch transport
  const elasticsearchTransport = new ElasticsearchTransport({
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      }
    },
    indexPrefix: 'hotel-erp-logs',
    buffering: true,
    bufferLimit: 100,
    retryLimit: 3
  });

  // Create and configure logger
  return winston.createLogger({
    levels: LOG_LEVELS,
    format: logFormat,
    transports: [
      consoleTransport,
      fileTransport,
      elasticsearchTransport
    ],
    exitOnError: false
  });
};

// Create singleton logger instance
export const logger = createLogger();

/**
 * Express middleware for HTTP request logging with performance tracking
 * @param req Express Request object
 * @param res Express Response object
 * @param next Express NextFunction
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  const correlationId = req.headers['x-correlation-id'] as string || requestId;
  const startTime = process.hrtime();

  // Attach logger to request for use in routes
  req['logger'] = logger;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    correlationId,
    method: req.method,
    url: req.url,
    headers: sanitizeHeaders(req.headers),
    query: req.query,
    body: sanitizeBody(req.body),
    serviceId: process.env.SERVICE_ID || 'hotel-erp',
    environment: process.env.NODE_ENV || 'development'
  });

  // Intercept response to log completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, callback?: any): any {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;

    const logMetadata: LogMetadata = {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
      correlationId,
      serviceId: process.env.SERVICE_ID || 'hotel-erp',
      environment: process.env.NODE_ENV || 'development'
    };

    if (res.statusCode >= HttpStatusCode.INTERNAL_SERVER_ERROR) {
      logger.error('Request failed', logMetadata);
    } else if (res.statusCode >= HttpStatusCode.BAD_REQUEST) {
      logger.warn('Request completed with client error', logMetadata);
    } else {
      logger.info('Request completed successfully', logMetadata);
    }

    originalEnd.call(res, chunk, encoding, callback);
  };

  // Error handling
  res.on('error', (error: Error) => {
    logger.error('Response error', {
      requestId,
      correlationId,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  });

  next();
};

/**
 * Sanitizes request headers for logging by removing sensitive information
 */
const sanitizeHeaders = (headers: any): any => {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Sanitizes request body for logging by removing sensitive information
 */
const sanitizeBody = (body: any): any => {
  if (!body) return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'creditCard', 'ssn', 'token'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};
```

This implementation provides:

1. Structured logging with Winston using multiple transports (console, file, Elasticsearch)
2. Request/response logging with performance tracking
3. Log rotation and compression
4. ELK Stack integration for centralized logging
5. Correlation IDs for distributed tracing
6. Sanitization of sensitive data
7. Environment-specific log levels
8. Error tracking with detailed context
9. Performance metrics collection
10. Request ID generation for log correlation

The middleware can be used in Express applications by adding it to the middleware chain:

```typescript
app.use(requestLogger);