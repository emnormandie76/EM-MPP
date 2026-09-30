/** Progress of the open questions (§8.2): one segment per question, a continuous bar beyond 20. */
export function SegmentedProgress({ value, max, label }: { value: number; max: number; label: string }) {
  if (max === 0) return null;
  const common = {
    role: "progressbar",
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": max,
    "aria-valuenow": value,
  } as const;
  if (max > 20) {
    return (
      <div {...common} className="h-2.5 grow overflow-hidden rounded-[2px] bg-line">
        <div className="h-full bg-accent" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    );
  }
  return (
    <div {...common} className="flex grow gap-1.5">
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={`h-2.5 grow rounded-[2px] ${index < value ? "bg-accent" : "bg-line"}`} />
      ))}
    </div>
  );
}
