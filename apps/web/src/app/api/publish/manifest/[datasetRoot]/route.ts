import type { NextRequest } from "next/server";
import type { ApiErrorResponse } from "@/lib/publish/contracts";
import { getPublishPayloadByDatasetRoot } from "@/lib/publish/store";
import { downloadManifestFromOgStorage } from "@/lib/publish/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ datasetRoot: string }> }
) {
  try {
    const { datasetRoot } = await params;
    const payload = await getPublishPayloadByDatasetRoot(datasetRoot);

    if (!payload?.manifestUri) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "NOT_FOUND",
          message: "Manifest not found for dataset",
        },
      };
      return Response.json(errorBody, { status: 404 });
    }

    const manifest = await downloadManifestFromOgStorage(payload.manifestUri);

    return Response.json({
      manifest,
      manifestUri: payload.manifestUri,
      manifestHash: payload.manifestHash,
    });
  } catch (error) {
    console.error("Manifest fetch error:", error);
    const errorBody: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error while fetching manifest",
      },
    };

    return Response.json(errorBody, { status: 500 });
  }
}
