/**
 * POST /api/lit/seal-key
 *
 * Server-side route that wraps the raw AES dataset key in an ECIES envelope
 * using the orchestrator's public key. The raw key never leaves this handler.
 *
 * Route name is intentionally /api/lit/seal-key so that upgrading to
 * Lit Protocol later requires only swapping this implementation, not callers.
 *
 * Request body:
 *   { aesKeyHex: string, ivHex: string, datasetRoot: string, publisherAddress: string }
 *
 * Response:
 *   { encryptedKeyEnvelope: string }  ← ECIES ciphertext hex
 */

import { NextRequest, NextResponse } from "next/server";
import { sealAesKey } from "@/lib/key-exchange/ecies";
import { getOgPublicClient, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";

export async function POST(req: NextRequest) {
  let body: {
    aesKeyHex?: string;
    ivHex?: string;
    datasetRoot?: string;
    publisherAddress?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { aesKeyHex, ivHex, datasetRoot, publisherAddress } = body;

  if (!aesKeyHex || !ivHex || !datasetRoot || !publisherAddress) {
    return NextResponse.json(
      { error: "Missing required fields: aesKeyHex, ivHex, datasetRoot, publisherAddress" },
      { status: 400 }
    );
  }

  // Validate key lengths
  const keyBytes = aesKeyHex.replace(/^0x/, "");
  const ivBytes = ivHex.replace(/^0x/, "");
  if (keyBytes.length !== 64) {
    return NextResponse.json({ error: "aesKeyHex must be 32 bytes (64 hex chars)" }, { status: 400 });
  }
  if (ivBytes.length !== 24) {
    return NextResponse.json({ error: "ivHex must be 12 bytes (24 hex chars)" }, { status: 400 });
  }

  // For registered datasets: verify publisherAddress matches on-chain owner.
  // For new datasets being registered: the policy won't exist yet — skip check.
  try {
    const publicClient = getOgPublicClient();
    const policyAddress = getDataPolicyAddress();

    const policy: any = await publicClient.readContract({
      address: policyAddress,
      abi: DATA_POLICY_ABI,
      functionName: "policies",
      args: [datasetRoot as `0x${string}`],
    }).catch(() => null);

    // policy[0] is the owner address. If it's not zero address, verify it matches.
    const onChainOwner: string | undefined = policy?.[0];
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    if (onChainOwner && onChainOwner !== zeroAddress) {
      if (onChainOwner.toLowerCase() !== publisherAddress.toLowerCase()) {
        return NextResponse.json(
          { error: "publisherAddress does not match dataset owner on-chain" },
          { status: 403 }
        );
      }
    }
    // If policy doesn't exist yet (new dataset), we allow sealing — the
    // publisher is registering for the first time.
  } catch (err) {
    console.error("[seal-key] On-chain owner check failed:", err);
    // Non-fatal — continue with sealing even if the check fails (network issue)
  }

  try {
    const encryptedKeyEnvelope = sealAesKey(aesKeyHex, ivHex);
    return NextResponse.json({ encryptedKeyEnvelope });
  } catch (err: any) {
    console.error("[seal-key] ECIES encryption failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Encryption failed" },
      { status: 500 }
    );
  }
}
