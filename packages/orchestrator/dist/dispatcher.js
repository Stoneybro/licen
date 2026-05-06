/**
 * Orchestrator — Job Dispatcher
 *
 * Called by the main loop when an AccessGranted job is ready for compute.
 *
 * Responsibilities:
 *  1. Verify on-chain job state is Granted (guard against race conditions).
 *  2. Unseal the AES key using ECIES private key.
 *  3. Download the encrypted dataset from 0G Storage.
 *  4. Decrypt the dataset blob in memory → write to a secure temp file.
 *  5. Re-upload the plaintext JSONL dataset to 0G Storage → get a new root hash.
 *  6. Dispatch to 0G Compute with the plaintext root hash.
 *  7. Register the returned task ID in the job tracker (persisted to DB).
 *  8. Call startJob() on-chain to move state to Running.
 *  9. Zero the AES key from memory and delete temp files.
 *
 * Why download-decrypt-re-upload?
 *  The 0G Compute SDK's createTask() takes only a dataset root hash.
 *  Providers pull the dataset from 0G Storage directly — they have no
 *  mechanism to decrypt an AES-encrypted blob. The plaintext dataset must be
 *  available on 0G Storage for the compute provider to use it.
 *  Track D upgrade path: move to a TEE-native key injection API once 0G
 *  exposes one, eliminating the need to store plaintext on 0G Storage.
 *
 * On any error before dispatch: call markJobFailed() so the researcher is refunded.
 */
import { createPublicClient, createWalletClient, defineChain, http, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createDecipheriv } from "crypto";
import { DATA_POLICY_ABI, JobState } from "./contract.js";
import { unsealDatasetKey } from "./keyExchange.js";
import { createFineTuningTask } from "./computeClient.js";
import { registerJob } from "./jobTracker.js";
// We use require() for 0g-ts-sdk and ethers to handle CJS/ESM interop
const _require = createRequire(import.meta.url);
const { Indexer, ZgFile } = _require("@0gfoundation/0g-ts-sdk");
const { ethers } = _require("ethers");
// ---------------------------------------------------------------------------
// Chain + client setup
// ---------------------------------------------------------------------------
function getOgChain() {
    const rpcUrl = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
    return defineChain({
        id: 16602,
        name: "0G Testnet",
        network: "0g-testnet",
        nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
    });
}
function getClients() {
    const rpcUrl = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
    const backendKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    if (!backendKey)
        throw new Error("Missing env: BACKEND_WALLET_PRIVATE_KEY");
    const chain = getOgChain();
    const account = privateKeyToAccount(backendKey);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });
    return { publicClient, walletClient, account };
}
function getContractAddress() {
    const addr = process.env.OG_DATA_POLICY_ADDRESS;
    if (!addr)
        throw new Error("Missing env: OG_DATA_POLICY_ADDRESS");
    return addr;
}
// ---------------------------------------------------------------------------
// 0G Storage helper
// ---------------------------------------------------------------------------
const OG_INDEXER_RPC = process.env.OG_INDEXER_RPC_URL ?? "https://indexer-storage-testnet-standard.0g.ai";
const OG_EVM_RPC = process.env.OG_EVM_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
/**
 * Download an encrypted dataset blob from 0G Storage.
 * Returns the raw bytes of the encrypted file.
 */
async function downloadFromStorage(rootHash, jobId) {
    const tmpEncrypted = path.join(os.tmpdir(), `licen-enc-${jobId}.bin`);
    const indexer = new Indexer(OG_INDEXER_RPC);
    const err = await indexer.download(rootHash, tmpEncrypted, false);
    if (err !== null) {
        throw new Error(`0G Storage download failed for ${rootHash}: ${err}`);
    }
    const data = fs.readFileSync(tmpEncrypted);
    fs.unlinkSync(tmpEncrypted); // clean up immediately
    return data;
}
/**
 * Decrypt an AES-256-GCM blob.
 * The blob format: [12 bytes IV][16 bytes auth tag][ciphertext...]
 */
function decryptDataset(encryptedBytes, aesKey, iv) {
    // Blob layout from the publisher: raw AES-256-GCM ciphertext with the 16-byte
    // GCM auth tag appended at the end. The IV is carried in the ECIES envelope, not the blob.
    const raw = new Uint8Array(encryptedBytes.buffer, encryptedBytes.byteOffset, encryptedBytes.byteLength);
    const authTag = raw.slice(raw.length - 16);
    const ciphertext = raw.slice(0, raw.length - 16);
    const keyBuf = Buffer.allocUnsafe(aesKey.byteLength);
    keyBuf.set(aesKey);
    const ivBuf = Buffer.allocUnsafe(iv.byteLength);
    ivBuf.set(iv);
    const authTagBuf = Buffer.allocUnsafe(authTag.byteLength);
    authTagBuf.set(authTag);
    const ctBuf = Buffer.allocUnsafe(ciphertext.byteLength);
    ctBuf.set(ciphertext);
    const decipher = createDecipheriv("aes-256-gcm", keyBuf, ivBuf);
    decipher.setAuthTag(authTagBuf);
    const part1 = decipher.update(ctBuf);
    const part2 = decipher.final();
    return Buffer.concat([part1, part2]);
}
/**
 * Upload a plaintext dataset to 0G Storage and return its new root hash.
 * The file is deleted from disk after upload.
 */
