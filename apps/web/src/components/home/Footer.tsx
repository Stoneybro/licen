import Link from "next/link";

const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Marketplace", href: "/app/marketplace" },
  { label: "Dashboard", href: "/app" },
  { label: "My Jobs", href: "/app/sessions" },
  { label: "Docs", href: "/docs" },
  { label: "GitHub", href: "https://github.com/", external: true },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
              LICEN
            </div>
            <p className="text-[18px] md:text-[22px] tracking-ultratight font-medium text-foreground leading-snug max-w-[20ch]">
              Programmable rights for AI training data.
            </p>
          </div>

          <div className="md:col-span-4">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60 mb-4">
              Links
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[14px] text-muted-foreground">
              {LINKS.map((l, i) => (
                <li key={l.label} className="flex items-center gap-4">
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  )}
                  {i < LINKS.length - 1 && <span className="text-border">·</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60 mb-4">
              Acknowledgment
            </div>
            <p className="text-[13px] leading-[1.65] text-muted-foreground">
              Built for the 0G Ecosystem Hackathon. Powered by 0G Storage, 0G Chain, and 0G
              Compute.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60">
          <span>© LICEN · v0.1.0 · 0G testnet</span>
          <span>protocol/online ↗</span>
        </div>
      </div>
    </footer>
  );
}
