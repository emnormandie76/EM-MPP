import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { Card } from "@/components/ui/Card";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Créer mon compte" };

export default async function SignUpPage() {
  const viewer = await getViewer();
  if (viewer && !viewer.banned) redirect("/");

  return (
    <Card as="section" className="flex w-full max-w-105 flex-col gap-5">
      <h1 className="font-display text-[32px] font-extrabold uppercase leading-none">Créer mon compte</h1>
      <p className="text-[15px] text-ink-2">
        Utilise ton adresse professionnelle : seules les adresses de l&apos;équipe peuvent créer un compte.
      </p>
      <SignUpForm />
      <p className="border-t border-line pt-4 text-[15px] text-ink-2">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-semibold text-accent-text underline-offset-2 hover:underline">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}
