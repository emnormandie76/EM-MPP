"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Whether another action started on the page since `result` came: a form sent (this one included,
 * its new result will replace the message), or a button clicked outside `scope`, the zone of the
 * result. A message describes the last action; without this, « Saison créée. » stayed under the
 * form after the season was deleted (test report of 01/10/2026, R-04). `null` means no result.
 */
export function useStaleResult(result: unknown, scope: RefObject<Element | null>): boolean {
  const [stale, setStale] = useState<{ result: unknown } | null>(null);

  useEffect(() => {
    if (result === null || result === undefined) return;
    function onAction(event: Event) {
      if (!(event.target instanceof Element)) return;
      if (event.type === "click") {
        const button = event.target.closest("button");
        if (!button || scope.current?.contains(button)) return;
      }
      setStale({ result });
    }
    document.addEventListener("submit", onAction, true);
    document.addEventListener("click", onAction, true);
    return () => {
      document.removeEventListener("submit", onAction, true);
      document.removeEventListener("click", onAction, true);
    };
  }, [result, scope]);

  return result !== null && result !== undefined && stale?.result === result;
}
