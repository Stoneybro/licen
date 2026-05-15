<div align="center">
  <img src="./apps/web/public/licen-image.png" alt="LICEN Logo" height="150" />
    <h2>LICEN</h2>
  <p><b>Control & Monetize your Datasets on the 0G Network</b></p>

  <a href="https://scan-testnet.0g.ai"><img src="https://img.shields.io/badge/Network-0G%20Newton%20Testnet-blue?style=for-the-badge&logo=web3" alt="0G Network" /></a>
  <a href="https://licen.vercel.app/docs"><img src="https://img.shields.io/badge/Docs-Live-green?style=for-the-badge&logo=vercel" alt="Docs" /></a>
  <img src="https://img.shields.io/badge/Status-Hackathon_Ready-orange?style=for-the-badge" alt="Status" />
</div>

<br/>

**LICEN lets owners publish encrypted datasets, define how they can be used, and earn royalties whenever approved researchers use the data for AI model training.**

---

## 🚨 The Problem

AI companies are desperate for high-quality data to train their models, but sourcing it is slow, risky, and legally murky. Independent researchers can't access premium training data at all without expensive enterprise agreements.

Meanwhile, the people who actually created that data — academic labs, biomedical institutions, independent creators — **see absolutely nothing**. Their datasets are scraped without consent, repurposed for commercial models, or locked away behind agreements that benefit no one.

Today's solution is a standard license — a PDF document. **But a license is just a PDF. You can violate a PDF. You cannot violate a smart contract.**

---

## 💡 How It Works (The Protocol)

LICEN is an end-to-end decentralized protocol. It ensures that data owners retain cryptographic control of their data until a smart contract confirms they have been paid.

### A Two-Sided Platform for Data Creators and AI Researchers

**1. The Creator Secures Their Data**
A data creator (like a doctor with a medical dataset) uploads their file to LICEN. Before the file even leaves their computer, it is completely encrypted. Our servers never see the raw data, preventing any accidental leaks or scraping.

**2. The Creator Sets the Rules**
The creator decides the terms: *What purposes are allowed? How much does it cost per training run?* These rules are written into a smart contract on the blockchain. Once set, they cannot be broken, bypassed, or negotiated around by anyone.

**3. The AI Researcher Pays for Access**
An AI researcher looking for medical data browses the LICEN marketplace. They find the dataset, see the price, and pay upfront for the exact amount of training they want to do. The smart contract locks this money safely in escrow.

**4. The Model is Trained Securely**
As soon as the payment clears, LICEN automatically dispatches the training job to a secure, hardware-isolated computer network. The dataset is temporarily unlocked *only* inside this secure environment to train the AI model. The researcher never gets to download or steal the raw data itself.

**5. Everyone Gets Paid Automatically**
When the training finishes, the researcher receives their freshly trained AI model. The smart contract instantly releases the payment directly to the data creator's wallet. No invoices. No waiting 30 days. No lawyers.

<details>
<summary><b>Click to view the Data Flow Diagram</b></summary>

