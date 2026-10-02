import { CalendarClock } from "lucide-react";
import { Chip } from "@/components/ui/Chip";

/** Open question published since the player's last visit (§5.9). */
export function NewChip() {
  return <Chip tone="accent">Nouveau</Chip>;
}

/** Question open for the player thanks to their extension (v1.2, §5.14), instead of "Nouveau". */
export function ExtendedChip() {
  return (
    <Chip tone="accent" className="gap-1.5">
      <CalendarClock aria-hidden size={14} strokeWidth={2.4} />
      Prolongée pour toi
    </Chip>
  );
}
