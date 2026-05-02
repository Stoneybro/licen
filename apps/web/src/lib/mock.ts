export type JobState =
  | "Requested"
  | "Granted"
  | "Running"
  | "Completed"
  | "Failed"
  | "TimedOut"
  | "Refunded";

export type PolicyPurpose = {
  id: string;
  label: string;
};

export const PURPOSES: PolicyPurpose[] = [
  { id: "0xabc1", label: "NEURAL_RESEARCH" },
  { id: "0xabc2", label: "ACADEMIC" },
  { id: "0xabc3", label: "COMMERCIAL_R&D" },
  { id: "0xabc4", label: "BIOMEDICAL" },
  { id: "0xabc5", label: "CLIMATE_SCIENCE" },
];

export type JobEvent = {
  topic: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  args: Record<string, string>;
};

export type MockJob = {
  jobId: string;
  datasetRoot: string;
  datasetLabel: string;
  requester: string;
  provider: string;
  providerId: string;
  purposeId: string;
  purposeLabel: string;
  requestedEpochs: number;
  actualEpochs: number | null;
  escrow: string;
  settledAmount: string | null;
  refundAmount: string | null;
  resultHash: string | null;
  attestationRef: string | null;
  state: JobState;
  createdAt: string;
  updatedAt: string;
  events: JobEvent[];
};

export type MockDataset = {
  datasetRoot: string;
  manifestHash: string;
  owner: string;
  label: string;
  description: string;
  allowedPurposeIds: string[];
  allowedRequesters: string[];
  openRequesters: boolean;
  royaltyPerEpoch: string;
  maxEpochsPerRun: number;
  maxRunsPerRequester: number;
  accessTtlSeconds: number;
  policyExpiry: string;
  requireResultAttestation: boolean;
  active: boolean;
  lifetimeRoyalties: string;
  jobCount: number;
  activeJobCount: number;
};

const ME = "0x4f3a8b2c1d9e6f7a0b5c3d2e1f8a9b4c5d6e7f80";

export const MOCK_DATASETS: MockDataset[] = [
  {
    datasetRoot: "0x7a3f9c2b1e8d4a6f5c0b3e2d1a9f8c7b6e5d4a3f",
    manifestHash: "0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
    owner: ME,
    label: "BioMed Research Corpus v2",
    description: "Curated biomedical literature and clinical trial summaries, 14GB encrypted.",
    allowedPurposeIds: ["0xabc1", "0xabc2", "0xabc4"],
    allowedRequesters: [],
    openRequesters: true,
    royaltyPerEpoch: "50",
    maxEpochsPerRun: 20,
    maxRunsPerRequester: 5,
    accessTtlSeconds: 86400,
    policyExpiry: "2026-12-31T00:00:00Z",
    requireResultAttestation: true,
    active: true,
    lifetimeRoyalties: "12,400",
    jobCount: 31,
    activeJobCount: 3,
  },
  {
    datasetRoot: "0x3e1a7f9c5b2d8e4a6f0c3b5d2e9a1f8c7b6e4d3a",
    manifestHash: "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e",
    owner: ME,
    label: "Climate Sensor Dataset 2024",
    description: "Global climate sensor readings and satellite imagery embeddings, 8GB.",
    allowedPurposeIds: ["0xabc1", "0xabc5"],
    allowedRequesters: [],
    openRequesters: true,
    royaltyPerEpoch: "30",
    maxEpochsPerRun: 10,
    maxRunsPerRequester: 3,
    accessTtlSeconds: 43200,
    policyExpiry: "2026-06-30T00:00:00Z",
    requireResultAttestation: false,
    active: true,
    lifetimeRoyalties: "5,880",
    jobCount: 14,
    activeJobCount: 1,
  },
  {
    datasetRoot: "0xc8a4f2e9b6d1a3f7e5c0b8d4a2f9e6c3b1a7f5e4",
    manifestHash: "0x2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    owner: "0x9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c",
    label: "Multilingual NLP Corpus",
    description: "50-language parallel corpus for multilingual model fine-tuning, 22GB.",
    allowedPurposeIds: ["0xabc1", "0xabc2", "0xabc3"],
    allowedRequesters: [],
    openRequesters: true,
    royaltyPerEpoch: "80",
    maxEpochsPerRun: 15,
    maxRunsPerRequester: 10,
    accessTtlSeconds: 172800,
    policyExpiry: "2027-03-31T00:00:00Z",
    requireResultAttestation: true,
    active: true,
    lifetimeRoyalties: "48,320",
    jobCount: 87,
    activeJobCount: 5,
  },
  {
    datasetRoot: "0xd5e2f9a7c4b1e8d3f6a0c5b2e9d7f4a1c8e5b2d9",
    manifestHash: "0x4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d",
    owner: "0x3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b",
    label: "Code Commit History Dataset",
    description: "Open-source repository commit data across 500k projects, 31GB.",
    allowedPurposeIds: ["0xabc1", "0xabc3"],
    allowedRequesters: ["0x4f3a8b2c1d9e6f7a0b5c3d2e1f8a9b4c5d6e7f80"],
    openRequesters: false,
    royaltyPerEpoch: "60",
    maxEpochsPerRun: 8,
    maxRunsPerRequester: 2,
    accessTtlSeconds: 28800,
    policyExpiry: "2026-09-30T00:00:00Z",
    requireResultAttestation: true,
    active: true,
    lifetimeRoyalties: "8,760",
    jobCount: 19,
    activeJobCount: 0,
  },
];

