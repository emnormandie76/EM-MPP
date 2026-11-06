# Chantier — Connexion par le portail

> **Source** : prompt guidé P-03 du portail (`../portail/docs/prompts/P-03-MPPlike-connexion-portail.md`, émis le 2026-10-30), **contrat portail v1** (précisé le 2026-10-29). Corrigé par le prompt guidé P-04 du portail (`../portail/docs/prompts/P-04-MPPlike-rattachement-production.md`, émis le 2026-11-05), contrat v1 inchangé.
> **Ouvert le** 30/10/2026. **B0 validée le 30/10/2026** ; **B1** (le branchement, sur le poste et sur la branche de recette, D12), commencée le 05/11/2026, est **en attente de validation depuis le 06/11/2026**.
> Le portail est le fournisseur de connexion des applications de l'équipe ; il lit ce dépôt et n'y écrit jamais (G7). Ce fichier porte les décisions du chantier, ses étapes à cocher et son journal. Le suivi général reste dans [avancement.md](../architecture/avancement.md) (étapes B0 à B4).

## 1. Objet

MPPlike ne gère plus de comptes : on s'y connecte par le **Portail admission** (<https://portail-admission.vercel.app>), fournisseur d'identité OIDC et seule source des accès. Disparaissent : la connexion par adresse et mot de passe, l'inscription, la liste des adresses autorisées, `ADMIN_EMAILS`, le changement de mot de passe, et la gestion des comptes de `/admin/joueurs` (rôle, désactivation, mot de passe provisoire). Le portail transmet l'identité (`sub`, adresse, nom) et le rôle (`player` ou `admin`) ; le sens des rôles et leurs gardes restent dans MPPlike (`requireUser`, `requireAdmin`, contrôles des services). Tout le jeu reste tel quel.

MPPlike est déjà en ligne : le branchement est une **bascule en trois temps** (G19) : le code sur le poste avec le client `dev`, puis l'import des comptes dans le portail, puis le client `production` et le déploiement dans une même séance avec le propriétaire. Depuis le 05/11/2026 (D12, G21), le premier temps tourne aussi sur une branche de recette, sur la base Neon `dev`, reliée au portail de production : rien n'arrive dans la production de MPPlike avant B3.

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

