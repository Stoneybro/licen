/**
 * Orchestrator — Envio Event Poller
 *
 * Polls the Envio HyperIndex GraphQL API for jobs in Granted state that
 * haven't been dispatched yet, then calls processGrantedJob() for each.
 *
 * Architecture note:
 * The Envio indexer (packages/indexer) is a pure data layer — it indexes
 * chain events into a queryable store. The orchestrator is the actor that
 * reads from that store and takes action.
 *
 * In production, replace polling with a webhook subscription if Envio
 * supports it, or use an on-chain event listener directly via viem's
 * watchContractEvent().
 */
import { processGrantedJob } from "./dispatcher.js";
import { db } from "./db/db.js";
import { computeJobs } from "./db/schema.js";
import { eq } from "drizzle-orm";
const ENVIO_GRAPHQL_URL = process.env.ENVIO_GRAPHQL_URL ?? "http://127.0.0.1:8080/v1/graphql";
const POLL_INTERVAL_MS = parseInt(process.env.ORCHESTRATOR_POLL_MS ?? "5000", 10);
// ---------------------------------------------------------------------------
// GraphQL query — fetch Granted jobs that need dispatching
// ---------------------------------------------------------------------------
const GRANTED_JOBS_QUERY = `
  query GrantedJobs {
    Job(where: { state: { _eq: "Granted" } }) {
      id
      datasetRoot
      requestedEpochs
      dataset {
        manifestHash
      }
    }
  }
`;
async function fetchGrantedJobs() {
    const res = await fetch(ENVIO_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: GRANTED_JOBS_QUERY }),
    });
    if (!res.ok) {
        throw new Error(`Envio GraphQL error: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json());
    return body.data?.Job ?? [];
}
// ---------------------------------------------------------------------------
// Key envelope lookup
//
// The encryptedKeyEnvelope is stored in the publish submit payload.
// In MVP, we look it up from the LICEN web API (which holds it in memory/store).
// In production, persist it to a database at publish time.
// ---------------------------------------------------------------------------
const WEB_API_BASE = process.env.LICEN_WEB_API_URL ?? "http://localhost:3000";
async function fetchKeyEnvelope(datasetRoot) {
    try {
        const secret = process.env.ORCHESTRATOR_API_SECRET;
        const res = await fetch(`${WEB_API_BASE}/api/orchestrator/key-envelope?datasetRoot=${encodeURIComponent(datasetRoot)}`, {
            headers: secret ? { "Authorization": `Bearer ${secret}` } : {},
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 503) {
                console.error(`[poller] Key envelope fetch failed with ${res.status}. Check ORCHESTRATOR_API_SECRET.`);
            }
            return null;
        }
        const body = (await res.json());
        return body.encryptedKeyEnvelope ?? null;
    }
    catch (err) {
        console.error(`[poller] Error fetching key envelope for ${datasetRoot}:`, err);
        return null;
    }
}
// ---------------------------------------------------------------------------
// Dispatch tracking — don't re-dispatch jobs we've already sent
// ---------------------------------------------------------------------------
// (Deduplication is now handled by the DB — compute_jobs table tracks dispatched jobs.)
// We still keep a small in-process cache to avoid hammering the DB on every poll cycle.
const dispatched = new Set();
async function isAlreadyDispatched(jobId) {
    if (dispatched.has(jobId))
        return true;
    // Check DB for jobs that survived a restart
    const existing = await db.query.computeJobs.findFirst({
        where: eq(computeJobs.licenJobId, jobId),
        columns: { licenJobId: true },
    });
    if (existing) {
        dispatched.add(jobId); // cache it
        return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------
async function poll() {
    let jobs;
    try {
        jobs = await fetchGrantedJobs();
    }
    catch (err) {
        console.error("[poller] Failed to fetch granted jobs:", err);
        return;
    }
    for (const job of jobs) {
        if (await isAlreadyDispatched(job.id))
            continue;
        // Fetch the encrypted key envelope
        const encryptedKeyEnvelope = await fetchKeyEnvelope(job.datasetRoot);
        if (!encryptedKeyEnvelope) {
            console.warn(`[poller] No key envelope found for dataset ${job.datasetRoot} (job ${job.id}). ` +
                "Skipping — will retry next poll.");
            continue;
        }
        // Mark as dispatched before async call to prevent duplicate dispatch
        dispatched.add(job.id);
        const grantedJob = {
            jobId: job.id,
            datasetRoot: job.datasetRoot,
            encryptedKeyEnvelope,
            // datasetCid = datasetRoot (the 0G Storage root hash IS the dataset CID)
            datasetCid: job.datasetRoot,
            requestedEpochs: job.requestedEpochs,
        };
        // Process async — don't block the poll loop
        processGrantedJob(grantedJob).catch((err) => {
            console.error(`[poller] processGrantedJob error for ${job.id}:`, err);
            // Remove from dispatched so it will be retried next poll
            dispatched.delete(job.id);
        });
    }
}
// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export function startPoller() {
    console.log(`[poller] Starting orchestrator poller (interval: ${POLL_INTERVAL_MS}ms)`);
    console.log(`[poller] Envio endpoint: ${ENVIO_GRAPHQL_URL}`);
    const safePoll = () => poll().catch((e) => console.error("[poller] Poll error (will retry):", e.message));
    // Run immediately, then on interval
    safePoll();
    setInterval(safePoll, POLL_INTERVAL_MS);
}
