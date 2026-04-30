"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { CircleCheckBig, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import { AppTopbar } from "@/components/app/app-topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  PUBLISH_PURPOSES,
  type PublishPurpose,
  type PublishManifestUploadResponse,
  type PublishStatusResponse,
  type PublishSubmitRequest,
  type PublishSubmitSuccessResponse,
  type PublishPolicyConfig,
} from "@/lib/publish/contracts";
import { encryptDatasetFile } from "@/lib/publish/encryption";
import { buildRegisterDatasetArgs, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";

const OPTIONAL_MANIFEST_SECTIONS = [
  {
    id: "legalText",
    label: "Human-readable legal/policy text",
    placeholder: "Describe governing legal terms in plain language.",
  },
  {
    id: "usageTaxonomy",
    label: "Domain taxonomy and allowed/prohibited use classes",
    placeholder: "Capture allowed and prohibited use classes.",
  },
  {
    id: "taskConstraints",
    label: "Model/task constraints",
    placeholder: "Define task, model family, or deployment constraints.",
  },
  {
    id: "complianceNotes",
    label: "Compliance/region notes",
    placeholder: "Add jurisdiction or compliance guidance.",
  },
  {
    id: "attribution",
    label: "Attribution requirements",
    placeholder: "Specify required attribution language and placement.",
  },
  {
    id: "derivativeRights",
    label: "Derivative/commercial rights",
    placeholder: "Explain derivative and commercial usage rights.",
  },
] as const;

type OptionalManifestSectionId = (typeof OPTIONAL_MANIFEST_SECTIONS)[number]["id"];
type OptionalManifestSectionValues = Record<OptionalManifestSectionId, string>;

const INITIAL_OPTIONAL_SECTION_VALUES: OptionalManifestSectionValues = {
  legalText: "",
  usageTaxonomy: "",
  taskConstraints: "",
  complianceNotes: "",
  attribution: "",
  derivativeRights: "",
};

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return `0x${arr.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function togglePurpose(
  previous: PublishPurpose[],
  purpose: PublishPurpose,
  enabled: boolean
): PublishPurpose[] {
  if (enabled) {
    return previous.includes(purpose) ? previous : [...previous, purpose];
  }

  return previous.filter((item) => item !== purpose);
}

function formatPurposeLabel(value: PublishPurpose) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function NewDatasetPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [enabledManifestSections, setEnabledManifestSections] = useState<OptionalManifestSectionId[]>([]);
  const [optionalManifestValues, setOptionalManifestValues] = useState<OptionalManifestSectionValues>(
    INITIAL_OPTIONAL_SECTION_VALUES
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allowedPurposeIds, setAllowedPurposeIds] = useState<PublishPurpose[]>([PUBLISH_PURPOSES[0]]);

  const [royaltyPerEpoch, setRoyaltyPerEpoch] = useState<number>(10);
  const [maxEpochsPerRun, setMaxEpochsPerRun] = useState<number>(10);
  const [maxRunsPerRequester, setMaxRunsPerRequester] = useState<number>(1);
  const [ttlHours, setTtlHours] = useState<number>(720);
  const [policyExpiry, setPolicyExpiry] = useState<string>("");
  const [noPolicyExpiry, setNoPolicyExpiry] = useState(true);

  const [publishing, setPublishing] = useState(false);
  const [publishingStep, setPublishingStep] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatusResponse["status"] | null>(null);
  const [encryptionKeyData, setEncryptionKeyData] = useState<{ datasetRoot: string; ivHex: string; keyHex: string } | null>(null);

  useEffect(() => {
    if (!requestId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/publish/status/${requestId}`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: { message?: string } };
          if (active) setErrorMessage(body.error?.message ?? "Failed to fetch publish status");
          return;
        }

        const body = (await res.json()) as PublishStatusResponse;
        if (!active) return;

        setStatus(body.status);
        setPublishProgress(
          body.status === "queued" ? 80 : body.status === "validating" ? 92 : body.status === "accepted" ? 100 : 100
        );

        if (body.status === "accepted" || body.status === "failed") {
          setPublishingStep(body.status === "accepted" ? "Published successfully!" : "Publishing failed.");
          setPublishing(false);
          return;
        }

        timer = setTimeout(poll, 1200);
      } catch {
        if (active) setErrorMessage("Unable to poll publish status");
      }
    };

    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [requestId]);

  const handlePublish = async () => {
    setErrorMessage(null);

    if (!walletAddress) {
      setErrorMessage("Connect a wallet to publish.");
      return;
    }
    if (!selectedFile) {
      setErrorMessage("Please select a dataset file.");
      return;
    }
    if (!title) {
      setErrorMessage("Please provide a title.");
      return;
    }
    if (!description) {
      setErrorMessage("Please provide a description.");
      return;
    }
    if (allowedPurposeIds.length === 0) {
      setErrorMessage("Select at least one allowed purpose.");
      return;
    }

    try {
      setStatus(null);
      setRequestId(null);
      setPublishing(true);
      setPublishProgress(10);

      // Step 1: Encrypt
      setPublishingStep("Encrypting dataset client-side...");
      setPublishProgress(20);
      const encrypted = await encryptDatasetFile(selectedFile);
      setEncryptionKeyData(null);

      // Step 2: Upload encrypted dataset to 0G Storage
      setPublishingStep("Uploading encrypted dataset to 0G Storage...");
      setPublishProgress(40);
      const datasetUploadForm = new FormData();
      datasetUploadForm.append("file", encrypted.encryptedBlob, `${encrypted.fileName}.enc`);
      const datasetUploadRes = await fetch("/api/publish/dataset/upload", {
        method: "POST",
        body: datasetUploadForm,
      });
      if (!datasetUploadRes.ok) {
        const errBody = (await datasetUploadRes.json()) as { error?: { message?: string } };
        throw new Error(errBody.error?.message ?? "Failed to upload encrypted dataset to 0G");
      }
      const datasetUploadData = (await datasetUploadRes.json()) as { datasetRoot: `0x${string}` };
      const datasetRoot = datasetUploadData.datasetRoot;
      setEncryptionKeyData({ datasetRoot, ivHex: encrypted.ivHex, keyHex: encrypted.keyHex });

      // Step 3: Generate Manifest
      setPublishingStep("Uploading manifest to 0G Storage...");
      setPublishProgress(60);
      const policy: PublishPolicyConfig = {
        allowedPurposeIds,
        royaltyPerEpoch,
        maxEpochsPerRun,
        maxRunsPerRequester,
        ttlHours,
        policyExpiry: noPolicyExpiry || !policyExpiry ? 0 : Math.floor(new Date(policyExpiry).getTime() / 1000),
      };

      const optionalManifestSections = enabledManifestSections.reduce<Record<string, string>>((acc, sectionId) => {
        const value = optionalManifestValues[sectionId].trim();
        if (!value) {
          return acc;
        }

        acc[sectionId] = value;
        return acc;
      }, {});

      const manifestObj = {
        version: "1.0",
        manifestType: "licen.public-manifest",
        title,
        description,
        datasetRoot,
        ownerAddress: walletAddress,
        createdAt: new Date().toISOString(),
        ...optionalManifestSections,
      };

      const manifestJson = JSON.stringify(manifestObj, null, 2);
      const manifestHash = await sha256Hex(manifestJson);

      // Upload Manifest
      const manifestRes = await fetch("/api/publish/manifest/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifestJson, manifestHash, ownerAddress: walletAddress }),
      });

      if (!manifestRes.ok) throw new Error("Failed to upload manifest");
      const manifestData = (await manifestRes.json()) as PublishManifestUploadResponse;
      const manifestUri = manifestData.manifestUri;
      setPublishProgress(75);

      // Step 4: Register dataset on-chain
      setPublishingStep("Anchoring to DataPolicy contract...");
      const activeWallet = wallets.find((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase());
      if (!activeWallet) {
        throw new Error("Connected wallet session not found. Reconnect wallet and retry.");
      }

      const ethereumProvider = await activeWallet.getEthereumProvider();

      const submitPayload: PublishSubmitRequest = {
        datasetRoot,
        manifestHash,
        manifestUri,
        txHash: "0x",
        ownerAddress: walletAddress,
        policy,
        idempotencyKey: `draft-${Date.now()}`,
      };

      const normalizedOwnerAddress =
        isAddress(walletAddress) ? (walletAddress as Address) : (() => { throw new Error("Invalid wallet address"); })();

      const calldata = encodeFunctionData({
        abi: DATA_POLICY_ABI,
        functionName: "registerDataset",
        args: buildRegisterDatasetArgs({
          datasetRoot: datasetRoot as Hex,
          manifestHash: manifestHash as Hex,
          ownerAddress: normalizedOwnerAddress,
          policy,
        }),
      });

      const txHash = (await ethereumProvider.request({
        method: "eth_sendTransaction",
        params: [{ from: normalizedOwnerAddress, to: getDataPolicyAddress(), data: calldata }],
      })) as Hex;

      submitPayload.txHash = txHash;

      const submitRes = await fetch("/api/publish/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });

      if (!submitRes.ok) throw new Error("Failed to submit publish request");
      const submitData = (await submitRes.json()) as PublishSubmitSuccessResponse;

      setRequestId(submitData.requestId);
      setStatus(submitData.status);
      setPublishProgress(80);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      setPublishing(false);
      setPublishingStep(null);
      setPublishProgress(0);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="New Dataset" />
      <div className="flex-1 p-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-muted/40 to-background p-8">
            <div className="absolute -top-20 -right-20 size-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Publish Console</Badge>
                <Badge variant="outline">Client-side encryption</Badge>
                <Badge variant="outline">Hash-anchored registry</Badge>
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Decentralized data licensing workflow</p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Publish with confidence.</h1>
                <p className="max-w-2xl text-base text-muted-foreground">
                  Configure terms once, then publish through a single orchestration flow that encrypts data locally, creates your policy manifest, and anchors publish metadata.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles data-icon="inline-start" />
                <span>Designed for low friction while preserving cryptographic guarantees.</span>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Dataset Configuration</CardTitle>
                <CardDescription>Everything required to produce a cryptographically bound manifest behind the scenes.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title">Title</FieldLabel>
                    <Input
                      id="title"
                      placeholder="e.g. Llama-3 Fine-Tuning Corpus"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={publishing}
                    />
                    <FieldDescription>Public-facing summary shown in dataset catalog and audit views.</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      id="description"
                      placeholder="Describe the dataset contents and any usage constraints..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={publishing}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="file">Dataset File</FieldLabel>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      disabled={publishing}
                    />
                    <FieldDescription>
                      {selectedFile
                        ? `Selected: ${selectedFile.name} (${formatBytes(selectedFile.size)})`
                        : "Select the source file that will be encrypted locally in your browser."}
                    </FieldDescription>
                  </Field>
                </FieldGroup>

                <Separator />

                <FieldGroup>
                  <Field>
                    <FieldContent>
                      <FieldLabel>Public Manifest Fields</FieldLabel>
                      <FieldDescription>
                        `datasetRoot`, `ownerAddress`, and `createdAt` are auto-generated during publish. Add optional policy sections as needed.
                      </FieldDescription>
                    </FieldContent>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" type="button" disabled={publishing}>
                          <Plus data-icon="inline-start" />
                          Add Optional Section
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Manifest Sections</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          {OPTIONAL_MANIFEST_SECTIONS.map((section) => (
                            <DropdownMenuCheckboxItem
                              key={section.id}
                              checked={enabledManifestSections.includes(section.id)}
                              onCheckedChange={(checked) => {
                                const enabled = checked === true;
                                setEnabledManifestSections((current) => {
                                  if (enabled) {
                                    return current.includes(section.id) ? current : [...current, section.id];
                                  }

                                  return current.filter((item) => item !== section.id);
                                });
                              }}
                            >
                              {section.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Field>

                  {enabledManifestSections.length > 0 && (
                    <FieldGroup>
                      {enabledManifestSections.map((sectionId) => {
                        const section = OPTIONAL_MANIFEST_SECTIONS.find((item) => item.id === sectionId);
                        if (!section) {
                          return null;
                        }

                        const fieldId = `manifest-${section.id}`;

                        return (
                          <Field key={section.id}>
                            <FieldLabel htmlFor={fieldId}>{section.label}</FieldLabel>
                            <Textarea
                              id={fieldId}
                              placeholder={section.placeholder}
                              value={optionalManifestValues[section.id]}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setOptionalManifestValues((current) => ({
                                  ...current,
                                  [section.id]: nextValue,
                                }));
                              }}
                              disabled={publishing}
                            />
                          </Field>
                        );
                      })}
                    </FieldGroup>
                  )}
                </FieldGroup>

                <FieldGroup>
                  <FieldSet>
                    <FieldLegend variant="label">Allowed Purposes</FieldLegend>
                    <FieldDescription>Select one or more approved training purposes.</FieldDescription>
                    <FieldGroup className="grid gap-3 sm:grid-cols-2">
                      {PUBLISH_PURPOSES.map((purpose) => {
                        const id = `purpose-${purpose.toLowerCase()}`;
                        const checked = allowedPurposeIds.includes(purpose);

                        return (
                          <Field key={purpose} orientation="horizontal" className="rounded-lg border p-3" data-disabled={publishing || undefined}>
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(value) => {
                                setAllowedPurposeIds((current) => togglePurpose(current, purpose, value === true));
                              }}
                              disabled={publishing}
                            />
                            <FieldContent>
                              <FieldLabel htmlFor={id}>{formatPurposeLabel(purpose)}</FieldLabel>
                            </FieldContent>
                          </Field>
                        );
                      })}
                    </FieldGroup>
                  </FieldSet>

                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="royalty">Royalty per Epoch ($)</FieldLabel>
                      <Input
                        id="royalty"
                        type="number"
                        min={1}
                        value={royaltyPerEpoch}
                        onChange={(e) => setRoyaltyPerEpoch(Number(e.target.value))}
                        disabled={publishing}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="maxEpochs">Max Epochs per Run</FieldLabel>
                      <Input
                        id="maxEpochs"
                        type="number"
                        min={1}
                        value={maxEpochsPerRun}
                        onChange={(e) => setMaxEpochsPerRun(Number(e.target.value))}
                        disabled={publishing}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="maxRunsPerRequester">Max Runs per Requester</FieldLabel>
                      <Input
                        id="maxRunsPerRequester"
                        type="number"
                        min={1}
                        value={maxRunsPerRequester}
                        onChange={(e) => setMaxRunsPerRequester(Number(e.target.value))}
                        disabled={publishing}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ttlHours">Policy TTL (Hours)</FieldLabel>
                      <Input
                        id="ttlHours"
                        type="number"
                        min={1}
                        value={ttlHours}
                        onChange={(e) => setTtlHours(Number(e.target.value))}
                        disabled={publishing}
                      />
                    </Field>
                  </FieldGroup>

                  <Field orientation="horizontal" data-disabled={publishing || undefined}>
                    <FieldContent>
                      <FieldLabel htmlFor="no-policy-expiry">No Policy Expiry</FieldLabel>
                      <FieldDescription>
                        If checked, the policy has no time limit. Otherwise, set an expiry date.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="no-policy-expiry"
                      checked={noPolicyExpiry}
                      onCheckedChange={setNoPolicyExpiry}
                      disabled={publishing}
                    />
                  </Field>
                  {!noPolicyExpiry && (
                    <Field>
                      <FieldLabel htmlFor="policyExpiry">Policy Expiry Date</FieldLabel>
                      <Input
                        id="policyExpiry"
                        type="datetime-local"
                        value={policyExpiry}
                        onChange={(e) => setPolicyExpiry(e.target.value)}
                        disabled={publishing}
                      />
                    </Field>
                  )}
                </FieldGroup>
              </CardContent>
            </Card>

            <Card className="h-fit border-primary/20 bg-gradient-to-b from-primary/5 to-card lg:sticky lg:top-6">
              <CardHeader>
                <CardTitle>Publish Summary</CardTitle>
                <CardDescription>Architecture checks for this submission.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck data-icon="inline-start" />
                  <p className="text-muted-foreground">Dataset is encrypted client-side before any upload call.</p>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck data-icon="inline-start" />
                  <p className="text-muted-foreground">Manifest JSON stays hidden and is generated from this form.</p>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck data-icon="inline-start" />
                  <p className="text-muted-foreground">One action triggers manifest upload and submit orchestration.</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
                </div>

                {publishingStep && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{publishingStep}</p>
                    <Progress value={publishProgress} />
                    {requestId && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={status === "accepted" ? "default" : "secondary"} className="font-mono uppercase text-[10px]">
                          {status ?? "queued"}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full text-base font-semibold"
                  onClick={handlePublish}
                  disabled={publishing || status === "accepted"}
                >
                  {publishing ? "Publishing in progress..." : status === "accepted" ? "Published Successfully" : "Publish to LICEN"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>Publish failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {status === "accepted" && (
            <Alert>
              <CircleCheckBig data-icon="inline-start" />
              <AlertTitle>Dataset published</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>Your publish request is accepted and anchored on-chain.</span>
                {encryptionKeyData && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-destructive">Save these keys now — they will not be shown again.</span>
                    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono select-all">{JSON.stringify(encryptionKeyData, null, 2)}</pre>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
