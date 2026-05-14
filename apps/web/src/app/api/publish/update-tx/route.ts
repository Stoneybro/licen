import type { NextRequest } from "next/server";
import { db } from "@/db/db";
import { publishRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ApiErrorResponse, PublishStatusResponse } from "@/lib/publish/contracts";

export async function POST(request: NextRequest) {
  try {
    const { requestId, txHash } = await request.json();

    if (!requestId || !txHash) {
      return Response.json({ error: "requestId and txHash are required" }, { status: 400 });
    }

    const stored = await db.query.publishRequests.findFirst({
      where: eq(publishRequests.requestId, requestId),
    });

    if (!stored) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    const status = stored.record as PublishStatusResponse;
    const payload = stored.payload as any;

    // Update the record with the real txHash
    const updatedStatus = {
      ...status,
      txHash,
      lastUpdatedAt: new Date().toISOString(),
    };

    // Update payload too for consistency
    const updatedPayload = {
      ...payload,
      txHash,
    };

    await db.update(publishRequests)
      .set({
        record: updatedStatus,
        payload: updatedPayload,
        updatedAt: new Date(),
      })
      .where(eq(publishRequests.requestId, requestId));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Update tx error:", error);
    const errorBody: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error while updating transaction hash",
      },
    };
    return Response.json(errorBody, { status: 500 });
  }
}
