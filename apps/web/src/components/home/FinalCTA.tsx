"use client";

import Link from "next/link";
import { useReveal } from "@/hooks/useReveal";

export default function FinalCTA() {
  const headRef = useReveal<HTMLHeadingElement>();
  const subRef = useReveal<HTMLParagraphElement>();
  const btnRef = useReveal<HTMLDivElement>();

  return (
    <section id="cta" className="relative border-t border-border bg-foreground text-background">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-32 md:py-48 text-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-background/50 mb-10">
          [ deploy / 0g.testnet ]
        </div>
        <h2
          ref={headRef}
          className="reveal text-balance text-[40px] sm:text-[56px] md:text-[80px] lg:text-[96px] leading-[1.02] tracking-ultratight font-medium mx-auto max-w-[18ch]"
        >
          Your data is valuable. It&apos;s time to get paid for it.
        </h2>
        <p
          ref={subRef}
          className="reveal mt-10 mx-auto max-w-[640px] text-[15px] md:text-[17px] leading-[1.6] text-background/70"
          style={{ transitionDelay: "120ms" }}
        >
          Join LICEN today. Publish your dataset securely, set your terms, and earn royalties while protecting your privacy.
        </p>
        <div
          ref={btnRef}
          className="reveal mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{ transitionDelay: "240ms" }}
        >
          <Link
            href="/login?returnTo=/app/datasets/new"
            className="inline-flex items-center justify-center h-12 px-7 bg-background text-foreground text-[13px] font-medium tracking-tight hover:bg-background/90 transition-colors min-w-[220px]"
          >
            Publish a dataset
          </Link>
          <Link
            href="/login?returnTo=/app/catalog"
            className="inline-flex items-center justify-center h-12 px-7 border border-background/30 text-background text-[13px] font-medium tracking-tight hover:border-background/70 transition-colors min-w-[220px]"
          >
            Browse catalog
          </Link>
        </div>
      </div>
    </section>
  );
}
