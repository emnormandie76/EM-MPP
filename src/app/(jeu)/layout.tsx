import { GameShell } from "@/components/layout/GameShell";
import { requireUser } from "@/lib/auth/session";

/** Game pages: a valid session is required (architecture §6.4). */
export default async function GameLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireUser();
  return <GameShell viewer={viewer}>{children}</GameShell>;
}
