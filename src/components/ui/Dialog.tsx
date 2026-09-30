"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

/**
 * Modal built on the native `<dialog>` (§8.2): focus kept inside, Escape closes it. The first
 * focusable element inside receives the focus when it opens.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  /** Called when the person closes the dialog (Escape), not when `open` turns false. */
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingFromProps = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) {
      // The "close" event comes later: it must not undo a state set meanwhile by the parent.
      closingFromProps.current = true;
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (closingFromProps.current) {
      closingFromProps.current = false;
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="m-auto w-[calc(100%-32px)] max-w-110 rounded-card border border-line bg-surface p-6 text-ink backdrop:bg-ink/50"
    >
      {open ? (
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="font-display text-[26px] font-extrabold uppercase leading-none">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
