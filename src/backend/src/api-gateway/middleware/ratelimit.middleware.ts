/**
 * @fileoverview Distributed rate limiting middleware for API Gateway using Redis
 * Implements sliding window algorithm for precise rate limiting across multiple gateway instances
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import Redis from 'ioredis'; // v5.3.0
import * as promClient from 'prom-client'; // v14.2.0
import * as winston from 'winston'; // v3.8.2
import { ErrorCode } from '../../shared/constants/error-codes';
import { DEFAULT_RATE_LIMIT } from '../config/kong.config';

// Constants for rate limiting
const REDIS_KEY_PREFIX = 'rl:';
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MESSAGE = 'Too many requests, please try again later';

// Standard rate limit headers
const HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset'
};

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// Initialize Prometheus metrics
const rateLimitCounter = new promClient.Counter({
  name: 'api_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['status']
});

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'rate-limit.log' })
  ]
});

/**
 * Configuration interface for rate limiting middleware
 */
interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  skipFailedRequests?: boolean;
}

/**
 * Generates a unique key for rate limiting based on client identifier
 * @param req Express request object
 * @param prefix Key prefix for rate limit type
 * @returns Unique client identifier
 */
function generateClientKey(req: Request, prefix: string): string {
  const apiKey = req.headers['x-api-key'] as string;
  const clientId = apiKey || req.ip;
  return `${prefix}${clientId}`;
}

/**
 * Creates rate limiting middleware with Redis-based distributed rate limiting
 * @param config Rate limiting configuration options
 * @returns Express middleware function
 */
export function rateLimitMiddleware(config: RateLimitConfig = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_RATE_LIMIT || DEFAULT_MAX_REQUESTS,
    message = DEFAULT_MESSAGE,
    keyPrefix = REDIS_KEY_PREFIX,
    keyGenerator = (req: Request) => generateClientKey(req, keyPrefix),
    handler = null,
    skipFailedRequests = false
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Implement sliding window algorithm using Redis
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now.toString(), now.toString());
      multi.pexpire(key, windowMs);

      const [, current] = await multi.exec() as [any, [null, number]];
      const requestCount = current[1];

      // Set rate limit headers
      res.setHeader(HEADERS.LIMIT, max);
      res.setHeader(HEADERS.REMAINING, Math.max(0, max - requestCount));
      res.setHeader(HEADERS.RESET, Math.ceil((now + windowMs) / 1000));

      // Check if rate limit exceeded
      if (requestCount >= max) {
        rateLimitCounter.inc({ status: 'exceeded' });
        logger.warn({
          message: 'Rate limit exceeded',
          key,
          requestCount,
          limit: max
        });

        if (handler) {
          return handler(req, res);
        }

        return res.status(429).json({
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Update metrics for successful requests
      rateLimitCounter.inc({ status: 'allowed' });

      // Handle response completion
      res.on('finish', () => {
        if (skipFailedRequests && res.statusCode >= 400) {
          redis.zrem(key, now.toString()).catch(err => {
            logger.error('Error removing failed request from rate limit', err);
          });
        }
      });

      next();
    } catch (error) {
      logger.error('Rate limiting error', error);
      // Fail open - allow request through on Redis errors
      next();
    }
  };
}

// Error handler for Redis connection
redis.on('error', (error) => {
  logger.error('Redis connection error', error);
});

export default rateLimitMiddleware;