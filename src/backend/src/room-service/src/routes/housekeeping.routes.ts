/**
 * @fileoverview Defines Express router configuration for housekeeping-related endpoints
 * with comprehensive security controls, real-time updates, and validation.
 * @version 1.0.0
 */

// External imports - versions specified for production stability
import { Router } from 'express'; // v4.18.2
import { body, param, query } from 'express-validator'; // v7.0.1
import rateLimit from 'express-rate-limit'; // v6.7.0

// Internal imports
import { HousekeepingController } from '../controllers/housekeeping.controller';
import { authenticate, authorize } from '../../../api-gateway/middleware/auth.middleware';
import { HousekeepingStatus, HousekeepingType } from '../models/housekeeping.model';

// Initialize router
const router = Router();

// Rate limiting for bulk operations and webhooks
const bulkOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per window
  message: 'Too many bulk operations, please try again later'
});

// Validation middleware for task creation
const validateTaskCreation = [
  body('roomId').isUUID().withMessage('Valid room ID is required'),
  body('type').isIn(Object.values(HousekeepingType)).withMessage('Invalid housekeeping type'),
  body('priority').isInt({ min: 1, max: 5 }).withMessage('Priority must be between 1 and 5'),
  body('scheduledStartTime').isISO8601().withMessage('Valid scheduled start time is required'),
  body('tasks').isArray().withMessage('Tasks must be an array'),
  body('isInspectionRequired').isBoolean().optional()
];

// Validation middleware for status updates
const validateStatusUpdate = [
  param('id').isUUID().withMessage('Valid task ID is required'),
  body('status').isIn(Object.values(HousekeepingStatus)).withMessage('Invalid status'),
  body('inspectionDetails').optional().isObject().withMessage('Invalid inspection details format')
];

/**
 * POST /housekeeping
 * Creates a new housekeeping task
 * @security JWT + Role-based
 */
router.post(
  '/',
  authenticate,
  authorize(['hotel_manager', 'housekeeping']),
  validateTaskCreation,
  HousekeepingController.prototype.create
);

/**
 * POST /housekeeping/bulk
 * Bulk creates housekeeping tasks
 * @security JWT + Role-based + Rate Limited
 */
router.post(
  '/bulk',
  authenticate,
  authorize(['hotel_manager']),
  bulkOperationsLimiter,
  [
    body('tasks').isArray().withMessage('Tasks must be an array'),
    body('tasks.*.roomId').isUUID(),
    body('tasks.*.type').isIn(Object.values(HousekeepingType)),
    body('tasks.*.priority').isInt({ min: 1, max: 5 })
  ],
  HousekeepingController.prototype.createBulk
);

/**
 * GET /housekeeping
 * Retrieves all housekeeping tasks with filtering
 * @security JWT + Role-based
 */
router.get(
  '/',
  authenticate,
  authorize(['hotel_manager', 'housekeeping', 'front_desk']),
  [
    query('status').optional().isArray(),
    query('type').optional().isArray(),
    query('priority').optional().isArray(),
    query('dateRange').optional().isObject(),
    query('assignedStaffId').optional().isUUID(),
    query('isInspectionRequired').optional().isBoolean()
  ],
  HousekeepingController.prototype.findAll
);

/**
 * GET /housekeeping/room/:roomId
 * Retrieves housekeeping tasks for a specific room
 * @security JWT + Role-based
 */
router.get(
  '/room/:roomId',
  authenticate,
  authorize(['hotel_manager', 'housekeeping', 'front_desk']),
  [param('roomId').isUUID()],
  HousekeepingController.prototype.findByRoomId
);

/**
 * GET /housekeeping/:id
 * Retrieves a single housekeeping task
 * @security JWT + Role-based
 */
router.get(
  '/:id',
  authenticate,
  authorize(['hotel_manager', 'housekeeping', 'front_desk']),
  [param('id').isUUID()],
  HousekeepingController.prototype.findById
);

/**
 * PUT /housekeeping/:id
 * Updates a housekeeping task
 * @security JWT + Role-based
 */
router.put(
  '/:id',
  authenticate,
  authorize(['hotel_manager', 'housekeeping']),
  validateStatusUpdate,
  HousekeepingController.prototype.update
);

/**
 * PUT /housekeeping/:id/status
 * Updates only the status of a housekeeping task
 * @security JWT + Role-based
 */
router.put(
  '/:id/status',
  authenticate,
  authorize(['hotel_manager', 'housekeeping']),
  [
    param('id').isUUID(),
    body('status').isIn(Object.values(HousekeepingStatus))
  ],
  HousekeepingController.prototype.updateStatus
);

/**
 * DELETE /housekeeping/:id
 * Deletes a housekeeping task (soft delete)
 * @security JWT + Role-based
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['hotel_manager']),
  [param('id').isUUID()],
  HousekeepingController.prototype.delete
);

/**
 * GET /housekeeping/schedule
 * Retrieves optimized cleaning schedule
 * @security JWT + Role-based
 */
router.get(
  '/schedule',
  authenticate,
  authorize(['hotel_manager', 'housekeeping']),
  HousekeepingController.prototype.getSchedule
);

/**
 * POST /housekeeping/webhook
 * Handles real-time updates from external systems
 * @security JWT + System Role + Rate Limited
 */
router.post(
  '/webhook',
  authenticate,
  authorize(['system']),
  bulkOperationsLimiter,
  HousekeepingController.prototype.handleWebhook
);

export default router;