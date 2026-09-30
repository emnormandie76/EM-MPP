// State returned to a form by its Server Action (useActionState): a message to announce, and the
// errors of each field.
export type FormState =
  | null
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
