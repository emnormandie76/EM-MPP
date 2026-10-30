# Chantier — Connexion par le portail

> **Source** : prompt guidé P-03 du portail (`../portail/docs/prompts/P-03-MPPlike-connexion-portail.md`, émis le 2026-10-30), **contrat portail v1** (précisé le 2026-10-29).
> **Ouvert le** 30/10/2026. **B0 validée le 30/10/2026** ; **prochaine étape** : B1 (le branchement, sur le poste).
> Le portail est le fournisseur de connexion des applications de l'équipe ; il lit ce dépôt et n'y écrit jamais (G7). Ce fichier porte les décisions du chantier, ses étapes à cocher et son journal. Le suivi général reste dans [avancement.md](../architecture/avancement.md) (étapes B0 à B4).

## 1. Objet

MPPlike ne gère plus de comptes : on s'y connecte par le **Portail admission** (<https://portail-admission.vercel.app>), fournisseur d'identité OIDC et seule source des accès. Disparaissent : la connexion par adresse et mot de passe, l'inscription, la liste des adresses autorisées, `ADMIN_EMAILS`, le changement de mot de passe, et la gestion des comptes de `/admin/joueurs` (rôle, désactivation, mot de passe provisoire). Le portail transmet l'identité (`sub`, adresse, nom) et le rôle (`player` ou `admin`) ; le sens des rôles et leurs gardes restent dans MPPlike (`requireUser`, `requireAdmin`, contrôles des services). Tout le jeu reste tel quel.

MPPlike est déjà en ligne : le branchement est une **bascule en trois temps** (G19) : le code sur le poste avec le client `dev`, puis l'import des comptes dans le portail, puis le client `production` et le déploiement dans une même séance avec le propriétaire.

## 2. Point de départ (B0, relevé du 30/10/2026)

**Dépôt**
- `main` = `origin/main` = `dcedd21` (« Accept only number characters in the prediction field », 13/10/2026 à 15 h 01), arbre de travail propre. C'est le commit du relevé du portail : le code n'a pas bougé depuis.
- Branche de l'étape : `etape-b0-branchement-portail`, créée depuis `main` ; aucun commit (pas de commit sans demande).
- Versions installées : Better Auth 1.7.6 (et `@better-auth/core` 1.7.6, dans `node_modules/better-auth/node_modules`), Next.js 16.3.7.

