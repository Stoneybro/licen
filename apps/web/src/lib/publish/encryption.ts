export type EncryptDatasetResult = {
  encryptedBlob: Blob;
  encryptedByteLength: number;
  originalByteLength: number;
  ivHex: `0x${string}`;
  keyHex: `0x${string}`;
  fileName: string;
  mimeType: string;
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
