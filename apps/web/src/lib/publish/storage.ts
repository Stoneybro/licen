import "server-only";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  type PublicPolicyManifest,
  type PublishManifestUploadRequest,
  type PublishManifestUploadResponse,
  validatePublicPolicyManifest,
} from "@/lib/publish/contracts";

function requireEnv(name: string): string {
  const value = process.env[name] || process.env[`NEXT_PUBLIC_${name}`];
  if (!value) throw new Error(`Missing required env var: ${name} (or NEXT_PUBLIC_${name})`);
  return value;
}

export async function uploadBytesToOgStorage(bytes: Uint8Array): Promise<string> {
  const rpcUrl = requireEnv("OG_EVM_RPC_URL");
  const indexerUrl = requireEnv("OG_STORAGE_INDEXER_URL");
  const privateKey = requireEnv("OG_STORAGE_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(indexerUrl);

  const memData = new MemData(bytes);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`0G Merkle tree error: ${treeErr}`);

  const rootHash = tree!.rootHash();
  if (rootHash === null) throw new Error("0G Merkle tree returned a null root hash");

  const [, uploadErr] = await indexer.upload(memData, rpcUrl, signer, { finalityRequired: false });
  if (uploadErr !== null) throw new Error(`0G storage upload error: ${uploadErr}`);

  return rootHash;
}

export async function uploadManifestToOgStorage(
  payload: PublishManifestUploadRequest
): Promise<PublishManifestUploadResponse> {
  const bytes = new TextEncoder().encode(payload.manifestJson);
  const rootHash = await uploadBytesToOgStorage(bytes);

  return {
    manifestUri: rootHash,
    manifestHash: payload.manifestHash,
    storedAt: new Date().toISOString(),
  };
}

export async function downloadManifestFromOgStorage(manifestUri: string): Promise<PublicPolicyManifest> {
  const indexerUrl = requireEnv("OG_STORAGE_INDEXER_URL");
  const indexer = new Indexer(indexerUrl);
  const tmpPath = path.join(os.tmpdir(), `licen-manifest-${manifestUri.replace(/^0x/, "")}.json`);

  try {
    const downloadErr = await indexer.download(manifestUri, tmpPath, false);
    if (downloadErr !== null) {
      throw new Error(`0G storage download error: ${downloadErr}`);
    }

    const manifestJson = await fs.readFile(tmpPath, "utf8");
    const parsed = JSON.parse(manifestJson);
    const validated = validatePublicPolicyManifest(parsed);

    if (!validated.ok) {
      throw new Error(`Stored manifest failed validation: ${validated.errors.join(", ")}`);
    }

    return validated.data;
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}
