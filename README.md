# LICEN: Control & Monetize your Datasets

**LICEN** is a decentralized data licensing platform built for the AI era. It empowers data owners to securely publish their datasets, define strict usage rules, and earn royalties whenever approved researchers use their data to train AI models.

## ⚠️ The Problem

AI companies are desperate for high-quality data to train their models, but sourcing it is slow, risky, and often a legal gray area. On the flip side, data owners (researchers, creators, enterprises) hesitate to share their work because they lose all control the moment it leaves their hands. There is no reliable way to enforce usage limits, restrict access, or guarantee payment. 

This trust gap is slowing down AI development and leaving valuable data unused.

## 💡 The Solution

LICEN fixes this by enforcing how data is accessed, where it is used, and how revenue is shared through programmable, auditable policies. 

### Key Benefits

1. **Bank-Grade Security**: Your files are encrypted securely before they even leave your computer. Nobody can see your raw data, not even us.
2. **Ironclad Usage Rules**: You decide the rules of the game. Restrict who uses your data, set epoch limits, and choose specific academic or commercial purposes.
3. **Guaranteed Payouts**: Royalties are enforced automatically by smart contracts. When a researcher trains an AI on your data, you get paid.
4. **Verifiable Transparency**: Track exactly who is using your data and when. Every action leaves an undeniable, verifiable record on-chain.

---

## 🛠️ Technical Architecture

While the user experience is kept incredibly simple, LICEN is powered by a robust, secure, and decentralized technical stack:

- **0G Storage (Secure Vault)**: Encrypted datasets and policy manifests are stored securely off-chain. Only authorized jobs can decrypt the files. Merkle roots provide deterministic references for contract-level enforcement.
- **0G Chain (The Ledger)**: The `DataPolicy` smart contracts run on an EVM-compatible chain. They handle access checks, escrow state, and royalty settlement events to guarantee trustless execution.
- **0G Compute (Execution Layer)**: Licensed training jobs execute through compute providers with verification and result workflows integrated into wrapper-driven orchestration.
- **Privy**: Seamless wallet authentication and transaction signing without requiring users to navigate complex wallet setups.
- **Next.js**: A lightning-fast, highly responsive frontend built with React.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- pnpm
- A Privy App ID
- Access to 0G Testnet

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/licen.git
   cd licen
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up your environment variables:
   Create a `.env` file in `apps/web` based on the `.env.example`. Make sure to include your Privy App ID and 0G Testnet configurations.

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open your browser to `http://localhost:3000` to see the application.

---

## 📄 License

MIT License. See `LICENSE` for more information.
