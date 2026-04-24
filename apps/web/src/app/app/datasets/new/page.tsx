"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useSignMessage } from "@privy-io/react-auth";
import { AppTopbar } from "@/components/app/app-topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PUBLISH_PURPOSES,
  type PublishManifestUploadResponse,
  type PublishStatusResponse,
  type PublishSubmitRequest,
  type PublishSubmitSuccessResponse,
  validatePublishSubmitRequest,
} from "@/lib/publish/contracts";
import { encryptDatasetFile, type EncryptDatasetResult } from "@/lib/publish/encryption";

function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return `0x${Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return `0x${arr.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function NewDatasetPage() {
  const { user } = usePrivy();
  const { signMessage } = useSignMessage();
  const walletAddress = user?.wallet?.address;

  const [datasetRoot, setDatasetRoot] = useState(() => randomHex(32));
  const [manifestHash, setManifestHash] = useState(() => randomHex(32));
  const [manifestUri, setManifestUri] = useState("zg://manifest/placeholder");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step1Output, setStep1Output] = useState<EncryptDatasetResult | null>(null);
  const [encrypting, setEncrypting] = useState(false);
  const [manifestJson, setManifestJson] = useState("");
  const [ownerSignature, setOwnerSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [uploadingManifest, setUploadingManifest] = useState(false);
  const [manifestStoredAt, setManifestStoredAt] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatusResponse["status"] | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { n: 1, label: "Encrypt & Upload", desc: "Encrypt local file with AES-256 and prepare dataset root for upload." },
      { n: 2, label: "Author Manifest", desc: "Sign the canonical manifest and replace placeholder reference." },
      { n: 3, label: "Configure On-Chain Policy", desc: "Adjust policy fields once contract integration is live." },
      { n: 4, label: "Sign & Anchor", desc: "Submit final on-chain write via wrapper orchestration." },
    ],
    []
  );

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    const canonicalManifest = JSON.stringify(
      {
        version: 1,
        datasetRoot,
        manifestUri,
        ownerAddress: walletAddress,
        policy: {
          allowedPurposeIds: [PUBLISH_PURPOSES[0]],
          allowedProviderIds: ["provider-default-001"],
          royaltyPerEpoch: 10,
          maxEpochsPerRun: 10,
          escrowCap: 1000,
          ttlHours: 720,
          requireTEE: true,
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );

    setManifestJson(canonicalManifest);
    setOwnerSignature(null);

    void sha256Hex(canonicalManifest).then((hash) => {
      setManifestHash(hash);
    });
  }, [datasetRoot, manifestUri, walletAddress]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/publish/status/${requestId}`);

        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          if (active) {
            setErrorMessage(body.error?.message ?? "Failed to fetch publish status");
          }
          return;
        }

        const body = (await res.json()) as PublishStatusResponse;

        if (!active) {
          return;
        }

        setStatus(body.status);
        setLastUpdatedAt(body.lastUpdatedAt);

        if (body.status === "accepted" || body.status === "failed") {
          return;
        }

        timer = setTimeout(poll, 1200);
      } catch {
        if (active) {
          setErrorMessage("Unable to poll publish status");
        }
      }
    };

    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [requestId]);

  const handleUploadManifest = async () => {
    setErrorMessage(null);

    if (!walletAddress) {
      setErrorMessage("Connect a wallet to upload the manifest.");
      return;
    }

    if (!manifestJson) {
      setErrorMessage("Manifest is empty and cannot be uploaded.");
      return;
    }

    if (!ownerSignature) {
      setErrorMessage("Sign the manifest before uploading.");
      return;
    }

    try {
      setUploadingManifest(true);
      const res = await fetch("/api/publish/manifest/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manifestJson,
          manifestHash,
          ownerAddress: walletAddress,
          ownerSignature,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string; details?: string[] } };
        const details = body.error?.details?.join("; ");
        setErrorMessage(details ?? body.error?.message ?? "Failed to upload manifest");
        return;
      }

      const body = (await res.json()) as PublishManifestUploadResponse;
      setManifestUri(body.manifestUri);
      setManifestStoredAt(body.storedAt);
    } catch {
      setErrorMessage("Unexpected network error while uploading manifest");
    } finally {
      setUploadingManifest(false);
    }
  };

  const handleEncryptDataset = async () => {
    setErrorMessage(null);

    if (!selectedFile) {
      setErrorMessage("Select a dataset file before encryption.");
      return;
    }

    try {
      setEncrypting(true);
      const encrypted = await encryptDatasetFile(selectedFile);
      setStep1Output(encrypted);
      setDatasetRoot(encrypted.datasetRoot);
    } catch {
      setErrorMessage("Failed to encrypt dataset file in browser.");
    } finally {
      setEncrypting(false);
    }
  };

  const handleSignManifest = async () => {
    setErrorMessage(null);

    if (!walletAddress) {
      setErrorMessage("Connect a wallet to sign the manifest.");
      return;
    }

    if (!manifestJson) {
      setErrorMessage("Manifest is empty and cannot be signed.");
      return;
    }

    try {
      setSigning(true);
      const { signature } = await signMessage(
        { message: manifestJson },
        {
          address: walletAddress,
        }
      );

      setOwnerSignature(signature);
    } catch {
      setErrorMessage("Wallet signature was rejected or unavailable via Privy.");
    } finally {
      setSigning(false);
    }
  };

  const handleSubmitDraft = async () => {
    setErrorMessage(null);

    if (!step1Output) {
      setErrorMessage("Run Step 1 encryption before submitting publish draft.");
      return;
    }

    if (!walletAddress) {
      setErrorMessage("Connect a wallet to submit a publish request.");
      return;
    }

    const payload: PublishSubmitRequest = {
      datasetRoot,
      manifestHash,
      manifestUri,
      ownerAddress: walletAddress,
      ownerSignature: ownerSignature ?? undefined,
      policy: {
        allowedPurposeIds: [PUBLISH_PURPOSES[0]],
        allowedProviderIds: ["provider-default-001"],
        royaltyPerEpoch: 10,
        maxEpochsPerRun: 10,
        escrowCap: 1000,
        ttlHours: 720,
        requireTEE: true,
      },
      idempotencyKey: `draft-${Date.now()}`,
    };

    const validated = validatePublishSubmitRequest(payload);
    if (!validated.ok) {
      setErrorMessage(validated.errors.join("; "));
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/publish/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string; details?: string[] } };
        const details = body.error?.details?.join("; ");
        setErrorMessage(details ?? body.error?.message ?? "Failed to submit publish request");
        return;
      }

      const body = (await res.json()) as PublishSubmitSuccessResponse;
      setRequestId(body.requestId);
      setStatus(body.status);
      setLastUpdatedAt(body.submittedAt);
    } catch {
      setErrorMessage("Unexpected network error while submitting publish request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="New Dataset" />
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-3xl">
        <div>
          <h2 className="text-base font-semibold">Publish a Dataset</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Step 1 encryption + Step 2 manifest signing are wired for publish draft generation.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {steps.map((s) => (
            <Card key={s.n} className={s.n === 1 ? "" : "opacity-65"}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={s.n === 1 ? "default" : "outline"} className="font-mono size-5 justify-center text-[10px] p-0 rounded-full">
                    {s.n}
                  </Badge>
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{s.desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Step 1 Encrypt Dataset</CardTitle>
            <CardDescription className="text-xs">
              Select a source file, encrypt client-side with AES-256-GCM, and derive the dataset root from ciphertext.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Dataset file</span>
              <Input
                type="file"
                className="text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setStep1Output(null);
                }}
              />
              {selectedFile && <p className="text-[11px] text-muted-foreground">Selected: {selectedFile.name}</p>}
            </div>

            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Dataset root</span>
              <Input value={datasetRoot} onChange={(e) => setDatasetRoot(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Manifest hash</span>
              <Input value={manifestHash} onChange={(e) => setManifestHash(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Manifest URI</span>
              <Input value={manifestUri} onChange={(e) => setManifestUri(e.target.value)} className="text-xs" />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleEncryptDataset}
                disabled={encrypting || !selectedFile}
              >
                {encrypting ? "Encrypting..." : "Encrypt dataset"}
              </Button>
              <Button type="button" size="sm" className="text-xs" onClick={handleSubmitDraft} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit draft"}
              </Button>
            </div>

            {step1Output && (
              <div className="rounded-md border border-border bg-muted/25 p-3 text-xs grid gap-1.5">
                <p className="text-muted-foreground">Encryption output</p>
                <p>
                  File: <span className="font-medium">{step1Output.fileName}</span>
                </p>
                <p>
                  Size: {formatBytes(step1Output.originalByteLength)} → {formatBytes(step1Output.encryptedByteLength)}
                </p>
                <p className="text-muted-foreground">IV</p>
                <p className="font-mono break-all">{step1Output.ivHex}</p>
                <p className="text-muted-foreground">Encryption key (temporary for MVP)</p>
                <p className="font-mono break-all">{step1Output.keyHex}</p>
              </div>
            )}

            {requestId && (
              <div className="rounded-md border border-border bg-muted/25 p-3 text-xs">
                <p className="text-muted-foreground">Request ID</p>
                <p className="font-mono break-all mt-0.5">{requestId}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-[10px] h-4 font-mono uppercase">{status ?? "queued"}</Badge>
                </div>
                {lastUpdatedAt && <p className="text-muted-foreground mt-1">Updated: {new Date(lastUpdatedAt).toLocaleString()}</p>}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Step 2 Manifest Authoring & Signature</CardTitle>
            <CardDescription className="text-xs">
              Review canonical manifest JSON, then sign it with your wallet. Signature is included in publish submit payload.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Canonical manifest JSON</span>
              <Textarea
                value={manifestJson}
                onChange={async (e) => {
                  const nextManifest = e.target.value;
                  setManifestJson(nextManifest);
                  setOwnerSignature(null);
                  const nextHash = await sha256Hex(nextManifest);
                  setManifestHash(nextHash);
                }}
                className="min-h-52 font-mono text-xs"
              />
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Manifest URI</p>
              <p className="font-mono break-all mt-0.5">{manifestUri}</p>
              {manifestStoredAt && (
                <p className="text-muted-foreground mt-1">Stored: {new Date(manifestStoredAt).toLocaleString()}</p>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Derived manifest hash</p>
              <p className="font-mono break-all mt-0.5">{manifestHash}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="text-xs" onClick={handleSignManifest} disabled={signing}>
                {signing ? "Signing..." : "Sign manifest"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs"
                variant="outline"
                onClick={handleUploadManifest}
                disabled={uploadingManifest || !ownerSignature}
              >
                {uploadingManifest ? "Uploading..." : "Upload manifest"}
              </Button>
              {ownerSignature && (
                <Badge variant="outline" className="h-6 text-[10px] font-mono uppercase">
                  Signed
                </Badge>
              )}
            </div>

            {ownerSignature && (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                <p className="text-muted-foreground">Owner signature</p>
                <p className="font-mono break-all mt-0.5">{ownerSignature}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
