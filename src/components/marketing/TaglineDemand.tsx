/** Locked tagline line 2. Highlight is visual only — words stay "Capture More Demand." */
export function TaglineDemand({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      Capture More{" "}
      <mark className="mx-[0.02em] rounded-[0.08em] bg-[#7ee5d6] px-[0.18em] py-0 font-inherit text-[var(--ink)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
        Demand.
      </mark>
    </span>
  );
}
