/**
 * @fileoverview Main routing configuration for the API Gateway implementing centralized routing,
 * security middleware chains, service proxying, and monitoring for hotel management microservices.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import proxy from 'express-http-proxy'; // v1.6.3
import * as prometheus from 'prom-client'; // v14.2.0
import { authenticate, authorize, ROLES } from '../middleware/auth.middleware';
import { validateRequestMiddleware } from '../middleware/validation.middleware';
import rateLimitMiddleware from '../middleware/ratelimit.middleware';
import { ErrorCode } from '../../shared/constants/error-codes';
import { HttpStatusCode } from '../../shared/constants/status-codes';

// Service Routes
const SERVICE_ROUTES = {
  BILLING: '/api/v1/billing',
  GUEST: '/api/v1/guests',
  RESERVATION: '/api/v1/reservations',
  ROOM: '/api/v1/rooms',
  WEBSOCKET: '/ws'
} as const;

// Service Endpoints
const SERVICE_ENDPOINTS = {
  BILLING_SERVICE: 'http://billing-service:3000',
  GUEST_SERVICE: 'http://guest-service:3000',
  RESERVATION_SERVICE: 'http://reservation-service:3000',
  ROOM_SERVICE: 'http://room-service:3000',
  WEBSOCKET_SERVICE: 'http://websocket-service:3000'
} as const;

// Rate Limits
const RATE_LIMITS = {
  DEFAULT: '100/15min',
  BILLING: '50/15min',
  RESERVATION: '200/15min'
} as const;

// Initialize Prometheus metrics
const httpRequestDurationMs = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['route', 'method', 'status'],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['route', 'method', 'status']
});

/**
 * Creates an enhanced proxy middleware with monitoring and error handling
 * @param serviceUrl - Target microservice URL
 * @param options - Additional proxy options
 */
function createServiceProxy(serviceUrl: string, options: any = {}) {
  return proxy(serviceUrl, {
    proxyTimeout: 10000,
    memoizeHost: false,
    parseReqBody: true,
    proxyErrorHandler: (err, res, next) => {
      httpRequestTotal.inc({
        route: options.route,
        method: 'PROXY',
        status: HttpStatusCode.SERVICE_UNAVAILABLE
      });
      res.status(HttpStatusCode.SERVICE_UNAVAILABLE).json({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: 'Service temporarily unavailable'
      });
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      const route = options.route;
      const method = userReq.method;
      const status = proxyRes.statusCode;

      httpRequestTotal.inc({ route, method, status });
      httpRequestDurationMs.observe(
        { route, method, status },
        Date.now() - (userReq as any).startTime
      );

      return proxyResData;
    },
    ...options
  });
}

// Initialize router
const router = Router();

// Setup routes with middleware chains
export function setupRoutes(): Router {
  // Request timing middleware
  router.use((req, res, next) => {
    (req as any).startTime = Date.now();
    next();
  });

  // Billing Service Routes
  router.use(
    SERVICE_ROUTES.BILLING,
    rateLimitMiddleware({ max: parseInt(RATE_LIMITS.BILLING) }),
    authenticate,
    authorize([ROLES.SUPER_ADMIN, ROLES.HOTEL_MANAGER]),
    validateRequestMiddleware,
    createServiceProxy(SERVICE_ENDPOINTS.BILLING_SERVICE, {
      route: SERVICE_ROUTES.BILLING
    })
  );

  // Guest Service Routes
  router.use(
    SERVICE_ROUTES.GUEST,
    rateLimitMiddleware({ max: parseInt(RATE_LIMITS.DEFAULT) }),
    authenticate,
    authorize([ROLES.SUPER_ADMIN, ROLES.HOTEL_MANAGER, ROLES.FRONT_DESK]),
    validateRequestMiddleware,
    createServiceProxy(SERVICE_ENDPOINTS.GUEST_SERVICE, {
      route: SERVICE_ROUTES.GUEST
    })
  );

  // Reservation Service Routes
  router.use(
    SERVICE_ROUTES.RESERVATION,
    rateLimitMiddleware({ max: parseInt(RATE_LIMITS.RESERVATION) }),
    authenticate,
    authorize([ROLES.SUPER_ADMIN, ROLES.HOTEL_MANAGER, ROLES.FRONT_DESK]),
    validateRequestMiddleware,
    createServiceProxy(SERVICE_ENDPOINTS.RESERVATION_SERVICE, {
      route: SERVICE_ROUTES.RESERVATION
    })
  );

  // Room Service Routes
  router.use(
    SERVICE_ROUTES.ROOM,
    rateLimitMiddleware({ max: parseInt(RATE_LIMITS.DEFAULT) }),
    authenticate,
    authorize([ROLES.SUPER_ADMIN, ROLES.HOTEL_MANAGER, ROLES.FRONT_DESK, ROLES.HOUSEKEEPING]),
    validateRequestMiddleware,
    createServiceProxy(SERVICE_ENDPOINTS.ROOM_SERVICE, {
      route: SERVICE_ROUTES.ROOM
    })
  );

  // WebSocket Routes
  router.use(
    SERVICE_ROUTES.WEBSOCKET,
    authenticate,
    createServiceProxy(SERVICE_ENDPOINTS.WEBSOCKET_SERVICE, {
      route: SERVICE_ROUTES.WEBSOCKET,
      ws: true
    })
  );

  // Metrics endpoint
  router.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', prometheus.register.contentType);
      res.end(await prometheus.register.metrics());
    } catch (error) {
      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'Error collecting metrics'
      });
    }
  });

  return router;
}

export default setupRoutes();