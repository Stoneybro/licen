import type {
  PublishStatusResponse,
  PublishSubmitRequest,
} from "@/lib/publish/contracts";

const publishRequestStore = new Map<string, { payload: PublishSubmitRequest; record: PublishStatusResponse }>();

export function savePublishRequest(requestId: string, payload: PublishSubmitRequest): PublishStatusResponse {
  const now = new Date().toISOString();

  const record: PublishStatusResponse = {
    requestId,
    status: "queued",
    submittedAt: now,
    lastUpdatedAt: now,
    txHash: payload.txHash,
  };

  publishRequestStore.set(requestId, {
    payload,
    record,
  });

  return record;
}

export function getPublishRequestStatus(requestId: string): PublishStatusResponse | null {
  const stored = publishRequestStore.get(requestId);

  if (!stored) {
    return null;
  }

  return stored.record;
}

export function updatePublishRequestStatus(requestId: string, status: PublishStatusResponse): void {
  const stored = publishRequestStore.get(requestId);
  if (!stored) {
    return;
  }

  publishRequestStore.set(requestId, {
    payload: stored.payload,
    record: status,
  });
}
