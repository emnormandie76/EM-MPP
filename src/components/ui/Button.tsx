import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-button px-5 font-display font-extrabold uppercase tracking-[0.06em] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-text",
  secondary: "border border-line-strong text-ink hover:bg-chip",
  danger: "border border-hot text-hot hover:bg-hot/10",
  ghost: "text-ink-2 hover:bg-chip",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-10 text-[17px]",
  lg: "h-12 text-lg",
};

type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

/** Button classes, also used to style links as buttons. */
export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyle = {}) {
  return [BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & ButtonStyle & { pending?: boolean };

export function Button({
  variant,
  size,
  pending = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
      {pending ? "…" : null}
    </button>
  );
}
