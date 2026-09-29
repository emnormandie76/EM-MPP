# Le Bon Chiffre (dépôt EM-MPP)

Site de pronostics interne pour une équipe de l'EM Normandie (20 joueurs au plus). L'admin crée des questions sur les chiffres de l'école (participants à une JPO, candidatures, intégrés…), les joueurs pronostiquent et un classement désigne les gagnants. Les saisons basculent automatiquement au 30 septembre. Lancement le 14 octobre 2026. Next.js sur Vercel, base Neon. Le site n'envoie aucun email.

## Documents de référence

| Document | Rôle |
|---|---|
| [docs/features/cahier-des-charges.md](docs/features/cahier-des-charges.md) | Règles fonctionnelles (v1.0, validée) : le **quoi** |
| [docs/architecture/architecture.md](docs/architecture/architecture.md) | Référence technique et plan de construction par étapes : le **comment** |
| [docs/architecture/avancement.md](docs/architecture/avancement.md) | Étape en cours, interventions humaines faites, journal des décisions |
| [docs/design/maquette-b5/](docs/design/maquette-b5/) | Maquette visuelle retenue (style B5 « Jour de match ») |

## Phase en cours

Construction, étape par étape (architecture §11). **Avant de commencer l'étape 1, obtenir le feu vert de l'utilisateur sur le document d'architecture (intervention H-02).** L'étape en cours est indiquée dans `avancement.md`.

## Règles pour tout agent

1. Lire `avancement.md`, puis les sections 0 à 10 de l'architecture et la section de l'étape en cours, avant toute action.
2. Une étape à la fois. Ne pas commencer la suivante tant que les critères de passage ne sont pas tous remplis **et** que l'utilisateur n'a pas validé.
3. Interventions humaines (H-xx, architecture §12) : s'arrêter, guider l'utilisateur pas à pas, ne jamais lui demander de secret dans le chat, vérifier, puis consigner dans `avancement.md`.
4. Ne pas s'écarter de l'architecture ni du cahier des charges de sa propre initiative. En cas de doute ou de contradiction : exposer le problème avec deux options et une recommandation, puis consigner la décision dans le journal.
5. Un test qui échoue ne se désactive pas et ne s'affaiblit pas.
6. En fin d'étape : `npm run verify`, `npm run test:e2e`, mise à jour de `avancement.md`, compte rendu, puis validation H-08.

## Modèle

Tout le projet se fait avec **Opus 5.5 en effort extra high** : réflexion, architecture, code et revue. Si la session tourne sur un autre modèle ou un autre niveau d'effort, le signaler à l'utilisateur en début de session.

## Conventions

- Échanges et documentation en français.
- Code en anglais (variables, fonctions, fichiers, messages de commit). Textes de l'interface en français, avec tutoiement. Jamais « pari » ni « mise ».
- Le poste de développement est sous Windows : scripts npm multiplateformes.
- Ne jamais lire, afficher ni committer de secrets. Le fichier `.env` existant appartient à l'utilisateur : ne pas y toucher. Les variables locales sont dans `.env.local` (`vercel env pull`).
- Pas de commit ni de push sans demande explicite de l'utilisateur. Une branche par étape (`etape-0N-…`).

## Commandes

Disponibles à partir de l'étape 1 (liste complète : architecture §3.2).

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run verify` | lint, types, tests unitaires et d'intégration, build : porte de chaque étape |
| `npm run test:e2e` | tests de bout en bout (Playwright, base PGlite locale) |
| `npm run db:generate` / `npm run db:migrate` | nouvelle migration / application sur la base de `.env.local` |
| `npm run db:seed -- --yes` | efface et remplit la base de développement (refusé en production) |
| `npm run check:env` / `npm run db:check` | contrôle des variables / de la connexion à la base |
