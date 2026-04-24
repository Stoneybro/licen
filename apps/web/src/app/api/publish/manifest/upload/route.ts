import type { NextRequest } from "next/server";
import {
  type ApiErrorResponse,
  type PublishManifestUploadResponse,
  validatePublishManifestUploadRequest,
} from "@/lib/publish/contracts";
import { saveManifestUpload } from "@/lib/publish/store";
import { recoverMessageAddress } from "viem";

async function sha256Hex(input: string): Promise<`0x${string}`> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const validated = validatePublishManifestUploadRequest(payload);

    if (!validated.ok) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "Manifest upload payload failed validation",
          details: validated.errors,
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    const computedManifestHash = await sha256Hex(validated.data.manifestJson);
    if (computedManifestHash.toLowerCase() !== validated.data.manifestHash.toLowerCase()) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "manifestHash does not match manifestJson",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(validated.data.manifestJson);
    } catch {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "manifestJson must be valid JSON",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    const manifestOwnerAddress =
      typeof parsedManifest === "object" &&
      parsedManifest !== null &&
      "ownerAddress" in parsedManifest &&
      typeof parsedManifest.ownerAddress === "string"
        ? parsedManifest.ownerAddress
        : null;

    if (!manifestOwnerAddress) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "manifestJson.ownerAddress is required",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    if (manifestOwnerAddress.toLowerCase() !== validated.data.ownerAddress.toLowerCase()) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "ownerAddress does not match manifestJson.ownerAddress",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    let recoveredAddress: `0x${string}`;
    try {
      recoveredAddress = await recoverMessageAddress({
        message: validated.data.manifestJson,
        signature: validated.data.ownerSignature as `0x${string}`,
      });
    } catch {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "ownerSignature format is invalid",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    if (recoveredAddress.toLowerCase() !== validated.data.ownerAddress.toLowerCase()) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "ownerSignature is invalid for provided ownerAddress",
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    const stored = saveManifestUpload(validated.data);

    const responseBody: PublishManifestUploadResponse = {
      manifestUri: stored.manifestUri,
      manifestHash: stored.manifestHash,
      storedAt: stored.storedAt,
    };

    return Response.json(responseBody, { status: 201 });
  } catch {
    const errorBody: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error while processing manifest upload",
      },
    };

    return Response.json(errorBody, { status: 500 });
  }
}
