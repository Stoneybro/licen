/**
 * ECIES Key Exchange — Orchestrator-side unsealing
 *
 * This is the server-side counterpart to the browser's sealKeyEnvelope() call.
 * It runs inside the orchestrator process, which holds the ORCHESTRATOR_PRIVATE_KEY.
 *
 * Security invariants:
 *  - ORCHESTRATOR_PRIVATE_KEY never leaves this process.
 *  - The decrypted AES key is held in memory only for the duration of the
 *    0G Compute dispatch call, then zeroed.
 *  - This function is only called after verifying that the on-chain job state
 *    is Granted (2) or Running (3) via the DataPolicy contract.
 *
 * Encryption scheme (must match apps/web/src/lib/key-exchange/ecies.ts):
 *   Ephemeral secp256k1 ECDH → HKDF-SHA256 → AES-256-GCM
 *   Envelope: [33 bytes ephemeral pubkey][12 bytes IV][16 bytes GCM tag][N bytes ciphertext]
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — resolved via pnpm node_modules symlink
import { secp256k1 } from "@noble/curves/secp256k1";
// @ts-ignore
import { hkdf } from "@noble/hashes/hkdf";
// @ts-ignore
import { sha256 } from "@noble/hashes/sha256";
import { createDecipheriv } from "node:crypto";
// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
function getPrivateKeyHex() {
    const hex = process.env["ORCHESTRATOR_PRIVATE_KEY"];
    if (!hex) {
        throw new Error("[orchestrator/keyExchange] Missing env: ORCHESTRATOR_PRIVATE_KEY");
    }
    return hex.replace(/^0x/, "");
}
function hexToBytes(hex) {
    const clean = hex.replace(/^0x/, "");
    const arr = new Uint8Array(clean.length / 2);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
}
/**
 * Unseal an ECIES key envelope produced by the publisher's browser
 * (via /api/lit/seal-key) and recover the dataset AES key + IV.
 *
 * Envelope format (must match ecies.ts in apps/web):
 *   [  0.. 32] ephemeral compressed pubkey (33 bytes)
 *   [ 33.. 44] AES-GCM IV (12 bytes)
 *   [ 45.. 60] AES-GCM auth tag (16 bytes)
 *   [ 61..  N] ciphertext
 *
 * Plaintext layout:
 *   [  0.. 31] AES-256 dataset key (32 bytes)
 *   [ 32.. 43] AES-GCM IV used for dataset file encryption (12 bytes)
 *
 * @param envelopeHex  Hex string of the ECIES ciphertext envelope
 * @returns            UnsealedKey — call .zero() immediately after use
 */
export function unsealDatasetKey(envelopeHex) {
    const envelope = hexToBytes(envelopeHex);
    if (envelope.length < 33 + 12 + 16 + 1) {
        throw new Error(`[orchestrator/keyExchange] Envelope too short: ${envelope.length} bytes`);
    }
    // Unpack envelope
    const ephemeralPubKey = envelope.subarray(0, 33);
    const gcmIv = envelope.subarray(33, 45);
    const authTag = envelope.subarray(45, 61);
    const ciphertext = envelope.subarray(61);
    // ECDH: shared secret using our private key + ephemeral public key
    const privKeyBytes = hexToBytes(getPrivateKeyHex());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sharedPoint = secp256k1.getSharedSecret(privKeyBytes, ephemeralPubKey);
    const sharedSecret = sharedPoint.slice(1, 33); // x-coordinate only
    // Derive symmetric key via HKDF-SHA256
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const symmetricKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);
    // AES-256-GCM decrypt — use NodeJS.ArrayBufferView-compatible Uint8Array
    const decipher = createDecipheriv("aes-256-gcm", symmetricKey, gcmIv);
    decipher.setAuthTag(authTag);
    const dec1 = decipher.update(ciphertext);
    const dec2 = decipher.final();
    // Concatenate decrypted chunks into a single Uint8Array
    const plaintext = new Uint8Array(dec1.length + dec2.length);
    plaintext.set(dec1, 0);
    plaintext.set(dec2, dec1.length);
    // Unpack plaintext: [0..31] = AES key, [32..43] = file IV
    const aesKey = plaintext.slice(0, 32);
    const iv = plaintext.slice(32, 44);
    // Zero intermediates
    plaintext.fill(0);
    symmetricKey.fill(0);
    return {
        aesKey,
        iv,
        zero() {
            aesKey.fill(0);
            iv.fill(0);
        },
    };
}
