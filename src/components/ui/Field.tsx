import type { ComponentProps, ReactNode } from "react";

type FieldFrameProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (describedBy: string | undefined) => ReactNode;
};

/** Label above, hint and error below, linked to the control by aria-describedby (§8.5). */
function FieldFrame({ id, label, hint, error, className, children }: FieldFrameProps) {
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
      {children(describedBy)}
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

const CONTROL_CLASSES =
  "rounded-field border border-line-strong bg-surface px-3 text-base text-ink focus:border-accent aria-invalid:border-hot disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted";

type FieldProps = ComponentProps<"input"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled text input. The input id defaults to its name. */
export function Field({ name, id = name, label, hint, error, className, ...inputProps }: FieldProps) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} className={className}>
      {(describedBy) => (
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 ${CONTROL_CLASSES}`}
          {...inputProps}
        />
      )}
    </FieldFrame>
  );
}

type TextAreaFieldProps = ComponentProps<"textarea"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled multi-line input. */
export function TextAreaField({ name, id = name, label, hint, error, className, ...textAreaProps }: TextAreaFieldProps) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} className={className}>
      {(describedBy) => (
        <textarea
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-h-32 py-2.5 ${CONTROL_CLASSES}`}
          {...textAreaProps}
        />
      )}
    </FieldFrame>
  );
}

type SelectFieldProps = ComponentProps<"select"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Labelled drop-down list. */
export function SelectField({ name, id = name, label, hint, error, className, children, ...selectProps }: SelectFieldProps) {
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} className={className}>
      {(describedBy) => (
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 ${CONTROL_CLASSES}`}
          {...selectProps}
        >
          {children}
        </select>
      )}
    </FieldFrame>
  );
}
