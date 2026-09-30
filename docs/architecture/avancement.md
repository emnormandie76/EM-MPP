# Avancement — Le Bon Chiffre

> Fichier tenu à jour par les agents à la fin de chaque étape et de chaque intervention humaine (voir [architecture.md](architecture.md), §0). L'utilisateur peut le lire pour savoir où en est la construction.

## Étapes

| Étape | Titre | Date cible | Statut | Validée par l'utilisateur le | Notes |
|---|---|---|---|---|---|
| É1 | Socle du projet | 30/09/2026 | Validée | 30/09/2026 | Branche `etape-01-socle`, fusionnée dans `main` le 30/09. `verify` OK (25 tests unitaires), `test:e2e` OK (5 tests) |
| É2 | Hébergement et base de données | 01/10/2026 | Validée | 30/09/2026 | Branche `etape-02-hebergement`, fusionnée dans `main` le 30/09. `verify` OK (38 tests unitaires et d'intégration), `test:e2e` OK (6 tests). Production : migration appliquée sur `main` avant le build, base marquée « production », `/api/health` à `ok: true` (fonction en `fra1`). `dev` non marquée |
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
| H-01 | Node.js et Git | É1 | Fait : Git 2.53 ; Node 24.21 avec fnm, seul Node présent dans le PATH (Node 25 retiré) | 30/09/2026 |
| H-02 | Feu vert sur le document d'architecture | avant É1 | Fait, avec deux précisions (voir le journal) | 29/09/2026 |
| H-03 | Compte Vercel et import du dépôt | É2 | Fait : projet `le-bon-chiffre` (équipe `em-normandie1`), la production répond | 30/09/2026 |
| H-04 | CLI Vercel et liaison du projet | É2 | Fait : CLI 61.1.0 connectée (`emnormandie76`), dépôt lié | 30/09/2026 |
| H-05 | Base de données Neon | É2 | Fait : base créée par l'utilisateur, branche `dev` créée ; variables de `dev` ajoutées par l'agent via les CLI Neon et Vercel (valeurs jamais affichées) | 30/09/2026 |
| H-06 | Secrets et variables d'application | É2 | Fait par l'agent à la demande de l'utilisateur : `BETTER_AUTH_SECRET` (3 valeurs distinctes, Secret en Production et Preview), `BETTER_AUTH_URL` (Production, Development), `ADMIN_EMAILS` (2 adresses, 3 environnements), sans affichage ; `check:env` tout à OK | 30/09/2026 |
| H-07 | Ouvrir les aperçus aux collègues | É9 | À faire | |
| H-08 | Validation de fin d'étape | chaque étape | É1 et É2 faites | voir le tableau des étapes |
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
| Adresse de production | https://le-bon-chiffre.vercel.app |
| Nom du projet Vercel | `le-bon-chiffre` (équipe `em-normandie1`) |
| Région de la base Neon | Francfort (eu-central-1) |
| Projet Neon | `neon-bisque-pillar` (id `gentle-thunder-89807010`), organisation gérée par Vercel « Vercel: EM-Normandie », offre Free, PostgreSQL 18 |
| Branches Neon | `main` (principale, production) ; `dev` (développement local et aperçus) ; base `neondb`, rôle `neondb_owner` |
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
| 30/09/2026 | É1 fusionnée dans `main` avant l'import Vercel (H-03) : sinon, le premier déploiement de production aurait publié la seule documentation | agent, validé par l'utilisateur |
| 30/09/2026 | Le dépôt distant local est configuré avec un jeton d'accès GitHub dans son adresse. Il est conservé pour l'instant, à revoir en fin d'É2 (recommandation : adresse sans jeton, Git Credential Manager déjà installé, puis révocation du jeton) | utilisateur |
| 30/09/2026 | CLI Vercel 61 : `vercel link` lie le dépôt entier (`.vercel/repo.json`) au lieu d'un seul dossier (`.vercel/project.json`). Aucune conséquence : `.vercel/` reste ignoré par git et les commandes (`env pull`, `inspect`) fonctionnent | agent (§14) |
| 30/09/2026 | Neon : la branche principale s'appelle `main` (et non `production` comme au §1.3) ; on ne la renomme pas. Partout où l'architecture dit « branche `production` », lire `main` | agent |
| 30/09/2026 | H-05 finie par l'agent à la demande de l'utilisateur : chaînes de `dev` lues avec la CLI Neon et envoyées par un tube à `vercel env add` (Preview et Development, type Config car Vercel refuse « Sensitive » en Development), sans jamais être affichées. Contrôles faits : chaîne poolée avec `-pooler`, directe sans, point d'accès distinct de `main`, `sslmode=require` | utilisateur, agent |
| 30/09/2026 | L'intégration Vercel-Neon a aussi activé Neon Auth (variables `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL` en Production). Inutilisé : l'application garde son propre Better Auth (§6). À désactiver ou laisser : à décider en fin d'É2 | agent |
| 30/09/2026 | Outils Neon pour les agents, à la demande de l'utilisateur : skills `neon` et `neon-postgres` (`.claude/skills/`, `skills-lock.json`), CLI `neon` 7.0.1 (installée globalement, connectée), serveur MCP Neon au niveau du projet (`.mcp.json`, OAuth, sans clé). Outils de développement uniquement, sans effet sur l'application | utilisateur |
| 30/09/2026 | `ADMIN_EMAILS` : deux admins, `aparede@em-normandie.fr` et `lakhsassi@em-normandie.fr` | utilisateur |
| 30/09/2026 | É2 : versions installées. drizzle-orm 0.45.3, drizzle-kit 0.31.11 (dernières stables ; la 1.0 est encore en bêta), pg 8.23, @electric-sql/pglite 0.5.8, @vercel/functions 3.9.9 (`attachDatabasePool` disponible et utilisé), @next/env 16.3.7, @neondatabase/serverless 1.1.0 | agent |
| 30/09/2026 | **Le réseau de l'EM Normandie ne laisse sortir que les ports 80 et 443** : le port 5432 de PostgreSQL est bloqué, vers Neon comme vers tout autre serveur. Option retenue : pilote WebSocket officiel de Neon (`@neondatabase/serverless`, port 443) en local uniquement, activé par `DB_DRIVER=neon-ws` dans `.env.development.local` (propre au poste, ignoré par git, non écrasé par `vercel env pull`). Vercel et la production gardent `pg`. Option écartée : garder seulement `pg` et faire les opérations locales sur Neon depuis un autre réseau. Architecture mise à jour (§1.2, §2, §3.1, §7.2) | utilisateur (option recommandée par l'agent) |
| 30/09/2026 | Première migration « technique » (É2, tâche 5) : la table `app_meta` (§4.3), seule table non métier, nécessaire à `migrate.ts` pour poser le marqueur de production | agent |
| 30/09/2026 | Code commun des scripts dans `scripts/lib/` (`db.ts` : ouverture, migration, marqueur ; `env-rules.ts` : règles de `check:env`, testées ; `load-env.ts`). `createTestDb()` réutilise `scripts/lib/db.ts` | agent (§2) |
| 30/09/2026 | `@next/env` est un paquet CommonJS dont Node ne voit pas les exports nommés depuis un module ESM : les scripts passent par son export par défaut. Ils chargent les fichiers comme `next dev` (`.env.development.local`, `.env.local`, `.env`) | agent (§14) |
| 30/09/2026 | PGlite exclu du paquet des fonctions Vercel (`outputFileTracingExcludes` dans `next.config.ts`) : il représentait 21 Mo sur 23 alors que la production ne le charge jamais. Les pilotes PGlite et WebSocket sont chargés à la demande (`createRequire`) et restent des dépendances de développement | agent (§3.3, §7.2) |
| 30/09/2026 | Correctif de l'É1 : `README.md` était encore en UTF-16 (y compris dans le commit), converti en UTF-8 et complété avec les commandes de l'É2 | agent |
| 30/09/2026 | `next dev` (16.3) ajoute à `CLAUDE.md` un bloc « nextjs-agent-rules » qui invite les agents à lire la documentation fournie dans `node_modules/next/dist/docs/`. Conservé (cohérent avec §1.2 et §14) ; on peut le couper avec `agentRules: false` dans `next.config.ts` | agent, à confirmer par l'utilisateur |
| 30/09/2026 | H-08 de l'É2 : l'utilisateur a demandé la fusion dans `main`. Sans réponse sur les trois points ouverts, on garde les choix par défaut : bloc Next conservé dans `CLAUDE.md`, Neon Auth laissé activé (inutilisé), jeton GitHub toujours dans l'adresse du dépôt distant (retrait et révocation recommandés) | utilisateur |
| 30/09/2026 | Journaux de build de production : Vercel masque (`[REDACTED]`) le nom d'hôte de la base, car les variables de production sont de type Secret. La vérification du marqueur se lit sur la ligne « Base marquée comme base de production » | agent |
| 30/09/2026 | Point à surveiller : `pg` 8.23 affiche un avertissement sur `sslmode=require` (traité comme `verify-full`, sens qui changera avec `pg` 9). Sans effet aujourd'hui ; à traiter si l'on passe à `pg` 9 | agent (§14) |
