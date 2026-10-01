import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { TableScroll } from "@/components/ui/TableScroll";
import { requireUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { CHOICE_POINTS, COEFFICIENTS, JOKER_MULTIPLIER, JOKERS_PER_SEASON, PODIUM_BONUS, SCORE_TIERS } from "@/lib/game/constants";
import { scoreQuestion } from "@/lib/game/scoring";

export const metadata: Metadata = { title: "Règlement" };

// The rules page (architecture §5.5, §8.3) is generated from the scoring constants, and its example
// is computed by the scoring itself: the published rules and the computation cannot diverge.

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
const TD = "px-3 py-2";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-3 text-[15px] text-ink-2 [&_strong]:text-ink">
      <h2 id={id} className={`${SECTION_TITLE} text-ink`}>
        {title}
      </h2>
      {children}
    </Card>
  );
}

const LIST = "flex list-disc flex-col gap-1.5 pl-5";
const bonus = (points: number) => `+${points}`;
const coefficients = COEFFICIENTS.map((c) => `×${c}`).join(", ").replace(/, (?=[^,]*$)/, " ou ");
const podiumBonuses = PODIUM_BONUS.map(bonus).join(", ").replace(/, (?=[^,]*$)/, " et ");

/** The example of the rules (cahier des charges §5.3), scored by the rules themselves. */
function example() {
  const question = { type: "number" as const, priceIsRight: false, coefficient: 1, resultNumber: 250, resultOptionId: null };
  const guess = (valueNumber: number, joker = false) => ({ valueNumber, optionId: null, joker });
  const [closest] = scoreQuestion(question, [guess(240)]);
  const [withJoker] = scoreQuestion(question, [guess(240, true)]);
  const [far] = scoreQuestion(question, [guess(300)]);
  return { closest, withJoker, far };
}

