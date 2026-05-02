import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import * as path from 'path';

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.LICEN_STORAGE_POSTGRES_URL || process.env.POSTGRES_URL || '',
  },
});
