"use client";

import { useReveal } from "@/hooks/useReveal";

const STEPS = [
  {
    n: "01",
    title: "Encrypt and publish",
    body: "Encrypt the dataset client-side, upload to 0G Storage, and derive a Merkle root. That root becomes the dataset's on-chain identity.",
  },
  {
    n: "02",
    title: "Deploy policy",
    body: "Create a DataPolicy contract on 0G Chain with enforceable terms: allowed purposes, approved providers, royalty rate, epoch limits, TEE/attestation requirements, and expiry.",
  },
  {
    n: "03",
    title: "Licensed execution",
    body: "A researcher requests access. The contract validates policy constraints and locks payment in escrow. The wrapper then starts a policy-compliant job on approved 0G Compute infrastructure using job-scoped access controls.",
  },
  {
    n: "04",
    title: "Settlement and receipt",
    body: "On completion, the wrapper submits execution results (and attestation metadata when required). The contract settles royalties, refunds unused escrow if applicable, and records an immutable job receipt.",
  },
];

const SectionLabel = ({ children, num }: { children: React.ReactNode; num: string }) => (
  <div className="flex items-center gap-3 text-[11px] font-mono tracking-[0.25em] uppercase text-muted-foreground">
    <span className="text-foreground/40">{num}</span>
    <span className="w-8 h-px bg-border" />
    <span>{children}</span>
  </div>
);

const Step = ({ step, index }: { step: (typeof STEPS)[number]; index: number }) => {
  const ref = useReveal<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className="reveal relative grid grid-cols-12 gap-6 py-10 border-b border-border last:border-b-0 first:pt-0"
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className="col-span-2 sm:col-span-2">
        <div className="font-mono text-xs text-muted-foreground tracking-[0.2em]">STEP</div>
        <div className="text-3xl sm:text-4xl text-foreground mt-1 tabular-nums tracking-ultratight">
          {step.n}
        </div>
      </div>

      <div className="col-span-10 sm:col-span-10">
        <h3 className="text-xl sm:text-2xl text-foreground tracking-[-0.02em]">{step.title}</h3>
        <p className="mt-3 text-[15px] sm:text-base leading-[1.7] text-muted-foreground max-w-2xl">
          {step.body}
        </p>
      </div>
    </li>
  );
};

export default function HowItWorks() {
  const labelRef = useReveal<HTMLDivElement>();
  const headRef = useReveal<HTMLHeadingElement>();
  const introRef = useReveal<HTMLParagraphElement>();

  return (
    <section id="how" className="relative border-t border-border/60 bg-background">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 py-32 sm:py-44">
        <div ref={labelRef} className="reveal">
          <SectionLabel num="02">The mechanism</SectionLabel>
        </div>

        <div className="mt-14 grid grid-cols-12 gap-x-10 gap-y-14">
          <div ref={headRef} className="reveal col-span-12 lg:col-span-5" style={{ transitionDelay: "120ms" }}>
            <h2 className="text-[clamp(2rem,4.2vw,3.75rem)] leading-[1.02] tracking-[-0.035em] text-foreground text-balance">
              Four phases. One enforceable flow.
            </h2>
            <p
              ref={introRef}
              className="reveal mt-8 text-base sm:text-[17px] leading-[1.7] text-muted-foreground max-w-md"
              style={{ transitionDelay: "240ms" }}
            >
              LICEN works with your existing dataset lifecycle. It adds policy and settlement around
              usage.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-7 lg:border-l lg:border-border lg:pl-12">
            <ol className="relative">
              {STEPS.map((s, i) => (
                <Step key={s.n} step={s} index={i} />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}