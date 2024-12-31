// @prisma/client v5.0.0 - Database ORM for TypeScript
import { PrismaClient } from '@prisma/client';
// dotenv v16.0.0 - Environment configuration management
import { config } from 'dotenv';
// winston v3.8.0 - Logging service
import * as winston from 'winston';

// Load environment variables
config();

// Configure logger for database operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'database.log' })
  ]
});

// Add console logging in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Database configuration interface
interface DatabaseConfig {
  url: string;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
    acquireTimeout: number;
  };
  ssl: boolean;
  monitoring: {
    healthCheckInterval: number;
    metricsEnabled: boolean;
    alertThresholds: {
      connectionErrors: number;
      poolExhaustion: number;
      queryTimeout: number;
    };
  };
}

// Load database configuration from environment
const dbConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL!,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000')
  },
  ssl: process.env.DB_SSL === 'true',
  monitoring: {
    healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000'),
    metricsEnabled: process.env.DB_METRICS_ENABLED === 'true',
    alertThresholds: {
      connectionErrors: parseInt(process.env.DB_ALERT_CONNECTION_ERRORS || '5'),
      poolExhaustion: parseInt(process.env.DB_ALERT_POOL_EXHAUSTION || '90'),
      queryTimeout: parseInt(process.env.DB_ALERT_QUERY_TIMEOUT || '5000')
    }
  }
};

// Global prisma client instance
let prisma: PrismaClient;

/**
 * Validates database configuration parameters
 * @throws Error if configuration is invalid
 */
const validateDatabaseConfig = (): boolean => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
    throw new Error('Invalid database URL format - must be PostgreSQL');
  }

  if (dbConfig.pool.min > dbConfig.pool.max) {
    throw new Error('Minimum pool size cannot be greater than maximum');
  }

  return true;
};

/**
 * Monitors database health and connection pool metrics
 */
const monitorDatabaseHealth = async (client: PrismaClient): Promise<void> => {
  setInterval(async () => {
    try {
      // Test database connection
      await client.$queryRaw`SELECT 1`;
      
      logger.info('Database health check passed', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Database health check failed', {
        error,
        timestamp: new Date().toISOString()
      });
    }
  }, dbConfig.monitoring.healthCheckInterval);
};

/**
 * Returns singleton database client instance
 */
export const getDatabaseClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ],
      datasources: {
        db: {
          url: dbConfig.url
        }
      }
    });

    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      prisma.$on('query', (e) => {
        logger.debug('Query executed', {
          query: e.query,
          duration: e.duration,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Log errors
    prisma.$on('error', (e) => {
      logger.error('Database error occurred', {
        error: e.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  return prisma;
};

/**
 * Initializes database connection with retry mechanism
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Validate configuration
    validateDatabaseConfig();

    // Get client instance
    const client = getDatabaseClient();

    // Test connection
    await client.$connect();
    logger.info('Database connection established successfully');

    // Start health monitoring
    await monitorDatabaseHealth(client);

    // Setup shutdown handlers
    process.on('SIGINT', async () => {
      await client.$disconnect();
      logger.info('Database connection closed due to application shutdown');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to initialize database', {
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

// Export configured prisma client
export const prisma = getDatabaseClient();

// Export specific models for type safety
export const { booking, rate } = prisma;