Décisions du propriétaire, **à ne pas rediscuter**, copiées telles quelles du plan du portail par P-03 §2 (G21 : par P-04 §2). Les renvois (« piège 1 », « D13 ») désignent le plan du portail. Ne concernent pas MPPlike : portail D26, D28, D30, D32.

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
| G21 | portail D45 (P-04 §2) | **MPPlike se rattache au portail de production, pendant tout son branchement.** Seule MPPlike travaille sur une branche à part (`etape-b1-oidc`), déployée en Preview sur sa base Neon `dev`. `mpplike` se déclare dans le portail de production, restreinte, avec un client `recette` (l'adresse fixe de cette branche, D10) et un client `dev` (`http://localhost:3003`) ; `PORTAIL_ISSUER` reste celui de la production partout (contrat §9). Le portail ne change pas : ni branche, ni projet, ni code. Seule écriture en production : cette déclaration, dans l'administration. Ni `main`, ni migration, ni variable de Production, ni client `production` avant la bascule. Les essais s'y font avec le propriétaire, connecté lui-même (aucun compte de test en production). Écarté : un portail de développement déployé ; un portail sur une branche du projet. |

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

Consignes du propriétaire pour mener B1, données le 05/11/2026 (D12 à D19). Elles précisent la conduite de l'étape et ne changent ni G1 à G20 ni D1 à D11, qui restent valables. D20 à D22 répondent aux questions à cocher du même jour ; chaque fois, il a retenu la recommandation. D12, D16, D17 et D18 sont corrigées par P-04 (G21). D23 est une décision du propriétaire du même jour.

| N° | Sujet | Décision |
|---|---|---|
| D12 | **Où tourne B1** | Le code de B1 tourne **sur le poste et sur la branche de recette** : un déploiement Vercel de la branche de travail (pas la production), branché sur la branche Neon `dev` et connecté au **portail de production** (G21 ; corrigé par P-04 : il n'y a pas de portail `dev`). **Rien dans la production de MPPlike** : ni `main`, ni migration sur la base Neon de production, ni variable de l'environnement Production de Vercel. B2 et B3 restent pour plus tard, inchangées. Complète D7 : le client `recette`, laissé « pour plus tard », arrive ici (G12). Complète D1 : pendant B1, l'adresse d'accueil est l'adresse fixe de la branche (§6). |
| D13 | **Git** | Travail sur la branche `etape-b1-oidc`, créée depuis `main`, jamais sur `main`. Commit sur cette branche autorisé (05/11) ; **aucun push sans demande du propriétaire**. |
| D14 | **Adresse de la recette** | L'adresse **fixe de la branche**, jamais celle d'un déploiement précis (elle change à chaque fois) : `https://les-petits-pronos-de-la-promo-git-etape-b1-oidc-em-normandie1.vercel.app`, nom validé par le propriétaire le 05/11 avant de la déclarer au portail (client `recette`, G12). Vercel limite ce nom d'hôte à 63 caractères et coupe au-delà, en ajoutant un hachage (constaté sur `etape-08h-questions-fun`, devenue `…-git-etape-08-4c142a-em-normandie1…`) : il reste 15 caractères pour la branche, d'où `etape-b1-oidc` (13). Écarté : `etape-b1-portail` (16 caractères, adresse connue seulement après le premier déploiement). |
| D15 | **Variables avant le premier push** | Le build lance les migrations (§3.4 de l'architecture) : une erreur ici migrerait la production. **Avant le premier push**, l'agent vérifie avec le propriétaire que les variables Preview, limitées à cette branche, visent Neon `dev` et non la production. L'agent ne lit que les **noms** (MCP ou CLI), jamais les valeurs. L'environnement Production reste intact. |
| D16 | **Variables de la branche** | Posées **par le propriétaire seul** : `DATABASE_URL` et `DATABASE_URL_UNPOOLED` (Neon `dev` ; la seconde, ajoutée le 05/11 sur question de l'agent, est celle que lisent les migrations), `BETTER_AUTH_URL` (l'adresse fixe exacte de D14), `BETTER_AUTH_SECRET` (propre à cette branche), `PORTAIL_ISSUER` (celui de la production, `https://portail-admission.vercel.app/api/auth`, le même partout : G14, G21), `PORTAIL_CLIENT_ID` et `PORTAIL_CLIENT_SECRET` (client `recette` déclaré au portail de production). `PORTAIL_ISSUER` reste une variable : rien en dur dans le code. `.env.example` et `npm run check:env` sont tenus à jour. Aucune valeur dans Git. |
| D17 | **Le portail pendant B1** | L'agent ne fait aucun travail dans le portail (G18). Il écrit et teste le code sans lui. L'essai de bout en bout attend la déclaration de `mpplike` au portail de production et le code. Il se fait **sur l'adresse fixe et sur le poste**, le propriétaire se connectant lui-même (corrigé par P-04 : il n'est plus facultatif sur le poste). |
| D18 | **Protection Vercel** | *Sans objet depuis P-04* : le domaine du portail de production est public, et le portail n'appelle jamais le serveur de MPPlike. Une réponse 302 ou 401 du portail serait une panne à signaler au propriétaire, pas une protection à contourner. L'aperçu de la branche reste protégé par la connexion Vercel, sans effet sur la connexion : le navigateur du propriétaire, connecté à Vercel, passe. |
| D19 | **Plan, journal et fin d'étape** | B1 s'ajuste en « sur le poste **et** sur la branche de recette » ; les questions se posent à cocher. Fin d'étape : tests, types et lint verts, puis compte rendu avec le commit, la branche, l'adresse fixe, les **noms** des variables posées, les migrations jouées sur `dev` seulement et les écarts ; arrêt jusqu'à la validation. |
| D20 | **Arrivée sans session** (point ouvert 1 du §10) | **Connexion silencieuse** : sans session, le proxy et les gardes envoient vers `/connexion?auto=1`, et la page lance seule le flux ; la tuile mène droit au jeu (G17, contrat §3.2). Une déconnexion mène à `/connexion` et une erreur à `/connexion?error=…` : le flux n'y part jamais seul, donc aucune boucle. Écarté : le bouton seul (un clic de plus à chaque tuile et toutes les 8 h). |
| D21 | **Garde-fou des migrations** | Hors de l'environnement Production de Vercel, `scripts/migrate.ts` refuse de migrer une base marquée « production » et fait échouer le build : une erreur de variable ne peut plus migrer la production. Ajout à l'architecture §3.4, proposé par l'agent. Écarté : compter sur la seule vérification de D15. |
| D22 | **Migration `0006`** | Jouée sur la branche Neon `dev`, et seulement là, au build de l'aperçu (accord du 05/11, demandé par le §8 ci-dessous). Elle atteindra la production avec la bascule (D6). |
| D23 | **L'É10 attend l'année prochaine** | Décision du propriétaire, à ne pas rediscuter : l'É10 (règles réglables par saison) se développera l'année prochaine, bien après le chantier du portail. Le chantier passe d'abord (D10 tient). Les résultats de 2026-2027 se saisissent sans l'attendre : les règles de cette saison restent celles du code. Écarté : faire passer l'É10 avant le premier résultat. |
| D24 | **Branche créée avant ses variables** (point ouvert 6) | Décision du propriétaire, à cocher, sur la recommandation : `etape-b1-oidc` naît sur GitHub au commit de `main` (`8c93039`), **sans le code de B1**, pour que Vercel la connaisse et qu'on puisse y limiter les variables. Écart à la lettre de D15, pas à son but : ce push porte le code de la production, sans migration à jouer, et Vercel n'a d'ailleurs rien construit (aucun déploiement sept minutes après, cause non établie). L'adresse fixe ne se confirmera donc qu'au premier déploiement du code de B1. D15 s'applique au premier push **du code de B1**, qui reste à la demande du propriétaire. Écarté : essayer d'abord `vercel env add … --git-branch` sur une branche absente de GitHub. |

## 6. Déclaration au portail (à transmettre)

Saisie par le super-admin du portail, avec l'agent du portail (G3, G18) ; l'agent de MPPlike ne la fait pas.

| Élément | Valeur |
|---|---|
| Identifiant | `mpplike` |
| Nom | Les petits pronos de la promo |
| Description | Pronostics entre collègues sur les chiffres de l'école, avec un classement par saison. |
| Adresse d'accueil | Pendant B1 (D12, G21) : `https://les-petits-pronos-de-la-promo-git-etape-b1-oidc-em-normandie1.vercel.app/` ; `https://les-petits-pronos-de-la-promo.vercel.app/` à la bascule (B3) |
| Rôles | `player` (« Joueur »), `admin` (« Admin ») |
| Mode | restreinte |
| Client `dev` (B1) | retour `http://localhost:3003/api/auth/callback/portail` ; déconnexion `http://localhost:3003/connexion` |
| Client `production` (B3) | retour `https://les-petits-pronos-de-la-promo.vercel.app/api/auth/callback/portail` ; déconnexion `https://les-petits-pronos-de-la-promo.vercel.app/connexion` |
| Client `recette` (B1, D14, G21) | retour `https://les-petits-pronos-de-la-promo-git-etape-b1-oidc-em-normandie1.vercel.app/api/auth/callback/portail` ; déconnexion `https://les-petits-pronos-de-la-promo-git-etape-b1-oidc-em-normandie1.vercel.app/connexion` |
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

Complété le 05/11/2026, au début de B1, dans `node_modules/better-auth` 1.7.6 :

10. **Le crochet de refus (D2)** : `user.validateUserInfo` voit les champs du jeton avant toute écriture, à la création, à la liaison et à la connexion, et son refus revient en `?error=…`. C'est lui qui porte les refus (rôle, émetteur, adresse réattribuée, adresse déjà prise).
11. **Le rôle et l'adresse (D3)** : il n'existe aucun crochet qui reçoive le jeton **et** l'identifiant du compte à sa création. La recopie se fait dans un crochet `session.create.before`, en relisant `account.id_token`, écrit dans la même requête et déjà vérifié. Better Auth exécute d'abord les crochets des plugins, dans leur ordre, et ceux des options en dernier : ce crochet est donc porté par un petit plugin, `portailIdentity`, placé avant `admin`, pour lever une désactivation avant que `admin` ne la refuse (D4). Vu par un test : dans les options, le crochet passait trop tard.
12. **Un jeton absent n'est pas vérifié** : si la réponse du portail ne porte pas de `id_token`, `getUserInfo` passe à la route userinfo sans vérification. Comparer `iss` à `PORTAIL_ISSUER` dans `validateUserInfo` ferme ce cas, et compare l'émetteur exactement, comme le demande le contrat : le plugin, lui, le compare à celui de la découverte.
13. **La découverte bloque au démarrage** : les pages lisent la session par la même instance, donc attendent la découverte à chaque démarrage à froid. Si elle échoue vite, les sessions ouvertes continuent (contrat §3.1) ; le plugin n'a pas de délai d'attente, un portail qui ne répond pas retarde donc le premier appel.

## 8. Étapes

Une étape à la fois, sur sa branche (`etape-bN-…`), avec la porte habituelle (`npm run verify`, `npm run test:e2e`) et la validation H-08. Découpage de P-03 §5, repris avec les décisions ci-dessus ; un seul changement : la remise d'accord du cahier des charges et de l'architecture ouvre B1 (avant le code qui l'applique, règle 4 du `CLAUDE.md`) au lieu d'attendre B4, qui garde la remise d'accord finale.

### B0 — Point de départ (sans code)

- [x] Point de départ vérifié et consigné : commit, branche, arbre de travail ; ce qui est en production ; l'état réel de l'É9 (§2).
- [x] Relevé de P-03 §4 revérifié, écarts notés (§7).
- [x] Décisions du portail recopiées (G1 à G20), questions de P-03 §6 posées au propriétaire et consignées (D1 à D11).
- [x] Étapes écrites ici et dans `avancement.md`.
- [x] Compte rendu avec les éléments de P-03 §8.
- [x] Validation du propriétaire (H-08), le 30/10/2026.

### B1 — Le branchement, sur le poste et sur la branche de recette (G19, temps 1 ; D12)

- [ ] Cahier des charges v1.8 et architecture v1.8 (§3.1, §6, §9.4, §9.6, §12 ; « contrat portail v1 ») écrits avant le code, et soumis au propriétaire.
- [x] H-18 : le propriétaire déclare `mpplike` au portail de production (avec l'agent du portail, G18, G21), selon le §6, avec ses clients `recette` et `dev` ; puis H-19 : il pose les variables de la branche (D16) sur Vercel, limitées à `etape-b1-oidc`, et celles de `.env.local` (`BETTER_AUTH_URL=http://localhost:3003`, `PORTAIL_ISSUER` et le client `dev`). L'agent ne les demande pas et ne lit que les noms ; `npm run check:env` vérifie leur présence sur le poste.
- [x] Avant le premier push (D15) : variables de la branche relues avec le propriétaire, par leurs noms ; il confirme qu'elles visent Neon `dev`.
- [x] Tests d'abord : rapprochement par `sub`, puis par l'adresse (comptes locaux à `email_verified = false` compris), puis création ; refus d'une adresse déjà liée à un autre `sub` (consigné) ; rôle recopié à chaque connexion, rôle inconnu refusé ; adresse recopiée ; pseudo de départ coupé et rendu unique, jamais réécrit (D3) ; désactivation d'avant levée, compte anonymisé jamais rouvert (D4) ; session refusée après 8 h depuis la connexion, même relue entre-temps ; `/sign-in/social` qui ne bloque pas une IP partagée.
- [x] Fournisseur « portail » (`genericOAuth`) : découverte, vérification du jeton exigée (`requireIdTokenVerification`), PKCE S256, `state`, `nonce`, `client_secret_basic`, scopes `openid profile email` ; découverte en échec traitée ; session de 8 h fixes ; préfixe `mpplike` (proxy compris) ; déconnexion par le portail ; `/connexion` (bouton du portail) et erreurs sans boucle (`onAPIError.errorURL`) ; chemins ouverts et publics ; règle de débit propre à `/sign-in/social` ; port 3003.
- [x] Retrait de ce qui disparaît (P-03 §4.5), et mise à jour des tests, un par un, avec leur raison au journal ; tests de bout en bout selon D8.
- [x] La migration `0006` qui vide `session` (D6) : jouée sur `dev` avec l'accord du propriétaire (D22) ; **pas sur la production** à ce stade (elle y partirait avec un déploiement).
- [x] Garde-fou des migrations (D21), en place avant le premier push.
- [x] Branche poussée à la demande du propriétaire ; déploiement prêt à l'adresse fixe, sur `dev` (D14).
- [x] Essai de bout en bout **sur l'adresse fixe et sur le poste**, contre le portail de production (D17, G21), **le propriétaire se connectant lui-même** (aucun compte de test en production) : connexion, refus (sans accès), retrait d'accès (refus à la connexion suivante), déconnexion.

**Ordre avec le propriétaire** (P-04 §5) : l'agent confirme l'adresse fixe de la branche ; le propriétaire déclare `mpplike` au portail de production avec l'agent du portail ; il pose les valeurs ; l'agent relit avec lui les noms des variables (D15) ; il demande le premier push.

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
| H-18 | Déclaration de `mpplike` au portail de production, avec ses clients `recette` et `dev` (super-admin, avec l'agent du portail) | B1 |
| H-19 | Variables de la branche `etape-b1-oidc` sur Vercel (D16) et `.env.local` du poste | B1 |
| H-20 | Remise du fichier d'export à l'agent du portail et import | B2 |
| H-21 | Message aux joueurs : choisir son mot de passe sur le portail | B2 |
| H-22 | Bascule : client `production`, variables de Production, déploiement | B3 |

## 10. Points ouverts

1. *(Réglé le 05/11/2026 : D20, connexion silencieuse.)*
2. **Six comptes `admin`** (quatre au 30/10, relevé du 05/11) : l'export les déclarera `admin` (D5). Si certains doivent être `player`, le propriétaire le dit avant B2, ou corrige la case dans la grille du portail (G15).
3. **`BETTER_AUTH_URL` en Development sur Vercel** (H-06) : elle vaut probablement `http://localhost:3000` ; à remettre à 3003 si le propriétaire tire encore `.env.local` par `vercel env pull`.
4. **L'É9** : le propriétaire dira s'il la considère comme close (H-12 et H-13 non signalées, campagne en brouillon).
5. *(Sans objet depuis P-04 : l'émetteur est le même partout, G21.)*
6. *(Réglé le 05/11/2026 : D24, la branche existe sur GitHub avant ses variables. Le propriétaire ne la trouvait pas sur Vercel ; on ne sait toujours pas si Vercel accepte une variable sur une branche absente de GitHub, la question ne se pose plus ici.)*
7. **Comptes du seed sur la recette** : ils sont en `@example.test` et n'entrent pas par le portail. Sur l'adresse fixe et sur le poste, le propriétaire se connecte avec son compte du portail de production ; une adresse absente de la base `dev` y crée un compte, avec le rôle reçu du portail.
8. *(Réglé côté portail le 05/11/2026, commit `ae5bea0`, sans changement dans MPPlike ni dans le contrat v1.)* **Déconnexion** : on ne revenait pas sur `/connexion`. Le 503 relevé par l'agent de MPPlike était faux : le POST de confirmation aboutissait, puis Chrome bloquait le 302 vers MPPlike à cause de la CSP `form-action 'self'` de la page du plugin, et `read_network_requests` affiche 503 dans ce cas. Le portail affiche maintenant sa page `/deconnexion`, en français. Réessayé sur l'adresse fixe : connexion puis déconnexion aussitôt, retour direct sur `/connexion`, sans page ; reconnexion au portail entre-temps, page `/deconnexion`, puis retour après le clic. Recette et `dev` partagent la ligne `account` de Neon `dev` : une connexion sur l'un remplace l'`id_token` de l'autre, ce qui fait paraître la page. **Réessayé sur le poste le 06/11/2026** : connexion puis déconnexion aussitôt, retour direct sur `/connexion`, et le portail redemande ensuite le mot de passe ; puis, avec dans `account` un jeton du client `recette`, page `/deconnexion`, et retour sur `http://localhost:3003/connexion` après le clic. La règle, lue dans le plugin (`rpInitiatedLogoutEndpoint`) : la page paraît si le navigateur porte une **autre** session du portail que celle du jeton, ou si le jeton ne vaut pas pour le client ; sans session au portail, ou avec la même, le retour est direct. Sur le poste, la page s'est donc vue par le cas du client, pas par celui de la reconnexion, vu sur l'adresse fixe : un essai avec une déconnexion puis une reconnexion au portail a donné un retour direct, Chrome ne portant pas de seconde session à ce moment-là, sans qu'on sache pourquoi. Le code de la page et du retour est le même dans les deux cas.

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
| 05/11/2026 | Consignes de conduite de B1 notées en D12 à D19 : recette sur une branche Vercel, base Neon `dev`, portail `dev` (corrigé le même jour par P-04), rien en production. G1 à G20 et D1 à D11 inchangées | propriétaire |
| 05/11/2026 | Quatre questions à cocher, chaque fois sur la recommandation : branche `etape-b1-oidc` (D14), connexion silencieuse (D20), `DATABASE_URL_UNPOOLED` ajoutée aux variables de la branche (D16), garde-fou des migrations (D21), `0006` sur `dev` (D22), commit sur la branche (D13) | propriétaire |
| 05/11/2026 | **Précision de l'agent, contestable** : le relevé de Better Auth est complété par quatre points (§7, 10 à 13), dont le choix de `validateUserInfo` pour les refus et d'un petit plugin avant `admin` pour la recopie du rôle et de l'adresse | agent |
| 05/11/2026 | Prompt guidé P-04 du portail, contrat v1 : G21 ajoutée (portail D45, décision du propriétaire, à ne pas rediscuter). Il n'y a pas de portail `dev` : la branche, sur Neon `dev`, se connecte au portail de production. Corrigés en conséquence : D12, D16, D17, D18, §6, H-18, H-19, points ouverts 5 à 7, et l'essai de B1, désormais sur l'adresse fixe et sur le poste | portail (P-04), propriétaire |
| 05/11/2026 | D23 : l'É10 attend l'année prochaine ; les résultats de 2026-2027 se saisissent sans l'attendre. Décision du propriétaire, à ne pas rediscuter | propriétaire |
| 05/11/2026 | Relevé de la production en lecture seule (D11), nombres seulement : 17 comptes (6 `admin`), 18 adresses, 5 questions publiées, toutes closes le 05/11 à 16 h 30, 73 pronos, aucun résultat, 23 sessions, 6 migrations, aucun compte `portail`. Le §2 (30/10) reste daté : les 19 lignes de D5 sont périmées, B2 les recomptera | agent |
| 05/11/2026 | `.env.local` vérifié par `npm run db:check` : il vise `ep-dry-hill-b2imypjr`, le point d'accès de la branche `dev` selon Neon (6 migrations, base non marquée production). Ce contrôle a réveillé `dev`, archivée depuis le 14/10 | agent |
| 05/11/2026 | Échec intermittent de `portail-sign-in.test.ts` (4 à 12 tests selon les passages, seul il passait) : cause mesurée, `read ECONNRESET` sur une connexion gardée par le faux portail quand toute la suite charge la machine. Corrigé dans `tests/helpers/fake-portail.ts` (une connexion par requête), sans toucher à une assertion | agent |
| 05/11/2026 | **Tests retirés ou changés (B1), et pourquoi.** Retiré, car la fonction disparaît : `auth-hooks.test.ts` (mot de passe, inscription, liste blanche, `ADMIN_EMAILS`), remplacé par `portail-sign-in.test.ts`, `auth-route.test.ts` et `portail.test.ts`. `players.test.ts` : liste blanche, rôles, désactivation et mot de passe provisoire retirés (G2, D4) ; l'anonymisation reste et coupe le lien `portail`. `players-data.test.ts` : `getAllowedEmails` retiré. `account-validation.test.ts` : `parseAdminEmails`, `parseEmail` et la liste collée retirés. Changé : `auth-config.test.ts` (8 h au lieu de 400 jours, aucune connexion locale, G9) ; `authorization-matrix.test.ts` (33 services au lieu de 39) ; `auth-routing.test.ts` (routes du flux, `/inscription` n'est plus publique) ; `env-rules.test.ts` (variables du portail) ; `seed.test.ts` (ni mot de passe ni liste) ; `migrate.test.ts` (D21). De bout en bout (D8) : `fixtures.ts` pose la session en base ; `auth.spec.ts` réécrit contre le faux portail ; `rate-limit.spec.ts` prouve qu'une équipe derrière une adresse n'est pas bloquée, au lieu du blocage à la 6e tentative ; `headers.spec.ts` sans `/inscription` ; `prod-smoke.spec.ts` vérifie le bouton du portail ; `results.spec.ts` compte Yann, créé par `auth.spec.ts` | agent |
| 05/11/2026 | Porte de B1 au vert sur le poste : `npm run verify` et une seconde suite complète (1 141 tests chaque fois), `npm run test:e2e` (117 tests). Code commité sur `etape-b1-oidc`, non poussé | agent |
| 05/11/2026 | D24 : le propriétaire ne trouvait pas la branche sur Vercel (jamais poussée). `main` poussée sur `origin/etape-b1-oidc` à sa demande (`8c93039`, sans le code de B1), pour y limiter les variables de H-19 | propriétaire |
| 05/11/2026 | H-19, partie Vercel : sept variables posées par le propriétaire, limitées à `etape-b1-oidc`. Noms relus par l'agent (D15) : aucune `PORTAIL_*` en Production, variables générales de Preview inchangées. Le propriétaire confirme que `DATABASE_URL` et `DATABASE_URL_UNPOOLED` viennent de Neon `dev` (l'agent ne peut pas le lire, ces valeurs sont en Secret). Reste `.env.local`. Code de B1 poussé à sa demande | propriétaire |
| 05/11/2026 | Premier déploiement du code de B1 (`a7f34fa`) prêt en Preview, à l'adresse fixe de D14, confirmée telle quelle. Journal du build : « Migrations : 1 appliquée(s), 7 au total. Base : ep-dry-hill-b2imypjr… », soit Neon `dev`, ce qui prouve aussi D15. La production reste sur `8c93039` | agent |
| 05/11/2026 | Essai de bout en bout sur l'adresse fixe et sur le poste, piloté par l'agent dans le Chrome du propriétaire, qui a fait lui-même les connexions, les changements de la grille et la création du client `dev`, absent jusque-là (G18, G21). Bons sur les deux adresses : connexion, session, rôle, refus sans accès et sans boucle, session gardée après un retrait (G6), refus après un retrait, reconnexion après rétablissement. Le refus s'affiche sur le portail, sans retour sur MPPlike. Déconnexion : la session de MPPlike se ferme, mais le retour bloque au portail (point ouvert 8). Aucune erreur de MPPlike sur Vercel ni sur le poste. L'agent n'a rien modifié dans le portail : son essai sur la grille, autorisé par le propriétaire, a été bloqué par le contrôle de la session | propriétaire, agent |
| 05/11/2026 | Déconnexion corrigée côté portail (`ae5bea0`) : le 503 du point ouvert 8 était un faux relevé de l'outil, la cause était une CSP. Les deux essais demandés par le portail sont bons sur l'adresse fixe, client `recette`, le propriétaire se connectant lui-même. Le poste reste à refaire | portail, agent |
| 06/11/2026 | Essai de déconnexion refait sur le poste, piloté par l'agent dans le Chrome du propriétaire, qui a fait lui-même ses connexions : retour direct sur `/connexion`, puis page `/deconnexion` et retour sur `http://localhost:3003/connexion` après le clic (point ouvert 8). Aucune erreur dans le journal du serveur. L'essai de bout en bout de B1 est fini | propriétaire, agent |
| 06/11/2026 | **Compte rendu de B1 (P-04 §8).** Branche `etape-b1-oidc` ; commit de fin d'étape : celui qui porte cette ligne, arbre propre, non poussé (`origin/etape-b1-oidc` est à `a7f34fa`, seuls les documents diffèrent). Adresse fixe : celle de D14, confirmée par Vercel ; adresses de retour et de déconnexion des clients `recette` et `dev` : §6. Variables de la branche : `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `PORTAIL_ISSUER`, `PORTAIL_CLIENT_ID`, `PORTAIL_CLIENT_SECRET` ; le propriétaire a confirmé Neon `dev`. `origin/main` inchangée à `8c93039`, la production sert ce commit, 6 migrations, aucun compte `portail` (lecture seule, D11) ; `0006` jouée sur `dev` seulement (7 migrations). Décision de P-04 §2 : G21. Essais sur l'adresse fixe et sur le poste : connexion, refus, retrait d'accès, déconnexion, tous bons. Porte : `npm run verify` (1 141 tests) et `npm run test:e2e` (117 tests). **Écarts** : branche créée avant ses variables (D24) ; client `dev` créé pendant l'essai, pas avant ; v1.8 commitée avec le code, sans trace de sa soumission (première case de B1, décochée jusqu'à la relecture du propriétaire) ; sur le poste, page `/deconnexion` vue par le cas du client, pas par celui de la reconnexion (point ouvert 8) | agent |
