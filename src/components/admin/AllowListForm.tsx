"use client";

import { Plus } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useStaleResult } from "@/components/ui/useStaleResult";
import { addAllowedEmailsAction } from "@/lib/actions/players";
import { formatCount } from "@/lib/format";

/** Adds a pasted list of addresses and shows the report: "3 ajoutées, 1 déjà présente, 1 invalide" (§6.3). */
export function AllowListForm() {
  const [result, formAction, pending] = useActionState(addAllowedEmailsAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  // Removing an address, for example, starts another action: the report no longer describes the last one.
  const stale = useStaleResult(result, formRef);

  let summary: string | null = null;
  if (result?.ok && !stale) {
    const { added, alreadyPresent, invalid } = result.data;
    summary = [
      formatCount(added.length, "ajoutée"),
      formatCount(alreadyPresent.length, "déjà présente"),
      formatCount(invalid.length, "invalide"),
    ].join(", ");
    if (invalid.length > 0) summary += `. À corriger : ${invalid.join(", ")}`;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <TextAreaField
        name="emails"
        label="Adresses à ajouter"
        hint="Une adresse par ligne. Les virgules et les points-virgules sont aussi acceptés."
        required
        error={result && !result.ok && !stale ? (result.fieldErrors?.emails ?? result.message) : undefined}
      />
      <FormMessage feedback={summary ? { tone: "success", text: summary } : null} />
      <Button type="submit" pending={pending} className="self-start">
        <Plus aria-hidden size={18} strokeWidth={2.4} />
        Ajouter
      </Button>
    </form>
  );
}
