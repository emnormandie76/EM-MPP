import { MessageCircle, Trash } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import type { ChatMessageView } from "@/lib/data/chat";
import { formatTime } from "@/lib/format";

// One message of the chat thread (§8.2 ChatMessage). The text is shown as text, escaped by React,
// with its line breaks; links are never made clickable (§5.15).

function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} className="text-[13px] text-muted">
      à {formatTime(new Date(iso))}
    </time>
  );
}

export function ChatMessage({ message, onDelete }: { message: ChatMessageView; onDelete: (message: ChatMessageView) => void }) {
  const deleteButton = message.canDelete ? (
    <button
      type="button"
      aria-label="Supprimer le message"
      title="Supprimer le message"
      onClick={() => onDelete(message)}
      className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-button text-muted hover:bg-chip hover:text-hot"
    >
      <Trash aria-hidden size={16} strokeWidth={2.2} />
    </button>
  ) : null;

  // The automatic message of a result: its text starts with « Résultat : ».
  if (message.kind === "result") {
    return (
      <div className="flex items-start gap-3 rounded-card bg-accent-soft px-3.5 py-3">
        <MessageCircle aria-hidden size={20} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent-text" />
        <div className="flex min-w-0 grow flex-col gap-1">
          {message.result ? (
            <p className="text-[15px] font-medium break-words text-ink">{message.result.text}</p>
          ) : (
            <p className="text-[15px] text-muted italic">Message supprimé.</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Time iso={message.createdAt} />
            {message.result ? (
              <Link href={`/questions/${message.result.questionId}`} className="text-[15px] font-semibold text-accent-text underline-offset-2 hover:underline">
                Voir la question
              </Link>
            ) : null}
            {deleteButton}
          </div>
        </div>
      </div>
    );
  }

  const author = message.author!;
  return (
    <div className="flex items-start gap-3 px-1">
      <Avatar avatar={author.avatar} name={author.name} size={32} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={`/joueurs/${author.id}`} className="min-w-0 truncate text-[15px] font-semibold text-ink hover:text-accent-text hover:underline">
            {author.name}
            {author.inactive ? <span className="font-normal text-muted"> (inactif)</span> : null}
          </Link>
          <Time iso={message.createdAt} />
          {deleteButton}
        </div>
        {message.deleted ? (
          <p className="text-[15px] text-muted italic">Message supprimé.</p>
        ) : (
          <p className="text-[15px] break-words whitespace-pre-wrap text-ink-2">{message.body}</p>
        )}
      </div>
    </div>
  );
}
