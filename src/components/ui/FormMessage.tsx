import { CircleCheck, TriangleAlert } from "lucide-react";

export type FormFeedback = { tone: "error" | "success"; text: string } | null;

/**
 * Result of a form or an action, announced by screen readers (aria-live, §8.5). The region
 * stays in the page, empty, so that its later content is announced.
 */
export function FormMessage({ feedback, className }: { feedback: FormFeedback; className?: string }) {
  return (
    <div aria-live="polite" className={className}>
      {feedback ? (
        <p
          className={[
            "flex items-start gap-2 text-sm font-medium",
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
