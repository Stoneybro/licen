import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// We fall back to POSTGRES_URL if the specific LICEN_STORAGE_POSTGRES_URL isn't set in preview envs
const connectionString = process.env.LICEN_STORAGE_POSTGRES_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("Missing LICEN_STORAGE_POSTGRES_URL environment variable for database connection");
}

const sql = neon(connectionString);
export const db = drizzle({ client: sql, schema });
