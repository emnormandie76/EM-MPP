"use client";

import { type FormEvent, startTransition, useActionState, useRef } from "react";
import { useStaleResult } from "./useStaleResult";

/**
 * useActionState for long forms: React resets a `<form action>` after each submission, which
 * would erase what was typed when the server refuses it. Here the form is submitted by hand, with
 * the clicked button (for example `intent=publish`), and keeps its fields. Once another action
 * starts on the page, the state goes back to `initialState`: its message would no longer describe
 * the last action (useStaleResult).
 */
export function useFormAction<S>(
  action: (state: Awaited<S>, formData: FormData) => S | Promise<S>,
  initialState: Awaited<S>,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);
  const form = useRef<HTMLFormElement | null>(null);
  const stale = useStaleResult(state === initialState ? null : state, form);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.current = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return [stale ? initialState : state, onSubmit, pending] as const;
}
