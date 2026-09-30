"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * A `<details>` drop-down menu that closes after a navigation, on a click outside and on Escape
 * (focus back on its `<summary>`).
 */
export function useDetailsMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const menu = ref.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      const menu = ref.current;
      if (event.key !== "Escape" || !menu?.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return ref;
}
