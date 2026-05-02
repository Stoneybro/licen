import type { NextRequest } from "next/server";
import type { ApiErrorResponse, PublishStatusResponse } from "@/lib/publish/contracts";
import { getOgPublicClient } from "@/lib/publish/onchain";
import { getPublishRequestStatus, updatePublishRequestStatus } from "@/lib/publish/store";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/publish/status/[requestId]">
) {
  const { requestId } = await context.params;
  const status = await getPublishRequestStatus(requestId);

  if (!status) {
    const errorBody: ApiErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: `No publish request found for requestId ${requestId}`,
      },
    };

    return Response.json(errorBody, { status: 404 });
  }

  if (!status.txHash) {
    return Response.json(status, { status: 200 });
  }

  let nextStatus: PublishStatusResponse = {
    ...status,
    status: "validating",
    lastUpdatedAt: new Date().toISOString(),
  };

  try {
    const client = getOgPublicClient();
    const receipt = await client.getTransactionReceipt({ hash: status.txHash as `0x${string}` });

    nextStatus = {
      ...nextStatus,
      status: receipt.status === "success" ? "accepted" : "failed",
      lastUpdatedAt: new Date().toISOString(),
      errorMessage: receipt.status === "success" ? undefined : "On-chain transaction reverted",
    };
  } catch {
    nextStatus = {
      ...nextStatus,
      status: "validating",
    };
  }

  await updatePublishRequestStatus(requestId, nextStatus);
  return Response.json(nextStatus, { status: 200 });
}
