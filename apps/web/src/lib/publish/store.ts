import type {
  PublicPolicyManifest,
  PublishStatusResponse,
  PublishSubmitRequest,
} from "@/lib/publish/contracts";
import { db } from "@/db/db";
import { publishRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function savePublishRequest(requestId: string, payload: PublishSubmitRequest): Promise<PublishStatusResponse> {
  const now = new Date().toISOString();

  const record: PublishStatusResponse = {
    requestId,
    status: "queued",
    submittedAt: now,
    lastUpdatedAt: now,
    txHash: payload.txHash,
  };

  await db.insert(publishRequests).values({
    requestId,
    datasetRoot: payload.datasetRoot.toLowerCase(),
    encryptedKeyEnvelope: payload.encryptedKeyEnvelope || null,
    payload: payload,
    record: record,
  });

  return record;
}

export async function getPublishRequestStatus(requestId: string): Promise<PublishStatusResponse | null> {
  const stored = await db.query.publishRequests.findFirst({
    where: eq(publishRequests.requestId, requestId),
  });

  if (!stored) {
    return null;
  }

  return stored.record as PublishStatusResponse;
}

export async function updatePublishRequestStatus(requestId: string, status: PublishStatusResponse): Promise<void> {
  await db.update(publishRequests)
    .set({
      record: status,
      updatedAt: new Date(),
    })
    .where(eq(publishRequests.requestId, requestId));
}

/**
 * Look up the ECIES-encrypted key envelope for a dataset.
 * Used by the orchestrator's /api/orchestrator/key-envelope route.
 */
export async function getKeyEnvelopeByDatasetRoot(datasetRoot: string): Promise<string | null> {
  const stored = await db.query.publishRequests.findFirst({
    where: eq(publishRequests.datasetRoot, datasetRoot.toLowerCase()),
    columns: { encryptedKeyEnvelope: true },
  });

  return stored?.encryptedKeyEnvelope || null;
}

export async function getPublishPayloadByDatasetRoot(datasetRoot: string): Promise<PublishSubmitRequest | null> {
  const stored = await db.query.publishRequests.findFirst({
    where: eq(publishRequests.datasetRoot, datasetRoot.toLowerCase()),
    columns: { payload: true },
  });

  return (stored?.payload as PublishSubmitRequest | undefined) ?? null;
}
