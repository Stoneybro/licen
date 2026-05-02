export type EncryptDatasetResult = {
  encryptedBlob: Blob;
  encryptedByteLength: number;
  originalByteLength: number;
  ivHex: `0x${string}`;
  keyHex: `0x${string}`;
  fileName: string;
  mimeType: string;
};

export type SealKeyResult = {
  /** ECIES ciphertext envelope — safe to store in 0G Storage metadata */
  encryptedKeyEnvelope: string;
};

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function encryptDatasetFile(file: File): Promise<EncryptDatasetResult> {
  const originalBuffer = await file.arrayBuffer();

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, originalBuffer);

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: "application/octet-stream" }),
    encryptedByteLength: encryptedBytes.byteLength,
    originalByteLength: originalBuffer.byteLength,
    ivHex: bytesToHex(iv),
    keyHex: bytesToHex(rawKey),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  };
}

/**
 * Seal the raw AES key by sending it to the /api/lit/seal-key server route.
 * The server ECIES-encrypts it with the orchestrator's public key.
 *
 * After this call, the raw keyHex should be zeroed / discarded by the caller.
 * Only the returned encryptedKeyEnvelope should be persisted.
 *
 * If NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY is not configured (local dev),
 * this returns a placeholder so the publish flow is not blocked.
 */
export async function sealKeyEnvelope(
  keyHex: string,
  ivHex: string,
  datasetRoot: string,
  publisherAddress: string
): Promise<SealKeyResult> {
  // In local dev without the orchestrator key set, return a dev placeholder
  if (!process.env.NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY) {
    console.warn(
      "[sealKeyEnvelope] NEXT_PUBLIC_ORCHESTRATOR_PUBLIC_KEY not set — using dev placeholder. " +
      "Set this env var for production builds."
    );
    return { encryptedKeyEnvelope: `dev:${keyHex}:${ivHex}` };
  }

  const res = await fetch("/api/lit/seal-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aesKeyHex: keyHex, ivHex, datasetRoot, publisherAddress }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(`seal-key failed (${res.status}): ${err.error ?? JSON.stringify(err)}`);
  }

  return res.json() as Promise<SealKeyResult>;
}
