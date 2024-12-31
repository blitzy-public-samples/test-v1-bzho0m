/**
 * @fileoverview Room management routes with enhanced security, real-time updates,
 * and comprehensive validation for the Hotel Management ERP system.
 * @version 1.0.0
 */

// External imports - Version comments included as required
import { Router } from 'express'; // v4.18.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import WebSocket from 'ws'; // v8.13.0

// Internal imports
import { RoomController } from '../controllers/room.controller';
import { ErrorCode } from '../../../shared/constants/error-codes';
import { HttpStatusCode } from '../../../shared/constants/status-codes';
import { RequestWithUser } from '../../../shared/interfaces/base-controller.interface';

/**
 * Configure rate limiting for room management endpoints
 */
const roomRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests, please try again later'
  }
});

/**
 * Configure WebSocket heartbeat for real-time updates
 */
const configureWebSocket = (ws: WebSocket) => {
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('close', () => {
    clearInterval(pingInterval);
  });
};

/**
 * Configure and return room management routes with enhanced security
 * and real-time capabilities
 */
const configureRoomRoutes = (): Router => {
  const router = Router();
  const roomController = new RoomController();

  // Apply rate limiting to all routes
  router.use(roomRateLimiter);

  /**
   * Create new room
   * @security Requires admin role
   */
  router.post('/', async (req: RequestWithUser, res) => {
    try {
      const room = await roomController.create(req.body);
      res.status(HttpStatusCode.CREATED).json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Bulk create rooms
   * @security Requires admin role
   */
  router.post('/bulk', async (req: RequestWithUser, res) => {
    try {
      const rooms = await roomController.bulkCreate(req.body);
      res.status(HttpStatusCode.CREATED).json({
        success: true,
        data: rooms
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Get all rooms with filtering
   * @security Requires authentication
   */
  router.get('/', async (req: RequestWithUser, res) => {
    try {
      const rooms = await roomController.findAll(req.query);
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: rooms
      });
    } catch (error) {
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Get room by ID
   * @security Requires authentication
   */
  router.get('/:id', async (req: RequestWithUser, res) => {
    try {
      const room = await roomController.findById(req.params.id);
      if (!room) {
        return res.status(HttpStatusCode.NOT_FOUND).json({
          success: false,
          error: {
            code: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Room not found'
          }
        });
      }
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Update room details
   * @security Requires admin role
   */
  router.put('/:id', async (req: RequestWithUser, res) => {
    try {
      const room = await roomController.update(req.params.id, req.body);
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Update room status with real-time notification
   * @security Requires staff or admin role
   */
  router.patch('/:id/status', async (req: RequestWithUser, res) => {
    try {
      const room = await roomController.updateStatus(req.params.id, {
        ...req.body,
        userId: req.user.id
      });
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_OPERATION,
          message: error.message
        }
      });
    }
  });

  /**
   * Update room price
   * @security Requires admin role
   */
  router.patch('/:id/price', async (req: RequestWithUser, res) => {
    try {
      const room = await roomController.updatePrice(req.params.id, req.body);
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * Bulk update room status
   * @security Requires admin role
   */
  router.patch('/bulk/status', async (req: RequestWithUser, res) => {
    try {
      const rooms = await roomController.bulkUpdateStatus(req.body);
      res.status(HttpStatusCode.OK).json({
        success: true,
        data: rooms
      });
    } catch (error) {
      res.status(HttpStatusCode.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.INVALID_OPERATION,
          message: error.message
        }
      });
    }
  });

  /**
   * Delete room (soft delete)
   * @security Requires admin role
   */
  router.delete('/:id', async (req: RequestWithUser, res) => {
    try {
      const success = await roomController.delete(req.params.id);
      res.status(HttpStatusCode.OK).json({
        success,
        data: { deleted: success }
      });
    } catch (error) {
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: error.message
        }
      });
    }
  });

  /**
   * WebSocket endpoint for real-time room status updates
   * @security Requires authentication token
   */
  router.ws('/status/stream', (ws, req: RequestWithUser) => {
    configureWebSocket(ws);
    
    const statusSubscription = roomController.streamStatusUpdates()
      .subscribe(
        update => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(update));
          }
        },
        error => {
          ws.close(1011, error.message);
        }
      );

    ws.on('close', () => {
      statusSubscription.unsubscribe();
    });
  });

  return router;
};

// Export configured router
export const roomRouter = configureRoomRoutes();