/** Rules (architecture §8.3), in the order of the specification. */
export default async function RulesPage() {
  await requireUser();
  const { closest, withJoker, far } = example();
  const [bullseye] = SCORE_TIERS;
  const lastTier = SCORE_TIERS[SCORE_TIERS.length - 1];

  return (
    <>
      <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Règlement</h1>

      <Section id="principe" title="Principe">
        <p>
          L&apos;admin pose des questions sur les chiffres de l&apos;école : participants à une JPO, candidatures, intégrés… Tu
          pronostiques, et plus ton prono est proche de la réalité, plus tu gagnes de points. Le classement de la saison désigne
          les gagnants des lots.
        </p>
      </Section>

      <Section id="types" title="Types de questions">
        <ul className={LIST}>
          <li>
            <strong>Nombre</strong> : tu saisis une valeur, par exemple le nombre de participants à une JPO.
          </li>
          <li>
            <strong>Nombre « Juste Prix »</strong> : gagne le plus proche sans dépasser.
          </li>
          <li>
            <strong>Choix</strong> : tu choisis une réponse parmi celles proposées. Le oui/non est un choix à deux réponses.
          </li>
        </ul>
      </Section>

      <Section id="validation" title="Enregistrement, validation et clôture">
        <ul className={LIST}>
          <li>
            <strong>Enregistrer</strong> garde ton prono modifiable. <strong>Valider</strong> le rend définitif, après un écran de
            confirmation.
          </li>
          <li>À la clôture, tout prono enregistré est validé automatiquement et compte.</li>
          <li>
            Après la validation, seul l&apos;admin peut déverrouiller ton prono, à ta demande et avant la clôture. Chaque
            déverrouillage est tracé.
          </li>
          <li>
            Avant la clôture, personne ne voit les pronos des autres, pas même l&apos;admin. À la clôture, chacun voit les pronos
            de tous et la sagesse de la foule : moyenne, médiane et graphique, ou répartition des réponses.
          </li>
        </ul>
      </Section>

      <Section id="bareme" title="Barème">
        <p>
          Sur une question à nombre, on note l&apos;<strong>écart relatif</strong> : |prono − valeur réelle| / valeur réelle. Se
          tromper de 50 n&apos;a pas le même sens pour une JPO de 200 personnes et pour plusieurs milliers de candidatures.
        </p>
        <TableScroll label="Points selon l'écart relatif">
          <table className="w-full max-w-120 text-left">
            <caption className="sr-only">Points selon l&apos;écart relatif</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>Écart</th>
                <th scope="col" className={`${TH} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {SCORE_TIERS.map((tier) => (
                <tr key={tier.maxPercent} className="border-b border-line">
                  <th scope="row" className={`${TD} font-normal`}>
                    {tier.maxPercent} % ou moins
                    {tier === bullseye ? <strong className="ml-2 font-semibold text-accent-text">Dans le mille</strong> : null}
                  </th>
                  <td className={`${TD} text-right font-display text-xl font-bold tabular-nums`}>{tier.points}</td>
                </tr>
              ))}
              <tr>
                <th scope="row" className={`${TD} font-normal`}>
                  plus de {lastTier.maxPercent} %
                </th>
                <td className={`${TD} text-right font-display text-xl font-bold tabular-nums`}>0</td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
        <p>
          <strong>Total d&apos;une question</strong> = (points du barème + bonus podium) × coefficient × {JOKER_MULTIPLIER} avec
          un joker.
        </p>
        <p>
          <em>Exemple</em> : JPO, coefficient ×1, valeur réelle 250. Un prono de 240 donne un écart de{" "}
          {formatNumber(closest.relativeError! * 100)} %, soit {closest.basePoints} points. S&apos;il est le plus proche de tous,
          il gagne {bonus(closest.podiumBonus)}, soit {closest.total} points ; avec un joker, {withJoker.total} points. Un prono
          de 300 donne un écart de {formatNumber(far.relativeError! * 100)} %, soit {far.basePoints} points au barème.
        </p>
      </Section>

      <Section id="podium" title="Bonus podium">
        <p>
          Sur une question à nombre, les trois pronos les plus proches gagnent {podiumBonuses} points, même si leur écart ne
          rapporte rien au barème : sur une question très dure, le meilleur est quand même récompensé. Les ex æquo reçoivent le
          même bonus.
        </p>
      </Section>

      <Section id="juste-prix" title="Juste Prix">
        <p>
          Un prono supérieur à la valeur réelle rapporte 0 point, ne joue pas le podium et ne compte pas dans l&apos;écart moyen
          du départage. Les autres sont notés avec le barème, et le bonus podium se joue entre eux.
        </p>
      </Section>

      <Section id="choix" title="Questions à choix">
        <p>
          Bonne réponse : {CHOICE_POINTS} points. Mauvaise réponse : 0 point. Pas de bonus podium. Pour une question à choix plus
          difficile, l&apos;admin augmente le coefficient.
        </p>
      </Section>

      <Section id="coefficient" title="Coefficient">
        <p>L&apos;admin applique un coefficient {coefficients} à chaque question, affiché sur la question.</p>
      </Section>

      <Section id="jokers" title="Jokers">
        <ul className={LIST}>
          <li>
            Tu as {JOKERS_PER_SEASON} jokers par saison. Un joker multiplie par {JOKER_MULTIPLIER} les points de la question.
          </li>
          <li>Il se pose sur un prono enregistré, avant sa validation.</li>
          <li>Si la question est annulée, le joker t&apos;est rendu.</li>
        </ul>
      </Section>

      <Section id="departage" title="Départage">
        <p>À égalité de points au classement :</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>le plus grand nombre de « Dans le mille » ;</li>
          <li>puis l&apos;écart relatif moyen le plus faible sur les questions à nombre (sans les pronos Juste Prix qui dépassent) ;</li>
          <li>sinon, ex æquo.</li>
        </ol>
      </Section>

      <Section id="cas-particuliers" title="Cas particuliers">
        <ul className={LIST}>
          <li>Prono enregistré mais pas validé à la clôture : il est validé automatiquement et compte.</li>
          <li>Aucun prono : 0 point, sans pénalité.</li>
          <li>
            Valeur réelle égale à 0 : l&apos;écart relatif ne se calcule pas. {bullseye.points} points si ton prono vaut 0, sinon
            0.
          </li>
          <li>Résultat corrigé après sa publication : les points sont recalculés, et la correction est signalée sur la question.</li>
          <li>Question annulée : aucun point pour personne, et le joker éventuellement posé est rendu.</li>
          <li>
            Une fois des pronos reçus, l&apos;admin peut encore modifier l&apos;aide et repousser la clôture, mais pas changer
            l&apos;énoncé ni les réponses possibles, ni avancer la clôture.
          </li>
          <li>Arrivée en cours de saison : tu joues les questions encore ouvertes.</li>
          <li>Départ de l&apos;équipe : le compte est désactivé, son historique est conservé.</li>
          <li>Toutes les dates et heures sont celles de Paris.</li>
        </ul>
      </Section>

      <Section id="saisons" title="Saisons et palmarès">
        <ul className={LIST}>
          <li>
            Une saison commence à la date choisie par l&apos;admin, en général à la rentrée, et se termine quand la suivante
            commence. Le classement repart alors de zéro.
          </li>
          <li>Une question appartient à la saison de sa date de clôture.</li>
          <li>
            L&apos;admin proclame le classement final d&apos;une saison une fois toutes ses questions résolues, même si certains
            résultats tombent après la fin de la saison. Ce classement est alors figé au{" "}
            <Link href="/palmares" className="font-semibold text-accent-text hover:underline">
              palmarès
            </Link>
            .
          </li>
        </ul>
      </Section>

      <Section id="lots" title="Lots">
        <p>
          Les lots de la saison récompensent le classement final.{" "}
          <Link href="/lots" className="font-semibold text-accent-text hover:underline">
            Voir les lots
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