async function uploadPlaintextToStorage(plaintext, jobId) {
    const backendKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    if (!backendKey)
        throw new Error("Missing BACKEND_WALLET_PRIVATE_KEY");
    const tmpPlaintext = path.join(os.tmpdir(), `licen-plain-${jobId}.jsonl`);
    fs.writeFileSync(tmpPlaintext, plaintext, { mode: 0o600 }); // owner-read-only
    try {
        const provider = new ethers.JsonRpcProvider(OG_EVM_RPC);
        const signer = new ethers.Wallet(backendKey.startsWith("0x") ? backendKey : `0x${backendKey}`, provider);
        const file = await ZgFile.fromFilePath(tmpPlaintext);
        const [tx, uploadErr] = await (new Indexer(OG_INDEXER_RPC)).upload(file, OG_EVM_RPC, signer);
        await file.close();
        if (uploadErr !== null) {
            throw new Error(`0G Storage upload failed: ${uploadErr}`);
        }
        const rootHash = tx?.rootHash ?? tx;
        if (!rootHash)
            throw new Error("0G Storage upload did not return a root hash");
        console.log(`[dispatcher] Plaintext dataset uploaded → rootHash: ${rootHash}`);
        return rootHash;
    }
    finally {
        // Always delete the plaintext temp file, even on error
        if (fs.existsSync(tmpPlaintext)) {
            fs.unlinkSync(tmpPlaintext);
        }
    }
}
// ---------------------------------------------------------------------------
// Main dispatch function — called per AccessGranted job
// ---------------------------------------------------------------------------
export async function processGrantedJob(job) {
    const { publicClient, walletClient, account } = getClients();
    const contractAddress = getContractAddress();
    console.log(`[dispatcher] Processing job ${job.jobId}`);
    // ── Step 1: Guard — verify on-chain state is Granted ──────────────────────
    const onChainJob = await publicClient.readContract({
        address: contractAddress,
        abi: DATA_POLICY_ABI,
        functionName: "jobs",
        args: [job.jobId],
    });
    const onChainState = Number(onChainJob[7]); // state is slot [7]
    if (onChainState !== JobState.Granted) {
        console.warn(`[dispatcher] Job ${job.jobId} is not in Granted state (got ${onChainState}). Skipping.`);
        return;
    }
    // ── Step 2: Unseal the AES key ─────────────────────────────────────────────
    let unsealedKey;
    try {
        unsealedKey = unsealDatasetKey(job.encryptedKeyEnvelope);
    }
    catch (err) {
        console.error(`[dispatcher] Failed to unseal key for job ${job.jobId}:`, err);
        await markFailed(walletClient, account, contractAddress, job.jobId, "KEY_UNSEAL_FAILED");
        return;
    }
    // ── Steps 3–5: Download encrypted dataset, decrypt, re-upload plaintext ───
    let plaintextRootHash;
    try {
        console.log(`[dispatcher] Downloading encrypted dataset: ${job.datasetCid}`);
        const encryptedBytes = await downloadFromStorage(job.datasetCid, job.jobId);
        console.log(`[dispatcher] Decrypting dataset (${encryptedBytes.length} bytes)`);
        const plaintext = decryptDataset(encryptedBytes, unsealedKey.aesKey, unsealedKey.iv);
        console.log(`[dispatcher] Re-uploading plaintext dataset to 0G Storage`);
        plaintextRootHash = await uploadPlaintextToStorage(plaintext, job.jobId);
    }
    catch (err) {
        console.error(`[dispatcher] Dataset decrypt/re-upload failed for job ${job.jobId}:`, err);
        unsealedKey.zero();
        await markFailed(walletClient, account, contractAddress, job.jobId, "DATASET_DECRYPT_FAILED");
        return;
    }
    finally {
        // ── Step 9: Zero the AES key from memory regardless of outcome ──────────
        unsealedKey.zero();
    }
    // ── Step 6: Dispatch to 0G Compute with the plaintext root hash ───────────
    let taskId;
    let providerAddress;
    try {
        const result = await createFineTuningTask({
            datasetRootHash: plaintextRootHash,
            requestedEpochs: job.requestedEpochs,
        });
        taskId = result.taskId;
        providerAddress = result.providerAddress;
    }
    catch (err) {
        console.error(`[dispatcher] 0G Compute dispatch failed for job ${job.jobId}:`, err);
        await markFailed(walletClient, account, contractAddress, job.jobId, "COMPUTE_DISPATCH_FAILED");
        return;
    }
    // ── Step 7: Register in job tracker (persisted to DB) ─────────────────────
    try {
        await registerJob({
            licenJobId: job.jobId,
            datasetRoot: job.datasetRoot,
            zeroGTaskId: taskId,
            providerAddress,
            requestedEpochs: job.requestedEpochs,
        });
    }
    catch (err) {
        console.error(`[dispatcher] Failed to register job in tracker:`, err);
        // Non-fatal: continue to startJob
    }
    // ── Step 8: Mark job as Running on-chain ──────────────────────────────────
    try {
        const txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: DATA_POLICY_ABI,
            functionName: "startJob",
            args: [job.jobId],
            account,
            chain: null,
        });
        console.log(`[dispatcher] ✅ Job ${job.jobId} started. 0G task: ${taskId} | startJob tx: ${txHash}`);
    }
    catch (err) {
        console.error(`[dispatcher] startJob failed for job ${job.jobId}:`, err);
    }
}
// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function markFailed(walletClient, account, contractAddress, jobId, reason) {
    try {
        await walletClient.writeContract({
            address: contractAddress,
            abi: DATA_POLICY_ABI,
            functionName: "markJobFailed",
            args: [jobId, reason],
            account,
            chain: null,
        });
        console.log(`[dispatcher] Marked job ${jobId} as failed: ${reason}`);
    }
    catch (err) {
        console.error(`[dispatcher] markJobFailed also failed for ${jobId}:`, err);
    }
}
