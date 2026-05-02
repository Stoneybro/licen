/**
 * GET /api/orchestrator/key-envelope?datasetRoot=0x...
 *
 * Internal endpoint for the orchestrator to fetch the ECIES-encrypted
 * AES key envelope for a given dataset.
 *
 * Security:
 * - This route is NOT public. In production, protect it with:
 *   a) Network-level firewall (only orchestrator's IP can reach it), OR
 *   b) A shared secret header: Authorization: Bearer <ORCHESTRATOR_SECRET>
 *
 * MVP: The envelope is retrieved from the in-memory publish request store.
 * Production: Query a persistent database instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKeyEnvelopeByDatasetRoot } from "@/lib/publish/store";

export async function GET(req: NextRequest) {
  // ── Auth guard (MVP: shared secret header) ─────────────────────────────────
  const secret = process.env.ORCHESTRATOR_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const datasetRoot = req.nextUrl.searchParams.get("datasetRoot");
  if (!datasetRoot) {
    return NextResponse.json(
      { error: "Missing required query param: datasetRoot" },
      { status: 400 }
    );
  }

  const envelope = getKeyEnvelopeByDatasetRoot(datasetRoot);
  if (!envelope) {
    return NextResponse.json(
      { error: "Key envelope not found for this dataset" },
      { status: 404 }
    );
  }

  return NextResponse.json({ encryptedKeyEnvelope: envelope });
}
