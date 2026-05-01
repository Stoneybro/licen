"use client";

import Link from "next/link";
import { useReveal } from "@/hooks/useReveal";

const HEX = "0123456789abcdef";

const makeDeterministicHash = (seed: number) => {
  let value = (seed + 1) * 2654435761;
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    value = (value ^ (value >>> 15)) * 2246822519;
    out += HEX[(value >>> 28) & 15];
  }
  return out;
};

const HASHES = Array.from({ length: 60 }, (_, i) => makeDeterministicHash(i));

export default function Hero() {
  const headlineRef = useReveal<HTMLHeadingElement>();
  const subRef = useReveal<HTMLParagraphElement>();
  const ctaRef = useReveal<HTMLDivElement>();
  const metaRef = useReveal<HTMLDivElement>();

  return (
    <section id="top" className="relative min-h-screen w-full flex flex-col overflow-x-clip">
      <div className="absolute inset-0 bg-hero-grid opacity-60 pointer-events-none" />

      <div
        aria-hidden="true"
        className="hidden md:block absolute inset-y-0 left-0 w-[140px] md:w-[200px] overflow-hidden pointer-events-none [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]"
      >
        <div className="animate-hash-scroll font-mono text-[10px] leading-[20px] text-muted-foreground/20 px-4">
          {[...HASHES, ...HASHES].map((h, i) => (
            <div key={i} className="truncate">
              {h}
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden md:block absolute inset-y-0 right-0 w-[140px] md:w-[200px] overflow-hidden pointer-events-none [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]"
      >
        <div
          className="animate-hash-scroll font-mono text-[10px] leading-[20px] text-muted-foreground/20 px-4 text-right"
          style={{ animationDirection: "reverse" }}
        >
          {[...HASHES, ...HASHES].map((h, i) => (
            <div key={i} className="truncate">
              {h}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 pt-24 md:pt-28">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 flex items-center justify-between text-[11px] font-mono text-muted-foreground/70">
          <div className="flex items-center gap-2">
            
            <span className="tracking-[0.2em] uppercase"></span>
          </div>
          <div className="hidden md:block tracking-[0.2em] uppercase"></div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="mx-auto max-w-[1400px] w-full px-6 md:px-10 text-center">
          <div ref={metaRef} className="reveal mb-8 md:mb-10">
            <span className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
             
            </span>
          </div>

          <h1
            ref={headlineRef}
            className="reveal text-balance font-medium tracking-ultratight text-foreground text-[36px] leading-[1.02] sm:text-[68px] md:text-[88px] lg:text-[108px] xl:text-[124px] mx-auto max-w-[14ch]"
          >
          Control & Monetize your Datasets
          </h1>

          <p
            ref={subRef}
            className="reveal mt-8 md:mt-10 mx-auto max-w-[640px] text-[15px] md:text-[17px] leading-[1.6] text-muted-foreground"
            style={{ transitionDelay: "120ms" }}
          >
            LICEN lets owners publish encrypted datasets, define how they can be used, and earn royalties whenever approved researchers use the data for AI model training.
          </p>

          <div
            ref={ctaRef}
            className="reveal mt-10 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{ transitionDelay: "240ms" }}
          >
            <Link
              href="/login?returnTo=/app/marketplace"
              className="inline-flex items-center justify-center h-11 px-6 bg-foreground text-background text-[13px] font-medium tracking-tight min-w-[200px]"
            >
              Browse datasets
            </Link>
            <Link
              href="/login?returnTo=/app/datasets/new"
              className="inline-flex items-center justify-center h-11 px-6 border border-border text-foreground text-[13px] font-medium tracking-tight min-w-[200px]"
            >
              Publish a dataset
            </Link>
          </div>

          <div className="mt-16 md:mt-24 mx-auto max-w-[760px]">
            <div className="border-t border-border/60 pt-5  gap-2 text-left">
            
              <div className="font-mono text-[11px] text-center md:text-[12px] text-foreground/90 truncate">
                [ OG · testnet ] <span className="inline-block w-1.5 h-1.5 bg-foreground/80 animate-blink" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-6 md:pb-8">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-between text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground/60">
          <span>scroll ↓</span>
          <span>chain · storage · compute</span>
        </div>
      </div>
    </section>
  );
}