export const MOCK_JOBS: MockJob[] = [
  {
    jobId: "0xjob001aabbccddeeff00112233445566778899aabb",
    datasetRoot: "0x7a3f9c2b1e8d4a6f5c0b3e2d1a9f8c7b6e5d4a3f",
    datasetLabel: "BioMed Research Corpus v2",
    requester: ME,
    provider: "0xprov1",
    providerId: "DataNode Labs",
    purposeId: "0xabc4",
    purposeLabel: "BIOMEDICAL",
    requestedEpochs: 10,
    actualEpochs: 10,
    escrow: "500",
    settledAmount: "500",
    refundAmount: null,
    resultHash: "0xres1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
    attestationRef: "0xatt1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
    state: "Completed",
    createdAt: "2026-04-20T09:12:00Z",
    updatedAt: "2026-04-20T11:47:00Z",
    events: [
      { topic: "AccessRequested", txHash: "0xtx001aa", blockNumber: 1048201, timestamp: "2026-04-20T09:12:00Z", args: { jobId: "0xjob001...", requester: ME, epochs: "10" } },
      { topic: "AccessGranted", txHash: "0xtx001bb", blockNumber: 1048209, timestamp: "2026-04-20T09:13:24Z", args: { jobId: "0xjob001...", escrow: "500 USDC" } },
      { topic: "JobStarted", txHash: "0xtx001cc", blockNumber: 1048230, timestamp: "2026-04-20T09:16:08Z", args: { jobId: "0xjob001...", provider: "0xprov1" } },
      { topic: "JobCompleted", txHash: "0xtx001dd", blockNumber: 1049812, timestamp: "2026-04-20T11:45:30Z", args: { jobId: "0xjob001...", actualEpochs: "10" } },
      { topic: "RoyaltySettled", txHash: "0xtx001ee", blockNumber: 1049820, timestamp: "2026-04-20T11:47:00Z", args: { jobId: "0xjob001...", amount: "500 USDC" } },
    ],
  },
  {
    jobId: "0xjob002bbccddeeff0011223344556677889900aabb",
    datasetRoot: "0x7a3f9c2b1e8d4a6f5c0b3e2d1a9f8c7b6e5d4a3f",
    datasetLabel: "BioMed Research Corpus v2",
    requester: ME,
    provider: "0xprov2",
    providerId: "SecureCompute",
    purposeId: "0xabc1",
    purposeLabel: "NEURAL_RESEARCH",
    requestedEpochs: 15,
    actualEpochs: null,
    escrow: "750",
    settledAmount: null,
    refundAmount: null,
    resultHash: null,
    attestationRef: null,
    state: "Running",
    createdAt: "2026-04-22T14:30:00Z",
    updatedAt: "2026-04-22T14:52:00Z",
    events: [
      { topic: "AccessRequested", txHash: "0xtx002aa", blockNumber: 1051100, timestamp: "2026-04-22T14:30:00Z", args: { jobId: "0xjob002...", requester: ME, epochs: "15" } },
      { topic: "AccessGranted", txHash: "0xtx002bb", blockNumber: 1051108, timestamp: "2026-04-22T14:31:10Z", args: { jobId: "0xjob002...", escrow: "750 USDC" } },
      { topic: "JobStarted", txHash: "0xtx002cc", blockNumber: 1051140, timestamp: "2026-04-22T14:35:44Z", args: { jobId: "0xjob002...", provider: "0xprov2" } },
    ],
  },
  {
    jobId: "0xjob003ccddeeff001122334455667788990011aabb",
    datasetRoot: "0x3e1a7f9c5b2d8e4a6f0c3b5d2e9a1f8c7b6e4d3a",
    datasetLabel: "Climate Sensor Dataset 2024",
    requester: ME,
    provider: "0xprov1",
    providerId: "DataNode Labs",
    purposeId: "0xabc5",
    purposeLabel: "CLIMATE_SCIENCE",
    requestedEpochs: 8,
    actualEpochs: null,
    escrow: "240",
    settledAmount: null,
    refundAmount: null,
    resultHash: null,
    attestationRef: null,
    state: "Granted",
    createdAt: "2026-04-23T08:10:00Z",
    updatedAt: "2026-04-23T08:11:30Z",
    events: [
      { topic: "AccessRequested", txHash: "0xtx003aa", blockNumber: 1052400, timestamp: "2026-04-23T08:10:00Z", args: { jobId: "0xjob003...", requester: ME, epochs: "8" } },
      { topic: "AccessGranted", txHash: "0xtx003bb", blockNumber: 1052407, timestamp: "2026-04-23T08:11:30Z", args: { jobId: "0xjob003...", escrow: "240 USDC" } },
    ],
  },
  {
    jobId: "0xjob004ddeeff0011223344556677889900112233",
    datasetRoot: "0xc8a4f2e9b6d1a3f7e5c0b8d4a2f9e6c3b1a7f5e4",
    datasetLabel: "Multilingual NLP Corpus",
    requester: ME,
    provider: "0xprov1",
    providerId: "DataNode Labs",
    purposeId: "0xabc2",
    purposeLabel: "ACADEMIC",
    requestedEpochs: 12,
    actualEpochs: 7,
    escrow: "960",
    settledAmount: "560",
    refundAmount: "400",
    resultHash: null,
    attestationRef: null,
    state: "Refunded",
    createdAt: "2026-04-18T11:00:00Z",
    updatedAt: "2026-04-18T16:20:00Z",
    events: [
      { topic: "AccessRequested", txHash: "0xtx004aa", blockNumber: 1044200, timestamp: "2026-04-18T11:00:00Z", args: { jobId: "0xjob004...", requester: ME, epochs: "12" } },
      { topic: "AccessGranted", txHash: "0xtx004bb", blockNumber: 1044209, timestamp: "2026-04-18T11:01:20Z", args: { jobId: "0xjob004...", escrow: "960 USDC" } },
      { topic: "JobStarted", txHash: "0xtx004cc", blockNumber: 1044240, timestamp: "2026-04-18T11:06:00Z", args: { jobId: "0xjob004...", provider: "0xprov1" } },
      { topic: "JobFailed", txHash: "0xtx004dd", blockNumber: 1045900, timestamp: "2026-04-18T13:50:00Z", args: { jobId: "0xjob004...", reasonCode: "COMPUTE_OOM" } },
      { topic: "RefundIssued", txHash: "0xtx004ee", blockNumber: 1046100, timestamp: "2026-04-18T16:20:00Z", args: { jobId: "0xjob004...", amount: "400 USDC" } },
    ],
  },
  {
    jobId: "0xjob005eeff00112233445566778899001122334455",
    datasetRoot: "0xd5e2f9a7c4b1e8d3f6a0c5b2e9d7f4a1c8e5b2d9",
    datasetLabel: "Code Commit History Dataset",
    requester: ME,
    provider: "0xprov2",
    providerId: "SecureCompute",
    purposeId: "0xabc1",
    purposeLabel: "NEURAL_RESEARCH",
    requestedEpochs: 6,
    actualEpochs: null,
    escrow: "360",
    settledAmount: null,
    refundAmount: "360",
    resultHash: null,
    attestationRef: null,
    state: "Refunded",
    createdAt: "2026-04-15T15:20:00Z",
    updatedAt: "2026-04-15T21:10:00Z",
    events: [
      { topic: "AccessRequested", txHash: "0xtx005aa", blockNumber: 1038700, timestamp: "2026-04-15T15:20:00Z", args: { jobId: "0xjob005...", requester: ME, epochs: "6" } },
      { topic: "AccessGranted", txHash: "0xtx005bb", blockNumber: 1038709, timestamp: "2026-04-15T15:21:10Z", args: { jobId: "0xjob005...", escrow: "360 USDC" } },
      { topic: "JobTimedOut", txHash: "0xtx005cc", blockNumber: 1040200, timestamp: "2026-04-15T18:45:00Z", args: { jobId: "0xjob005...", reason: "TTL_EXCEEDED" } },
      { topic: "RefundIssued", txHash: "0xtx005dd", blockNumber: 1040510, timestamp: "2026-04-15T21:10:00Z", args: { jobId: "0xjob005...", amount: "360 USDC" } },
    ],
  },
];

export const MOCK_PROVIDERS = [
  { id: "0xprov1", label: "DataNode Labs" },
  { id: "0xprov2", label: "SecureCompute" },
  { id: "0xprov3", label: "ZeroTrust Compute" },
];

export const MOCK_WALLET = {
  address: ME,
  lUsdBalance: "9,250",
  escrowLocked: "990",
};

export function truncHash(hash: string, front = 6, back = 4): string {
  if (!hash || hash.length <= front + back + 3) return hash;
  return `${hash.slice(0, front)}…${hash.slice(-back)}`;
}
