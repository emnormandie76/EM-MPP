import type { ComponentProps } from "react";

type FieldProps = ComponentProps<"input"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled text input. The input id defaults to its name. */
export function Field({ name, id = name, label, hint, error, className, ...inputProps }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <label
        htmlFor={id}
        className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-11 rounded-field border border-line-strong bg-surface px-3 text-base text-ink focus:border-accent aria-invalid:border-hot"
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-hot">
          {error}
        </p>
      ) : null}
    </div>
  );
}
