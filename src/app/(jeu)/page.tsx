import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

/** Temporary home page, replaced in step 6. */
export default function HomePage() {
  return (
    <Card as="section" className="flex flex-col items-start gap-3">
      <Chip tone="accent">Bientôt</Chip>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">
        Le site arrive bientôt
      </h1>
      <p className="text-base text-ink-2">
        Le Bon Chiffre ouvre le 14 octobre. Prépare-toi à pronostiquer les chiffres de l&apos;école.
      </p>
    </Card>
  );
}
