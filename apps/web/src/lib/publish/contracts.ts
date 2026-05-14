export const PENDING_TX_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const PUBLISH_PURPOSES = [
  "NEURAL_RESEARCH",
  "ACADEMIC",
  "COMMERCIAL_R_AND_D",
  "BIOMEDICAL",
  "CLIMATE_SCIENCE",
  "FINANCIAL_MODELING",
  "GENERATIVE_ART",
  "AUTONOMOUS_SYSTEMS",
] as const;

export type PublishPurpose = (typeof PUBLISH_PURPOSES)[number];

export type PublishStatus = "queued" | "validating" | "accepted" | "failed";

export type PublishPolicyConfig = {
  allowedPurposeIds: PublishPurpose[];
  royaltyPerEpoch: number;
  maxEpochsPerRun: number;
  maxRunsPerRequester: number;
  ttlHours: number;
  policyExpiry: number;
  openRequesters: boolean;
  allowedRequesters: string[];
};

export type PublishManifestSummary = Pick<
  PublicPolicyManifest,
  | "title"
  | "description"
  | "createdAt"
  | "ownerAddress"
  | "legalText"
  | "usageTaxonomy"
  | "taskConstraints"
  | "complianceNotes"
  | "attribution"
  | "derivativeRights"
>;

export type PublishSubmitRequest = {
  datasetRoot: string;
  manifestHash: string;
  manifestUri: string;
  txHash: string;
  ownerAddress: string;
  ownerSignature?: string;
  /** ECIES-encrypted AES key envelope — REQUIRED for orchestrator retrieval */
  encryptedKeyEnvelope: string;
  manifestSummary?: PublishManifestSummary;
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
  ownerSignature?: string;
};

export type PublishManifestUploadResponse = {
  manifestUri: string;
  manifestHash: string;
  storedAt: string;
};

export type PublicPolicyManifest = {
  manifestType: "licen.public-manifest";
  version: string;
  title: string;
  description: string;
  datasetRoot: string;
  ownerAddress: string;
  createdAt: string;
  legalText?: string;
  usageTaxonomy?: string;
  taskConstraints?: string;
  complianceNotes?: string;
  attribution?: string;
  derivativeRights?: string;
  ownerSignature?: string;
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

export function validatePublicPolicyManifest(input: unknown): ValidationResult<PublicPolicyManifest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["manifestJson must parse to an object"] };
  }

  const errors: string[] = [];

  if (input.manifestType !== "licen.public-manifest") {
    errors.push("manifestType must be licen.public-manifest");
  }

  if (!isNonEmptyString(input.version)) {
    errors.push("version is required");
  }

  if (!isNonEmptyString(input.title)) {
    errors.push("title is required");
  }

  if (!isNonEmptyString(input.description)) {
    errors.push("description is required");
  }

  if (!isHexString(input.datasetRoot)) {
    errors.push("datasetRoot must be a hex string");
  }

  if (!isHexString(input.ownerAddress)) {
    errors.push("ownerAddress must be a hex string");
  }

  if (!isIsoDateString(input.createdAt)) {
    errors.push("createdAt must be a valid ISO datetime string");
  }

  const optionalStringFields: Array<keyof Pick<
    PublicPolicyManifest,
    "legalText" | "usageTaxonomy" | "taskConstraints" | "complianceNotes" | "attribution" | "derivativeRights"
  >> = ["legalText", "usageTaxonomy", "taskConstraints", "complianceNotes", "attribution", "derivativeRights"];

  for (const field of optionalStringFields) {
    const value = input[field];
    if (value !== undefined && !isNonEmptyString(value)) {
      errors.push(`${field} must be a non-empty string when provided`);
    }
  }

  if (input.ownerSignature !== undefined && !isHexString(input.ownerSignature)) {
    errors.push("ownerSignature must be a hex string when provided");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: input as PublicPolicyManifest,
  };
}

