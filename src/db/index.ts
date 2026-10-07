// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads and prevent connection leaks
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the optimized connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: Number(process.env.SQL_MAX_POOL_SIZE || '20'), // Increased capacity for concurrent operations
      min: Number(process.env.SQL_MIN_POOL_SIZE || '2'),  // Pre-warmed standby connections for instant queries
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s if pool full
      keepAlive: true, // Reuse persistent TCP sockets
      keepAliveInitialDelayMillis: 10000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err: any) => {
      if (err?.message?.includes('terminating connection due to administrator command')) {
        // Routine Cloud SQL idle timeout / scale-to-zero event; pool auto-recovers.
        return;
      }
      console.error('Unexpected error on idle SQL pool client (auto-recovering):', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