**Production** (lecture seule : outil Vercel, requêtes HTTP publiques, outil Neon en `SELECT` avec l'accord du propriétaire, D11)
- Déploiement de `dcedd21` (créé le 13/10/2026 à 15 h 01), prêt, sert https://les-petits-pronos-de-la-promo.vercel.app. `/api/health` à `ok: true` ; `/api/chat` à 401 sans session ; `/` renvoie vers `/connexion` ; `/connexion` et `/inscription` à 200.
- Base `main` (Neon `neon-bisque-pillar`) : 6 migrations, marqueur « production ».
- **Jeu** : 1 saison, 2026-2027 (début le 02/10/2026, jokers désactivés) ; 5 questions, **toutes en brouillon** ; aucune question publiée, aucun prono, aucun résultat, aucun palmarès ; 4 messages dans le chat.
- **Comptes** : 4, tous actifs et **tous `admin`** (aucun `player`) ; aucun banni, aucun anonymisé ; aucune adresse hors `@em-normandie.fr` ; aucun compte de test ; `email_verified = false` sur les 4 ; pseudos de 30 caractères au plus ; 4 lignes `account` de type `credential`, aucun autre fournisseur ; dernière visite le 29/10/2026.
- **Liste des adresses** (`allowed_email`) : 17 adresses, toutes `@em-normandie.fr`, dont **15 sans compte**.
- **Sessions** : 8 sessions valables (pour les 4 comptes), la dernière jusqu'au 03/12/2027 (400 jours).
- Vercel : les aperçus sont protégés par la connexion Vercel (`all_except_custom_domains`). Neon : la branche `dev` est archivée depuis le 14/10/2026 (Neon la réactive au premier accès).

**L'É9 (recette et lancement) en vrai**
- `avancement.md` la marquait « À faire » au 13/10, alors que le site est en ligne.
- Selon le propriétaire (30/10) : H-10 (équipe inscrite), H-11 (campagne saisie), H-17 (questions de test supprimées), H-14 et H-15 (checklist et annonce) sont faites. H-12 (recette avec des collègues) et H-13 (relecture des textes) ne sont pas signalées.
- Ce que montre la base : H-17 est faite (il ne reste aucune des questions n° 1, 2 et 4) ; la liste compte 17 adresses, mais 2 seulement des personnes invitées ont un compte ; la campagne est en brouillon (5 questions, aucune publiée).
- L'É10 (règles par saison) est « À faire » ; aucun résultat n'est saisi, donc les règles de 2026-2027 ne sont pas figées.

## 3. Décisions du propriétaire, à ne pas rediscuter (portail)

Décisions du propriétaire, **à ne pas rediscuter**, copiées telles quelles du plan du portail par P-03 §2. Les renvois (« piège 1 », « D13 ») désignent le plan du portail. Ne concernent pas MPPlike : portail D26, D28, D30, D32.

| N° | Source | Décision |
|---|---|---|
| G1 | portail G1 | **Le portail est le fournisseur d'identité OIDC des applications** (connexion par redirections). Chaque application reste un projet Vercel séparé : ses variables, sa base, et la possibilité de la retirer. Écarté : un serveur unique pour tout ; un cookie partagé sur un domaine commun, impossible en `*.vercel.app` (piège 1) et qui obligerait toutes les applications à partager le même format de session. |
| G2 | portail G2 | **Le portail est la seule source des accès** : une grille personne × application × rôle. Les échanges vont dans un seul sens : la connexion OIDC (le portail transmet l'identité et le rôle) et l'annuaire en lecture (l'application consulte le portail). Chaque application déclare la liste de ses rôles, mais leur sens reste dans l'application (ses gardes). Écarté : la synchronisation des rôles dans les deux sens (conflits, boucles, écarts silencieux) ; les écrans de comptes et les listes blanches dans les applications. |
| G3 | portail G3 | **Seul le super-admin gère les accès.** Écarté : une délégation par application. |
| G4 | portail G4 | **Seules les adresses `@em-normandie.fr` sont acceptées**, sans exception. |
| G5 | portail G5 | **Une application peut être restreinte** : pour qui n'y a pas accès, elle n'apparaît pas sur le portail, et le portail refuse de l'y connecter. |
| G6 | portail G6 | **Un accès retiré prend effet à la prochaine connexion à l'application.** Écarté : une notification immédiate du portail vers l'application. Conséquence : les sessions des applications restent courtes (8 h ; MPPlike passe de 400 jours à 8 h, piège 8). |
| G7 | portail G7 | **L'agent du portail lit les autres applications et n'y écrit jamais.** Il rédige des prompts guidés pour leurs agents (`prompts/README.md`). Pour le retour, le propriétaire annonce « P-xx fait » ; l'agent du portail vérifie lui-même, en lecture seule (journal, cases et commit de l'application), puis consigne. |
| G8 | portail G9 | **appVoiture et les futures applications se connectent directement par le portail**, sans méthode de connexion propre. |
| G9 | portail D5 | **Comme appVC** : adresse et mot de passe choisi à la première connexion, sans e-mail ni preuve de possession. **Risque résiduel accepté** : qui connaît l'adresse d'un invité peut choisir le mot de passe avant lui. En plus, **le super-admin peut changer l'adresse** d'une personne ; `sub` ne change pas. |
| G10 | portail D6 | **Mode « ouverte » par application** : tout compte actif y entre avec le rôle par défaut ; un rôle de la grille l'emporte. |
| G11 | portail D8 | **Import par un fichier d'export** que l'agent de chaque application produit à son branchement (adresse, nom, rôle) ; le portail fusionne par adresse, avec l'accord du propriétaire. Comptes importés « invités » ; comptes sans adresse de l'école comptés, pas importés. |
| G12 | portail D10 | **Adresses de retour exactes seulement** : la production, l'adresse fixe d'**une** branche de recette, et un client `dev` limité à `localhost`. Les autres Preview n'ont pas de connexion. |
| G13 | portail D11 | **Les joueurs de MPPlike ont tous une adresse `@em-normandie.fr`** (dit par le propriétaire) : G4 ne leur retire rien. L'export de D8 le vérifiera, car il compte les adresses hors domaine. |
| G14 | portail D14 | **Adresse de production : `https://portail-admission.vercel.app`**, d'où `PORTAIL_ISSUER` = `https://portail-admission.vercel.app/api/auth` dans toutes les applications. Libre le 2026-10-28, c'est le nom du projet (D13) : Vercel l'attribue seul, sans domaine à ajouter ni redirection. Elle ne change plus : la changer oblige à reconfigurer chaque application. |
| G15 | portail D19 | **À l'import, la grille l'emporte** : une case déjà donnée garde son rôle, même si le fichier en dit un autre. L'aperçu montre le conflit ; le super-admin change la case à la main s'il le veut (G2). |
| G16 | portail D20 | **Un rôle inconnu refuse le fichier entier** : rien ne s'applique tant que le fichier ou la déclaration n'est pas corrigé ; l'aperçu nomme les lignes. |
| G17 | portail D27 | **Une première connexion lancée depuis une application finit sur l'accueil du portail** : la demande de l'application se perd, la tuile la ramène (connexion silencieuse). Rien à coder dans l'application. |
| G18 | portail D29 | **L'agent d'une application ne travaille jamais dans l'administration du portail**, même dans la session du propriétaire : quand un réglage du portail doit changer pendant son chantier (annuaire, grille, client), il prévient le propriétaire, qui le fait lui-même ou le confie à l'agent du portail. |
| G19 | portail D31 | **Une application déjà en ligne se branche par une bascule en trois temps** : (1) le code sur le poste, avec le seul client `dev` ; (2) l'import de ses comptes dans le portail **avant** la bascule, pour que chacun choisisse son mot de passe du portail (D5) pendant que l'ancienne connexion marche encore ; (3) le client `production`, les variables et le déploiement dans une même séance avec le propriétaire. Pas de connexion locale gardée « en secours » : le contrat l'interdit (G9). Écarté : tout dans une séance (chacun découvrirait sa première connexion au portail au moment même où l'application change). |
| G20 | portail D33 | **MPPlike est déclarée « restreinte »**, avec l'import de ses comptes : seules les personnes de sa liste actuelle (ses comptes et les adresses autorisées) y entrent, avec leur rôle (`player`, `admin`) ; le super-admin ajoute les suivantes dans la grille. Écarté : « ouverte » avec `player` par défaut (plus large que la liste d'aujourd'hui). |
## 4. Contrat appliqué

**Contrat portail v1**, précisé le 2026-10-29. Source : `../portail/docs/architecture/contrat-apps.md` ; copie figée au §3 de P-03. Il ne se discute pas dans ce dépôt : un point qui ne convient pas se signale au propriétaire, et le portail émet un prompt correctif ou une nouvelle version. L'essentiel pour MPPlike :

- émetteur `PORTAIL_ISSUER` = `https://portail-admission.vercel.app/api/auth`, comparé exactement ; adresses lues dans `<émetteur>/.well-known/openid-configuration` ;
- code d'autorisation avec PKCE S256, `state` et `nonce` ; client confidentiel en `client_secret_basic` ; scopes `openid profile email`, sans `offline_access` ; jeton d'identité RS256 vérifié (`iss`, `aud`, `exp`, `nonce`) ;
- champs `sub` (clé de rapprochement), `email` (minuscules, peut changer), `name`, `role` ; ne pas s'appuyer sur `email_verified` ;
- rapprochement : par `sub`, sinon la première fois par l'adresse (puis enregistrer `sub`), sinon création ; une adresse déjà liée à un autre `sub` est refusée et consignée ;
- rôle recopié à chaque connexion ; sessions de 8 h au plus depuis la connexion, jamais prolongées ;
- erreur au retour (`error`) : message neutre et lien vers le portail, sans boucler ;
- déconnexion par `end_session_endpoint` avec `id_token_hint`, `client_id`, `post_logout_redirect_uri` exacte ;
- variables `PORTAIL_ISSUER`, `PORTAIL_CLIENT_ID`, `PORTAIL_CLIENT_SECRET`, posées par le propriétaire ; le secret n'est jamais lu, demandé ni écrit ailleurs ;
- fichier d'export JSON `[ { "email", "name", "role" } ]`, hors de Git.

## 5. Décisions de MPPlike (réponses aux questions de P-03 §6)

Tranchées par le propriétaire le 30/10/2026, en questions à cocher ; chaque fois, il a retenu la recommandation.

| N° | Question | Décision |
|---|---|---|
| D1 | **Déclaration** au portail | Identifiant `mpplike` (il ne change plus) ; nom « Les petits pronos de la promo » (`APP_NAME`) ; description « Pronostics entre collègues sur les chiffres de l'école, avec un classement par saison. » ; adresse d'accueil `http://localhost:3003/` pendant B1, puis `https://les-petits-pronos-de-la-promo.vercel.app/` à la bascule ; rôles `player` (« Joueur ») et `admin` (« Admin »), clés écrites ainsi dans le code (`ROLES`) ; mode **restreinte** (G20). Pas d'annuaire. Écarté : l'identifiant `pronos`. |
| D2 | **Identité et rapprochement** | Le `sub` se range dans `account` (`provider_id = 'portail'`, `account_id = sub`), sans nouvelle colonne. `account.accountLinking.trustedProviders: ["portail"]` et `requireLocalEmailVerified: false`, pour que les comptes existants (tous à `email_verified = false`) se lient par l'adresse sans s'appuyer sur `email_verified`. Un crochet refuse de lier un second compte `portail` à un même joueur (adresse réattribuée), avec une ligne au journal du serveur. Écarté : une colonne `portail_sub` sur `user` et un rapprochement codé à la main. |
| D3 | **Pseudo, adresse et rôle** | Le **pseudo reste à MPPlike** (unique sans tenir compte de la casse, 2 à 30 caractères, modifiable dans « Profil ») : c'est l'identité du jeu (classement, palmarès, chat). À la création, il part du nom du portail coupé à 30 caractères et rendu unique (« Prénom 2 ») ; il n'est jamais réécrit ensuite (pas d'`overrideUserInfo`). **L'adresse et le rôle** se recopient à chaque connexion, par le code de MPPlike ; un rôle hors de `ROLES` refuse la connexion. Écarté : le nom du portail recopié partout. |
| D4 | **Comptes désactivés et anonymisés** | La désactivation et sa levée disparaissent : l'accès se retire dans la grille du portail. Une connexion accordée par le portail **lève** une désactivation d'avant le portail. **L'anonymisation reste** une action de l'admin de MPPlike (le droit à l'effacement porte sur ses données) ; elle supprime aussi le lien `portail` du compte, pour qu'une personne qui reviendrait ait un compte neuf, jamais l'ancien ; l'accès, lui, se retire au portail. Écarté : garder une désactivation locale en plus de la grille. |
| D5 | **Comptes exportés** (G20) | Les comptes ni bannis ni anonymisés, avec une adresse `@em-normandie.fr`, avec leur rôle `user.role` et leur pseudo comme nom ; plus les adresses de la liste **sans compte**, en `player`, sans nom (le portail prend alors la partie avant `@`). Exclus et **comptés** : bannis, anonymisés, hors domaine, comptes de test. Au 30/10 : 4 comptes (tous `admin`) et 15 adresses, soit 19 lignes. Écarté : les comptes seulement. |
| D6 | **Sessions à la bascule** | Une migration qui vide `session`, jouée par `build:vercel` au déploiement de la bascule, **et** un préfixe de cookies propre, `mpplike` (`advanced.cookiePrefix`, repris par `getSessionCookie` dans le proxy) ; ensuite, sessions de 8 h fixes, sans renouvellement (`expiresIn` 8 h, `disableSessionRefresh: true`). Écartés : la migration seule (collision possible sur `localhost`), le préfixe seul (lignes valables en base jusqu'en 2027). |
| D7 | **Port du poste et client `recette`** | `npm run dev` sur le port fixe **3003** (3000 : portail, 3001 : appVC, 3002 : EM Drive). **Pas de client `recette`** pour commencer : les essais se font sur le poste avec le client `dev` ; un client pour une branche fixe pourra s'ajouter plus tard (G12). La recette sur l'aperçu avec les comptes du seed (H-07, H-12) s'arrête. Écarté : un client `recette` dès maintenant. |
| D8 | **Tests de bout en bout** | Aucun chemin de connexion de test dans l'application (G8, pas de connexion locale « en secours ») : la fixture pose la session directement dans la base PGlite, avec un cookie signé par le secret des tests ; le flux de connexion lui-même se prouve contre un faux fournisseur OIDC lancé par les tests. `prod-smoke.spec.ts` vérifie le bouton du portail au lieu du formulaire. Écarté : tous les tests par le faux fournisseur. |
| D9 | **Mots de passe et `allowed_email`** | Gardés jusqu'à la bascule vérifiée (revenir à l'ancien code reste possible), puis retirés à l'étape B4 par une migration (lignes `credential` de `account`, table `allowed_email`), une fois l'export fait. Migration destructive : l'accord explicite du propriétaire sera redemandé à ce moment (architecture §0.4). Écarté : les retirer dans la migration de bascule. |
| D10 | **Ordre avec l'É9 et l'É10**, numéros de migration | **Le chantier d'abord** (B1 à B4), puis l'É10. Raisons : aucune question publiée ni aucun résultat en production (les règles de 2026-2027 ne sont pas figées), et 15 des 17 invités n'ont pas encore de compte, donc plus la bascule vient tôt, moins de mots de passe sont créés pour rien. Jamais deux étapes à la fois. Les migrations du chantier prennent les premiers numéros libres (`0006` pour la bascule, puis celle de B4) ; l'É10 se renumérote ensuite, comme à l'É8h. La bascule ne croise pas le premier résultat de la saison. Écartés : l'É10 d'abord ; B1, puis l'É10, puis B2 à B4. |
| D11 | **Base du relevé et de l'export** | La production, en **lecture seule** (requêtes `SELECT` par l'outil Neon, branche `main`) : c'est la seule base avec les vrais joueurs. Seuls des nombres vont dans les documents, jamais d'adresse. Ajoutée par l'agent : P-03 demande de choisir cette base avec le propriétaire. Écarté : relever les nombres seulement à l'étape B2. |

