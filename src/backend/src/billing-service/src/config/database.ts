// @prisma/client v5.0.0 - Type-safe database ORM for financial transactions
import { PrismaClient } from '@prisma/client';
// dotenv v16.0.0 - Secure environment configuration management
import { config } from 'dotenv';
// winston v3.8.0 - Advanced logging for database operations
import winston from 'winston';

// Load environment variables
config();

// Database configuration interface
interface DatabaseConfig {
  url: string;
  ssl: boolean;
  connectionTimeout: number;
  queryTimeout: number;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
    acquireTimeout: number;
  };
  retry: {
    attempts: number;
    backoff: 'exponential';
    maxTimeout: number;
  };
}

// Initialize Winston logger for database operations
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'database-combined.log' })
  ]
});

// Database configuration with PCI DSS compliance settings
const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL || '',
  ssl: true,
  connectionTimeout: 5000,
  queryTimeout: 30000,
  pool: {
    min: 2,
    max: 10,
    idleTimeout: 10000,
    acquireTimeout: 60000
  },
  retry: {
    attempts: 5,
    backoff: 'exponential',
    maxTimeout: 30000
  }
};

// Validate database configuration parameters
function validateDatabaseConfig(config: DatabaseConfig): boolean {
  if (!config.url) {
    logger.error('Database URL is not configured');
    return false;
  }

  if (!config.url.startsWith('postgresql://')) {
    logger.error('Invalid database URL format');
    return false;
  }

  if (!config.ssl) {
    logger.error('SSL must be enabled for PCI DSS compliance');
    return false;
  }

  return true;
}

// Initialize Prisma client with enhanced security options
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseConfig.url,
    },
  },
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' }
  ],
  errorFormat: 'minimal',
});

// Event handlers for Prisma client
prisma.$on('warn', (e) => {
  logger.warn('Prisma Warning:', e);
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error:', e);
});

// Initialize database connection with security checks
async function initializeDatabase(): Promise<void> {
  try {
    // Validate configuration
    if (!validateDatabaseConfig(databaseConfig)) {
      throw new Error('Invalid database configuration');
    }

    // Test database connection
    await prisma.$connect();
    logger.info('Database connection established successfully');

    // Set up connection event monitoring
    process.on('SIGINT', async () => {
      await prisma.$disconnect();
      logger.info('Database connection closed due to application termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

// Get database client with security checks
function getDatabaseClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Database client not initialized');
  }
  return prisma;
}

// Export secured database client and initialization function
export {
  prisma,
  initializeDatabase,
  getDatabaseClient
};

// Export specific models for billing operations
export const {
  folio,
  payment,
  invoice
} = prisma;