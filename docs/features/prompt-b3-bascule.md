# Prompt — Étape B3 : la bascule en production (chantier « Connexion par le portail »)

> Rédigé le 09/11/2026 par l'agent de B2, pour l'agent suivant, au contexte vidé. À lancer par : « Lis `docs/features/prompt-b3-bascule.md` et exécute-le. »

## 1. Ta mission

Faire passer **la production de MPPlike** (https://les-petits-pronos-de-la-promo.vercel.app) sur la connexion par le Portail admission. C'est le temps 3 de la bascule (G19) : le client `production` au portail, les variables de Production, puis le déploiement, **en une même séance avec l'utilisateur** (H-22). Le code est fini et testé depuis B1 ; B3 ne devrait pas demander de code.

Une étape à la fois : B3 seulement. B4 (documents remis d'accord et migration destructive) revient à un autre agent, après ta validation.

## 2. À lire avant toute action

1. `CLAUDE.md` (chargé d'office). Signale à l'utilisateur, en début de session, le modèle et le niveau d'effort si ce n'est pas Opus 5.5 en effort extra high.
2. `docs/architecture/avancement.md` : le tableau des étapes (B0 à B2 validées), les **points ouverts** (le premier bloc, « Étape suivante : B3 »), les interventions H-18 à H-22, la fin du journal.
3. `docs/features/branchement-portail.md`, **en entier** : décisions G1 à G22 (du portail, **à ne pas rediscuter**), D1 à D26, déclaration (§6), étape B3 (§8), points ouverts (§10, surtout 3 et 10), journal.
4. `docs/architecture/architecture.md` : sections 0 à 10 ; en particulier §0.3 (protocole des interventions), §0.4 (Git et migrations), §3.4 (migrations au build, garde-fou D21), §6 (connexion et déconnexion par le portail).

## 3. Point de départ attendu (à vérifier, pas à croire)

- Branche `etape-b2-export` poussée, arbre propre ; elle contient B1 et B2. `origin/main` = `8c93039`, ancêtre de cette branche (avance rapide possible), et c'est ce commit que sert la production, à 6 migrations, sans aucun compte `portail`.
- Base Neon `dev` à 7 migrations (la `0006`, qui vide `session`, y est jouée depuis B1). La production atteindra 7 migrations au build de la bascule.
- Au portail de production : `mpplike` déclarée, restreinte, rôles `player` et `admin`, clients `recette` et `dev` ; comptes importés le 09/11 (20 cases : 14 `player`, 6 `admin`) ; **adresse d'accueil déjà sur la production** (H-20). **Pas encore de client `production`.**
- Sur Vercel, Production : pas de `PORTAIL_*` ; `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`… présentes ; `ADMIN_EMAILS` encore là (plus lue par le code depuis B1). Lis les **noms** seulement (outil Vercel `filter_project_envs`, jamais `decrypt`).

Outils : projet Vercel `les-petits-pronos-de-la-promo` (équipe `em-normandie1`) ; projet Neon `gentle-thunder-89807010`, branche `main` = production (requêtes `SELECT` seulement, D11).

## 4. Déroulé proposé

Annonce d'abord à l'utilisateur l'objectif, la durée (une séance d'environ 1 h 30, dont 30 min de vérifications) et les interventions (H-22), comme le veut le §0.2. Propose ce déroulé et attends son accord.

### 4.1 Préparation, sans rien changer à la production

1. Propose une branche `etape-b3-bascule`, créée depuis `etape-b2-export` (une branche par étape).
2. Relance `npm run verify` et `npm run test:e2e`. Un test qui échoue ne se désactive pas et ne s'affaiblit pas : cherche la cause (la trace Playwright de `test-results/` aide).
3. **Point ouvert 10 du chantier** : relis la production en lecture seule (nombres seulement, jamais d'adresse dans les documents ni dans le chat). Compare-la à l'export du 06/11 à 16 h 31 : comptes créés ou modifiés, adresses ajoutées à `allowed_email`, rôles (`user.role`), bannis, anonymisés (adresse en `@invalid.local`, voir `isAnonymized` dans `src/lib/services/users.ts`). Au 09/11 : 18 comptes (6 `admin`, 12 `player`), 18 adresses dont 2 sans compte, rien après l'export. Tout écart se reporte dans la grille du portail **par l'utilisateur** (G18), avant la bascule.
4. Prépare le **retour arrière** et dis-le à l'utilisateur avant de commencer : sur Vercel, remettre en production le déploiement de `8c93039` (« Instant Rollback »). L'ancien code marche encore, car les mots de passe et `allowed_email` restent jusqu'à B4 (D9) ; la `0006` aura seulement vidé les sessions (tout le monde se reconnecte). Les variables `PORTAIL_*` ajoutées ne gênent pas l'ancien code.

### 4.2 H-22, par l'utilisateur, guidé pas à pas (§0.3)

1. **Client `production`** au portail, créé par l'utilisateur avec l'agent du portail (G18 : tu ne touches jamais à l'administration du portail, même dans sa session Chrome). Adresses exactes du §6 du chantier :
   - retour : `https://les-petits-pronos-de-la-promo.vercel.app/api/auth/callback/portail` ;
   - déconnexion : `https://les-petits-pronos-de-la-promo.vercel.app/connexion`.
2. **Variables de Production** posées par l'utilisateur sur Vercel, environnement Production seulement : `PORTAIL_ISSUER` = `https://portail-admission.vercel.app/api/auth` ; `PORTAIL_CLIENT_ID` et `PORTAIL_CLIENT_SECRET` du client `production` (Sensitive). `BETTER_AUTH_URL` ne change pas. **Ne demande jamais le secret et ne lis aucune valeur.** Une variable ne vaut que pour les déploiements suivants : les poser avant la fusion ne change rien au site en ligne.
3. Relis avec lui les **noms** et les environnements (D15) : les trois `PORTAIL_*` en Production, rien d'autre de changé.

### 4.3 La bascule, sur demande explicite de l'utilisateur

1. Avance `main` jusqu'à la branche de B3 (avance rapide), puis pousse `main` : c'est le déploiement de production. Ne le fais qu'une fois H-22 vérifiée, et seulement à sa demande.
2. Suis le déploiement (outil Vercel) : prêt, et au journal du build « Migrations : 1 appliquée(s), 7 au total », sur la base de production. Hors de Production, le garde-fou D21 refuse une base marquée production ; en Production, la migration passe.

### 4.4 Vérifications

1. `/api/health` à `ok: true` ; `/connexion` montre « Se connecter avec le portail ». Fumée en production : `BASE_URL=https://les-petits-pronos-de-la-promo.vercel.app npx playwright test e2e/prod-smoke.spec.ts` (lecture seule ; si le contrôle des permissions te la refuse, l'utilisateur la lance).
2. **Sessions d'avant la bascule** (D6) : en lecture seule, aucune ligne de `session` créée avant le déploiement.
3. **Essai en ligne avec l'utilisateur, qui se connecte lui-même** (aucun compte de test en production, G21) : connexion par le portail et par la tuile (connexion silencieuse, D20) ; son compte existant se lie par l'adresse (D2 : une ligne `account` `portail` de plus, aucun compte en double) ; rôle `admin` ; refus pour qui n'a pas accès ; retrait d'accès dans la grille (refus à la connexion suivante, G6), puis rétablissement ; déconnexion (retour sur `/connexion`). Les changements de grille sont faits par l'utilisateur.
4. **Premiers joueurs observés**, en lecture seule : nombre de liens `portail`, aucun compte créé en double pour les 18 comptes existants (seules les 2 adresses sans compte peuvent en créer), erreurs d'exécution sur Vercel (`get_runtime_errors`).
5. Puis l'utilisateur retire `ADMIN_EMAILS` (Production, Preview, Development : plus aucun code ne la lit, `check:env` ne la demande pas). Point ouvert 3 : `BETTER_AUTH_URL` en Development vaut sans doute `http://localhost:3000`, à passer à 3003 s'il tire encore `.env.local` par `vercel env pull`.
6. L'utilisateur annonce au portail que le temps 3 est fait : son agent vérifie de son côté (G7).

### 4.5 Fin d'étape

Coche les cases de B3 (§8 du chantier), mets à jour `avancement.md` (tableau, H-22, points ouverts pour l'agent de B4, journal) et le journal du chantier : commit déployé, migrations, noms des variables posées, essais et leurs résultats, écarts. Compte rendu, puis validation H-08. Ne commence pas B4.

## 5. Interdits

- Rediscuter G1 à G22 ; s'écarter de D1 à D26 sans exposer deux options et une recommandation, puis consigner la décision.
- Lire, demander ou écrire `PORTAIL_CLIENT_SECRET` ou toute autre valeur secrète ; lire `.env` ; afficher `.env.local`.
- Écrire dans `../portail`, appeler un outil MCP sur les ressources du portail (dépôt, projet Vercel, projet Neon `portail-admission`), travailler dans son administration (G7, G18). Lire `../portail` est permis.
- Écrire dans la base de production, ou y lancer autre chose que des `SELECT` ; mettre une adresse dans un document.
- Commiter ou pousser sans demande explicite ; pousser `main` avant H-22 vérifiée.
- Une migration destructive (c'est B4, avec l'accord explicite de l'utilisateur).

## 6. À savoir

- **Un problème pendant la bascule** : arrête-toi, expose deux options (correction ou retour arrière par Instant Rollback) avec ta recommandation, et laisse l'utilisateur trancher.
- **Première connexion d'un joueur au portail** (G17) : lancée depuis MPPlike, elle finit sur l'accueil du portail ; la tuile le ramène. Rien à coder.
- **Un compte du portail qui n'a jamais fait sa première connexion** n'entre nulle part : le portail l'a signalé pour une personne de la liste au 09/11 (message de H-21).
- **« Logout error »** (G22) : en anglais, sans retour, quand le jeton ne vaut pas pour le client. Jusqu'ici dû au partage de la base `dev` entre `recette` et `dev` ; en production, seulement après un changement du secret.
- **Aperçu de `etape-b2-export`** : sans variables propres, on ne peut pas s'y connecter. Les essais avant la bascule restent sur l'adresse fixe de `etape-b1-oidc` (D14).
- **Tests de bout en bout qui pilotent l'horloge d'une page** : attendre un signe de l'hydratation (une requête partie d'un effet), jamais le seul affichage (correction du 09/11 dans `e2e/chat.spec.ts`).
- **Mémoire de l'utilisateur** : il veut être challengé une fois, puis voir sa décision appliquée sans rouvrir le débat ; il avance étape par étape, un agent par étape.
