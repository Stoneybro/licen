"use client";

import { useReveal } from "@/hooks/useReveal";

const FEATURES = [
  {
    n: "F1",
    title: "Encrypted dataset publishing",
    body:
      "Datasets are encrypted before upload to 0G Storage. The Merkle root is used as a stable on-chain reference.",
  },
  {
    n: "F2",
    title: "Programmable policy enforcement",
    body:
      "Each dataset is governed by a DataPolicy contract that enforces purpose, provider, pricing, usage limits, and expiry logic.",
  },
  {
    n: "F3",
    title: "Escrowed royalty settlement",
    body:
      "Payment is locked at access grant and settled at completion under contract rules, with refund paths for incomplete usage where configured.",
  },
  {
    n: "F4",
    title: "Verifiable job lifecycle",
    body:
      "Each request gets a unique job ID with auditable transitions (requested, granted, running, completed/failed/timed-out).",
  },
  {
    n: "F5",
    title: "Controlled compute path",
    body:
      "Jobs run through approved compute providers, with TEE and attestation checks available when policy requires stronger execution guarantees.",
  },
  {
    n: "F6",
    title: "Immutable receipts",
    body:
      "Each completed job produces a permanent on-chain record linking dataset, requester, provider, usage metrics, and settlement outcome.",
  },
];

const Card = ({ f }: { f: (typeof FEATURES)[number] }) => {
  return (
    <div className="relative bg-card border border-border hover:border-foreground/40 p-7 md:p-8 flex flex-col min-h-[260px]">
      <div className="flex items-center justify-between mb-10 md:mb-14">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60">
          {f.n} / feature
        </span>
        <span className="w-1.5 h-1.5 bg-foreground/40" />
      </div>
      <h3 className="text-[19px] md:text-[21px] tracking-ultratight font-medium text-foreground leading-snug">
        {f.title}
      </h3>
      <p className="mt-4 text-[14px] md:text-[15px] leading-[1.65] text-muted-foreground">{f.body}</p>
    </div>
  );
};

export default function Features() {
  const labelRef = useReveal<HTMLDivElement>();
  const headRef = useReveal<HTMLHeadingElement>();

  return (
    <section id="features" className="relative border-t border-border">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-24 md:py-40">
        <div
          ref={labelRef}
          className="reveal flex items-center gap-3 text-[11px] font-mono tracking-[0.25em] uppercase text-muted-foreground"
        >
          <span className="text-foreground/40">04</span>
          <span className="w-8 h-px bg-border" />
          <span>Built for real licensing operations</span>
        </div>

        <h2
          ref={headRef}
          className="reveal mt-12 md:mt-20 max-w-[24ch] text-balance text-[34px] sm:text-[44px] md:text-[58px] leading-[1.05] tracking-ultratight font-medium text-foreground"
        >
          Built for dataset owners who need enforceability—and researchers who need compliant
          access.
        </h2>

        <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {FEATURES.map((f) => (
            <Card key={f.n} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
