"use client";

import { Pencil, Plus, Trash } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { createAnnouncementAction, deleteAnnouncementAction, updateAnnouncementAction } from "@/lib/actions/content";
import type { FormState } from "@/lib/actions/form-state";
import { ANNOUNCEMENT_MAX } from "@/lib/validation/content";

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/** Text of an announcement with its counter "n / 500" (§8.3). */
function BodyField({ id, label, value, onChange, error }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const length = value.trim().length;
  return (
    <TextAreaField
      name="body"
      id={id}
      label={label}
      value={value}
      maxLength={ANNOUNCEMENT_MAX}
      onChange={(event) => onChange(event.target.value)}
      hint={`${length} / ${ANNOUNCEMENT_MAX} caractères`}
      error={error}
      className="[&_textarea]:min-h-24"
    />
  );
}

function useSubmit(action: (state: FormState, formData: FormData) => Promise<FormState>, onSuccess: () => void) {
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(null, formData);
      setState(result);
      if (result?.ok) onSuccess();
    });
  }
  return { state, setState, pending, onSubmit };
}

const errorOf = (state: FormState) => (state && !state.ok ? (state.fieldErrors?.body ?? state.message) : undefined);

/** New announcement, shown at the top of the home page. */
export function AnnouncementCreateForm() {
  const [body, setBody] = useState("");
  const { state, pending, onSubmit } = useSubmit(createAnnouncementAction, () => setBody(""));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <BodyField id="new-announcement" label="Nouvelle annonce" value={body} onChange={setBody} error={errorOf(state)} />
      <FormMessage feedback={state?.ok ? { tone: "success", text: state.message } : null} />
      <Button type="submit" pending={pending} className="self-start">
        <Plus {...ICON} />
        Publier l&apos;annonce
      </Button>
    </form>
  );
}

/** One announcement: edit in place, delete after a confirmation. */
export function AnnouncementItem({ announcement }: { announcement: { id: number; body: string; dateLabel: string } }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(announcement.body);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const { state, setState, pending, onSubmit } = useSubmit(updateAnnouncementAction, () => setEditing(false));

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="announcementId" value={announcement.id} />
        <BodyField
          id={`announcement-${announcement.id}`}
          label="Modifier l'annonce"
          value={body}
          onChange={setBody}
          error={errorOf(state)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending}>
            Enregistrer
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setBody(announcement.body);
              setEditing(false);
            }}
          >
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[15px] whitespace-pre-line text-ink-2">{announcement.body}</p>
      <p className="text-[13px] text-muted">{announcement.dateLabel}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setState(null);
            setBody(announcement.body);
            setEditing(true);
          }}
        >
          <Pencil {...ICON} />
          Modifier
        </Button>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash {...ICON} />
          Supprimer
        </Button>
      </div>
      <FormMessage feedback={state?.ok ? { tone: "success", text: state.message } : deleteError ? { tone: "error", text: deleteError } : null} />
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Supprimer l'annonce ?">
        <p className="text-[15px] text-ink-2">Elle disparaîtra de l&apos;accueil de tous les joueurs.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            pending={deleting}
            onClick={() =>
              startDelete(async () => {
                const result = await deleteAnnouncementAction(announcement.id);
                setConfirming(false);
                setDeleteError(result.ok ? null : result.message);
              })
            }
          >
            Supprimer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
