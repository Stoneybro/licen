"use client";

import { useReveal } from "@/hooks/useReveal";

const SectionLabel = ({ children, num }: { children: React.ReactNode; num: string }) => (
  <div className="flex items-center gap-3 text-[11px] font-mono tracking-[0.25em] uppercase text-muted-foreground">
    <span className="text-foreground/40">{num}</span>
    <span className="w-8 h-px bg-border" />
    <span>{children}</span>
  </div>
);

export default function Problem() {
  const labelRef = useReveal<HTMLDivElement>();
  const headlineRef = useReveal<HTMLHeadingElement>();
  const lineRef = useReveal<HTMLDivElement>();
  const p1Ref = useReveal<HTMLParagraphElement>();
  const p2Ref = useReveal<HTMLParagraphElement>();
  const p3Ref = useReveal<HTMLParagraphElement>();
  const p4Ref = useReveal<HTMLParagraphElement>();

  return (
    <section id="problem" className="relative border-t border-border">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-24 md:py-40">
        <div ref={labelRef} className="reveal">
          <SectionLabel num="01">The gap nobody fixed</SectionLabel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 mt-12 md:mt-20">
          <h2
            ref={headlineRef}
            className="reveal lg:col-span-8 text-balance text-[34px] sm:text-[44px] md:text-[58px] lg:text-[68px] leading-[1.05] tracking-ultratight font-medium text-foreground"
          >
            AI models improve on data. Data creators rarely get consent, payment, or proof.
          </h2>

          <div className="lg:col-span-4 lg:pt-6 space-y-7">
            <div ref={lineRef} className="draw-line h-px w-full bg-foreground/40 origin-left" />
            <p ref={p1Ref} className="reveal text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground">
              AI training depends on curated, expensive, human-created data. But once datasets
              enter model pipelines, ownership terms are often disconnected from execution.
            </p>
            <p
              ref={p2Ref}
              className="reveal text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground"
              style={{ transitionDelay: "100ms" }}
            >
              No reliable consent record. No standard royalty path. No immutable usage trail
              creators can audit.
            </p>
            <p
              ref={p3Ref}
              className="reveal text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground"
              style={{ transitionDelay: "200ms" }}
            >
              As AI value compounds, this gap becomes an infrastructure problem—not a legal
              footnote.
            </p>
            <p
              ref={p4Ref}
              className="reveal text-[15px] md:text-[16px] leading-[1.7] text-foreground"
              style={{ transitionDelay: "300ms" }}
            >
              LICEN closes that gap with programmable policy, controlled execution, and on-chain
              settlement.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
