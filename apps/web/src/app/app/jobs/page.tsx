import Link from "next/link";
import { InfoIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { JobStateBadge } from "@/components/app/job-state-badge";
import { MOCK_JOBS } from "@/lib/mock";

export default function JobsPage() {
  const jobs = MOCK_JOBS;

  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="My Sessions" />
      <div className="flex-1 p-6 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{jobs.length} training session{jobs.length !== 1 ? "s" : ""}</p>

        {/* Overview */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
          <InfoIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            A training session is started when you request access to a dataset from the Marketplace. Your payment is locked securely upfront to cover the epochs you requested. The AI model trains on the encrypted data, royalties are paid to the owner, and any unused portion is refunded to you automatically. Click any row to see the full lifecycle and payment ledger.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6 text-xs">Session ID</TableHead>
                  <TableHead className="text-xs">Dataset</TableHead>
                  <TableHead className="text-xs">Purpose</TableHead>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs text-center">Epochs</TableHead>
                  <TableHead className="text-xs text-right">Payment locked</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.jobId} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="pl-6">
                      <Link href={`/app/jobs/${j.jobId}`} className="block">
                        <HashChip hash={j.jobId} front={8} back={6} />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{j.createdAt.split("T")[0]}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="text-xs truncate">{j.datasetLabel}</p>
                      <HashChip hash={j.datasetRoot} className="mt-0.5" />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {j.purposeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{j.providerId}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {j.actualEpochs !== null ? (
                        <span>
                          {j.actualEpochs}
                          {j.actualEpochs !== j.requestedEpochs && (
                            <span className="text-muted-foreground">/{j.requestedEpochs}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{j.requestedEpochs} req</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {j.escrow} lUSD
                    </TableCell>
                    <TableCell>
                      <JobStateBadge state={j.state} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
