/**
 * @fileoverview Guest routes configuration implementing secure REST API endpoints
 * with enhanced validation, GDPR compliance, and comprehensive audit logging.
 * @version 1.0.0
 */

// External imports
import { Router } from 'express'; // v4.18.0
import { celebrate, Joi, Segments } from 'celebrate'; // v15.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5

// Internal imports
import { GuestController } from '../controllers/guest.controller';
import { validateRequest } from '../../../shared/utils/validation.util';
import { authMiddleware, roleGuard } from '@middleware/auth'; // v1.0.0
import { auditLogger } from '@middleware/audit-logger'; // v1.0.0
import { ErrorCode } from '../../../shared/constants/error-codes';
import { UUID } from '../../../shared/interfaces/base-model.interface';

/**
 * Rate limiting configuration for guest endpoints
 */
const guestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * CORS configuration for guest endpoints
 */
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Validation schemas for guest endpoints
 */
const guestValidation = {
  create: celebrate({
    [Segments.BODY]: Joi.object({
      firstName: Joi.string().required().min(2).max(50),
      lastName: Joi.string().required().min(2).max(50),
      email: Joi.string().required().email(),
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
      documentNumber: Joi.string().required(),
      gdprConsent: Joi.boolean().required().valid(true),
      preferences: Joi.object({
        roomType: Joi.string(),
        dietaryRestrictions: Joi.array().items(Joi.string()),
        specialRequests: Joi.string()
      })
    })
  }),
  update: celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.string().uuid().required()
    }),
    [Segments.BODY]: Joi.object({
      firstName: Joi.string().min(2).max(50),
      lastName: Joi.string().min(2).max(50),
      email: Joi.string().email(),
      phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/),
      documentNumber: Joi.string(),
      preferences: Joi.object({
        roomType: Joi.string(),
        dietaryRestrictions: Joi.array().items(Joi.string()),
        specialRequests: Joi.string()
      })
    })
  }),
  preferences: celebrate({
    [Segments.PARAMS]: Joi.object({
      id: Joi.string().uuid().required()
    }),
    [Segments.BODY]: Joi.object({
      roomType: Joi.string(),
      dietaryRestrictions: Joi.array().items(Joi.string()),
      specialRequests: Joi.string()
    })
  })
};

/**
 * Configures and returns the router with all guest management routes
 */
export function configureGuestRoutes(guestController: GuestController): Router {
  const router = Router();

  // Apply global middleware
  router.use(helmet());
  router.use(cors(corsOptions));
  router.use(guestRateLimiter);

  // Create new guest profile
  router.post('/',
    authMiddleware,
    roleGuard(['admin', 'frontDesk']),
    guestValidation.create,
    auditLogger('CREATE_GUEST'),
    async (req, res, next) => {
      try {
        const validation = await validateRequest(
          req.body,
          guestValidation.create.schema,
          '/guests',
          'create-guest'
        );

        if (!validation.isValid) {
          return res.status(400).json({
            code: ErrorCode.VALIDATION_ERROR,
            errors: validation.errors
          });
        }

        const guest = await guestController.create(req.body).toPromise();
        res.status(201).json(guest);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get all guests with filtering
  router.get('/',
    authMiddleware,
    roleGuard(['admin', 'frontDesk', 'housekeeping']),
    auditLogger('LIST_GUESTS'),
    async (req, res, next) => {
      try {
        const guests = await guestController.findAll(req.query).toPromise();
        res.status(200).json(guests);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get guest by ID
  router.get('/:id',
    authMiddleware,
    roleGuard(['admin', 'frontDesk']),
    auditLogger('GET_GUEST'),
    async (req, res, next) => {
      try {
        const guest = await guestController.findById(req.params.id as UUID).toPromise();
        res.status(200).json(guest);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update guest profile
  router.put('/:id',
    authMiddleware,
    roleGuard(['admin', 'frontDesk']),
    guestValidation.update,
    auditLogger('UPDATE_GUEST'),
    async (req, res, next) => {
      try {
        const validation = await validateRequest(
          req.body,
          guestValidation.update.schema,
          `/guests/${req.params.id}`,
          'update-guest'
        );

        if (!validation.isValid) {
          return res.status(400).json({
            code: ErrorCode.VALIDATION_ERROR,
            errors: validation.errors
          });
        }

        const guest = await guestController.update(req.params.id as UUID, req.body).toPromise();
        res.status(200).json(guest);
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete guest profile
  router.delete('/:id',
    authMiddleware,
    roleGuard(['admin']),
    auditLogger('DELETE_GUEST'),
    async (req, res, next) => {
      try {
        await guestController.delete(req.params.id as UUID).toPromise();
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Update guest preferences
  router.put('/:id/preferences',
    authMiddleware,
    roleGuard(['admin', 'frontDesk']),
    guestValidation.preferences,
    auditLogger('UPDATE_PREFERENCES'),
    async (req, res, next) => {
      try {
        const validation = await validateRequest(
          req.body,
          guestValidation.preferences.schema,
          `/guests/${req.params.id}/preferences`,
          'update-preferences'
        );

        if (!validation.isValid) {
          return res.status(400).json({
            code: ErrorCode.VALIDATION_ERROR,
            errors: validation.errors
          });
        }

        const preferences = await guestController.updatePreferences(req.params.id as UUID, req.body).toPromise();
        res.status(200).json(preferences);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

// Export configured router
export const guestRouter = configureGuestRoutes(new GuestController());