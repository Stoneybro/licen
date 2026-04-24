import type { NextRequest } from "next/server";
import type { ApiErrorResponse } from "@/lib/publish/contracts";
import { getPublishRequestStatus } from "@/lib/publish/store";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/publish/status/[requestId]">
) {
  const { requestId } = await context.params;
  const status = getPublishRequestStatus(requestId);

  if (!status) {
    const errorBody: ApiErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: `No publish request found for requestId ${requestId}`,
      },
    };

    return Response.json(errorBody, { status: 404 });
  }

  return Response.json(status, { status: 200 });
}
