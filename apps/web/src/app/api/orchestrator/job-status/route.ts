import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { publishRequests } from "@/db/schema";

/**
 * GET /api/orchestrator/job-status?jobId=0x...
 *
 * Lightweight endpoint the Sessions page polls for live epoch progress
 * during the Training phase. Reads from the orchestrator's compute_jobs
 * table (shared Neon DB) to get the current mock epoch count.
 *
 * This is intentionally public (no auth needed) — it only returns
 * non-sensitive progress data, not keys or payloads.
 */

// We query the shared DB directly — same Neon instance as the orchestrator
import { neon } from "@neondatabase/serverless";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const dbUrl =
      process.env.LICEN_STORAGE_DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL;

    if (!dbUrl) {
      return NextResponse.json({ error: "DB not configured" }, { status: 503 });
    }

    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT status, actual_epochs, requested_epochs, mock_dispatched_at, updated_at
      FROM compute_jobs
      WHERE licen_job_id = ${jobId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Job not yet picked up by orchestrator
      return NextResponse.json({ found: false, status: "queued", completedEpochs: 0 });
    }

    const row = rows[0];
    return NextResponse.json({
      found: true,
      status: row.status,
      completedEpochs: row.actual_epochs ?? 0,
      requestedEpochs: row.requested_epochs,
      mockDispatchedAt: row.mock_dispatched_at,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error("[job-status] DB error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
