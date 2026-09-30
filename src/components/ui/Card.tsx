import type { ReactNode } from "react";

export function Card({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "section" | "article" | "aside";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={["rounded-card border border-line bg-surface p-5 lg:px-6.5 lg:py-5.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
