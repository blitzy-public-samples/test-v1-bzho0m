/**
 * @fileoverview Defines comprehensive booking routes with enhanced security, validation,
 * and monitoring features for the hotel reservation system.
 * @version 1.0.0
 */

// External imports
import { Router } from 'express'; // v4.18.0
import { auth } from 'express-oauth2-jwt-bearer'; // v1.5.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { celebrate, Joi, Segments } from 'celebrate'; // v15.0.1
import { MetricsCollector } from '@opentelemetry/metrics'; // v1.12.0

// Internal imports
import { BookingController } from '../controllers/booking.controller';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { RequestWithUser } from '../../../shared/interfaces/base-controller.interface';

// Initialize authentication middleware
const authMiddleware = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER,
  tokenSigningAlg: 'RS256'
});

// Rate limiting configuration
const bookingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: ErrorCode.RATE_LIMIT_EXCEEDED }
});

// Validation schemas
const bookingValidation = {
  create: celebrate({
    [Segments.BODY]: Joi.object({
      guestId: Joi.string().uuid().required(),
      roomId: Joi.string().uuid().required(),
      rateId: Joi.string().uuid().required(),
      checkInDate: Joi.date().iso().greater('now').required(),
      checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required(),
      numberOfGuests: Joi.number().integer().min(1).required(),
      bookingSource: Joi.string().required(),
      specialRequests: Joi.object({
        dietary: Joi.array().items(Joi.string()),
        accessibility: Joi.array().items(Joi.string()),
        roomPreferences: Joi.array().items(Joi.string()),
        additionalServices: Joi.array().items(Joi.string()),
        notes: Joi.string()
      })
    })
  }),
  update: celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.string().uuid().required()
    }),
    [Segments.BODY]: Joi.object({
      checkInDate: Joi.date().iso().greater('now'),
      checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')),
      numberOfGuests: Joi.number().integer().min(1),
      specialRequests: Joi.object({
        dietary: Joi.array().items(Joi.string()),
        accessibility: Joi.array().items(Joi.string()),
        roomPreferences: Joi.array().items(Joi.string()),
        additionalServices: Joi.array().items(Joi.string()),
        notes: Joi.string()
      })
    }).min(1)
  })
};

/**
 * Initializes booking routes with comprehensive security and validation
 * @param bookingController - Instance of BookingController
 * @returns Configured Express router
 */
export function initializeBookingRoutes(bookingController: BookingController): Router {
  const router = Router();

  // Apply global middleware
  router.use(authMiddleware);
  router.use(bookingRateLimiter);

  // Create new booking
  router.post('/',
    bookingValidation.create,
    async (req: RequestWithUser, res, next) => {
      try {
        const booking = await bookingController.create({
          ...req.body,
          lastModifiedBy: req.user?.id
        });
        res.status(201).json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Create batch bookings
  router.post('/batch',
    celebrate({
      [Segments.BODY]: Joi.object({
        bookings: Joi.array().items(bookingValidation.create.schema).min(1).max(10)
      })
    }),
    async (req: RequestWithUser, res, next) => {
      try {
        const bookings = await bookingController.createBatch({
          bookings: req.body.bookings,
          lastModifiedBy: req.user?.id
        });
        res.status(201).json(bookings);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get all bookings with filtering
  router.get('/',
    celebrate({
      [Segments.QUERY]: Joi.object({
        status: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().greater(Joi.ref('startDate')),
        page: Joi.number().integer().min(1),
        limit: Joi.number().integer().min(1).max(100)
      })
    }),
    async (req, res, next) => {
      try {
        const bookings = await bookingController.findAll(req.query);
        res.json(bookings);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get booking by ID
  router.get('/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    async (req, res, next) => {
      try {
        const booking = await bookingController.findById(req.params.id);
        res.json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update booking
  router.put('/:id',
    bookingValidation.update,
    async (req: RequestWithUser, res, next) => {
      try {
        const booking = await bookingController.update(req.params.id, {
          ...req.body,
          lastModifiedBy: req.user?.id
        });
        res.json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Cancel booking
  router.put('/:id/cancel',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      }),
      [Segments.BODY]: Joi.object({
        reason: Joi.string().required()
      })
    }),
    async (req: RequestWithUser, res, next) => {
      try {
        const booking = await bookingController.cancel(req.params.id, {
          reason: req.body.reason,
          userId: req.user?.id
        });
        res.json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Process check-in
  router.put('/:id/check-in',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    async (req: RequestWithUser, res, next) => {
      try {
        const booking = await bookingController.checkIn(req.params.id, {
          userId: req.user?.id
        });
        res.json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Process check-out
  router.put('/:id/check-out',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    async (req: RequestWithUser, res, next) => {
      try {
        const booking = await bookingController.checkOut(req.params.id, {
          userId: req.user?.id
        });
        res.json(booking);
      } catch (error) {
        next(error);
      }
    }
  );

  // Check room availability
  router.get('/availability',
    celebrate({
      [Segments.QUERY]: Joi.object({
        roomIds: Joi.array().items(Joi.string().uuid()).required(),
        checkInDate: Joi.date().iso().greater('now').required(),
        checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required()
      })
    }),
    async (req, res, next) => {
      try {
        const isAvailable = await bookingController.checkAvailability(
          req.query.roomIds,
          new Date(req.query.checkInDate as string),
          new Date(req.query.checkOutDate as string)
        );
        res.json({ available: isAvailable });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// Export configured router
export const bookingRouter = initializeBookingRoutes(new BookingController());