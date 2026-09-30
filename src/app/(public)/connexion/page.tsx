import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { Card } from "@/components/ui/Card";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage() {
  const viewer = await getViewer();
  if (viewer && !viewer.banned) redirect("/");

  return (
    <Card as="section" className="flex w-full max-w-105 flex-col gap-5">
      <h1 className="font-display text-[32px] font-extrabold uppercase leading-none">Connexion</h1>
      <SignInForm />
      <p className="text-sm text-muted">Mot de passe oublié ? Demande à l&apos;admin un mot de passe provisoire.</p>
      <p className="border-t border-line pt-4 text-[15px] text-ink-2">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-accent-text underline-offset-2 hover:underline">
          Créer mon compte
        </Link>
      </p>
    </Card>
  );
}
