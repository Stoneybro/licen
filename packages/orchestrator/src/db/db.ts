/**
 * Orchestrator database client.
 *
 * Uses postgres-js + drizzle-orm/postgres-js (not the Neon HTTP driver)
 * because the orchestrator is a long-running Node.js process that benefits
 * from a persistent connection pool.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.LICEN_STORAGE_POSTGRES_URL_NON_POOLING ||
  process.env.LICEN_STORAGE_DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL or LICEN_STORAGE_DATABASE_URL_UNPOOLED env var for orchestrator DB connection"
  );
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
