"use client";

import { Pencil, Plus, Trash } from "lucide-react";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useFormAction } from "@/components/ui/useFormAction";
import { useStaleResult } from "@/components/ui/useStaleResult";
import { createSeasonAction, deleteSeasonAction, updateSeasonAction } from "@/lib/actions/content";
import type { FormState } from "@/lib/actions/form-state";
import { seasonStartFromLocalDate, suggestedSeasonLabel } from "@/lib/game/time";
import { SEASON_NAME_MAX } from "@/lib/validation/content";

// Seasons of /admin/saisons (architecture §5.13, §8.3): creation, renaming, start day, deletion.

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;
const START_HINT = "La saison commence à 0 h, heure de Paris, ce jour-là.";

function fieldError(state: FormState, field: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[field] : undefined;
}

/** The message of a refusal that no field shows. */
function formFeedback(state: FormState, fields: string[]) {
  if (!state) return null;
  if (state.ok) return { tone: "success" as const, text: state.message };
  const shown = fields.some((field) => state.fieldErrors?.[field] === state.message);
  return shown ? null : { tone: "error" as const, text: state.message };
}

/** Name suggested for a start day, or null while the date is incomplete. */
function suggestionFor(startsOn: string): string | null {
  try {
    return suggestedSeasonLabel(seasonStartFromLocalDate(startsOn));
  } catch {
    return null;
  }
}

/**
 * New season: name and start day. The name follows the start day ("2027-2028") until the admin
 * types their own; once the season is created, the form offers the next one. When the seasons
 * change elsewhere on the page (a season deleted or moved), an untouched form follows the new
 * suggestion (test report of 01/10/2026, R-05: it kept a date based on the deleted season).
 */
export function SeasonCreateForm({ suggestedStart, suggestedLabel }: { suggestedStart: string; suggestedLabel: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createSeasonAction, null);
  const [startsOn, setStartsOn] = useState(suggestedStart);
  const [label, setLabel] = useState(suggestedLabel);
  const [labelTyped, setLabelTyped] = useState(false);
  const [handled, setHandled] = useState<FormState>(null);
  const [offered, setOffered] = useState({ start: suggestedStart, label: suggestedLabel });
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      setStartsOn(suggestedStart);
      setLabel(suggestedLabel);
      setLabelTyped(false);
    }
  }
  if (offered.start !== suggestedStart || offered.label !== suggestedLabel) {
    setOffered({ start: suggestedStart, label: suggestedLabel });
    if (startsOn === offered.start && !labelTyped) {
      setStartsOn(suggestedStart);
      setLabel(suggestedLabel);
    }
  }

  function changeStart(value: string) {
    setStartsOn(value);
    const suggestion = suggestionFor(value);
    if (!labelTyped && suggestion) setLabel(suggestion);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-wrap gap-3">
        <Field
          name="startsOn"
          id="new-season-start"
          type="date"
          label="Date de début"
          hint={START_HINT}
          value={startsOn}
          onChange={(event) => changeStart(event.target.value)}
          error={fieldError(state, "startsOn")}
          className="w-64"
        />
        <Field
          name="label"
          id="new-season-label"
          label="Nom"
          maxLength={SEASON_NAME_MAX}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setLabelTyped(true);
          }}
          error={fieldError(state, "label")}
          className="w-64"
        />
      </div>
      <Button type="submit" pending={pending} className="self-start">
        <Plus {...ICON} />
        Créer la saison
      </Button>
      <FormMessage feedback={formFeedback(state, ["label", "startsOn"])} />
    </form>
  );
}

export type SeasonActionsProps = {
  season: {
    id: number;
    label: string;
    /** `YYYY-MM-DD`, Paris time. */
    startsOn: string;
    proclaimed: boolean;
    prizeCount: number;
  };
  /** Why the season cannot be deleted, or null. */
  deleteBlocked: string | null;
};

/** Edit (inline form: name and start day) and delete (with confirmation) one season. */
export function SeasonActions({ season, deleteBlocked }: SeasonActionsProps) {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<FormState>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const zone = useRef<HTMLDivElement>(null);
  // « Saison modifiée. » goes once another action starts on the page (creation of a season, lots…).
  const editStale = useStaleResult(editState, zone);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateSeasonAction(null, formData);
      setEditState(result);
      if (result?.ok) setEditing(false);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSeasonAction(season.id);
      setDialogOpen(false);
      setDeleteError(result.ok ? null : result.message);
    });
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-col gap-3" noValidate>
        <input type="hidden" name="seasonId" value={season.id} />
        {/* A disabled field is not sent: the proclaimed season sends its start day unchanged. */}
        {season.proclaimed ? <input type="hidden" name="startsOn" value={season.startsOn} /> : null}
        <div className="flex flex-wrap gap-3">
          <Field
            name="label"
            id={`season-${season.id}-label`}
            label={`Nom de la saison ${season.label}`}
            defaultValue={season.label}
            maxLength={SEASON_NAME_MAX}
            error={fieldError(editState, "label")}
            className="w-64"
          />
          <Field
            name={season.proclaimed ? "startsOnLocked" : "startsOn"}
            id={`season-${season.id}-start`}
            type="date"
            label={`Début de la saison ${season.label}`}
            defaultValue={season.startsOn}
            disabled={season.proclaimed}
            hint={season.proclaimed ? "Saison proclamée : sa date de début ne change plus." : START_HINT}
            error={fieldError(editState, "startsOn")}
            className="w-64"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" pending={pending}>
            Enregistrer
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </div>
        <FormMessage feedback={formFeedback(editState, ["label", "startsOn"])} />
      </form>
    );
  }

  return (
    <div ref={zone} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          aria-label={`Modifier la saison ${season.label}`}
          onClick={() => {
            setEditState(null);
            setEditing(true);
          }}
        >
          <Pencil {...ICON} />
          Modifier
        </Button>
        <Button
          variant="danger"
          aria-label={`Supprimer la saison ${season.label}`}
          disabled={deleteBlocked !== null}
          aria-describedby={deleteBlocked ? `season-${season.id}-delete-blocked` : undefined}
          onClick={() => setDialogOpen(true)}
        >
          <Trash {...ICON} />
          Supprimer
        </Button>
      </div>
      {deleteBlocked ? (
        <p id={`season-${season.id}-delete-blocked`} className="text-sm text-ink-2">
          {deleteBlocked}
        </p>
      ) : null}
      <FormMessage
        feedback={
          deleteError ? { tone: "error", text: deleteError } : editState?.ok && !editStale ? { tone: "success", text: editState.message } : null
        }
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={`Supprimer la saison ${season.label} ?`}>
        <p className="text-[15px] text-ink-2">
          {season.prizeCount > 0
            ? `La saison et ses lots (${season.prizeCount}) seront supprimés définitivement.`
            : "La saison sera supprimée définitivement."}{" "}
          La saison qui la précède continuera jusqu&apos;au début de la suivante.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>
            Retour
          </Button>
          <Button variant="danger" pending={pending} onClick={remove}>
            Supprimer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
