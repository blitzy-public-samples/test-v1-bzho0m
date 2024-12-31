/**
 * @fileoverview Defines comprehensive API routes for sophisticated room rate management
 * including dynamic pricing, rate parity enforcement, channel synchronization, and audit logging.
 * @version 1.0.0
 */

// External imports
import { Router } from 'express'; // v4.18.0
import { celebrate, Joi, Segments } from 'celebrate'; // v15.0.0
import { rateCache } from 'redis'; // v4.6.0

// Internal imports
import { RateController } from '../controllers/rate.controller';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { DateFormat } from '../../../shared/utils/date.util';

/**
 * Configures and returns the router with all rate-related routes
 * @param controller - Instance of RateController
 * @returns Configured Express router
 */
export function setupRateRoutes(controller: RateController): Router {
  const router = Router();

  /**
   * POST /rates - Create new rate
   * Creates a new room rate with validation
   */
  router.post('/',
    celebrate({
      [Segments.BODY]: Joi.object({
        roomTypeId: Joi.string().uuid().required(),
        rateCode: Joi.string().required(),
        rateName: Joi.string().required(),
        baseRate: Joi.number().positive().required(),
        taxRate: Joi.number().min(0).max(1).required(),
        effectiveFrom: Joi.date().iso().required(),
        effectiveTo: Joi.date().iso().greater(Joi.ref('effectiveFrom')).required(),
        type: Joi.string().valid(...Object.values(RateType)).required(),
        status: Joi.string().valid(...Object.values(RateStatus)).required(),
        seasonalModifiers: Joi.array().items(
          Joi.object({
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
            adjustmentType: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
            adjustmentValue: Joi.number().required(),
            description: Joi.string()
          })
        ),
        occupancyModifiers: Joi.array().items(
          Joi.object({
            occupancyThreshold: Joi.number().min(0).max(100).required(),
            adjustmentType: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
            adjustmentValue: Joi.number().required()
          })
        ),
        channelRules: Joi.object().pattern(
          Joi.string(),
          Joi.object({
            markup: Joi.number().min(0).required(),
            minimumMarkup: Joi.number().min(0).required(),
            rateParity: Joi.boolean().required(),
            restrictions: Joi.object({
              minimumLOS: Joi.number().integer().min(1),
              maximumLOS: Joi.number().integer().min(Joi.ref('minimumLOS')),
              closedToArrival: Joi.boolean(),
              closedToDeparture: Joi.boolean()
            })
          })
        )
      })
    }),
    controller.create
  );

  /**
   * GET /rates/calculate - Calculate dynamic rate
   * Calculates room rate with all applicable modifiers
   */
  router.get('/calculate',
    celebrate({
      [Segments.QUERY]: Joi.object({
        roomTypeId: Joi.string().uuid().required(),
        checkInDate: Joi.date().iso().required(),
        checkOutDate: Joi.date().iso().greater(Joi.ref('checkInDate')).required(),
        channelId: Joi.string().required(),
        occupancyData: Joi.object({
          currentOccupancy: Joi.number().min(0).max(100),
          forecastedOccupancy: Joi.number().min(0).max(100)
        })
      })
    }),
    controller.calculateDynamicRate
  );

  /**
   * GET /rates - Get all rates
   * Retrieves all rates with optional filtering
   */
  router.get('/',
    celebrate({
      [Segments.QUERY]: Joi.object({
        roomTypeId: Joi.string().uuid(),
        type: Joi.string().valid(...Object.values(RateType)),
        status: Joi.string().valid(...Object.values(RateStatus)),
        effectiveDate: Joi.date().iso(),
        channel: Joi.string()
      })
    }),
    controller.findAll
  );

  /**
   * GET /rates/:id - Get rate by ID
   * Retrieves specific rate details
   */
  router.get('/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    controller.findById
  );

  /**
   * PUT /rates/:id - Update rate
   * Updates existing rate with validation
   */
  router.put('/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      }),
      [Segments.BODY]: Joi.object({
        baseRate: Joi.number().positive(),
        status: Joi.string().valid(...Object.values(RateStatus)),
        seasonalModifiers: Joi.array().items(
          Joi.object({
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
            adjustmentType: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
            adjustmentValue: Joi.number().required(),
            description: Joi.string()
          })
        ),
        channelRules: Joi.object()
      })
    }),
    controller.update
  );

  /**
   * POST /rates/sync - Synchronize channel rates
   * Synchronizes rates across all distribution channels
   */
  router.post('/sync',
    celebrate({
      [Segments.BODY]: Joi.object({
        rateIds: Joi.array().items(Joi.string().uuid()).required()
      })
    }),
    controller.syncChannelRates
  );

  /**
   * GET /rates/validate-parity/:id - Validate rate parity
   * Checks rate parity across channels for given rate
   */
  router.get('/validate-parity/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    controller.validateRateParity
  );

  /**
   * GET /rates/history/:id - Get rate history
   * Retrieves rate change history with audit trail
   */
  router.get('/history/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      }),
      [Segments.QUERY]: Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().greater(Joi.ref('startDate')),
        limit: Joi.number().integer().min(1).max(100).default(50)
      })
    }),
    controller.getRateHistory
  );

  /**
   * DELETE /rates/:id - Delete rate
   * Soft deletes a rate configuration
   */
  router.delete('/:id',
    celebrate({
      [Segments.PARAMS]: Joi.object({
        id: Joi.string().uuid().required()
      })
    }),
    controller.delete
  );

  return router;
}

// Export configured router
export const rateRouter = setupRateRoutes(new RateController());