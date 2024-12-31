// @prisma/client v5.0.0 - Database ORM for PostgreSQL
import { PrismaClient } from '@prisma/client';
// pg v8.11.0 - PostgreSQL connection pooling
import { Pool, PoolConfig } from 'pg';
// winston v3.10.0 - Structured logging
import winston from 'winston';

// Type definitions for health check status
interface HealthStatus {
  isHealthy: boolean;
  connectionPool: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
  latency: number;
  lastCheck: Date;
  metrics: {
    queryCount: number;
    errorCount: number;
    slowQueryCount: number;
  };
}

// Configure Winston logger for database operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'database.log' })
  ]
});

// Database configuration
const DB_CONFIG: PoolConfig = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false
};

// Prisma configuration with logging and monitoring
const PRISMA_CONFIG = {
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
    { level: 'info', emit: 'event' }
  ],
  errorFormat: 'pretty',
  connectionTimeout: 5000,
  poolTimeout: 10000
};

// Initialize connection pool with monitoring
const connectionPool = new Pool(DB_CONFIG);

// Initialize Prisma client with monitoring
const prisma = new PrismaClient(PRISMA_CONFIG);

// Monitoring metrics
let metrics = {
  queryCount: 0,
  errorCount: 0,
  slowQueryCount: 0,
  lastHealthCheck: new Date()
};

/**
 * Initializes database connection and Prisma client with monitoring
 * @decorator retryable
 * @returns Promise<void>
 */
async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database connection...');

    // Set up connection pool event handlers
    connectionPool.on('connect', () => {
      logger.info('New database connection established');
    });

    connectionPool.on('error', (err) => {
      logger.error('Database pool error:', err);
      metrics.errorCount++;
    });

    // Configure Prisma event listeners
    prisma.$on('query', (e: any) => {
      metrics.queryCount++;
      if (e.duration > 1000) {
        metrics.slowQueryCount++;
        logger.warn('Slow query detected:', { query: e.query, duration: e.duration });
      }
    });

    // Test database connection
    await connectionPool.query('SELECT 1');
    logger.info('Database connection successful');

    // Initialize data retention policy
    await setupDataRetention();

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Returns monitored Prisma client instance
 * @decorator monitored
 * @returns PrismaClient
 */
function getClient(): PrismaClient {
  return prisma;
}

/**
 * Performs comprehensive database health check
 * @decorator scheduled
 * @returns Promise<HealthStatus>
 */
async function checkDatabaseHealth(): Promise<HealthStatus> {
  const startTime = Date.now();
  try {
    await connectionPool.query('SELECT 1');
    const latency = Date.now() - startTime;

    const poolStatus = await connectionPool.query(
      'SELECT count(*) as total, count(*) filter (where state = \'idle\') as idle, count(*) filter (where state = \'active\') as active FROM pg_stat_activity'
    );

    const status: HealthStatus = {
      isHealthy: true,
      connectionPool: {
        totalCount: parseInt(poolStatus.rows[0].total),
        idleCount: parseInt(poolStatus.rows[0].idle),
        waitingCount: parseInt(poolStatus.rows[0].active)
      },
      latency,
      lastCheck: new Date(),
      metrics: {
        queryCount: metrics.queryCount,
        errorCount: metrics.errorCount,
        slowQueryCount: metrics.slowQueryCount
      }
    };

    // Reset metrics after health check
    metrics = { ...metrics, queryCount: 0, slowQueryCount: 0 };
    
    return status;
  } catch (error) {
    logger.error('Health check failed:', error);
    throw error;
  }
}

/**
 * Sets up data retention policies
 * @returns Promise<void>
 */
async function setupDataRetention(): Promise<void> {
  try {
    // Configure retention period (2 years)
    const retentionPeriod = 730; // days
    
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
      BEGIN
        DELETE FROM "Room" WHERE "updatedAt" < NOW() - INTERVAL '${retentionPeriod} days';
        DELETE FROM "Maintenance" WHERE "completedAt" < NOW() - INTERVAL '${retentionPeriod} days';
        DELETE FROM "Housekeeping" WHERE "completedAt" < NOW() - INTERVAL '${retentionPeriod} days';
      END;
      $$ LANGUAGE plpgsql;
    `;

    logger.info('Data retention policy configured successfully');
  } catch (error) {
    logger.error('Failed to setup data retention:', error);
    throw error;
  }
}

// Cleanup resources on application shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await connectionPool.end();
  logger.info('Database connections closed');
});

export {
  prisma,
  initializeDatabase,
  checkDatabaseHealth,
  type HealthStatus
};