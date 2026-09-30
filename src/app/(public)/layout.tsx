import { LogoMark } from "@/components/layout/Logo";

/** Sign-in and sign-up: a centred page, without the game header (architecture §2, §8.3). */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex grow flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2.5 text-ink">
        <LogoMark />
        <span className="font-display text-[26px] font-extrabold italic uppercase tracking-[0.01em]">
          Le Bon Chiffre
        </span>
      </div>
      {children}
    </main>
  );
}
