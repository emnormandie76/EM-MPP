# Avancement — Le Bon Chiffre

> Fichier tenu à jour par les agents à la fin de chaque étape et de chaque intervention humaine (voir [architecture.md](architecture.md), §0). L'utilisateur peut le lire pour savoir où en est la construction.

## Étapes

| Étape | Titre | Date cible | Statut | Validée par l'utilisateur le | Notes |
|---|---|---|---|---|---|
| É1 | Socle du projet | 30/09/2026 | Validée | 30/09/2026 | Branche `etape-01-socle`. `verify` OK (25 tests unitaires), `test:e2e` OK (5 tests) |
| É2 | Hébergement et base de données | 01/10/2026 | À faire | | |
| É3 | Données et moteur de règles | 02/10/2026 | À faire | | |
| É4 | Comptes et accès | 05/10/2026 | À faire | | |
| É5 | Back-office | 06/10/2026 | À faire | | |
| É6 | Parcours joueur | 08/10/2026 | À faire | | |
| É7 | Résultats, classement, palmarès | 10/10/2026 | À faire | | |
| É8 | Finitions et qualité | 12/10/2026 | À faire | | |
| É9 | Recette et lancement | 13/10/2026 | À faire | | Lancement le 14/10/2026 |

Statuts possibles : À faire · En cours · En attente de validation · Validée.

## Interventions humaines

| ID | Intitulé | Étape | Statut | Date |
|---|---|---|---|---|
| H-01 | Node.js et Git | É1 | En cours : Git 2.53 OK ; Node 24.21 installé avec fnm ; reste à retirer Node 25 du PATH utilisateur | 29/09/2026 |
| H-02 | Feu vert sur le document d'architecture | avant É1 | Fait, avec deux précisions (voir le journal) | 29/09/2026 |
| H-03 | Compte Vercel et import du dépôt | É2 | À faire | |
| H-04 | CLI Vercel et liaison du projet | É2 | À faire | |
| H-05 | Base de données Neon | É2 | À faire | |
| H-06 | Secrets et variables d'application | É2 | À faire | |
| H-07 | Ouvrir les aperçus aux collègues | É9 | À faire | |
| H-08 | Validation de fin d'étape | chaque étape | — | voir le tableau des étapes |
| H-09 | Compte admin en production | après É4 | À faire | |
| H-10 | Liste blanche de l'équipe | après H-09 | À faire | |
| H-11 | Contenu de la campagne | après É5 | À faire | |
| H-12 | Recette avec des collègues | É9 | À faire | |
| H-13 | Relecture du règlement et des textes | É9 | À faire | |
| H-14 | Checklist de lancement | 13/10 | À faire | |
| H-15 | Annonce du lancement | 14/10 | À faire | |

## Informations de projet

À compléter au fil des interventions. **Aucun secret ici.**

| Information | Valeur |
|---|---|
| Adresse de production | |
| Nom du projet Vercel | |
| Région de la base Neon | Francfort (eu-central-1) |
| Heure d'ouverture de la campagne | |
| Heure de clôture de la campagne | |

## Journal des décisions

| Date | Décision | Origine |
|---|---|---|
| 29/09/2026 | Cahier des charges v1.0 validé | utilisateur |
| 29/09/2026 | Tout le projet se fait avec Opus 5.5, effort extra high | utilisateur |
| 29/09/2026 | Style retenu : B5 « Jour de match » (maquette dans `docs/design/maquette-b5/`) | utilisateur |
| 29/09/2026 | Architecture v1.0 : Next.js, Tailwind v4, Neon, Drizzle, Better Auth, PGlite pour les tests, aucune tâche planifiée, points recalculés à la lecture | utilisateur (H-02) |
| 29/09/2026 | Avatars : 16 maillots SVG (8 couleurs × 2 motifs) avec initiales, en réponse à la « galerie d'illustrations » du cahier des charges | utilisateur (H-02) |
| 29/09/2026 | Saison affichée par défaut (§5.6) : on ne se replie sur la saison précédente que si elle a au moins une question publiée (sinon, au lancement, on afficherait 2025-2026, qui n'existe pas) | agent, validé par l'utilisateur (H-02) |
| 29/09/2026 | Node.js 24 LTS partout (§1.2) : `.node-version` et `engines` dans `package.json`. Node 25, présent sur le poste, n'est plus maintenu depuis juin 2026 et n'est pas proposé par Vercel | agent, validé par l'utilisateur (H-01, option A) |
| 29/09/2026 | É1 : versions installées. Next.js 16.3.7 (Turbopack), React 19.2.8, Tailwind CSS 4, Vitest 5.0.2, Playwright 1.63, Zod 4, date-fns 4, lucide-react 1.48 | agent |
| 29/09/2026 | ESLint reste en version 9 : avec ESLint 10, le plugin React fourni par `eslint-config-next` 16.3.7 plante (`getFilename is not a function`). À revoir quand `eslint-config-next` sera compatible | agent (§14) |
| 29/09/2026 | Script `typecheck` = `next typegen && tsc --noEmit` : les types de routes de Next (`LayoutProps`…) sont générés et ignorés par git, sans quoi `tsc` échoue sur un dépôt fraîchement cloné | agent (§3.2) |
| 29/09/2026 | `"type": "module"` dans `package.json` : la configuration Vitest est chargée en ESM (sinon avertissement de Vite), et les scripts `tsx` de l'étape 2 en profitent | agent |
| 29/09/2026 | `zod`, `date-fns` et `@date-fns/tz` installés dès É1 (tâche 3 : tout le §1.2 sauf base et Better Auth). À l'étape 3, seul `better-auth` reste à installer | agent |
| 29/09/2026 | Palette Tailwind par défaut retirée (`--color-*: initial`) : seules les couleurs B5 existent, ce qui empêche d'utiliser une couleur hors maquette | agent (§8.1) |
| 29/09/2026 | Le groupe de routes `(jeu)` est créé dès É1 (en-tête et pied de page) ; l'étape 4 y ajoutera `requireUser()`. Saison du pied de page provisoirement fixée à 2026-2027, remplacée par `seasonLabelFor(now)` à l'étape 3 | agent |
| 29/09/2026 | Points d'API relevés pour la suite : dans Next 16.3, `error.tsx` reçoit `retry()` (et non plus `reset`) ; dans lucide-react v1, l'icône `Trash2` du §8.1 s'appelle `Trash` | agent (§14) |
| 30/09/2026 | Bordure des champs trop pâle (`line-strong` sur blanc ≈ 1,9:1, seuil 3:1) : on garde la maquette pour l'instant, à traiter à l'étape 8 (tâche 2 de É8) | agent, validé par l'utilisateur |
| 29/09/2026 | Tests de bout en bout : jusqu'à l'étape 2, Playwright attend `/` (et non `/api/health`), et `e2e:serve` ne lance pas encore `e2e-prepare.ts` | agent |
