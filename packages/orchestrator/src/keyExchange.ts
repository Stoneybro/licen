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
 *
 * Implementation note:
 *   We use Node.js built-in `crypto` for all operations (ECDH via createECDH,
 *   HKDF via hkdfSync, AES-GCM via createDecipheriv) to avoid depending on
 *   @noble/curves which has an incompatible ESM exports map on this Node version.
 */

import { createECDH, createDecipheriv, hkdfSync } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnsealedKey = {
  /** 32-byte AES-256 dataset decryption key */
  aesKey: Uint8Array;
  /** 12-byte IV used to encrypt the dataset file */
  iv: Uint8Array;
  /** Zero all sensitive bytes. MUST be called after dispatching to compute. */
  zero: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

function getPrivateKeyHex(): string {
  const hex = process.env["ORCHESTRATOR_PRIVATE_KEY"];
  if (!hex) {
    throw new Error(
      "[orchestrator/keyExchange] Missing env: ORCHESTRATOR_PRIVATE_KEY"
    );
  }
  return hex.replace(/^0x/, "");
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

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
export function unsealDatasetKey(envelopeHex: string): UnsealedKey {
  const envelope = hexToBytes(envelopeHex);

  if (envelope.length < 33 + 12 + 16 + 1) {
    throw new Error(
      `[orchestrator/keyExchange] Envelope too short: ${envelope.length} bytes`
    );
  }

  // Unpack envelope
  const ephemeralPubKey = envelope.subarray(0, 33);  // compressed secp256k1 point
  const gcmIv           = envelope.subarray(33, 45); // 12-byte IV
  const authTag         = envelope.subarray(45, 61); // 16-byte GCM tag
  const ciphertext      = envelope.subarray(61);

  // ECDH: compute shared secret using our secp256k1 private key + ephemeral public key
  const ecdh = createECDH("prime256v1"); // Note: prime256v1 = NIST P-256
  // For secp256k1, Node's built-in createECDH supports it directly
  const ecdhK1 = createECDH("secp256k1");
  ecdhK1.setPrivateKey(hexToBytes(getPrivateKeyHex()));

  // computeSecret returns the x-coordinate of the shared point (32 bytes)
  const sharedSecret = ecdhK1.computeSecret(ephemeralPubKey);

  // Derive symmetric key via HKDF-SHA256 (Node 15+ built-in)
  const symmetricKey = Buffer.from(
    hkdfSync("sha256", sharedSecret, Buffer.alloc(0), Buffer.alloc(0), 32)
  );

  // AES-256-GCM decrypt
  const decipher = createDecipheriv("aes-256-gcm", symmetricKey, gcmIv);
  decipher.setAuthTag(authTag);

  const dec1 = decipher.update(ciphertext);
  const dec2 = decipher.final();

  // Concatenate decrypted chunks
  const plaintext = Buffer.concat([dec1, dec2]);

  // Unpack plaintext: [0..31] = AES key, [32..43] = file IV
  const aesKey = new Uint8Array(plaintext.subarray(0, 32));
  const iv     = new Uint8Array(plaintext.subarray(32, 44));

  // Zero intermediates immediately
  plaintext.fill(0);
  symmetricKey.fill(0);
  sharedSecret.fill(0);

  return {
    aesKey,
    iv,
    zero() {
      aesKey.fill(0);
      iv.fill(0);
    },
  };
}
