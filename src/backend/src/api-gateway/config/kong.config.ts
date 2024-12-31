/**
 * @fileoverview Kong API Gateway configuration for Hotel Management ERP system
 * Implements comprehensive routing, security, and monitoring configurations
 * @version 1.0.0
 */

import { config } from 'dotenv';
import { HttpStatusCode } from '../../shared/constants/status-codes';

// Load environment variables
config();

// Gateway Configuration Constants
const DEFAULT_RATE_LIMIT = 1000;
const DEFAULT_RETRY_COUNT = 3;
const TOKEN_EXPIRY = 7200; // 2 hours
const CIRCUIT_BREAKER_THRESHOLD = 50; // 50% error threshold

// Global Gateway URLs
const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_PROXY_URL = process.env.KONG_PROXY_URL || 'http://localhost:8000';
const KONG_MONITORING_URL = process.env.KONG_MONITORING_URL || 'http://localhost:8002';

/**
 * Interface for health check configuration
 */
interface HealthCheckConfig {
  active: boolean;
  interval: number;
  timeout: number;
  httpPath: string;
  healthy: {
    interval: number;
    successes: number;
  };
  unhealthy: {
    interval: number;
    timeouts: number;
    httpFailures: number;
  };
}

/**
 * Interface for circuit breaker configuration
 */
interface CircuitBreakerConfig {
  errorThreshold: number;
  timeoutWindow: number;
  retryTimeout: number;
  fallbackResponse: Record<string, any>;
}

/**
 * Interface for service configuration
 */
interface ServiceConfig {
  name: string;
  url: string;
  protocol: string;
  port: number;
  retries: number;
  tags: string[];
  healthCheck: HealthCheckConfig;
  circuitBreaker: CircuitBreakerConfig;
}

/**
 * Interface for route configuration
 */
interface RouteConfig {
  name: string;
  paths: string[];
  methods: string[];
  protocols: string[];
  stripPath: boolean;
  preserveHost: boolean;
  service: string;
}

/**
 * Interface for security configuration
 */
interface SecurityConfig {
  jwt: {
    secretKey: string;
    expirySeconds: number;
    algorithm: string;
  };
  cors: {
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  ipRestriction: {
    allowList: string[];
    denyList: string[];
  };
  apiKeys: {
    enabled: boolean;
    keyNames: string[];
  };
}

/**
 * Interface for plugin configuration
 */
interface PluginConfig {
  name: string;
  service?: string;
  route?: string;
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Interface for monitoring configuration
 */
interface MonitoringConfig {
  prometheus: {
    enabled: boolean;
    path: string;
  };
  logging: {
    level: string;
    format: string;
  };
}

/**
 * Main Kong configuration interface
 */
interface KongConfig {
  services: ServiceConfig[];
  routes: RouteConfig[];
  plugins: PluginConfig[];
  security: SecurityConfig;
  monitoring: MonitoringConfig;
}

/**
 * Loads and validates Kong configuration
 */
function loadKongConfig(): KongConfig {
  // Define microservices
  const services: ServiceConfig[] = [
    {
      name: 'reservation-service',
      url: process.env.RESERVATION_SERVICE_URL || 'http://reservation-service',
      protocol: 'http',
      port: 3000,
      retries: DEFAULT_RETRY_COUNT,
      tags: ['booking', 'core'],
      healthCheck: {
        active: true,
        interval: 10,
        timeout: 5,
        httpPath: '/health',
        healthy: {
          interval: 5,
          successes: 2
        },
        unhealthy: {
          interval: 5,
          timeouts: 3,
          httpFailures: 3
        }
      },
      circuitBreaker: {
        errorThreshold: CIRCUIT_BREAKER_THRESHOLD,
        timeoutWindow: 60,
        retryTimeout: 30,
        fallbackResponse: {
          message: 'Service temporarily unavailable',
          status: HttpStatusCode.SERVICE_UNAVAILABLE
        }
      }
    },
    // Additional services configured similarly...
  ];

  // Define routes
  const routes: RouteConfig[] = [
    {
      name: 'reservation-routes',
      paths: ['/api/v1/reservations'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      protocols: ['http', 'https'],
      stripPath: false,
      preserveHost: true,
      service: 'reservation-service'
    },
    // Additional routes configured similarly...
  ];

  // Define plugins
  const plugins: PluginConfig[] = [
    {
      name: 'jwt',
      config: {
        secret_key: process.env.JWT_SECRET_KEY,
        key_claim_name: 'kid',
        claims_to_verify: ['exp']
      },
      enabled: true
    },
    {
      name: 'rate-limiting',
      config: {
        minute: DEFAULT_RATE_LIMIT,
        policy: 'local',
        fault_tolerant: true,
        hide_client_headers: false,
        redis_timeout: 2000
      },
      enabled: true
    },
    {
      name: 'cors',
      config: {
        origins: ['*'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        headers: ['Accept', 'Authorization', 'Content-Type'],
        exposed_headers: ['X-Auth-Token'],
        credentials: true,
        max_age: 3600
      },
      enabled: true
    },
    // Additional plugins configured similarly...
  ];

  // Security configuration
  const security: SecurityConfig = {
    jwt: {
      secretKey: process.env.JWT_SECRET_KEY || 'your-secret-key',
      expirySeconds: TOKEN_EXPIRY,
      algorithm: 'HS256'
    },
    cors: {
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Accept', 'Authorization', 'Content-Type'],
      credentials: true
    },
    ipRestriction: {
      allowList: process.env.IP_ALLOWLIST?.split(',') || [],
      denyList: process.env.IP_DENYLIST?.split(',') || []
    },
    apiKeys: {
      enabled: true,
      keyNames: ['x-api-key']
    }
  };

  // Monitoring configuration
  const monitoring: MonitoringConfig = {
    prometheus: {
      enabled: true,
      path: '/metrics'
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  };

  return {
    services,
    routes,
    plugins,
    security,
    monitoring
  };
}

// Export the configuration
export const kongConfig = loadKongConfig();