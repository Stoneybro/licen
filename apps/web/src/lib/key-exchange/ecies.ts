/**
 * ECIES Key Exchange — Server-side utilities (pure JS, no native bindings)
 *
 * Implements ECIES (Elliptic Curve Integrated Encryption Scheme) over
 * secp256k1 using @noble/curves + @noble/hashes. No native dependencies,
 * no hangs, works in Next.js server components and API routes.
 *
 * Encryption scheme:
 *   - Ephemeral secp256k1 keypair per encryption
 *   - Shared secret: ECDH(ephemeral_priv, recipient_pub)
 *   - Symmetric key: HKDF-SHA256(shared_secret)
 *   - Cipher: AES-256-GCM
 *
 * Envelope format (all concatenated, hex-encoded for storage):
 *   [33 bytes compressed ephemeral pubkey][12 bytes AES-GCM IV][16 bytes tag][N bytes ciphertext]
 *
 * NOTE: The route name `/api/lit/seal-key` is intentional — when we upgrade
 * to Lit Protocol or Threshold Network, we swap the implementation of this
 * module without changing any callers.
 *
 * Security invariants:
 *  - ORCHESTRATOR_PRIVATE_KEY is NEVER read client-side (server env only).
 *  - NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY is safe to expose (encrypt only).
 *  - Raw AES keys are zeroed from memory after use.
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getPublicKeyBytes(): Uint8Array {
  const hex = process.env.NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY;
  if (!hex) throw new Error("Missing env: NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY");
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

function getPrivateKeyHex(): string {
  const hex = process.env.ORCHESTRATOR_PRIVATE_KEY;
  if (!hex) throw new Error("Missing env: ORCHESTRATOR_PRIVATE_KEY (server only)");
  return hex.replace(/^0x/, "");
}

// ---------------------------------------------------------------------------
// Core ECIES encrypt / decrypt
// ---------------------------------------------------------------------------

function eciesEncrypt(recipientPubKeyBytes: Uint8Array, plaintext: Uint8Array): Buffer {
  // 1. Ephemeral keypair — v2 uses randomSecretKey (was randomPrivateKey in v1)
  const ephemeralPrivKey = secp256k1.utils.randomSecretKey();
  const ephemeralPubKey = secp256k1.getPublicKey(ephemeralPrivKey, true); // 33 bytes compressed

  // 2. ECDH shared secret
  const sharedPoint = secp256k1.getSharedSecret(ephemeralPrivKey, recipientPubKeyBytes);
  const sharedSecret = sharedPoint.slice(1, 33); // x-coordinate only (32 bytes)

  // 3. Derive symmetric key via HKDF-SHA256
  const symmetricKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);

  // 4. AES-256-GCM encrypt
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", symmetricKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // 5. Envelope: [ephemeral pubkey 33][iv 12][tag 16][ciphertext]
  return Buffer.concat([ephemeralPubKey, iv, authTag, encrypted]);
}

function eciesDecrypt(recipientPrivKeyHex: string, envelope: Uint8Array): Buffer {
  const buf = Buffer.from(envelope);

  // Unpack envelope
  const ephemeralPubKey = buf.subarray(0, 33);
  const iv = buf.subarray(33, 45);
  const authTag = buf.subarray(45, 61);
  const ciphertext = buf.subarray(61);

  // ECDH
  const privKeyBytes = Buffer.from(recipientPrivKeyHex, "hex");
  const sharedPoint = secp256k1.getSharedSecret(privKeyBytes, ephemeralPubKey);
  const sharedSecret = sharedPoint.slice(1, 33);

  // Derive key
  const symmetricKey = hkdf(sha256, sharedSecret, undefined, undefined, 32);

  // AES-256-GCM decrypt
  const decipher = createDecipheriv("aes-256-gcm", symmetricKey, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seal an AES key using the orchestrator's ECIES public key.
 * Call this server-side (API route) so the raw AES key never lingers in logs.
 *
 * @param aesKeyHex  Hex string of the 32-byte AES key (with or without 0x prefix)
 * @param ivHex      Hex string of the 12-byte IV (with or without 0x prefix)
 * @returns          Hex-encoded ECIES ciphertext envelope
 */
export function sealAesKey(aesKeyHex: string, ivHex: string): string {
  const aesKeyBytes = Buffer.from(aesKeyHex.replace(/^0x/, ""), "hex");
  const ivBytes = Buffer.from(ivHex.replace(/^0x/, ""), "hex");

  // Pack as: [32 bytes AES key][12 bytes IV] = 44 bytes total plaintext
  const plaintext = Buffer.concat([aesKeyBytes, ivBytes]);
  const pubKeyBytes = getPublicKeyBytes();

  const envelope = eciesEncrypt(pubKeyBytes, plaintext);
  const envelopeHex = envelope.toString("hex");

  // Zero sensitive bytes
  plaintext.fill(0);
  aesKeyBytes.fill(0);
  ivBytes.fill(0);

  return envelopeHex;
}

/**
 * Unseal an ECIES envelope and recover the AES key + IV.
 * Call this server-side only (Orchestrator), never in the browser.
 *
 * @param envelopeHex  Hex-encoded ECIES ciphertext (from sealAesKey)
 * @returns            { aesKey: Buffer, iv: Buffer } — caller MUST zero after use
 */
export function unsealAesKey(envelopeHex: string): { aesKey: Buffer; iv: Buffer } {
  const envelope = Buffer.from(envelopeHex.replace(/^0x/, ""), "hex");
  const plaintext = eciesDecrypt(getPrivateKeyHex(), envelope);

  // Unpack: [0..31] = AES key, [32..43] = IV
  const aesKey = Buffer.from(plaintext.subarray(0, 32));
  const iv = Buffer.from(plaintext.subarray(32, 44));
  plaintext.fill(0);

  return { aesKey, iv };
}

/**
 * Generate a new secp256k1 keypair for use as the orchestrator key.
 * Run once via: node -e "const e = require('./path/to/ecies'); e.generateOrchestratorKeypair()"
 * Store results in .env.local/.env (never commit the private key).
 */
export function generateOrchestratorKeypair(): void {
  const privKeyBytes = secp256k1.utils.randomSecretKey();
  const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, true); // compressed
  console.log("# Add these to your .env.local:");
  console.log("ORCHESTRATOR_PRIVATE_KEY=" + Buffer.from(privKeyBytes).toString("hex"));
  console.log("NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY=" + Buffer.from(pubKeyBytes).toString("hex"));
}
