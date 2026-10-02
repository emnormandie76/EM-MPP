# Architecture et plan de construction — Les petits pronos de la promo

> **Version 1.2 du 02/10/2026.** Référence technique pour les agents IA qui construisent l'application, et pour l'utilisateur qui les pilote. Remplace la proposition v0.1.
>
> - **Changements de la v1.2** (demandés par l'utilisateur le 02/10/2026, cahier des charges v1.2), en deux étapes insérées avant l'É9 :
>   - **É8c** :
>     - barème en malus égal à l'écart brut, sans plafond ; le moins de malus gagne (§5.5, §5.6) ;
>     - Juste Prix et bonus podium supprimés ;
>     - malus d'une mauvaise réponse fixé sur chaque question à choix ;
>     - malus du pire prono pour un absent ;
>     - jokers autorisés ou non par saison, qui divisent le malus par deux (§5.4, §5.13) ;
>     - prolongation d'une question pour un joueur absent (§5.14) ;
>     - pronos des autres cachés, jusqu'au résultat, à qui n'a pas pronostiqué (§6.6) ;
>     - couleur principale #0036B3 (§8.1).
>   - **É8d** : chat général avec grille d'emojis et message automatique au résultat (§5.15).
>   - Sections touchées : §1.1, §2, §4.3, §5, §6.4 à §6.6, §7.3, §7.4, §8, §9, §11, §13, annexes.
> - **Changements de la v1.1** (demandés et validés par l'utilisateur le 30/09/2026, y compris la suppression de la colonne `season.ends_at`) : saisons gérées par l'admin (§4.3, §5.1, §5.11, §5.13, §8.3, étape É5b) ; étape de changement du nom du site (É8b, H-16). Précisé pendant l'É5b (30/09/2026) : règle des saisons proclamées et ordre des verrous (§5.13), saison par défaut `defaultSeason` (§5.6). Précisé pendant l'É6 (30/09/2026) : verrous des pronos (§5.4), signature de `recordVisit` (§5.9), joker posé aussitôt, onglet par défaut de `/pronos` et question annulée avant son ouverture (§8.2, §8.3). Précisé pendant l'É7 (30/09/2026) : comptes d'un classement de saison (§5.6), aucune question publiée dans une saison proclamée (§5.11, §5.12), nom anonymisé aussi dans le palmarès (§4.3, §6.3), lectures des résultats (§7.4), saison du profil public (§8.3), seed à trois saisons et deux questions clôturées (§9.6). Précisé pendant l'É8 (01/10/2026) : bordure `line-strong` foncée à #7E8796 (§8.1), classement compact sur téléphone (§8.3, §8.4), conteneur défilant des tableaux et squelettes de chargement (§2, §8.3, §8.4), page d'erreur globale (§8.3), contrôle de visibilité dans le layout de `/questions/[id]` (§7.4, §8.3), tests à 390 px (§9.4), streaming (§14). Précisé après la recette par un agent (01/10/2026, rapport `docs/recette/rapport-recette-2026-10-01.md`) : prono Juste Prix qui dépasse hors de l'écart moyen (§5.5, §5.6), étiquette « TOI » à côté du point (§5.7, §8.2), jokers masqués dans l'historique avant la clôture (§6.6), titre des pages d'admin caché aux joueurs (§6.4), confirmation de la désactivation (§6.3), messages de résultat et grilles à 390 px (§8.4, §8.5), espace des milliers et année des dates (§8.6). Précisé à l'É8b (02/10/2026) : le site s'appelle « Les petits pronos de la promo », nom écrit une seule fois dans `APP_NAME` (`src/lib/app.ts`), logo sur deux lignes (§8.2), nouvelle adresse `les-petits-pronos-de-la-promo.vercel.app` (H-16), test de fumée en production lancé seul avec `BASE_URL` (§9.1).
> - Règles fonctionnelles : [cahier des charges v1.2](../features/cahier-des-charges.md). En cas de désaccord entre les deux documents, le cahier des charges fait foi sur le **quoi**, ce document sur le **comment** ; signaler toute contradiction à l'utilisateur.
> - Suivi de la construction : [avancement.md](avancement.md).
> - Maquette visuelle retenue (B5 « Jour de match ») : [docs/design/maquette-b5/](../design/maquette-b5/).

## Sommaire

0. [Mode d'emploi pour les agents](#0-mode-demploi-pour-les-agents)
1. [Vue d'ensemble](#1-vue-densemble)
2. [Arborescence du projet](#2-arborescence-du-projet)
3. [Configuration](#3-configuration)
4. [Modèle de données](#4-modèle-de-données)
5. [Règles métier (spécifications exactes)](#5-règles-métier-spécifications-exactes)
6. [Authentification et autorisations](#6-authentification-et-autorisations)
7. [Couche serveur](#7-couche-serveur)
8. [Interface](#8-interface)
9. [Stratégie de test](#9-stratégie-de-test)
10. [Sécurité et exploitation](#10-sécurité-et-exploitation)
11. [Plan de construction par étapes](#11-plan-de-construction-par-étapes)
12. [Interventions humaines](#12-interventions-humaines)
13. [Checklist de lancement](#13-checklist-de-lancement)
14. [Points d'attention techniques](#14-points-dattention-techniques)
- [Annexe A. Glossaire français → code](#annexe-a-glossaire-français--code)
- [Annexe B. Gabarit de préparation des questions](#annexe-b-gabarit-de-préparation-des-questions)

---

## 0. Mode d'emploi pour les agents

### 0.1 À lire avant toute action

1. `CLAUDE.md` (chargé automatiquement).
2. [avancement.md](avancement.md) : étape en cours, **points ouverts laissés par l'agent précédent**, interventions humaines déjà faites, journal des décisions.
3. Ce document : sections 0 à 10 (référence), puis la section de l'étape en cours dans la section 11.
4. Le cahier des charges, pour toute règle fonctionnelle.
5. Pour l'interface : la section 8 et la maquette B5.

### 0.2 Règles de travail

- **Une étape à la fois, dans l'ordre.** Ne jamais commencer l'étape N+1 tant que tous les critères de passage de l'étape N ne sont pas remplis **et** que l'utilisateur ne l'a pas validée (intervention H-08).
- **En début d'étape**, annoncer à l'utilisateur l'objectif, la durée estimée et les interventions humaines prévues.
- **Tests d'abord pour les règles métier** : écrire les tests à partir des vecteurs de la section 5, puis le code qui les fait passer.
- **Ne pas s'écarter de ce document de sa propre initiative.** En cas d'ambiguïté, de contradiction ou d'impossibilité technique : s'arrêter, exposer le problème à l'utilisateur avec deux options et une recommandation, puis consigner la décision dans le journal d'avancement.
- **Hors périmètre = ne pas le faire** (cahier des charges, section 10). Pas de fonctionnalité « en bonus ».
- **Un test qui échoue ne se désactive pas et ne s'affaiblit pas.** Si tu ne sais pas le corriger, dis-le tel quel à l'utilisateur.
- **En fin d'étape** : lancer toutes les vérifications, mettre à jour `avancement.md`, présenter un compte rendu (fait, tests passés avec leur résumé, reste à faire, points d'attention), puis demander la validation H-08.
- **Le poste de développement est sous Windows.** Les scripts npm doivent être multiplateformes : pas de `rm -rf`, `cp`, `export VAR=…` dans `package.json` ; utiliser des scripts TypeScript lancés avec `tsx`.

### 0.3 Protocole des interventions humaines

Certaines actions ne peuvent être faites que par l'utilisateur (comptes, tableaux de bord, secrets, contenu, validation). Elles sont numérotées H-01 à H-16 et détaillées en section 12. Quand une étape en atteint une :

1. S'arrêter et afficher : `⏸ Intervention humaine H-xx : <titre>`, avec la raison et une durée estimée.
2. Donner les étapes numérotées de la section 12, une par ligne, avec les libellés exacts à cliquer. Si l'interface d'un service a changé par rapport à la description, le dire et adapter.
3. **Ne jamais demander un secret dans le chat.** L'utilisateur colle lui-même les secrets là où on le lui indique (tableau de bord Vercel, fichier local).
4. Attendre sa confirmation, puis vérifier avec la commande prévue (par exemple `npm run check:env`).
5. Consigner l'intervention comme faite dans `avancement.md`.

### 0.4 Git, branches et déploiements

- Une branche par étape : `etape-01-socle`, `etape-02-hebergement`, etc.
- Messages de commit en anglais, à l'impératif (« Add prediction service »), terminés par la ligne d'attribution demandée par la session.
- **Pas de commit ni de push sans l'accord de l'utilisateur** (règle du `CLAUDE.md`). La demande se fait à la fin de chaque étape, dans H-08.
- À partir de l'étape 2 : pousser la branche crée un déploiement de prévisualisation sur Vercel (base `dev`). Après validation, fusionner dans `main` puis pousser : cela déploie en production (base `production`).
- Les migrations s'appliquent automatiquement au build Vercel (§3.4). Dès que la production contient de vraies données (fin de l'étape 5), **toute migration doit être additive**. Une migration destructive (suppression ou renommage de colonne, changement de type) exige l'accord explicite de l'utilisateur.

### 0.5 Secrets

- En local, les variables sont dans `.env.local`, récupéré avec `vercel env pull .env.local` (ignoré par git).
- Le fichier `.env` qui existe déjà à la racine appartient à l'utilisateur : **ne pas le lire, ne pas le modifier, ne pas le supprimer**.
- Ne jamais afficher le contenu de `.env.local`. Les scripts de contrôle n'affichent que les **noms** des variables et « OK » ou « MANQUANTE ».
- `.env.example` est commité, avec les noms des variables et des valeurs factices.

---

## 1. Vue d'ensemble

### 1.1 Principes

1. **Un seul projet Next.js et sa base de données, rien d'autre.** Pas d'email, pas de Power Automate, pas de service tiers en dehors de Vercel et Neon.
2. **Le temps se déduit des dates.** Ouverture, clôture, fin d'une prolongation, validation automatique à la clôture et changement de saison ne sont jamais des événements déclenchés : le code compare l'heure actuelle aux dates enregistrées. Aucune tâche planifiée. (Le chat de l'É8d interroge le serveur depuis le navigateur pendant que sa page est ouverte : ce n'est pas une tâche planifiée, §5.15.)
3. **Les malus ne sont jamais stockés.** Ils sont recalculés à partir des pronos et des résultats à chaque lecture. Seul le palmarès (classement final proclamé) est figé. (Jusqu'à la v1.1, on parlait de « points » ; le barème est un malus depuis la v1.2, §5.5.)
4. **Les règles du jeu sont des fonctions pures**, sans accès à la base, dans `src/lib/game/`, couvertes à au moins 95 %.
5. **L'heure est un paramètre.** Toute fonction qui dépend du temps reçoit `now: Date` en argument, ce qui rend chaque règle testable.
6. **La visibilité des données est décidée au même endroit, côté serveur** (`src/lib/data/`). Les pronos des autres ne quittent jamais le serveur avant la clôture, pas même pour l'admin, ni avant le résultat pour qui n'a pas pronostiqué la question (v1.2, §6.6).
7. **0 €** : offres gratuites de Vercel et Neon.

### 1.2 Stack

| Brique | Choix | Rôle |
|---|---|---|
| Langage | TypeScript, mode `strict` | tout le code |
| Framework | Next.js, App Router, Server Components, Server Actions | pages et formulaires |
| Style | Tailwind CSS v4, jetons dans `@theme` (§8.1) | style B5 |
| Polices | `next/font/google` : Barlow Condensed, Barlow | typographie B5 |
| Icônes | `lucide-react` | icônes au trait |
| Base de données | Neon PostgreSQL (offre gratuite, région Francfort) | stockage |
| Pilote en production | `pg` (node-postgres) avec `drizzle-orm/node-postgres` | connexion à Neon |
| Pilote en tests | `@electric-sql/pglite` avec `drizzle-orm/pglite` | PostgreSQL en mémoire, sans réseau ni Docker |
| Pilote en local sur le réseau de l'école | `@neondatabase/serverless` avec `drizzle-orm/neon-serverless` (`DB_DRIVER=neon-ws`) | connexion à Neon en WebSocket par le port 443, le réseau de l'EM Normandie bloquant le port 5432 (décision du 30/09/2026) |
| Accès aux données | Drizzle ORM, drizzle-kit (migrations) | schéma typé, migrations SQL |
| Authentification | Better Auth (email + mot de passe, plugin admin) | comptes, sessions, rôles |
| Validation | Zod | toutes les entrées de formulaires |
| Dates | `date-fns`, `@date-fns/tz` | fuseau Europe/Paris |
| Tests unitaires et d'intégration | Vitest, `@vitest/coverage-v8` | règles et services |
| Tests de bout en bout | Playwright, `@axe-core/playwright` | parcours et accessibilité |
| Scripts | `tsx` | migrations, seed, contrôles |
| Hébergement | Vercel (offre Hobby), fonctions en région `fra1` | production et prévisualisations |

**Versions** : installer les dernières versions stables au moment de l'étape 1, puis les figer via `package-lock.json`. Plusieurs API évoluent d'une version à l'autre (voir section 14) : pour ces points, lire la documentation de la version installée. **Le comportement attendu est celui décrit ici.**

Node.js : **24 LTS**, la même partout (poste, terminaux des agents, Vercel). Fixée par le fichier `.node-version` (`24`, lu par fnm) et par `"engines": { "node": "24.x" }` dans `package.json` (lu par Vercel).

### 1.3 Schéma d'ensemble

```
Navigateur (joueur ou admin)
   │  HTTPS, cookie de session Better Auth
   ▼
Vercel ── Next.js (région fra1)
   ├─ proxy/middleware ─── redirection optimiste vers /connexion si pas de cookie
   ├─ pages (Server Components) ─→ src/lib/data  ─→ src/lib/game (fonctions pures)
   ├─ Server Actions ────────────→ src/lib/services (contrôles + écriture + trace)
   ├─ /api/auth/[...all] ────────→ Better Auth
   ├─ /api/chat ─────────────────→ nouveaux messages du chat (É8d, lecture seule)
   └─ /api/health ───────────────→ test de connexion à la base
   │
   ▼
Neon PostgreSQL (Francfort) : branche « production » et branche « dev »
```

### 1.4 Environnements

| Environnement | Adresse | Base de données | Données | Comment |
|---|---|---|---|---|
| Développement local | http://localhost:3000 | Neon, branche `dev` | seed | `npm run dev` |
| Tests unitaires et d'intégration | — | PGlite en mémoire | jeux de tests | `npm run test` |
| Tests de bout en bout | http://localhost:3100 | PGlite dans `.pglite-e2e/` | seed | `npm run test:e2e` |
| Prévisualisation | `*.vercel.app` (une par branche) | Neon, branche `dev` | seed, recette | push d'une branche |
| Production | `https://<projet>.vercel.app`, nom choisi en H-03 | Neon, branche `production` | réelles | push sur `main` |

---

## 2. Arborescence du projet

Les dossiers de routes sont en français car ils donnent les adresses vues par les joueurs. Tout le reste du code est en anglais.

```
.
├─ CLAUDE.md
├─ README.md                      présentation et commandes (UTF-8)
├─ .env.example                   noms des variables, valeurs factices
├─ package.json
├─ next.config.ts
├─ vercel.json
├─ drizzle.config.ts
├─ vitest.config.ts
├─ vitest.setup.ts                TZ=UTC
├─ playwright.config.ts
├─ eslint.config.mjs
├─ tsconfig.json                  alias @/* → src/*
├─ drizzle/                       migrations SQL générées (commitées)
├─ scripts/
│  ├─ migrate.ts                  applique les migrations (Neon ou PGlite)
│  ├─ seed.ts                     données de développement (interdit en production)
│  ├─ check-env.ts                contrôle des variables (noms seulement)
│  ├─ check-db.ts                 contrôle de connexion (sans afficher l'URL)
│  ├─ e2e-prepare.ts              remet à zéro .pglite-e2e, migre, seed
│  └─ lib/                        db.ts (ouverture et migration), env-rules.ts, load-env.ts, seed.ts,
│                                  seed-seasons.ts (saisons du seed, lues aussi par les tests de bout en bout)
├─ docs/                          cahier des charges, architecture, maquette, recette (prompt de recette par un agent, É8)
├─ e2e/                           tests Playwright (*.spec.ts)
├─ tests/
│  ├─ unit/                       règles pures (src/lib/game, format)
│  ├─ integration/                services et données sur PGlite
│  └─ helpers/                    createTestDb, fabriques de données, horloge
└─ src/
   ├─ app/
   │  ├─ layout.tsx               <html lang="fr">, polices, fond
   │  ├─ globals.css              Tailwind + jetons B5
   │  ├─ not-found.tsx            404 en français
   │  ├─ error.tsx                erreur en français
   │  ├─ global-error.tsx         la même erreur, si le layout racine échoue (É8)
   │  ├─ robots.ts                tout interdire
   │  ├─ (public)/
   │  │  ├─ layout.tsx            page centrée, sans en-tête de jeu
   │  │  ├─ connexion/page.tsx
   │  │  └─ inscription/page.tsx
   │  ├─ (jeu)/
   │  │  ├─ layout.tsx            exige une session ; en-tête ; suivi de visite
   │  │  ├─ (accueil)/page.tsx    accueil, dans son propre groupe pour que son loading.tsx
   │  │  │                        ne serve qu'à lui (É8)
   │  │  ├─ pronos/page.tsx       grille de saisie des questions ouvertes
   │  │  ├─ questions/page.tsx    liste par onglets
   │  │  ├─ questions/[id]/layout.tsx  404 avant le squelette (É8, §8.3)
   │  │  ├─ questions/[id]/page.tsx
   │  │  ├─ classement/page.tsx
   │  │  │                        loading.tsx dans (accueil), pronos, questions/[id], classement
   │  │  ├─ joueurs/[id]/page.tsx profil public
   │  │  ├─ profil/page.tsx       mon compte
   │  │  ├─ lots/page.tsx
   │  │  ├─ reglement/page.tsx
   │  │  ├─ palmares/page.tsx
   │  │  └─ chat/page.tsx         chat général (É8d, §5.15)
   │  ├─ admin/
   │  │  ├─ layout.tsx            exige le rôle admin ; sous-navigation
   │  │  ├─ page.tsx              tableau de bord et suivi
   │  │  ├─ questions/page.tsx
   │  │  ├─ questions/nouvelle/page.tsx
   │  │  ├─ questions/[id]/page.tsx
   │  │  ├─ joueurs/page.tsx
   │  │  ├─ categories/page.tsx
   │  │  ├─ saisons/page.tsx
   │  │  └─ annonces/page.tsx
   │  └─ api/
   │     ├─ auth/[...all]/route.ts
   │     ├─ chat/route.ts         GET : nouveaux messages et suppressions (É8d, §5.15)
   │     └─ health/route.ts
   ├─ proxy.ts                    (ou middleware.ts selon la version de Next, §14)
   ├─ components/
   │  ├─ ui/                      Button, Chip, Card, Field, Dialog, Tabs, TableScroll, Skeleton…
   │  ├─ game/                    Countdown, StatusChip, QuestionCard, PredictionForm,
   │  │                           HelpPanel, StandingsTable, StripChart,
   │  │                           ChoiceDistribution, ResultPanel, BadgeList…
   │  ├─ layout/                  AppHeader, AdminNav, Footer, VisitTracker
   │  ├─ chat/                    ChatRoom (client, interrogation périodique), ChatMessage,
   │  │                           ChatComposer, EmojiPalette (É8d)
   │  └─ avatars/                 16 maillots SVG + Avatar
   └─ lib/
      ├─ game/                    règles pures (§5), aucune dépendance à Next ou à la base
      │  ├─ constants.ts
      │  ├─ time.ts               fuseau, conversions, saison d'une date (§5.1)
      │  ├─ number-input.ts       lecture des nombres saisis
      │  ├─ question-status.ts    statut d'une question, et pour un joueur prolongé (§5.2)
      │  ├─ prediction-state.ts
      │  ├─ scoring.ts            malus (v1.2, §5.5)
      │  ├─ standings.ts
      │  ├─ crowd.ts              moyenne, médiane, répartition
      │  ├─ chart.ts              échelle et placement des points
      │  ├─ badges.ts
      │  ├─ visits.ts             pastille « Nouveau »
      │  └─ countdown.ts
      ├─ chat/                    emojis.ts (palette), polling.ts (règle pure de l'interrogation
      │                           périodique), result-message.ts (texte du message de résultat) (É8d)
      ├─ format.ts                nombres et dates en français
      ├─ db/
      │  ├─ schema/               auth.ts (généré), app.ts, index.ts
      │  └─ client.ts             getDb() : node-postgres ou PGlite
      ├─ auth/
      │  ├─ auth.ts               createAuth(db) + instance
      │  ├─ auth-client.ts        client navigateur
      │  └─ session.ts            getViewer, requireUser, requireAdmin
      ├─ services/                écritures métier (db, actor, input, now) ; extensions.ts (É8c),
      │                           chat.ts (É8d)
      ├─ data/                    lectures + règles de visibilité (import 'server-only') ; chat.ts (É8d)
      ├─ actions/                 Server Actions ('use server'), fines couches sur services
      └─ validation/              schémas Zod partagés
```

---

## 3. Configuration

### 3.1 Variables d'environnement

| Variable | Fournie par | Environnements | Contenu |
|---|---|---|---|
| `DATABASE_URL` | intégration Neon (H-05) | Production (branche `production`), Preview et Development (branche `dev`) | chaîne de connexion poolée |
| `DATABASE_URL_UNPOOLED` | intégration Neon | idem | chaîne directe, utilisée pour les migrations |
| `BETTER_AUTH_SECRET` | utilisateur (H-06) | tous, **une valeur différente par environnement** | au moins 32 caractères aléatoires |
| `BETTER_AUTH_URL` | utilisateur (H-06) | Production : URL de production ; Development : `http://localhost:3000` ; Preview : non définie | URL de base de l'application |
| `ADMIN_EMAILS` | utilisateur (H-06) | tous | adresses admin séparées par des virgules |
| `DB_DRIVER` | scripts de test ; `.env.development.local` du poste | tests et e2e (`pglite`) ; développement local sur un réseau qui bloque le port 5432 (`neon-ws`) | **jamais défini sur Vercel** |
| `PGLITE_DIR` | scripts de test | e2e | dossier de données PGlite |
| `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_ENV` | Vercel (automatique) | Preview, Production | origines de confiance pour l'authentification, garde du seed |

`scripts/check-env.ts` vérifie la présence et le format de chaque variable requise (URL PostgreSQL, secret d'au moins 32 caractères, adresses valides) et n'affiche que les noms. Les scripts chargent `.env.local` avec `loadEnvConfig` de `@next/env`.

### 3.2 Scripts npm

| Script | Commande | Usage |
|---|---|---|
| `dev` | `next dev` | développement |
| `build` | `next build` | build local, sans migration |
| `build:vercel` | `tsx scripts/migrate.ts && next build` | build Vercel (§3.4) |
| `start` | `next start` | |
| `lint` | `eslint .` | |
| `typecheck` | `tsc --noEmit` | |
| `test` | `vitest run` | unitaires et intégration |
| `test:watch` | `vitest` | |
| `test:coverage` | `vitest run --coverage` | seuils du §9.5 |
| `test:e2e` | `playwright test` | bout en bout |
| `e2e:serve` | `tsx scripts/e2e-prepare.ts && next build && next start -p 3100` | lancé par Playwright |
| `db:generate` | `drizzle-kit generate` | nouvelle migration après changement de schéma |
| `db:migrate` | `tsx scripts/migrate.ts` | applique les migrations sur la base de `.env.local` |
| `db:seed` | `tsx scripts/seed.ts` | **efface** puis remplit la base de développement ; refuse de tourner sur la production (§9.6) |
| `db:check` | `tsx scripts/check-db.ts` | test de connexion |
| `check:env` | `tsx scripts/check-env.ts` | contrôle des variables |
| `verify` | `npm run lint && npm run typecheck && npm run test && npm run build` | **porte de sortie de chaque étape** |

### 3.3 Fichiers de configuration

**`next.config.ts`**
- `serverExternalPackages: ['@electric-sql/pglite']` : PGlite est chargé depuis `node_modules` et non empaqueté.
- `poweredByHeader: false`.
- En-têtes sur toutes les routes : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Robots-Tag: noindex, nofollow`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Ne pas activer les fonctions de cache expérimentales (Cache Components, PPR) : toutes les pages sont dynamiques car elles lisent la session.

**`vercel.json`**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build:vercel",
  "regions": ["fra1"]
}
```

**`drizzle.config.ts`** : `dialect: 'postgresql'`, `schema: './src/lib/db/schema'`, `out: './drizzle'`, URL = `DATABASE_URL_UNPOOLED` sinon `DATABASE_URL`.

**`vitest.config.ts`** : environnement `node`, alias `@` → `src`, `setupFiles: ['vitest.setup.ts']` (qui fixe `process.env.TZ = 'UTC'` comme sur Vercel), couverture v8 avec les seuils du §9.5.

**`playwright.config.ts`** : `testDir: 'e2e'`, `workers: 1`, `fullyParallel: false`, `use.baseURL: 'http://localhost:3100'`, `webServer` avec `command: 'npm run e2e:serve'`, `url: 'http://localhost:3100/api/health'`, `timeout: 180000`, `reuseExistingServer: false` et l'environnement suivant : `DB_DRIVER=pglite`, `PGLITE_DIR=.pglite-e2e`, `BETTER_AUTH_SECRET=<valeur de test fixe de 32 caractères>`, `BETTER_AUTH_URL=http://localhost:3100`, `ADMIN_EMAILS=admin@example.test`, `TZ=UTC`.

**`.gitignore`** : ajouter `.pglite-*`, `playwright-report/`, `test-results/`, `coverage/`, `.vercel/`, en plus de ce que génère Next.js. Conserver les entrées existantes (`.env`, `.env.local`, `.env.*.local`).

### 3.4 Migrations au build

Sur Vercel, `build:vercel` applique les migrations en attente **avant** `next build`, avec la base de l'environnement concerné (`dev` pour les prévisualisations, `production` pour `main`). Drizzle garde la trace des migrations appliquées : relancer est sans effet. `scripts/migrate.ts` :
- si `DB_DRIVER=pglite` : migre le dossier `PGLITE_DIR` ;
- sinon : se connecte avec `DATABASE_URL_UNPOOLED` (ou `DATABASE_URL`), migre, ferme la connexion ;
- si `VERCEL_ENV === 'production'`, écrit ensuite le marqueur `app_meta.environment = 'production'` (§4.3), qui interdit définitivement le seed sur cette base ;
- affiche le nombre de migrations appliquées, jamais l'URL ;
- sort avec un code d'erreur en cas d'échec, ce qui fait échouer le déploiement.

---

## 4. Modèle de données

### 4.1 Conventions

- Tables et colonnes en `snake_case`, champs TypeScript en `camelCase` (mapping Drizzle).
- Tables de l'application : identifiant `integer` généré (`generatedAlwaysAsIdentity`), ce qui donne des adresses lisibles (`/questions/12`).
- Tables Better Auth : identifiant `text` (généré par Better Auth).
- Dates : `timestamp with time zone`, toujours en UTC.
- Nombres saisis (pronos, résultats, malus d'une mauvaise réponse) : `numeric(14, 2)` lu en `number` (mode `number` de Drizzle).
- Malus : jamais stockés, sauf dans le palmarès (`numeric(16, 2)`, v1.2). Jusqu'à la v1.1, les points du palmarès étaient un `integer`.

### 4.2 Tables Better Auth

Générées par la CLI de Better Auth (paquet `auth` depuis Better Auth 1.7 : `DB_DRIVER=pglite npx auth@<version> generate --config src/lib/auth/auth-cli.ts`, commande exacte en tête du fichier) dans `src/lib/db/schema/auth.ts`, à partir de la configuration du §6.1. Toutes les colonnes de date y sont ensuite passées en `timestamp with time zone` (§4.1), ce que vérifie `tests/integration/schema.test.ts` :

- **`user`** : `id`, `name` (nom affiché), `email` (unique), `email_verified`, `image`, `created_at`, `updated_at`.
  - Ajouts du plugin admin : `role` (`player` ou `admin`), `banned`, `ban_reason`, `ban_expires`.
  - Champs additionnels déclarés dans la configuration :
    - `avatar` (text, non nul, défaut calculé à l'inscription, §8.2) ;
    - `last_seen_at` (timestamptz, nullable) ;
    - `previous_visit_at` (timestamptz, nullable).
- **`session`** (avec `impersonated_by` du plugin admin, inutilisé), **`account`** (contient le hachage du mot de passe), **`verification`**, **`rate_limit`** (stockage des limites de tentatives en base).

### 4.3 Tables de l'application (`src/lib/db/schema/app.ts`)

**`app_meta`** : informations techniques clé-valeur.

| Colonne | Type | Contraintes |
|---|---|---|
| `key` | text | clé primaire |
| `value` | text | |

Seule clé utilisée : `environment`, qui vaut `production` sur la base de production (posée par `scripts/migrate.ts`, §3.4).

**`allowed_email`** : liste blanche.

| Colonne | Type | Contraintes |
|---|---|---|
| `email` | text | clé primaire, toujours en minuscules |
| `created_at` | timestamptz | défaut `now()` |
| `created_by` | text | → `user.id`, nullable |

**`season`** : une ligne par saison, **créée par l'admin** (v1.1, §5.13).

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `label` | text | nom affiché, 2 à 40 caractères (ex. `2026-2027`) ; unique sans tenir compte de la casse (index sur `lower(label)`) |
| `starts_at` | timestamptz | début, un jour à 00:00 heure de Paris ; unique |
| `jokers_enabled` | boolean | non nul, défaut `true` ; jokers autorisés pendant la saison (v1.2, §5.13) |
| `proclaimed_at` | timestamptz | nullable |
| `created_at` | timestamptz | défaut `now()` |

Une saison n'a pas de date de fin enregistrée : elle se termine au début de la saison suivante (§5.1). La colonne `ends_at` de la v1.0 est supprimée par la migration de l'É5b, avec la contrainte de format du libellé ; la colonne `label` garde son nom (un renommage serait une migration destructive, §0.4).

**`category`**

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `name` | text | unique (insensible à la casse, contrôlé par le service) |
| `archived_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

**`question`**

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `season_id` | integer | → `season.id`, nullable tant que la question n'est pas publiée (pas de clôture, ou clôture avant la première saison) |
| `category_id` | integer | → `category.id`, non nul |
| `type` | enum `question_type` (`number`, `choice`) | non nul |
| `price_is_right` | boolean | défaut `false`. **Juste Prix supprimé en v1.2** : la colonne reste (la supprimer serait une migration destructive, §0.4), toujours `false` (`CHECK (NOT price_is_right)`), et le code ne la lit plus |
| `wrong_answer_malus` | numeric(14,2) | malus d'une mauvaise réponse (v1.2, §5.5) ; renseigné si et seulement si `type = choice`, > 0 |
| `title` | text | énoncé, 5 à 200 caractères |
| `description` | text | nullable, précisions, 2 000 caractères au plus |
| `unit` | text | nullable ; pour `number` (ex. « candidatures ») |
| `source` | text | non nul ; d'où vient la valeur réelle |
| `help_bi_url` | text | nullable ; URL http(s) |
| `help_last_year` | text | nullable ; valeur de l'an dernier, texte libre |
| `help_hint` | text | nullable ; indice |
| `opens_at` | timestamptz | nullable en brouillon |
| `closes_at` | timestamptz | nullable en brouillon |
| `expected_result_at` | timestamptz | nullable |
| `coefficient` | smallint | défaut 1 ; `CHECK (coefficient IN (1, 2, 3))` |
| `status` | enum `question_status` (`draft`, `published`, `cancelled`) | défaut `draft` |
| `result_number` | numeric(14,2) | nullable |
| `result_option_id` | integer | → `question_option.id`, nullable |
| `resolved_at` | timestamptz | nullable ; première saisie du résultat |
| `corrected_at` | timestamptz | nullable ; dernière correction |
| `cancelled_at` | timestamptz | nullable |
| `duplicated_from_id` | integer | → `question.id`, nullable |
| `created_by` | text | → `user.id` |
| `created_at`, `updated_at` | timestamptz | |

Contraintes : `CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at)` ; `CHECK (status <> 'published' OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND season_id IS NOT NULL))`. La contrainte `question_season_of_closing` ajoutée à l'É3 (saison obligatoire dès qu'il y a une clôture) est supprimée à l'É5b : un brouillon peut clôturer à une date qu'aucune saison ne couvre encore.

Ajouts de l'É8c (v1.2), par une migration qui n'ajoute que des colonnes, des tables et des contraintes :
- `question_wrong_answer_malus` : `CHECK ((type = 'choice') = (wrong_answer_malus IS NOT NULL))` et `CHECK (wrong_answer_malus > 0)`. Avant d'ajouter la contrainte, la migration renseigne `50` sur les questions à choix existantes : il y en a sur `dev` (seed), aucune en production (vérifié le 02/10/2026, à revérifier au début de l'É8c).
- `question_price_is_right_removed` : `CHECK (NOT price_is_right)`, qui remplace `question_price_is_right_number`. La migration remet d'abord `price_is_right` à `false` (une question du seed sur `dev` ; aucune en production au 02/10/2026).

**`question_option`** : réponses possibles d'une question à choix.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `question_id` | integer | → `question.id`, `ON DELETE CASCADE` |
| `label` | text | 1 à 80 caractères |
| `position` | smallint | `UNIQUE (question_id, position)` |

**`prediction`**

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `question_id` | integer | → `question.id` |
| `user_id` | text | → `user.id` |
| `value_number` | numeric(14,2) | nullable |
| `option_id` | integer | → `question_option.id`, nullable |
| `joker` | boolean | défaut `false` |
| `validated_at` | timestamptz | nullable ; nul = enregistré |
| `created_at`, `updated_at` | timestamptz | |

Contraintes : `UNIQUE (question_id, user_id)` ; `CHECK ((value_number IS NULL) <> (option_id IS NULL))`.

**`prediction_event`** : historique horodaté, jamais modifié ni supprimé.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `prediction_id` | integer | → `prediction.id` |
| `question_id` | integer | → `question.id` |
| `owner_id` | text | → `user.id` ; le joueur |
| `actor_id` | text | → `user.id` ; qui a agi (le joueur ou l'admin) |
| `type` | enum (`saved`, `validated`, `unlocked`, `joker_on`, `joker_off`) | |
| `value_number` | numeric(14,2) | nullable ; valeur au moment de l'événement |
| `option_id` | integer | nullable |
| `joker` | boolean | état du joker après l'événement |
| `created_at` | timestamptz | |

**`question_extension`** : prolongation d'une question pour un joueur (É8c, v1.2, §5.14).

| Colonne | Type | Contraintes |
|---|---|---|
| `question_id` | integer | → `question.id` |
| `user_id` | text | → `user.id` ; le joueur prolongé |
| `closes_at` | timestamptz | non nul ; sa date limite personnelle |
| `granted_by` | text | → `user.id` ; l'admin qui l'a accordée |
| `granted_at` | timestamptz | non nul |
| `updated_by` | text | → `user.id`, nullable ; dernier admin à avoir changé la date ou terminé la prolongation |
| `updated_at` | timestamptz | nullable |

Clé primaire `(question_id, user_id)` : une prolongation au plus par joueur et par question ; la changer met à jour la ligne. `CHECK (user_id <> granted_by)` (on ne se prolonge pas soi-même). Index `(user_id)`.

**`prize`** : lots.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `season_id` | integer | → `season.id` |
| `rank_label` | text | ex. « 1er », « 2e », « 3e » |
| `description` | text | |
| `position` | smallint | ordre d'affichage |

**`announcement`**

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK |
| `body` | text | 1 à 500 caractères |
| `created_by` | text | → `user.id` |
| `created_at`, `updated_at` | timestamptz | |

**`chat_message`** : messages du chat général (É8d, v1.2, §5.15). Enum `chat_message_kind` (`message`, `result`).

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | integer identity | PK ; l'ordre des messages est celui des identifiants |
| `kind` | enum `chat_message_kind` | non nul ; `message` (écrit par un joueur) ou `result` (message automatique au résultat) |
| `user_id` | text | → `user.id` ; l'auteur, non nul pour `message`, nul pour `result` |
| `question_id` | integer | → `question.id` ; non nul pour `result`, nul pour `message` |
| `body` | text | texte d'un `message`, 1 à 500 caractères ; nul pour `result` (texte calculé à la lecture) et pour un message supprimé (le contenu est effacé) |
| `created_at` | timestamptz | non nul |
| `deleted_at` | timestamptz | nullable |
| `deleted_by` | text | → `user.id`, nullable |

Contraintes : `CHECK ((kind = 'message') = (user_id IS NOT NULL))`, `CHECK ((kind = 'result') = (question_id IS NOT NULL))`, `CHECK (kind = 'message' OR body IS NULL)`, `CHECK (kind <> 'message' OR deleted_at IS NOT NULL OR char_length(body) BETWEEN 1 AND 500)`, `CHECK (deleted_at IS NULL OR body IS NULL)` ; index unique partiel `(question_id) WHERE kind = 'result'` (un seul message de résultat par question) ; index `(user_id, created_at)` (limite de 10 messages par minute).

**`chat_read`** : dernier message lu par chaque compte (pastille de l'onglet Chat, É8d).

| Colonne | Type | Contraintes |
|---|---|---|
| `user_id` | text | PK, → `user.id` |
| `last_read_id` | integer | non nul ; identifiant du dernier message lu (pas de clé étrangère, pour ne pas bloquer une suppression) |
| `updated_at` | timestamptz | non nul |

**`season_standing`** : classement final figé, c'est-à-dire le palmarès.

| Colonne | Type | Contraintes |
|---|---|---|
| `season_id` | integer | → `season.id` |
| `user_id` | text | → `user.id` |
| `rank` | integer | classement avec ex æquo (1, 1, 3…) |
| `points` | integer | **nullable depuis la v1.2** ; points des saisons proclamées avec le barème de la v1.1 (aucune en production au 02/10/2026). Plus jamais écrit |
| `malus` | numeric(16,2) | nullable ; malus total de la saison (v1.2), écrit par toute nouvelle proclamation. `CHECK (malus IS NOT NULL OR points IS NOT NULL)`. Ajouter une colonne plutôt que renommer `points` évite une migration destructive (§0.4), le malus ayant des décimales |
| `bullseyes` | integer | nombre de « Dans le mille » |
| `mean_error` | numeric(18,6) | nullable ; (18,6) et non (10,6) : un écart supérieur à 9 999 (faute de frappe) ferait échouer la proclamation (décision du 30/09/2026) |
| `questions_played` | integer | |
| `name_snapshot` | text | nom affiché au moment de la proclamation ; remplacé par le nom anonymisé si le compte est anonymisé ensuite (§6.3, décision du 30/09/2026) |

Clé primaire `(season_id, user_id)`.

### 4.4 Index

- `prediction (user_id)` et `prediction (question_id)` (en plus de l'unicité).
- `question (season_id, status)` et `question (closes_at)`.
- `prediction_event (question_id, created_at)`.
- `question_extension (user_id)` (É8c) ; `chat_message (user_id, created_at)` (É8d).

### 4.5 Règles d'intégrité tenues par les services

- `question.season_id` est recalculé à chaque changement de `closes_at`, et à chaque création, changement de date de début ou suppression d'une saison (§5.1, §5.13). Une question qui a des pronos ne change jamais de saison : ses jokers restent comptés dans la bonne saison.
- `result_option_id` et `option_id` appartiennent toujours à la question concernée.
- `unit` n'a de sens que pour `type = number`, `wrong_answer_malus` que pour `type = choice`. `question_option` n'existe que pour `type = choice` (au moins 2 options).
- Une prolongation ne concerne qu'un joueur sans prono au moment où elle est accordée, sur une question publiée, non annulée et sans résultat (§5.14). Aucun résultat n'est saisi tant qu'une prolongation court.
- On ne supprime jamais un utilisateur ayant des pronos : on l'anonymise (§6.3). Ses messages du chat sont alors effacés (§5.15).

---

## 5. Règles métier (spécifications exactes)

Chaque sous-section se traduit par un module de `src/lib/game/` et un fichier de tests `tests/unit/game/<module>.test.ts` qui reprend **au minimum** les vecteurs listés.

### 5.1 Temps, fuseau et saisons (`time.ts`)

- Toutes les dates sont stockées en UTC. Tout affichage et toute saisie se font en heure de Paris (`TIME_ZONE = 'Europe/Paris'`), quel que soit le fuseau du serveur.
- `parisLocalToUtc(value: string): Date` convertit la valeur d'un `<input type="datetime-local">` (`AAAA-MM-JJTHH:mm`), lue comme une heure de Paris.
- `utcToParisLocalInput(date: Date): string` fait l'inverse, pour préremplir les champs.
- **Saisons gérées par l'admin (v1.1)** : une saison a un nom et une date de début (un jour, à 00:00 heure de Paris). Les saisons se suivent sans trou ni chevauchement : chacune se termine au début de la suivante (exclu). La dernière n'a pas de fin tant que la suivante n'est pas créée : si l'admin oublie de créer la nouvelle saison, l'ancienne continue, et rien ne se bloque.
- La saison d'une date est celle dont le début est le plus récent parmi ceux qui ne la dépassent pas. Avant le début de la première saison, une date n'a pas de saison.
- **La saison d'une question est celle de sa date de clôture.** Une question sans saison (pas de clôture, ou clôture avant la première saison) peut rester en brouillon, mais ne peut pas être publiée.
- **Bascule** : la saison courante est la saison de `now`. Elle change toute seule à la date de début de la saison suivante, que l'admin crée à l'avance, par exemple le jour de la rentrée (§5.13). Aucune tâche planifiée (§1.1).
- Fonctions pures de `time.ts`, qui reçoivent la liste des saisons (lue en base par l'appelant) :
  - `seasonStartFromLocalDate(value: string): Date` : la valeur d'un `<input type="date">` (`AAAA-MM-JJ`), lue comme 00:00 à Paris ;
  - `seasonAt<S extends { startsAt: Date }>(seasons: S[], date: Date): S | null` ;
  - `seasonEnd(seasons, season): Date | null` : le début de la saison suivante, ou `null` ;
  - `previousSeason(seasons, season)` : la saison qui la précède, ou `null`.
- `seasonLabelFor` et `seasonBounds` (v1.0, saisons fixes du 1er octobre) sont supprimées à l'É5b. `suggestedSeasonLabel(startsAt)` propose seulement un nom par défaut (`AAAA-AAAA` d'après l'année de début) dans le formulaire de création.

| Vecteur | Entrée | Attendu |
|---|---|---|
| T1 | `parisLocalToUtc('2026-10-21T18:00')` | `2026-10-21T16:00:00.000Z` (heure d'été, UTC+2) |
| T2 | `parisLocalToUtc('2026-11-15T18:00')` | `2026-11-15T17:00:00.000Z` (heure d'hiver, UTC+1) |
| T3 | `utcToParisLocalInput(2026-10-21T16:00:00Z)` | `'2026-10-21T18:00'` |
| T4 | saisons A (début `seasonStartFromLocalDate('2025-09-29')`) et B (`'2026-10-01'`) ; `seasonAt(…, 2026-09-30T21:59:59Z)` | A (23:59:59 à Paris le 30/09) |
| T5 | mêmes saisons ; `seasonAt(…, 2026-09-30T22:00:00Z)` | B (00:00 à Paris le 01/10) |
| T6 | mêmes saisons ; `seasonAt(…, 2025-09-28T12:00:00Z)` | `null` (avant la première saison) |
| T7 | mêmes saisons ; `seasonAt(…, 2031-01-01T00:00:00Z)` et `seasonEnd(…, B)` | B, et `null` (la dernière saison n'a pas de fin) |
| T8 | les tests tournent avec `TZ=UTC` | aucun résultat ne dépend du fuseau de la machine |
| T9 | `seasonStartFromLocalDate('2027-03-29')` (lendemain du passage à l'heure d'été) | `2027-03-28T22:00:00.000Z` |

### 5.2 Statut d'une question (`question-status.ts`)

`questionStatus(q, now)` renvoie `'draft' | 'scheduled' | 'open' | 'closed' | 'resolved' | 'cancelled'`, dans cet ordre de priorité :

1. `status = 'cancelled'` → `cancelled`
2. `status = 'draft'` → `draft`
3. `resolved_at` renseigné → `resolved`
4. `now < opens_at` → `scheduled` (programmée, invisible des joueurs)
5. `now < closes_at` → `open`
6. sinon → `closed` (en attente du résultat)

L'ouverture est **incluse** (`now = opens_at` → ouverte), la clôture **exclue** (`now = closes_at` → clôturée).

| Vecteur | Données | Attendu |
|---|---|---|
| S1 | publiée, `now` = `opens_at` − 1 ms | `scheduled` |
| S2 | publiée, `now` = `opens_at` | `open` |
| S3 | publiée, `now` = `closes_at` − 1 ms | `open` |
| S4 | publiée, `now` = `closes_at` | `closed` |
| S5 | publiée, `resolved_at` renseigné | `resolved` |
| S6 | annulée avec `resolved_at` renseigné | `cancelled` |
| S7 | brouillon avec dates passées | `draft` |

**Statut pour un joueur** (É8c, v1.2, prolongations §5.14) : `questionStatusFor(q, extension: { closesAt: Date } | null, now)`. Si `questionStatus(q, now)` vaut `open` ou `closed`, et qu'une prolongation du joueur court encore (`now < extension.closesAt`, fin exclue comme pour la clôture), la question est `open` pour lui. Sinon, le statut est celui de la question. Partout où le statut d'une question compte pour un joueur (ses pronos, ses questions ouvertes, ce qu'il voit), on utilise ce statut-là : celui du propriétaire du prono pour les services, celui de la personne qui regarde pour les lectures.

| Vecteur | Données | Attendu |
|---|---|---|
| E1 | question clôturée, prolongation jusqu'à `now` + 1 h | `open` |
| E2 | question clôturée, `now` = fin de la prolongation | `closed` |
| E3 | question résolue, prolongation échue | `resolved` |
| E4 | question annulée, prolongation en cours | `cancelled` |
| E5 | question clôturée, sans prolongation | `closed` |
| E6 | question programmée, prolongation en cours (impossible par les services, mais la fonction reste sûre) | `scheduled` |

### 5.3 Lecture des nombres saisis (`number-input.ts`)

`parseNumberInput(raw: string): { ok: true; value: number } | { ok: false; message: string }`

1. Retirer les espaces en début et fin, puis supprimer les espaces internes (espace normale, insécable ` `, fine insécable ` `).
2. Refuser une chaîne vide : « Saisis un nombre. »
3. Si la chaîne contient une virgule, celle-ci est le séparateur décimal. Si elle contient aussi un point : « Format non reconnu. »
4. Sans virgule, un point est accepté comme séparateur décimal seulement s'il est suivi de 1 ou 2 chiffres. S'il est suivi de 3 chiffres (ex. `2.450`) : « Écris 2450 ou 2 450 (pas de point pour les milliers). »
5. Seuls les chiffres et un séparateur décimal sont admis (pas de signe, pas de notation `1e5`) : « Saisis un nombre positif, sans lettres. »
6. Au plus 2 décimales : « 2 décimales au maximum. »
7. Valeur maximale 999 999 999,99 : « Nombre trop grand. »
8. Les nombres négatifs sont refusés (règle 5).

| Vecteur | Entrée | Attendu |
|---|---|---|
| N1 | `'2 450'` | 2450 |
| N2 | `'2 450'` | 2450 |
| N3 | `'2450,5'` | 2450.5 |
| N4 | `'12.5'` | 12.5 |
| N5 | `'2.450'` | erreur (point des milliers) |
| N6 | `'12,345'` | erreur (3 décimales) |
| N7 | `'-3'` | erreur |
| N8 | `'1e5'` | erreur |
| N9 | `''` | erreur |
| N10 | `' 0 '` | 0 |
| N11 | `'1.234,5'` | erreur (point et virgule) |

`formatNumber(n)` (dans `format.ts`) utilise `Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })`.

### 5.4 Pronos

**État affiché** (`prediction-state.ts`) : `predictionState(prediction | null, questionStatus)` renvoie `'todo'` (aucun prono), `'saved'` (prono, pas validé, question ouverte) ou `'validated'` (validé, **ou** question clôturée, résolue ou annulée avec un prono). Un prono enregistré compte donc comme validé dès la clôture, sans aucune écriture en base. Le statut passé est celui du propriétaire du prono (`questionStatusFor`, §5.2) : un prono enregistré pendant une prolongation compte comme validé à la fin de celle-ci.

**Question ouverte pour le joueur** (É8c, v1.2) : dans les quatre services ci-dessous, « question `open` » veut dire `questionStatusFor(question, prolongation du propriétaire du prono, now) = 'open'`. Un joueur prolongé enregistre, valide et pose un joker sur une question clôturée pour les autres ; un autre joueur reçoit toujours `QUESTION_NOT_OPEN`.

**Enregistrer** `savePrediction(db, actor, { questionId, rawValue? | optionId? }, now)`
- Conditions : acteur connecté et non désactivé ; question `open` pour lui à `now` ; prono pas encore validé ; valeur valide (§5.3) ou option appartenant à la question.
- Effet : crée ou met à jour le prono ; événement `saved` avec la valeur.

**Valider** `validatePrediction(db, actor, { questionId, rawValue? | optionId? }, now)`
- Si une valeur est fournie, elle est d'abord enregistrée, dans la même transaction. Le bouton « Valider » de l'interface envoie toujours la valeur affichée.
- Conditions : question `open` ; prono existant (ou valeur fournie) ; pas encore validé.
- Effet : `validated_at = now` ; événements `saved` (si valeur) puis `validated`.

**Joker** `setJoker(db, actor, { questionId, enabled }, now)`
- Conditions : question `open` pour le joueur ; la saison de la question autorise les jokers (`season.jokers_enabled`, v1.2 ; sinon `JOKERS_DISABLED`, pour poser comme pour retirer) ; prono existant et non validé (sinon « Enregistre d'abord ton prono. ») ; pour activer, moins de `JOKERS_PER_SEASON` (2) jokers déjà posés par le joueur sur les questions **non annulées de la même saison** (celle de la question).
- Le comptage et l'écriture se font dans une transaction qui verrouille la ligne `user` du joueur (`SELECT … FOR NO KEY UPDATE`), pour qu'un double clic ne dépasse pas la limite.
- Effet du joker sur le malus : divisé par `JOKER_DIVISOR` (2) (§5.5).

**Verrous** (décision du 30/09/2026, complétée en v1.2) : les quatre services prennent leurs verrous dans le même ordre, en une transaction :
1. `setJoker` seulement : les saisons (`FOR SHARE`, comme `seasonsForQuestions` des services de questions, §5.13), pour lire `jokers_enabled` sans croiser un `updateSeason` qui retirerait les jokers ;
2. la question (`FOR SHARE` : ni l'admin ni une saison ne la modifie pendant qu'un prono arrive) ;
3. la prolongation du propriétaire du prono sur cette question, si elle existe (`FOR SHARE`, É8c) ;
4. la ligne `user` du propriétaire du prono (`FOR NO KEY UPDATE` : les écritures d'un même joueur passent l'une après l'autre) ;
5. le prono (`FOR UPDATE`).

`NO KEY UPDATE` plutôt que `UPDATE` : ce verrou ne bloque pas les contrôles de clé étrangère des événements écrits au même moment pour ce joueur, ce qui évite un interblocage avec un déverrouillage. Une question inconnue ou qui n'est pas ouverte pour le joueur renvoie `QUESTION_NOT_OPEN`, sans révéler si elle existe.
- Un joker posé sur une question ensuite annulée n'est plus compté : il est rendu automatiquement.
- Événement `joker_on` ou `joker_off`.

**Déverrouiller** `unlockPrediction(db, admin, { predictionId }, now)`
- Conditions : acteur admin ; question `open` pour le propriétaire du prono (y compris pendant sa prolongation) ; prono validé.
- Effet : `validated_at = null` ; événement `unlocked` avec l'admin comme `actor_id`.

**Messages d'erreur** (codes pour les tests, textes pour l'interface) :

| Code | Message |
|---|---|
| `NOT_AUTHENTICATED` | « Ta session a expiré, reconnecte-toi. » |
| `FORBIDDEN` | « Tu n'as pas accès à cette action. » |
| `ACCOUNT_DISABLED` | « Ton compte est désactivé. Contacte l'admin. » |
| `QUESTION_NOT_OPEN` | « Cette question n'est pas ouverte aux pronos. » |
| `ALREADY_VALIDATED` | « Ton prono est validé : il ne peut plus être modifié. » |
| `INVALID_VALUE` | message de `parseNumberInput` |
| `INVALID_OPTION` | « Réponse inconnue. » |
| `NO_PREDICTION` | « Enregistre d'abord ton prono. » |
| `NO_JOKER_LEFT` | « Tu as déjà utilisé tes 2 jokers cette saison. » |
| `JOKERS_DISABLED` | « Pas de joker cette saison. » (v1.2) |
| `NOT_VALIDATED` | « Ce prono n'est pas validé. » |

### 5.5 Malus (`scoring.ts`, `constants.ts`)

> **v1.2 (É8c)** : remplace le barème de la v1.0, qui disparaît (paliers `SCORE_TIERS`, bonus podium, 50 points pour une bonne réponse, joker ×2, variante Juste Prix). Décision de l'utilisateur du 02/10/2026, cahier des charges §5. Le classement va désormais du plus petit malus au plus grand. L'écart brut est voulu par l'utilisateur, en connaissance de cause : une question sur un grand nombre pèse bien plus qu'une question sur un petit nombre. Ne pas le « corriger » en écart relatif ni ajouter de plafond (l'agent l'avait proposé, l'utilisateur l'a refusé).

**Constantes**

```ts
export const JOKER_DIVISOR = 2;        // un joker divise le malus par 2
export const JOKERS_PER_SEASON = 2;    // si la saison autorise les jokers (§5.13)
export const COEFFICIENTS = [1, 2, 3] as const;
export const BULLSEYE_PERCENT = 1;     // « Dans le mille » : écart relatif ≤ 1 %
export const PODIUM_SIZE = 3;          // les 3 pronos les plus proches (badges, message de résultat), sans bonus
```

`SCORE_TIERS`, `PODIUM_BONUS`, `CHOICE_POINTS`, `JOKER_MULTIPLIER` et `BULLSEYE_POINTS` disparaissent. La page règlement affiche ces constantes et des exemples calculés par `scoreQuestion` : règlement et calcul ne peuvent pas diverger.

**Calcul exact, sans virgule flottante.** Pronos, valeurs réelles et malus d'une mauvaise réponse ont au plus 2 décimales. On calcule en **centièmes entiers** :
- `P = round(prono × 100)` ;
- `R = round(réel × 100)` ;
- `W = round(malus d'une mauvaise réponse × 100)`.

Les malus restent en centièmes entiers jusqu'à l'affichage, sommes du classement comprises. Seule l'interface les convertit, avec `formatNumber` (2 décimales au plus).

**Question à nombre**
1. Malus de base = `D = |P − R|` : l'écart brut, sans plafond.
2. « Dans le mille » : `D × 100 ≤ BULLSEYE_PERCENT × |R|` (1 % ou moins). Si `R = 0`, seul le prono 0 est dans le mille. Il ne change pas le malus.
3. Écart relatif (départage et statistiques) : `D / |R|` en nombre flottant ; 0 si `R = 0` et `P = 0` ; infini si `R = 0` et `P ≠ 0` (il ne compte alors pas dans l'écart moyen).
4. Rang de proximité (`podiumRank`, pour les badges et le message de résultat) : 1 + le nombre de pronos de la question dont le `D` est strictement plus petit (ex æquo : 1, 1, 3…). Il ne donne plus aucun bonus.

**Question à choix** : malus de base = 0 pour la bonne réponse, `W` sinon. Pas de rang de proximité, pas d'écart.

**Malus d'une question** = malus de base × coefficient, divisé par `JOKER_DIVISOR` s'il y a un joker. La division arrondit au centième, la moitié vers le haut : en centièmes, `x` devient `floor((x + 1) / 2)`.

**Malus d'absence** (`absentMalus`) : le malus d'un joueur du classement (§5.6) qui n'a pas de prono sur une question résolue (décision du 02/10/2026 : « le malus du pire prono »).
- Question à nombre : le plus grand `D` parmi les pronos de la question, × coefficient. C'est le pire écart, sans tenir compte des jokers des autres.
- Question à choix : `W` × coefficient. Pas de réponse = mauvaise réponse, même si tous les autres ont trouvé (précision de l'agent, contestable).
- Question sans aucun prono : 0, tout le monde étant à égalité.

`scoreQuestion(question, predictions)` reçoit `{ type, coefficient, resultNumber, resultOptionId, wrongAnswerMalus }` et renvoie `{ scores, absentMalus }`. Chaque élément de `scores` contient `baseMalus`, `total` (en centièmes), `bullseye`, `relativeError | null` et `podiumRank | null`. Les champs `basePoints`, `podiumBonus` et `wentOver` disparaissent, comme `priceIsRight`.

**Vecteurs, question à nombre, valeur réelle 1 000, coefficient 1, sans joker**

| # | Prono | Malus | « Dans le mille » |
|---|---|---|---|
| M1 | 1 000 | 0 | oui |
| M2 | 500 | 500 | non |
| M3 | 1 500 | 500 | non |
| M4 | 1 010 | 10 | oui (1 %) |
| M5 | 989,99 | 10,01 | non (1,001 %) |
| M6 | 0 | 1 000 | non |
| M7 | 25 000 | 24 000 (pas de plafond) | non |

**Vecteurs, coefficient et joker**

| # | Cas | Malus |
|---|---|---|
| K1 | réel 1 000, prono 1 501, joker | 501 ÷ 2 = 250,5 |
| K2 | réel 1 000, prono 800, coefficient 3 ; puis avec joker | 600 ; 300 |
| K3 | réel 12,5, prono 12,6 ; puis avec joker | 0,1 ; 0,05 |
| K4 | réel 10, prono 10,01, joker | 0,01 ÷ 2 = 0,005, arrondi à 0,01 |
| K5 | réel 0 : pronos 0 et 5 | 0 (« Dans le mille ») et 5 ; écart relatif infini pour 5 |

**Vecteurs, question à choix (malus d'une mauvaise réponse : 200)**

| # | Cas | Malus |
|---|---|---|
| Q1 | bonne réponse, joker | 0 |
| Q2 | mauvaise réponse | 200 |
| Q3 | mauvaise réponse, coefficient 2, joker | 200 × 2 ÷ 2 = 200 |

**Vecteurs, rang de proximité (valeur réelle 250 ; aucun bonus)**

| # | Pronos | Rangs |
|---|---|---|
| P1 | A 240, B 262, C 235, D 235, E 300 | A 1, B 2, C 3, D 3, E 5 |
| P2 | A 245, B 255, C 240 | A 1, B 1, C 3 |

**Vecteurs, malus d'absence**

| # | Cas | Attendu |
|---|---|---|
| A1 | réel 1 000, coefficient 2 : A 900, B 1 300 avec joker, C sans prono | A 200 ; B 300 (600 ÷ 2) ; C 600 (pire écart 300 × 2 ; le joker de B n'y change rien) |
| A2 | choix, malus 200, coefficient 1 : tous les pronos sont justes, C sans prono | C 200 |
| A3 | question sans aucun prono | malus d'absence 0 |
| A4 | réel 1 000, un seul prono : 1 000 | malus d'absence 0 (le pire écart est 0) |
| X6 | liste de pronos vide | pas d'erreur |

### 5.6 Classement (`standings.ts`)

`computeStandings({ questions, predictions, players })`, où `questions` sont les questions **publiées, résolues et non annulées** de la saison.

- **Joueurs listés** : tous les comptes non désactivés, plus les comptes désactivés ayant au moins un prono dans la saison (marqués `inactive`, affichés avec « (inactif) »). Les comptes anonymisés gardent leur nom anonymisé. **Seulement les comptes créés avant la fin de la saison** (le début de la suivante ; la dernière saison n'a pas de fin), plus ceux qui y ont un prono : un collègue arrivé après une saison n'apparaît ni dans son classement recalculé ni dans son palmarès, même si la proclamation a lieu après son arrivée (décision du 30/09/2026, fonction `seasonPlayers`). Un joueur arrivé en cours de saison y figure, et prend le malus d'absence des questions résolues qu'il n'a pas pu jouer, y compris celles résolues avant son arrivée (v1.2 ; sinon il serait premier).
- **Par joueur** (v1.2) :
  - `malus` : somme des malus de ses pronos et des malus d'absence des questions où il n'a pas de prono (en centièmes entiers) ;
  - `bullseyes` : nombre de « Dans le mille » ;
  - `meanError` : moyenne des écarts relatifs finis de ses pronos sur les questions à nombre, ou `null`. Les absences n'y comptent pas. La règle du 01/10/2026 sur les pronos Juste Prix qui dépassent disparaît avec le Juste Prix ;
  - `questionsPlayed` : nombre de questions résolues avec un prono.
- **Tri** (v1.2) : `malus` **croissant**, puis `bullseyes` décroissants, puis `meanError` croissant (`null` en dernier). Le départage est celui de la v1.1, confirmé par l'utilisateur le 02/10/2026. À égalité parfaite (même malus, même nombre de « Dans le mille », écart moyen égal à 1e-12 près), même rang ; l'affichage départage alors par nom (ordre alphabétique français).
- **Rang** : classement avec ex æquo (1, 1, 3).
- **Évolution** (`withMovement`) : on recalcule le classement sans la dernière question résolue (la plus grande `resolved_at`, puis le plus grand `id`). `delta = rang précédent − rang actuel` (positif = montée). S'il n'y a qu'une question résolue, `delta = null` pour tous (pas de flèches).

| # | Cas | Attendu |
|---|---|---|
| C1 | A et B à 300 de malus ; A a 2 « Dans le mille », B 1 | A 1er, B 2e |
| C2 | A et B à 300 de malus et 1 « Dans le mille » ; écart moyen A 3 %, B 5 % | A 1er |
| C3 | A et B strictement identiques, C derrière | A et B rang 1, C rang 3 |
| C4 | après la 2e question résolue, A passe de 3e à 1er | `delta` de A = +2 |
| C5 | une seule question résolue | tous les `delta` valent `null` |
| C6 | joueur actif sans prono ; deux questions à nombre résolues (coefficient 1) dont les pires écarts sont 120 et 40 | présent avec 160 de malus, 0 question jouée, écart moyen `null` |
| C7 | A 100 de malus sans « Dans le mille », B 150 avec 2 | A 1er (le malus passe avant le départage) |
| C8 | compte créé après la résolution d'une question de la saison (avant la fin de la saison) | il prend le malus d'absence de cette question |
| C9 | compte désactivé sans prono dans la saison ; compte désactivé avec un prono | le premier n'est pas listé ; le second est listé (inactif), avec le malus d'absence des autres questions |

**Saison affichée par défaut** (classement et accueil), fonction `defaultSeason(now, seasons)` qui renvoie une saison ou `null` : la saison qui contient `now` (`seasonAt`, §5.1). Si elle n'a encore aucune question résolue, que la précédente a au moins une question publiée et qu'elle n'est pas proclamée, on affiche la précédente. S'il n'existe encore aucune saison (ou si `now` précède la première), on affiche l'état vide. Un sélecteur liste les saisons ayant au moins une question publiée.

### 5.7 Sagesse de la foule et graphiques (`crowd.ts`, `chart.ts`)

- **Pronos pris en compte** (v1.2) : ceux que la personne qui regarde a le droit de voir (§6.6). Avant le résultat, le prono d'un joueur dont la prolongation court n'entre ni dans la moyenne, ni dans la répartition, ni dans le graphique.
- **Nombre** : moyenne arithmétique et médiane de tous les pronos de la question (médiane d'un nombre pair de pronos = moyenne des deux du milieu). Affichage arrondi à l'entier si toutes les valeurs sont entières, sinon à 2 décimales. Après résolution, on affiche aussi l'écart de la moyenne et de la médiane à la valeur réelle.
- **Choix** : pour chaque réponse, nombre de pronos et pourcentage entier. Les pourcentages sont arrondis par la méthode du plus fort reste, pour que leur somme fasse 100.
- **Graphique en points** (`buildStripChart(values, real?, mean, width = 440)`) :
  - domaine = min et max des pronos, de la valeur réelle et de la moyenne, élargi de 8 % de chaque côté ; si min = max, ±10 % (±1 si la valeur est 0) ;
  - graduations « rondes » : pas = 1, 2 ou 5 × 10ⁿ pour environ 4 intervalles ; bornes arrondies au multiple du pas ;
  - placement : pronos triés par valeur, chaque point placé sur la première des 4 rangées où il est à au moins 14 px du point précédent de cette rangée ; si aucune ne convient, sur la rangée où l'écart est le plus grand ;
  - étiquette « TOI » (paramètre `viewerIndex`) : à côté du point du joueur, à droite, ou à gauche au-delà de 85 % de la largeur. Elle occupe 28 px sur la rangée du joueur : à droite, le point suivant de la rangée vient 28 px plus loin ; à gauche, le point du joueur demande 28 px de plus après le précédent. Posée au-dessus du point, elle cachait le point de la rangée suivante (recette du 01/10/2026, R-03) ;
  - positions renvoyées en pourcentage de la largeur, rangées en index (0 à 3).

| # | Cas | Attendu |
|---|---|---|
| F1 | 180, 205, 220, 228, 235, 240, 262, 270, 285, 300, 310, 330 | moyenne 255,4 (affichée 255), médiane 251 |
| F2 | choix : 5, 3, 1 réponses | 56 %, 33 %, 11 % (somme 100) |
| F3 | valeurs toutes égales à 100 | domaine 90 à 110 |
| F4 | graduations pour un domaine de 150 à 350 | 150, 200, 250, 300, 350 |

### 5.8 Badges (`badges.ts`)

Tous les badges sont **déduits** des pronos résolus et du palmarès, sans stockage.

| Clé | Nom affiché | Condition | Unité |
|---|---|---|---|
| `first_bullseye` | Premier « Dans le mille » | au moins un « Dans le mille », toutes saisons confondues | une fois |
| `nostradamus` | Nostradamus | au moins 3 « Dans le mille » dans une même saison | par saison |
| `sharpshooter` | Tireur d'élite | rang de proximité 1 sur une question à nombre (§5.5) | par question (compteur) |
| `joker_win` | Joker gagnant | joker sur une question où l'on finit parmi les `PODIUM_SIZE` (3) plus proches (nombre) ou avec la bonne réponse (choix) | par question (compteur) |
| `assiduous` | Assidu | un prono sur chaque question non annulée d'une saison **proclamée** | par saison |
| `champion` | Champion | rang 1 dans `season_standing` | par saison |

Sortie : `{ key, count, lastEarnedAt }[]`. Le profil affiche les 6 badges : obtenus en couleur avec leur compteur, les autres grisés.

v1.2 : les conditions ne changent pas. Le « podium » est désormais le rang de proximité de §5.5, sans bonus, et tous les pronos d'une question à nombre y participent (le Juste Prix, qui en excluait certains, a disparu). Dans une saison sans jokers, « Joker gagnant » ne peut pas être obtenu.

### 5.9 Pastille « Nouveau » (`visits.ts`)

- `NEW_VISIT_GAP_MS = 30 minutes`.
- `newReference(user, now)` : si `last_seen_at` est nul → `null` (pas de pastille). Si `now − last_seen_at > 30 min`, c'est une nouvelle visite → référence = `last_seen_at`. Sinon, on est dans la même visite → référence = `previous_visit_at`.
- Une question ouverte porte la pastille si `opens_at > référence`. Une question ouverte pour le joueur grâce à sa prolongation porte à la place la pastille « PROLONGÉE POUR TOI » (v1.2, §5.14).
- `recordVisit(db, actor, now)` (service de `profile.ts`, avec le contrôle d'accès commun : l'acteur est le compte qui visite ; décision du 30/09/2026), appelée à chaque page vue par le composant client `VisitTracker`, monté dans l'enveloppe commune des pages connectées (pages de l'admin comprises), après l'affichage : si `now − last_seen_at > 30 min`, alors `previous_visit_at = last_seen_at` ; puis toujours `last_seen_at = now`. Écrire après l'affichage évite que la pastille disparaisse avant d'avoir été vue.

| # | Données | Attendu |
|---|---|---|
| V1 | `last_seen_at` nul | pas de pastille |
| V2 | dernier passage il y a 2 h, question ouverte il y a 1 h | pastille |
| V3 | dernier passage il y a 10 min, visite précédente il y a 3 j, question ouverte hier | pastille (même visite, référence il y a 3 j) |
| V4 | question ouverte avant la référence | pas de pastille |

### 5.10 Compte à rebours (`countdown.ts`)

- `countdownParts(ms)` renvoie `{ d, h, m, s }`, avec heures, minutes et secondes sur 2 chiffres, et un libellé `« 3 j 07:45:10 »`. Une durée négative vaut 0.
- `URGENT_THRESHOLD_MS = 48 h` : en dessous, le compte à rebours passe en couleur « hot ».
- Côté client (§8.2), le premier affichage utilise l'heure du serveur transmise par la page, pour éviter tout écart entre serveur et navigateur ; le décompte démarre ensuite. À zéro, la page se rafraîchit une fois (`router.refresh()`).
- Pour un joueur prolongé, le compte à rebours va jusqu'à sa date limite personnelle (v1.2, §5.14).

### 5.11 Questions : règles du back-office

**Création** (`draft`) : catégorie, type, énoncé et source obligatoires. Pour `number` : unité recommandée (le Juste Prix n'existe plus depuis la v1.2). Pour `choice` : au moins 2 réponses, libellés non vides et uniques (insensible à la casse), et **malus d'une mauvaise réponse** obligatoire (v1.2) :
- lu comme un prono (§5.3), strictement positif, sans valeur par défaut ;
- refusé s'il est absent : « Indique le malus d'une mauvaise réponse. » ;
- refusé s'il vaut 0 : « Le malus doit être supérieur à 0. ».

Le formulaire rappelle de le comparer aux écarts attendus sur les questions à nombre (par exemple quelques dizaines pour une JPO, quelques centaines pour des candidatures). Le modèle « oui/non » crée les réponses « Oui » et « Non ». Passer un brouillon de nombre à choix demande ce malus ; passer de choix à nombre l'efface.

**Publication** (`published`), vérifications :
- `opens_at` et `closes_at` renseignés, `opens_at < closes_at`, `closes_at > now` ;
- `expected_result_at ≥ closes_at` s'il est renseigné ;
- coefficient ∈ {1, 2, 3} ;
- règles de type ci-dessus ;
- la saison de la clôture n'est pas proclamée (décision du 30/09/2026) : « Cette date de clôture tombe dans une saison déjà proclamée : crée d'abord la saison suivante dans Saisons et lots. » Le même refus s'applique aux dates en série et au changement de clôture d'une question publiée. Un brouillon, lui, peut clôturer dans une saison proclamée (il suit sa date) ; il sera publiable une fois la saison suivante créée.

Une question publiée avec `opens_at` dans le futur est « programmée » : l'admin peut préparer la campagne d'octobre à l'avance.

**Dates en série** : sur une sélection de questions sans prono, appliquer les mêmes `opens_at`, `closes_at` et `expected_result_at`, puis publier la sélection. Chaque question est validée ; le résultat indique lesquelles ont échoué et pourquoi.

**Modification**, selon l'état :

| Champ | Sans prono | Avec au moins un prono | Après la clôture |
|---|---|---|---|
| type, énoncé, description, unité, réponses, malus d'une mauvaise réponse, source, coefficient | oui | **non** | non |
| catégorie | oui | oui | oui |
| aide (lien BI, valeur de l'an dernier, indice) | oui | oui | oui |
| ouverture | oui | non si déjà ouverte | non |
| clôture | oui | **seulement plus tard** (et > `now`) | non |
| résultat prévu | oui | oui | oui |

Pour changer un champ verrouillé, l'admin annule la question et en crée une nouvelle (le message d'erreur le dit).

**Suppression** : uniquement un brouillon sans prono. Sinon, annulation.

**Annulation** : possible à tout moment, avec confirmation ; `cancelled_at = now`. La question sort du calcul des malus (personne, absents compris, n'en prend sur elle), et les jokers posés dessus sont rendus.

**Résultat** : saisissable seulement si la question est `closed` ou `resolved`, **et si aucune prolongation ne court** sur la question (v1.2, §5.14). Sinon, refus `EXTENSION_RUNNING` : « Un joueur a une prolongation jusqu'au … : attends sa fin ou annule-la. ». `resolveQuestion` verrouille la question (`FOR UPDATE`) avant de lire ses prolongations.
- Question à nombre : même lecture que les pronos (§5.3).
- Question à choix : une réponse de la question.
- Première saisie : `resolved_at = now`. Saisies suivantes : `corrected_at = now`, et la page de la question affiche « Résultat corrigé le … ».
- À partir de l'É8d, la première saisie écrit aussi, dans la même transaction, le message de résultat du chat (§5.15). Une correction n'en écrit pas de nouveau : le texte est calculé à la lecture et reflète donc la valeur corrigée.

**Saison** : à chaque enregistrement de `closes_at`, `season_id` devient l'identifiant de la saison de cette date (§5.1), ou `null` si aucune saison ne la couvre. Les services ne créent plus de saison (v1.1 : `ensureSeason` disparaît). La publication (et les dates en série sur une question publiée) exige une saison : « Aucune saison ne couvre cette date de clôture : crée d'abord la saison dans Saisons et lots. » Une question qui a des pronos ne peut pas changer de saison (décision du 30/09/2026).

**Duplication** : copie catégorie, type, énoncé, description, unité, source, aide, coefficient, réponses et malus d'une mauvaise réponse, en brouillon sans dates, avec `duplicated_from_id`. Les prolongations ne sont pas copiées. Si l'originale est résolue, `help_last_year` est prérempli avec son résultat formaté (nombre + unité, ou libellé de la bonne réponse).

### 5.12 Proclamation et palmarès

- **Conditions** : acteur admin ; la saison a au moins une question publiée ; toutes ses questions publiées non annulées sont résolues ; saison pas encore proclamée.
- **Effet**, en une transaction : calcul du classement (§5.6), puis insertion dans `season_standing` (rang, malus, « Dans le mille », écart moyen, questions jouées, nom affiché à cet instant), puis `proclaimed_at = now`. Depuis la v1.2, le malus total va dans la colonne `malus` et `points` reste nul (§4.3). Une prolongation en cours empêche déjà la résolution (§5.11) : une saison dont toutes les questions sont résolues n'en a plus.
- **Irréversible** : aucune action d'annulation. Une correction de résultat ultérieure ne modifie pas le palmarès.
- Le palmarès (`/palmares`) lit uniquement `season_standing`, jamais un recalcul.
- **Mise en œuvre** (É7) : `proclaimSeason(db, admin, { seasonId }, now)` verrouille la table `season` (comme les autres services de saisons, §5.13), puis les questions publiées de la saison (`FOR SHARE`), vérifie les conditions (`proclamationBlocker`, qui donne aussi la raison affichée sous le bouton) et calcule le classement avec `computeStandings`, comme `/classement`. Codes de refus : `ALREADY_PROCLAIMED`, `NOT_PROCLAIMABLE`.
- **Saison proclamée** (décision du 30/09/2026) : aucune question ne peut plus y être publiée ni y déplacer sa clôture (§5.11). Proclamer la dernière saison créée avant d'avoir créé la suivante bloque donc la publication des questions qui clôturent après son début ; la confirmation le rappelle.

### 5.13 Saisons : règles du back-office (v1.1, jokers v1.2)

Les rentrées ne tombent pas toujours le même jour : l'admin crée chaque saison avec sa date de début, de préférence à l'avance. Services de `src/lib/services/seasons.ts`, chacun en une transaction.

- **Nom** : 2 à 40 caractères après retrait des espaces, unique sans tenir compte de la casse (« Cette saison existe déjà. »). Modifiable à tout moment, même après la proclamation.
- **Date de début** : un jour, à 00:00 heure de Paris (`<input type="date">`, `seasonStartFromLocalDate`). Deux saisons ne commencent pas le même jour.
- **Jokers** (`jokers_enabled`, v1.2, É8c) : choisis à la création (case « Jokers autorisés », cochée par défaut) et modifiables ensuite (`updateSeason`).
  - Les autoriser est toujours accepté, sauf sur une saison proclamée.
  - Les retirer est refusé dès qu'un prono avec joker existe sur une question non annulée de la saison : `JOKERS_IN_USE`, « Des jokers sont déjà posés dans cette saison : impossible de les retirer. ». Un joker posé sur une question annulée a été rendu : il ne bloque rien.
  - Saison proclamée : réglage figé, comme la date de début.
  - La migration de l'É8c autorise les jokers sur les saisons existantes, dont 2026-2027 en production.
- **Créer** (`createSeason` : nom, date de début, jokers autorisés) : la nouvelle saison prend sa place dans la suite et reprend, dans la saison qui la précède, les questions dont la clôture tombe à partir de son début. Refusé :
  - si l'une de ces questions a des pronos : « Des questions avec des pronos clôturent après cette date : elles changeraient de saison. » ;
  - si une question publiée ou annulée sortirait d'une saison proclamée (règle des saisons proclamées, ci-dessous).
- **Modifier** (`updateSeason` : nom, date de début, jokers autorisés ; un champ absent garde sa valeur) : la date de début reste strictement entre celle de la saison précédente et celle de la suivante (on ne réordonne pas les saisons). Les questions qui changent de saison sont recalculées. Refusé :
  - si l'une d'elles a des pronos ;
  - si la saison est proclamée (le changement de date seulement ; le nom reste modifiable) ;
  - si une question publiée ou annulée entrerait dans une saison proclamée ou en sortirait ;
  - si une question publiée ou annulée se retrouverait sans saison (début de la première saison repoussé après sa clôture) ; un brouillon, lui, perd simplement sa saison.
- **Saisons proclamées** (décision du 30/09/2026, qui remplace « refusé si la saison qui la précède est proclamée ») : une création, un changement de date ou une suppression n'est refusé que si une question publiée ou annulée entrerait dans une saison proclamée ou en sortirait. Les brouillons suivent leur date. La date de début d'une saison proclamée reste figée (SA8). Sans cela, proclamer 2026-2027 avant d'avoir créé 2027-2028 aurait empêché pour toujours de créer 2027-2028.
- **Supprimer** (`deleteSeason`) : seulement si aucune question n'y est rattachée (brouillons compris) et si elle n'est pas proclamée ; ses lots sont supprimés avec elle, après confirmation. Refus : « Des questions sont rattachées à cette saison : elle ne peut pas être supprimée. »
- **Aucune saison** : tant qu'aucune saison n'existe, les brouillons s'enregistrent mais rien ne peut être publié ; `/admin/saisons` et le formulaire de question invitent à créer la première saison.
- **Rappel** : quand la saison courante est la dernière créée, `/admin/saisons` rappelle de créer la suivante avant la prochaine rentrée.
- **Lots** (`upsertPrizes`) : ceux d'une saison existante non proclamée (la v1.0 créait la saison courante au besoin : ce n'est plus le cas).
- **Verrous** : `createSeason`, `updateSeason` et `deleteSeason` verrouillent la table `season` (`LOCK TABLE … IN EXCLUSIVE MODE`), puis les questions qui ont une clôture (`FOR UPDATE`) avant de compter leurs pronos. Les services de questions qui fixent une saison lisent les saisons avec `FOR SHARE` (`seasonsForQuestions`) **avant** de verrouiller leur question : une question ne reçoit jamais sa saison d'une liste en cours de modification, et les verrous sont toujours pris dans le même ordre (pas d'interblocage). Les services de pronos (É6, §5.4) prennent `FOR SHARE` sur la ligne de la question, sans lire les saisons : un prono ne peut pas arriver pendant qu'une question change de saison. Exception (v1.2) : `setJoker` lit d'abord les saisons en `FOR SHARE`, avant la question, pour que `updateSeason` ne retire pas les jokers pendant qu'un joker est posé.

| # | Cas | Attendu |
|---|---|---|
| SA1 | saisons A (29/09/2025) et B (01/10/2026) ; créer C au 06/09/2027 | acceptée ; une question sans prono qui clôture le 10/09/2027 passe de B à C |
| SA2 | idem, mais la question du 10/09/2027 a un prono | refusée, rien ne change |
| SA3 | déplacer le début de B du 01/10/2026 au 28/09/2026 | les questions sans prono qui clôturent les 28, 29 ou 30/09 passent de A à B |
| SA4 | déplacer le début de B avant celui de A | refusé |
| SA5 | supprimer une saison qui a un brouillon rattaché | refusé |
| SA6 | supprimer une saison vide qui a des lots | acceptée, lots supprimés |
| SA7 | publier une question qui clôture avant la première saison | refusé, message ci-dessus |
| SA8 | saison proclamée : changer sa date de début ; la renommer | refusé ; accepté |
| SA9 | retirer les jokers d'une saison sans joker posé | accepté ; `setJoker` y renvoie ensuite `JOKERS_DISABLED` |
| SA10 | retirer les jokers d'une saison où un joueur en a posé un | refusé (`JOKERS_IN_USE`), rien ne change |
| SA11 | retirer les jokers quand le seul joker posé l'est sur une question annulée | accepté |
| SA12 | autoriser de nouveau les jokers | accepté ; `setJoker` fonctionne, avec la limite de 2 |
| SA13 | saison proclamée : changer le réglage des jokers | refusé |

### 5.14 Prolongations (v1.2, É8c)

Un joueur absent n'a pas pu pronostiquer : l'admin rouvre la question pour lui seul, jusqu'à une date limite personnelle (cahier des charges §4.10). Services de `src/lib/services/extensions.ts`, chacun en une transaction.

**Accorder ou changer** `setQuestionExtension(db, admin, { questionId, userId, closesAt }, now)`

Conditions, avec leur code de refus :
- l'acteur est admin ;
- `userId` n'est pas l'acteur (`SELF_EXTENSION` : « Tu ne peux pas te prolonger toi-même : demande à l'autre admin. ») ;
- la question est publiée, non annulée, sans résultat, et ouverte ou clôturée, pas programmée (`EXTENSION_NOT_ALLOWED` : « Prolongation impossible : la question doit être ouverte ou clôturée, sans résultat. ») ;
- le compte visé existe et n'est pas désactivé ;
- le joueur n'a pas de prono sur la question (`EXTENSION_HAS_PREDICTION` : « Ce joueur a déjà un prono sur cette question. »). Exception : si sa prolongation court encore, l'admin peut changer la date limite même si le joueur a déjà un prono ;
- `closesAt` (heure de Paris saisie, `parisLocalToUtc`) est dans le futur et après la clôture de la question (`INVALID_EXTENSION_DATE` : « La date limite doit être dans le futur et après la clôture de la question. »).

Effet : crée la ligne (`granted_by`, `granted_at`) ou change sa date (`updated_by`, `updated_at`). Une prolongation échue sur laquelle le joueur n'a pas de prono peut être relancée de la même façon. Une prolongation échue avec un prono ne se modifie plus : le prono est validé, et le joueur a pu voir ceux des autres depuis.

**Annuler** `cancelQuestionExtension(db, admin, { questionId, userId }, now)`
- Conditions : admin, pas sur soi-même (`SELF_EXTENSION`) ; une prolongation qui court (`NO_EXTENSION` : « Aucune prolongation en cours pour ce joueur. »).
- Effet : si le joueur n'a pas de prono, la ligne est supprimée. S'il en a un, `closes_at = now` : la prolongation se termine et son prono compte comme validé (`predictionState`, §5.4).

**Verrous** : la question (`FOR UPDATE`, ce qui attend les services de pronos en cours, qui la tiennent en `FOR SHARE`, et bloque `resolveQuestion`), puis la ligne de prolongation (`FOR UPDATE`), puis le prono du joueur (lecture). L'ordre question → prolongation est le même que dans les services de pronos (§5.4).

**Effets ailleurs** :
- **statut** de la question pour le joueur : `questionStatusFor` (§5.2) ;
- **services de pronos** : ouverts pour lui jusqu'à sa date limite (§5.4) ;
- **résultat** : refusé tant qu'une prolongation court (`EXTENSION_RUNNING`, §5.11) ;
- **visibilité** : §6.6 ;
- **compte à rebours** : jusqu'à sa date limite (§5.10) ;
- **pastille** : « PROLONGÉE POUR TOI » (§5.9) ;
- **dates de la question** : repousser sa clôture ne touche pas aux prolongations ;
- **annulation de la question** : les prolongations ne servent plus à rien, mais restent en base.

| # | Cas | Attendu |
|---|---|---|
| PR1 | question clôturée sans résultat, joueur sans prono, date limite dans 48 h | accordée ; le joueur enregistre, valide et pose un joker ; un autre joueur reçoit toujours `QUESTION_NOT_OPEN` |
| PR2 | question résolue | refusée (`EXTENSION_NOT_ALLOWED`) |
| PR3 | question programmée, ou annulée | refusée (`EXTENSION_NOT_ALLOWED`) |
| PR4 | joueur qui a déjà un prono | refusée (`EXTENSION_HAS_PREDICTION`) |
| PR5 | l'admin pour lui-même | refusée (`SELF_EXTENSION`) ; l'autre admin peut la lui accorder |
| PR6 | date limite passée, ou avant la clôture de la question | refusée (`INVALID_EXTENSION_DATE`) |
| PR7 | prolongation en cours : saisir le résultat | refusé (`EXTENSION_RUNNING`) ; accepté après la date limite ou après l'annulation |
| PR8 | annuler sans prono ; annuler avec un prono enregistré | ligne supprimée ; prolongation terminée à `now`, prono compté comme validé |
| PR9 | après la date limite, le joueur tente d'enregistrer | `QUESTION_NOT_OPEN` ; son prono enregistré compte comme validé |
| PR10 | question encore ouverte (absence prévue), date limite après sa clôture | accordée ; après la clôture, le joueur pronostique jusqu'à sa date limite |

### 5.15 Chat général (v1.2, É8d)

Un fil unique pour toute l'équipe (cahier des charges §4.11). Les messages sont stockés en base (`chat_message`, §4.3) et conservés.

**Arrivée des nouveaux messages** : Vercel ne garde pas de connexion ouverte (WebSocket), et le projet n'utilise aucun service tiers (§1.1). La page `/chat` interroge donc `GET /api/chat` toutes les `CHAT_POLL_MS` (10 s).
- Elle ne le fait que si l'onglet est visible (`document.visibilityState`) et si la personne a agi dans les `CHAT_IDLE_MS` (5 min) précédentes : souris, clavier, défilement, focus.
- Sinon elle se met en pause, et reprend aussitôt, avec une interrogation immédiate, dès que l'onglet redevient visible ou que la personne agit.
- La règle est une fonction pure, `shouldPoll({ visible, lastActivityAt, now })`, dans `src/lib/chat/polling.ts`.
- Sans cette pause, un onglet oublié toute la journée empêcherait la base Neon de se mettre en veille, et consommerait les quotas gratuits de Neon et de Vercel.

**Écrire** `postChatMessage(db, actor, { body }, now)`
- Compte connecté, non désactivé.
- Texte :
  - fins de ligne normalisées en `\n`, espaces retirés au début et à la fin, retours à la ligne intérieurs conservés ;
  - longueur comptée en points de code Unicode (`[...texte].length`, comme `char_length` de PostgreSQL : un emoji simple compte pour 1) ;
  - vide : `EMPTY_MESSAGE`, « Écris un message. » ;
  - plus de 500 : `MESSAGE_TOO_LONG`, « 500 caractères au maximum. ».
- Au plus `CHAT_MAX_PER_MINUTE` (10) messages par compte sur les 60 dernières secondes (ligne `user` verrouillée en `FOR NO KEY UPDATE`, puis comptage) : `CHAT_RATE_LIMITED`, « Doucement : 10 messages par minute au maximum. ».
- Effet : insère un `message`.

**Supprimer** `deleteChatMessage(db, actor, { messageId }, now)`
- Un `message` non supprimé : par son auteur ou par un admin. Un message de résultat : par un admin seulement. Sinon `FORBIDDEN` ; message inconnu ou déjà supprimé : `MESSAGE_NOT_FOUND`, « Ce message n'existe plus. ».
- Effet : `body = NULL` (le contenu est effacé, pas seulement masqué), `deleted_at = now`, `deleted_by = acteur`. L'affichage montre « Message supprimé. ». Pas de modification de message.

**Marquer comme lu** `markChatRead(db, actor, { lastMessageId }, now)` : `chat_read.last_read_id = max(valeur actuelle, lastMessageId)`, en refusant un identifiant supérieur au plus grand message existant. Appelé par la page `/chat` quand elle affiche des messages, onglet visible.

**Message de résultat** : `resolveQuestion` (§5.11) insère un `result` à la première saisie du résultat, avec la question. Le texte est calculé à la lecture par `src/lib/chat/result-message.ts`, une fonction pure et testée :
- nombre : « Résultat : <énoncé> → <valeur> <unité>. Le plus proche : <nom> » (« Les plus proches : Léa et Hugo » à égalité au rang 1) ;
- choix : « Résultat : <énoncé> → <bonne réponse>. <n> bonne(s) réponse(s) sur <m> pronos. » ;
- sans aucun prono, la seconde phrase est omise ;
- « (corrigé) » est ajouté si le résultat a été corrigé ;
- le message porte un lien vers la question ;
- si la question est annulée ensuite, il n'est plus affiché.

**Anonymisation** (`anonymizeUser`, §6.3) : tous les messages du compte sont effacés comme une suppression (`deleted_by` = l'admin).

**Lectures** (`src/lib/data/chat.ts`) :
- `getChatMessages(db, viewer, { beforeId? }, now)` : les `CHAT_PAGE_SIZE` (50) messages précédant `beforeId`, ou les derniers. Chaque message contient l'identifiant, le type, la date, l'auteur (identifiant, nom, avatar, inactif), le texte ou « supprimé », le texte calculé d'un message de résultat, et `canDelete` ;
- `getChatUpdates(db, viewer, { afterId, since }, now)` : les messages d'identifiant supérieur à `afterId` (100 au plus), les identifiants des messages supprimés depuis `since`, et `serverTime`, à repasser en `since` à l'appel suivant ;
- `getUnreadChatCount(db, viewer)` : les messages d'identifiant supérieur à `chat_read.last_read_id` (ou tous, s'il n'a jamais ouvert le chat), hors les siens et hors les messages supprimés.

**Route** `src/app/api/chat/route.ts` (`GET`, `after` et `since` en paramètres) :
- lit la session (`getViewer`, en-têtes d'abord, §6.4) ;
- sans session valide ou pour un compte désactivé : `401` avec `{ "error": "NOT_AUTHENTICATED" }`, et la page renvoie alors vers `/connexion` ;
- sinon : `200` avec le JSON de `getChatUpdates` ;
- `Cache-Control: no-store`, rendu dynamique ;
- aucun effet de bord : marquer comme lu passe par une Server Action.

**Emojis** : une grille de 48 emojis choisis, sans bibliothèque, dans `src/lib/chat/emojis.ts` (caractère et nom français, pour le libellé accessible) : 😀 visage souriant, 😂 rire aux larmes, 😅 sourire gêné, 😉 clin d'œil, 😍 yeux en cœur, 😎 lunettes de soleil, 🤔 qui réfléchit, 😮 bouche bée, 😱 cri d'effroi, 😢 larme, 😭 en pleurs, 😡 en colère, 🙄 yeux au ciel, 😬 grimace, 🤯 tête qui explose, 🥳 fête, 😴 qui dort, 🤞 doigts croisés, 👍 pouce levé, 👎 pouce baissé, 👏 applaudissements, 🙌 mains levées, 🙏 merci, 💪 biceps, 👀 yeux, 🤝 poignée de main, ✌️ victoire, 👋 coucou, 🎯 cible, 🏆 trophée, 🥇 médaille d'or, 🥈 médaille d'argent, 🥉 médaille de bronze, 🔥 feu, 💯 cent, ⭐ étoile, 🎉 cotillons, 🍀 trèfle, 🃏 joker, 📈 hausse, 📉 baisse, 📊 graphique, 🎓 diplômé, 📚 livres, ☕ café, 🍕 pizza, ❤️ cœur, 🚀 fusée. Le raccourci Windows Win + . reste utilisable dans le champ.

**Sécurité** : le texte est affiché comme du texte (échappé par React, jamais `dangerouslySetInnerHTML`, aucun lien rendu cliquable) ; jamais journalisé ; validé par Zod côté serveur.

| # | Cas | Attendu |
|---|---|---|
| CH1 | message de 500 points de code, dont des emojis ; message de 501 | accepté ; `MESSAGE_TOO_LONG` |
| CH2 | message vide ou fait d'espaces | `EMPTY_MESSAGE` |
| CH3 | 11e message en moins de 60 s ; puis un message 60 s après le premier | `CHAT_RATE_LIMITED` ; accepté |
| CH4 | compte désactivé | `ACCOUNT_DISABLED` |
| CH5 | un joueur supprime son message ; le message d'un autre ; un message de résultat | accepté (texte effacé) ; `FORBIDDEN` ; `FORBIDDEN` |
| CH6 | un admin supprime le message d'un joueur ; un message de résultat | accepté ; accepté |
| CH7 | `markChatRead` avec un identifiant plus petit que le dernier lu | rien ne change |
| CH8 | non lus | n'incluent ni ses propres messages ni les messages supprimés |
| CH9 | première saisie d'un résultat ; correction ; annulation de la question | un message de résultat ; pas de second message, texte corrigé ; message masqué |
| CH10 | anonymisation d'un compte | tous ses messages effacés |
| CH11 | `shouldPoll` : onglet caché ; visible et inactif depuis 6 min ; visible et actif il y a 1 min | non ; non ; oui |

---

## 6. Authentification et autorisations

### 6.1 Configuration de Better Auth (`src/lib/auth/auth.ts`)

Fabrique `createAuth(db, env)` (pour pouvoir brancher la base et l'environnement de test), et instance de l'application `getAuth()`, créée au premier usage et non à l'import : `next build` charge le module et ne doit pas ouvrir la base (PGlite des tests de bout en bout). La CLI de génération lit l'instance exportée par `src/lib/auth/auth-cli.ts` (décision du 30/09/2026).

- **Adaptateur** : Drizzle, fournisseur `pg`, avec le schéma de `src/lib/db/schema`.
- **Email et mot de passe** : activé ; vérification d'email désactivée ; mot de passe de 8 à 128 caractères ; connexion automatique après inscription.
- **Session** :
  - durée de 400 jours (le maximum qu'acceptent les navigateurs pour un cookie) ;
  - renouvelée à chaque visite (au plus une fois par jour) ;
  - cache du cookie de session **désactivé** : chaque page relit la session en base, pour qu'une désactivation, un changement de rôle ou de nom s'applique tout de suite (décision du 30/09/2026 ; la v1.0 prévoyait un cache de quelques minutes).
- **Plugins** :
  - `admin` : rôle par défaut `player`, rôle admin `admin` ;
  - `nextCookies` : pour que les Server Actions puissent poser les cookies.
- **Champs additionnels** de `user` : `avatar`, `lastSeenAt`, `previousVisitAt` (§4.2). Ils ne sont pas modifiables par le client lors de l'inscription.
- **Hook avant création d'un utilisateur** (§6.2).
- **Limitation des tentatives** : activée, stockée en base.
  - `/sign-in/email` : 5 tentatives par minute ;
  - `/sign-up/email` : 5 par 10 minutes ;
  - adresse IP lue dans `x-forwarded-for` (fourni par Vercel).
- **Origines de confiance** :
  - `baseURL` = `BETTER_AUTH_URL`, sinon `https://${VERCEL_URL}`, sinon `http://localhost:3000` ;
  - `trustedOrigins` contient `BETTER_AUTH_URL` et les variantes `https://` de `VERCEL_URL`, `VERCEL_BRANCH_URL` et `VERCEL_PROJECT_PRODUCTION_URL` quand elles existent.
- **Route** : `src/app/api/auth/[...all]/route.ts` expose le gestionnaire de Better Auth, **limité** aux routes dont l'interface a besoin (`/sign-in/email`, `/sign-up/email`, `/get-session`, liste dans `src/lib/auth/http-paths.ts`). Toutes les autres répondent 404, en particulier celles du plugin admin (`/admin/*`) et `/update-user`, qui contourneraient les règles des services (dernier admin, nom unique, jamais de suppression d'un compte qui a des pronos). Les appels côté serveur (`auth.api.*`) ne sont pas concernés (décision du 30/09/2026).
- **Connexion et inscription** passent par HTTP (client Better Auth dans le navigateur), pour que la limitation des tentatives s'applique : elle n'agit que sur les requêtes HTTP, pas sur les appels `auth.api.*`. Déconnexion et changement de mot de passe sont des Server Actions.
- **Client** : `src/lib/auth/auth-client.ts` crée le client React, sans le plugin client admin : les actions d'admin sont des Server Actions (§6.3).

> Les noms exacts d'options de Better Auth peuvent changer d'une version à l'autre (§14). Vérifier dans la documentation de la version installée ; le **comportement** décrit ici est le contrat.

### 6.2 Inscription, liste blanche et premier admin

- **Hooks** (décision du 30/09/2026) : les contrôles qui lisent la base (liste blanche, compte existant, nom pris) tournent dans un hook `before` de Better Auth sur `/sign-up/email`, avant la transaction d'inscription (une requête hors transaction bloquerait PGlite, qui n'a qu'une connexion). Le hook de base de données `user.create.before` pose ensuite l'identifiant, l'email normalisé, le rôle et l'avatar.
- **Contrôles** : l'email est mis en minuscules et débarrassé de ses espaces.
  - S'il ne figure ni dans `allowed_email` ni dans `ADMIN_EMAILS`, l'inscription est refusée avec « Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin. »
  - S'il figure dans `ADMIN_EMAILS`, `role = 'admin'`, sinon `player`.
  - `avatar` reçoit la valeur par défaut calculée (§8.2).
- **Nom affiché** : de 2 à 30 caractères après retrait des espaces, **unique** (insensible à la casse), vérifié par le formulaire et par le hook : « Ce nom est déjà pris. »
- **Compte déjà existant** : « Un compte existe déjà avec cette adresse. Connecte-toi. »
- Une adresse de `ADMIN_EMAILS` n'a pas besoin d'être dans `allowed_email` : le hook l'accepte directement. C'est ce qui permet de créer le premier compte admin (H-09).

### 6.3 Gestion des comptes (admin)

- **Mise en œuvre** (décision du 30/09/2026) : les services de `src/lib/services/players.ts` écrivent eux-mêmes ce qu'écrirait l'API admin de Better Auth (champs de bannissement, suppression des sessions, mot de passe haché par `better-auth/crypto`). Cette API exige la session HTTP de l'admin, incompatible avec la signature `(db, actor, input, now)` des services (§7.1).
- **Désactiver** : bannissement Better Auth, sans date de fin, ce qui révoque les sessions ; après une confirmation, puisque la session du joueur tombe aussitôt (décision du 01/10/2026). **Réactiver** : levée du bannissement, sans confirmation.
- **Mot de passe provisoire** :
  - 12 caractères aléatoires, alphabet sans caractères ambigus (pas de `0 O o 1 l I`) ;
  - haché comme le fait Better Auth et enregistré sur le compte « credential » du joueur ;
  - affiché une seule fois à l'admin dans une boîte de dialogue, avec « Copier » ;
  - les sessions du joueur sont révoquées ;
  - le joueur le change ensuite dans `/profil`.
- **Rôle** : passer admin ou joueur. On ne peut ni se retirer soi-même le rôle admin, ni se désactiver soi-même. Il doit toujours rester au moins un admin.
- **Anonymiser** (droit à l'effacement), avec confirmation :
  - `name = « Ancien joueur n »` ;
  - `email = anonyme-<id>@invalid.local` ;
  - avatar par défaut, compte désactivé ;
  - adresse retirée de la liste blanche ;
  - le nom est aussi remplacé dans le palmarès (`season_standing.name_snapshot`) ; rangs et malus restent figés (décision du 30/09/2026) ;
  - les pronos sont conservés, pour que le classement des autres reste juste ;
  - ses messages du chat sont effacés (v1.2, É8d, §5.15).
- **Liste blanche** :
  - ajout en série (une adresse par ligne ; virgules et points-virgules acceptés) ;
  - bilan affiché : « 3 ajoutées, 1 déjà présente, 1 invalide » ;
  - retrait possible seulement s'il n'existe pas de compte avec cette adresse (sinon, désactiver le compte).

### 6.4 Protection des routes

1. **Proxy/middleware** (redirection rapide, pas une sécurité) : sans cookie de session Better Auth, toute route sauf `/connexion`, `/inscription`, `/api/auth/*`, `/api/health`, `/api/chat` (É8d : la route répond elle-même `401` en JSON, une redirection n'aurait pas de sens pour un appel `fetch`) et les fichiers statiques redirige vers `/connexion`.
2. **Layout `(jeu)`** : `requireUser()`. Sans session valide, redirection vers `/connexion`. Un compte désactivé n'a plus de session.
3. **Layout `admin`** : `requireAdmin()`. Un joueur non admin reçoit la page 404 (on ne révèle pas l'existence du back-office). Next résout les métadonnées d'une page même quand son layout répond 404 : les pages d'admin donnent leur titre par `generateMetadata`, qui passe par `adminMetadata(titre)` (`requireAdmin()` d'abord). Sinon, l'onglet d'un joueur affichait « Back-office · Le Bon Chiffre » (recette du 01/10/2026, R-02).
4. **Chaque Server Action** appelle `requireUser()` ou `requireAdmin()` et renvoie une erreur `NOT_AUTHENTICATED` ou `FORBIDDEN`, jamais une exception non gérée.
5. **Chaque service** revérifie le rôle de l'acteur qu'il reçoit (défense en profondeur).

`getViewer()` lit la session (`auth.api.getSession({ headers })`) et renvoie `{ id, name, role, banned, avatar, lastSeenAt, previousVisitAt } | null`.

### 6.5 Matrice des autorisations

| Action | Anonyme | Joueur | Joueur désactivé | Admin |
|---|---|---|---|---|
| Voir les pages du jeu | → /connexion | oui | → /connexion | oui |
| Voir le back-office | → /connexion | 404 | → /connexion | oui |
| Enregistrer, valider un prono, poser un joker | refusé | oui (les siens) | refusé | oui (les siens) |
| Déverrouiller un prono | refusé | refusé | refusé | oui |
| Prolonger une question pour un joueur, annuler une prolongation (É8c) | refusé | refusé | refusé | oui, jamais pour soi-même |
| Gérer questions, catégories, saisons, lots, annonces | refusé | refusé | refusé | oui |
| Gérer liste blanche et comptes | refusé | refusé | refusé | oui |
| Modifier son nom, son avatar, son mot de passe | refusé | oui | refusé | oui |
| Lire et écrire dans le chat, marquer comme lu (É8d) | refusé (`401` pour `/api/chat`) | oui | refusé | oui |
| Supprimer un message du chat (É8d) | refusé | les siens | refusé | tous, messages de résultat compris |

### 6.6 Visibilité des données

**Depuis la v1.2 (É8c)**, la visibilité se décide avec trois éléments :
- le statut de la question **pour la personne qui regarde** (`questionStatusFor`, §5.2) : une question clôturée est « ouverte » pour un joueur dont la prolongation court ;
- le fait que cette personne ait, ou non, un prono sur la question ;
- les prolongations des autres joueurs.

Le tableau vaut pour les pages du joueur comme pour le back-office (l'admin joue aussi).

| Donnée | Avant l'ouverture | Ouverte pour moi (ouverte, ou ma prolongation court) | Clôturée, j'ai un prono | Clôturée, je n'ai pas de prono | Résolue |
|---|---|---|---|---|---|
| La question elle-même (joueur) | invisible (404) | visible | visible | visible | visible |
| Mon prono | — | visible | visible | — | visible |
| Les pronos des autres (joueur) | — | **jamais** | valeurs, jokers, noms, **sauf ceux des joueurs dont la prolongation court** | **non** : « Les pronos s'afficheront au résultat. » (décision du 02/10/2026) | tout, avec écarts et malus, absents compris |
| Les pronos des autres (admin, back-office) | — | **états seulement** : à faire, enregistré, validé | valeurs, sauf les joueurs dont la prolongation court (leur état seulement) | **états seulement** | tout |
| Historique des événements (admin) | — | types et horaires, **sans valeurs ni jokers** (l'admin joue aussi ; décision du 01/10/2026) | avec valeurs et jokers, sauf les événements des joueurs dont la prolongation court | sans valeurs ni jokers | avec valeurs et jokers |
| Sagesse de la foule, graphique | — | non | oui, sans les pronos cachés | non | oui, avec la valeur réelle |
| Prolongations en cours sur la question | — | — | « Prolongation en cours pour n joueur(s), jusqu'au … : son prono s'affichera ensuite. », sans nom (précision de l'agent, contestable) | idem | — |

Conséquences :
- un admin qui n'a pas pronostiqué une question clôturée ne voit plus les valeurs dans le back-office avant le résultat (jusqu'à la v1.1, il les voyait) : il peut ainsi recevoir une prolongation de l'autre admin sans avoir vu les réponses ;
- un admin qui ne joue pas du tout ne voit les valeurs qu'au résultat ;
- saisir le résultat ne demande pas de voir les pronos.

Une seule fonction de `src/lib/data/` lit les pronos d'une question pour l'affichage : `getQuestionPredictionsForViewer(db, viewer, questionId, now)`. Elle applique ce tableau, et lit la prolongation de la personne qui regarde comme celles des autres. Aucun composant ne lit la table `prediction` directement. Les requêtes des cas « états seulement » ne sélectionnent aucune colonne de valeur (comme depuis l'É5).

---

## 7. Couche serveur

### 7.1 Conventions

- **`src/lib/game/`** : fonctions pures, sans `import` de Next, de la base ou de `Date.now()`.
- **`src/lib/services/`** : une fonction par écriture métier, signature `(db, actor, input, now)`.
  - validation Zod de `input` ;
  - contrôle des droits ;
  - transaction ;
  - écriture de l'événement quand il y en a un ;
  - retour d'un `Result` ;
  - aucun import de Next : c'est ce qui permet de les tester sur PGlite.
- **`src/lib/data/`** : lectures, avec `import 'server-only'` et signature `(db, viewer, params, now)`. Elles appliquent la visibilité (§6.6) et renvoient des objets prêts à afficher.
- **`src/lib/actions/`** : fichiers `'use server'`. Chaque action récupère la session, appelle le service avec `getDb()` et `new Date()`, appelle `revalidatePath` sur les pages concernées, puis renvoie le `Result`. **Aucune règle métier dans les actions.**
- **Formulaires** : `useActionState` pour l'état « en cours » et les erreurs ; messages d'erreur annoncés via `aria-live="polite"`.

```ts
type Actor = { id: string; role: 'player' | 'admin'; banned: boolean };
type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };
```

### 7.2 Base de données (`src/lib/db/client.ts`)

- `getDb()` renvoie un singleton, **un seul par processus** : il est rangé sur `globalThis`, car Next.js compile les routes et les pages dans des paquets séparés, chacun avec sa copie du module. Deux instances PGlite sur le même dossier ne verraient pas leurs écritures respectives (décision du 30/09/2026) :
  - si `DB_DRIVER === 'pglite'` : `drizzle(new PGlite(PGLITE_DIR))` (chargement dynamique de PGlite) ;
  - si `DB_DRIVER === 'neon-ws'` (local uniquement) : pool WebSocket de `@neondatabase/serverless` (chargement dynamique) ;
  - sinon : `drizzle(new Pool({ connectionString: DATABASE_URL }))` avec node-postgres. Sur Vercel, attacher le pool au cycle de vie des fonctions avec `attachDatabasePool` de `@vercel/functions` si disponible (§14).
  - Toute autre valeur de `DB_DRIVER` est refusée.
- Les scripts (`scripts/lib/db.ts`) suivent le même choix : PGlite, WebSocket ou node-postgres. Ils chargent les fichiers d'environnement comme `next dev` : `.env.development.local`, `.env.local`, `.env`.
- Type commun : `type Database = PgDatabase<…, typeof schema>` (base commune aux deux pilotes).
- `tests/helpers/db.ts` expose `createTestDb()` : PGlite en mémoire, migrations appliquées, renvoie `{ db, close }`.

### 7.3 Liste des services

| Fichier | Fonctions |
|---|---|
| `predictions.ts` | `savePrediction`, `validatePrediction`, `setJoker`, `unlockPrediction` |
| `questions.ts` | `createQuestion`, `updateQuestion`, `deleteDraftQuestion`, `publishQuestions`, `setQuestionDates`, `duplicateQuestion`, `cancelQuestion`, `resolveQuestion` |
| `extensions.ts` (É8c) | `setQuestionExtension`, `cancelQuestionExtension` (§5.14) |
| `categories.ts` | `createCategory`, `renameCategory`, `archiveCategory`, `unarchiveCategory` |
| `seasons.ts` | `createSeason`, `updateSeason`, `deleteSeason`, `upsertPrizes`, `proclaimSeason` (v1.1 : `ensureSeason` disparaît, §5.13) |
| `announcements.ts` | `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` |
| `players.ts` | `addAllowedEmails`, `removeAllowedEmail`, `setRole`, `disableUser`, `enableUser`, `setTemporaryPassword`, `anonymizeUser` |
| `profile.ts` | `updateDisplayName`, `updateAvatar`, `recordVisit` (le changement de mot de passe passe par Better Auth) |
| `chat.ts` (É8d) | `postChatMessage`, `deleteChatMessage`, `markChatRead` (§5.15) |

La matrice d'autorisation (`tests/integration/authorization-matrix.test.ts`, §9.3) compte ces services : 34 jusqu'à l'É8b, 36 après l'É8c, 39 après l'É8d.

### 7.4 Liste des lectures

| Fichier | Fonctions |
|---|---|
| `home.ts` | `getHomeData` : annonces (3 dernières), bienvenue, progression, rang, malus, jokers restants (`null` si la saison n'autorise pas les jokers), 5 prochaines clôtures (y compris mes questions prolongées, à leur date limite), top 6 + ma ligne, dernier résultat |
| `questions.ts` | `getOpenQuestionsForViewer` (y compris les questions ouvertes pour moi par une prolongation), `getQuestionsList(tab)` (une question que ma prolongation garde ouverte est dans « Ouvertes », pas dans « En attente du résultat »), `getQuestionDetail` (statut pour la personne qui regarde, sa date limite, prolongations en cours), `getQuestionPredictionsForViewer` (§6.6 v1.2), `isQuestionVisible` (É8 : contrôle du layout de `/questions/[id]`, sans paramètre `viewer`, la réponse étant la même pour tous), `getJokersLeft` (`null` si la saison n'autorise pas les jokers) |
| `results.ts` (É7) | `getQuestionResults` (après la clôture : pronos visibles, sagesse de la foule, malus une fois résolue, **absents compris** avec leur malus d'absence, badges gagnés sur la question ; passe par `getQuestionPredictionsForViewer`), `getLatestResult` (accueil) |
| `badges.ts` (É7) | `getPlayerResults` (questions résolues de la saison pour un joueur, avec son prono et son malus, ou « pas de prono » et le malus d'absence), `getPlayerBadges`, `getBadgesOnQuestion` |
| `standings.ts` | `getStandings({ seasonId? })`, `getAvailableSeasons` |
| `players.ts` | `getPlayerProfile({ userId, seasonId? })`, `getAllowedEmails`, `getAccounts` |
| `admin.ts` | `getAdminDashboard` (avec les prolongations en cours), `getAdminQuestion` (avec la prolongation de chaque joueur et ce que l'admin peut en faire), `getAdminQuestionsList(filters)`, `getSeasonsAdmin` (avec la raison de ne pas proclamer et le réglage des jokers), `hasSeasons` (formulaire de question, §5.13) |
| `content.ts` | `getAnnouncements`, `getPrizes(seasonId)`, `getPalmares`, `getCurrentSeason` (pied de page, `/lots`, tuile Jokers ; avec `jokersEnabled`) |
| `chat.ts` (É8d) | `getChatMessages`, `getChatUpdates`, `getUnreadChatCount` (§5.15) |

---

## 8. Interface

### 8.1 Design system B5 « Jour de match »

**Jetons** (dans `src/app/globals.css`, bloc `@theme` de Tailwind v4) :

| Jeton | Valeur | Usage |
|---|---|---|
| `--color-bg` | `#EDEFF3` | fond de page, en-tête, fond des comptes à rebours et des champs de prono |
| `--color-surface` | `#FFFFFF` | cartes |
| `--color-raised` | `#F4F5F8` | lignes du classement, tuiles secondaires |
| `--color-chip` | `#E6E9EF` | étiquettes de catégorie, fond des avatars à initiales |
| `--color-line` | `#D8DCE3` | bordures, axe des graphiques, segments vides |
| `--color-line-strong` | `#7E8796` | bordures des boutons secondaires et des champs, contours en pointillés (joker, états vides), tuiles de réponse. La maquette donnait `#B5BCC8` (1,9:1 sur `surface`, sous le seuil de 3:1 des composants d'interface) ; foncé à l'É8 avec l'accord de l'utilisateur : 3,6:1 sur `surface`, 3,15:1 sur `bg` (décision du 01/10/2026) |
| `--color-ink` | `#0B0E13` | texte principal |
| `--color-ink-2` | `#2F3642` | texte secondaire, navigation inactive |
| `--color-muted` | `#5B6472` | libellés, métadonnées |
| `--color-accent` | `#0036B3` | boutons principaux, navigation active, sélection, ma ligne, mon point, logo, contour du focus. **v1.2** : couleur choisie par l'utilisateur le 02/10/2026, à la place du `#1F5BFF` de la maquette |
| `--color-accent-ink` | `#FFFFFF` | texte sur l'accent |
| `--color-accent-text` | `#0036B3` | liens et chiffres en accent sur fond clair. v1.2 : la même valeur que l'accent, assez foncé pour le texte ; la maquette avait besoin d'une variante plus foncée (`#1A4FE0`) |
| `--color-accent-soft` | `rgb(0 54 179 / 0.12)` | fond de ma ligne au classement, halo de mon point |
| `--color-hot` | `#D2352B` | urgence (< 48 h), « À faire », moyenne de l'équipe, actions dangereuses |
| `--color-warn` | `#A15C00` | « Enregistré » |
| `--color-up` | `#15803D` | montée ▲, étiquette « Résultat » |
| `--color-down` | `#C8321F` | descente ▼ |
| `--color-dots` | `#A3ABB8` | points des autres joueurs sur le graphique |

**Contrastes vérifiés** : `ink`, `ink-2`, `muted` et `accent-text` sur `surface` et sur `bg` ≥ 4,5:1 ; `accent-ink` sur `accent` ≈ 9,6:1 (v1.2, `#0036B3` ; 5,2:1 avec l'ancien bleu). Pour `#0036B3`, calculé le 02/10/2026 : 9,6:1 sur `surface`, 8,4:1 sur `bg`, 7,6:1 environ sur la ligne teintée `accent-soft`. L'agent de l'É8c le revérifie avec axe et par une capture avant et après. Le maillot « bleu » des avatars (`#1F5BFF`, §8.2) ne change pas : c'est une couleur d'avatar, pas l'accent du site. Les fichiers de la maquette B5 restent tels quels (archive). Tout nouveau couple de couleurs doit atteindre 4,5:1 (3:1 pour un texte ≥ 24 px ou ≥ 18,66 px en gras). Sur le fond de page `bg`, `hot` (4,3:1) et `up` (4,4:1) restent sous 4,5:1 : ces textes y sont posés sur un fond blanc (bouton `danger`, pastilles de statut, messages de `FormMessage`, « Annulée le … » de l'admin) ou écrits en grand texte (compte à rebours compact).

**Typographie** (`next/font/google`) :

- **Barlow Condensed**, graisses 600, 700 et 800, style normal et italique 800 (variable `--font-display`). Utilisée pour le logo, la navigation, les titres, les boutons, les libellés en capitales et **tous les chiffres mis en avant** (compteurs, points, rangs, valeurs). Généralement en capitales, espacement de 0,04 à 0,08 em, chiffres tabulaires (`tabular-nums`).
- **Barlow**, graisses 400, 500, 600 et 700 (variable `--font-sans`), pour tout le texte courant.

| Rôle | Police | Taille, graisse |
|---|---|---|
| Titre de page (h1) | display, capitales | 44 px, 800, interligne 1 |
| Titre de section (h2) | display, capitales | 26 px, 800 |
| Titre de question dans une carte (h3) | sans | 18 px, 600 |
| Grand titre de question (page détail) | display, capitales | 32 px, 800 |
| Texte courant | sans | 15 à 16 px, 400 |
| Métadonnées | sans | 13 à 14 px, `muted` |
| Bouton | display, capitales | 17 à 18 px, 800, espacement 0,06 em |
| Grand chiffre (tuile) | display | 60 px, 800 |
| Valeur de résultat | display | 40 px, 800 |
| Saisie du prono | display | 36 px, 700 |

**Rayons** : étiquettes 4 px ; boutons 6 px ; champs et encarts 8 px ; cartes 10 px ; pastilles de statut en capsule 99 px.

**Espacements** :
- largeur de contenu 1 184 px (1 280 px moins 2 × 48 px de marge), centrée ;
- marge latérale de 48 px (16 px sous 1 024 px) ;
- espacement vertical entre blocs de 24 px et entre colonnes de 16 px ;
- intérieur des cartes de 20 à 26 px.

**Focus clavier** : contour de 2 px `accent`, décalé de 2 px, sur tout élément interactif (`:focus-visible`).

**Icônes** (`lucide-react`, trait de 2 à 2,4 px) :
- `Target` : logo et « Dans le mille » ;
- `Clock` : compte à rebours ;
- `Lock` : validé ;
- `Megaphone` : annonce ;
- `ExternalLink` : lien BI ;
- `Award` : badges ;
- `Crown` : champion ;
- `Trophy` : palmarès ;
- `LogOut`, `KeyRound`, `Ban`, `Copy`, `Pencil`, `Trash2`, `Plus`, `Check`, `X`, `TriangleAlert`, `Info`, `Menu` ;
- v1.2 : `CalendarClock` (prolongation), `Smile` (bouton de la palette d'emojis), `MessageCircle` (chat, message de résultat).

Aucun emoji dans l'interface, **sauf dans le chat** (v1.2) : messages des joueurs et palette d'emojis. Ils s'affichent avec la police d'emojis du système.

### 8.2 Composants

Les tailles et styles proviennent de la maquette (`docs/design/maquette-b5/Stade.dc.html`).

- **AppHeader** :
  - hauteur 72 px, fond `bg`, bordure basse `line` ;
  - logo : carré de 34 px `accent`, légèrement penché (`skewX(-8deg)`), icône `Target` en `accent-ink`, suivi du nom du site (`APP_NAME`, `src/lib/app.ts`) en display 19 px 800 italique et capitales, sur deux lignes (« LES PETITS PRONOS / DE LA PROMO », `APP_NAME_LINES`) : en une ligne de 26 px, le nom ne tenait pas à 390 px (É8b) ;
  - navigation : Accueil, Mes pronos, Classement, Chat (É8d), Palmarès, Règlement, en display 17 px 700 capitales, bloc arrondi de 6 px ; lien actif sur fond `accent` avec texte `accent-ink`, les autres en `ink-2`, survol sur fond `chip`. « Chat » porte une pastille avec le nombre de messages non lus (« 9+ » au-delà de 9 ; nom accessible « Chat, 3 messages non lus »), calculée au rendu de la page (`getUnreadChatCount`), sans interrogation périodique hors de `/chat` ;
  - à droite : lien « ADMIN » pour les admins seulement, avatar de 36 px, nom, et un menu (Mon profil, Se déconnecter).
- **AdminNav** : sous-navigation du back-office, avec Tableau de bord, Questions, Joueurs, Catégories, Saisons et lots, Annonces.
- **AnnouncementBar** : carte `surface`, étiquette « ANNONCE » sur fond `accent`, texte en `ink-2` 15 px, date relative en `muted` 13 px (« il y a 2 h »).
- **StatTile** : largeur 200 px, libellé en capitales `muted`, grand chiffre display 60 px, sous-ligne (évolution en `up`, ou texte `muted`).
- **SegmentedProgress** : un segment par question ouverte (hauteur 10 px, espacés de 6 px), pleins en `accent`, vides en `line`. Au-delà de 20 questions, une barre continue.
- **CategoryChip** : display 14 px 700 capitales, fond `chip`, texte `ink-2`. **NewChip** : « NOUVEAU » sur fond `accent`, texte `accent-ink` ; variante « PROLONGÉE POUR TOI » (v1.2), avec l'icône `CalendarClock`, pour une question ouverte pour moi par une prolongation.
- **StatusChip** (largeur 112 px, display 15 px 800 capitales) :
  - « À faire » : bordure et texte `hot` ;
  - « Enregistré » : bordure et texte `warn` ;
  - « Validé » : fond `accent`, texte `accent-ink`, icône `Lock`.
- **Countdown** (client) :
  - 4 cases de 44 × 44 px (J, H, MIN, S), fond `bg`, bordure `line`, chiffres display 26 px 700, libellés 10 px `muted` ;
  - en dessous de 48 h : bordure et chiffres `hot` ;
  - variante compacte en ligne : « 3 j 07:45:10 » ;
  - après la clôture : « CLÔTURÉ » ;
  - `role="timer"` et un `aria-label` lisible.
- **QuestionCard** : catégorie, pastille Nouveau (ou « PROLONGÉE POUR TOI »), titre, métadonnées (« Nombre · coef. ×3 » ; pour un choix, v1.2 : « Choix · coef. ×2 · mauvaise réponse : 200 de malus »), compte à rebours (jusqu'à ma date limite si ma prolongation court), statut, bouton (« Pronostiquer », « Modifier » ou « Voir »).
- **PredictionForm** :
  - **nombre** : champ de 62 px de haut, bordure de 2 px `accent`, fond `bg`, valeur en display 36 px, unité en suffixe `muted` ;
  - **choix** : tuiles-boutons radio (bordure `line-strong`, sélection : bordure de 2 px `accent` et fond `accent-soft`) ; le oui/non affiche deux grandes tuiles ; rappel « Mauvaise réponse : n de malus » (v1.2) ;
  - ~~Juste Prix~~ : supprimé en v1.2 (étiquette et rappel retirés) ;
  - **joker** : case dans un encadré en pointillés, « JOKER ÷2 » en `accent-text` (v1.2 ; « JOKER ×2 » avant), avec « Divise ton malus par deux » et « n restant(s) cette saison ». Désactivé s'il n'en reste plus. **Absent si la saison de la question n'autorise pas les jokers** (v1.2). La case pose ou retire le joker aussitôt (`setJoker`), et reste grisée avec « Enregistre d'abord ton prono. » tant qu'aucun prono n'est enregistré (décision du 30/09/2026) ;
  - boutons « ENREGISTRER » (secondaire) et « VALIDER » (principal) ;
  - note « Enregistré le … Une fois validé, ton prono est définitif. » ;
  - une fois validé : champ en lecture seule, statut Validé, plus de boutons.
- **ConfirmDialog** : élément natif `<dialog>`.
  - titre « Valider ton prono ? » ;
  - valeur formatée en grand (« 2 450 candidatures » ou le libellé de la réponse), suivie de « Joker posé » le cas échéant ;
  - texte « Une fois validé, tu ne pourras plus le modifier. » ;
  - boutons « Annuler » et « Valider définitivement » ;
  - le focus va sur « Annuler », Échap ferme la fenêtre.
- **HelpPanel** « POUR T'AIDER » : lien vers le tableau BI (ouverture dans un nouvel onglet, `rel="noopener noreferrer"`), « L'an dernier » en display 34 px, indice. Masqué si les trois champs sont vides.
- **StandingsTable** :
  - lignes sur fond `raised` : rang en display 24 px 800 (`accent-text` pour le 1er), avatar de 32 px, nom, évolution (▲n `up`, ▼n `down`, « = » `muted`, rien si nulle), malus en display 22 px (v1.2 : colonne « MALUS », du plus petit au plus grand ; « points » avant) ;
  - ma ligne : bordure de 1,5 px `accent` et fond `accent-soft` ;
  - page complète : colonnes « Dans le mille » et « Questions jouées » en plus.
- **ResultPanel** :
  - tuiles « RÉEL » (fond `ink`, texte `bg`), « MÉDIANE » et « MOYENNE » (fond `raised`, moyenne en `hot`) ;
  - StripChart ;
  - bandeau « Ton prono » (fond `accent`, texte `accent-ink`). v1.2 : écart brut (avec l'écart relatif en petit), coefficient, joker « ÷2 » le cas échéant, et malus en display 44 px. Sans prono : « Pas de prono : malus du pire prono », avec le malus d'absence ;
  - badges gagnés sur cette question.
- **StripChart** :
  - hauteur 112 px, axe `line` de 2 px ;
  - valeur réelle : trait `ink` de 2 px avec l'étiquette « RÉEL 250 » ;
  - moyenne : pointillés `hot` ;
  - points de 12 px en `dots` ; le mien fait 16 px en `accent`, avec un halo de 4 px `accent-soft` et l'étiquette « TOI » à côté (et non au-dessus, comme sur la maquette : elle cachait un point ; §5.7) ;
  - graduations en `muted` 12 px ;
  - légende sous le graphique.
  - Accessibilité : `<figure>` avec `<figcaption>`, et un tableau des pronos disponible sous le graphique pour les lecteurs d'écran.
- **ChoiceDistribution** : barres horizontales, une par réponse, avec pourcentage et nombre ; la bonne réponse est marquée après résolution.
- **BadgeList** : capsules ; badge obtenu en bordure et texte `accent-text` avec son compteur « ×2 », badge non obtenu en `line` et `muted`.
- **Avatar** : 16 maillots SVG dessinés dans `src/components/avatars/` (8 couleurs × 2 motifs), avec les initiales du joueur en display.
  - Couleurs : marine `#1E3A8A`, bleu `#1F5BFF`, cyan `#0891B2`, vert `#15803D`, jaune `#EAB308` (initiales en `ink`), orange `#EA580C`, rouge `#D2352B`, violet `#7C3AED` (initiales en blanc).
  - Motifs : uni, rayé.
  - Clés : `maillot-<couleur>-<uni|raye>`.
  - Avatar par défaut à l'inscription : empreinte de l'identifiant utilisateur modulo 16.
- **Button** : variantes `primary` (accent), `secondary` (bordure `line-strong`), `danger` (bordure et texte `hot`), `ghost` ; tailles `md` (40 px) et `lg` (48 px) ; état « en cours » avec texte « … » et bouton désactivé.
- **Field** : libellé au-dessus, champ de 44 px, bordure `line-strong` passant à `accent` au focus, message d'erreur en `hot` sous le champ (`aria-describedby`).
- **Tabs** : liens avec le compteur (« À FAIRE (3) »).
- **EmptyState** : icône, phrase, action éventuelle.
- **Footer** : « Les petits pronos de la promo · Saison 2026-2027 » (nom de la saison courante, rien s'il n'y en a pas) et liens Règlement, Lots, Palmarès.
- **ExtensionDialog** (É8c, back-office) : `<dialog>` « Prolonger pour <nom> », champ date-heure (heure de Paris), prérempli 48 h plus tard à l'heure pile, et rappel « Le joueur ne verra pas les pronos des autres avant d'avoir répondu. Préviens-le toi-même. » ; boutons « Annuler » et « Prolonger ».
- **Chat** (É8d) :
  - `ChatRoom` (client) : liste et interrogation périodique (§5.15) ;
  - `ChatMessage` : avatar de 32 px, nom relié au profil, heure (« à 14 h 32 »), texte en `white-space: pre-wrap` et coupure des mots longs ; bouton « Supprimer le message » (icône `Trash2`, confirmation) si `canDelete` ; « Message supprimé. » en `muted` italique ;
  - message de résultat : carte `accent-soft` avec l'icône `MessageCircle`, le texte et le lien « Voir la question » ;
  - `ChatComposer` : zone de texte libellée « Ton message », compteur « n / 500 », bouton `Smile` « Ajouter un emoji » (`aria-expanded`), bouton « ENVOYER ». Entrée envoie, Maj + Entrée va à la ligne (rappel affiché) ; bouton désactivé pendant l'envoi ;
  - `EmojiPalette` : grille de 8 colonnes des 48 emojis de `src/lib/chat/emojis.ts`, chaque emoji est un `<button>` dont le nom accessible est son nom français. Un clic insère l'emoji à la position du curseur et rend le focus à la zone de texte ; Échap ferme la grille ; navigation au clavier.

### 8.3 Écrans

Tous les écrans ont la même base : l'en-tête, le contenu centré de 1 184 px, puis le pied de page.

**`/connexion`**
- Carte centrée de 420 px, logo au-dessus.
- Champs : email, mot de passe. Bouton « SE CONNECTER ». Lien « Créer mon compte ».
- Texte d'aide : « Mot de passe oublié ? Demande à l'admin un mot de passe provisoire. »
- Erreurs :
  - « Email ou mot de passe incorrect. » ;
  - « Trop de tentatives. Réessaie dans une minute. » ;
  - compte désactivé : « Ton compte est désactivé. Contacte l'admin. »

**`/inscription`**
- Champs : email, nom affiché (« Ton prénom, tel que les autres le verront »), mot de passe, confirmation.
- Bouton « CRÉER MON COMPTE », puis redirection vers l'accueil.
- Erreurs du §6.2.

**`/` Accueil**, dans l'ordre de la maquette :
1. Annonces (jusqu'à 3).
2. Rangée de bienvenue : « SALUT <NOM> », « Encore n pronos à valider sur les m questions ouvertes », barre de progression, puis les tuiles Position, Malus (v1.2, « Points » avant) et Jokers. Position vaut « — » avec « Après le premier résultat » s'il n'y a pas encore de classement. La tuile Jokers disparaît si la saison courante n'autorise pas les jokers (v1.2).
3. Deux colonnes (8/12 et 4/12) :
   - « CLÔTURE IMMINENTE » : les 5 prochaines clôtures (QuestionCard) et un lien « Les n questions ouvertes » ;
   - classement : top 6, plus ma ligne si je suis au-delà, et un lien vers le classement complet.
4. « DERNIER RÉSULTAT » : ResultPanel compact de la dernière question résolue. Si aucune : EmptyState « Premier résultat attendu en novembre ».

**`/pronos` Mes pronos**
- Titre « MES PRONOS » et onglets « À faire (n) », « Enregistrés (n) », « Validés (n) », « Tous », calculés sur les questions ouvertes. « Tous » s'ouvre par défaut : une question enregistrée ne disparaît pas de l'écran pendant la saisie (décision du 30/09/2026).
- Une ligne par question, dans l'ordre des clôtures : catégorie, titre, compte à rebours compact, PredictionForm en ligne, et un bouton « Pour t'aider » qui déplie le HelpPanel.
- Bandeau fixe en bas : « n / m validés ».
- EmptyState si aucune question n'est ouverte.

**`/questions` Questions**
- Onglets : Ouvertes, En attente du résultat, Résolues, Annulées. Une question annulée avant son ouverture n'a jamais été vue des joueurs : elle reste invisible, comme une question programmée (404, absente de « Annulées » ; décision du 30/09/2026).
- Cartes avec statut, date de clôture ou de résultat, et mon malus une fois la question résolue.

**`/questions/[id]` Détail**
- En-tête : catégorie, coefficient, malus d'une mauvaise réponse (choix, v1.2), compte à rebours ou état, titre en display 32 px, description, « Source : … ».
- **Ouverte pour moi** (ouverte, ou clôturée avec ma prolongation en cours) : PredictionForm (ou le prono validé en lecture seule) et HelpPanel en deux colonnes. Pendant ma prolongation : pastille « PROLONGÉE POUR TOI » et compte à rebours jusqu'à ma date limite.
- **Clôturée, j'ai un prono** : mon prono, le tableau des pronos visibles (joueur, valeur, joker), la sagesse de la foule et le StripChart (ou ChoiceDistribution), sans valeur réelle. Mention « Résultat attendu le … ». Si une prolongation court : « Prolongation en cours pour n joueur(s), jusqu'au … : son prono s'affichera ensuite. » (§6.6).
- **Clôturée, je n'ai pas de prono** (v1.2) : « Tu n'as pas pronostiqué cette question : les pronos s'afficheront au résultat. », sans tableau ni graphique, et la mention « Résultat attendu le … ».
- **Résolue** : ResultPanel complet ; tableau avec prono, écart, joker et malus par joueur, trié du plus petit malus au plus grand ; les joueurs du classement sans prono figurent en bas, « Pas de prono », avec leur malus d'absence (v1.2) ; « Résultat corrigé le … » le cas échéant.
- **Annulée** : bandeau « Question annulée : aucun point n'est attribué et les jokers sont rendus. » Les pronos ne sont pas affichés.
- **Brouillon ou programmée** : page 404 pour un joueur.

**`/classement`**
- Sélecteur de saison, StandingsTable complète.
- Note (v1.2) : « Le moins de malus est en tête. Départage : nombre de Dans le mille, puis écart moyen le plus faible. »
- EmptyState « Le classement démarre au premier résultat. »
- Précisions de l'É7 : la saison choisie passe dans l'adresse (`?saison=<id>`, une saison inconnue donne la saison par défaut) ; le nom d'un joueur mène à son profil sur la même saison ; pour une saison proclamée, un lien renvoie au palmarès (le classement reste recalculé, le palmarès figé).
- **Sur téléphone (sous 640 px)**, la liste compacte de l'accueil remplace le tableau : rang, joueur, évolution et malus, les noms menant aux profils sur la même saison. Le tableau aurait poussé les points hors de l'écran. « Dans le mille » et « Questions jouées » restent sur le profil de chacun (décision du 01/10/2026).

**`/joueurs/[id]` Profil public**
- En-tête : avatar de 64 px, nom, rang et malus de la saison affichée.
- Tuiles : écart moyen, « Dans le mille », pronos joués.
- BadgeList (les 6 badges).
- Historique des questions résolues : question, prono, réel, écart, malus, joker. v1.2 : les questions sans prono y figurent aussi, « Pas de prono », avec le malus d'absence, pour que le total s'explique.
- Précisions de l'É7 : la saison affichée est la saison par défaut (§5.6) ou celle de `?saison=<id>`, avec le même sélecteur que `/classement` ; tuiles et historique portent sur cette saison, les badges sur toutes les saisons. Un compte désactivé ou anonymisé garde son profil, marqué « (inactif) ».

**`/profil` Mon compte**
- Nom affiché.
- Galerie d'avatars : 16 tuiles radio.
- Changement de mot de passe : actuel, nouveau, confirmation.
- Bouton « Se déconnecter ».

**`/lots`** : lots de la saison courante (rang et description). EmptyState « Les lots seront annoncés bientôt. » Lien vers le règlement.

**`/reglement`** : page générée à partir des constantes (§5.5), dont les exemples sont calculés par `scoreQuestion`. Sections (v1.2) :
- principe : le moins de malus gagne ;
- types de questions : nombre, choix, oui/non ;
- enregistrement, validation et clôture ;
- malus d'une question à nombre : l'écart brut, sans plafond, avec l'exemple 500 et 1 500 pour 1 000, et la faute de frappe ;
- « Dans le mille » ;
- questions à choix : le malus d'une mauvaise réponse, fixé sur chaque question ;
- coefficient ;
- jokers : ÷2, selon la saison (« Cette saison : jokers autorisés » ou « pas de jokers ») ;
- pas de prono : le malus du pire prono ;
- prolongation pour un absent, et pourquoi on ne voit pas les pronos des autres sans avoir pronostiqué ;
- départage ;
- cas particuliers (cahier des charges §5.7) ;
- chat : « Ne donne pas ton prono dans le chat avant la clôture. » (É8d) ;
- saisons et palmarès ;
- lots.

Les sections « barème (tableau des paliers) », « bonus podium » et « Juste Prix » disparaissent.

**`/palmares`** : pour chaque saison proclamée, du plus récent au plus ancien, le podium (3 premiers, avec leurs avatars, et leur malus), puis le classement complet dans une section dépliable et les lots attribués. EmptyState tant qu'aucune saison n'est proclamée.

**`/chat`** (É8d, §5.15)
- Titre « CHAT » ; sous-titre « Le chat de toute l'équipe. Les nouveaux messages arrivent toutes les 10 secondes environ. »
- Fil :
  - `role="log"` ; seuls les messages arrivés après le chargement sont annoncés (`aria-live="polite"`) ;
  - le plus récent en bas ;
  - séparateurs de jour : « Aujourd'hui », « Hier », « mer. 21 oct. », avec l'année si besoin ;
  - au chargement, défilement jusqu'en bas ; un nouveau message fait défiler seulement si l'on était déjà en bas, sinon un bouton « Nouveaux messages » apparaît ;
  - en haut, le bouton « Messages plus anciens » charge les 50 précédents.
- Champ d'écriture en bas de page (fixe sur téléphone), palette d'emojis.
- EmptyState « Aucun message pour l'instant. Lance la discussion ! »
- En cas d'erreur réseau, nouvel essai au tour suivant ; au troisième échec d'affilée, « Connexion perdue, nouvel essai… » discret. Une réponse `401` renvoie vers `/connexion`.

**`/admin` Tableau de bord**
- « Questions ouvertes » : pour chacune, « validés x / N », la liste des joueurs qui n'ont pas validé (pour relancer à la main) et le lien vers la question.
- « À résoudre » : questions clôturées sans résultat, avec un bouton « Saisir le résultat ». Si une prolongation court, le bouton est désactivé, avec la raison (« Prolongation de <nom> jusqu'au … ») (v1.2).
- « Prolongations en cours » (v1.2) : question, joueur, date limite, état de son prono (à faire, enregistré, validé).
- « Prochaines ouvertures » : questions programmées.

**`/admin/questions`**
- Filtres : statut (brouillon, programmée, ouverte, clôturée, résolue, annulée), saison, catégorie.
- Tableau avec cases à cocher et actions groupées « Définir les dates » (fenêtre avec trois champs date-heure, heure de Paris) et « Publier ».
- Boutons « Nouvelle question » et « Dupliquer ».

**`/admin/questions/nouvelle` et `/admin/questions/[id]`**, formulaire en sections :
1. Question : type (Nombre, Choix, Oui/Non ; « Nombre Juste Prix » disparaît en v1.2), catégorie, énoncé, description, unité ou réponses (ajout, suppression, ordre), malus d'une mauvaise réponse (choix et oui/non, v1.2, avec l'aide du §5.11), coefficient.
2. Source de la valeur réelle.
3. Pour t'aider : lien BI, valeur de l'an dernier, indice.
4. Dates : ouverture, clôture, résultat prévu, avec la mention « heure de Paris ».
5. Actions : Enregistrer, Publier, Annuler la question (confirmation), Supprimer (brouillon sans prono).

Les champs verrouillés (§5.11) sont désactivés, avec la raison affichée. Dans la page d'une question existante :
- **Suivi** :
  - colonnes : joueur, état, date de validation, et, depuis la v1.2, prolongation (« jusqu'au … ») ;
  - bouton « Déverrouiller » si la question est ouverte pour ce joueur et son prono validé ;
  - bouton « Prolonger » (v1.2, ExtensionDialog) pour un joueur sans prono, tant que la question est ouverte ou clôturée sans résultat, sauf sur sa propre ligne ;
  - « Changer la date » et « Annuler la prolongation » (confirmation) pour une prolongation en cours ;
  - valeurs affichées selon le §6.6 ;
- **Résultat** : si la question est clôturée ou résolue ; désactivé, avec la raison, tant qu'une prolongation court ;
- **Historique** : les événements, sans valeurs avant la clôture (§6.6).

**`/admin/joueurs`**
- **Liste blanche** : zone de texte pour l'ajout en série, liste avec « Compte créé : oui / non » et bouton de retrait.
- **Comptes** : nom, email, rôle, statut, dernière visite. Actions : Passer admin ou joueur, Désactiver ou Réactiver, Mot de passe provisoire, Anonymiser.

**`/admin/categories`** : liste, ajout, renommage, archivage (une catégorie archivée disparaît des choix mais reste sur ses questions).

**`/admin/saisons`**
- Formulaire « Nouvelle saison » : nom (prérempli par `suggestedSeasonLabel`), date de début, avec la mention « à 0 h, heure de Paris » (v1.1, §5.13), et case « Jokers autorisés (2 par joueur) », cochée par défaut (v1.2).
- Pour chaque saison, de la plus récente à la plus ancienne : nom, dates (« du 28 sept. 2026 au 5 sept. 2027 », ou « depuis le … » pour la dernière), « En cours » pour la saison courante, nombre de questions (résolues / total), jokers (« autorisés » ou « non », v1.2), état de la proclamation ; boutons Modifier (nom, date de début, jokers) et Supprimer (confirmation), avec la raison quand ils sont refusés.
- Rappel de créer la saison suivante (§5.13) ; invitation à créer la première saison s'il n'y en a aucune.
- Éditeur de lots (rang et description, ordre).
- Bouton « Proclamer le classement final », actif seulement si les conditions sont remplies (sinon, la raison est affichée), avec une confirmation qui rappelle que l'action est irréversible.

**`/admin/annonces`** : liste, création, modification, suppression (500 caractères au plus, compteur affiché).

**Pages d'erreur** :
- 404 : « Cette page n'existe pas. » et « Retour à l'accueil » ;
- erreur : « Une erreur est survenue. Réessaie. » et « Réessayer » (`error.tsx`, et `global-error.tsx` pour une erreur du layout racine, qui a son propre document ; É8).

**Chargement** : `loading.tsx` avec des squelettes gris `chip` sur l'accueil, `/pronos`, `/classement`, `/questions/[id]` et `/chat` (É8d) (composants de `src/components/ui/Skeleton.tsx`, annoncés « Chargement… » aux lecteurs d'écran). Mise en œuvre (É8) :
- un `loading.tsx` couvre toutes les pages placées sous lui : l'accueil est donc rangé dans le groupe de routes `(jeu)/(accueil)`, pour que son squelette ne s'affiche pas en allant sur `/profil` ou `/lots` ;
- une page qui part en streaming derrière son squelette ne peut plus changer son code HTTP : `/questions/[id]` répondrait 200 au lieu de 404 pour une question programmée. Son `layout.tsx` fait donc le contrôle avant le squelette (`isQuestionVisible`, une requête légère), et appelle `notFound()`.

### 8.4 Responsive

- La cible est l'ordinateur, conçue à 1 280 px de large.
- En dessous de 1 024 px :
  - une seule colonne ;
  - la navigation se replie dans un bouton « Menu » (`<details>` ou `<dialog>`) ;
  - les tuiles passent en grille de 2 colonnes ;
  - les tableaux défilent horizontalement dans leur conteneur (`TableScroll`) : il est `relative`, pour que les textes réservés aux lecteurs d'écran ne débordent pas de la page, et devient une région nommée accessible au clavier tant que son tableau dépasse (É8) ; seul `/classement` affiche à la place la liste compacte, sous 640 px (§8.3) ;
  - le compte à rebours passe en version compacte.
- À 390 px de large : aucun défilement horizontal de la page, toutes les actions restent accessibles. Points relevés à l'É8 : un `<input>` ou un `<fieldset>` impose sa largeur propre à son conteneur (`w-0` ou `min-w-0` le libère), et les tuiles « Réel, médiane, moyenne » passent sur deux lignes. Relevé à la recette (R-01) : une grille qui ne définit ses colonnes qu'à partir d'une largeur (`lg:grid-cols-12`) a, en dessous, une colonne implicite `auto`, qui prend la largeur du plus long nom ; toute grille de mise en page porte donc `grid-cols-1` (`minmax(0, 1fr)`). `e2e/responsive.spec.ts` vérifie les pages avec un nom de 30 caractères.
- v1.2 : `/chat` à 390 px (champ d'écriture et palette visibles, longs mots coupés). L'onglet « Chat » ajouté à la navigation (É8d) allonge l'en-tête : vérifier aussi 1 024 px, où l'en-tête de l'admin dépassait déjà de 8 px (point ouvert de l'É8b, voir `avancement.md`).

### 8.5 Accessibilité

- `<html lang="fr">`, un seul `h1` par page, titres hiérarchisés.
- Tous les champs ont un `<label>`, les erreurs sont reliées par `aria-describedby`, les résultats d'actions annoncés par `aria-live`.
- Un message de résultat décrit la dernière action : il disparaît dès qu'une autre action commence sur la page (envoi d'un formulaire, ou clic sur un bouton hors de sa zone ; `useStaleResult`, appliqué par `useFormAction` et par les composants d'admin). Un message venu de l'adresse (`?creee=1`) quitte l'adresse une fois affiché (`DropSearchParams`). Décision du 01/10/2026 (recette, R-04).
- Vrais `<button>` et `<a href>` ; jamais un `onClick` sur une `div`.
- Navigation complète au clavier, focus visible (§8.1), ordre de tabulation logique, `<dialog>` avec le focus piégé.
- Les couleurs ne portent jamais seules l'information : ▲▼ et libellés pour l'évolution, textes pour les statuts.
- Contrôle automatique avec axe (§9.4) : aucune violation « serious » ou « critical ».

### 8.6 Textes et ton

- Tutoiement, français, phrases courtes.
- Vocabulaire : **pronostic, prono, malus (« points de malus »), joker, classement, prolongation**. Jamais « pari », « parier », « mise », « miser », « parieur » (vérifié par un test, §9.3). Depuis la v1.2, on ne parle plus de « points » gagnés : un malus s'affiche en nombre positif avec le mot « malus » (« 250 de malus », colonne « MALUS »), jamais avec un signe moins.
- Nombres au format français (« 2 450 »), décimales avec une virgule. Les milliers sont séparés par une espace insécable ordinaire (U+00A0) : l'espace fine que donne `Intl` ne se voyait pas dans les polices du site (recette, R-07).
- Dates : « mer. 21 oct. à 18 h », « à 18 h 30 » quand il y a des minutes ; avec l'année quand la date n'est pas de l'année en cours, heure de Paris (« sam. 29 nov. 2025 à 23 h » ; `formatDateTime(date, now)`, recette R-08) ; date relative pour les annonces.
- Une raison après un deux-points commence par une minuscule (« pas publiée : la clôture est déjà passée. » ; `lowerFirst`, recette R-06).
- Tous les textes de l'interface sont en français ; le code, les identifiants et les messages de commit sont en anglais.

---

## 9. Stratégie de test

### 9.1 Niveaux

| Niveau | Outil | Dossier | Cible |
|---|---|---|---|
| Unitaire | Vitest | `tests/unit/` | `src/lib/game/*`, `src/lib/format.ts`, validations Zod |
| Intégration | Vitest et PGlite | `tests/integration/` | services, lectures et visibilité, hooks d'authentification, migrations, seed |
| Bout en bout | Playwright | `e2e/` | parcours réels dans le navigateur, sur `next start` avec PGlite |
| Accessibilité | `@axe-core/playwright` | `e2e/a11y.spec.ts` | pages principales |
| Fumée en production | Playwright | `e2e/prod-smoke.spec.ts` | `/connexion` et `/api/health` en production, en lecture seule, lancé à la main avec `BASE_URL`. Avec `BASE_URL`, `playwright.config.ts` ne lance que ce fichier, sans serveur local ; sans elle, `npm run test:e2e` l'exclut (écrit à l'É8b) |

### 9.2 Outils de test partagés (`tests/helpers/`)

- `createTestDb()` : PGlite en mémoire, migrations appliquées.
- `makeClock(iso)` : fabrique de dates (`at('+2h')`, `at('-1d')`).
- Fabriques : `createUser(db, { role, email, name })`, `createQuestion(db, overrides)`, `createPrediction(db, overrides)`, avec des valeurs par défaut valides.
- `createTestAuth(db, env)` : instance Better Auth branchée sur la base de test, pour les hooks d'inscription ; `authRequest()` construit une requête HTTP pour tester la limitation des tentatives.

### 9.3 Tests transverses obligatoires

- **Vocabulaire** : un test parcourt `src/**/*.tsx` et `src/lib/game/constants.ts` et échoue s'il trouve, en tenant compte de la casse, `/\b(pari|parier|parieur|mise|miser)\b/` ou `/\bparis sportifs?\b/i`. « Paris » avec une majuscule, la ville, reste autorisé.
- **Pas de `Date.now()` ni de `new Date()` sans argument dans `src/lib/game/`** : un test lit les fichiers et échoue s'il en trouve.
- **Matrice d'autorisation** (§6.5) : pour chaque service d'écriture, un test par profil (anonyme, joueur, désactivé, admin) vérifie le code de retour attendu.
- **Confidentialité** : en bout en bout, la page d'une question ouverte ne contient jamais, dans son HTML, la valeur d'un prono d'un autre joueur (valeur témoin du seed : `987654`). Depuis la v1.2 (É8c), deux cas de plus :
  - la page d'une question clôturée sans résultat ne contient pas la valeur témoin `876543` pour un joueur qui n'a pas pronostiqué cette question, ni pour le joueur qui y a une prolongation ;
  - le prono d'un joueur en prolongation (valeur témoin saisie par le test) n'apparaît pas dans le HTML vu par un autre joueur, ni dans le back-office.
- **Chat** (É8d) : `/api/chat` répond `401` sans session, et ne renvoie jamais de texte de message supprimé.

### 9.4 Bout en bout

- `scripts/e2e-prepare.ts` supprime `.pglite-e2e/`, applique les migrations, lance le seed en mode `e2e`, puis ferme PGlite **avant** le démarrage du serveur (une seule connexion PGlite à la fois).
- Un seul worker, tests indépendants entre eux : chaque test qui écrit utilise ses propres comptes et questions du seed.
- Sélecteurs par rôle et par libellé (`getByRole`, `getByLabel`). `data-testid` seulement pour les zones sans rôle (compte à rebours, graphique).
- Les tests importent `test` depuis `e2e/fixtures.ts` : chaque test y reçoit sa propre adresse client (`x-forwarded-for`), sinon la limitation des tentatives (5 connexions par minute et par adresse) bloquerait la suite. `signIn()` et `signOut()` passent par l'interface. Un test qui modifie un compte du seed (nom, mot de passe) le remet dans son état initial.
- Accessibilité : `AxeBuilder` sur `/connexion`, `/`, `/pronos`, `/questions/<résolue>`, `/classement`, `/profil`, `/admin`, `/admin/questions/<id>`, et depuis la v1.2 `/questions/<clôturée, sans prono>` et `/chat` (palette ouverte comprise). Aucune violation `serious` ni `critical`. Depuis l'É8, aussi à 390 px sur les pages à tableaux (zones défilantes accessibles au clavier) ; après une navigation côté client, attendre le `<title>` avant axe (Next l'ajoute un peu plus tard).
- Responsive (`e2e/responsive.spec.ts`, É8) : à 390 × 844, pas de défilement horizontal sur toutes les pages du joueur et de l'admin ; menu, champ du prono et boutons visibles ; liste compacte de `/classement`. En-têtes (`e2e/headers.spec.ts`) : ceux du §3.3 sur les pages publiques, connectées, l'API et les redirections, `robots.txt`, balise `noindex`.

### 9.5 Seuils de couverture (`npm run test:coverage`)

- `src/lib/game/**` : 95 % des lignes, 90 % des branches.
- `src/lib/services/**` : 80 % des lignes.

### 9.6 Données de seed (`scripts/seed.ts`)

Modes : `dev` (branche Neon `dev`) et `e2e` (PGlite). Le script **efface toutes les données** (application et comptes) puis insère le jeu ci-dessous.

**Garde-fous** : il refuse de s'exécuter si `VERCEL_ENV === 'production'` ou si `app_meta.environment = 'production'` dans la base visée. Il affiche le nom d'hôte de la base (jamais l'URL complète) et demande de taper `oui`, sauf en mode `e2e` ou avec l'option `--yes` (à utiliser par l'agent, dont le terminal n'est pas interactif : `npm run db:seed -- --yes`).

Toutes les dates sont relatives à `now`, pour que le jeu reste cohérent quel que soit le jour. Les questions passées de la saison courante doivent clôturer après son début : les écarts passés sont exacts (« il y a 3 jours ») sauf juste après le 1er octobre, où ils sont resserrés (décision du 30/09/2026). Les dates futures (« dans 6 jours ») sont toujours exactes, puisque la saison courante n'a pas de fin (v1.1).

Saisons (v1.1) : le seed crée lui-même trois saisons, l'ancienne, la précédente et la courante, qui commencent le 1er octobre (la courante est celle qui contient `now`) et portent les noms `AAAA-AAAA`. Il ne crée pas la saison suivante : la saison courante n'a pas de fin, comme en production tant que l'admin n'a pas créé la suivante. L'ancienne saison, résolue mais pas proclamée, sert à essayer la proclamation (`e2e/results.spec.ts`, et l'utilisateur sur `dev`) ; ajoutée à l'É7 (décision du 30/09/2026).

| Élément | Contenu |
|---|---|
| Comptes (mot de passe `Test-1234!`) | `admin@example.test` (admin, nom « Admin »), `joueur1@` à `joueur8@example.test` (joueurs : Sarah, Julien, Inès, Camille, Thomas, Mehdi, Léa, Hugo), `desactive@example.test` (désactivé) |
| Liste blanche sans compte | `nouveau1@example.test` (test d'inscription). `nouveau2@example.test` n'y est pas : l'admin l'ajoute dans `e2e/auth.spec.ts` (décision du 30/09/2026) |
| Catégories | JPO, Candidatures, Intégration, Archivée (archivée) |
| Saison ancienne (É7) | pas proclamée, prête à l'être : 1 question résolue (JPO, valeur réelle 180) et 4 pronos |
| Saison précédente | proclamée, avec 2 questions résolues et un `season_standing` (palmarès) |
| Saison courante : programmée | 1 question (ouverture à +2 j) |
| Saison courante : ouvertes | 4 questions : nombre (clôture +1 j, urgente), un second nombre (+3 j ; c'était un Juste Prix jusqu'à la v1.1), choix à 3 réponses (+5 j), oui/non (+6 j). Pronos variés : enregistrés, validés, avec joker. Un autre joueur a la valeur témoin `987654` sur la première. |
| Saison courante : clôturées | 2 questions sans résultat, avec des pronos : « Studyrama » (résolue par `e2e/admin-questions.spec.ts`) et « webinaire » (aucun test ne la résout, É7). v1.2 : sur « webinaire », un joueur a la valeur témoin `876543`, un autre joueur n'a pas de prono et a une prolongation qui court jusqu'à +2 j (accordée par l'admin), et au moins un troisième joueur n'a ni prono ni prolongation (vue « Les pronos s'afficheront au résultat ») |
| Saison courante : résolues | 3 questions : un nombre qui reproduit les vecteurs P1 (rangs de proximité avec ex æquo), un nombre qui reproduit A1 (un joueur sans prono, un joker), un choix (malus d'une mauvaise réponse renseigné) ; résolues à des dates différentes, pour tester les flèches |
| Saison courante : autres | 1 question annulée avec un joker posé, 1 brouillon |
| Questions à choix (v1.2) | toutes avec un malus d'une mauvaise réponse (par exemple 50 et 100) |
| Jokers (v1.2) | autorisés dans les trois saisons |
| Annonces | 2 |
| Lots | 3 pour la saison courante |
| Visites | `joueur4` avec `last_seen_at` à −2 h, pour voir la pastille « Nouveau » sur une question ouverte à −1 h |
| Chat (É8d) | une dizaine de messages de plusieurs joueurs sur deux jours (avec des emojis), un message supprimé, un message de résultat pour une question résolue ; `chat_read` pour quelques comptes, pour voir la pastille des non lus |

Le choix des joueurs (prolongé, sans prono…) tient compte des états laissés par les tests de bout en bout (point ouvert n° 6 de `avancement.md` : Camille est réservée à la pastille « Nouveau »). Les tests d'intégration du classement calculent à la main, dans le test, le classement attendu pour ces données (malus, absents compris), et le comparent au résultat.

---

## 10. Sécurité et exploitation

- **En-têtes HTTP** : §3.3. **Indexation** : `robots.ts` interdit tout, et chaque page porte `noindex` (site privé).
- **Mots de passe** : hachés par Better Auth, jamais journalisés. Tentatives de connexion limitées (§6.1).
- **Entrées** : toutes validées par Zod côté serveur, même si le formulaire valide déjà.
- **Server Actions** : contrôle des droits dans chaque action et dans chaque service (§6.4).
- **Données sensibles** : les chiffres de l'école ne sont visibles qu'après connexion d'un compte de la liste blanche. Aucune page publique hormis `/connexion`, `/inscription` et `/api/health`, qui renvoie seulement `{ "ok": true }` ou `{ "ok": false }`.
- **Journaux** : `console.error` avec un code d'erreur et l'identifiant utilisateur, sans valeur de prono, sans texte de message du chat, sans donnée personnelle. Consultables dans les logs Vercel.
- **Chat** (É8d) : texte affiché échappé, liens non cliquables, 10 messages par minute au plus, contenu effacé à la suppression et à l'anonymisation (§5.15).
- **Sauvegarde** : restauration à un instant donné proposée par Neon (fenêtre selon l'offre gratuite). Pas d'export applicatif (écarté dans le cahier des charges).
- **Données personnelles** : email professionnel, nom affiché et, depuis l'É8d, messages du chat ; hébergement en Europe (Francfort) ; effacement par anonymisation (§6.3).
- **Offre gratuite de Vercel** : usage non commercial en principe, risque accepté par l'utilisateur (cahier des charges C11).

---

## 11. Plan de construction par étapes

Chaque étape se termine par des **critères de passage**. Ils sont tous obligatoires, et s'ajoutent à la non-régression : **tous les tests des étapes précédentes passent encore**.

Les étapes É1 à É8b sont faites. Elles décrivent ce qui a été construit avec le barème en points de la v1.1 (paliers, bonus podium, Juste Prix, « points » à l'écran). L'É8c le remplace par le malus : pour la règle actuelle, lire le §5, pas les tâches des étapes passées. Les tests de l'ancien barème sont remplacés à l'É8c par ceux du malus, parce que la règle change (décision de l'utilisateur) ; ce n'est pas un affaiblissement.

**Porte commune à toutes les étapes :**
- [ ] `npm run verify` passe (lint, types, tests unitaires et d'intégration, build).
- [ ] `npm run test:e2e` passe (à partir de l'étape 1).
- [ ] Les tests listés pour l'étape existent et passent.
- [ ] `avancement.md` est à jour (statut, date, interventions, décisions).
- [ ] Compte rendu présenté, validation de l'utilisateur obtenue (H-08).

| Étape | Titre | Date cible |
|---|---|---|
| É1 | Socle du projet | 30/09 |
| É2 | Hébergement et base de données | 01/10 |
| É3 | Données et moteur de règles | 02/10 |
| É4 | Comptes et accès | 05/10 |
| É5 | Back-office | 06/10 |
| É5b | Saisons gérées par l'admin (v1.1) | 02/10 |
| É6 | Parcours joueur | 08/10 |
| É7 | Résultats, classement, palmarès | 10/10 |
| É8 | Finitions et qualité | 12/10 |
| É8b | Changement du nom du site (v1.1) | 12/10, dès que le nouveau nom est choisi, et avant H-10 |
| É8c | Malus, jokers par saison, prolongations, couleur (v1.2) | 05/10 |
| É8d | Chat général (v1.2) | 07/10 |
| É9 | Recette et lancement | 13/10, lancement le 14/10 |

### É1 — Socle du projet

**Objectif** : un projet Next.js qui démarre, au style B5, avec toute la chaîne d'outils et de tests en place. Aucune base de données.

**Prérequis** : H-02 (feu vert sur ce document), H-01 (Node.js et Git).

**Branche** : `etape-01-socle`.

**Tâches**
1. Générer le projet avec `create-next-app` (TypeScript, App Router, Tailwind, ESLint, dossier `src/`, alias `@/*`) **dans un dossier temporaire hors du dépôt** : le dépôt contient déjà des fichiers qui bloqueraient l'outil (`CLAUDE.md`, `docs/`, `.claude/`, `.env`). Copier ensuite les fichiers générés dans le dépôt, sans `.git`. Fusionner `.gitignore` en gardant les entrées existantes, puis ajouter celles du §3.3.
2. Réécrire `README.md` en UTF-8 : il est actuellement en UTF-16. Contenu : présentation courte, prérequis, commandes du §3.2, liens vers `docs/`.
3. Installer les dépendances du §1.2 (sauf la base de données et Better Auth), configurer Vitest, Playwright, `tsx` et les scripts du §3.2 disponibles à ce stade.
4. `src/app/globals.css` : jetons B5 (§8.1). `src/app/layout.tsx` : `lang="fr"`, polices, fond `bg`, métadonnées (titre du site, `APP_NAME` depuis l'É8b, `robots: { index: false, follow: false }`).
5. Composants de base : `Button`, `Chip`, `Card`, `Field`, `AppHeader` (navigation statique, sans session), `Footer`.
6. Page `/` provisoire : l'en-tête B5 et une carte « Le site arrive bientôt ».
7. `src/lib/format.ts` : `formatNumber`, `formatDateTime`, `formatRelative` (heure de Paris).
8. `robots.ts`, `not-found.tsx`, `error.tsx` en français.
9. `.env.example` avec les noms du §3.1.
10. `.node-version` (`24`) et `"engines": { "node": "24.x" }` dans `package.json` (§1.2).

**Tests à écrire**
- `tests/unit/format.test.ts` : `formatNumber(2450)` donne « 2 450 » (avec espace fine insécable) ; `formatDateTime(2026-10-21T16:00Z)` donne « mer. 21 oct. à 18 h » ; `formatDateTime(2026-11-15T17:30Z)` donne « dim. 15 nov. à 18 h 30 ».
- `tests/unit/vocabulary.test.ts` (§9.3).
- `e2e/smoke.spec.ts` : `/` répond 200 ; le nom du site visible (logo et onglet, depuis l'É8b) ; `html[lang=fr]` ; une adresse inconnue affiche la 404 en français.

**Critères de passage** : porte commune, plus le rendu de l'en-tête conforme à la maquette (vérification visuelle en H-08).

**Interventions humaines** : H-02, H-01, H-08.

### É2 — Hébergement et base de données

**Objectif** : le site est en ligne sur Vercel, connecté à Neon, avec une chaîne de migration et de contrôle qui fonctionne.

**Prérequis** : É1 validée.

**Branche** : `etape-02-hebergement`.

**Tâches**
1. H-03 : compte Vercel et import du dépôt. H-04 : CLI Vercel et `vercel link`.
2. H-05 : base Neon via l'intégration Vercel, branches `production` et `dev`, variables par environnement.
3. H-06 : secrets et variables. Puis l'agent lance `vercel env pull .env.local` et `npm run check:env`.
4. Installer `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `@electric-sql/pglite` et `@vercel/functions`. Créer `src/lib/db/client.ts` (§7.2), `drizzle.config.ts`, les scripts `migrate.ts`, `check-db.ts`, `check-env.ts` et `e2e-prepare.ts` (version provisoire : migrations seulement), puis `vercel.json`.
5. Schéma provisoire vide (aucune table métier) et première migration technique (`drizzle-kit generate`).
6. Route `/api/health` : `select 1` → `{ ok: true }` (200) ou `{ ok: false }` (503), dynamique, sans cache.
7. Pousser la branche : l'aperçu Vercel se construit (migration sur `dev`). Après validation : fusion dans `main`, déploiement en production.

**Tests à écrire**
- `tests/integration/db-client.test.ts` : `createTestDb()` applique les migrations ; `select 1` répond.
- `e2e/health.spec.ts` : `/api/health` renvoie `{ ok: true }`.
- Vérifications manuelles de l'agent : `npm run check:env` tout à OK ; `npm run db:check` sur `dev` ; `/api/health` de l'aperçu, puis de la production, renvoie `ok: true`.

**Critères de passage** : porte commune, plus : production accessible, `/api/health` en production à `ok: true`, variables présentes dans les trois environnements (vérifiées par l'utilisateur dans le tableau de bord).

**Interventions humaines** : H-03, H-04, H-05, H-06, H-08.

### É3 — Données et moteur de règles

**Objectif** : le schéma complet en base et toutes les règles du jeu, testées. Aucune interface.

**Prérequis** : É2 validée.

**Branche** : `etape-03-donnees-regles`.

**Tâches**
1. Installer `better-auth` et `zod`, puis `date-fns` et `@date-fns/tz`. Écrire la configuration Better Auth du §6.1 (sans les pages) et générer `schema/auth.ts` avec la CLI.
2. Écrire `schema/app.ts` (§4.3 et §4.4), générer la migration, vérifier le SQL produit (contraintes CHECK, UNIQUE, index).
3. Écrire tous les modules de `src/lib/game/` (§5.1 à §5.10) **en commençant par les tests** des vecteurs.
4. Écrire `scripts/seed.ts` (§9.6), avec ses garde-fous, et compléter `e2e-prepare.ts`.
5. Appliquer la migration sur `dev` (`npm run db:migrate`) et lancer le seed (`npm run db:seed`).

**Tests à écrire**
- `tests/unit/game/time.test.ts` (T1 à T8), `question-status.test.ts` (S1 à S7), `number-input.test.ts` (N1 à N11), `prediction-state.test.ts`, `scoring.test.ts` (B1 à B10, P1 à P3, J1 à J3, X1 à X6), `standings.test.ts` (C1 à C6), `crowd.test.ts` et `chart.test.ts` (F1 à F4), `badges.test.ts` (un cas positif et un négatif par badge), `visits.test.ts` (V1 à V4), `countdown.test.ts`.
- `tests/unit/purity.test.ts` : pas de `Date.now()` dans `src/lib/game` (§9.3).
- `tests/integration/schema.test.ts` :
  - un second prono sur la même question pour le même joueur est refusé ;
  - un prono avec à la fois une valeur et une réponse est refusé ;
  - un coefficient de 4 est refusé ;
  - une question publiée sans dates est refusée.
- `tests/integration/seed.test.ts` : le seed passe sur PGlite et produit les nombres attendus (comptes, questions par état) ; il refuse de tourner si `VERCEL_ENV=production` ou si la base porte le marqueur `app_meta.environment = 'production'`.
- `tests/integration/migrate.test.ts` : avec `VERCEL_ENV=production`, la migration pose le marqueur ; sans cette variable, elle ne le pose pas.
- Couverture : seuils du §9.5 atteints pour `src/lib/game`.

**Critères de passage** : porte commune, plus le seuil de couverture, plus la migration appliquée sur `dev` sans erreur.

**Interventions humaines** : H-08. Il n'y a rien à voir à l'écran : l'utilisateur valide sur la base du compte rendu, qui liste les vecteurs couverts.

### É4 — Comptes et accès

**Objectif** : inscription avec liste blanche, connexion, déconnexion, protection des pages, profil, et gestion des joueurs par l'admin.

**Prérequis** : É3 validée.

**Branche** : `etape-04-comptes`.

**Tâches**
1. Route `api/auth/[...all]`, `auth-client.ts`, `session.ts` (`getViewer`, `requireUser`, `requireAdmin`), hook d'inscription (§6.2), `ADMIN_EMAILS`.
2. Proxy/middleware de redirection (§6.4). Layouts `(public)`, `(jeu)` et `admin`.
3. Pages `/connexion` et `/inscription` (§8.3).
4. AppHeader avec session : lien Admin, menu utilisateur, déconnexion. Avatars (16 maillots) et composant `Avatar`.
5. `/profil` : nom (unique), avatar, mot de passe.
6. Services `players.ts` et `profile.ts` (sauf `recordVisit`). Page `/admin/joueurs` (§8.3), avec la boîte de dialogue du mot de passe provisoire.
7. L'accueil devient une page protégée, provisoire : « Bonjour <nom> ».

**Tests à écrire**
- `tests/integration/auth-hooks.test.ts` :
  - inscription refusée hors liste blanche ;
  - acceptée si l'adresse y figure, sans tenir compte de la casse ni des espaces ;
  - une adresse de `ADMIN_EMAILS` reçoit le rôle admin ;
  - un nom déjà pris est refusé.
- `tests/integration/players.test.ts` :
  - ajout en série (bilan « ajoutées / déjà présentes / invalides ») ;
  - retrait refusé si un compte existe ;
  - on ne peut pas se désactiver soi-même ;
  - on ne peut pas retirer le dernier admin ;
  - mot de passe provisoire de 12 caractères sans caractère ambigu ;
  - anonymisation conforme au §6.3 ;
  - désactivation qui révoque les sessions.
- `tests/integration/profile.test.ts` : nom de 2 à 30 caractères et unique, avatar parmi les 16 clés.
- `e2e/auth.spec.ts` :
  - inscription refusée ;
  - inscription de `nouveau1@example.test`, qui arrive sur l'accueil ;
  - déconnexion ;
  - mauvais mot de passe : message ;
  - connexion réussie ;
  - accès anonyme à `/` : redirection vers `/connexion` ;
  - un joueur sur `/admin` reçoit une 404 ;
  - l'admin voit `/admin/joueurs` ;
  - l'admin ajoute `nouveau2@example.test`, puis l'inscription fonctionne ;
  - un compte désactivé ne peut pas se connecter ;
  - un changement de nom apparaît dans l'en-tête.
- `e2e/rate-limit.spec.ts` : la 6e tentative ratée en moins d'une minute affiche « Trop de tentatives ».

**Critères de passage** : porte commune.

**Interventions humaines** : H-08. Après la mise en production : H-09 (compte admin), puis H-10 (liste blanche), qui peut commencer dès ce moment.

### É5 — Back-office

**Objectif** : l'admin peut tout préparer : catégories, questions de tous types, dates en série, publication, duplication, résultats, lots, annonces.

**Prérequis** : É4 validée.

**Branche** : `etape-05-back-office`.

**Tâches**
1. Services `categories.ts`, `questions.ts` (§5.11), `seasons.ts` (`ensureSeason`, `upsertPrizes`) et `announcements.ts`.
2. Pages `/admin`, `/admin/questions` (filtres, actions groupées), `/admin/questions/nouvelle`, `/admin/questions/[id]` (formulaire, champs verrouillés, résultat), `/admin/categories`, `/admin/saisons` (lots ; la proclamation arrive en É7), `/admin/annonces`.
3. Saisie des dates en heure de Paris (`parisLocalToUtc`), préremplissage (`utcToParisLocalInput`).
4. Tableau de bord `/admin` : questions ouvertes (validés x / N, joueurs en retard), questions à résoudre, prochaines ouvertures.

**Tests à écrire**
- `tests/integration/questions.test.ts` :
  - création par type ;
  - le modèle oui/non crée « Oui » et « Non » ;
  - une question à choix exige au moins 2 réponses uniques ;
  - publication refusée si `opens_at ≥ closes_at` ou si `closes_at` est passé ;
  - dates en série avec un bilan par question ;
  - duplication (réponses copiées, `help_last_year` prérempli depuis un résultat) ;
  - verrouillages du §5.11 avec un prono existant (énoncé refusé, aide acceptée, clôture avancée refusée, clôture repoussée acceptée) ;
  - suppression d'un brouillon seulement ;
  - annulation ;
  - résultat refusé avant la clôture, accepté après ; correction qui remplit `corrected_at` ;
  - `season_id` correct autour du 30 septembre (T4 et T5).
- `tests/integration/categories.test.ts`, `announcements.test.ts`, `prizes.test.ts`.
- `tests/integration/admin-visibility.test.ts` : le tableau de bord et le suivi ne renvoient **aucune valeur** de prono pour une question ouverte.
- `e2e/admin-questions.spec.ts` :
  - créer une question à nombre et une question à choix à 3 réponses ;
  - définir les dates en série (ouverture dans le futur) et publier ;
  - un joueur ne voit pas la question programmée (404) ;
  - l'admin saisit le résultat de la question clôturée du seed ;
  - les dates affichées correspondent à l'heure de Paris saisie.

**Critères de passage** : porte commune.

**Interventions humaines** : H-08. Après la mise en production : H-11 (saisie du contenu de la campagne), qui peut commencer pendant les étapes 6 à 8.

### É5b — Saisons gérées par l'admin (v1.1)

**Objectif** : l'admin crée, modifie et supprime les saisons (nom et date de début), parce que les rentrées ne tombent pas toujours le même jour. La saison d'une question et la bascule découlent de ces saisons, et non plus du 1er octobre (§5.1, §5.13).

**Prérequis** : É5 validée ; v1.1 du cahier des charges et de ce document validée par l'utilisateur, y compris la suppression de la colonne `season.ends_at` (migration destructive, §0.4).

**Branche** : `etape-05b-saisons`.

**Tâches**
1. **Avant toute chose**, lire ce que contient la table `season` sur `dev` et en production (nombre de lignes, libellés, questions rattachées), sans rien modifier, et le consigner : les saisons créées automatiquement par l'É5 doivent survivre à la migration.
2. Schéma et migration (§4.3), SQL relu avant application :
   - supprimer `season.ends_at` et les contraintes `season_label_format`, `season_bounds_order` et `question_season_of_closing` ;
   - ajouter l'unicité de `season.starts_at`, l'unicité de `lower(season.label)` et la longueur du libellé (2 à 40).
3. `time.ts`, **tests d'abord** (T4 à T9) : `seasonStartFromLocalDate`, `seasonAt`, `seasonEnd`, `previousSeason`, `suggestedSeasonLabel`. Retirer `seasonLabelFor` et `seasonBounds` et tous leurs usages (pied de page, services, lectures, seed, fabriques de test, tests existants).
4. Services (§5.13) : `createSeason`, `updateSeason`, `deleteSeason` ; `upsertPrizes` par identifiant de saison. `questions.ts` : la saison d'une question vient de `seasonAt` (plus d'`ensureSeason`), publication refusée sans saison (§5.11).
5. Lectures : `getSeasonsAdmin` (fin = début de la suivante, rappel, saison courante), `getCurrentSeason` (pied de page).
6. `/admin/saisons` (§8.3) : création, modification, suppression, rappel ; message du formulaire de question quand aucune saison ne couvre la clôture.
7. Seed (§9.6).
8. Documents : retirer les dernières mentions d'une bascule fixe au 30 septembre (`README.md`, `CLAUDE.md`, §12, §13).

**Tests à écrire**
- `tests/unit/game/time.test.ts` : T1 à T9.
- `tests/integration/seasons.test.ts` : SA1 à SA8 ; matrice d'autorisation des trois nouveaux services ; nom unique sans tenir compte de la casse ; deux saisons le même jour refusées ; lots d'une saison proclamée refusés.
- `tests/integration/questions.test.ts` : les tests de saison se font autour d'une date de début choisie (et plus seulement du 30 septembre) ; publication refusée sans saison ; une question avec pronos ne change pas de saison.
- `tests/integration/migrate.test.ts` : la migration passe sur une base qui contient déjà des saisons et des questions, et les conserve.
- `e2e/admin-seasons.spec.ts` : l'admin crée une saison qui commence dans le futur, la renomme, change sa date de début, puis la supprime ; une question qui clôture après ce début affiche la nouvelle saison dans `/admin/questions`.

**Critères de passage** : porte commune, plus la migration appliquée sur `dev` puis en production sans perte (saisons et questions existantes conservées).

**Interventions humaines** : H-08. Après la mise en production, et **avant H-11** : l'admin crée la saison 2026-2027 avec la date de début voulue, ou ajuste celle que l'É5 aurait créée.

### É6 — Parcours joueur

**Objectif** : un joueur voit ses questions, enregistre, valide et pose ses jokers. L'accueil est complet, sauf le dernier résultat.

**Prérequis** : É5b validée.

**Branche** : `etape-06-parcours-joueur`.

**Tâches**
1. Service `predictions.ts` (§5.4), `recordVisit` et `VisitTracker`.
2. Lectures `home.ts`, `questions.ts` et `standings.ts` (rang et points pour l'accueil), avec la visibilité (§6.6).
3. Composants Countdown, StatusChip, QuestionCard, PredictionForm, ConfirmDialog, HelpPanel, SegmentedProgress, AnnouncementBar, StatTile, NewChip.
4. Pages : accueil (§8.3, blocs 1 à 3), `/pronos`, `/questions`, `/questions/[id]` (état ouvert, et vue joueur des états brouillon, programmé et annulé).
5. Bouton « Déverrouiller » et historique des événements dans `/admin/questions/[id]`.

**Tests à écrire**
- `tests/integration/predictions.test.ts`, avec une horloge injectée :
  - enregistrement refusé avant l'ouverture, accepté à l'ouverture exacte, refusé à la clôture exacte ;
  - modification possible tant que le prono n'est pas validé ;
  - validation avec une valeur (enregistrement et validation en une transaction) ;
  - un prono validé ne peut plus être modifié ni avoir son joker changé ;
  - joker : limite de 2 par saison, deux appels simultanés n'en posent pas 3, un joker sur une question annulée est rendu, un joker sans prono est refusé ;
  - réponse d'une autre question refusée ;
  - compte désactivé refusé ;
  - déverrouillage réservé à l'admin, avant la clôture seulement, avec l'événement `unlocked` ;
  - un événement par action, avec le bon acteur.
- `tests/integration/visibility.test.ts` :
  - avant la clôture, un joueur ne reçoit que son prono et l'admin que des états ;
  - après la clôture, tout le monde reçoit les valeurs ;
  - une question programmée est introuvable pour un joueur.
- `e2e/player.spec.ts` :
  - l'accueil liste les questions ouvertes dans l'ordre des clôtures, avec un compte à rebours et la couleur urgente sur la première ;
  - enregistrer 2 450 affiche l'état « Enregistré » ;
  - valider ouvre la confirmation, affiche « Validé » et passe le champ en lecture seule ;
  - joker : le compteur diminue, puis c'est refusé au-delà de 2 ;
  - question à choix validée ;
  - pastille « Nouveau » visible pour `joueur4` ;
  - la question programmée est absente ;
  - confidentialité : `987654` est absent du HTML (§9.3).
- `e2e/admin-unlock.spec.ts` : l'admin déverrouille un prono validé ; le joueur peut de nouveau le modifier.

**Critères de passage** : porte commune.

**Interventions humaines** : H-08 (l'utilisateur fait lui-même un parcours de prono complet sur l'aperçu).

### É7 — Résultats, classement, palmarès

**Objectif** : tout ce qui se passe après la clôture : pronos de tous, sagesse de la foule, graphiques, points, classement, profils, badges, lots, règlement, palmarès.

**Prérequis** : É6 validée.

**Branche** : `etape-07-resultats`.

**Tâches**
1. Composants StripChart, ChoiceDistribution, ResultPanel, StandingsTable (complète), BadgeList.
2. `/questions/[id]` : états clôturé et résolu. Accueil : bloc « Dernier résultat ».
3. `/classement` (sélecteur de saison, flèches), `/joueurs/[id]`, `/lots`, `/reglement` (généré à partir des constantes), `/palmares`.
4. `proclaimSeason` et le bouton de proclamation dans `/admin/saisons`.

**Tests à écrire**
- `tests/integration/standings.test.ts` :
  - le classement du seed est égal au tableau calculé à la main dans le test (points, rangs, « Dans le mille », écart moyen) ;
  - les flèches changent après la dernière résolution ;
  - un compte désactivé qui a des pronos est marqué inactif.
- `tests/integration/proclaim.test.ts` :
  - proclamation refusée si une question n'est pas résolue ;
  - le contenu de `season_standing` est conforme ;
  - une seconde proclamation est refusée ;
  - une correction de résultat après la proclamation ne change pas le palmarès ;
  - les badges Champion et Assidu sont obtenus.
- `tests/integration/badges-data.test.ts` : badges des comptes du seed.
- `e2e/results.spec.ts` :
  - question résolue du seed : valeur réelle, podium avec ex æquo (P1), points de chacun, bandeau « Ton prono » ;
  - question clôturée : pronos de tous, sans valeur réelle ;
  - `/classement` dans l'ordre attendu, avec les flèches ;
  - `/reglement` affiche les valeurs de `SCORE_TIERS` ;
  - `/palmares` affiche la saison précédente ;
  - l'admin proclame une saison prête (préparée par le test) et elle apparaît au palmarès.

**Critères de passage** : porte commune.

**Interventions humaines** : H-08.

### É8 — Finitions et qualité

**Objectif** : l'application est accessible, utilisable sur petit écran, robuste et relue.

**Prérequis** : É7 validée.

**Branche** : `etape-08-finitions`.

**Tâches**
1. Responsive (§8.4), `loading.tsx`, états vides, pages d'erreur.
2. Accessibilité (§8.5) : corriger tout ce que signale axe.
   - **Point connu (relevé en É1)** : la bordure des champs et des boutons secondaires (`line-strong`, `#B5BCC8`) n'offre qu'un contraste d'environ 1,9:1 sur `surface`, sous le seuil de 3:1 des composants d'interface (WCAG 1.4.11). axe ne le détecte pas. Proposer à l'utilisateur une teinte plus foncée, avec une capture avant et après, puis modifier le jeton seulement après son accord.
3. Relecture de tous les textes (§8.6).
4. Revue de sécurité : chaque action et chaque service passe le contrôle des droits ; en-têtes HTTP ; `noindex`.
5. Relancer toute la suite et corriger les éventuels tests instables.

**Tests à écrire**
- `e2e/a11y.spec.ts` (§9.4).
- `e2e/responsive.spec.ts` : à 390 × 844, pas de défilement horizontal (`scrollWidth ≤ clientWidth`) sur `/`, `/pronos`, `/questions/<id>`, `/classement` ; menu accessible.
- `tests/integration/authorization-matrix.test.ts` (§9.3).
- `e2e/headers.spec.ts` : les en-têtes du §3.3 sont présents.

**Critères de passage** : porte commune, aucune violation axe grave, plus trois exécutions consécutives de `npm run test:e2e` sans échec (stabilité).

**Interventions humaines** : H-08 (relecture visuelle sur ordinateur et sur téléphone).

### É8b — Changement du nom du site (v1.1)

**Objectif** : le site porte son nouveau nom partout (interface, titres d'onglet, textes, tests, documents) et, si l'utilisateur le veut, une nouvelle adresse de production. **Il n'est pas nécessaire de recréer le projet Vercel** : on le renomme et on lui ajoute une adresse (H-16) ; la base, les comptes et les données ne bougent pas.

**Prérequis** : É8 validée ; le nouveau nom choisi par l'utilisateur.

**Quand** : avant H-10 (création des comptes de l'équipe) et avant l'annonce H-15. La session de connexion est liée à l'adresse du site : changer d'adresse après coup obligerait tout le monde à se reconnecter, et le lien annoncé ne marcherait plus. Si l'utilisateur n'a pas de nouveau nom au moment de l'É9, l'étape est sautée et le nom actuel reste.

**Branche** : `etape-08b-nom`.

**Tâches**
1. **Au début de l'étape**, redemander à l'utilisateur le nouveau nom exact (majuscules, accents, espaces) et s'il veut aussi une nouvelle adresse `<nom>.vercel.app`, puis lui réexpliquer le déroulé : inventaire, remplacement, H-16, vérifications.
2. **Inventaire complet, présenté à l'utilisateur avant toute modification.** Rechercher dans tout le dépôt (hors `node_modules`, `.next`, `playwright-report`, `test-results`) toutes les formes de l'ancien nom : « Le Bon Chiffre », « LE BON CHIFFRE », « Bon Chiffre », `le-bon-chiffre`, `leBonChiffre`, `le_bon_chiffre`, et les variantes sans accent ou en capitales. Au 30/09/2026, on les trouve au moins dans :
   - l'interface : `src/components/layout/Logo.tsx` (logo), `src/components/layout/Footer.tsx`, `src/app/layout.tsx` (titre des onglets et gabarit « %s · … »), `src/app/(public)/layout.tsx`, la page d'accueil, et les pages ajoutées aux É6 à É8 (règlement, lots…) ;
   - la configuration : `appName` de Better Auth (`src/lib/auth/auth.ts`), `name` dans `package.json` et `package-lock.json`, la clé `leBonChiffreDb` de `src/lib/db/client.ts` (nom technique, à renommer ou non) ;
   - les tests : `e2e/smoke.spec.ts` (logo « LE BON CHIFFRE ») et les autres specs ;
   - les documents : `CLAUDE.md`, `README.md`, cahier des charges, architecture (titre, message de H-15), `avancement.md` (table « Informations de projet » ; le journal n'est pas réécrit) ;
   - hors du code, sans modification par l'agent : les contenus saisis en production (annonces, questions, lots) qui citeraient le nom (l'admin les corrige dans le back-office), le projet Vercel (H-16), le projet Neon et le dépôt GitHub `EM-MPP` (noms invisibles des joueurs : à renommer seulement si l'utilisateur le demande).
3. Regrouper le nom affiché dans une seule constante (par exemple `APP_NAME` dans `src/lib/app.ts`), utilisée par tous les composants, les métadonnées et Better Auth. Le logo garde sa mise en forme.
4. Remplacer le nom partout (inventaire de la tâche 2), mettre à jour les tests et les documents.
5. Si une nouvelle adresse est voulue : H-16 ; l'agent met ensuite à jour `BETTER_AUTH_URL` en production (sans l'afficher) et relance un déploiement. Vérifier la connexion et l'inscription sur la nouvelle adresse, et la redirection de l'ancienne.
6. Mettre à jour `avancement.md` (adresse de production, nom du projet Vercel).

**Tests à écrire**
- `tests/unit/app-name.test.ts` : aucune forme de l'ancien nom dans `src/`, `e2e/` et `tests/` (hors ce test lui-même).
- `e2e/smoke.spec.ts` adapté : le logo et le titre de l'onglet affichent le nouveau nom.
- Fumée en production (`e2e/prod-smoke.spec.ts`) sur la nouvelle adresse, si elle change.

**Critères de passage** : porte commune ; l'inventaire ne trouve plus l'ancien nom (hors journal d'avancement) ; connexion vérifiée en production sur l'adresse finale.

**Interventions humaines** : choix du nom (avant l'étape), H-16 si l'adresse change, H-08.

### É8c — Malus, jokers par saison, prolongations, couleur (v1.2)

**Objectif** : les règles de la v1.2 du cahier des charges, sauf le chat :
- le barème devient un malus (écart brut, sans plafond ; le moins de malus gagne) ;
- le Juste Prix et le bonus podium disparaissent ;
- l'admin fixe le malus d'une mauvaise réponse sur chaque question à choix ;
- un absent prend le malus du pire prono ;
- les jokers sont autorisés ou non par saison, et divisent le malus par deux ;
- l'admin prolonge une question pour un joueur absent ;
- un joueur sans prono ne voit pas les pronos des autres avant le résultat ;
- la couleur principale devient #0036B3.

Ces changements touchent le même cœur de code (barème, classement, visibilité) : ils vont ensemble.

**Prérequis** : É8b validée ; v1.2 du cahier des charges et de ce document validée par l'utilisateur.

**Branche** : `etape-08c-malus`.

**À savoir avant de coder** : l'écart brut sans plafond, le malus du pire prono pour un absent et le départage inchangé sont des **décisions de l'utilisateur**, prises après qu'on lui a présenté l'écart relatif et le plafond (02/10/2026). Ne pas les rediscuter : les appliquer.

**Tâches**
1. **Lecture seule, avant toute chose** : compter sur `dev` et en production les saisons, les questions (dont les questions à choix et celles avec `price_is_right`), les pronos avec joker et les lignes de `season_standing`, puis le consigner.
   - Production au 02/10/2026 : 1 saison (2026-2027, non proclamée), 0 question, 0 prono, 0 ligne de palmarès, 1 compte.
   - Si la production contient des questions à choix, demander à l'utilisateur leur malus d'une mauvaise réponse avant d'appliquer la migration.
   - Si elle contient des lignes de palmarès ou des questions Juste Prix avec des pronos, s'arrêter et exposer le problème.
2. **Schéma et migration** (§4.3), uniquement des ajouts, SQL relu avant application :
   - `season.jokers_enabled` ;
   - `question.wrong_answer_malus` (rempli à 50 pour les questions à choix existantes avant la contrainte) ;
   - `price_is_right` remis à `false` et contrainte `question_price_is_right_removed` ;
   - table `question_extension` ;
   - `season_standing.malus`, et `points` devient nullable.

   Appliquer sur `dev` (`npm run db:migrate`, hôte vérifié), puis relancer le seed.
3. **`src/lib/game`, tests d'abord** :
   - constantes et `scoring.ts` (§5.5 : vecteurs M, K, Q, P, A, X6) ;
   - `standings.ts` (§5.6 : C1 à C9) ;
   - `questionStatusFor` (§5.2 : E1 à E6) ;
   - badges (rang de proximité sans bonus, §5.8) ;
   - retirer `priceIsRight`, `wentOver`, les paliers et le bonus de tout le code.
4. **Services** :
   - `questions.ts` : malus d'une mauvaise réponse, plus de Juste Prix, résultat refusé pendant une prolongation ;
   - `predictions.ts` : statut pour le propriétaire, `JOKERS_DISABLED`, ordre des verrous du §5.4 ;
   - `seasons.ts` : `jokersEnabled`, `JOKERS_IN_USE`, malus au palmarès ;
   - `extensions.ts` (§5.14) ;
   - ajouter les deux nouveaux services à la matrice d'autorisation (36 services).
5. **Lectures** (§7.4) :
   - visibilité v1.2 dans `getQuestionPredictionsForViewer` (§6.6) ;
   - questions ouvertes pour le joueur prolongé ;
   - résultats et profils avec les absents ;
   - classement en malus ;
   - jokers restants à `null` dans une saison sans jokers ;
   - tableau de bord et page d'une question de l'admin, avec les prolongations.
6. **Interface** (§8) :
   - partout, « points » devient « malus » : accueil, tuiles, classement et sa liste compacte, palmarès, profil, page d'une question, `ResultPanel`, `PredictionsTable`, `/questions` ;
   - tri du plus petit malus au plus grand ;
   - Juste Prix retiré : formulaire d'admin, `PredictionForm`, en-tête de question, règlement ;
   - champ du malus d'une mauvaise réponse dans le formulaire de question, et affichage aux joueurs ;
   - case des jokers dans `/admin/saisons` ; joker « ÷2 », masqué dans une saison sans jokers ;
   - `ExtensionDialog` et section des prolongations dans le suivi ;
   - pastille « PROLONGÉE POUR TOI » ;
   - vue « Les pronos s'afficheront au résultat » ;
   - mention des prolongations en cours ;
   - `/reglement` réécrit (§8.3) ;
   - couleur #0036B3 (`globals.css`, trois jetons), puis captures avant et après pour l'utilisateur.
7. **Seed** (§9.6) et tests existants : remplacer les vecteurs et les attendus de l'ancien barème par ceux du malus (classement du seed recalculé à la main). C'est une **règle qui change**, décidée par l'utilisateur, pas un test affaibli : le consigner au journal, test par test, pour les tests remplacés.
8. `avancement.md` : statut, décisions, points ouverts pour l'É8d.

**Tests à écrire**
- `tests/unit/game/scoring.test.ts` (§5.5 : M1 à M7, K1 à K5, Q1 à Q3, P1, P2, A1 à A4, X6), `standings.test.ts` (C1 à C9), `question-status.test.ts` (+ E1 à E6), `badges.test.ts` adapté, `purity.test.ts` et `vocabulary.test.ts` inchangés.
- `tests/integration/predictions.test.ts` :
  - un joueur prolongé enregistre, valide et pose un joker jusqu'à sa date limite (exclue), plus après ;
  - un autre joueur reste refusé ;
  - un prono enregistré pendant la prolongation compte comme validé à sa fin ;
  - déverrouillage pendant la prolongation ;
  - `JOKERS_DISABLED`.
- `tests/integration/extensions.test.ts` : PR1 à PR10, et la matrice d'autorisation des deux services.
- `tests/integration/questions.test.ts` :
  - malus d'une mauvaise réponse obligatoire et > 0 pour un choix, absent pour un nombre ;
  - verrouillé quand la question a des pronos ;
  - copié à la duplication ;
  - type Juste Prix refusé ;
  - résultat refusé pendant une prolongation.
- `tests/integration/seasons.test.ts` : SA9 à SA13.
- `tests/integration/visibility.test.ts` : chaque case du §6.6 v1.2 (sans prono, prolongation, admin qui n'a pas pronostiqué, sagesse de la foule sans les pronos cachés, historique).
- `tests/integration/standings.test.ts`, `proclaim.test.ts` (malus écrit dans `season_standing.malus`), `results-data.test.ts`, `badges-data.test.ts`, `seed.test.ts` : nouveaux attendus.
- `tests/integration/schema.test.ts` :
  - question à choix sans malus refusée ;
  - `price_is_right = true` refusé ;
  - une seule prolongation par joueur et par question ;
  - prolongation accordée à soi-même refusée.
- `tests/integration/migrate.test.ts` : la migration passe sur une base qui contient des questions à choix, un Juste Prix et un palmarès, et conserve tout.
- `tests/integration/authorization-matrix.test.ts` : 36 services.
- `e2e/results.spec.ts` :
  - malus affichés ;
  - classement du plus petit malus au plus grand ;
  - ligne « Pas de prono » ;
  - règlement sans paliers.
- `e2e/player.spec.ts` : « JOKER ÷2 », malus d'une mauvaise réponse visible.
- `e2e/admin-questions.spec.ts` : création d'une question à choix avec son malus ; plus de type Juste Prix.
- `e2e/admin-seasons.spec.ts` : case des jokers ; retrait refusé sur la saison courante (des jokers y sont posés).
- `e2e/admin-extension.spec.ts` (nouveau) :
  - l'admin prolonge « webinaire » pour un joueur sans prono ;
  - ce joueur la voit dans ses questions ouvertes avec « PROLONGÉE POUR TOI » et ne voit pas `876543` ;
  - il enregistre une valeur témoin ;
  - un joueur qui a pronostiqué voit la mention de la prolongation, mais pas la valeur témoin ;
  - un joueur sans prono voit « Les pronos s'afficheront au résultat » ;
  - « Saisir le résultat » est désactivé avec la raison.

  Tenir compte des états laissés dans la base e2e (point ouvert n° 6).
- `e2e/a11y.spec.ts` (question clôturée sans prono) et `e2e/responsive.spec.ts` (dialogue de prolongation, pages avec malus) à 390 px.

**Critères de passage** : porte commune ; couverture du §9.5 ; migration appliquée sur `dev` puis en production sans perte ; contrastes de #0036B3 vérifiés (axe, captures validées par l'utilisateur).

**Interventions humaines** : H-08. Avant H-11, l'utilisateur sait qu'il doit renseigner le malus d'une mauvaise réponse de chaque question à choix (annexe B).

### É8d — Chat général (v1.2)

**Objectif** : un onglet « Chat » où toute l'équipe échange des messages avec des emojis (grille d'emojis), conservés en base. Les nouveaux messages arrivent par interrogation périodique, et un message automatique annonce chaque résultat (§5.15).

**Prérequis** : É8c validée.

**Branche** : `etape-08d-chat`.

**Tâches**
1. Schéma et migration (ajouts seulement) : enum `chat_message_kind`, tables `chat_message` et `chat_read` (§4.3), SQL relu ; appliquer sur `dev`.
2. `src/lib/chat/` : `emojis.ts`, `polling.ts` (`shouldPoll`), `result-message.ts`, tests d'abord.
3. Services `chat.ts` (§5.15) ; message de résultat dans `resolveQuestion` ; effacement des messages dans `anonymizeUser`. Matrice d'autorisation : 39 services.
4. Lectures `data/chat.ts` ; route `GET /api/chat` ; exception du proxy (§6.4).
5. Interface : `/chat` (§8.3), `ChatRoom`, `ChatMessage`, `ChatComposer`, `EmojiPalette` (§8.2), onglet « Chat » et sa pastille dans `AppHeader`, squelette `loading.tsx`.
6. Vérifier l'en-tête à 1 024 px avec l'onglet de plus (point ouvert de l'É8b, que l'utilisateur doit trancher).
7. Seed (§9.6).
8. Vérifier à la main que la page cesse d'interroger le serveur quand l'onglet est caché ou la personne inactive (onglet Réseau du navigateur), et le consigner.

**Tests à écrire**
- `tests/unit/chat/emojis.test.ts` : 48 emojis distincts, chacun avec un nom, aucun mot interdit (§9.3).
- `tests/unit/chat/polling.test.ts` (CH11) et `result-message.test.ts` : nombre, égalité au rang 1, choix, sans prono, « (corrigé) ».
- `tests/integration/chat.test.ts` : CH1 à CH10, `getChatUpdates` (nouveaux messages et suppressions depuis `since`), non lus.
- `tests/integration/authorization-matrix.test.ts` : 39 services.
- `e2e/chat.spec.ts` :
  - un joueur envoie un message avec un emoji de la palette ;
  - un second joueur, dans un autre contexte de navigateur, le voit arriver sans recharger (en moins de 15 s) ;
  - la pastille des non lus apparaît chez un troisième joueur après navigation ;
  - suppression de son propre message ;
  - l'admin supprime le message d'un autre ;
  - le message de résultat apparaît après la résolution de « Studyrama » par `admin-questions.spec.ts` (ordre alphabétique des fichiers : vérifier) ;
  - `/api/chat` répond `401` sans session.
- `e2e/a11y.spec.ts` et `e2e/responsive.spec.ts` : `/chat`, palette ouverte, à 390 et 1 280 px.

**Critères de passage** : porte commune ; arrêt de l'interrogation vérifié et consigné.

**Interventions humaines** : H-08 (l'utilisateur discute avec un collègue ou avec un second compte du seed sur l'aperçu).

### É9 — Recette et lancement

**Objectif** : des collègues testent, on corrige, la production est remplie et vérifiée, on lance le 14 octobre.

**Prérequis** : É8 validée et fusionnée dans `main`, ainsi que l'É8b si le nom change, l'É8c, et l'É8d (sauf si l'utilisateur décide de la reporter après le lancement : le chat ne bloque rien d'autre).

**Branche** : `etape-09-recette` pour les corrections.

**Tâches**
1. Remettre à zéro la branche `dev` et la remplir avec le seed. H-07 : ouvrir les aperçus aux collègues.
2. H-12 : recette par 2 ou 3 collègues sur l'aperçu (comptes du seed), recueil des remarques ; l'agent trie les bogues et les corrections mineures, et soumet à l'utilisateur tout ce qui toucherait au périmètre.
3. H-13 : relecture du règlement et des textes par l'utilisateur.
4. Vérifier que la production ne contient aucune donnée de test (aucun compte `@example.test`) et que H-09, H-10 et H-11 sont faits.
5. Fumée en production : `BASE_URL=<prod> npx playwright test e2e/prod-smoke.spec.ts`.
6. H-14 : checklist de lancement (section 13) le 13 octobre. H-15 : annonce du lancement le 14 octobre.

**Tests à écrire** : `e2e/prod-smoke.spec.ts` (§9.1).

**Critères de passage** : porte commune sur `main`, fumée en production au vert, checklist de la section 13 cochée par l'utilisateur.

**Interventions humaines** : H-07, H-12, H-13, H-14, H-15.

---

## 12. Interventions humaines

> Les libellés des interfaces Vercel et Neon peuvent avoir changé. L'agent adapte les instructions à ce que l'utilisateur voit, sans jamais lui demander de coller un secret dans le chat.

### H-01 — Node.js et Git (É1)
- **Pourquoi** : pour exécuter le projet.
- **Étapes** :
  1. L'agent lance `node -v`, `npm -v` et `git --version`.
  2. Si Node.js manque ou si sa version n'est pas une 24, l'utilisateur installe Node 24 LTS (avec fnm : `fnm install 24` puis `fnm default 24` ; sinon l'installeur « LTS » de https://nodejs.org), puis redémarre VS Code.
- **Vérification** : `node -v` affiche une version 24, dans le terminal de l'utilisateur et dans celui de l'agent.

### H-02 — Feu vert sur le document d'architecture (avant É1)
- **Pourquoi** : c'est le contrat de construction.
- **Étapes** : lire ce document (au moins les sections 0, 8 et 11) et répondre « OK » ou lister les changements voulus.
- **Vérification** : l'agent consigne le feu vert, ou les changements et leur prise en compte, dans le journal.

### H-03 — Compte Vercel et import du dépôt (É2)
1. Aller sur https://vercel.com et s'inscrire ou se connecter **avec GitHub**, en utilisant le compte `emnormandie76`. Choisir l'offre **Hobby**.
2. « Add New… » → « Project » → importer le dépôt `EM-MPP`. Si le dépôt n'apparaît pas, autoriser l'application Vercel sur ce dépôt dans GitHub.
3. **Nom du projet** : il donne l'adresse de production (`<nom>.vercel.app`). Proposition : `le-bon-chiffre`. Si le nom est pris, en choisir un autre et le donner à l'agent.
4. Laisser les réglages détectés (Next.js) et déployer.
- **À donner à l'agent** : l'adresse de production.
- **Vérification** : l'agent ouvre l'adresse, qui répond.

### H-04 — CLI Vercel et liaison du projet (É2)
1. Dans le terminal de VS Code : `npm i -g vercel`.
2. `vercel login`, puis se connecter dans le navigateur.
3. À la racine du dépôt : `vercel link`, puis choisir le projet créé en H-03.
- **Vérification** : le dossier `.vercel/` existe (et il est ignoré par git).

### H-05 — Base de données Neon (É2)
1. Dans le projet Vercel : onglet « Storage » → « Create Database » (ou « Browse Marketplace ») → **Neon** → accepter les conditions.
2. Région : **Frankfurt (eu-central-1)**. Offre : **Free**. Nom : `le-bon-chiffre`.
3. Connecter la base au projet, pour l'environnement **Production**. Si l'assistant propose de créer une branche de base par déploiement de prévisualisation, **refuser**.
4. Ouvrir la console Neon (bouton « Open in Neon ») → « Branches » → « Create branch » : nom `dev`, à partir de la branche principale.
5. Sur la branche `dev`, copier la chaîne de connexion **poolée** et la chaîne **directe** (non poolée).
6. Dans Vercel → « Settings » → « Environment Variables » : créer `DATABASE_URL` (chaîne poolée de `dev`) et `DATABASE_URL_UNPOOLED` (chaîne directe de `dev`), pour les environnements **Preview** et **Development** uniquement.
7. Vérifier que Production pointe bien sur la branche principale (variables créées par l'intégration).
- **Vérification** : après H-06, `vercel env pull .env.local` puis `npm run check:env` et `npm run db:check`.

### H-06 — Secrets et variables d'application (É2)
1. Générer 3 secrets, un par environnement, avec cette commande (lancée par l'utilisateur, **résultat non collé dans le chat**) : `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Dans Vercel → « Environment Variables », créer :
   - `BETTER_AUTH_SECRET` : une valeur différente pour Production, Preview et Development ;
   - `BETTER_AUTH_URL` : `https://<adresse de production>` pour **Production** seulement, et `http://localhost:3000` pour **Development** seulement ;
   - `ADMIN_EMAILS` : ton adresse, dans les trois environnements.
3. Prévenir l'agent, qui lance `vercel env pull .env.local` puis `npm run check:env`.
- **Vérification** : `check:env` affiche OK pour toutes les variables.

### H-07 — Ouvrir les aperçus aux collègues (É9)
- **Pourquoi** : par défaut, Vercel exige une connexion Vercel pour voir les aperçus. L'application garde sa propre connexion par liste blanche.
- **Étapes** : Vercel → projet → « Settings » → « Deployment Protection » → désactiver « Vercel Authentication » (ou le limiter à la production, selon les options proposées).
- **Vérification** : l'aperçu s'ouvre dans une fenêtre de navigation privée et affiche `/connexion`.

### H-08 — Validation de fin d'étape (chaque étape)
1. L'agent donne l'adresse de l'aperçu (à partir de É2) et une liste de 5 à 10 vérifications à faire.
2. L'utilisateur les fait et répond « OK » ou liste les problèmes.
3. L'agent demande : « Je commite, je pousse et je fusionne dans main ? ». Il n'agit qu'après un « oui ».
- **Vérification** : l'agent consigne la date de validation dans `avancement.md`.

### H-09 — Compte admin en production (après la mise en production de É4)
1. Ouvrir `https://<production>/inscription`.
2. S'inscrire avec **l'adresse mise dans `ADMIN_EMAILS`**, son prénom et un mot de passe solide.
3. Vérifier que le lien « ADMIN » apparaît dans l'en-tête.
- **Vérification** : l'utilisateur confirme avoir accès à `/admin`.

### H-10 — Liste blanche de l'équipe (dès que H-09 est fait)
1. Réunir les adresses professionnelles des membres de l'équipe.
2. `/admin/joueurs` → « Liste blanche » → coller les adresses, une par ligne → « Ajouter ».
3. Vérifier le bilan affiché.
- **Vérification** : le nombre d'adresses correspond à l'équipe.

### H-11 — Contenu de la campagne (dès la mise en production de É5b)
1. Préparer les questions avec le gabarit de l'annexe B, par exemple dans un tableur, y compris le malus d'une mauvaise réponse de chaque question à choix (v1.2). Les questions à choix se saisissent de préférence après la mise en production de l'É8c, qui ajoute ce champ.
2. Dans `/admin/categories` : créer les catégories.
3. Dans `/admin/questions` : créer chaque question.
4. Sélectionner toutes les questions de la campagne → « Définir les dates » :
   - ouverture le **14/10/2026**, à l'heure choisie (par exemple 9 h) ;
   - clôture le **21/10/2026**, à l'heure choisie (par exemple 18 h) ;
   - résultat prévu, question par question si besoin ;
   - puis « Publier ».
5. Dans `/admin/saisons` : créer la saison 2026-2027 avec sa date de début (ou ajuster la sienne), choisir si les jokers sont autorisés (v1.2), puis saisir ses lots. **À faire avant l'étape 4** : sans saison, les questions ne peuvent pas être publiées (v1.1). Les jokers ne peuvent plus être retirés une fois qu'un joueur en a posé un.
6. Dans `/admin/annonces` : écrire le message de bienvenue.
- **Vérification** : `/admin/questions` affiche les questions en « programmée », avec les bonnes dates en heure de Paris.

### H-12 — Recette avec des collègues (É9)
1. Choisir 2 ou 3 collègues. L'agent fournit les identifiants de test du seed (`joueur1@example.test` et suivants, mot de passe `Test-1234!`) et l'adresse de l'aperçu.
2. Leur demander, en 20 minutes : se connecter, faire 3 pronos (dont un à choix), en valider 2, poser un joker, regarder le classement (en malus) et une question résolue, écrire dans le chat avec un emoji (si l'É8d est faite), puis noter tout ce qui gêne.
3. Transmettre les remarques à l'agent.
- **Vérification** : les remarques sont consignées ; les corrections retenues sont faites et testées.

### H-13 — Relecture du règlement et des textes (É9)
- Lire `/reglement` (en particulier le malus, le pire prono pour les absents et les prolongations, v1.2), l'accueil, `/pronos` et la fenêtre de confirmation. Signaler toute formulation à changer.

### H-14 — Checklist de lancement (13/10)
- Cocher la section 13 avec l'agent.

### H-15 — Annonce du lancement (14/10)
- Envoyer à l'équipe (Teams ou oral) l'adresse de production, la façon de créer son compte, la date de clôture et les lots.
- Proposition de message, fournie par l'agent : « Les petits pronos de la promo sont ouverts ! Crée ton compte sur https://les-petits-pronos-de-la-promo.vercel.app/inscription avec ton email pro. Tu as jusqu'au mercredi 21 octobre à 18 h pour valider tes pronos. À gagner : <lots>. » (avec le nom et l'adresse définitifs si l'É8b les a changés)

### H-16 — Nouvelle adresse de production (É8b, facultatif)
- **Pourquoi** : l'adresse `*.vercel.app` suit le nom choisi. Il n'est pas nécessaire de recréer le projet Vercel : on le renomme et on lui ajoute une adresse ; la base, les variables et les déploiements restent.
- **Étapes** (libellés à vérifier au moment de l'étape, l'interface de Vercel change souvent) :
  1. Vercel → projet `le-bon-chiffre` → « Settings » → « General » → « Project Name » : saisir le nouveau nom, enregistrer.
  2. « Settings » → « Domains » → « Add Domain » : `<nouveau-nom>.vercel.app` (s'il est libre), pour la production.
  3. Sur l'ancienne adresse `le-bon-chiffre.vercel.app` : choisir une redirection vers la nouvelle, pour que les anciens liens continuent de marcher.
  4. Prévenir l'agent, qui met à jour `BETTER_AUTH_URL` en production (sans l'afficher) et relance un déploiement de production.
- **Vérification** : la nouvelle adresse affiche `/connexion`, la connexion admin fonctionne, l'ancienne adresse redirige vers la nouvelle.

---

## 13. Checklist de lancement

À faire le 13 octobre, avec l'agent :

- [ ] `main` est à jour, le dernier déploiement de production a réussi et `/api/health` renvoie `ok: true`.
- [ ] La production ne contient aucun compte `@example.test`.
- [ ] Le compte admin est créé et accède à `/admin` (H-09).
- [ ] La liste blanche contient toute l'équipe (H-10).
- [ ] Les catégories sont créées.
- [ ] Toutes les questions de la campagne sont **programmées** : ouverture le 14/10, clôture le 21/10, heures vérifiées en heure de Paris, source et aide remplies, malus d'une mauvaise réponse cohérent pour chaque question à choix (H-11).
- [ ] La saison 2026-2027 existe avec la bonne date de début et le bon réglage des jokers, ses lots sont saisis. L'annonce de bienvenue est prête.
- [ ] Le chat fonctionne entre deux comptes (si l'É8d est faite), et l'accueil s'affiche aux couleurs #0036B3.
- [ ] Le nom et l'adresse du site sont définitifs (É8b faite, ou écartée par l'utilisateur).
- [ ] `/reglement` a été relu (H-13).
- [ ] Test sur téléphone et sur ordinateur avec le compte admin : l'accueil s'affiche et le compte à rebours de l'ouverture est cohérent.
- [ ] La fumée en production est au vert.
- [ ] Le message de lancement est prêt (H-15).

**Après le lancement** (pour mémoire) :
- Relancer à la main les retardataires grâce au suivi de `/admin`.
- Pour un absent, accorder une prolongation depuis le suivi de la question, et le prévenir soi-même.
- Saisir chaque résultat dès qu'il est connu (après la fin des prolongations).
- Proclamer la saison une fois toutes les questions résolues.
- Avant la rentrée 2027 : créer la saison 2027-2028 avec sa date de début dans `/admin/saisons` ; elle commencera seule ce jour-là. Dupliquer alors les questions récurrentes.

---

## 14. Points d'attention techniques

Points dont l'API peut différer selon la version installée. Vérifier dans la documentation officielle de la version, puis consigner dans le journal la solution retenue.

| Sujet | Attention |
|---|---|
| Next.js : proxy/middleware | Next 16 a renommé `middleware.ts` en `proxy.ts`. Utiliser la convention de la version installée. |
| Next.js : lint | `next lint` a été retiré dans les versions récentes : utiliser `eslint .` avec `eslint-config-next` en configuration « flat ». |
| Next.js : cache | Ne pas activer Cache Components ni PPR. Toutes les pages lisent la session et sont dynamiques. |
| Tailwind CSS v4 | Configuration dans le CSS (`@import "tailwindcss"` et `@theme`), sans `tailwind.config.js`. Plugin PostCSS `@tailwindcss/postcss`. |
| Better Auth | Noms des options (session, rateLimit, admin, additionalFields, databaseHooks, trustedOrigins, advanced.ipAddress), commande de la CLI de génération, API admin (`setUserPassword`, `banUser`, `setRole`, `revokeUserSessions`), plugin `nextCookies`, lecture du cookie dans le proxy (`getSessionCookie`). |
| Drizzle | Mode `number` pour `numeric` ; pilotes `node-postgres` et `pglite` ; type commun `PgDatabase`. |
| PGlite dans Next | `serverExternalPackages` obligatoire. Si PGlite pose problème sous `next start`, repli : une branche Neon `test` dédiée aux tests de bout en bout (nouvelle intervention humaine à proposer à l'utilisateur). |
| `@vercel/functions` | `attachDatabasePool` sert à libérer proprement les connexions avec le calcul « Fluid ». S'il n'est pas disponible, utiliser un pool de petite taille (`max: 5`) et un délai d'inactivité court. |
| Vercel : commande de build | `vercel.json` → `buildCommand`. Vérifier dans les logs de build que la migration s'exécute bien avant `next build`. |
| Cookies de 400 jours | Chrome plafonne la durée d'un cookie à 400 jours : ne pas dépasser. |
| Heures d'été et d'hiver | Toujours passer par `@date-fns/tz`. Ne jamais construire une date « Paris » en ajoutant +1 ou +2 heures à la main. |
| Chat : interrogation périodique (É8d) | Pas de WebSocket sur les fonctions Vercel : la page interroge `GET /api/chat`, seulement onglet visible et personne active (§5.15). Chaque appel est une invocation de fonction Vercel et réveille la base Neon (mise en veille après quelques minutes sans requête) : vérifier les quotas des offres gratuites au moment de l'étape et garder l'intervalle de 10 s au minimum. Ne pas utiliser une Server Action pour interroger le serveur : Next les exécute l'une après l'autre, elles bloqueraient l'envoi d'un message. |
| Emojis (É8d) | Une longueur JavaScript (`.length`) compte les unités UTF-16 : un emoji en vaut 2. Compter en points de code (`[...texte].length`), comme `char_length` de PostgreSQL. Certains emojis composés (familles, drapeaux) comptent plusieurs points de code : sans importance avec la palette choisie. |
| Streaming et `loading.tsx` (É8) | Une page sous un `loading.tsx` part en streaming : un `notFound()` appelé dans la page donne un code 200 (avec `noindex`). Le contrôle se fait dans un `layout.tsx` du même dossier, avant le squelette (§8.3). Quand le navigateur quitte une page avant la fin de son streaming, le serveur journalise `Error: The destination stream closed early.` (React abandonne le rendu) : sans conséquence pour le joueur, visible dans les journaux de Vercel et des tests de bout en bout. |

---

## Annexe A. Glossaire français → code

| Français | Code |
|---|---|
| Saison | `season` |
| Catégorie | `category` |
| Question | `question` |
| Réponse possible | `questionOption` |
| Prono | `prediction` |
| Enregistré / validé | `saved` / `validated` |
| Joker | `joker` |
| Jokers autorisés (saison) | `jokersEnabled` |
| Malus | `malus` ; malus de base `baseMalus` ; malus d'une question `total` |
| Malus d'une mauvaise réponse | `wrongAnswerMalus` |
| Malus d'absence (pire prono) | `absentMalus` |
| Prolongation | `extension` (`questionExtension`) |
| Rang de proximité | `podiumRank` |
| Juste Prix (supprimé en v1.2) | `priceIsRight` (colonne conservée, toujours `false`) |
| Dans le mille | `bullseye` |
| Bonus podium (supprimé en v1.2) | `podiumBonus` |
| Écart relatif | `relativeError` |
| Chat, message, message de résultat | `chat`, `chatMessage`, `result` (`chat_message_kind`) |
| Non lus | `unread` (`chat_read`) |
| Sagesse de la foule | `crowd` |
| Classement | `standings` |
| Palmarès | `seasonStanding` / `palmares` (route) |
| Proclamer | `proclaim` |
| Liste blanche | `allowedEmail` |
| Annonce | `announcement` |
| Lot | `prize` |
| Désactiver | `disable` (ban Better Auth) |
| Déverrouiller | `unlock` |
| Pastille Nouveau | `isNew` |
| Compte à rebours | `countdown` |

## Annexe B. Gabarit de préparation des questions

À remplir par l'admin, par exemple dans un tableur, avant la saisie (H-11). Une ligne par question.

| Champ | Exemple | Conseil |
|---|---|---|
| Catégorie | Candidatures | Réutiliser les mêmes catégories d'une année sur l'autre. |
| Type | Nombre / Choix / Oui-Non | Le malus d'une question à nombre est l'écart brut (v1.2) : une question sur des milliers (candidatures) pèse bien plus qu'une question sur des dizaines (JPO) ou sur un taux. En tenir compte dans le choix des questions et des coefficients. |
| Énoncé | Combien de candidatures au total au 31 mai 2027 ? | Une seule question, sans ambiguïté, avec la date. |
| Description | Toutes filières confondues, hors désistements. | Préciser le périmètre. |
| Unité | candidatures | Au pluriel. |
| Réponses possibles (choix) | Programme A / Programme B / Programme C | Entre 2 et 6 réponses. |
| Malus d'une mauvaise réponse (choix) | 100 | Obligatoire (v1.2). Le comparer aux écarts attendus sur les questions à nombre de la saison : quelques dizaines pour une JPO, quelques centaines pour des candidatures. |
| Source de la valeur réelle | Tableau BI « Candidatures », total au 31/05/2027 à minuit | **Une source unique et incontestable.** |
| Lien BI | https://… | Le tableau exact, pas l'accueil du BI. |
| Valeur de l'an dernier | 2 318 | Même périmètre et même date que la question. |
| Indice | Compare le rythme d'octobre à celui de l'an dernier. | Il fait chercher sans donner la réponse. |
| Coefficient | 1, 2 ou 3 | Réserver ×3 à 1 ou 2 grosses questions. |
| Ouverture | 14/10/2026 9:00 | Heure de Paris. |
| Clôture | 21/10/2026 18:00 | **Bien avant le résultat**, pour obliger à extrapoler. |
| Résultat prévu | 01/06/2027 | Date à laquelle tu pourras saisir la valeur. |

À éviter : une question dont la réponse est déjà connue d'un membre de l'équipe au moment de la clôture, deux questions presque identiques. (La v1.1 déconseillait aussi une réponse qui peut valoir 0 ; avec l'écart brut de la v1.2, ce n'est plus un problème.)
