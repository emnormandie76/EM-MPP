import { LogoWordmark } from "@/components/layout/Logo";

/** Sign-in and sign-up: a centred page, without the game header (architecture §2, §8.3). */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex grow flex-col items-center justify-center gap-6 px-4 py-12">
      <LogoWordmark />
      {children}
    </main>
  );
}
