"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/avatars/Avatar";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { updateAvatarAction } from "@/lib/actions/profile";
import { AVATAR_KEYS, type AvatarKey, avatarLabel } from "@/lib/avatars";

/** Gallery of the 16 jerseys, as radio tiles (§8.3). */
export function AvatarForm({ avatar, name }: { avatar: AvatarKey; name: string }) {
  const [result, formAction, pending] = useActionState(updateAvatarAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="min-w-0">
        <legend className="mb-3 text-[15px] text-ink-2">Choisis ton maillot. Tes initiales sont imprimées dessus.</legend>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
          {AVATAR_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-center rounded-field border border-line-strong bg-surface p-2 hover:bg-raised has-checked:border-accent has-checked:ring-1 has-checked:ring-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input type="radio" name="avatar" value={key} defaultChecked={key === avatar} className="sr-only" />
              <span className="sr-only">{avatarLabel(key)}</span>
              <Avatar avatar={key} name={name} size={48} />
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage
        feedback={
          result === null ? null : result.ok ? { tone: "success", text: "Avatar enregistré." } : { tone: "error", text: result.message }
        }
      />
      <Button type="submit" variant="secondary" pending={pending} className="self-start">
        Enregistrer l&apos;avatar
      </Button>
    </form>
  );
}
