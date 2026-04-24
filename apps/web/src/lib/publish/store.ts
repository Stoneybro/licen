import type {
  PublishManifestUploadRequest,
  PublishManifestUploadResponse,
  PublishStatusResponse,
  PublishSubmitRequest,
} from "@/lib/publish/contracts";

const publishRequestStore = new Map<string, { payload: PublishSubmitRequest; record: PublishStatusResponse }>();
const manifestStore = new Map<string, { payload: PublishManifestUploadRequest; response: PublishManifestUploadResponse }>();

export function savePublishRequest(requestId: string, payload: PublishSubmitRequest): PublishStatusResponse {
  const now = new Date().toISOString();

  const record: PublishStatusResponse = {
    requestId,
    status: "queued",
    submittedAt: now,
    lastUpdatedAt: now,
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

  const queuedAt = new Date(stored.record.submittedAt).getTime();
  const elapsedMs = Date.now() - queuedAt;

  if (elapsedMs < 1000) {
    return stored.record;
  }

  if (elapsedMs < 3000) {
    const updated: PublishStatusResponse = {
      ...stored.record,
      status: "validating",
      lastUpdatedAt: new Date().toISOString(),
    };
    stored.record = updated;
    publishRequestStore.set(requestId, stored);
    return updated;
  }

  const accepted: PublishStatusResponse = {
    ...stored.record,
    status: "accepted",
    txHash: "0xmock_publish_tx_pending_chain_integration",
    lastUpdatedAt: new Date().toISOString(),
  };
  stored.record = accepted;
  publishRequestStore.set(requestId, stored);

  return accepted;
}

export function saveManifestUpload(payload: PublishManifestUploadRequest): PublishManifestUploadResponse {
  const manifestUri = `zg://manifest/${payload.manifestHash.slice(2, 18)}`;
  const response: PublishManifestUploadResponse = {
    manifestUri,
    manifestHash: payload.manifestHash,
    storedAt: new Date().toISOString(),
  };

  manifestStore.set(manifestUri, { payload, response });
  return response;
}
