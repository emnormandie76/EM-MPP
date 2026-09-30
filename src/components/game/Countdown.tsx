"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { countdownParts, isUrgent } from "@/lib/game/countdown";

// Countdown to the closing (architecture §5.10, §8.2). The first display uses the server time
// given by the page, so the server and the browser render the same thing and a wrong clock in the
// browser changes nothing; then the time advances with the time elapsed in the browser. At zero,
// the page is refreshed once.

type CountdownProps = {
  /** Closing time, in ms since the epoch. */
  closesAt: number;
  /** Time of the server render, in ms since the epoch. */
  serverNow: number;
  /** Four boxes (J, H, MIN, S), or a single line "Clôture dans 3 j 07:45:10". */
  variant?: "boxes" | "compact";
  className?: string;
};

const BOX_UNITS = [
  { key: "d", unit: "J" },
  { key: "h", unit: "H" },
  { key: "m", unit: "MIN" },
  { key: "s", unit: "S" },
] as const;

export function Countdown({ closesAt, serverNow, variant = "boxes", className }: CountdownProps) {
  const router = useRouter();
  const [clock, setClock] = useState({ base: serverNow, now: serverNow });
  const refreshed = useRef(false);
  // A new server render (after a refresh) restarts from its own time.
  if (clock.base !== serverNow) setClock({ base: serverNow, now: serverNow });

  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => setClock({ base: serverNow, now: serverNow + (performance.now() - start) }), 1000);
    return () => clearInterval(timer);
  }, [serverNow]);

  const remaining = closesAt - (clock.base === serverNow ? clock.now : serverNow);
  const closed = remaining <= 0;
  useEffect(() => {
    // Only a countdown that reached zero here: a page rendered after the closing does not loop.
    if (closed && closesAt > serverNow && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [closed, closesAt, serverNow, router]);

  const parts = countdownParts(remaining);
  const urgent = isUrgent(remaining);
  const label = closed ? "Clôturé" : `Clôture dans ${parts.label}`;
  const common = {
    role: "timer",
    "aria-label": label,
    "data-urgent": urgent ? "true" : undefined,
    "data-testid": "countdown",
  } as const;

  if (variant === "compact") {
    return (
      <span {...common} className={["inline-flex items-center gap-1.5 text-sm text-muted", className].filter(Boolean).join(" ")}>
        <Clock aria-hidden size={15} strokeWidth={2.2} />
        {closed ? (
          <span className="font-display text-[17px] font-extrabold uppercase tracking-[0.06em] text-ink">Clôturé</span>
        ) : (
          <>
            Clôture dans
            {/* 20 px bold: large text, so `hot` (4.2:1 on the page background) stays readable (§8.1). */}
            <span className={`font-display text-xl font-bold tabular-nums ${urgent ? "text-hot" : "text-ink"}`}>{parts.label}</span>
          </>
        )}
      </span>
    );
  }

  if (closed) {
    return (
      <span {...common} className={["font-display text-[17px] font-extrabold uppercase tracking-[0.06em]", className].filter(Boolean).join(" ")}>
        Clôturé
      </span>
    );
  }
  return (
    <div {...common} className={["flex gap-1.25", className].filter(Boolean).join(" ")}>
      {BOX_UNITS.map(({ key, unit }) => (
        <div key={key} aria-hidden className="flex flex-col items-center gap-0.75">
          <span
            className={[
              "flex size-11 items-center justify-center rounded-button border bg-bg font-display text-[26px] font-bold tabular-nums",
              urgent ? "border-hot text-hot" : "border-line text-ink",
            ].join(" ")}
          >
            {parts[key]}
          </span>
          <span className="text-[10px] font-bold tracking-widest text-muted">{unit}</span>
        </div>
      ))}
    </div>
  );
}
