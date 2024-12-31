// @prisma/client v5.0.0 - Prisma ORM for database operations
import { PrismaClient, Prisma } from '@prisma/client';
// dotenv v16.0.0 - Environment configuration management
import { config } from 'dotenv';

// Initialize environment configuration
config();

// Database configuration interface
interface DatabaseConfig {
  url: string;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  ssl: boolean;
  schema: string;
  sslConfig?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

// Database health check interface
interface DatabaseHealth {
  isHealthy: boolean;
  connectionCount: number;
  idleConnections: number;
  lastError: string | null;
}

// Create database configuration from environment variables
const createDatabaseConfig = (): DatabaseConfig => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return {
    url: dbUrl,
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 10,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    ssl: process.env.DB_SSL_ENABLED === 'true',
    schema: process.env.DB_SCHEMA || 'public',
    sslConfig: process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY
    } : undefined
  };
};

// Initialize Prisma client with configuration
const initializePrisma = async (config: DatabaseConfig): Promise<PrismaClient> => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.url
      }
    },
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
    errorFormat: 'pretty',
    connectionLimit: config.maxConnections,
  });

  // Configure connection event listeners
  prisma.$on('query', (e: Prisma.QueryEvent) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Query:', e.query);
      console.log('Duration:', e.duration + 'ms');
    }
  });

  prisma.$on('error', (e: Prisma.LogEvent) => {
    console.error('Database error:', e.message);
  });

  // Implement connection retry logic
  let retries = 5;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('Successfully connected to database');
      break;
    } catch (error) {
      console.error(`Failed to connect to database. Retries left: ${retries}`);
      retries--;
      if (retries === 0) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return prisma;
};

// Database health check implementation
const checkDatabaseHealth = async (prisma: PrismaClient): Promise<DatabaseHealth> => {
  try {
    // Perform test query
    await prisma.$queryRaw`SELECT 1`;
    
    // Get connection metrics (implementation depends on Prisma's internal API)
    const metrics = await (prisma as any).$metrics?.();
    
    return {
      isHealthy: true,
      connectionCount: metrics?.connections || 1,
      idleConnections: metrics?.idleConnections || 0,
      lastError: null
    };
  } catch (error) {
    return {
      isHealthy: false,
      connectionCount: 0,
      idleConnections: 0,
      lastError: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Create database configuration
const dbConfig = createDatabaseConfig();

// Initialize Prisma instance
const prisma = await initializePrisma(dbConfig);

// Export configured instances and types
export {
  prisma as default,
  DatabaseConfig,
  DatabaseHealth,
  checkDatabaseHealth,
  createDatabaseConfig
};

// Export specific Prisma client operations
export const { guest, preference } = prisma;