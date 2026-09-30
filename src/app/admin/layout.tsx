import { AdminNav } from "@/components/layout/AdminNav";
import { GameShell } from "@/components/layout/GameShell";
import { requireAdmin } from "@/lib/auth/session";

/** Back office: admins only; a player gets the 404 page (architecture §6.4). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireAdmin();
  return (
    <GameShell viewer={viewer}>
      <AdminNav />
      {children}
    </GameShell>
  );
}
