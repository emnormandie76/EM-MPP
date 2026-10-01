import type { Metadata } from "next";
import { Avatar } from "@/components/avatars/Avatar";
import { AccountActions } from "@/components/admin/AccountActions";
import { AllowListForm } from "@/components/admin/AllowListForm";
import { RemoveAllowedEmailButton } from "@/components/admin/RemoveAllowedEmailButton";
import { Card } from "@/components/ui/Card";
import { TableScroll } from "@/components/ui/TableScroll";
import { requireAdmin } from "@/lib/auth/session";
import { getAccounts, getAllowedEmails } from "@/lib/data/players";
import { getDb } from "@/lib/db/client";
import { formatCount, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Joueurs" };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
const TD = "px-3 py-2.5 align-middle";

/** Allow list and accounts (architecture §6.3, §8.3). */
export default async function PlayersAdminPage() {
  const viewer = await requireAdmin();
  const db = getDb();
  const now = new Date();
  const allowed = await getAllowedEmails(db, viewer);
  const accounts = await getAccounts(db, viewer);

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Joueurs</h1>

      <Card as="section" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className={SECTION_TITLE}>Liste blanche</h2>
          <p className="text-[15px] text-ink-2">
            Seules ces adresses peuvent créer un compte, en plus de celles des admins. {formatCount(allowed.length, "adresse")}.
          </p>
        </div>
        <AllowListForm />
        <TableScroll label="Adresses de la liste blanche">
          <table className="w-full min-w-120 text-left text-[15px]">
            <caption className="sr-only">Adresses de la liste blanche</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>Adresse</th>
                <th scope="col" className={TH}>Compte créé</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {allowed.map(({ email, hasAccount }) => (
                <tr key={email} className="border-b border-line last:border-b-0">
                  <td className={`${TD} whitespace-nowrap`}>{email}</td>
                  <td className={TD}>{hasAccount ? "Oui" : "Non"}</td>
                  <td className={TD}>{hasAccount ? null : <RemoveAllowedEmailButton email={email} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      <Card as="section" className="flex flex-col gap-5">
        <h2 className={SECTION_TITLE}>Comptes</h2>
        <TableScroll label="Comptes des joueurs">
          <table className="w-full min-w-260 text-left text-[15px]">
            <caption className="sr-only">Comptes des joueurs</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>Nom</th>
                <th scope="col" className={TH}>Email</th>
                <th scope="col" className={TH}>Rôle</th>
                <th scope="col" className={TH}>Statut</th>
                <th scope="col" className={TH}>Dernière visite</th>
                <th scope="col" className={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-line last:border-b-0">
                  <th scope="row" className={`${TD} font-semibold`}>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar avatar={account.avatar} name={account.name} size={32} ring={account.isViewer} />
                      {account.name}
                    </span>
                  </th>
                  <td className={`${TD} whitespace-nowrap`}>{account.anonymized ? "—" : account.email}</td>
                  <td className={TD}>{account.role === "admin" ? "Admin" : "Joueur"}</td>
                  <td className={TD}>{account.anonymized ? "Anonymisé" : account.banned ? "Désactivé" : "Actif"}</td>
                  <td className={`${TD} text-muted`}>
                    {account.lastSeenAt ? formatRelative(account.lastSeenAt, now) : "Jamais"}
                  </td>
                  <td className={TD}>
                    {account.anonymized ? null : account.isViewer ? (
                      <span className="text-sm text-muted">C&apos;est toi</span>
                    ) : (
                      <AccountActions
                        account={{ id: account.id, name: account.name, role: account.role, banned: account.banned }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </>
  );
}
