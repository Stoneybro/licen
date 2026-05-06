/**
 * Orchestrator — Main Entry Point
 *
 * Usage:
 *   pnpm dev      (tsx watch src/index.ts)
 *   pnpm start    (node dist/index.js)
 *
 * Required environment variables (.env in packages/orchestrator/):
 *   ORCHESTRATOR_PRIVATE_KEY=<hex>        # secp256k1 private key for ECIES unsealing
 *   BACKEND_WALLET_PRIVATE_KEY=<hex>      # wallet key for on-chain tx (startJob, etc.)
 *   OG_COMPUTE_PRIVATE_KEY=<hex>          # wallet key for 0G Compute payment (must hold 0G tokens)
 *   OG_DATA_POLICY_ADDRESS=<0x...>        # deployed DataPolicy contract address
 *   OG_EVM_RPC_URL=https://...            # 0G Testnet RPC
 *   ENVIO_GRAPHQL_URL=http://...          # Envio HyperIndex GraphQL endpoint
 *   LICEN_WEB_API_URL=http://localhost:3000  # LICEN Next.js app URL (for key envelope lookup)
 *   DATABASE_URL=postgresql://...         # Neon DB (unpooled) for persistent job tracking
 *   ORCHESTRATOR_POLL_MS=5000             # (optional) event poll interval in ms
 *   OG_TASK_POLL_MS=30000                 # (optional) 0G task status poll interval in ms
 *   OG_COMPUTE_MODEL=Qwen2.5-0.5B-Instruct # (optional) fine-tuning model
 */
import { startPoller } from "./poller.js";
import { startJobTracker } from "./jobTracker.js";
process.on("uncaughtException", (err) => {
    console.error("[orchestrator] Uncaught exception:", err);
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    console.error("[orchestrator] Unhandled rejection:", reason);
    process.exit(1);
});
console.log("=================================================");
console.log("  LICEN Orchestrator");
console.log("=================================================");
// Validate required env vars before starting
const REQUIRED_ENV = [
    "ORCHESTRATOR_PRIVATE_KEY",
    "BACKEND_WALLET_PRIVATE_KEY",
    "OG_COMPUTE_PRIVATE_KEY",
    "OG_DATA_POLICY_ADDRESS",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
    console.error(`[orchestrator] Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
}
startPoller();
startJobTracker();
