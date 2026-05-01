"use client";

import { useReveal } from "@/hooks/useReveal";

const FEATURES = [
  {
    n: "F1",
    title: "Bank-Grade Encryption",
    body: "Your files are encrypted securely before they even leave your computer. Nobody can see your raw data, not even us.",
  },
  {
    n: "F2",
    title: "Ironclad Usage Rules",
    body: "You decide the rules of the game. Restrict who uses your data, set limits, and choose specific academic or commercial purposes.",
  },
  {
    n: "F3",
    title: "Guaranteed Payouts",
    body: "Payments are locked securely the moment your data is requested, ensuring you always get paid for your work.",
  },
  {
    n: "F4",
    title: "Complete Transparency",
    body: "Track exactly who is using your data and when. Every action leaves an undeniable, verifiable record.",
  },
  {
    n: "F5",
    title: "Secure Compute",
    body: "AI models train on your data inside secure, isolated environments. The data goes in, the model gets smarter, but your raw files are never exposed.",
  },
  {
    n: "F6",
    title: "Immutable Receipts",
    body: "Every time you get paid, a permanent, tamper-proof record is generated to prove exactly what happened.",
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
          <span className="text-foreground/40">03</span>
          <span className="w-8 h-px bg-border" />
          <span>Why use Licen?</span>
        </div>

        <h2
          ref={headRef}
          className="reveal mt-12 md:mt-20 max-w-[24ch] text-balance text-[34px] sm:text-[44px] md:text-[58px] leading-[1.05] tracking-ultratight font-medium text-foreground"
        >
          Built for creators who want to be paid, and AI builders who need the best data.
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
