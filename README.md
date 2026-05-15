# LICEN — Control & Monetize your Datasets

**LICEN lets owners publish encrypted datasets, define how they can be used, and earn royalties whenever approved researchers use the data for AI model training.**

---

## The Problem

AI companies are desperate for high-quality data to train their models, but sourcing it is slow, risky, and legally murky. Independent researchers can't access premium training data at all.

Meanwhile, the people who created that data — academic labs, biomedical institutions, independent creators — see nothing. Their datasets are scraped, repurposed, or locked behind agreements that benefit no one.

**A license is a PDF. LICEN is enforcement.**

---

## How It Works

```
Dataset Owner                          AI Researcher
     │                                       │
     ▼                                       │
Encrypts dataset in browser                  │
Sets policy (price/epoch, caps, purposes)    │
Publishes to 0G Storage                      │
Anchors policy on-chain ──────────────► Browses marketplace
                                             │
                                             ▼
                                    Pays escrow on-chain
                                    (epochs × price per epoch)
                                             │
                          ┌── AccessGranted event ──────────┘
                          ▼
                    Orchestrator picks up the job
                    Unseals AES key (ECIES)
                    Dispatches to 0G Compute (TEE)
                          │
                          ▼
                    Training completes with attestation
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
    Royalty auto-paid         Researcher receives
    to dataset owner          LoRA adapter model
```

---

## What's Live Today

- ✅ **DataPolicy smart contract** — deployed on 0G Newton Testnet (`0x565ab137D5D18B7Aa32783C7D1a8dc29d83687E7`)
- ✅ **Client-side AES-256-GCM encryption** — dataset plaintext never touches LICEN's servers
- ✅ **ECIES key envelope** — AES key sealed for the Orchestrator before upload
- ✅ **0G Storage integration** — encrypted datasets stored with Merkle root identity
- ✅ **Envio HyperIndex** — real-time marketplace data from on-chain events
- ✅ **Orchestrator** — automated key unsealing, 0G Compute dispatch, job tracking
- ✅ **0G Compute fine-tuning pipeline** — full 10-state lifecycle with settlement
- ✅ **Publisher dashboard** — royalty tracking, active sessions, settlement history
- ✅ **Researcher marketplace** — browse datasets, request access, track training jobs

**Roadmap:**
- ⬜ On-chain TEE attestation quote verification (Intel TDX / AMD SEV-SNP)
- ⬜ Lit Protocol integration for decentralised key custody
- ⬜ Mainnet deployment

---

## Why 0G?

Every 0G component is **load-bearing** — not an optional integration.

| 0G Component | Role in LICEN | Why it can't be swapped |
|---|---|---|
| **0G Storage** | Encrypted dataset storage + Merkle root identity | Content-addressed roots are the only way to trustlessly link a contract to a specific file |
| **0G Chain** | DataPolicy enforcement, escrow, settlement | Native to 0G ecosystem; economical for per-epoch micro-payments |
| **0G Compute** | TEE fine-tuning with hardware attestation | Only decentralised compute with TEE fine-tuning at this scale |
| **Envio HyperIndex** | Real-time marketplace + Orchestrator event queue | Orders-of-magnitude faster than raw RPC polling |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, Privy (auth), shadcn/ui |
| Smart Contracts | Solidity (Foundry), deployed on 0G Chain |
| Storage | 0G Storage (`@0gfoundation/0g-ts-sdk`) |
| Indexer | Envio HyperIndex (GraphQL) |
| Orchestrator | Node.js, `@0gfoundation/0g-compute-ts-sdk`, Drizzle ORM |
| Database | Neon PostgreSQL |
| Encryption | AES-256-GCM (browser) + ECIES via `@noble/curves` |

---

## Getting Started

### Prerequisites

- Node.js v18+
- pnpm
- A Privy App ID
- 0G Newton Testnet wallet with gas ([Faucet](https://faucet.0g.ai/))

### Installation

```bash
git clone https://github.com/stoneybros-projects/licen.git
cd licen
pnpm install
```

```bash
# Set up environment
cp apps/web/.env.example apps/web/.env.local
# Fill in: PRIVY_APP_ID, OG_DATA_POLICY_ADDRESS, ORCHESTRATOR_PUBLIC_KEY
```

```bash
# Run the web app
pnpm dev
```

```bash
# Run the orchestrator (separate terminal)
cd packages/orchestrator
cp .env.example .env
# Fill in: ORCHESTRATOR_PRIVATE_KEY, BACKEND_WALLET_PRIVATE_KEY, OG_COMPUTE_PRIVATE_KEY
pnpm dev
```

Open `http://localhost:3000`.

### Full documentation

[licen.xyz/docs →](https://licen.vercel.app/docs)

---

## Project Structure

```
licen/
├── apps/
│   └── web/                    # Next.js app (frontend + API routes + docs)
│       └── content/docs/       # Fumadocs documentation
├── packages/
│   ├── contracts/              # DataPolicy.sol (Foundry)
│   └── orchestrator/           # Background worker (key exchange, compute dispatch)
└── scripts/                    # Deployment utilities
```

---

## Security Model

| Property | Mechanism |
|---|---|
| Dataset stays encrypted until payment | AES key only unsealed after on-chain `Granted` state verified |
| Researcher can't exceed policy | DataPolicy contract rejects policy violations at tx level |
| Royalties are automatic | Smart contract settlement — no invoicing, no trust |
| LICEN servers can't read your data | ECIES means even our web server can't decrypt the AES key |

**Honest limitations (MVP):** The Orchestrator is a centralised key custodian. Upgrade path to Lit Protocol / Threshold Network is documented in [Architecture → Key Exchange](/docs/architecture/key-exchange).

---

## Built for the 0G APAC Hackathon 2026

MIT License
