import type { ReactNode } from "react";

export function Card({
  as: Tag = "div",
  className,
  children,
  "aria-labelledby": labelledBy,
}: {
  as?: "div" | "section" | "article" | "aside";
  className?: string;
  children: ReactNode;
  /** Names a section after its heading, which makes it a region landmark. */
  "aria-labelledby"?: string;
}) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={["rounded-card border border-line bg-surface p-5 lg:px-6.5 lg:py-5.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
