import type { NextRequest } from "next/server";
import { envioFetch } from "@/lib/envio";
import { getPublishPayloadsByDatasetRoots } from "@/lib/publish/store";
import { downloadManifestFromOgStorage } from "@/lib/publish/storage";

type DatasetRow = {
  id: string;
  owner: string;
  manifestHash: string;
  active: boolean;
  timestamp: string | number;
};

type JobRow = {
  datasetRoot: string;
  state: string;
  royaltySettled?: string | null;
};

type RequestBody = {
  ownerAddress?: string;
  activeOnly?: boolean;
  includeJobStats?: boolean;
  datasetRoots?: string[];
};

function buildDatasetQuery(body: RequestBody): string {
  const where: string[] = [];

  if (body.ownerAddress) {
    where.push(`owner: { _ilike: "${body.ownerAddress}" }`);
  }

  if (body.activeOnly) {
    where.push(`active: { _eq: true }`);
  }

  if (Array.isArray(body.datasetRoots) && body.datasetRoots.length > 0) {
    const encodedRoots = body.datasetRoots.map((root) => `"${root}"`).join(", ");
    where.push(`id: { _in: [${encodedRoots}] }`);
  }

  const whereClause = where.length > 0 ? `(where: { ${where.join(", ")} }, order_by: { timestamp: desc })` : `(order_by: { timestamp: desc })`;

  return `
    query GetDatasets {
      Dataset${whereClause} {
        id
        owner
        manifestHash
        active
        timestamp
      }
    }
  `;
}

function buildJobsQuery(datasetRoots: string[]): string | null {
  if (datasetRoots.length === 0) return null;

  const encodedRoots = datasetRoots.map((root) => `"${root}"`).join(", ");

  return `
    query GetJobs {
      Job(where: { datasetRoot: { _in: [${encodedRoots}] } }) {
        datasetRoot
        state
        royaltySettled
      }
    }
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;
    const datasetData = await envioFetch<{ Dataset: DatasetRow[] }>(buildDatasetQuery(body));
    const datasets = datasetData.Dataset ?? [];
    const datasetRoots = datasets.map((dataset) => dataset.id.toLowerCase());

    const payloadsByRoot = await getPublishPayloadsByDatasetRoots(datasetRoots);

    let jobs: JobRow[] = [];
    if (body.includeJobStats !== false) {
      const jobsQuery = buildJobsQuery(datasetRoots);
      if (jobsQuery) {
        const jobData = await envioFetch<{ Job: JobRow[] }>(jobsQuery);
        jobs = jobData.Job ?? [];
      }
    }

    const jobsByRoot = jobs.reduce<Record<string, JobRow[]>>((acc, job) => {
      const key = job.datasetRoot.toLowerCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(job);
      return acc;
    }, {});

    const summaries = await Promise.all(datasets.map(async (dataset) => {
      const root = dataset.id.toLowerCase();
      const payload = payloadsByRoot[root];
      const datasetJobs = jobsByRoot[root] ?? [];
      const lifetimeRoyalties = datasetJobs.reduce((acc, job) => {
        return acc + Number(job.royaltySettled ?? "0");
      }, 0);
      const activeJobCount = datasetJobs.filter((job) =>
        ["Requested", "Granted", "Dispatching", "Running"].includes(job.state)
      ).length;

      // Use local summary if available, otherwise fallback to OG Storage (slow but correct for old records)
      const manifest = payload?.manifestSummary ?? (payload?.manifestUri ? await downloadManifestFromOgStorage(payload.manifestUri) : null);
      const policy = payload?.policy;

      // Filter out ghost datasets that don't have manifests
      if (!manifest) {
        return null;
      }

      return {
        datasetRoot: dataset.id,
        owner: dataset.owner,
        manifestHash: dataset.manifestHash,
        manifestUri: payload?.manifestUri ?? null,
        active: dataset.active,
        createdAt: manifest.createdAt,
        title: manifest.title,
        description: manifest.description,
        policy: policy
          ? {
              royaltyPerEpoch: policy.royaltyPerEpoch,
              maxEpochsPerRun: policy.maxEpochsPerRun,
              maxRunsPerRequester: policy.maxRunsPerRequester,
              ttlHours: policy.ttlHours,
              policyExpiry: policy.policyExpiry,
              openRequesters: policy.openRequesters,
              allowedPurposeIds: policy.allowedPurposeIds,
            }
          : null,
        stats: {
          lifetimeRoyalties,
          jobCount: datasetJobs.length,
          activeJobCount,
        },
      };
    })).then(results => results.filter(Boolean));

    return Response.json({ datasets: summaries });
  } catch (error) {
    console.error("Dataset summaries error:", error);
    return Response.json({ datasets: [] }, { status: 500 });
  }
}
