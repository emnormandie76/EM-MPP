# Recette ciblée v1.2 (É8c) : tester dans Chrome ce qui a changé

> **Pour l'utilisateur.**
> 1. Dans Chrome : l'extension « Claude in Chrome » doit être installée et connectée à ton compte claude.ai (comme pour la recette du 01/10).
> 2. Dans VS Code, ouvre une nouvelle conversation Claude Code dans ce dépôt (contexte vide, Opus 5.5, effort extra high). Vérifie avec `/status` (compte claude.ai Pro, Max ou Team) et `/chrome` (extension connectée ; sinon, redémarre Chrome puis « Reconnect extension »).
> 3. Écris : « @browser Lis `docs/recette/prompt-recette-v1-2.md` et exécute-le. »
>
> L'agent ouvre ses onglets dans ta fenêtre Chrome ; laisse-le faire et accepte les autorisations « Claude in Chrome wants to… » pour `127.0.0.1`. Durée estimée : 1 h 30 à 2 h. Résultat : un rapport dans `docs/recette/`.

Tout ce qui suit s'adresse à l'agent.

---

## 1. Ta mission

Tu es **testeur**. L'étape É8c vient de changer les règles de « Les petits pronos de la promo » (v1.2 du cahier des charges, demandée par l'utilisateur le 02/10/2026). Les tests automatiques passent ; l'utilisateur veut qu'un agent vérifie **à la main, dans Chrome**, comme le feraient l'admin et les joueurs, **seulement ce qui a changé** :

