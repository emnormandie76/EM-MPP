import { CircleCheck, TriangleAlert } from "lucide-react";

export type FormFeedback = { tone: "error" | "success"; text: string } | null;

/**
 * Result of a form or an action, announced by screen readers (aria-live, §8.5). The region
 * stays in the page, empty, so that its later content is announced. The message has a white
 * background, unseen in a card: on the page background, the `hot` and `up` texts would fall under
 * 4.5:1 (4.3:1).
 */
export function FormMessage({ feedback, className }: { feedback: FormFeedback; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {feedback ? (
        <p
          className={[
            "-mx-2 flex items-start gap-2 rounded-field bg-surface px-2 py-1 text-sm font-medium",
            feedback.tone === "error" ? "text-hot" : "text-up",
          ].join(" ")}
        >
          {feedback.tone === "error" ? (
            <TriangleAlert aria-hidden size={18} strokeWidth={2.2} className="mt-px shrink-0" />
          ) : (
            <CircleCheck aria-hidden size={18} strokeWidth={2.2} className="mt-px shrink-0" />
          )}
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
