import type { NextRequest } from "next/server";

/**
 * Mock model download endpoint.
 *
 * Returns a realistic-looking JSON payload that simulates a LoRA adapter
 * manifest. In a real system, this would return an encrypted binary blob
 * fetched from 0G Storage using the resultHash.
 *
 * The Content-Disposition header triggers a browser download.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const { jobId } = params;

  // Build a plausible mock LoRA adapter manifest
  const mockManifest = {
    format: "licen-lora-adapter-v1",
    note: "DEMO MODE — this is a simulated LoRA adapter for testnet demonstration purposes.",
    jobId,
    baseModel: "Qwen2.5-0.5B-Instruct",
    adapterType: "LoRA",
    rank: 16,
    alpha: 32,
    targetModules: ["q_proj", "v_proj", "k_proj", "o_proj"],
    trainingConfig: {
      learningRate: 0.0002,
      batchSize: 2,
      maxSteps: 3,
      neftuneNoiseAlpha: 5,
    },
    artifacts: {
      adapterConfig: "adapter_config.json",
      adapterWeights: "adapter_model.safetensors",
      tokenizerConfig: "tokenizer_config.json",
    },
    provenance: {
      orchestrator: "licen-orchestrator-v1",
      computeNetwork: "0G Compute (Testnet — Demo Mode)",
      encryptedWithPublicKey: "0x" + "0".repeat(64),
      attestationRef: "0x" + jobId.replace(/-/g, "").padEnd(64, "0").slice(0, 64),
    },
    generatedAt: new Date().toISOString(),
  };

  const body = JSON.stringify(mockManifest, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lora-adapter-${jobId.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
