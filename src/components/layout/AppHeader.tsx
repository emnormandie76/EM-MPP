import { Logo } from "./Logo";
import { MainNav } from "./MainNav";

/** Game header. Step 4 adds the admin link, the avatar and the account menu. */
export function AppHeader() {
  return (
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex h-18 w-full max-w-page items-center gap-4 px-4 lg:gap-9 lg:px-12">
        <Logo />
        <MainNav />
      </div>
    </header>
  );
}
