import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { AvatarForm } from "@/components/profile/AvatarForm";
import { DisplayNameForm } from "@/components/profile/DisplayNameForm";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon compte" };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

/** My account (architecture §8.3): display name, avatar, password, sign-out. */
export default async function ProfilePage() {
  const viewer = await requireUser();

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Mon compte</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>Mon nom</h2>
          <DisplayNameForm name={viewer.name} />
        </Card>
        <Card as="section" className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>Mot de passe</h2>
          <PasswordForm />
        </Card>
      </div>
      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Avatar</h2>
        <AvatarForm avatar={viewer.avatar} name={viewer.name} />
      </Card>
      <form action={signOutAction}>
        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
          <LogOut aria-hidden size={18} strokeWidth={2.2} />
          Se déconnecter
        </button>
      </form>
    </>
  );
}