- le barème devient un **malus** (l'écart brut, sans plafond) : le moins de malus gagne ; plus de paliers, plus de bonus podium, plus de Juste Prix ;
- le **malus d'une mauvaise réponse**, fixé par l'admin sur chaque question à choix ;
- un joueur **sans prono** prend le malus du **pire prono** ;
- les **jokers autorisés ou non par saison**, qui divisent le malus par deux ;
- la **prolongation** d'une question pour un joueur absent ;
- les **pronos des autres cachés** à qui n'a pas pronostiqué une question clôturée, jusqu'au résultat ;
- la **couleur principale #0036B3**.

Tu compares chaque comportement observé au comportement **attendu** (cahier des charges, architecture, décisions du journal). Une différence avec une décision consignée n'est pas un bogue. Tu **signales**, tu ne **corriges pas**. Le reste du site a été recetté le 01/10 (`docs/recette/rapport-recette-2026-10-01.md`) : ne le reteste pas en entier, mais signale toute anomalie que tu croises en chemin.

## 2. Ce que tu ne fais jamais

- **Aucune modification du dépôt**, sauf ton rapport et tes captures dans `docs/recette/`. Pas de correction de code, pas de commit, pas de push. Tu ne fais aucune étape du plan de construction : les règles de `CLAUDE.md` sur les étapes ne te concernent pas.
- **Jamais la production** : ne va pas sur `https://les-petits-pronos-de-la-promo.vercel.app` ni sur `le-bon-chiffre.vercel.app`, qui y redirige (vraies données, compte admin réel).
- **Jamais la base Neon** : ne lance ni `npm run db:seed`, ni `npm run db:migrate`, ni `npm run db:check` (ils visent la base de `.env.local`). Ne lis, n'affiche et ne modifie aucun fichier `.env*`.
- **Ne touche pas aux processus de l'utilisateur** : son `next dev` tourne peut-être sur le port 3000. N'arrête que les processus que tu as lancés.
- Pendant que ton serveur tourne, ne lance ni `npm run build`, ni `npm run verify`, ni `npm run test:e2e` : ils réécrivent le dossier `.next` dont ton serveur se sert.
- Si Chrome affiche une page de connexion à un service externe ou un CAPTCHA, arrête-toi et demande à l'utilisateur.

## 3. À lire avant de commencer

1. [docs/features/cahier-des-charges.md](../features/cahier-des-charges.md) : l'en-tête (changements de la v1.2), §3, §4.3, §4.4, §4.5, §4.8 à §4.10, §5 en entier, §8 (« v1.2 »).
2. [docs/architecture/architecture.md](../architecture/architecture.md) :
   - §5.2 (statut d'une question pour un joueur prolongé, vecteurs E1 à E6), §5.4 (pronos, jokers, ordre des contrôles), §5.5 (malus, avec ses vecteurs chiffrés M, K, Q, P, A), §5.6 (classement, C1 à C9), §5.8 (badges), §5.11 (questions : malus d'une mauvaise réponse, résultat refusé pendant une prolongation), §5.13 (jokers par saison, SA9 à SA13), §5.14 (prolongations, PR1 à PR10) ;
   - §6.5 et surtout **§6.6** (le tableau de visibilité de la v1.2) ;
   - §8.1 (couleur), §8.2 (composants marqués v1.2 : QuestionCard, PredictionForm, ResultPanel, ExtensionDialog…), §8.3 (écrans marqués v1.2), §8.6 (vocabulaire : « malus », jamais « points » gagnés) ;
   - §9.6 (le seed).
3. [docs/architecture/avancement.md](../architecture/avancement.md) : le **journal des décisions du 02/10/2026** (décisions de l'utilisateur sur le malus, et précisions de l'agent de l'É8c, contestables) et le point ouvert n° 25.

Quand une question ne se tranche pas avec les documents, lis le code (`src/lib/game/scoring.ts`, `src/lib/game/standings.ts`, `src/lib/services/extensions.ts`, `src/lib/data/questions.ts`) et signale l'écart comme une **question pour l'utilisateur**, pas comme un bogue.

## 4. L'environnement de test : un serveur local, sur des données de test

Tu testes un **build de production lancé en local**, sur une base PGlite (dossier `.pglite-recette/`, ignoré par git) remplie par le seed v1.2. Tu peux tout remettre à zéro en une minute après une action irréversible (proclamation, annulation, résultat), sans toucher ni la production ni la base `dev` de l'utilisateur.

### 4.1 Démarrer

Dans le terminal Bash de Claude Code, à la racine du dépôt :

```bash
# 1. Base de test (efface .pglite-recette, applique les migrations, lance le seed) et build, une seule fois :
export DB_DRIVER=pglite PGLITE_DIR=.pglite-recette BETTER_AUTH_SECRET=recette-locale-0123456789abcdefghijkl BETTER_AUTH_URL=http://127.0.0.1:3200 ADMIN_EMAILS=admin@example.test TZ=UTC && npx tsx scripts/e2e-prepare.ts && npx next build

# 2. Serveur, à lancer en arrière-plan (run_in_background) :
export DB_DRIVER=pglite PGLITE_DIR=.pglite-recette BETTER_AUTH_SECRET=recette-locale-0123456789abcdefghijkl BETTER_AUTH_URL=http://127.0.0.1:3200 ADMIN_EMAILS=admin@example.test TZ=UTC && npx next start -p 3200
```

Chaque commande refait l'`export` : l'état du shell ne se garde pas d'un appel à l'autre.

- Adresse à utiliser dans Chrome : **http://127.0.0.1:3200** (et non `localhost` : tes cookies écraseraient la session du `next dev` de l'utilisateur).
- Le serveur est prêt quand son journal affiche « Ready » ; `http://127.0.0.1:3200/api/health` répond alors `{"ok":true}`.
- Garde un œil sur le journal du serveur : une erreur `⨯` autre que celle citée au §6 est à signaler.

### 4.2 Remettre à zéro

PGlite n'accepte qu'une connexion à la fois : arrête d'abord le serveur.

1. Arrête ta tâche de fond `next start`. Sous Windows, le processus `node` du serveur survit souvent à sa tâche : arrête alors **seulement le processus qui écoute sur le port 3200**, en PowerShell :
   `Get-NetTCPConnection -LocalPort 3200 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess }`
   Ne filtre pas les processus sur le texte de leur ligne de commande.
2. Relance `npx tsx scripts/e2e-prepare.ts`, puis `npx next start -p 3200`, avec les mêmes variables. Pas besoin de refaire le build.

Les dates du seed se calculent à partir de l'heure où il tourne : après une remise à zéro, les comptes à rebours et la date limite de la prolongation de Mehdi repartent.

### 4.3 Les données de test (seed v1.2)

Mot de passe de tous les comptes : `Test-1234!`

| Compte | Nom | Particularités utiles ici |
|---|---|---|
| `admin@example.test` | Admin | admin ; joue aussi (prono sur « webinaire », **pas** sur « Studyrama ») |
| `joueur1@example.test` | Sarah | aucun prono sur les questions ouvertes ; **aucun joker posé** dans la saison (2 restants) ; prono sur « webinaire » |
| `joueur2@example.test` | Julien | aucun prono sur les questions ouvertes ; 1 joker posé dans la saison |
| `joueur3@example.test` | Inès | ses 2 jokers de la saison sont posés |
| `joueur4@example.test` | Camille | prono **876543** (valeur témoin) sur « webinaire » ; pastille « Nouveau » sur la question oui/non à sa première connexion |
| `joueur5@example.test` | Thomas | ses 2 jokers de la saison sont posés |
| `joueur6@example.test` | Mehdi | **prolongation en cours** sur « webinaire » (jusqu'à 2 jours après le seed), sans prono dessus |
| `joueur7@example.test` | Léa | joker posé sur la question résolue « BBA » ; aucun prono sur « Quel campus » ni sur « JPO de septembre » |
| `joueur8@example.test` | Hugo | **ni prono ni prolongation** sur « webinaire » ; prono **987654** (valeur témoin) sur « JPO du 15 novembre » |
| `desactive@example.test` | Nora | compte désactivé, avec des pronos (« inactif » au classement) |

Trois saisons, toutes avec **jokers autorisés** : l'ancienne (2024-2025, pas proclamée, prête à l'être), la précédente (2025-2026, proclamée) et la courante (2026-2027, sans fin).

Questions de la saison courante :

| État | Question | Détails |
|---|---|---|
| Programmée | « JPO de janvier » | ouvre dans 2 jours |
| Ouverte | « JPO du 15 novembre » | nombre, clôture dans 1 jour |
| Ouverte | « Grande École au 31 mai » | nombre, coefficient 2 (ce n'est **plus** un Juste Prix) |
| Ouverte | « Quel programme… décembre ? » | choix BBA / Grande École / MSc, **mauvaise réponse : 100 de malus** |
| Ouverte | « Le taux d'intégration du Bachelor dépassera-t-il 60 % ? » | oui/non, **mauvaise réponse : 50 de malus** |
| Clôturée | « Studyrama » | sans résultat ; l'admin n'y a pas de prono |
| Clôturée | « webinaire Grande École de septembre » | sans résultat ; Camille 876543 ; Mehdi prolongé ; Hugo sans prono |
| Résolue | « JPO de septembre » | nombre, réel 250, coefficient 1 (vecteur P1) |
| Résolue | « BBA pendant la semaine de rentrée » | nombre, réel 1 000, coefficient 2 (vecteur A1), résultat corrigé |
| Résolue | « Quel campus… en Bachelor ? » | choix, bonne réponse « Le Havre », coefficient 2, mauvaise réponse : 100 de malus |
| Annulée | « dossiers complets au 15 octobre » | avec un joker posé (rendu) |
| Brouillon | « intégrés en alternance » | |

### 4.4 Les valeurs attendues, calculées à la main sur le seed

Malus des questions résolues de la saison courante (une absence prend le malus du pire prono) :

| Question | Pronos et malus | Absents |
|---|---|---|
| JPO de septembre (réel 250, coef 1) | Julien 262 avec joker : 12 ÷ 2 = **6** ; Sarah 240 : **10** ; Inès 235 : **15** ; Camille 235 : **15** ; Thomas 300 : **50** | Admin, Mehdi, Léa, Hugo, Nora : **50** |
| BBA (réel 1 000, coef 2) | Sarah 1 050 : 50 × 2 = **100** ; Mehdi 900 : 100 × 2 = **200** ; Léa 1 300 avec joker : 300 × 2 ÷ 2 = **300** | les 7 autres : 300 × 2 = **600** |
| Quel campus (choix, coef 2, mauvaise réponse 100) | « Le Havre » (Julien, Inès, Thomas avec joker, Hugo, Nora) : **0** ; « Caen » (Sarah, Admin) et « Paris » (Camille) : **200** | Mehdi, Léa : **200** |

Classement de la saison courante, **avant** toute résolution de ta part :

| Rang | Joueur | Malus | Flèche (depuis le résultat précédent) |
|---|---|---|---|
| 1 | Sarah | 310 | = |
| 2 | Mehdi | 450 | = |
| 3 | Léa | 550 | = |
| 4 | Julien | 606 | = |
| 5 | Inès | 615 | = |
| 6 | Thomas | 650 | ▲1 |
| 7 | Hugo, Nora (inactif), ex æquo | 650 | ▲1 |
| 9 | Camille | 815 | ▼4 |
| 10 | Admin | 850 | ▼2 |

Thomas passe devant Hugo et Nora à malus égal grâce à son écart moyen (20 %) ; Hugo et Nora n'ont pas d'écart moyen.

Palmarès de la saison précédente (proclamée, en malus) : Inès 20, Sarah 60, Julien 100, puis Camille 300, Mehdi 300, Thomas 350, Admin, Hugo et Léa 350. Saison ancienne, si tu la proclames : Camille 5, Sarah 10, Julien 20, Thomas 30, et les cinq absents (Admin, Hugo, Inès, Léa, Mehdi) à 30.

Si tu résous « Studyrama » avec **250** : Inès 0 (« Dans le mille »), Mehdi 10, Hugo 12, Julien 30, Camille 45, Thomas 50, Sarah 70 ; Admin, Léa et Nora absents, 70. Nouveau classement : Sarah 380, Mehdi 460, Inès 615 (▲2), Léa 620, Julien 636, Hugo 662, Thomas 700, Nora 720, Camille 860, Admin 920.

### 4.5 Contraintes à connaître

- **Tentatives de connexion** : au plus 5 par minute, tous comptes confondus en local ; « Trop de tentatives » n'est pas un bogue (§6.1 de l'architecture). Espace tes changements de compte.
- **Un seul compte connecté à la fois** : menu du compte (en haut à droite), « Se déconnecter », puis `/connexion`.
- **Le temps ne s'accélère pas** : ouverture, clôture, fin d'une prolongation et validation automatique dépendent de l'heure réelle (heure de Paris à l'écran). Pour les voir, crée des questions ou des dates limites **à quelques minutes**, et continue tes autres tests pendant l'attente.
- Les fenêtres de confirmation et de prolongation sont des `<dialog>` HTML : clique leurs boutons normalement.

## 5. Le plan de test

Avance phase par phase. Chaque ligne testée est **OK**, **KO** (anomalie) ou **non testée** (avec la raison). Regarde aussi la console de Chrome : toute erreur JavaScript est à signaler.

### Phase A : lancer tôt les scénarios dans le temps

Avec l'admin, prépare deux scénarios, puis laisse le temps faire pendant les phases suivantes :

- [ ] A1. Crée une question à nombre (catégorie JPO, unité, source), ouverture **dans 3 minutes**, clôture **dans 20 minutes**, et publie-la. À l'ouverture, avec Sarah : un prono **enregistré** (pas validé) ; avec Julien : un prono **validé avec joker** ; avec Thomas : rien. Avant la clôture, avec l'admin, ouvre le suivi de la question et **prolonge-la pour Thomas** (absence prévue, §5.14 PR10) avec une date limite à **clôture + 10 minutes**.
- [ ] A2. Sur « webinaire », avec l'admin : « Changer la date » de la prolongation de Mehdi pour la placer **dans 10 minutes** (tu vérifieras sa fin en phase E).

### Phase B : le malus et le classement, en lecture

Avec Sarah, puis Léa, puis Mehdi :

- [ ] B1. Accueil : tuile **« Malus »** (310 pour Sarah) à la place de « Points », tuile Jokers « 2/2 restants cette saison » ; la mini-liste du classement en malus, du plus petit au plus grand.
- [ ] B2. `/classement` : ordre, valeurs et flèches du §4.4 ; colonne « MALUS » ; note « Le moins de malus est en tête. Départage : nombre de Dans le mille, puis écart moyen le plus faible. » ; Nora « (inactif) ». À 390 px, la liste compacte montre « … de malus ».
- [ ] B3. « JPO de septembre » (Sarah) : bandeau « Ton prono : 240 · écart 10 (4 %) », « Écart 10 participants », grand malus **10** ; tableau trié du plus petit malus au plus grand, colonnes Prono, Joker (« Joker ÷2 » chez Julien), Écart (« 12 (4,8 %) »), Malus ; puis **les absents en bas**, « Pas de prono », 50 chacun.
- [ ] B4. « BBA » (Sarah) : les malus du §4.4, avec le coefficient 2 et le joker de Léa ; « Résultat corrigé le … ».
- [ ] B5. « Quel campus » : avec **Léa**, qui n'a pas répondu, le bandeau dit « Pas de prono : malus du pire prono » avec un malus de **200** ; avec Sarah, « mauvaise réponse », « Mauvaise réponse : 100 × 2 (coef) », malus 200.
- [ ] B6. `/questions?onglet=resolues` : « mon malus » sur chaque carte, et « Pas de prono · … de malus » là où le joueur n'a pas répondu.
- [ ] B7. Profil public de **Mehdi** (`/joueurs/<id>` depuis le classement) : rang et malus (450 « de malus ») ; historique avec les questions **sans prono** (« Pas de prono », malus d'absence) ; la colonne Malus s'additionne au total du classement (200 + 200 + 50). Badges : Léa a « Joker gagnant » (son joker sur BBA, 3e plus proche sur 3).
- [ ] B8. `/palmares` : podium et classement complet de la saison précédente en malus (« 20 de malus »…), colonne « MALUS ».
- [ ] B9. `/reglement` : plus de tableau de paliers, plus de « Bonus podium », plus de « Juste Prix » ; sections Principe (« le moins de malus gagne »), Malus d'une question à nombre (exemple 500 / 1 500 pour 1 000, faute de frappe 25 000 → 24 000), « Dans le mille », Questions à choix, Coefficient (exemple JPO : 10, joker 5, 300 → 50, coef 3 → 150), Jokers (« Cette saison : jokers autorisés (2 par joueur). », ÷2), Pas de prono, Prolongation pour un absent, Départage. Vérifie que chaque exemple chiffré est juste (§5.5 de l'architecture).
- [ ] B10. Nulle part le mot « points » pour parler du score (§8.6), ni « Juste Prix », ni « ×2 » pour le joker (c'est « ÷2 ») ; la bannière d'une question annulée dit « aucun malus n'est attribué ».

### Phase C : les questions à choix et leur malus

- [ ] C1. Joueur : la carte d'une question à choix sur l'accueil affiche « Choix · coef. ×1 · mauvaise réponse : 100 de malus » (sur `/pronos` : « Choix · mauvaise réponse : 100 de malus », le coefficient étant dans une étiquette) ; la page de la question l'affiche dans l'en-tête et sous les réponses (« Mauvaise réponse : 100 de malus »).
- [ ] C2. Admin, `/admin/questions/nouvelle` : il n'y a plus que trois types (Nombre, Choix, Oui/Non) ; pour un choix ou un oui/non, le champ « Malus d'une mauvaise réponse » apparaît, avec son aide. Refus : champ vide (« Indique le malus d'une mauvaise réponse. »), 0 (« Le malus doit être supérieur à 0. »), « 2.450 » (message des milliers), « -5 ». Accepté : « 1 200,5 », relu ensuite « 1 200,5 ».
- [ ] C3. Passer un brouillon de Nombre à Oui/Non demande le malus ; repasser à Nombre l'efface.
- [ ] C4. Sur une question à choix **avec pronos** (« Quel programme… »), le malus est désactivé, avec la raison qui le cite.
- [ ] C5. « Dupliquer » une question à choix copie son malus.

### Phase D : les jokers par saison

- [ ] D1. Joueur : la case du joker affiche « JOKER ÷2 Divise ton malus par deux · n restant(s) cette saison » ; le reste du comportement du joker n'a pas changé (posé aussitôt, limite de 2, rendu si la question est annulée).
- [ ] D2. Admin, `/admin/saisons` : chaque saison affiche « Jokers : autorisés » ; le formulaire de création a la case « Jokers autorisés (2 par joueur) », cochée par défaut ; « Modifier » la saison courante : la case est cochée, avec l'aide « Des jokers sont déjà posés… » ; la décocher et enregistrer est **refusé** (« Des jokers sont déjà posés dans cette saison : impossible de les retirer. »).
- [ ] D3. Crée une saison « Test sans jokers » qui commence **dans 8 jours**, case décochée (plus tôt, la création est refusée parce que des questions avec des pronos clôturent après sa date : c'est voulu, §5.13) ; puis une question qui ouvre dans 2 minutes et **clôture dans 10 jours** (elle appartient donc à la nouvelle saison) ; publie-la. Avec Sarah : sur cette question, **pas de case joker** ; sur les autres, la case reste. Réautorise les jokers de cette saison : la case revient.
- [ ] D4. Une saison proclamée (2025-2026) : le réglage des jokers est désactivé (« Saison proclamée : le réglage des jokers ne change plus. »).

### Phase E : les prolongations

- [ ] E1. Hugo (sans prono sur « webinaire ») : la question est dans « En attente du résultat » ; sa page dit « Tu n'as pas pronostiqué cette question : les pronos s'afficheront au résultat. », sans tableau, sans moyenne ni graphique, avec « Prolongation en cours pour 1 joueur, jusqu'au … : son prono s'affichera ensuite. ». **876543 n'apparaît ni à l'écran ni dans le code source** (Ctrl+U).
- [ ] E2. Mehdi (prolongé) : « webinaire » est dans ses questions ouvertes (accueil, `/pronos`, onglet « Ouvertes ») avec la pastille « PROLONGÉE POUR TOI » et un compte à rebours jusqu'à **sa** date limite ; la page dit « Prolongée pour toi jusqu'au … (clôture pour les autres : …) » ; il peut enregistrer, valider et poser un joker ; **876543 n'apparaît nulle part**, code source compris.
- [ ] E3. Sarah (a pronostiqué « webinaire ») : elle voit les pronos des autres (876543 de Camille compris), la sagesse de la foule et la mention de la prolongation, **sans** le nom de Mehdi ; après qu'il a enregistré un prono, elle ne le voit pas.
- [ ] E4. Admin, tableau de bord : « Saisir le résultat » de « webinaire » est **désactivé**, avec « Prolongation de Mehdi jusqu'au … » ; section « Prolongations en cours » (question, joueur, date limite, état de son prono).
- [ ] E5. Admin, page de « webinaire » : colonne « Prolongation » du suivi ; « Prolonger » pour Hugo (pas pour l'admin lui-même ni pour un joueur qui a un prono) ; le dialogue « Prolonger pour Hugo » est prérempli 48 h plus tard à l'heure pile, rappelle « Le joueur ne verra pas les pronos des autres avant d'avoir répondu. Préviens-le toi-même. » ; une date passée ou avant la clôture est refusée (« La date limite doit être dans le futur et après la clôture de la question. »). La section Résultat est désactivée avec la raison. L'admin, qui a un prono sur « webinaire », voit les valeurs des autres, mais **seulement l'état** du prono d'un joueur prolongé, historique compris.
- [ ] E6. « Annuler la prolongation » (avec confirmation) : sans prono, la prolongation disparaît ; avec un prono enregistré, elle se termine tout de suite et le prono compte comme « Validé ».
- [ ] E7. Fin d'une prolongation (scénario A2) : à la date limite de Mehdi, la question quitte ses questions ouvertes ; un prono seulement enregistré compte comme « Validé » ; son prono devient visible pour Sarah ; une fois toutes les prolongations terminées, l'admin peut saisir le résultat.
- [ ] E8. Une prolongation est impossible sur une question résolue (aucun bouton « Prolonger »).

### Phase F : un admin qui n'a pas pronostiqué, et le reste de la visibilité

- [ ] F1. Admin sur « Studyrama » (il n'y a pas de prono) : le suivi ne montre **que les états**, avec « Tu n'as pas pronostiqué cette question : comme les joueurs, tu verras les valeurs au résultat. » ; l'historique, sans valeurs. Après la saisie du résultat (250), toutes les valeurs apparaissent, et le classement suit le §4.4.
- [ ] F2. Valeur témoin 987654 de Hugo (question ouverte) : jamais ailleurs que chez Hugo, admin compris (non-régression du §9.3).

### Phase G : les scénarios dans le temps (suite de la phase A)

- [ ] G1. À la clôture de la question de A1 : Sarah et Julien voient les pronos des autres, **pas celui de Thomas** tant que sa prolongation court ; Thomas, lui, a la question ouverte avec « PROLONGÉE POUR TOI » ; le résultat est bloqué. Avec Thomas, enregistre un prono.
- [ ] G2. À la fin de la prolongation de Thomas : son prono compte comme validé et devient visible ; l'admin saisit le résultat ; les malus suivent l'écart brut × coefficient, ÷2 pour le joker de Julien (arrondi au centième, la moitié vers le haut) ; les joueurs sans prono prennent le malus du pire prono ; le classement et ses flèches sont mis à jour.

### Phase H : la couleur, le téléphone, les textes

- [ ] H1. La couleur principale est le bleu **#0036B3** partout (boutons principaux, navigation active, ma ligne au classement, mon point « TOI », logo, contour du focus, liens) ; plus aucune trace de l'ancien bleu #1F5BFF, sauf le maillot « bleu » des avatars, qui ne change pas (architecture §8.1). Compare avec les captures `docs/design/couleur-0036b3/*-comparaison.png`. Les textes restent lisibles (contraste) sur fond blanc, gris et teinté.
- [ ] H2. À 390 px (si ton outil redimensionne la fenêtre ; sinon, note-le non testé) : pas de défilement horizontal sur une question résolue (tableau avec absents), sur la page d'admin de « webinaire » et avec le dialogue de prolongation ouvert ; la pastille « PROLONGÉE POUR TOI » ne déborde pas.
- [ ] H3. Textes nouveaux (§8.6) : français, tutoiement, phrases courtes, « malus » et jamais « points » gagnés, jamais « pari » ni « mise ». Note toute faute ou phrase peu claire.

### Phase I : les actions irréversibles, à la fin

- [ ] I1. Proclamer la saison ancienne (2024-2025) : le palmarès l'affiche **en malus** (§4.4).
- [ ] I2. Annuler une question résolue : elle sort du classement, absents compris (plus personne ne prend de malus dessus).

## 6. Ce qui n'est pas un bogue

- **Décisions de l'utilisateur, à ne pas contester** : malus = écart brut, sans plafond (une question sur des milliers pèse beaucoup plus qu'une JPO) ; un absent prend le malus du pire prono, même s'il est arrivé après le résultat ; le départage et le palmarès ne changent pas ; le Juste Prix est supprimé ; sans prono, on ne voit pas les pronos des autres avant le résultat.
- Pas de réponse à une question à choix = mauvaise réponse, même si tous les autres ont trouvé.
- Un admin qui n'a pas pronostiqué une question clôturée ne voit que les états dans le back-office, jusqu'au résultat.
- La pastille « PROLONGÉE POUR TOI » remplace « NOUVEAU », et elle peut apparaître avant la clôture (absence prévue).
- Une question sans aucun prono ne donne de malus à personne.
- Le classement de la saison courante liste aussi les comptes créés en cours de saison, avec leurs malus d'absence.
- « Trop de tentatives » quand tu changes souvent de compte.
- Le journal du serveur affiche `Error: The destination stream closed early.` quand on quitte une page avant la fin de son chargement : sans conséquence (architecture §14).

## 7. Le rapport

Écris-le dans `docs/recette/rapport-recette-v1-2-AAAA-MM-JJ.md` (date du jour), en français, pour l'utilisateur, qui n'est pas développeur. Captures dans `docs/recette/captures-v1-2/` (une par anomalie au moins). Ne commite rien.

1. **Résumé** en 5 lignes au plus : la v1.2 est-elle prête ? Les anomalies bloquantes en premier.
2. **Tableau par phase** : nombre de lignes OK, KO, non testées.
3. **Anomalies**, de la plus grave à la moins grave, chacune avec :
   - un identifiant (`V-01`, `V-02`…) et la ligne du plan (`E5`…) ;
   - une gravité : **bloquante** (empêche de jouer ou d'administrer, fausse les malus, ou révèle un prono qui doit rester caché), **majeure** (une règle n'est pas respectée), **mineure** (affichage, texte), **suggestion** ;
   - la page, le compte utilisé, les étapes pour reproduire ;
   - **attendu**, avec sa source (cahier §…, architecture §…, décision du journal du …) ;
   - **observé**, avec la capture ;
   - si tu l'as trouvée en lisant le code, une piste de cause (sans corriger).
4. **Questions pour l'utilisateur** : les écarts que les documents ne tranchent pas.
5. **Non testé** : ce que tu n'as pas pu tester, et pourquoi.

## 8. Pour finir

1. Arrête ton serveur (§4.2, étape 1) et supprime le dossier `.pglite-recette/`.
2. Vérifie avec `git status` que seuls ton rapport et tes captures sont nouveaux.
3. Présente à l'utilisateur le résumé et la liste des anomalies, avec le lien vers le rapport. Les corrections seront faites ensuite par un agent de construction, avant la validation H-08 de l'É8c : propose-lui de leur transmettre ce rapport.
