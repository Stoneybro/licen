/**
 * Orchestrator database schema.
 *
 * compute_jobs — persists dispatched 0G Compute tasks so the orchestrator
 *   can survive restarts and continue polling for completion.
 */
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
export const computeJobs = pgTable("compute_jobs", {
    /** bytes32 on-chain job ID from DataPolicy.sol */
    licenJobId: text("licen_job_id").primaryKey(),
    datasetRoot: text("dataset_root").notNull(),
    /** Task UUID returned by @0gfoundation/0g-compute-ts-sdk */
    zeroGTaskId: text("zerog_task_id"),
    providerAddress: text("provider_address"),
    requestedEpochs: integer("requested_epochs").notNull(),
    actualEpochs: integer("actual_epochs"),
    /** 0G Storage root hash of the encrypted LoRA adapter zip */
    resultHash: text("result_hash"),
    /** Stored task ID used as on-chain attestation reference */
    attestationRef: text("attestation_ref"),
    /** pending | dispatching | running | acknowledging | completed | failed */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
