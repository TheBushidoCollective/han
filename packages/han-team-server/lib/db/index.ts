/**
 * Database Connection Module for Han Team Platform
 */

import pg from "pg";
import Redis from "ioredis";
import { getConfig } from "../config/schema.ts";

const { Pool } = pg;

let dbPool: pg.Pool | null = null;
let redisClient: Redis | null = null;

/**
 * Get PostgreSQL connection pool
 */
export async function getDbConnection(): Promise<pg.Pool> {
  if (!dbPool) {
    const config = getConfig();
    dbPool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    await dbPool.query("SELECT 1");
  }
  return dbPool;
}

/**
 * Get Redis connection
 */
export async function getRedisConnection(): Promise<Redis> {
  if (!redisClient) {
    const config = getConfig();
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    });

    // Test connection
    await redisClient.ping();
  }
  return redisClient;
}

/**
 * Close all connections (for graceful shutdown)
 */
export async function closeConnections(): Promise<void> {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
