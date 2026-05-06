import type { NextRequest } from "next/server";
import type { ApiErrorResponse } from "@/lib/publish/contracts";
import { uploadBytesToOgStorage } from "@/lib/publish/storage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const errorBody: ApiErrorResponse = {
        error: { code: "INVALID_PAYLOAD", message: "Missing 'file' field in FormData" },
      };
      return Response.json(errorBody, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const datasetRoot = await uploadBytesToOgStorage(bytes);

    return Response.json({ datasetRoot }, { status: 201 });
  } catch (err: unknown) {
    console.error("Dataset upload error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const errorBody: ApiErrorResponse = {
      error: { code: "INTERNAL_ERROR", message },
    };
    return Response.json(errorBody, { status: 500 });
  }
}
