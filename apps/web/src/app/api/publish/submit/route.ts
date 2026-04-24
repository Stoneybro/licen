import type { NextRequest } from "next/server";
import {
  createRequestId,
  type ApiErrorResponse,
  type PublishSubmitSuccessResponse,
  validatePublishSubmitRequest,
} from "@/lib/publish/contracts";
import { savePublishRequest } from "@/lib/publish/store";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const validated = validatePublishSubmitRequest(payload);

    if (!validated.ok) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: "INVALID_PAYLOAD",
          message: "Publish request payload failed validation",
          details: validated.errors,
        },
      };

      return Response.json(errorBody, { status: 400 });
    }

    const requestId = createRequestId();
    const saved = savePublishRequest(requestId, validated.data);

    const responseBody: PublishSubmitSuccessResponse = {
      requestId,
      status: "queued",
      submittedAt: saved.submittedAt,
    };

    return Response.json(responseBody, { status: 202 });
  } catch {
    const errorBody: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error while processing publish submit",
      },
    };

    return Response.json(errorBody, { status: 500 });
  }
}
