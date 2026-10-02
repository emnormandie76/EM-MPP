import { Target } from "lucide-react";
import Link from "next/link";
import { APP_NAME, APP_NAME_LINES } from "@/lib/app";

/** Skewed accent square with the target icon. */
export function LogoMark() {
  return (
    <span className="flex size-8.5 shrink-0 -skew-x-8 items-center justify-center rounded-button bg-accent text-accent-ink">
      <Target aria-hidden size={20} strokeWidth={2.4} />
    </span>
  );
}

/** The name in display capitals, on two lines (§8.2), after the mark. */
export function LogoWordmark() {
  return (
    <span className="flex items-center gap-2.5 text-ink">
      <LogoMark />
      <span aria-hidden className="flex flex-col font-display text-[19px] leading-[0.95] font-extrabold italic uppercase tracking-[0.01em]">
        {APP_NAME_LINES.map((line) => (
          <span key={line} className="whitespace-nowrap">
            {line}
          </span>
        ))}
      </span>
      <span className="sr-only">{APP_NAME}</span>
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center">
      <LogoWordmark />
    </Link>
  );
}
