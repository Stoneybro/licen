"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { 
  Plus, ShieldCheck, 
  BrainCircuit, GraduationCap, Building2, Dna, Leaf,
  UploadCloud, Info, DollarSign,
  Repeat, Users, Clock, CalendarX, X, CheckCircle2, Lock,
  FileJson, LineChart, Palette, Cpu,
  Copy, Check, ChevronLeft, Loader2
} from "lucide-react";
import { encodeFunctionData, isAddress, type Address, type Hex } from "viem";
import { AppTopbar } from "@/components/app/app-topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  PUBLISH_PURPOSES,
  type PublishPurpose,
  type PublishManifestUploadResponse,
  type PublishStatusResponse,
  type PublishSubmitRequest,
  type PublishSubmitSuccessResponse,
  type PublishPolicyConfig,
} from "@/lib/publish/contracts";
import { encryptDatasetFile, sealKeyEnvelope } from "@/lib/publish/encryption";
import { buildRegisterDatasetArgs, DATA_POLICY_ABI, getDataPolicyAddress } from "@/lib/publish/onchain";

const OPTIONAL_MANIFEST_SECTIONS = [
  {
    id: "legalText",
    label: "Legal Terms",
    placeholder: "Describe governing legal terms in plain language.",
  },
  {
    id: "usageTaxonomy",
    label: "Usage Taxonomy",
    placeholder: "Capture allowed and prohibited use classes.",
  },
  {
    id: "taskConstraints",
    label: "Task Constraints",
    placeholder: "Define task, model family, or deployment constraints.",
  },
  {
    id: "complianceNotes",
    label: "Compliance Notes",
    placeholder: "Add jurisdiction or compliance guidance.",
  },
  {
    id: "attribution",
    label: "Attribution Rules",
    placeholder: "Specify required attribution language and placement.",
  },
  {
    id: "derivativeRights",
    label: "Derivative Rights",
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

const PURPOSE_META: Record<string, { label: string; description: string; icon: any }> = {
  NEURAL_RESEARCH: { label: "Neural Network Research", description: "Training and fine-tuning neural architectures", icon: BrainCircuit },
  ACADEMIC: { label: "Academic Research", description: "Non-commercial research by educational institutions", icon: GraduationCap },
  COMMERCIAL_R_AND_D: { label: "Commercial R&D", description: "Product development and commercial applications", icon: Building2 },
  BIOMEDICAL: { label: "Biomedical Science", description: "Healthcare, genomics, and drug discovery models", icon: Dna },
  CLIMATE_SCIENCE: { label: "Climate & Earth Science", description: "Meteorology and environmental modeling", icon: Leaf },
  FINANCIAL_MODELING: { label: "Financial Modeling", description: "Market analysis and algorithmic trading models", icon: LineChart },
  GENERATIVE_ART: { label: "Generative Art", description: "Image, video, and audio generation models", icon: Palette },
  AUTONOMOUS_SYSTEMS: { label: "Autonomous Systems", description: "Robotics, self-driving, and agentic AI", icon: Cpu },
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

function parseAllowedRequesterList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.toLowerCase())
    )
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const SECTIONS = [
  { id: "details", label: "Dataset Details" },
  { id: "purposes", label: "Allowed Purposes" },
  { id: "policy", label: "Access Policy" },
  { id: "advanced", label: "Advanced Details" },
];

export default function NewDatasetPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<string>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionalManifestValues, setOptionalManifestValues] = useState<OptionalManifestSectionValues>(
    INITIAL_OPTIONAL_SECTION_VALUES
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allowedPurposeIds, setAllowedPurposeIds] = useState<PublishPurpose[]>([PUBLISH_PURPOSES[0]]);

  const [royaltyPerEpoch, setRoyaltyPerEpoch] = useState<string>("10");
  const [maxEpochsPerRun, setMaxEpochsPerRun] = useState<number>(10);
  const [maxRunsPerRequester, setMaxRunsPerRequester] = useState<number>(1);
  const [ttlValue, setTtlValue] = useState<number>(30);
  const [ttlUnit, setTtlUnit] = useState<"hours" | "days" | "weeks">("days");
  const [policyExpiry, setPolicyExpiry] = useState<string>("");
  const [noPolicyExpiry, setNoPolicyExpiry] = useState(true);
  const [openRequesters, setOpenRequesters] = useState(true);
  const [allowedRequestersInput, setAllowedRequestersInput] = useState("");

  const [publishing, setPublishing] = useState(false);
  const [publishingStep, setPublishingStep] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatusResponse["status"] | null>(null);
  const [sealedKeyData, setSealedKeyData] = useState<{ datasetRoot: string; encryptedKeyEnvelope: string } | null>(null);
  
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
      const scrollPosition = window.scrollY + 150; // Offset for sticky headers
      
      let current = sections[0]?.id || "details";
      for (const section of sections) {
        if (section.offsetTop <= scrollPosition) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          
          if (body.status === "accepted") {
            // Give the user a moment to see the success state before redirecting
            setTimeout(() => {
              router.push("/app/datasets");
            }, 2500);
          }
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
  }, [requestId, router]);

  const handleCopy = () => {
    if (sealedKeyData) {
      navigator.clipboard.writeText(sealedKeyData.encryptedKeyEnvelope);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePublish = async () => {
    setErrorMessage(null);

    if (!walletAddress) {
      setErrorMessage("Connect a wallet to publish.");
      return;
    }
    if (!selectedFile) {
      setErrorMessage("Please select a dataset file.");
      document.getElementById("details")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    
    // JSONL validation
    if (!selectedFile.name.toLowerCase().endsWith(".jsonl")) {
      setErrorMessage("Only .jsonl files are supported by 0G Compute.");
      document.getElementById("details")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!title) {
      setErrorMessage("Please provide a title.");
      document.getElementById("details")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!description) {
      setErrorMessage("Please provide a description.");
      document.getElementById("details")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (allowedPurposeIds.length === 0) {
      setErrorMessage("Select at least one allowed purpose.");
      document.getElementById("purposes")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const allowedRequesters = parseAllowedRequesterList(allowedRequestersInput);
    if (!openRequesters) {
      if (allowedRequesters.length === 0) {
        setErrorMessage("Add at least one researcher wallet when access is restricted.");
        document.getElementById("policy")?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      const invalidRequester = allowedRequesters.find((value) => !isAddress(value));
      if (invalidRequester) {
        setErrorMessage(`Invalid researcher wallet address: ${invalidRequester}`);
        document.getElementById("policy")?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }

    try {
      setStatus(null);
      setRequestId(null);
      setPublishing(true);
      setPublishProgress(5);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Step 1: Encrypt dataset on-device
      setPublishingStep("Securing dataset on your device...");
      setPublishProgress(15);
      const encrypted = await encryptDatasetFile(selectedFile);
      setSealedKeyData(null);

      // Step 2: Upload encrypted dataset to 0G Storage
      setPublishingStep("Uploading secured dataset...");
      setPublishProgress(30);
      const datasetUploadForm = new FormData();
      datasetUploadForm.append("file", encrypted.encryptedBlob, `${encrypted.fileName}.enc`);
      const datasetUploadRes = await fetch("/api/publish/dataset/upload", {
        method: "POST",
        body: datasetUploadForm,
      });
      if (!datasetUploadRes.ok) {
        const errBody = (await datasetUploadRes.json()) as { error?: { message?: string } };
        throw new Error(errBody.error?.message ?? "Failed to upload encrypted dataset");
      }
      const datasetUploadData = (await datasetUploadRes.json()) as { datasetRoot: `0x${string}` };
      const datasetRoot = datasetUploadData.datasetRoot;

      // Step 2b: Seal the AES key with the orchestrator's ECIES public key (server-side)
      setPublishingStep("Sealing encryption key...");
      setPublishProgress(45);
      const sealResult = await sealKeyEnvelope(
        encrypted.keyHex,
        encrypted.ivHex,
        datasetRoot,
        walletAddress
      );
      setSealedKeyData({ datasetRoot, encryptedKeyEnvelope: sealResult.encryptedKeyEnvelope });

      // Step 3: Generate Manifest
      setPublishingStep("Saving dataset details...");
      setPublishProgress(55);
      
      const ttlHours = ttlUnit === "days" ? ttlValue * 24 : ttlUnit === "weeks" ? ttlValue * 168 : ttlValue;
      
      const policyConfig: PublishPolicyConfig = {
        allowedPurposeIds,
        royaltyPerEpoch: parseFloat(royaltyPerEpoch) || 0,
        maxEpochsPerRun,
        maxRunsPerRequester,
        ttlHours,
        policyExpiry: noPolicyExpiry || !policyExpiry ? 0 : Math.floor(new Date(policyExpiry).getTime() / 1000),
        openRequesters,
        allowedRequesters: openRequesters ? [] : allowedRequesters,
      };

      const optionalManifestSections = Object.entries(optionalManifestValues).reduce<Record<string, string>>((acc, [sectionId, rawValue]) => {
        const value = rawValue.trim();
        if (!value) return acc;
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

      const manifestRes = await fetch("/api/publish/manifest/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manifestJson, manifestHash, ownerAddress: walletAddress }),
      });

      if (!manifestRes.ok) throw new Error("Failed to upload manifest");
      const manifestData = (await manifestRes.json()) as PublishManifestUploadResponse;
      const manifestUri = manifestData.manifestUri;
      setPublishProgress(65);

      // Step 4: Register dataset on-chain
      setPublishingStep("Broadcasting on-chain registration...");
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
        encryptedKeyEnvelope: sealResult.encryptedKeyEnvelope,
        policy: policyConfig,
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
          policy: policyConfig,
        }),
      });

      const txHash = (await ethereumProvider.request({
        method: "eth_sendTransaction",
        params: [{ from: normalizedOwnerAddress, to: getDataPolicyAddress(), data: calldata }],
      })) as Hex;

      submitPayload.txHash = txHash;
      setPublishProgress(75);
      setPublishingStep("Finalizing submission...");

      const submitRes = await fetch("/api/publish/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });

      if (!submitRes.ok) throw new Error("Failed to submit publish request");
      const submitData = (await submitRes.json()) as PublishSubmitSuccessResponse;

      setRequestId(submitData.requestId);
      setStatus(submitData.status);
      setPublishProgress(85);

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      setPublishing(false);
      setPublishingStep(null);
      setPublishProgress(0);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-muted/10 pb-20">
      <AppTopbar title="Publish Dataset" />
      
      <div className="border-b bg-background/50 backdrop-blur-sm sticky top-12 z-10 px-4 py-2 flex items-center justify-between">
        <Link 
          href="/app/datasets" 
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="size-3" />
          Back to My Datasets
        </Link>
        
        {publishing && (
          <div className="flex items-center gap-3 flex-1 max-w-xs ml-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">
              {publishingStep}
            </span>
            <Progress value={publishProgress} className="h-1" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="mx-auto flex w-full max-w-6xl flex-col md:flex-row gap-8 lg:gap-12 relative">
          
          {/* Left Sidebar (Sticky Scrollspy) */}
          <div className="md:w-64 lg:w-72 flex-shrink-0 hidden md:block">
            <div className="sticky top-28 flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Publish Dataset</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure your dataset terms and securely publish them to the network.</p>
              </div>
              
              <nav className="flex flex-col gap-1.5">
                {SECTIONS.map((section) => (
                  <a 
                    key={section.id}
                    href={`#${section.id}`} 
                    className={cn(
                      "px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 border flex items-center gap-3 relative overflow-hidden",
                      activeSection === section.id 
                        ? "bg-foreground/5 text-foreground border-foreground/10 shadow-sm" 
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {activeSection === section.id && <span className="absolute left-0 top-0 bottom-0 w-1 bg-foreground rounded-r-full" />}
                    {section.label}
                  </a>
                ))}
              </nav>

              <div className="pt-4">
                <Button 
                  className="w-full h-12 text-sm font-semibold tracking-wide shadow-lg group relative overflow-hidden"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 size-4 transition-transform group-hover:-translate-y-0.5" />
                      Publish Dataset
                    </>
                  )}
                </Button>
                {errorMessage && (
                  <p className="text-[11px] text-destructive mt-3 font-medium flex items-center gap-1.5 bg-destructive/10 p-2 rounded-md border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                    <Info className="size-3 shrink-0" />
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Areas */}
          <div className="flex-1 space-y-12">
            
            {/* 1. Dataset Source & Info */}
            <section id="details" className="scroll-mt-32">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Dataset Source & Basic Info</h3>
                <p className="text-sm text-muted-foreground mt-1">Select your dataset and provide identifying details for researchers.</p>
              </div>

              <div className="grid gap-6">
                <Card className="border-dashed bg-muted/5 group hover:bg-muted/10 transition-colors cursor-pointer relative overflow-hidden">
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".jsonl"
                  />
                  <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="size-12 rounded-xl bg-background border shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <UploadCloud className="size-6 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : "Click to select .jsonl file"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedFile ? formatBytes(selectedFile.size) : "Only .jsonl format supported for 0G Compute."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Dataset Title</label>
                    <Input 
                      placeholder="e.g. Healthcare Claims Llama-3 Fine-tuning" 
                      className="bg-background"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Public Description</label>
                    <Textarea 
                      placeholder="Explain what this dataset contains and what researchers can achieve with it." 
                      className="min-h-32 bg-background resize-none"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <Separator className="ml-10" />

            {/* 2. Allowed Purposes */}
            <section id="purposes" className="scroll-mt-32">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Allowed Research Purposes</h3>
                  <p className="text-sm text-muted-foreground mt-1">Select which research domains are authorized to access this data.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setAllowedPurposeIds([...PUBLISH_PURPOSES])}
                >
                  Select All
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(PURPOSE_META).map(([id, meta]) => (
                  <div 
                    key={id}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-200 cursor-pointer flex gap-4 group",
                      allowedPurposeIds.includes(id as PublishPurpose)
                        ? "bg-foreground/5 border-foreground/20 shadow-sm"
                        : "bg-background hover:bg-muted/50 border-transparent border-dashed border-muted-foreground/20"
                    )}
                    onClick={() => setAllowedPurposeIds(prev => togglePurpose(prev, id as PublishPurpose, !prev.includes(id as PublishPurpose)))}
                  >
                    <div className={cn(
                      "size-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                      allowedPurposeIds.includes(id as PublishPurpose)
                        ? "bg-background border-foreground/20 text-foreground"
                        : "bg-muted/30 border-transparent text-muted-foreground"
                    )}>
                      <meta.icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{meta.label}</span>
                        {allowedPurposeIds.includes(id as PublishPurpose) && <CheckCircle2 className="size-4 text-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator className="ml-10" />

            {/* 3. Access Policy */}
            <section id="policy" className="scroll-mt-32">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Economic & Access Policy</h3>
                <p className="text-sm text-muted-foreground mt-1">Define the royalties and limits for data usage.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Price Per Training Cycle (USDC)</label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">How much researchers pay you per training epoch.</span>
                  </div>
                  <Input 
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    className="bg-background mt-1 font-mono"
                    value={royaltyPerEpoch}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setRoyaltyPerEpoch(val);
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Maximum Training Cycles</label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">The limit of epochs a researcher can run in a single job.</span>
                  </div>
                  <Input 
                    type="number"
                    min="1"
                    className="bg-background mt-1"
                    value={maxEpochsPerRun}
                    onChange={(e) => setMaxEpochsPerRun(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Usage Limit Per Researcher</label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Max times a single researcher can train on this dataset.</span>
                  </div>
                  <Input 
                    type="number" 
                    min="1"
                    className="bg-background mt-1"
                    value={maxRunsPerRequester}
                    onChange={(e) => setMaxRunsPerRequester(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Access Duration (Days)</label>
                    <span className="text-[10px] text-muted-foreground mt-0.5">How long a researcher's access is valid after approval.</span>
                  </div>
                  <Input 
                    type="number" 
                    min="1"
                    className="bg-background mt-1"
                    value={ttlValue}
                    onChange={(e) => {
                      setTtlValue(Number(e.target.value));
                      setTtlUnit("days");
                    }}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border/60 bg-background/60 p-4">
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Researcher Access</label>
                    <p className="text-[10px] text-muted-foreground">
                      Open access allows any wallet to request training. Restricted access only allows approved researcher wallets.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={openRequesters ? "default" : "outline"}
                      className="justify-center"
                      onClick={() => setOpenRequesters(true)}
                    >
                      Open Access
                    </Button>
                    <Button
                      type="button"
                      variant={!openRequesters ? "default" : "outline"}
                      className="justify-center"
                      onClick={() => setOpenRequesters(false)}
                    >
                      Restricted Access
                    </Button>
                  </div>
                </div>

                {!openRequesters && (
                  <div className="mt-4 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Allowed Researcher Wallets</label>
                    <Textarea
                      value={allowedRequestersInput}
                      onChange={(e) => setAllowedRequestersInput(e.target.value)}
                      placeholder={"0x1234...\n0xabcd...\nComma or newline separated"}
                      className="min-h-28 bg-background resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Enter one wallet per line, or separate multiple wallets with commas.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <Separator className="ml-10" />

            {/* 4. Advanced Details */}
            <section id="advanced" className="scroll-mt-32">
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Advanced Options</h3>
                <p className="text-sm text-muted-foreground mt-1">Add specific legal, compliance, or attribution requirements to your manifest.</p>
              </div>

              <div>
                <Accordion type="multiple" className="w-full space-y-4">
                  {OPTIONAL_MANIFEST_SECTIONS.map((section) => (
                    <AccordionItem 
                      key={section.id} 
                      value={section.id}
                      className="rounded-xl border border-border/60 bg-background/50 overflow-hidden transition-all duration-200 hover:border-foreground/20 data-[state=open]:border-foreground/30 data-[state=open]:shadow-sm data-[state=open]:ring-1 data-[state=open]:ring-foreground/5"
                    >
                      <AccordionTrigger className="w-full items-center px-5 py-4 hover:no-underline">
                          <div className="flex flex-col items-start text-left gap-1">
                            <span className="text-sm font-semibold">{section.label}</span>
                            <span className="text-xs text-muted-foreground font-normal">{section.placeholder}</span>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 pt-0">
                        <Textarea 
                          placeholder={`Enter details for ${section.label.toLowerCase()}...`}
                          className="min-h-32 bg-background border-input resize-none p-4 text-sm transition-all focus-visible:ring-1"
                          value={optionalManifestValues[section.id]}
                          onChange={(e) => setOptionalManifestValues(prev => ({ ...prev, [section.id]: e.target.value }))}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>

            {/* Mobile Publish Button */}
            <div className="md:hidden pt-8">
              <Button 
                className="w-full h-12 text-sm font-bold shadow-lg"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 size-4" />
                    Publish Dataset
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Success / Status Dialog */}
      {(status === "accepted" || status === "failed") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-md mx-4 shadow-2xl border-2">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto size-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                {status === "accepted" ? (
                  <CheckCircle2 className="size-10 text-foreground" />
                ) : (
                  <X className="size-10 text-destructive" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {status === "accepted" ? "Success!" : "Publishing Failed"}
              </CardTitle>
              <CardDescription>
                {status === "accepted" 
                  ? "Your dataset is now live on the 0G Network." 
                  : "We encountered an error while broadcasting your dataset."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {status === "accepted" && (
                <div className="p-4 rounded-lg bg-foreground/5 border space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dataset Root</p>
                    <div className="flex items-center gap-2 group">
                      <code className="text-xs font-mono bg-background border px-2 py-1 rounded block truncate flex-1">
                        {sealedKeyData?.datasetRoot}
                      </code>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ECIES Key Envelope</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono bg-background border px-2 py-1 rounded block truncate flex-1 leading-relaxed">
                        {sealedKeyData?.encryptedKeyEnvelope}
                      </code>
                      <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={handleCopy}>
                        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Only the orchestrator can unseal this envelope to access your data.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full h-11 font-semibold" 
                  onClick={() => status === "accepted" ? router.push("/app/datasets") : setStatus(null)}
                >
                  {status === "accepted" ? "View My Datasets" : "Dismiss"}
                </Button>
                {status === "accepted" && (
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" asChild>
                    <Link href={`/app/datasets/${sealedKeyData?.datasetRoot}`}>
                      Go to dataset page
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
