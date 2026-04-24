"use client";

import { useReveal } from "@/hooks/useReveal";

const FIELDS: Array<[string, string, string]> = [
  ["datasetRoot", "bytes32", "cryptographic identity of the dataset"],
  ["owner", "address", "royalty recipient"],
  ["manifestHash", "bytes32", "anchor to off-chain policy document"],
  ["allowedPurposeIds", "bytes32[]", "permitted use classes"],
  ["approvedProviders", "address[]", "whitelisted compute environments"],
  ["royaltyPerEpoch", "uint256", "cost per full training pass"],
  ["minEscrow", "uint256", "minimum deposit required"],
  ["maxEpochsPerRun", "uint32", "epoch cap per job"],
  ["accessTtlSeconds", "uint64", "access validity window"],
  ["requireTEE", "bool", "attested secure execution required"],
  ["requireResultAttestation", "bool", "completion proof required"],
  ["active", "bool", "policy live status"],
];

const Row = ({
  field,
  type,
  comment,
  idx,
}: {
  field: string;
  type: string;
  comment: string;
  idx: number;
}) => {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal grid grid-cols-12 gap-4 py-2.5 md:py-3 group"
      style={{ transitionDelay: `${idx * 30}ms` }}
    >
      <span className="hidden md:block col-span-1 font-mono text-[11px] text-muted-foreground/50 tabular-nums">
        {String(idx + 1).padStart(2, "0")}
      </span>
      <span className="col-span-12 md:col-span-4 font-mono text-[13px] md:text-[14px] text-foreground font-medium">
        {field}
      </span>
      <span className="col-span-5 md:col-span-2 font-mono text-[12px] md:text-[13px] text-muted-foreground/80">
        {type}
      </span>
      <span className="col-span-7 md:col-span-5 font-mono text-[12px] md:text-[13px] text-muted-foreground font-light">
        — {comment}
      </span>
    </div>
  );
};

export default function UseCases() {
  const labelRef = useReveal<HTMLDivElement>();
  const headRef = useReveal<HTMLHeadingElement>();
  const bodyRef = useReveal<HTMLDivElement>();

  return (
    <section id="policy" className="relative border-t border-border">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-24 md:py-40">
        <div
          ref={labelRef}
          className="reveal flex items-center gap-3 text-[11px] font-mono tracking-[0.25em] uppercase text-muted-foreground"
        >
          <span className="text-foreground/40">03</span>
          <span className="w-8 h-px bg-border" />
          <span>The contract</span>
        </div>

        <div className="mt-12 md:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <h2
            ref={headRef}
            className="reveal lg:col-span-7 text-balance text-[34px] sm:text-[44px] md:text-[58px] leading-[1.05] tracking-ultratight font-medium text-foreground"
          >
            Every dataset carries its own law.
          </h2>
          <div ref={bodyRef} className="reveal lg:col-span-4 lg:col-start-9 self-end space-y-4">
            <p className="text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground">
              Enforcement-critical terms live on-chain in DataPolicy.
            </p>
            <p className="text-[15px] md:text-[16px] leading-[1.7] text-muted-foreground">
              A richer policy manifest (legal text, taxonomy, attribution, derivative rights) is
              stored off-chain on 0G Storage and anchored by hash.
            </p>
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <div className="flex items-center justify-between mb-6 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
            <span>contract / DataPolicy.sol</span>
            <span className="hidden md:inline">on-chain · enforceable</span>
          </div>
          <div className="border-l border-border/80 pl-6 md:pl-10">
            <div className="font-mono text-[11px] text-muted-foreground/60 mb-4">
              struct DataPolicy {`{`}
            </div>
            <div className="space-y-0 divide-y divide-border/40">
              {FIELDS.map(([f, t, c], i) => (
                <Row key={f} field={f} type={t} comment={c} idx={i} />
              ))}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground/60 mt-4">{`}`}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
