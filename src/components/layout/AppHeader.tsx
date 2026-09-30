import type { Viewer } from "@/lib/auth/session";
import { Logo } from "./Logo";
import { MainNav } from "./MainNav";

/** Game header (architecture §8.2): logo, navigation, admin link for admins, account menu. */
export function AppHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex h-18 w-full max-w-page items-center gap-4 px-4 lg:gap-9 lg:px-12">
        <Logo />
        <MainNav viewer={{ name: viewer.name, avatar: viewer.avatar, isAdmin: viewer.role === "admin" }} />
      </div>
    </header>
  );
}
