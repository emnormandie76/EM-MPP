"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { changePasswordAction } from "@/lib/actions/auth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/account";

export function PasswordForm() {
  const [result, formAction, pending] = useActionState(changePasswordAction, null);
  const fieldError = (field: string) => (result && !result.ok ? result.fieldErrors?.[field] : undefined);
  const hasFieldError = Boolean(result && !result.ok && result.fieldErrors);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        name="currentPassword"
        type="password"
        label="Mot de passe actuel"
        autoComplete="current-password"
        required
        error={fieldError("currentPassword")}
      />
      <Field
        name="newPassword"
        type="password"
        label="Nouveau mot de passe"
        hint={`${PASSWORD_MIN} caractères au minimum.`}
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        error={fieldError("newPassword")}
      />
      <Field
        name="confirmPassword"
        type="password"
        label="Confirmation du nouveau mot de passe"
        autoComplete="new-password"
        required
        maxLength={PASSWORD_MAX}
        error={fieldError("confirmPassword")}
      />
      <FormMessage
        feedback={
          result === null
            ? null
            : result.ok
              ? { tone: "success", text: "Mot de passe changé." }
              : { tone: "error", text: result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.message }
        }
        className={hasFieldError ? "sr-only" : undefined}
      />
      <Button type="submit" variant="secondary" pending={pending} className="self-start">
        Changer le mot de passe
      </Button>
    </form>
  );
}
