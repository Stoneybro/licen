"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { 
  CircleCheckBig, Plus, ShieldCheck, 
  BrainCircuit, GraduationCap, Building2, Dna, Leaf,
  UploadCloud, Info, DollarSign,
  Repeat, Users, Clock, CalendarX, X, CheckCircle2, Lock,
  FileJson, LineChart, Palette, Cpu,
  Copy, Download, Check
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
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

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

  const [activeSection, setActiveSection] = useState<string>("details");

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
  const [ttlValue, setTtlValue] = useState<number>(30);
  const [ttlUnit, setTtlUnit] = useState<"hours" | "days" | "weeks">("days");
  const [policyExpiry, setPolicyExpiry] = useState<string>("");
  const [noPolicyExpiry, setNoPolicyExpiry] = useState(true);

  const [publishing, setPublishing] = useState(false);
  const [publishingStep, setPublishingStep] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<PublishStatusResponse["status"] | null>(null);
  const [encryptionKeyData, setEncryptionKeyData] = useState<{ datasetRoot: string; ivHex: string; keyHex: string } | null>(null);
  
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

  const handleCopy = () => {
    if (encryptionKeyData) {
      navigator.clipboard.writeText(JSON.stringify(encryptionKeyData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadKeys = () => {
    if (!encryptionKeyData) return;
    const blob = new Blob([JSON.stringify(encryptionKeyData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataset-keys-${encryptionKeyData.datasetRoot.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

    try {
      setStatus(null);
      setRequestId(null);
      setPublishing(true);
      setPublishProgress(10);
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Step 1: Encrypt
      setPublishingStep("Securing dataset on your device...");
      setPublishProgress(20);
      const encrypted = await encryptDatasetFile(selectedFile);
      setEncryptionKeyData(null);

      // Step 2: Upload encrypted dataset to 0G Storage
      setPublishingStep("Uploading secured dataset...");
      setPublishProgress(40);
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
      setEncryptionKeyData({ datasetRoot, ivHex: encrypted.ivHex, keyHex: encrypted.keyHex });

      // Step 3: Generate Manifest
      setPublishingStep("Saving dataset details...");
      setPublishProgress(60);
      
      const ttlHours = ttlUnit === "days" ? ttlValue * 24 : ttlUnit === "weeks" ? ttlValue * 168 : ttlValue;
      
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
      setPublishProgress(75);

      // Step 4: Register dataset on-chain
      setPublishingStep("Registering your dataset...");
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
    <div className="flex flex-col min-h-full bg-muted/10 pb-20">
      <AppTopbar title="Publish Dataset" />
      <div className="flex-1 p-4 md:p-8 flex justify-center">
        <div className="mx-auto flex w-full max-w-6xl flex-col md:flex-row gap-8 lg:gap-12 relative">
          
          {/* Left Sidebar (Sticky Scrollspy) */}
          <div className="md:w-64 lg:w-72 flex-shrink-0 hidden md:block">
            <div className="sticky top-10 flex flex-col gap-6">
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
                        ? "bg-primary/10 text-primary border-primary/20 shadow-sm" 
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {activeSection === section.id && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />}
                    {section.label}
                  </a>
                ))}
              </nav>

              <div className="mt-4 p-5 bg-primary/5 border border-primary/20 rounded-xl shadow-sm">
                <h4 className="font-semibold text-primary text-sm flex items-center gap-2 mb-2"><Lock className="size-4" /> Secure Process</h4>
                <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
                  Your files are encrypted on your device before upload, ensuring no one else can read them. Your access rules are securely stored on our network.
                </p>
                <Button 
                  onClick={handlePublish} 
                  disabled={publishing || status === "accepted"} 
                  className={cn("w-full font-semibold shadow-md transition-all h-11", status === "accepted" ? "bg-green-600 hover:bg-green-700 text-white" : "")}
                >
                  {publishing ? "Publishing..." : status === "accepted" ? "Published Successfully!" : "Publish Dataset"}
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-8 md:pt-2">
             
             {/* Status / Error Alerts */}
             {(publishingStep || errorMessage || status === "accepted") && (
               <div className="scroll-mt-24" id="status-panel">
                 {errorMessage && (
                   <div className="bg-destructive/10 border border-destructive/20 text-destructive p-5 rounded-xl flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2">
                     <X className="size-5 shrink-0 mt-0.5" />
                     <div>
                       <h5 className="font-semibold">Publish Failed</h5>
                       <p className="text-sm mt-1 opacity-90">{errorMessage}</p>
                     </div>
                   </div>
                 )}
                 
                 {publishingStep && status !== "accepted" && !errorMessage && (
                   <div className="bg-muted/50 border p-6 rounded-xl space-y-4 shadow-sm animate-in slide-in-from-top-2">
                     <div className="flex justify-between items-center text-sm">
                       <span className="font-semibold text-foreground flex items-center gap-2">
                         <span className="relative flex size-3">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                           <span className="relative inline-flex rounded-full size-3 bg-primary"></span>
                         </span>
                         {publishingStep}
                       </span>
                       <span className="text-muted-foreground font-mono font-medium">{publishProgress}%</span>
                     </div>
                     <Progress value={publishProgress} className="h-2.5" />
                     {requestId && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2 pt-3 border-t mt-4">
                          <span className="uppercase tracking-wider font-semibold">Request ID:</span> <span className="font-mono bg-background px-2 py-0.5 rounded border">{requestId.slice(0, 8)}...</span>
                          <Badge variant="outline" className="text-[10px] ml-auto uppercase bg-background shadow-sm">{status || "Queued"}</Badge>
                        </div>
                     )}
                   </div>
                 )}
                 
                 {status === "accepted" && (
                   <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl flex items-start gap-4 text-green-700 dark:text-green-400 shadow-sm animate-in slide-in-from-top-2">
                     <CircleCheckBig className="size-7 shrink-0 mt-0.5 text-green-600" />
                     <div className="w-full text-left flex flex-col items-start">
                       <h5 className="font-semibold text-xl tracking-tight text-foreground">Dataset Published Successfully</h5>
                       <p className="text-sm mt-1 mb-5 opacity-90 font-medium text-foreground">Your dataset is now protected and successfully published to the network.</p>
                       
                       {encryptionKeyData && (
                         <div className="w-full bg-background rounded-xl overflow-hidden border border-green-500/20 shadow-sm">
                           <div className="bg-destructive/10 px-4 py-3 border-b border-destructive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                             <p className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                               <ShieldCheck className="size-4" /> Important: Save your encryption keys
                             </p>
                             <p className="text-xs text-destructive/80 font-medium">They will not be shown again.</p>
                           </div>
                           
                           <div className="p-5 flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between bg-muted/30">
                             <div className="space-y-3 flex-1 min-w-0 w-full">
                               <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-3 text-sm">
                                 <span className="text-muted-foreground font-medium flex items-center">Dataset ID:</span>
                                 <span className="font-mono text-xs truncate bg-background px-2 py-1 rounded border inline-block max-w-[280px]">{encryptionKeyData.datasetRoot}</span>
                                 
                                 <span className="text-muted-foreground font-medium flex items-center">IV Hex:</span>
                                 <span className="font-mono text-xs truncate bg-background px-2 py-1 rounded border inline-block max-w-[280px]">{encryptionKeyData.ivHex}</span>
                                 
                                 <span className="text-muted-foreground font-medium flex items-center">Key Hex:</span>
                                 <span className="font-mono text-xs truncate bg-background px-2 py-1 rounded border inline-block max-w-[280px]">••••••••••••••••••••••••••••</span>
                               </div>
                             </div>
                             
                             <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto mt-2 xl:mt-0">
                               <Button variant="default" size="sm" onClick={handleDownloadKeys} className="w-full sm:w-40 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm">
                                 <Download className="size-4 mr-2" /> Download Keys
                               </Button>
                               <Button variant="outline" size="sm" onClick={handleCopy} className="w-full sm:w-40 bg-background shadow-sm">
                                 {copied ? <Check className="size-4 mr-2 text-green-500" /> : <Copy className="size-4 mr-2" />} 
                                 {copied ? "Copied!" : "Copy Details"}
                               </Button>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}
               </div>
             )}

             {/* Section 1: Details */}
             <Card id="details" className="scroll-mt-24 border-muted/60 shadow-sm overflow-hidden bg-card">
               <CardHeader className="bg-muted/20 border-b pb-4">
                 <CardTitle className="text-xl">Dataset Details</CardTitle>
                 <CardDescription>Provide the core information and upload your dataset file.</CardDescription>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                 <div className="grid gap-2">
                    <label className="text-sm font-semibold">Title</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Llama-3 Fine-Tuning Corpus" className="h-11 shadow-sm max-w-2xl" />
                 </div>
                 <div className="grid gap-2">
                    <label className="text-sm font-semibold">Description</label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Give a brief description of your dataset." className="min-h-[120px] resize-none shadow-sm max-w-2xl" />
                 </div>
                 <div className="grid gap-2">
                    <label className="text-sm font-semibold">Dataset File</label>
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer max-w-2xl",
                        selectedFile ? "border-primary/50 bg-primary/5" : "hover:bg-muted/30 hover:border-muted-foreground/30"
                      )}
                      onClick={() => document.getElementById("file-upload")?.click()}
                    >
                      <div className={cn("size-12 rounded-full flex items-center justify-center mb-4 transition-colors", selectedFile ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                        {selectedFile ? <CircleCheckBig className="size-6" /> : <UploadCloud className="size-6" />}
                      </div>
                      <h4 className="font-medium text-base mb-1">{selectedFile ? "File Selected" : "Click to upload"}</h4>
                      <p className="text-sm text-muted-foreground mb-5">CSV, JSON, JSONL, parquet or tar.gz</p>
                      <Input type="file" id="file-upload" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} onClick={(e) => e.stopPropagation()} />
                      <Button variant={selectedFile ? "outline" : "secondary"} onClick={(e) => { e.stopPropagation(); document.getElementById("file-upload")?.click(); }}>
                        {selectedFile ? "Change File" : "Select File"}
                      </Button>
                      {selectedFile && (
                        <div className="mt-5 flex items-center gap-2 bg-background border px-4 py-2 rounded-full text-sm shadow-sm">
                          <span className="font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                          <span className="text-muted-foreground">({formatBytes(selectedFile.size)})</span>
                        </div>
                      )}
                    </div>
                 </div>
               </CardContent>
             </Card>
             
             {/* Section 2: Purposes */}
             <Card id="purposes" className="scroll-mt-24 border-muted/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="bg-muted/20 border-b pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Allowed Purposes</CardTitle>
                      <CardDescription className="mt-1">Select how your dataset is permitted to be used for training.</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        if (allowedPurposeIds.length === PUBLISH_PURPOSES.length) {
                          setAllowedPurposeIds([]);
                        } else {
                          setAllowedPurposeIds([...PUBLISH_PURPOSES]);
                        }
                      }}
                    >
                      {allowedPurposeIds.length === PUBLISH_PURPOSES.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    {PUBLISH_PURPOSES.map(purpose => {
                       const meta = PURPOSE_META[purpose] || { label: formatPurposeLabel(purpose), description: "Allowed training purpose", icon: ShieldCheck };
                       const Icon = meta.icon;
                       const isSelected = allowedPurposeIds.includes(purpose);
                       return (
                         <div 
                           key={purpose} 
                           onClick={() => setAllowedPurposeIds(current => togglePurpose(current, purpose, !isSelected))}
                           className={cn("relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-primary/50 shadow-sm flex items-center", isSelected ? "border-primary bg-primary/5 shadow-md" : "border-muted/60")}
                         >
                           <div className="flex items-start gap-4 flex-1">
                             <div className={cn("p-2.5 rounded-xl transition-colors", isSelected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted")}>
                               <Icon className="size-5" />
                             </div>
                             <div className="flex-1 mt-0.5">
                               <h4 className="font-semibold text-sm mb-1">{meta.label}</h4>
                               <p className="text-xs text-muted-foreground leading-relaxed pr-6">{meta.description}</p>
                             </div>
                           </div>
                           <div className="absolute right-4 top-1/2 -translate-y-1/2">
                             <div className={cn("size-5 rounded-full border flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary text-primary-foreground scale-110" : "border-input scale-100")}>
                               {isSelected && <CheckCircle2 className="size-3" />}
                             </div>
                           </div>
                         </div>
                       )
                    })}
                  </div>
                </CardContent>
             </Card>

             {/* Section 3: Policy */}
             <Card id="policy" className="scroll-mt-24 border-muted/60 shadow-sm overflow-hidden bg-card">
                <CardHeader className="bg-muted/20 border-b pb-4">
                  <CardTitle className="text-xl">Access Policy</CardTitle>
                  <CardDescription>Configure pricing, usage limits, and expiration for this dataset.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/10 shadow-sm">
                      <label className="text-sm font-semibold flex items-center gap-2"><DollarSign className="size-4 text-primary" /> Royalty Fee</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                        <Input type="number" min={1} value={royaltyPerEpoch} onChange={e => setRoyaltyPerEpoch(Number(e.target.value))} className="pl-7 h-11 font-medium text-lg bg-background" />
                      </div>
                      <p className="text-xs text-muted-foreground">Price per epoch</p>
                    </div>
                    
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/10 shadow-sm">
                      <label className="text-sm font-semibold flex items-center gap-2"><Repeat className="size-4 text-primary" /> Max Epochs</label>
                      <Input type="number" min={1} value={maxEpochsPerRun} onChange={e => setMaxEpochsPerRun(Number(e.target.value))} className="h-11 font-medium text-lg bg-background" />
                      <p className="text-xs text-muted-foreground">Limit per training run</p>
                    </div>
                    
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/10 shadow-sm">
                      <label className="text-sm font-semibold flex items-center gap-2"><Users className="size-4 text-primary" /> Request Limit</label>
                      <Input type="number" min={1} value={maxRunsPerRequester} onChange={e => setMaxRunsPerRequester(Number(e.target.value))} className="h-11 font-medium text-lg bg-background" />
                      <p className="text-xs text-muted-foreground">Max runs per user</p>
                    </div>
                    
                    <div className="space-y-3 p-4 rounded-xl border bg-muted/10 shadow-sm">
                      <label className="text-sm font-semibold flex items-center gap-2"><Clock className="size-4 text-primary" /> Session Duration</label>
                      <div className="flex relative shadow-sm rounded-md">
                        <Input 
                          type="number" 
                          min={1} 
                          value={ttlValue} 
                          onChange={e => setTtlValue(Number(e.target.value))} 
                          className="h-11 font-medium text-lg bg-background rounded-r-none border-r-0 focus-visible:z-10 w-full" 
                        />
                        <select 
                          value={ttlUnit} 
                          onChange={e => setTtlUnit(e.target.value as "hours" | "days" | "weeks")} 
                          className="h-11 px-3 bg-muted/50 border border-input rounded-r-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:z-10"
                        >
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground">Active session limit</p>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-muted/50 to-muted/20 p-5 rounded-xl border border-muted/60 space-y-4 shadow-sm max-w-2xl">
                     <div className="flex items-center justify-between">
                       <div>
                         <h4 className="font-semibold text-sm flex items-center gap-2"><CalendarX className="size-4 text-primary" /> Policy Expiration</h4>
                         <p className="text-xs text-muted-foreground mt-1">When does this access policy expire?</p>
                       </div>
                       <div className="flex items-center gap-3">
                         <span className="text-sm font-medium">{noPolicyExpiry ? "Indefinite" : "Set Date"}</span>
                         <Switch checked={!noPolicyExpiry} onCheckedChange={(val) => setNoPolicyExpiry(!val)} />
                       </div>
                     </div>
                     
                     {!noPolicyExpiry && (
                       <div className="pt-3 border-t border-muted-foreground/10 animate-in fade-in slide-in-from-top-2">
                         <Input type="datetime-local" value={policyExpiry} onChange={e => setPolicyExpiry(e.target.value)} className="h-11 max-w-sm shadow-sm bg-background" />
                       </div>
                     )}
                  </div>
                </CardContent>
             </Card>

             {/* Section 4: Advanced Details */}
             <div id="advanced" className="scroll-mt-24">
                <Accordion type="single" collapsible defaultValue="advanced-settings" className="w-full">
                  <AccordionItem value="advanced-settings" className="border-none">
                    <AccordionTrigger className="hover:no-underline px-1 py-4 group">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                          <FileJson className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-semibold tracking-tight text-foreground">Advanced Details</h3>
                          <p className="text-sm text-muted-foreground font-normal">Attach optional legal terms, categories, or credit requirements to your public listing.</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-0">
                      <Card className="border-muted/60 shadow-sm overflow-hidden bg-card">
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-4">
                            {OPTIONAL_MANIFEST_SECTIONS.map(section => {
                              const isEnabled = enabledManifestSections.includes(section.id);
                              
                              return (
                                <div key={section.id} className={cn("border rounded-xl overflow-hidden transition-all duration-300", isEnabled ? "border-primary/40 shadow-md ring-1 ring-primary/10 bg-muted/10" : "border-muted/60 hover:border-primary/30 shadow-sm bg-background")}>
                                  <div 
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => {
                                      if (!isEnabled) {
                                         setEnabledManifestSections(prev => [...prev, section.id]);
                                      } else {
                                         setEnabledManifestSections(prev => prev.filter(id => id !== section.id));
                                      }
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-sm">{section.label}</span>
                                      {!isEnabled && <span className="text-xs text-muted-foreground mt-0.5">{section.placeholder}</span>}
                                    </div>
                                    <Button variant="ghost" size="icon" className={cn("size-8 rounded-full pointer-events-none", isEnabled ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10")}>
                                      {isEnabled ? <X className="size-4" /> : <Plus className="size-4" />}
                                    </Button>
                                  </div>
                                  {isEnabled && (
                                    <div className="p-4 pt-0 border-t border-muted/30 animate-in fade-in slide-in-from-top-2">
                                      <Textarea 
                                        className="min-h-[100px] mt-4 shadow-sm bg-background" 
                                        placeholder={section.placeholder}
                                        value={optionalManifestValues[section.id]}
                                        onChange={(e) => setOptionalManifestValues(prev => ({ ...prev, [section.id]: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
             </div>

             {/* Mobile Publish Button */}
             <div className="md:hidden sticky bottom-4 z-10 p-4 bg-background/95 backdrop-blur-md border border-muted rounded-2xl shadow-xl mt-4">
                <Button 
                  onClick={handlePublish} 
                  disabled={publishing || status === "accepted"}
                  className={cn("w-full h-12 text-base font-semibold shadow-md", status === "accepted" ? "bg-green-600 hover:bg-green-700 text-white" : "")}
                >
                  {publishing ? "Publishing..." : status === "accepted" ? "Published!" : "Publish Dataset"}
                </Button>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
}
