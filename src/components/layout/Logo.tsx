import { Target } from "lucide-react";
import Link from "next/link";

/** Skewed accent square with the target icon. */
export function LogoMark() {
  return (
    <span className="flex size-8.5 shrink-0 -skew-x-8 items-center justify-center rounded-button bg-accent text-accent-ink">
      <Target aria-hidden size={20} strokeWidth={2.4} />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 text-ink">
      <LogoMark />
      <span className="font-display text-[26px] font-extrabold italic uppercase tracking-[0.01em]">
        Le Bon Chiffre
      </span>
    </Link>
  );
}
