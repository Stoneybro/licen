#LICEN


A decentralized protocol for programmable AI data licensing where datasets carry their own executable usage policies.

Users upload encrypted datasets and attach an on chain data policy that defines how the data can be used such as allowed research domains, licensing restrictions, and royalties per training run. Instead of relying on manual access permissions, the dataset itself enforces its terms through a smart contract.

When researchers train models using the dataset through integrated compute environments, the policy contract is triggered to automatically distribute royalties to the original data owner.

The system enables autonomous data assets where datasets retain control over their usage and continuously generate value as they contribute to AI model training.
Everything i would be using is within og ecosystem og storage for storing the dataset and og compute for a controlled environment for training with datasets.


---

## Architecture Overview

The project has four distinct components that map directly to 0G primitives:

1. **Dataset Upload** → 0G Storage
2. **Policy Enforcement** → Smart contract on 0G Chain
3. **Training Job** → 0G Compute (fine-tuning)
4. **Royalty Trigger** → Smart contract settlement

Here's how each layer works in practice.

---

## Step 1: Encrypt & Upload the Dataset to 0G Storage

The TypeScript SDK gives you `ZgFile` and `Indexer` — you call `merkleTree()` on the file before upload, and the returned Merkle root is your permanent content identifier on-chain. That root hash becomes the canonical reference your policy contract uses to identify the dataset.

Before uploading, you encrypt the dataset client-side with a symmetric key (AES-256). The encrypted blob goes to 0G Storage. The decryption key is held by the policy contract and only released under the conditions it defines. The flow is:

```
encryptedDataset → ZgFile.fromFilePath() → merkleTree() → indexer.upload()
// returns: rootHash (your dataset's on-chain identity)
```

0G Storage's KV layer is relevant here too — you can store structured metadata like policy parameters, allowed research domains, and royalty rates as mutable key-value pairs sitting on top of the immutable log layer, queryable with millisecond-level performance.

---

## Step 2: Deploy the DataPolicy Smart Contract on 0G Chain

0G Chain is EVM-compatible, so you deploy using standard Hardhat or Foundry tooling — the same workflow as Ethereum, no migration needed.

The contract stores:
- The dataset's Merkle root (the identifier from Step 1)
- The owner's address
- Policy terms: allowed domains, royalty amount per training run, expiry conditions
- The encrypted decryption key

The core logic is a `requestAccess(bytes32 datasetRoot, string domain, uint256 epochs)` function that:
1. Validates the caller is an approved compute provider
2. Checks the domain against the allowlist
3. Calculates cost (`royaltyPerEpoch * epochs`)
4. Holds payment in escrow
5. Emits a `DatasetAccessGranted` event with a one-time key release

```solidity
function requestAccess(bytes32 _root, string calldata _domain, uint256 _epochs) 
    external payable {
    require(allowedDomains[_domain], "Domain not permitted");
    require(msg.value >= royaltyPerEpoch * _epochs, "Insufficient payment");
    emit DatasetAccessGranted(msg.sender, _root, _epochs);
    // escrow held until compute node confirms completion
}
```

---

## Step 3: Training via 0G Compute

This is where it gets interesting. 0G Compute currently supports inference and fine-tuning live on the network, with full model training marked as coming soon. The compute network uses TEE (Trusted Execution Environment) for secure processing with cryptographic signatures on all results — you can't fake or manipulate outputs.

For the hackathon scope, you'd use the **fine-tuning** path. The compute flow is:

Funds are deposited to a main account, then transferred to a provider sub-account. The provider deducts from that sub-account for services rendered, and there's on-chain verification for all transactions ensuring transparency.

The training wrapper you build sits between the researcher and the compute network. It:
1. Receives the researcher's training request and payment
2. Calls `requestAccess()` on the policy contract
3. Retrieves the decryption key from the contract (only released post-payment)
4. Decrypts the dataset ephemerally inside the compute environment
5. Submits the fine-tuning job to 0G Compute via the CLI/SDK
6. On completion, calls `confirmTrainingComplete()` on the contract

```
researcher → DataPolicyContract.requestAccess() [pay royalty]
           → contract releases decryption key
           → wrapper decrypts dataset in memory
           → 0g-compute-cli fine-tune --dataset <decrypted> --model <base>
           → on completion: contract.settleRoyalty() → owner.transfer()
```

---

## Step 4: The INFT Angle (bonus, but powerful)

Here's a layer that would genuinely impress judges: INFTs (ERC-7857) support authorized usage — granting usage rights without ownership transfer — and the integration guide shows a `createSubscription` pattern where a subscriber gets time-limited permissions with specific allowed operations.

You could wrap each dataset as an INFT instead of a plain contract. This gives you:
- Transferable dataset ownership (sell your dataset IP)
- The clone function for creating derivative licensed versions
- Built-in royalty mechanics on transfer

0G Storage handles the encrypted metadata, 0G DA handles transfer proof verification, and 0G Chain executes the smart contract — so the full INFT stack is already wired for exactly this use case.

---

## The Critical Enforcement Gap & How to Handle It

The honest technical problem: what stops a researcher from downloading the dataset and training outside the system? Your answer for the hackathon is this:

**The dataset is never decrypted outside the compute environment.** The policy contract releases the decryption key only as an ephemeral session key scoped to a specific compute job ID. The TEE inside 0G Compute processes it in a sealed enclave. TEE processing means no data retention by providers and verifiable computation proofs — you can prove the work was done correctly without exposing the data.

This is defensible for a hackathon. For production you'd want ZK proofs of training over the dataset, which is a much bigger lift.

---

## Implementation Order for the Hackathon

Start here, in this sequence:

1. Deploy a `DataPolicy` contract on 0G testnet (testnet RPC is `https://evmrpc-testnet.0g.ai` and you can get up to 0.1 0G tokens/day from the faucet)
2. Upload a small encrypted dataset using the TypeScript SDK, store the root hash in the contract
3. Build the access request flow with escrow and key release
4. Wrap a fine-tuning job through 0G Compute that reads the released key
5. Show royalty settling on-chain after job completion
6. Build a minimal UI showing the full lifecycle

That end-to-end demo — even on a toy 50MB dataset — is what wins it.