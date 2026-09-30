import { ExternalLink } from "lucide-react";

export type Help = { biUrl: string | null; lastYear: string | null; hint: string | null };

export function hasHelp({ biUrl, lastYear, hint }: Help): boolean {
  return Boolean(biUrl || lastYear || hint);
}

/**
 * "Pour t'aider" (§8.2): link to the BI dashboard (new tab), last year's value and a hint.
 * Nothing when the three are empty. Without `title`, the surrounding disclosure names it.
 */
export function HelpPanel({ help, title = true }: { help: Help; title?: boolean }) {
  if (!hasHelp(help)) return null;
  return (
    <aside aria-label="Pour t'aider" className="flex flex-col gap-3.5 rounded-field border border-line bg-bg p-4.5">
      {title ? <h2 className="font-display text-lg font-extrabold uppercase tracking-[0.04em]">Pour t&apos;aider</h2> : null}
      {help.biUrl ? (
        <a
          href={help.biUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start text-[15px] font-semibold text-accent-text hover:underline"
        >
          Ouvrir le tableau BI
          <ExternalLink aria-hidden size={14} strokeWidth={2.2} />
          <span className="sr-only">(nouvel onglet)</span>
        </a>
      ) : null}
      {help.lastYear ? (
        <div className="flex flex-col">
          <span className="text-[13px] text-muted">L&apos;an dernier</span>
          <span className="font-display text-[34px] leading-[1.1] font-bold tabular-nums">{help.lastYear}</span>
        </div>
      ) : null}
      {help.hint ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-muted">Indice</span>
          <p className="text-[15px] text-ink-2">{help.hint}</p>
        </div>
      ) : null}
    </aside>
  );
}