## 6. Déclaration au portail (à transmettre)

Saisie par le super-admin du portail, avec l'agent du portail (G3, G18) ; l'agent de MPPlike ne la fait pas.

| Élément | Valeur |
|---|---|
| Identifiant | `mpplike` |
| Nom | Les petits pronos de la promo |
| Description | Pronostics entre collègues sur les chiffres de l'école, avec un classement par saison. |
| Adresse d'accueil | `http://localhost:3003/` pendant B1 ; `https://les-petits-pronos-de-la-promo.vercel.app/` à la bascule (B3) |
| Rôles | `player` (« Joueur »), `admin` (« Admin ») |
| Mode | restreinte |
| Client `dev` (B1) | retour `http://localhost:3003/api/auth/callback/portail` ; déconnexion `http://localhost:3003/connexion` |
| Client `production` (B3) | retour `https://les-petits-pronos-de-la-promo.vercel.app/api/auth/callback/portail` ; déconnexion `https://les-petits-pronos-de-la-promo.vercel.app/connexion` |
| Client `recette` | aucun (D7) |
| Annuaire | non (MPPlike ne cherche pas de collègue) |

## 7. Relevé de P-03 §4, revérifié le 30/10/2026

Revérifié sur `dcedd21`, dans le code et dans `node_modules/better-auth` 1.7.6. **Tout le relevé est confirmé**, fichier par fichier (§4.1), pour l'identité et les comptes (§4.2), les sessions (§4.3) et les douze points de Better Auth (§4.4). Écarts et compléments :

