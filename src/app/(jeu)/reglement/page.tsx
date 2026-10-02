import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { getCurrentSeason } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";
import { formatMalus } from "@/lib/format";
import { BULLSEYE_PERCENT, COEFFICIENTS, JOKER_DIVISOR, JOKERS_PER_SEASON } from "@/lib/game/constants";
import { scoreQuestion } from "@/lib/game/scoring";

export const metadata: Metadata = { title: "Règlement" };

// The rules page (architecture §5.5, §8.3, v1.2) is generated from the scoring constants, and its
// examples are computed by the scoring itself: the published rules and the computation cannot
// diverge.

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

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
const coefficients = COEFFICIENTS.map((c) => `×${c}`).join(", ").replace(/, (?=[^,]*$)/, " ou ");
const guess = (valueNumber: number, joker = false) => ({ valueNumber, optionId: null, joker });
const numberQuestion = (resultNumber: number, coefficient = 1) => ({
  type: "number" as const,
  coefficient,
  resultNumber,
  resultOptionId: null,
  wrongAnswerMalus: null,
});

/** The examples of the rules (cahier des charges §5.2, §5.4, §5.5), scored by the rules themselves. */
function examples() {
  const malusOf = (resultNumber: number, value: number, { joker = false, coefficient = 1 } = {}) =>
    formatMalus(scoreQuestion(numberQuestion(resultNumber, coefficient), [guess(value, joker)]).scores[0].total);
  return {
    // Real value 1 000: the same malus below and above, and no cap.
    below: malusOf(1000, 500),
    above: malusOf(1000, 1500),
    typo: malusOf(1000, 25000),
    // JPO, real value 250.
    jpo: malusOf(250, 240),
    jpoJoker: malusOf(250, 240, { joker: true }),
    jpoFar: malusOf(250, 300),
    jpoCoefficient: malusOf(250, 300, { coefficient: 3 }),
    // The worst of 240 and 300: the malus of an absent player.
    absent: formatMalus(scoreQuestion(numberQuestion(250), [guess(240), guess(300)]).absentMalus),
  };
}

