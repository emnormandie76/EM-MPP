"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Horizontal scroll container of a wide table (architecture §8.4). `relative` keeps the visually
 * hidden texts of the cells inside it: positioned against the page, they would widen it at 390 px.
 * While the table overflows, the container is a named region that takes the keyboard focus, so it
 * can be scrolled without a mouse (§8.5, axe "scrollable-region-focusable"); otherwise it stays out
 * of the tab order.
 */
export function TableScroll({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A ResizeObserver reports once as soon as it observes, then on every change of size.
    const observer = new ResizeObserver(() => setScrollable(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={["relative overflow-x-auto", className].filter(Boolean).join(" ")}
      {...(scrollable ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
    >
      {children}
    </div>
  );
}
