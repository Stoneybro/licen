"use client";

import { useReveal } from "@/hooks/useReveal";

const STEPS = [
  {
    n: "01",
    title: "Secure Your Data",
    body: "Your dataset is encrypted locally on your device before it's ever uploaded. It's stored securely in a decentralized vault, meaning nobody can access the raw files without your permission.",
  },
  {
    n: "02",
    title: "Set Your Terms",
    body: "You dictate exactly how the data can be used. Specify allowed purposes (like Academic Research only), set limits, and define your price per AI training cycle.",
  },
  {
    n: "03",
    title: "Approve AI Training",
    body: "When an AI researcher wants to use your data, they agree to your terms and pay the royalty fee. The system securely grants temporary access to train their model without exposing the raw data.",
  },
  {
    n: "04",
    title: "Get Paid Instantly",
    body: "Once the training is complete, your royalties are settled automatically and directly to your wallet. You get paid fairly every time your dataset is used.",
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