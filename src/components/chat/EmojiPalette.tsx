"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { CHAT_EMOJIS } from "@/lib/chat/emojis";

// Emoji grid of the chat (§8.2 EmojiPalette): 8 columns of the 48 emojis of src/lib/chat/emojis.ts.
// Each emoji is a button named by its French name. The arrow keys, Home and End move within the
// grid (one tab stop for the whole grid); Escape closes it.

const COLUMNS = 8;

export function EmojiPalette({ id, onPick, onClose }: { id: string; onPick: (emoji: string) => void; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const moved = useRef(false);

  useEffect(() => {
    if (moved.current) buttons.current[active]?.focus();
  }, [active]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = CHAT_EMOJIS.length - 1;
    const next: Record<string, number> = {
      ArrowRight: Math.min(active + 1, last),
      ArrowLeft: Math.max(active - 1, 0),
      ArrowDown: Math.min(active + COLUMNS, last),
      ArrowUp: Math.max(active - COLUMNS, 0),
      Home: 0,
      End: last,
    };
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key in next) {
      event.preventDefault();
      moved.current = true;
      setActive(next[event.key]);
    }
  }

  return (
    <div
      id={id}
      role="group"
      aria-label="Emojis"
      onKeyDown={onKeyDown}
      className="grid w-full max-w-90 grid-cols-8 gap-0.5 rounded-field border border-line bg-surface p-1.5 shadow-lg"
    >
      {CHAT_EMOJIS.map(({ emoji, name }, index) => (
        <button
          key={emoji}
          ref={(element) => {
            buttons.current[index] = element;
          }}
          type="button"
          aria-label={name}
          title={name}
          tabIndex={index === active ? 0 : -1}
          onFocus={() => setActive(index)}
          onClick={() => onPick(emoji)}
          className="flex aspect-square items-center justify-center rounded-button text-[22px] leading-none hover:bg-chip"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
