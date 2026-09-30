import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "md" | "lg" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-button font-display font-extrabold uppercase tracking-[0.06em] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-text",
  secondary: "border border-line-strong text-ink hover:bg-chip",
  // White background: `hot` text reaches 4.9:1 on it, but only 4.2:1 on the page background.
  danger: "border border-hot bg-surface text-hot hover:bg-hot hover:text-accent-ink",
  ghost: "text-ink-2 hover:bg-chip",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-10 px-5 text-[17px]",
  lg: "h-12 px-5 text-lg",
  // Square button with an icon only: give it an aria-label.
  icon: "size-10 shrink-0",
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
