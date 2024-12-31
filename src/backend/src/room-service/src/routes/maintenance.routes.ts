/**
 * @fileoverview Defines secure and validated API routes for maintenance request operations
 * with comprehensive role-based access control, rate limiting, and real-time updates.
 * @version 1.0.0
 */

// External imports - with versions
import { Router } from 'express'; // v4.18.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import cache from 'express-cache-middleware'; // v1.0.0

// Internal imports
import { MaintenanceController } from '../controllers/maintenance.controller';
import { authMiddleware, validateRequest, roleCheck } from '@shared/middleware';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { MaintenanceStatus, MaintenancePriority } from '../models/maintenance.model';

/**
 * Rate limiter configuration for maintenance endpoints
 * Prevents abuse and ensures system stability
 */
const maintenanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many maintenance requests, please try again later'
  }
});

/**
 * Cache configuration for read operations
 * Improves performance for frequently accessed data
 */
const cacheConfig = {
  duration: 5 * 60, // 5 minutes cache duration
  getKey: (req: any) => `maintenance:${req.method}:${req.originalUrl}`
};

/**
 * Configures and returns Express router with secured maintenance request endpoints
 * Implements role-based access control and request validation
 * 
 * @returns {Router} Configured Express router with maintenance routes
 */
const setupMaintenanceRoutes = (): Router => {
  const router = Router();
  const maintenanceController = new MaintenanceController();

  // Apply global middleware
  router.use(maintenanceLimiter);
  router.use(authMiddleware);

  /**
   * POST /maintenance
   * Creates new maintenance request with validation
   * Requires maintenance_create role
   */
  router.post('/',
    validateRequest('maintenance.create'),
    roleCheck('maintenance_create'),
    async (req, res, next) => {
      try {
        const result = await maintenanceController.create(req, res);
        res.status(201).json({
          success: true,
          data: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /maintenance
   * Retrieves all maintenance requests with filtering
   * Implements caching for performance
   */
  router.get('/',
    roleCheck('maintenance_view'),
    cache(cacheConfig),
    async (req, res, next) => {
      try {
        const filters = {
          status: req.query.status?.split(',') as MaintenanceStatus[],
          priority: req.query.priority?.split(',') as MaintenancePriority[],
          roomId: req.query.roomId as string,
          dateRange: req.query.dateRange ? JSON.parse(req.query.dateRange as string) : undefined
        };

        const result = await maintenanceController.findAll(req, res);
        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /maintenance/:id
   * Retrieves specific maintenance request by ID
   * Implements request validation and caching
   */
  router.get('/:id',
    validateRequest('maintenance.getById'),
    roleCheck('maintenance_view'),
    cache(cacheConfig),
    async (req, res, next) => {
      try {
        const result = await maintenanceController.findById(req, res);
        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /maintenance/:id
   * Updates existing maintenance request
   * Requires maintenance_update role
   */
  router.put('/:id',
    validateRequest('maintenance.update'),
    roleCheck('maintenance_update'),
    async (req, res, next) => {
      try {
        const result = await maintenanceController.update(req, res);
        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /maintenance/:id
   * Soft deletes maintenance request
   * Requires admin role for deletion
   */
  router.delete('/:id',
    validateRequest('maintenance.delete'),
    roleCheck('admin'),
    async (req, res, next) => {
      try {
        await maintenanceController.delete(req, res);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

// Export configured router
export const maintenanceRouter = setupMaintenanceRoutes();