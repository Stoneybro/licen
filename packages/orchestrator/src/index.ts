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
 *   OG_DATA_POLICY_ADDRESS=<0x...>        # deployed DataPolicy contract address
 *   OG_EVM_RPC_URL=https://...            # 0G Testnet RPC
 *   ENVIO_GRAPHQL_URL=http://...          # Envio HyperIndex GraphQL endpoint
 *   LICEN_WEB_API_URL=http://localhost:3000  # LICEN Next.js app URL (for key envelope lookup)
 *   ORCHESTRATOR_POLL_MS=5000             # (optional) poll interval in ms
 */

import { startPoller } from "./poller.js";

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
  "OG_DATA_POLICY_ADDRESS",
];

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[orchestrator] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

startPoller();
