"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useFormAction } from "@/components/ui/useFormAction";
import {
  archiveCategoryAction,
  createCategoryAction,
  renameCategoryAction,
  unarchiveCategoryAction,
} from "@/lib/actions/content";
import type { FormState } from "@/lib/actions/form-state";
import { CATEGORY_NAME_MAX } from "@/lib/validation/content";

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/** Adds a category; the field is emptied once it is added. */
export function CategoryCreateForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(createCategoryAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          name="name"
          id="new-category"
          label="Nouvelle catégorie"
          maxLength={CATEGORY_NAME_MAX}
          error={state && !state.ok ? (state.fieldErrors?.name ?? state.message) : undefined}
          className="w-72"
        />
        <Button type="submit" pending={pending} className="mb-px">
          <Plus {...ICON} />
          Ajouter
        </Button>
      </div>
      <FormMessage feedback={state?.ok ? { tone: "success", text: state.message } : null} />
    </form>
  );
}

/** Rename (inline form) and archive or unarchive one category. */
export function CategoryActions({ category }: { category: { id: number; name: string; archived: boolean } }) {
  const [editing, setEditing] = useState(false);
  const [renameState, setRenameState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await renameCategoryAction(null, formData);
      setRenameState(result);
      if (result?.ok) setEditing(false);
    });
  }

  if (editing) {
    const nameError = renameState && !renameState.ok ? (renameState.fieldErrors?.name ?? renameState.message) : undefined;
    return (
      <form onSubmit={rename} className="flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="categoryId" value={category.id} />
        <Field
          name="name"
          id={`category-${category.id}`}
          label={`Nouveau nom de « ${category.name} »`}
          defaultValue={category.name}
          maxLength={CATEGORY_NAME_MAX}
          error={nameError}
          className="w-64"
        />
        <Button type="submit" variant="secondary" pending={pending} className="mb-px">
          Renommer
        </Button>
        <Button variant="ghost" className="mb-px" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setRenameState(null);
            setEditing(true);
          }}
          aria-label={`Renommer « ${category.name} »`}
        >
          <Pencil {...ICON} />
          Renommer
        </Button>
        <Button
          variant="ghost"
          pending={pending}
          aria-label={`${category.archived ? "Réactiver" : "Archiver"} « ${category.name} »`}
          onClick={() =>
            startTransition(async () => {
              const result = await (category.archived ? unarchiveCategoryAction : archiveCategoryAction)(category.id);
              setError(result.ok ? null : result.message);
            })
          }
        >
          {category.archived ? <ArchiveRestore {...ICON} /> : <Archive {...ICON} />}
          {category.archived ? "Réactiver" : "Archiver"}
        </Button>
      </div>
      <p aria-live="polite" className="text-sm font-medium text-hot">
        {error}
      </p>
    </div>
  );
}
