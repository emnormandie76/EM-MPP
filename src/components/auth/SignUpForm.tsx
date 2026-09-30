"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { authClient } from "@/lib/auth/auth-client";
import { type FormError, signUpError, UNEXPECTED_ERROR } from "@/lib/auth/auth-errors";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  MESSAGES,
  normalizeEmail,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/validation/account";

type State = { email: string; name: string; error: FormError | null };

/** Sign-up over HTTP, where the attempt limit applies. The rules are checked by the server (§6.2). */
export function SignUpForm() {
  const router = useRouter();

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_, formData) => {
      const email = normalizeEmail(String(formData.get("email") ?? ""));
      const name = String(formData.get("name") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      const values = { email, name };
      if (password !== formData.get("confirmPassword")) {
        return { ...values, error: { field: "password", message: MESSAGES.passwordMismatch } };
      }
      try {
        const { error } = await authClient.signUp.email({ email, name, password });
        if (error) return { ...values, error: signUpError(error) };
      } catch {
        return { ...values, error: { message: UNEXPECTED_ERROR } };
      }
      router.replace("/");
      router.refresh();
      return { ...values, error: null };
    },
    { email: "", name: "", error: null },
  );

  const fieldError = (field: FormError["field"]) => (state.error && state.error.field === field ? state.error.message : undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        name="email"
        type="email"
        label="Email professionnel"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={fieldError("email")}
      />
      <Field
        name="name"
        label="Nom affiché"
        hint="Ton prénom, tel que les autres le verront."
        autoComplete="given-name"
        required
        minLength={DISPLAY_NAME_MIN}
        maxLength={DISPLAY_NAME_MAX}
        defaultValue={state.name}
        error={fieldError("name")}
      />
      <Field
        name="password"
        type="password"
        label="Mot de passe"
        hint={`${PASSWORD_MIN} caractères au minimum.`}
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        error={fieldError("password")}
      />
      <Field
        name="confirmPassword"
        type="password"
        label="Confirmation du mot de passe"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
      />
      {/* Field errors are shown under their field; the region announces every error. */}
      <FormMessage
        feedback={state.error ? { tone: "error", text: state.error.message } : null}
        className={state.error?.field ? "sr-only" : undefined}
      />
      <Button type="submit" size="lg" pending={pending}>
        Créer mon compte
      </Button>
    </form>
  );
}