```text
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
</details>

---

## 🌐 Why 0G?

Every 0G component used in LICEN is **load-bearing**. We didn't just slap a logo on a Web2 app; this protocol is impossible without the 0G ecosystem.

| 0G Component | Role in LICEN | Why it's absolutely necessary |
| :--- | :--- | :--- |
| <img src="https://img.shields.io/badge/-0G_Storage-black?style=flat-square"/> | **Encrypted dataset storage & Merkle root identity** | S3 URLs can change. 0G Storage provides content-addressed Merkle roots, the *only* way to trustlessly link a smart contract to a specific file permanently. |
| <img src="https://img.shields.io/badge/-0G_Chain-black?style=flat-square"/> | **DataPolicy enforcement, escrow, & settlement** | Native to the 0G ecosystem; economically viable for per-epoch micro-payments and instant settlement. |
| <img src="https://img.shields.io/badge/-0G_Compute-black?style=flat-square"/> | **TEE fine-tuning with hardware attestation** | The only decentralized compute network capable of TEE fine-tuning at scale, providing cryptographic proof that training actually happened. |

*(We also heavily utilize **Envio HyperIndex** for real-time marketplace data, making the UI orders-of-magnitude faster than raw RPC polling.)*

---

## 🚀 What's Live Today

We've built a complete, end-to-end pipeline for the hackathon. 

### ✅ Implemented Features
- [x] **DataPolicy Smart Contract:** Fully deployed and verified on the 0G Newton Testnet (`0x565ab137D5D18B7Aa32783C7D1a8dc29d83687E7`).
- [x] **Client-Side AES Encryption:** Dataset plaintext never touches LICEN's servers.
- [x] **ECIES Key Management:** AES keys are sealed for the Orchestrator before upload.
- [x] **0G Storage Integration:** Encrypted datasets are stored and retrieved using Merkle root identities.
- [x] **Envio HyperIndex:** Live marketplace hydration driven entirely by on-chain events.
- [x] **Orchestrator Worker:** Automated key unsealing, 0G Compute dispatch, and job state tracking.
- [x] **0G Compute Pipeline:** Full 10-state lifecycle from dispatch to settlement.
- [x] **Publisher & Researcher Dashboards:** Real-time royalty tracking, active sessions, and dataset browsing.

### 🗺 Roadmap (Honest Limitations)
- [ ] **On-chain TEE Quote Verification:** Currently storing the 0G task UUID as an attestation reference; upgrading to verify Intel TDX / AMD SEV-SNP quotes directly on-chain.
- [ ] **Decentralized Key Custody:** Upgrading the Orchestrator from a centralized key custodian to a Lit Protocol / Threshold Network integration.
- [ ] **Mainnet Deployment.**

---

## 🛠 Tech Stack

![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

*   **Frontend:** Next.js, Privy (Authentication), shadcn/ui
*   **Smart Contracts:** Solidity (Foundry), deployed on 0G Chain
*   **Storage:** 0G Storage (`@0gfoundation/0g-ts-sdk`)
*   **Indexer:** Envio HyperIndex (GraphQL)
*   **Orchestrator:** Node.js, `@0gfoundation/0g-compute-ts-sdk`, Drizzle ORM
*   **Database:** Neon PostgreSQL
*   **Encryption:** AES-256-GCM (Browser) + ECIES via `@noble/curves`

---

## 💻 Getting Started

### Prerequisites
- Node.js v18+ & pnpm
- A Privy App ID
- 0G Newton Testnet wallet with gas ([0G Faucet](https://faucet.0g.ai/))

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/stoneybros-projects/licen.git
   cd licen
   pnpm install
   ```

2. **Setup the Web App**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # Fill in: PRIVY_APP_ID, OG_DATA_POLICY_ADDRESS, ORCHESTRATOR_PUBLIC_KEY
   cd apps/web && pnpm dev
   ```

3. **Setup the Orchestrator** *(in a separate terminal)*
   ```bash
   cd packages/orchestrator
   cp .env.example .env
   # Fill in: ORCHESTRATOR_PRIVATE_KEY, BACKEND_WALLET_PRIVATE_KEY, OG_COMPUTE_PRIVATE_KEY
   pnpm dev
   ```

4. **Visit the App**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

📚 **[Read the Full Documentation](https://licen.vercel.app/docs)**

---

## 🔒 Security Model

We assume the server is compromised. Our architecture reflects this:

| Security Property | Enforcement Mechanism |
| :--- | :--- |
| **Datasets stay encrypted until payment** | The AES key is only unsealed by the Orchestrator *after* the on-chain `Granted` state is verified. |
| **Policy cannot be bypassed** | The `DataPolicy` smart contract rejects any policy violations (epoch caps, invalid purposes) at the transaction level. |
| **Royalties are guaranteed** | Settlement is executed via smart contract state transitions — absolutely no invoicing or trust required. |
| **Zero-knowledge web backend** | Thanks to ECIES, even our own web servers and databases cannot decrypt the AES keys or access the plaintext data. |

---

<div align="center">
  <p>Built for the <b>0G APAC Hackathon 2026</b> 🚀</p>
  <p>MIT License</p>
</div>
