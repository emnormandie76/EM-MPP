"use client";

import { type FormEvent, startTransition, useActionState } from "react";

/**
 * useActionState for long forms: React resets a `<form action>` after each submission, which
 * would erase what was typed when the server refuses it. Here the form is submitted by hand, with
 * the clicked button (for example `intent=publish`), and keeps its fields.
 */
export function useFormAction<S>(
  action: (state: Awaited<S>, formData: FormData) => S | Promise<S>,
  initialState: Awaited<S>,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return [state, onSubmit, pending] as const;
}
