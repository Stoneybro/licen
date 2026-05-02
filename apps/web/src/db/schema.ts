import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const publishRequests = pgTable("publish_requests", {
  requestId: text("request_id").primaryKey(),
  datasetRoot: text("dataset_root").notNull(),
  encryptedKeyEnvelope: text("encrypted_key_envelope"),
  payload: jsonb("payload").notNull(),
  record: jsonb("record").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
