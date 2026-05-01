"use client";

import { useReveal } from "@/hooks/useReveal";

const LAYERS = [
  {
    pkg: "0G Storage",
    role: "secure vault",
    body: "Your encrypted datasets and usage rules are safely stored here. Only authorized AI training jobs can access the encrypted files.",
  },
  {
    pkg: "0G Chain",
    role: "the ledger",
    body: "This is where your usage rules are turned into unbreakable law. It automatically handles payments, tracks permissions, and distributes royalties.",
  },
  {
    pkg: "0G Compute",
    role: "safe training zone",
    body: "The secure environment where AI models actually train on your data. Your raw files enter, the AI gets smarter, and the data is safely wiped afterwards.",
  },
];

const Row = ({ l, idx }: { l: (typeof LAYERS)[number]; idx: number }) => {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal grid grid-cols-12 gap-6 md:gap-10 py-10 md:py-14 border-b border-border last:border-b-0"
      style={{ transitionDelay: `${idx * 80}ms` }}
    >
      <div className="col-span-12 md:col-span-1 font-mono text-[11px] tracking-[0.2em] text-muted-foreground/70">
        0{idx + 1}
      </div>
      <div className="col-span-12 md:col-span-4">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60 mb-2">
          dependency / {l.role.replace(/\s+/g, "_")}
        </div>
        <h3 className="text-[26px] md:text-[34px] tracking-ultratight font-medium text-foreground">
          {l.pkg}
        </h3>
        <div className="mt-1 text-[14px] text-muted-foreground">{l.role}</div>
      </div>
      <div className="col-span-12 md:col-span-7">
        <p className="text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground">{l.body}</p>
      </div>
    </div>
  );
};

export default function Technology() {
  const labelRef = useReveal<HTMLDivElement>();
  const headRef = useReveal<HTMLHeadingElement>();
  const bodyRef = useReveal<HTMLParagraphElement>();

  return (
    <section id="tech" className="relative border-t border-border">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-24 md:py-40">
        <div
          ref={labelRef}
          className="reveal flex items-center gap-3 text-[11px] font-mono tracking-[0.25em] uppercase text-muted-foreground"
        >
          <span className="text-foreground/40">05</span>
          <span className="w-8 h-px bg-border" />
          <span>The stack</span>
        </div>

        <div className="mt-12 md:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <h2
            ref={headRef}
            className="reveal lg:col-span-7 text-balance text-[34px] sm:text-[44px] md:text-[58px] leading-[1.05] tracking-ultratight font-medium text-foreground"
          >
            Powered by next-generation infrastructure.
          </h2>
          <p
            ref={bodyRef}
            className="reveal lg:col-span-4 lg:col-start-9 text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground self-end"
          >
            LICEN is built on top of the 0G network, ensuring your data is always secure, your rules are enforced, and your payouts are guaranteed.
          </p>
        </div>

        <div className="mt-16 md:mt-24 border-t border-border">
          {LAYERS.map((l, i) => (
            <Row key={l.pkg} l={l} idx={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
