import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      process.env.LICEN_STORAGE_POSTGRES_URL_NON_POOLING ||
      process.env.LICEN_STORAGE_DATABASE_URL_UNPOOLED ||
      "",
  },
});
