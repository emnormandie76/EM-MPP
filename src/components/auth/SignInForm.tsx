"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { authClient } from "@/lib/auth/auth-client";
import { signInError, UNEXPECTED_ERROR } from "@/lib/auth/auth-errors";
import { normalizeEmail } from "@/lib/validation/account";

type State = { email: string; error: string | null };

/** Sign-in over HTTP, where the attempt limit applies (§6.1, §8.3). */
export function SignInForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<State, FormData>(async (_, formData) => {
    const email = normalizeEmail(String(formData.get("email") ?? ""));
    const password = String(formData.get("password") ?? "");
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) return { email, error: signInError(error).message };
    } catch {
      return { email, error: UNEXPECTED_ERROR };
    }
    router.replace("/");
    router.refresh();
    return { email, error: null };
  }, { email: "", error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field name="email" type="email" label="Email" autoComplete="email" required defaultValue={state.email} />
      <Field name="password" type="password" label="Mot de passe" autoComplete="current-password" required />
      <FormMessage feedback={state.error ? { tone: "error", text: state.error } : null} />
      <Button type="submit" size="lg" pending={pending}>
        Se connecter
      </Button>
    </form>
  );
}
