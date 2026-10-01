import type { ReactNode } from "react";

// Loading skeletons (architecture §8.3): grey `chip` blocks in the shape of the page to come. The
// page is announced once to screen readers ("Chargement…"); the blocks themselves are hidden.

/** A grey block; its size comes from the classes. */
export function Bone({ className }: { className: string }) {
  return <div className={`rounded-field bg-chip motion-safe:animate-pulse ${className}`} />;
}

/** An empty card, the frame of a group of blocks. */
export function BoneCard({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={`rounded-card border border-line bg-surface p-5 lg:px-6.5 lg:py-5.5 ${className ?? ""}`}>{children}</div>;
}

/** Rows of a list or table, as on the standings. */
export function BoneRows({ count, className = "h-12" }: { count: number; className?: string }) {
  return Array.from({ length: count }, (_, index) => <Bone key={index} className={`w-full ${className}`} />);
}

/** The whole skeleton of a page: a page title, then the blocks. */
export function LoadingPage({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-6">
        {children}
      </div>
    </div>
  );
}
