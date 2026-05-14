import type { NextRequest } from "next/server";
import { getPublishPayloadByDatasetRoot } from "@/lib/publish/store";
import { downloadManifestFromOgStorage } from "@/lib/publish/storage";

type SummaryRecord = {
  title: string | null;
  description: string | null;
  createdAt: string | null;
  manifestUri: string | null;
  legalText?: string | null;
  usageTaxonomy?: string | null;
  taskConstraints?: string | null;
  complianceNotes?: string | null;
  attribution?: string | null;
  derivativeRights?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { datasetRoots?: string[] };
    const datasetRoots = Array.isArray(body.datasetRoots) ? body.datasetRoots : [];

    const uniqueRoots = Array.from(
      new Set(
        datasetRoots
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .map((value) => value.toLowerCase())
      )
    );

    const entries = await Promise.all(
      uniqueRoots.map(async (datasetRoot) => {
        try {
          const payload = await getPublishPayloadByDatasetRoot(datasetRoot);
          if (!payload?.manifestUri) {
            return [datasetRoot, { title: null, description: null, createdAt: null, manifestUri: null } satisfies SummaryRecord] as const;
          }

          const manifest = payload.manifestSummary ?? await downloadManifestFromOgStorage(payload.manifestUri);
          return [
            datasetRoot,
            {
              title: manifest.title ?? null,
              description: manifest.description ?? null,
              createdAt: manifest.createdAt ?? null,
              manifestUri: payload.manifestUri,
              legalText: manifest.legalText ?? null,
              usageTaxonomy: manifest.usageTaxonomy ?? null,
              taskConstraints: manifest.taskConstraints ?? null,
              complianceNotes: manifest.complianceNotes ?? null,
              attribution: manifest.attribution ?? null,
              derivativeRights: manifest.derivativeRights ?? null,
            } satisfies SummaryRecord,
          ] as const;
        } catch (error) {
          console.error(`Manifest summary fetch failed for ${datasetRoot}:`, error);
          return [datasetRoot, { title: null, description: null, createdAt: null, manifestUri: null } satisfies SummaryRecord] as const;
        }
      })
    );

    return Response.json({ manifests: Object.fromEntries(entries) });
  } catch (error) {
    console.error("Manifest summary batch error:", error);
    return Response.json({ manifests: {} }, { status: 200 });
  }
}
