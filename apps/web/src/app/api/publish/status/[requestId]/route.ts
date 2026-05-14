import type { NextRequest } from "next/server";
import {
  PENDING_TX_HASH,
  type ApiErrorResponse,
  type PublishStatusResponse,
} from "@/lib/publish/contracts";
import { getOgPublicClient } from "@/lib/publish/onchain";
import { getPublishRequestStatus, updatePublishRequestStatus } from "@/lib/publish/store";

type RouteContext<T extends string> = {
  params: Promise<{ requestId: string }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/publish/status/[requestId]">
) {
  try {
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

    // If it's a pending hash, it's still waiting for the user to sign the transaction
    if (status.txHash === PENDING_TX_HASH) {
      return Response.json({ ...status, status: "queued" }, { status: 200 });
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
    } catch (err) {
      console.warn(`[status] Failed to fetch receipt for ${status.txHash}:`, err);
      nextStatus = {
        ...nextStatus,
        status: "validating",
      };
    }

    await updatePublishRequestStatus(requestId, nextStatus);
    return Response.json(nextStatus, { status: 200 });
  } catch (error) {
    console.error("Publish status error:", error);
    const errorBody: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error while fetching publish status",
      },
    };
    return Response.json(errorBody, { status: 500 });
  }
}
