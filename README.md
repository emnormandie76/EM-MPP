# Les petits pronos de la promo

Site de pronostics interne d'une équipe de l'EM Normandie. L'admin pose des questions sur les chiffres de l'école (participants à une JPO, candidatures, intégrés…), les joueurs pronostiquent et un classement désigne les meilleurs de la saison.

Next.js (App Router) et Tailwind CSS v4, hébergé sur Vercel, base PostgreSQL Neon.

## Prérequis

- **Node.js 24** (LTS). La version est fixée par `.node-version` (lu par fnm) et par `engines` dans `package.json` (lu par Vercel).
- **Git**.
- Pour les commandes liées à la base : un fichier `.env.local`, récupéré avec `vercel env pull .env.local` (voir `.env.example` pour la liste des variables). Ne jamais le committer.
- Sur un réseau qui bloque le port 5432 de PostgreSQL (celui de l'EM Normandie) : un fichier `.env.development.local` contenant `DB_DRIVER=neon-ws`. En local, la base Neon est alors jointe en WebSocket, par le port 443.

Première installation :

```bash
npm install
npx playwright install chromium
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (http://localhost:3000) |
| `npm run build` / `npm start` | build de production et démarrage |
| `npm run lint` | ESLint |
| `npm run typecheck` | génération des types de routes Next.js, puis TypeScript |
| `npm test` | tests unitaires et d'intégration (Vitest) |
| `npm run test:watch` | Vitest en continu |
| `npm run test:coverage` | tests avec seuils de couverture |
| `npm run test:e2e` | tests de bout en bout (Playwright, http://localhost:3100) |
| `npm run verify` | lint, types, tests, build : porte de sortie de chaque étape |
| `npm run check:env` | contrôle des variables de `.env.local` (affiche les noms, jamais les valeurs) |
| `npm run db:check` | test de connexion à la base, sans afficher l'URL |
| `npm run db:generate` | nouvelle migration après un changement de schéma |
| `npm run db:migrate` | applique les migrations sur la base de `.env.local` |
| `npm run db:seed -- --yes` | **efface** la base de développement de `.env.local` et la remplit avec les données de test (refusé sur la production) |
| `npm run build:vercel` | build Vercel : migrations, puis build (lancé par Vercel) |

La liste complète se trouve dans l'[architecture, §3.2](docs/architecture/architecture.md#32-scripts-npm).

Comptes du seed (mot de passe `Test-1234!`) : `admin@example.test` (admin), `joueur1@example.test` à `joueur8@example.test`, `desactive@example.test` (compte désactivé). `nouveau1@example.test` est sur la liste blanche, sans compte : il peut s'inscrire sur `/inscription`.

## Schéma de la base

- Tables de l'application : `src/lib/db/schema/app.ts`. Après une modification : `npm run db:generate`, relire le SQL produit dans `drizzle/`, puis `npm run db:migrate`.
- Tables de Better Auth : `src/lib/db/schema/auth.ts`, généré à partir de la configuration de `src/lib/auth/auth.ts` (la CLI lit l'instance exportée par `src/lib/auth/auth-cli.ts`). Après un changement de configuration qui touche les tables :

  ```bash
  DB_DRIVER=pglite npx auth@1.7.6 generate --config src/lib/auth/auth-cli.ts --output src/lib/db/schema/auth.ts
  ```

  puis repasser toutes les colonnes `timestamp(...)` en `{ withTimezone: true }` (un test le vérifie), et générer la migration.

## Documentation

- [Cahier des charges](docs/features/cahier-des-charges.md) : les règles du jeu (le **quoi**).
- [Architecture et plan de construction](docs/architecture/architecture.md) : la référence technique (le **comment**).
- [Avancement](docs/architecture/avancement.md) : l'étape en cours et le journal des décisions.
- [Maquette B5 « Jour de match »](docs/design/maquette-b5/) : l'apparence de référence.