/** Rules (architecture §8.3, v1.2), in the order of the specification. */
export default async function RulesPage() {
  const viewer = await requireUser();
  const season = await getCurrentSeason(getDb(), viewer, new Date());
  const e = examples();

  return (
    <>
      <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Règlement</h1>

      <Section id="principe" title="Principe">
        <p>
          L&apos;admin pose des questions sur les chiffres de l&apos;école : participants à une JPO, candidatures, intégrés… Tu
          pronostiques, et chaque question résolue te donne un <strong>malus</strong> : plus ton prono est loin de la réalité,
          plus il est lourd. Le classement additionne les malus de la saison : <strong>le moins de malus gagne</strong>. Le
          classement final désigne les gagnants des lots.
        </p>
      </Section>

      <Section id="types" title="Types de questions">
        <ul className={LIST}>
          <li>
            <strong>Nombre</strong> : tu saisis une valeur, par exemple le nombre de participants à une JPO.
          </li>
          <li>
            <strong>Choix</strong> : tu choisis une réponse parmi celles proposées.
          </li>
          <li>
            <strong>Oui/non</strong> : un choix à deux réponses.
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
            Avant la clôture, personne ne voit les pronos des autres, pas même l&apos;admin. À la clôture, chaque joueur qui a
            pronostiqué la question voit les pronos de tous et la sagesse de la foule : moyenne, médiane et graphique, ou
            répartition des réponses. Si tu n&apos;as pas pronostiqué, tu les verras au résultat.
          </li>
        </ul>
      </Section>

      <Section id="malus-nombre" title="Malus d'une question à nombre">
        <p>
          Le malus est l&apos;<strong>écart brut</strong> entre ton prono et la valeur réelle, dans l&apos;unité de la question :
          |prono − valeur réelle|, <strong>sans plafond</strong>. Les décimales comptent.
        </p>
        <p>
          <em>Exemple</em> : valeur réelle 1 000. Un prono de 500 donne {e.below} de malus, et un prono de 1 500 aussi : {e.above}.
          Une faute de frappe, 25 000, en donne {e.typo} : vérifie bien ta saisie avant de valider.
        </p>
        <p>
          Une question sur un grand nombre (des milliers de candidatures) pèse donc beaucoup plus qu&apos;une question sur un petit
          nombre (une JPO, un taux).
        </p>
      </Section>

      <Section id="dans-le-mille" title="« Dans le mille »">
        <p>
          Un prono à {BULLSEYE_PERCENT} % ou moins de la valeur réelle est « Dans le mille ». Il ne change pas ton malus, mais il
          compte pour les badges et pour le départage. Si la valeur réelle vaut 0, seul le prono 0 est « Dans le mille ».
        </p>
      </Section>

      <Section id="choix" title="Questions à choix">
        <p>
          Bonne réponse : 0 malus. Mauvaise réponse : le <strong>malus d&apos;une mauvaise réponse</strong>, fixé par l&apos;admin
          sur chaque question et affiché avec elle.
        </p>
      </Section>

      <Section id="coefficient" title="Coefficient">
        <p>L&apos;admin applique un coefficient {coefficients} à chaque question, affiché sur la question : il multiplie le malus.</p>
        <p>
          <strong>Malus d&apos;une question</strong> = malus × coefficient, ÷ {JOKER_DIVISOR} avec un joker.
        </p>
        <p>
          <em>Exemple</em> : JPO, coefficient ×1, valeur réelle 250. Un prono de 240 donne {e.jpo} de malus ; avec un joker,{" "}
          {e.jpoJoker}. Un prono de 300 donne {e.jpoFar} ; avec un coefficient ×3, ce serait {e.jpoCoefficient}.
        </p>
      </Section>

      <Section id="jokers" title="Jokers">
        <p className="font-semibold text-ink">
          {season
            ? season.jokersEnabled
              ? `Cette saison : jokers autorisés (${JOKERS_PER_SEASON} par joueur).`
              : "Cette saison : pas de jokers."
            : "L'admin choisit, pour chaque saison, si les jokers sont autorisés."}
        </p>
        <ul className={LIST}>
          <li>
            Quand la saison les autorise, tu as {JOKERS_PER_SEASON} jokers. Un joker divise par {JOKER_DIVISOR} le malus de la
            question : pose-le là où tu es le moins sûr.
          </li>
          <li>Il se pose sur un prono enregistré, avant sa validation.</li>
          <li>Si la question est annulée, le joker t&apos;est rendu.</li>
        </ul>
      </Section>

      <Section id="pas-de-prono" title="Pas de prono">
        <p>
          Sans prono sur une question résolue, tu prends le malus du <strong>pire prono</strong> de la question : l&apos;écart le
          plus grand de l&apos;équipe (question à nombre), ou le malus d&apos;une mauvaise réponse (question à choix), multiplié
          par le coefficient. Si personne n&apos;a pronostiqué, personne ne prend de malus.
        </p>
        <p>
          <em>Exemple</em> : dans l&apos;exemple de la JPO, avec des pronos de 240 et de 300, un joueur sans prono prend {e.absent}{" "}
          de malus. Ne pas répondre ne rapporte jamais rien.
        </p>
      </Section>

      <Section id="prolongation" title="Prolongation pour un absent">
        <ul className={LIST}>
          <li>
            Si tu n&apos;as pas pu pronostiquer (absence), l&apos;admin peut rouvrir la question pour toi seul, jusqu&apos;à une
            date limite personnelle, tant que le résultat n&apos;est pas saisi. Il te prévient lui-même.
          </li>
          <li>
            Tu retrouves la question dans tes questions ouvertes, avec « Prolongée pour toi » et ton propre compte à rebours. Ton
            prono est validé automatiquement à ta date limite.
          </li>
          <li>
            C&apos;est pour cela qu&apos;on ne voit pas les pronos des autres sans avoir pronostiqué : sinon, une prolongation
            donnerait les réponses. Le prono d&apos;un joueur prolongé reste caché des autres jusqu&apos;à sa date limite.
          </li>
          <li>Le résultat ne peut pas être saisi tant qu&apos;une prolongation court.</li>
        </ul>
      </Section>

      <Section id="departage" title="Départage">
        <p>Au classement :</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          <li>le moins de malus ;</li>
          <li>puis le plus grand nombre de « Dans le mille » ;</li>
          <li>puis l&apos;écart relatif moyen le plus faible (|prono − réel| / réel), sur les questions à nombre que tu as pronostiquées ;</li>
          <li>sinon, ex æquo.</li>
        </ol>
      </Section>

      <Section id="cas-particuliers" title="Cas particuliers">
        <ul className={LIST}>
          <li>Prono enregistré mais pas validé à la clôture (ou à la fin de ta prolongation) : il est validé automatiquement et compte.</li>
          <li>Aucun prono : le malus du pire prono.</li>
          <li>Résultat corrigé après sa publication : les malus sont recalculés, et la correction est signalée sur la question.</li>
          <li>Question annulée : aucun malus pour personne, et le joker éventuellement posé est rendu.</li>
          <li>
            Arrivée en cours de saison : tu joues les questions encore ouvertes ; sur les questions déjà résolues, tu prends le malus
            d&apos;absence. Pour une question clôturée sans résultat, l&apos;admin peut te l&apos;ouvrir par une prolongation.
          </li>
          <li>Départ de l&apos;équipe : le compte est désactivé, son historique est conservé.</li>
          <li>
            Une fois des pronos reçus, l&apos;admin peut encore modifier l&apos;aide et repousser la clôture, mais pas changer
            l&apos;énoncé, les réponses possibles ni le malus d&apos;une mauvaise réponse, ni avancer la clôture.
          </li>
          <li>Toutes les dates et heures sont celles de Paris.</li>
        </ul>
      </Section>

      <Section id="chat" title="Chat">
        <ul className={LIST}>
          <li>
            <strong>Ne donne pas ton prono dans le chat avant la clôture.</strong> Rien ne l&apos;empêche techniquement : c&apos;est
            une question de fair-play.
          </li>
          <li>
            Tu peux supprimer tes messages ; l&apos;admin peut supprimer n&apos;importe quel message. Un message ne se modifie pas.
          </li>
          <li>Quand un résultat est saisi, un message l&apos;annonce dans le{" "}
            <Link href="/chat" className="font-semibold text-accent-text hover:underline">
              chat
            </Link>
            .
          </li>
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
