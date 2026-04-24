export const PUBLISH_PURPOSES = [
  "NEURAL_RESEARCH",
  "ACADEMIC",
  "COMMERCIAL_R_AND_D",
  "BIOMEDICAL",
  "CLIMATE_SCIENCE",
] as const;

export type PublishPurpose = (typeof PUBLISH_PURPOSES)[number];

export type PublishStatus = "queued" | "validating" | "accepted" | "failed";

export type PublishPolicyConfig = {
  allowedPurposeIds: PublishPurpose[];
  allowedProviderIds: string[];
  royaltyPerEpoch: number;
  maxEpochsPerRun: number;
  escrowCap: number;
  ttlHours: number;
  requireTEE: boolean;
};

export type PublishSubmitRequest = {
  datasetRoot: string;
  manifestHash: string;
  manifestUri: string;
  ownerAddress: string;
  ownerSignature?: string;
  policy: PublishPolicyConfig;
  idempotencyKey?: string;
};

export type PublishSubmitSuccessResponse = {
  requestId: string;
  status: Extract<PublishStatus, "queued" | "validating" | "accepted">;
  submittedAt: string;
};

export type PublishManifestUploadRequest = {
  manifestJson: string;
  manifestHash: string;
  ownerAddress: string;
  ownerSignature: string;
};

export type PublishManifestUploadResponse = {
  manifestUri: string;
  manifestHash: string;
  storedAt: string;
};

export type PublishStatusResponse = {
  requestId: string;
  status: PublishStatus;
  submittedAt: string;
  lastUpdatedAt: string;
  txHash?: string;
  errorMessage?: string;
};

export type ApiErrorResponse = {
  error: {
    code: "INVALID_PAYLOAD" | "NOT_FOUND" | "INTERNAL_ERROR";
    message: string;
    details?: string[];
  };
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export function validatePublishManifestUploadRequest(input: unknown): ValidationResult<PublishManifestUploadRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const errors: string[] = [];

  if (!isNonEmptyString(input.manifestJson)) errors.push("manifestJson is required");
  if (!isHexString(input.manifestHash)) errors.push("manifestHash must be a hex string");
  if (!isHexString(input.ownerAddress)) errors.push("ownerAddress must be a hex string");
  if (!isHexString(input.ownerSignature)) {
    errors.push("ownerSignature must be a hex string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: input as PublishManifestUploadRequest,
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function isPositiveInt(input: unknown): input is number {
  return typeof input === "number" && Number.isInteger(input) && input > 0;
}

function isPositiveNumber(input: unknown): input is number {
  return typeof input === "number" && Number.isFinite(input) && input > 0;
}

function isHexString(input: unknown): input is string {
  return typeof input === "string" && /^0x[0-9a-fA-F]+$/.test(input);
}

function isPurpose(input: unknown): input is PublishPurpose {
  return typeof input === "string" && (PUBLISH_PURPOSES as readonly string[]).includes(input);
}

export function validatePublishSubmitRequest(input: unknown): ValidationResult<PublishSubmitRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const errors: string[] = [];

  if (!isHexString(input.datasetRoot)) errors.push("datasetRoot must be a hex string");
  if (!isHexString(input.manifestHash)) errors.push("manifestHash must be a hex string");
  if (!isNonEmptyString(input.manifestUri)) errors.push("manifestUri is required");
  if (!isHexString(input.ownerAddress)) errors.push("ownerAddress must be a hex string");
  if (input.ownerSignature !== undefined && !isHexString(input.ownerSignature)) {
    errors.push("ownerSignature must be a hex string when provided");
  }

  if (!isRecord(input.policy)) {
    errors.push("policy is required");
  } else {
    const { policy } = input;

    if (!Array.isArray(policy.allowedPurposeIds) || policy.allowedPurposeIds.length === 0) {
      errors.push("policy.allowedPurposeIds must be a non-empty array");
    } else if (!policy.allowedPurposeIds.every(isPurpose)) {
      errors.push("policy.allowedPurposeIds contains unsupported values");
    }

    if (!Array.isArray(policy.allowedProviderIds) || policy.allowedProviderIds.length === 0) {
      errors.push("policy.allowedProviderIds must be a non-empty array");
    } else if (!policy.allowedProviderIds.every(isNonEmptyString)) {
      errors.push("policy.allowedProviderIds contains invalid provider IDs");
    }

    if (!isPositiveNumber(policy.royaltyPerEpoch)) {
      errors.push("policy.royaltyPerEpoch must be a positive number");
    }

    if (!isPositiveInt(policy.maxEpochsPerRun)) {
      errors.push("policy.maxEpochsPerRun must be a positive integer");
    }

    if (!isPositiveNumber(policy.escrowCap)) {
      errors.push("policy.escrowCap must be a positive number");
    }

    if (!isPositiveInt(policy.ttlHours)) {
      errors.push("policy.ttlHours must be a positive integer");
    }

    if (typeof policy.requireTEE !== "boolean") {
      errors.push("policy.requireTEE must be a boolean");
    }
  }

  if (input.idempotencyKey !== undefined && !isNonEmptyString(input.idempotencyKey)) {
    errors.push("idempotencyKey must be a non-empty string when provided");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: input as PublishSubmitRequest,
  };
}

export function createRequestId(prefix = "pubreq"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
