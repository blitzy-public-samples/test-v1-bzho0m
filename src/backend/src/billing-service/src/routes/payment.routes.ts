/**
 * @fileoverview Payment routes implementing PCI DSS compliant payment processing
 * with comprehensive security measures and validation.
 * @version 1.0.0
 */

// External imports
import express, { Router } from 'express'; // v4.18.0
import Joi from 'joi'; // v17.9.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1

// Internal imports
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../../../api-gateway/middleware/auth.middleware';
import { createValidationMiddleware } from '../../../api-gateway/middleware/validation.middleware';
import { PaymentMethod, PaymentStatus } from '../models/payment.model';

/**
 * Allowed roles for payment operations
 */
const ALLOWED_ROLES = ['super_admin', 'hotel_manager', 'front_desk'] as const;

/**
 * Rate limiting configuration for payment endpoints
 */
const RATE_LIMIT_CONFIG = {
  points: 100, // Number of requests
  duration: 900, // Per 15 minutes
  blockDuration: 1800 // 30 minute block if exceeded
};

/**
 * Payment request validation schema
 */
const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).required(),
  paymentMethod: Joi.string().valid(...Object.values(PaymentMethod)).required(),
  cardToken: Joi.string().when('paymentMethod', {
    is: PaymentMethod.CREDIT_CARD,
    then: Joi.required()
  }),
  folioId: Joi.string().uuid().required(),
  metadata: Joi.object().optional()
});

/**
 * Query parameters validation schema
 */
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid(...Object.values(PaymentStatus)).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
});

/**
 * Route parameters validation schema
 */
const paramsSchema = Joi.object({
  id: Joi.string().uuid().required()
});

/**
 * Refund request validation schema
 */
const refundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().max(500).required()
});

/**
 * Creates payment routes with comprehensive security measures
 * @param controller - Payment controller instance
 * @returns Configured Express router
 */
export default function createPaymentRoutes(controller: PaymentController): Router {
  const router = express.Router();

  // Initialize rate limiter
  const rateLimiter = new RateLimiterMemory(RATE_LIMIT_CONFIG);

  // Rate limiting middleware
  const rateLimitMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      res.status(429).json({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many payment requests, please try again later'
      });
    }
  };

  // Apply rate limiting to all payment routes
  router.use(rateLimitMiddleware);

  // Apply authentication to all routes
  router.use(authenticate);

  /**
   * Process new payment
   * @security Bearer token required
   * @rbac front_desk, hotel_manager, super_admin
   */
  router.post('/payments',
    authorize(ALLOWED_ROLES),
    createValidationMiddleware({ body: paymentSchema }),
    controller.create
  );

  /**
   * Retrieve payment history with filtering
   * @security Bearer token required
   * @rbac front_desk, hotel_manager, super_admin
   */
  router.get('/payments',
    authorize(ALLOWED_ROLES),
    createValidationMiddleware({ query: querySchema }),
    controller.findAll
  );

  /**
   * Get payment details by ID
   * @security Bearer token required
   * @rbac front_desk, hotel_manager, super_admin
   */
  router.get('/payments/:id',
    authorize(ALLOWED_ROLES),
    createValidationMiddleware({ params: paramsSchema }),
    controller.findById
  );

  /**
   * Process payment refund
   * @security Bearer token required
   * @rbac hotel_manager, super_admin
   */
  router.post('/payments/:id/refund',
    authorize(['super_admin', 'hotel_manager']),
    createValidationMiddleware({
      params: paramsSchema,
      body: refundSchema
    }),
    controller.refund
  );

  return router;
}