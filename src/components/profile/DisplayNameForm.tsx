"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { updateDisplayNameAction } from "@/lib/actions/profile";
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/validation/account";

export function DisplayNameForm({ name }: { name: string }) {
  const [result, formAction, pending] = useActionState(updateDisplayNameAction, null);
  const nameError = result && !result.ok ? (result.fieldErrors?.name ?? result.message) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        name="name"
        label="Nom affiché"
        hint="Ton prénom, tel que les autres le verront."
        autoComplete="given-name"
        required
        minLength={DISPLAY_NAME_MIN}
        maxLength={DISPLAY_NAME_MAX}
        defaultValue={name}
        error={nameError}
      />
      <FormMessage
        feedback={
          result === null ? null : result.ok ? { tone: "success", text: "Nom enregistré." } : { tone: "error", text: result.message }
        }
        className={result && !result.ok ? "sr-only" : undefined}
      />
      <Button type="submit" variant="secondary" pending={pending} className="self-start">
        Enregistrer le nom
      </Button>
    </form>
  );
}
