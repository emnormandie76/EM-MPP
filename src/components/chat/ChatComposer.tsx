"use client";

import { Smile } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { postChatMessageAction } from "@/lib/actions/chat";
import { CHAT_MAX_LENGTH } from "@/lib/chat/constants";
import { messageLength, normalizeMessageBody } from "@/lib/chat/message-body";
import { EmojiPalette } from "./EmojiPalette";

// Writing a chat message (§8.2 ChatComposer): « Ton message », a counter in code points, the emoji
// grid, « ENVOYER ». Enter sends; Shift + Enter goes to the line.

export function ChatComposer({ onSent }: { onSent: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const paletteId = `${id}-emojis`;
  const hintId = `${id}-aide`;
  const counterId = `${id}-compteur`;
  const length = messageLength(normalizeMessageBody(text));

  function send() {
    if (pending) return;
    startTransition(async () => {
      const result = await postChatMessageAction({ body: text });
      if (!result.ok) {
        if (result.code === "NOT_AUTHENTICATED" || result.code === "ACCOUNT_DISABLED") router.replace("/connexion");
        setError(result.fieldErrors?.body ?? result.message);
        return;
      }
      setText("");
      setError(null);
      onSent();
      field.current?.focus();
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && paletteOpen) {
      event.preventDefault();
      setPaletteOpen(false);
    } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  /** Inserts the emoji where the cursor was, then gives the focus back to the field after it. */
  function insert(emoji: string) {
    const element = field.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function closePalette() {
    setPaletteOpen(false);
    toggle.current?.focus();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {paletteOpen ? <EmojiPalette id={paletteId} onPick={insert} onClose={closePalette} /> : null}
      <label htmlFor={`${id}-message`} className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted">
        Ton message
      </label>
      <textarea
        ref={field}
        id={`${id}-message`}
        name="body"
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${hintId} ${counterId}`}
        className="max-h-40 min-h-16 resize-y rounded-field border border-line-strong bg-surface px-3 py-2.5 text-base text-ink focus:border-accent aria-invalid:border-hot"
      />
      <p id={hintId} className="text-[13px] text-muted">
        Entrée pour envoyer, Maj + Entrée pour aller à la ligne.
      </p>
      <div className="flex items-center gap-3">
        <Button
          ref={toggle}
          variant="secondary"
          size="icon"
          aria-label="Ajouter un emoji"
          aria-expanded={paletteOpen}
          aria-controls={paletteOpen ? paletteId : undefined}
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <Smile aria-hidden size={20} strokeWidth={2.2} />
        </Button>
        <p id={counterId} className={["grow text-sm tabular-nums", length > CHAT_MAX_LENGTH ? "font-semibold text-hot" : "text-muted"].join(" ")}>
          {length} / {CHAT_MAX_LENGTH}
        </p>
        <Button type="submit" pending={pending}>
          Envoyer
        </Button>
      </div>
      <FormMessage feedback={error ? { tone: "error", text: error } : null} />
    </form>
  );
}
