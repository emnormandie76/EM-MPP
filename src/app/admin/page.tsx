import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Back-office" };

/** Temporary dashboard, replaced in step 5. */
export default function AdminPage() {
  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Back-office</h1>
      <Card as="section" className="flex flex-col items-start gap-3">
        <p className="text-base text-ink-2">
          Le suivi des questions arrive avec la gestion des questions. En attendant, tu peux gérer les joueurs et la
          liste blanche.
        </p>
        <Link href="/admin/joueurs" className="font-semibold text-accent-text underline-offset-2 hover:underline">
          Gérer les joueurs
        </Link>
      </Card>
    </>
  );
}
