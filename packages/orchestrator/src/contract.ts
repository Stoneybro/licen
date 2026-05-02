/**
 * DataPolicy contract — on-chain ABI and chain config for the orchestrator.
 * Mirrors the relevant parts of apps/web/src/lib/publish/onchain.ts but
 * is kept separate so the orchestrator has no Next.js dependency.
 */

// ---------------------------------------------------------------------------
// Job state enum (matches DataPolicy.sol)
// ---------------------------------------------------------------------------
export enum JobState {
  None = 0,
  Requested = 1,
  Granted = 2,
  Running = 3,
  Completed = 4,
  Failed = 5,
  TimedOut = 6,
  Refunded = 7,
}

// ---------------------------------------------------------------------------
// Minimal ABI — only functions the orchestrator calls
// ---------------------------------------------------------------------------
export const DATA_POLICY_ABI = [
  // Read job state
  {
    type: "function",
    name: "jobs",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [
      { name: "datasetRoot", type: "bytes32" },  // [0]
      { name: "requester", type: "address" },     // [1]
      { name: "provider", type: "address" },      // [2]
      { name: "purposeId", type: "bytes32" },     // [3]
      { name: "requestedEpochs", type: "uint32" }, // [4]
      { name: "escrowAmount", type: "uint256" },   // [5]
      { name: "requestTime", type: "uint64" },     // [6]
      { name: "state", type: "uint8" },            // [7] JobState enum
      { name: "termsHash", type: "bytes32" },      // [8]
    ],
  },
  // State transitions (only backendWallet can call these)
  {
    type: "function",
    name: "startJob",
    stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmTrainingComplete",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "actualEpochs", type: "uint32" },
      { name: "resultHash", type: "bytes32" },
      { name: "attestationRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "markJobFailed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "bytes32" },
      { name: "reasonCode", type: "string" },
    ],
    outputs: [],
  },
] as const;