export function validatePublishManifestUploadRequest(input: unknown): ValidationResult<PublishManifestUploadRequest> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const errors: string[] = [];

  if (!isNonEmptyString(input.manifestJson)) errors.push("manifestJson is required");
  if (!isHexString(input.manifestHash)) errors.push("manifestHash must be a hex string");
  if (!isHexString(input.ownerAddress)) errors.push("ownerAddress must be a hex string");
  if (input.ownerSignature !== undefined && !isHexString(input.ownerSignature)) {
    errors.push("ownerSignature must be a hex string when provided");
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

function isIsoDateString(input: unknown): input is string {
  if (typeof input !== "string") {
    return false;
  }

  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp);
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
  if (!isHexString(input.txHash)) errors.push("txHash must be a hex string");
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

    if (typeof policy.royaltyPerEpoch !== "number" || !Number.isFinite(policy.royaltyPerEpoch) || policy.royaltyPerEpoch < 0) {
      errors.push("policy.royaltyPerEpoch must be a non-negative number");
    }

    if (!isPositiveInt(policy.maxEpochsPerRun)) {
      errors.push("policy.maxEpochsPerRun must be a positive integer");
    }

    if (!isPositiveInt(policy.maxRunsPerRequester)) {
      errors.push("policy.maxRunsPerRequester must be a positive integer");
    }

    if (!isPositiveInt(policy.ttlHours)) {
      errors.push("policy.ttlHours must be a positive integer");
    }

    if (typeof policy.policyExpiry !== "number" || policy.policyExpiry < 0) {
      errors.push("policy.policyExpiry must be a non-negative number");
    }

    if (typeof policy.openRequesters !== "boolean") {
      errors.push("policy.openRequesters must be a boolean");
    }

    if (!Array.isArray(policy.allowedRequesters)) {
      errors.push("policy.allowedRequesters must be an array");
    } else {
      const invalidRequesters = policy.allowedRequesters.filter((value) => !isHexString(value));
      if (invalidRequesters.length > 0) {
        errors.push("policy.allowedRequesters contains invalid wallet addresses");
      }

      if (policy.openRequesters === false && policy.allowedRequesters.length === 0) {
        errors.push("policy.allowedRequesters must contain at least one wallet when openRequesters is false");
      }
    }
  }

  if (input.manifestSummary !== undefined) {
    if (!isRecord(input.manifestSummary)) {
      errors.push("manifestSummary must be an object when provided");
    } else {
      if (!isNonEmptyString(input.manifestSummary.title)) errors.push("manifestSummary.title is required");
      if (!isNonEmptyString(input.manifestSummary.description)) errors.push("manifestSummary.description is required");
      if (!isIsoDateString(input.manifestSummary.createdAt)) errors.push("manifestSummary.createdAt must be a valid ISO datetime string");
      if (!isHexString(input.manifestSummary.ownerAddress)) errors.push("manifestSummary.ownerAddress must be a hex string");

      const optionalSummaryFields: Array<keyof Pick<
        PublishManifestSummary,
        "legalText" | "usageTaxonomy" | "taskConstraints" | "complianceNotes" | "attribution" | "derivativeRights"
      >> = ["legalText", "usageTaxonomy", "taskConstraints", "complianceNotes", "attribution", "derivativeRights"];

      for (const field of optionalSummaryFields) {
        const value = input.manifestSummary[field];
        if (value !== undefined && !isNonEmptyString(value)) {
          errors.push(`manifestSummary.${field} must be a non-empty string when provided`);
        }
      }
    }
  }

  if (input.idempotencyKey !== undefined && !isNonEmptyString(input.idempotencyKey)) {
    errors.push("idempotencyKey must be a non-empty string when provided");
  }

  if (!isNonEmptyString(input.encryptedKeyEnvelope)) {
    errors.push("encryptedKeyEnvelope is required and must be a non-empty string");
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
