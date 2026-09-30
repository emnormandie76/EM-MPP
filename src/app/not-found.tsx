import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function NotFound() {
  return (
    <main className="flex grow items-center justify-center px-4 py-16">
      <Card className="flex w-full max-w-105 flex-col items-center gap-5 text-center">
        <LogoMark />
        <h1 className="font-display text-[32px] font-extrabold uppercase leading-tight">
          Cette page n&apos;existe pas.
        </h1>
        <Link href="/" className={buttonClasses({ size: "lg" })}>
          Retour à l&apos;accueil
        </Link>
      </Card>
    </main>
  );
}
