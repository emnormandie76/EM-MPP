import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortailSignIn } from "@/components/auth/PortailSignIn";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { portailClient, portailHomeUrl } from "@/lib/auth/portail";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion" };

/** The same neutral message for every error (contract §3.6): the flow does not start again by itself. */
const SIGN_IN_FAILED = "La connexion n'a pas abouti. Retourne sur le portail pour réessayer.";

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const viewer = await getViewer();
  if (viewer && !viewer.banned) redirect("/");

  const { auto, error } = await searchParams;
  const portailUrl = portailHomeUrl();

  return (
    <Card as="section" className="flex w-full max-w-105 flex-col gap-5">
      <h1 className="font-display text-[32px] font-extrabold uppercase leading-none">Connexion</h1>
      <FormMessage feedback={error ? { tone: "error", text: SIGN_IN_FAILED } : null} />
      {portailClient() ? (
        <PortailSignIn auto={auto === "1" && !error} />
      ) : (
        <p className="text-[15px] text-ink-2">La connexion n&apos;est pas disponible à cette adresse.</p>
      )}
      <p className="text-sm text-muted">Ton compte et ton mot de passe se gèrent sur le portail.</p>
      {portailUrl ? (
        <p className="border-t border-line pt-4 text-[15px] text-ink-2">
          <a href={portailUrl} className="font-semibold text-accent-text underline-offset-2 hover:underline">
            Aller sur le portail
          </a>
        </p>
      ) : null}
    </Card>
  );
}