1. **Fichiers que le relevé ne cite pas** :
   - `src/lib/auth/auth-client.ts` : le client du navigateur (`createAuthClient`), appelé par `SignInForm` (`signIn.email`) et `SignUpForm` (`signUp.email`). Il servira à `signIn.social` ;
   - `src/lib/auth/auth-cli.ts` : le point d'entrée de la CLI qui régénère `src/lib/db/schema/auth.ts` ;
   - `src/components/layout/MainNav.tsx` : un second bouton de déconnexion (`signOutAction`), en plus de « Profil » ;
   - `src/lib/data/players.ts` (et `tests/integration/players-data.test.ts`) : la page `/admin/joueurs` y lit `allowed_email` ; `src/lib/actions/profile.ts` (actions du pseudo, de l'avatar et des visites, qui restent) ;
   - `/connexion` porte aussi « Mot de passe oublié ? Demande à l'admin un mot de passe provisoire. » et le lien « Créer mon compte » : ils partent.
2. **Port 3000 ailleurs que dans `npm run dev`** : `authBaseUrl` (`src/lib/auth/auth.ts`) se replie sur `http://localhost:3000`, `.env.example` donne `BETTER_AUTH_URL=http://localhost:3000`, le README cite 3000, et `BETTER_AUTH_URL` est posée sur Vercel en Development (H-06). Avec D7, la valeur du poste passe à `http://localhost:3003` (dans `.env.local`, par le propriétaire), sans quoi l'adresse de retour ne correspond pas à celle du client `dev`.
3. **Erreurs au retour (§4.4, point 11)** : avant de lire `state` (état absent, requête invalide), Better Auth renvoie vers `onAPIError.errorURL`, sinon vers `<baseURL>/error`, soit `/api/auth/error`, que le filtre HTTP de MPPlike (`http-paths.ts`) rend en 404. Il faut donc `onAPIError.errorURL` vers `/connexion`, en plus d'`errorCallbackURL` au départ du flux.
4. **Scopes et `sub` (§4.4, points 3 et 1)** : `openid` n'est ajouté d'office, et `sub` n'est pris comme identifiant, que si la découverte annonce `id_token_signing_alg_values_supported`. Les scopes seront écrits en entier (`openid profile email`) et un test vérifiera que `account_id` reçoit `sub`.
5. **Liaison par l'adresse (§4.2)** : `account.accountLinking.updateUserInfoOnLink` est désactivé par défaut. La première liaison d'un compte existant ne réécrit donc pas son pseudo, ce qui va dans le sens de D3. Le second `sub` lié au lieu d'être refusé est confirmé.
6. **Chemin d'un module (§4.4, point 4)** : `token-endpoint-auth.mjs` est dans `node_modules/better-auth/node_modules/@better-auth/core/dist/oauth2/` (core 1.7.6). Le constat ne change pas : `client_secret_post` par défaut avec un secret, `authentication: "basic"` pour `client_secret_basic`.
7. **Le chat après 8 h (§4.3, « à vérifier »)** : vérifié. Sur 401, `ChatRoom.tsx` mène à `/connexion`, et `ChatComposer.tsx` fait de même sur `NOT_AUTHENTICATED`.
8. **Les comptes (§1 et §4.2)** : « ses joueurs s'y connectent aujourd'hui » est à nuancer. En production, 4 comptes, tous `admin`, aucun `player`, aucune question publiée (§2 ci-dessus). G13 se vérifie : aucune adresse hors domaine.
9. **Le plan (§4.3)** : la saison 2026-2027 commence le 02/10/2026 en production (`avancement.md` disait le 30/09) ; sans effet sur le chantier.

## 8. Étapes

Une étape à la fois, sur sa branche (`etape-bN-…`), avec la porte habituelle (`npm run verify`, `npm run test:e2e`) et la validation H-08. Découpage de P-03 §5, repris avec les décisions ci-dessus ; un seul changement : la remise d'accord du cahier des charges et de l'architecture ouvre B1 (avant le code qui l'applique, règle 4 du `CLAUDE.md`) au lieu d'attendre B4, qui garde la remise d'accord finale.

### B0 — Point de départ (sans code)

- [x] Point de départ vérifié et consigné : commit, branche, arbre de travail ; ce qui est en production ; l'état réel de l'É9 (§2).
- [x] Relevé de P-03 §4 revérifié, écarts notés (§7).
- [x] Décisions du portail recopiées (G1 à G20), questions de P-03 §6 posées au propriétaire et consignées (D1 à D11).
- [x] Étapes écrites ici et dans `avancement.md`.
- [x] Compte rendu avec les éléments de P-03 §8.
- [x] Validation du propriétaire (H-08), le 30/10/2026.

### B1 — Le branchement, sur le poste (G19, temps 1)

- [ ] Cahier des charges v1.8 et architecture v1.8 (§3.1, §6, §9.4, §9.6, §12 ; « contrat portail v1 ») écrits avant le code, et soumis au propriétaire.
- [ ] H-18 : le propriétaire déclare MPPlike dans le portail (avec l'agent du portail, G18), selon le §6, avec son client `dev` ; puis H-19 : il pose `PORTAIL_ISSUER`, `PORTAIL_CLIENT_ID`, `PORTAIL_CLIENT_SECRET` et `BETTER_AUTH_URL=http://localhost:3003` dans `.env.local`. L'agent ne les demande pas et ne les lit pas ; `npm run check:env` vérifie leur présence.
- [ ] Tests d'abord : rapprochement par `sub`, puis par l'adresse (comptes locaux à `email_verified = false` compris), puis création ; refus d'une adresse déjà liée à un autre `sub` (consigné) ; rôle recopié à chaque connexion, rôle inconnu refusé ; adresse recopiée ; pseudo de départ coupé et rendu unique, jamais réécrit (D3) ; désactivation d'avant levée, compte anonymisé jamais rouvert (D4) ; session refusée après 8 h depuis la connexion, même relue entre-temps ; `/sign-in/social` qui ne bloque pas une IP partagée.
- [ ] Fournisseur « portail » (`genericOAuth`) : découverte, vérification du jeton exigée (`requireIdTokenVerification`), PKCE S256, `state`, `nonce`, `client_secret_basic`, scopes `openid profile email` ; découverte en échec traitée ; session de 8 h fixes ; préfixe `mpplike` (proxy compris) ; déconnexion par le portail ; `/connexion` (bouton du portail) et erreurs sans boucle (`onAPIError.errorURL`) ; chemins ouverts et publics ; règle de débit propre à `/sign-in/social` ; port 3003.
- [ ] Retrait de ce qui disparaît (P-03 §4.5), et mise à jour des tests, un par un, avec leur raison au journal ; tests de bout en bout selon D8.
- [ ] La migration `0006` qui vide `session` (D6) : jouée sur `dev` avec l'accord du propriétaire ; **pas sur la production** à ce stade (elle y partirait avec un déploiement).
- [ ] Essai sur le poste avec le portail de production, **le propriétaire se connectant lui-même** (aucun compte de test en production) : connexion, refus (sans accès), retrait d'accès (refus à la connexion suivante), déconnexion.

### B2 — L'export des comptes (G11, G19 temps 2)

- [ ] `export-portail-*.json` ajouté au `.gitignore` (absent à `dcedd21`), avant tout export.
- [ ] Le script qui produit `export-portail-mpplike.json`, **hors de Git**, en lecture seule sur la production (D11) ; rôles dans la liste déclarée ; comptes selon D5 ; adresses hors domaine ou anonymisées comptées, pas exportées ; aucun compte de test.
- [ ] H-20 : le propriétaire remet le fichier à l'agent du portail, qui l'importe avec lui (aperçu, puis application). L'agent de MPPlike n'importe rien.
- [ ] H-21 : le propriétaire prévient les joueurs : chacun se connecte une fois au portail et y choisit son mot de passe (G9), MPPlike marchant encore.

### B3 — La bascule en production (G19, temps 3)

- [ ] H-22, en une séance avec le propriétaire : le client `production` (adresses du §6) et l'adresse d'accueil réelle, au portail ; variables de Production `PORTAIL_ISSUER`, `PORTAIL_CLIENT_ID`, `PORTAIL_CLIENT_SECRET` posées par le propriétaire ; `BETTER_AUTH_URL` inchangée ; `ADMIN_EMAILS` retirée ensuite.
- [ ] Toutes les sessions d'avant la bascule cessent au déploiement (D6), vérifié en base.
- [ ] `main` avancée, déploiement prêt vérifié (migrations au build) ; essai en ligne avec le propriétaire : connexion, refus, retrait d'accès, déconnexion ; premiers joueurs observés.

### B4 — Les documents et le ménage

- [ ] Cahier des charges, architecture, README, `avancement.md`, `CLAUDE.md` remis d'accord avec le code livré.
- [ ] Mots de passe et `allowed_email` retirés par une migration (D9), avec l'accord explicite du propriétaire.

## 9. Interventions humaines du chantier

| ID | Intitulé | Étape |
|---|---|---|
| H-18 | Déclaration de MPPlike au portail et client `dev` (super-admin, avec l'agent du portail) | B1 |
| H-19 | Variables du portail et `BETTER_AUTH_URL` du poste dans `.env.local` | B1 |
| H-20 | Remise du fichier d'export à l'agent du portail et import | B2 |
| H-21 | Message aux joueurs : choisir son mot de passe sur le portail | B2 |
| H-22 | Bascule : client `production`, variables de Production, déploiement | B3 |

## 10. Points ouverts

1. **Arrivée par la tuile** (G17) : la tuile mène à `/`, que le proxy renvoie vers `/connexion`. Avec un simple bouton, il faut un clic de plus ; pour une connexion vraiment silencieuse, `/connexion` lancerait le flux d'elle-même quand l'adresse ne porte pas `error` (sans boucle, contrat §3.6). À trancher au début de B1, avec deux options et une recommandation.
2. **Quatre comptes `admin`** : l'export les déclarera `admin` (D5). Si certains doivent être `player`, le propriétaire le dit avant B2, ou corrige la case dans la grille du portail (G15).
3. **`BETTER_AUTH_URL` en Development sur Vercel** (H-06) : elle vaut probablement `http://localhost:3000` ; à remettre à 3003 si le propriétaire tire encore `.env.local` par `vercel env pull`.
4. **L'É9** : le propriétaire dira s'il la considère comme close (H-12 et H-13 non signalées, campagne en brouillon).

## 11. Journal

| Date | Décision | Origine |
|---|---|---|
| 30/10/2026 | Chantier ouvert sur le prompt guidé P-03 du portail (contrat portail v1), à l'endroit indiqué par P-03 §5 : ce fichier, étapes B0 à B4 dans `avancement.md`. Étape B0 sur la branche `etape-b0-branchement-portail`, créée depuis `main` (`dcedd21`), sans commit | propriétaire (P-03) |
| 30/10/2026 | Décisions du portail recopiées telles quelles en G1 à G20 (portail G1 à G7, G9, D5, D6, D8, D10, D11, D14, D19, D20, D27, D29, D31, D33) | portail (P-03 §2) |
| 30/10/2026 | D1 à D11 tranchées par le propriétaire, en questions à cocher, chaque fois sur la recommandation | propriétaire |
| 30/10/2026 | Relevé de la production en lecture seule (D11) : requêtes `SELECT` par l'outil Neon, aucune écriture, seuls des nombres consignés | agent, avec l'accord du propriétaire |
| 30/10/2026 | Relevé de P-03 §4 confirmé ; neuf écarts et compléments notés au §7 | agent |
| 30/10/2026 | **Redécoupage, contestable** : la remise d'accord du cahier des charges et de l'architecture (v1.8) ouvre B1, avant le code, au lieu d'attendre B4 (règle 4 du `CLAUDE.md`) ; B4 garde la remise d'accord finale et le ménage | agent |
| 30/10/2026 | **Précisions de l'agent, contestables** : interventions numérotées H-18 à H-22, à la suite de celles de l'architecture ; la migration qui vide `session` prend `0006` (D10) ; « contrat portail v1 » noté dans l'en-tête de l'architecture dès B0, la section complète venant avec la v1.8 | agent |
| 30/10/2026 | B0 validée par le propriétaire (« ok le plan me va »), commitée sur `etape-b0-branchement-portail` à sa demande, non poussée ; lien vers ce chantier ajouté au README | propriétaire |
