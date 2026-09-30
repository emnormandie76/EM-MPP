import { type AvatarColor, type AvatarKey, initialsOf, parseAvatarKey } from "@/lib/avatars";

// The 16 jerseys (architecture §8.2): 8 colours × 2 patterns, with the player's initials.

const COLORS: Record<AvatarColor, { fill: string; ink: string; stripe: string }> = {
  marine: { fill: "#1E3A8A", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  bleu: { fill: "#1F5BFF", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  cyan: { fill: "#0891B2", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  vert: { fill: "#15803D", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  jaune: { fill: "#EAB308", ink: "#0B0E13", stripe: "rgb(11 14 19 / 0.16)" },
  orange: { fill: "#EA580C", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  rouge: { fill: "#D2352B", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
  violet: { fill: "#7C3AED", ink: "#FFFFFF", stripe: "rgb(255 255 255 / 0.3)" },
};

/** Jersey seen from the front, in a 64 × 64 box: sleeves, round collar, body down to the bottom. */
const JERSEY = "M20 9 L9 14 L2 28 L12 33 L14 64 L50 64 L52 33 L62 28 L55 14 L44 9 Q32 18 20 9 Z";
const COLLAR = "M20 9 Q32 18 44 9";
/** Vertical stripes of the body, inside the jersey outline. */
const STRIPES = [18, 27, 36, 45];

type AvatarProps = {
  avatar: AvatarKey;
  /** The player's name, for the initials. */
  name: string;
  /** Size in pixels: 32 (lists), 36 (header), 64 (profile). */
  size?: number;
  /** Accent ring, for the signed-in player. */
  ring?: boolean;
  /** Accessible name; without it, the avatar is decorative (the name is written next to it). */
  label?: string;
  className?: string;
};

export function Avatar({ avatar, name, size = 36, ring = false, label, className }: AvatarProps) {
  const { color, pattern } = parseAvatarKey(avatar);
  const { fill, ink, stripe } = COLORS[color];
  const initials = initialsOf(name);

  return (
    <span
      className={[
        "inline-flex shrink-0 overflow-hidden rounded-full bg-chip",
        ring ? "ring-2 ring-accent" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden focusable="false">
        <path d={JERSEY} fill={fill} />
        {pattern === "raye"
          ? STRIPES.map((x) => <rect key={x} x={x} y={15} width={4.5} height={49} fill={stripe} />)
          : null}
        <path d={COLLAR} fill="none" stroke="rgb(11 14 19 / 0.28)" strokeWidth={2.5} strokeLinecap="round" />
        <text
          x={32}
          y={47}
          textAnchor="middle"
          fill={ink}
          stroke={fill}
          strokeWidth={pattern === "raye" ? 3 : 0}
          paintOrder="stroke"
          fontFamily="var(--font-display)"
          fontWeight={800}
          fontSize={initials.length > 1 ? 21 : 24}
          letterSpacing="0.02em"
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}
