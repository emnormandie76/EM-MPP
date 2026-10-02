# Recette par un agent : tester tout le site dans Chrome

> **Pour l'utilisateur.**
> 1. Dans Chrome : installe l'extension « Claude in Chrome » et connecte-la à ton compte claude.ai (bouton de connexion de l'extension, pas de commande).
> 2. Dans VS Code, ouvre une nouvelle conversation Claude Code dans ce dépôt (contexte vide, Opus 5.5, effort extra high). Vérifie avec `/status` (compte claude.ai Pro, Max ou Team) et `/chrome` (extension connectée ; sinon, redémarre Chrome puis « Reconnect extension »).
> 3. Écris : « @browser Lis `docs/recette/prompt-recette-agent.md` et exécute-le. » (dans VS Code, `@browser` donne à Claude l'accès au navigateur).
>
> L'agent ouvre ses onglets dans ta fenêtre Chrome ; laisse-le faire et accepte les autorisations « Claude in Chrome wants to… » pour `127.0.0.1`. Durée estimée : 2 à 3 heures. Résultat : un rapport dans `docs/recette/`.

Tout ce qui suit s'adresse à l'agent.

---

## 1. Ta mission

Tu es **testeur**. L'utilisateur n'a encore testé aucune fonctionnalité de « Les petits pronos de la promo » lui-même : tu le fais à sa place, **dans Chrome**, comme le feraient l'admin et les joueurs, puis tu lui remets un rapport clair de ce qui marche et de ce qui ne marche pas.

- Tu testes **toutes** les fonctionnalités : comptes, parcours joueur, résultats, classement, palmarès, back-office complet, règles du jeu, affichage sur téléphone, accessibilité de base, textes.
- Tu compares chaque comportement observé au comportement **attendu**, tel que l'écrivent le cahier des charges, l'architecture et les décisions du journal. Une différence avec une décision consignée n'est pas un bogue : c'est le comportement voulu.
- Tu **signales**, tu ne **corriges pas**.

## 2. Ce que tu ne fais jamais

- **Aucune modification du dépôt**, sauf ton rapport et tes captures dans `docs/recette/`. Pas de correction de code, pas de commit, pas de push. Tu ne fais aucune étape du plan de construction : les règles de `CLAUDE.md` sur les étapes ne te concernent pas.
- **Jamais la production** : ne va pas sur `https://les-petits-pronos-de-la-promo.vercel.app` ni sur l'ancienne adresse `le-bon-chiffre.vercel.app`, qui y redirige (vraies données, compte admin réel).
- **Jamais la base Neon** : ne lance ni `npm run db:seed`, ni `npm run db:migrate`, ni `npm run db:check` (ils visent la base de `.env.local`). Ne lis, n'affiche et ne modifie aucun fichier `.env*`.
- **Ne touche pas aux processus de l'utilisateur** : son `next dev` tourne peut-être sur le port 3000. N'arrête que les processus que tu as lancés.
- Pendant que ton serveur tourne, ne lance ni `npm run build`, ni `npm run verify`, ni `npm run test:e2e` : ils réécrivent le dossier `.next` dont ton serveur se sert.
- Si Chrome affiche une page de connexion à un service externe ou un CAPTCHA, arrête-toi et demande à l'utilisateur.

## 3. À lire avant de commencer

Lis-les vraiment : ils te disent ce qui doit se passer, quand, et pour qui.

1. [docs/features/cahier-des-charges.md](../features/cahier-des-charges.md) en entier : les règles du jeu (§5 et §5.5 « cas particuliers »).
2. [docs/architecture/architecture.md](../architecture/architecture.md) :
   - §5 : règles exactes, avec leurs exemples chiffrés (barème, podium, Juste Prix, jokers, classement, badges, pastille « Nouveau », questions, saisons, proclamation) ;
   - §6.2 à §6.6 : inscription, comptes, autorisations, visibilité des pronos ;
   - §8.2 à §8.6 : composants, écrans, responsive, accessibilité, textes ;
   - §9.6 : les données de test (seed).
3. [docs/architecture/avancement.md](../architecture/avancement.md) : le **journal des décisions**. Beaucoup de précisions y sont tranchées (par exemple : un joker se pose dès qu'on coche la case ; `/pronos` s'ouvre sur l'onglet « Tous » ; une question annulée avant son ouverture reste invisible). Avant de signaler un écart, vérifie qu'il ne correspond pas à une décision.

Quand une question ne se tranche pas avec les documents, lis le code (`src/lib/game/` pour les règles, `src/lib/services/` pour les écritures) pour comprendre ce qui est fait, et signale l'écart comme une **question pour l'utilisateur**, pas comme un bogue.

## 4. L'environnement de test : un serveur local, sur des données de test

Tu testes un **build de production lancé en local**, sur une base PGlite (PostgreSQL en fichiers, dans le dossier `.pglite-recette/`, ignoré par git) remplie par le seed. Pourquoi ce choix :

- toutes les situations existent déjà (questions programmées, ouvertes, clôturées, résolues, annulées, brouillon ; saison prête à proclamer) ;
- tu peux tout remettre à zéro en une minute après les actions irréversibles (proclamation, annulation, anonymisation) ;
- ni la production ni la base `dev` de l'utilisateur ne sont touchées, et c'est le même code que celui qui part sur Vercel.

### 4.1 Démarrer

Dans le terminal Bash de Claude Code, à la racine du dépôt :

```bash
# 1. Base de test (efface .pglite-recette, applique les migrations, lance le seed) et build, une seule fois :
export DB_DRIVER=pglite PGLITE_DIR=.pglite-recette BETTER_AUTH_SECRET=recette-locale-0123456789abcdefghijkl BETTER_AUTH_URL=http://127.0.0.1:3200 ADMIN_EMAILS=admin@example.test TZ=UTC && npx tsx scripts/e2e-prepare.ts && npx next build

# 2. Serveur, à lancer en arrière-plan (run_in_background) :
export DB_DRIVER=pglite PGLITE_DIR=.pglite-recette BETTER_AUTH_SECRET=recette-locale-0123456789abcdefghijkl BETTER_AUTH_URL=http://127.0.0.1:3200 ADMIN_EMAILS=admin@example.test TZ=UTC && npx next start -p 3200
```

Chaque commande refait l'`export` : l'état du shell ne se garde pas d'un appel à l'autre.

- Adresse à utiliser dans Chrome : **http://127.0.0.1:3200** (et non `localhost`). Les cookies ne distinguent pas les ports : avec `localhost`, ta session écraserait celle du `next dev` de l'utilisateur.
- Le serveur est prêt quand son journal affiche « Ready ». `http://127.0.0.1:3200/api/health` répond alors `{"ok":true}`.
- Garde un œil sur le journal du serveur : une erreur `⨯` autre que celle citée au §6 est à signaler.

### 4.2 Remettre à zéro

PGlite n'accepte qu'une connexion à la fois : arrête d'abord le serveur.

1. Arrête ta tâche de fond `next start`. Sous Windows, le processus `node` du serveur survit souvent à sa tâche : arrête alors **seulement le processus qui écoute sur le port 3200**, en PowerShell :
   `Get-NetTCPConnection -LocalPort 3200 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess }`
   Ne filtre pas les processus sur le texte de leur ligne de commande : tu risquerais d'arrêter ton propre terminal ou d'autres processus.
2. Relance `npx tsx scripts/e2e-prepare.ts`, puis `npx next start -p 3200`, avec les mêmes variables. Pas besoin de refaire le build.

Les dates du seed se calculent à partir de l'heure où il tourne : après une remise à zéro, les comptes à rebours repartent.

### 4.3 Les données de test

Mot de passe de tous les comptes : `Test-1234!`

| Compte | Nom | Particularités |
|---|---|---|
| `admin@example.test` | Admin | admin ; joue aussi |
| `joueur1@example.test` | Sarah | aucun prono sur les questions ouvertes : idéal pour un premier parcours |
| `joueur2@example.test` | Julien | aucun prono sur les questions ouvertes ; 1 joker déjà posé dans la saison |
| `joueur3@example.test` | Inès | ses 2 jokers de la saison sont posés (limite atteinte) |
| `joueur4@example.test` | Camille | dernière visite il y a 2 h : doit voir la pastille « Nouveau » sur la question ouverte il y a 1 h, **à sa première connexion seulement** (teste-la tôt) |
| `joueur5@example.test` | Thomas | ses 2 jokers de la saison sont posés |
| `joueur6@example.test` | Mehdi | prono validé sur deux questions ouvertes |
| `joueur7@example.test` | Léa | prono enregistré (pas validé) sur la question Juste Prix |
| `joueur8@example.test` | Hugo | prono validé de **987654** (valeur témoin) sur « JPO du 15 novembre » |
| `desactive@example.test` | Nora | compte désactivé, avec des pronos (« inactif » au classement) |
| `nouveau1@example.test` | — | sur la liste blanche, sans compte : pour tester l'inscription |

Trois saisons, qui commencent le 1er octobre : l'ancienne (pas proclamée, **prête à l'être**), la précédente (proclamée, au palmarès) et la courante (sans fin, tant que la suivante n'existe pas). Questions de la saison courante :

| État | Questions |
|---|---|
| Programmée (ouvre dans 2 jours) | « Combien de participants à la JPO de janvier ? » |
| Ouvertes | « JPO du 15 novembre » (nombre, clôture dans 1 jour, donc urgente) ; « Grande École au 31 mai » (Juste Prix, coefficient 2, 3 jours) ; « Quel programme… décembre ? » (choix BBA / Grande École / MSc, 5 jours) ; « Le taux d'intégration du Bachelor dépassera-t-il 60 % ? » (oui/non, ouverte il y a 1 h, 6 jours) |
| Clôturées, sans résultat | « Studyrama » ; « webinaire Grande École de septembre » |
| Résolues | « JPO de septembre » (nombre, réel 250 : Sarah 240, Julien 262 avec joker, Inès et Camille 235, Thomas 300, soit le podium avec ex æquo du vecteur P1) ; « BBA pendant la semaine de rentrée » (Juste Prix, réel 250 : Mehdi 251, Sarah 245, Léa 230, vecteur J3) ; « Quel campus… en Bachelor ? » (choix) |
| Autres | une question annulée (« dossiers complets au 15 octobre », avec un joker posé) ; un brouillon (« intégrés en alternance ») |

Saison précédente (proclamée) : « Grande École au 31 mars » et « Le campus du Havre dépassera-t-il 400 intégrés à la rentrée ? ». Saison ancienne (prête à proclamer) : « JPO de décembre ».

Aussi : catégories JPO, Candidatures, Intégration et Archivée (archivée) ; 2 annonces ; 3 lots pour la saison courante.

### 4.4 Contraintes à connaître

- **Tentatives de connexion** : au plus 5 par minute, tous comptes confondus en local (sans adresse IP, le serveur partage un même compteur) ; inscriptions : 5 par 10 minutes. Si « Trop de tentatives » apparaît pendant tes changements de compte, attends une minute : ce n'est pas un bogue, c'est la règle du §6.1. Espace tes changements de compte.
- **Un seul compte connecté à la fois** dans ta fenêtre : pour changer de compte, menu du compte (en haut à droite), « Se déconnecter », puis `/connexion`.
- **Le temps ne s'accélère pas** : ouverture, clôture et validation automatique dépendent de l'heure réelle (heure de Paris à l'écran). Pour voir une question s'ouvrir puis se clôturer, crée-la avec des dates à quelques minutes (§5, phase B), et continue tes autres tests pendant l'attente.
- Les fenêtres de confirmation sont des `<dialog>` HTML (pas des `alert()`) : clique leurs boutons normalement.

## 5. Le plan de test

Avance phase par phase. Coche au fur et à mesure dans ton rapport : chaque ligne testée est **OK**, **KO** (anomalie) ou **non testée** (avec la raison). Pour chaque page, regarde aussi la console de Chrome : toute erreur JavaScript est à signaler.

### Phase A : tout regarder, sans rien modifier

Connecte-toi d'abord avec **Camille** (pour la pastille « Nouveau »), puis avec Sarah, puis avec l'admin. Parcours chaque page et compare au §8.3 :

- [ ] A1. Camille : la question oui/non porte la pastille « NOUVEAU » sur l'accueil et dans `/pronos` (§5.9).
- [ ] A2. Accueil (§8.3) : annonces (2, avec date relative), « SALUT <NOM> », phrase de progression, barre segmentée, tuiles Position, Points et Jokers (« restant(s) cette saison »), « Clôture imminente » triée par clôture avec comptes à rebours (la première en rouge : moins de 48 h), classement top 6 (plus ta ligne si tu es au-delà), « Dernier résultat ».
- [ ] A3. `/pronos` : onglets « À faire (n) », « Enregistrés (n) », « Validés (n) », « Tous » (ouvert par défaut) ; bandeau bas « n / m validés » ; bouton « Pour t'aider » qui déplie l'aide.
- [ ] A4. `/questions` : onglets Ouvertes, En attente du résultat, Résolues, Annulées ; mes points sur les résolues. La question programmée et le brouillon n'apparaissent nulle part ; leur adresse (`/questions/<id>`, id lu dans `/admin/questions` avec l'admin) répond « Cette page n'existe pas. », admin compris.
- [ ] A5. Question ouverte : formulaire et aide (lien BI ouvert dans un nouvel onglet, « L'an dernier », indice). **Confidentialité** : la valeur 987654 de Hugo n'apparaît jamais, ni à l'écran, ni dans le code source de la page (Ctrl+U), pour aucun autre compte que Hugo, admin compris (§6.6).
- [ ] A6. Question clôturée (« webinaire ») : mon prono, tableau de tous les pronos (joueur, valeur, joker), sagesse de la foule (médiane, moyenne), graphique en points, **sans** valeur réelle, « Résultat attendu le … ».
- [ ] A7. Question résolue à nombre (« JPO de septembre ») : tuile « Réel », médiane, moyenne avec leurs écarts, graphique (trait plein du réel, pointillés de la moyenne, mon point « TOI »), bandeau « Ton prono » (écart, barème, bonus, total), tableau trié par total. Vérifie à la main que les points suivent le barème (§5.5) et le vecteur P1 : Sarah 1re (+20), Julien 2e (+10, joker ×2), Inès et Camille 3es ex æquo (+5 chacune), Thomas 5e (pas de bonus).
- [ ] A8. Question résolue Juste Prix (« BBA … rentrée », vecteur J3) : Mehdi, au-dessus de la valeur réelle, a 0 point et pas de podium ; Sarah 80 + 20 = 100 ; Léa 45 + 10 = 55.
- [ ] A9. Question résolue à choix (« Quel campus… ») : répartition des réponses en pourcentages (somme 100), « Bonne réponse », « (ton choix) », 50 points × coefficient × joker.
- [ ] A10. Question annulée : bandeau « Question annulée : aucun point n'est attribué et les jokers sont rendus. », sans les pronos.
- [ ] A11. `/classement` : ordre, flèches ▲▼ et « = » (évolution depuis le résultat précédent), « (toi) », « (inactif) » pour Nora, note de départage, sélecteur de saison (3 saisons), lien vers le palmarès sur la saison proclamée ; le nom mène au profil sur la même saison.
- [ ] A12. `/joueurs/<id>` : rang et points de la saison, tuiles (écart moyen, Dans le mille, pronos joués), les 6 badges (obtenus en couleur avec compteur, les autres grisés), historique des questions résolues.
- [ ] A13. `/palmares` : la saison précédente, podium avec avatars, classement complet dépliable, lots attribués.
- [ ] A14. `/lots` (3 lots de la saison courante) et `/reglement` : les valeurs affichées (paliers, bonus, 50 points, ×2, 2 jokers, coefficients 1 à 3) sont exactement celles de `src/lib/game/constants.ts`, et l'exemple chiffré est juste.
- [ ] A15. Pied de page « Les petits pronos de la promo · Saison … » et ses liens ; en-tête (navigation active, lien « ADMIN » pour l'admin seulement, menu du compte).
- [ ] A16. Admin, en lecture : tableau de bord (questions ouvertes avec « validés x / N » et les retardataires, « À résoudre », « Prochaines ouvertures »), `/admin/questions` (filtres statut, saison, catégorie, dans l'adresse), page d'une question ouverte (suivi par joueur, **états seulement** avant la clôture ; historique sans valeurs), page d'une question clôturée (valeurs visibles), `/admin/joueurs`, `/admin/categories`, `/admin/saisons`, `/admin/annonces`.

### Phase B : lancer tôt un scénario dans le temps

Avec l'admin, crée une question de bout en bout, puis laisse le temps faire pendant que tu continues les phases C et D :

- [ ] B1. `/admin/questions/nouvelle` : une question à nombre (catégorie JPO, énoncé, unité, source, aide), ouverture **dans 3 minutes**, clôture **dans 15 minutes**, résultat prévu dans 20 minutes (heure de Paris). Enregistre (brouillon), puis « Publier ». Attendu : elle est « programmée », invisible des joueurs (404), visible dans « Prochaines ouvertures ».
- [ ] B2. À l'ouverture : elle apparaît chez les joueurs avec la pastille « NOUVEAU » et un compte à rebours ; le compte à rebours d'une page ouverte se met à jour seul.
- [ ] B3. Avec 3 joueurs : un prono **enregistré seulement**, un **validé**, un avec **joker**. Avec l'admin, avant la clôture : « validés x / N » juste, états seulement, aucune valeur.
- [ ] B4. À la clôture : sans recharger, le compte à rebours affiche « CLÔTURÉ » et la page se rafraîchit ; le prono seulement enregistré est désormais « Validé » (§5.4) ; la question passe dans « En attente du résultat » ; tout le monde voit les valeurs de tous.
- [ ] B5. L'admin saisit le résultat (tableau de bord, « Saisir le résultat ») : points, podium, classement et flèches mis à jour ; « Dernier résultat » de l'accueil ; badges éventuels (« Dans le mille », Tireur d'élite, Joker gagnant).
- [ ] B6. L'admin corrige le résultat : les points changent, la page de la question affiche « Résultat corrigé le … ».

### Phase C : le parcours joueur, avec écritures

Avec Sarah et Julien, puis Inès ou Thomas pour les limites :

- [ ] C1. Lecture des nombres (§5.3) : `2 450` et `2450,5` et `12.5` acceptés ; `2.450` refusé (« Écris 2450 ou 2 450 (pas de point pour les milliers). ») ; `12,345`, `-3`, `1e5`, champ vide, `1.234,5` refusés avec leur message.
- [ ] C2. « Enregistrer » : statut « Enregistré », message, date « Enregistré le … », le prono reste modifiable.
- [ ] C3. « Valider » : fenêtre « Valider ton prono ? » qui montre la valeur formatée (et « Joker posé »), « Annuler » (le focus est dessus, Échap ferme) puis « Valider définitivement » : statut « Validé », champ en lecture seule, plus de boutons.
- [ ] C4. Joker : case grisée avec « Enregistre d'abord ton prono. » tant qu'il n'y a pas de prono ; posée aussitôt cochée, retirée aussitôt décochée ; compteur de l'accueil à jour ; au troisième joker de la saison, refus (Inès ou Thomas) : « Tu as déjà utilisé tes 2 jokers cette saison. »
- [ ] C5. Questions à choix et oui/non : sélection, enregistrement, validation ; Juste Prix : rappel « Le plus proche sans dépasser ».
- [ ] C6. Onglets de `/pronos` qui suivent les changements ; « Encore n pronos à valider » de l'accueil.
- [ ] C7. Profil : changer son nom (2 à 30 caractères, nom déjà pris refusé : « Ce nom est déjà pris. »), le nouveau nom apparaît dans l'en-tête et au classement ; changer d'avatar (16 maillots) ; changer de mot de passe (mot de passe actuel faux refusé, confirmation différente refusée), puis se reconnecter avec le nouveau. **Remets ensuite le mot de passe `Test-1234!` et le nom d'origine**, sinon note-le dans le rapport.

### Phase D : comptes et accès

- [ ] D1. Sans session : toute page du jeu renvoie vers `/connexion` ; `/connexion` et `/inscription` restent accessibles.
- [ ] D2. Connexion : mauvais mot de passe (« Email ou mot de passe incorrect. ») ; compte désactivé de Nora (« Ton compte est désactivé. Contacte l'admin. ») ; 6 essais faux en moins d'une minute (« Trop de tentatives. Réessaie dans une minute. »). Un joueur déjà connecté qui ouvre `/connexion` revient à l'accueil.
- [ ] D3. Inscription : adresse hors liste blanche refusée (« Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin. ») ; adresse déjà inscrite refusée ; nom déjà pris refusé ; mots de passe différents refusés ; `nouveau1@example.test` accepté, avec arrivée sur l'accueil, connecté.
- [ ] D4. Un joueur qui ouvre `/admin` ou une page `/admin/…` voit la page 404 ; aucun lien « ADMIN » dans son en-tête.
- [ ] D5. « Mot de passe oublié ? » : le texte renvoie vers l'admin (le site n'envoie aucun email).

### Phase E : le back-office

Avec l'admin. Garde pour la phase F les actions irréversibles.

- [ ] E1. Création de questions (§5.11) : les 4 types (Nombre, Nombre Juste Prix, Choix, Oui/Non) ; champs obligatoires (catégorie, énoncé de 5 à 200 caractères, source) ; choix : 2 à 10 réponses, libellés uniques (« Deux réponses ont le même libellé. »), ajout, retrait, ordre ; une catégorie archivée n'est pas proposée.
- [ ] E2. Publication refusée avec un message clair : sans dates, clôture passée, ouverture après la clôture, résultat prévu avant la clôture.
- [ ] E3. Liste : actions groupées « Définir les dates » (trois champs, heure de Paris, bilan par question) et « Publier » (bilan : publiées, déjà publiées, échecs avec raisons) ; « Dupliquer » (copie en brouillon sans dates ; dupliquer une question résolue préremplit « Valeur de l'an dernier »).
- [ ] E4. Modification d'une question **avec pronos** : type, énoncé, réponses, source, coefficient désactivés avec la raison ; catégorie, aide et résultat prévu modifiables ; clôture seulement repoussée (pas avancée), et pas dans une autre saison.
- [ ] E5. Suppression d'un brouillon sans prono (confirmation) ; impossible pour une question publiée (« Annuler la question » à la place).
- [ ] E6. Déverrouillage : sur la question ouverte, « Déverrouiller » le prono validé d'un joueur ; le joueur peut de nouveau le modifier ; l'historique trace l'action de l'admin.
- [ ] E7. Catégories : ajout, renommage, nom en double refusé (même avec une autre casse), archivage puis réactivation.
- [ ] E8. Annonces : création (compteur « n / 500 caractères », limite à 500), modification, suppression (confirmation) ; l'accueil montre les 3 plus récentes.
- [ ] E9. Saisons et lots (§5.13) : créer une saison future (nom proposé, date de début « à 0 h, heure de Paris ») ; la renommer ; déplacer sa date (refus hors de l'intervalle entre ses voisines) ; la supprimer ; rappel « pense à créer la suivante » ; éditeur de lots (ajout, ordre, retrait, enregistrement, visibles dans `/lots`). Refus attendus : deux saisons le même jour, nom en double, supprimer une saison qui contient des questions.
- [ ] E10. Liste blanche : ajout en série (une adresse par ligne, virgules et points-virgules), bilan « n ajoutées, n déjà présentes, n invalides » ; retrait d'une adresse sans compte ; retrait refusé pour une adresse qui a un compte.
- [ ] E11. Comptes : passer un joueur admin puis joueur ; impossible de se retirer soi-même le rôle admin ou de se désactiver ; mot de passe provisoire (affiché une fois, bouton « Copier »), puis connexion du joueur avec ce mot de passe dans une session à part.

### Phase F : les actions irréversibles

Fais-les à la fin, puis remets à zéro (§4.2) si tu dois encore tester autre chose.

- [ ] F1. Annuler une question ouverte qui porte un joker : confirmation ; les joueurs la voient « annulée », sans pronos ; le joker est rendu (compteur de jokers de l'accueil).
- [ ] F2. Proclamer la saison ancienne (`/admin/saisons`) : le bouton de la saison courante est désactivé avec sa raison ; confirmation qui rappelle que c'est irréversible ; la saison apparaît au palmarès ; ses lots ne sont plus modifiables.
- [ ] F3. Désactiver puis réactiver un joueur : désactivé, il ne peut plus se connecter (et sa session ouverte tombe) ; il apparaît « (inactif) » au classement s'il a des pronos.
- [ ] F4. Anonymiser un joueur qui figure au palmarès : confirmation ; il devient « Ancien joueur n » partout, palmarès compris ; ses pronos restent comptés.

### Phase G : sur tout le site

- [ ] G1. **Téléphone** : à 390 px de large (redimensionne la fenêtre si ton outil le permet ; sinon, note ce point comme non testé), aucune page ne défile sur le côté ; menu « Menu » ; `/classement` affiche la liste compacte (rang, joueur, évolution, points) ; les tableaux défilent dans leur cadre ; les boutons restent accessibles.
- [ ] G2. **Clavier** : on parcourt l'accueil, `/pronos` et un formulaire de l'admin avec Tab ; le focus est visible (contour bleu) ; les fenêtres de confirmation se ferment avec Échap.
- [ ] G3. **Textes** (§8.6) : français, tutoiement, phrases courtes ; jamais « pari », « parier », « mise », « miser » ; nombres « 2 450 » et décimales à virgule ; dates du type « mer. 21 oct. à 18 h ». Note toute faute, coquille ou phrase peu claire.
- [ ] G4. Page 404 en français (« Cette page n'existe pas. », « Retour à l'accueil »).
- [ ] G5. Chargement : en naviguant, des blocs gris peuvent s'afficher brièvement sur l'accueil, `/pronos`, `/classement` et une question ; ils ne doivent pas rester affichés ni clignoter de façon gênante.

### Phase H (facultative, avec l'accord de l'utilisateur) : l'aperçu Vercel

Seulement si l'utilisateur le demande quand tu lui présentes ton rapport : sur l'aperçu de la branche `etape-08-finitions` (base `dev`, mêmes comptes de test), vérifie la connexion, l'accueil, un prono et `/classement`, sans action d'admin. **Jamais la production.**

## 6. Ce qui n'est pas un bogue

- « Trop de tentatives » quand tu changes souvent de compte (§4.4).
- Avant la clôture, **personne** ne voit les valeurs des autres, pas même l'admin ; l'admin ne voit que des états.
- Une question programmée, un brouillon ou une question annulée avant son ouverture répondent 404 sur les pages du jeu, **admin compris** (il a le back-office).
- Un prono seulement enregistré devient « Validé » à la clôture, sans action de personne.
- `/classement` est toujours recalculé ; le palmarès, lui, est figé à la proclamation.
- Sous 640 px, `/classement` montre une liste compacte au lieu du tableau (décision du 01/10/2026).
- Une question qui a des pronos ne change pas de saison, et ses champs principaux ne se modifient plus.
- Aucune question ne peut être publiée dans une saison proclamée.
- Le journal du serveur affiche `Error: The destination stream closed early.` quand on quitte une page avant la fin de son chargement : sans conséquence (architecture §14).
- Le site n'envoie aucun email, par choix (cahier des charges §6).

## 7. Le rapport

Écris-le dans `docs/recette/rapport-recette-AAAA-MM-JJ.md` (date du jour), en français, pour l'utilisateur, qui n'est pas développeur. Captures dans `docs/recette/captures/` (une par anomalie au moins). Ne commite rien.

1. **Résumé** en 5 lignes au plus : le site est-il prêt pour la recette avec les collègues ? Les anomalies bloquantes en premier.
2. **Tableau par phase** : nombre de lignes OK, KO, non testées.
3. **Anomalies**, de la plus grave à la moins grave, chacune avec :
   - un identifiant (`R-01`, `R-02`…) et la ligne du plan (`C4`…) ;
   - une gravité : **bloquante** (empêche de jouer ou d'administrer, ou fausse les points), **majeure** (une règle n'est pas respectée, contournement possible), **mineure** (affichage, texte), **suggestion** ;
   - la page, le compte utilisé, les étapes pour reproduire ;
   - **attendu**, avec sa source (cahier §…, architecture §…, décision du journal du …) ;
   - **observé**, avec la capture ;
   - si tu l'as trouvée en lisant le code, une piste de cause (sans corriger).
4. **Questions pour l'utilisateur** : les écarts que les documents ne tranchent pas.
5. **Non testé** : ce que tu n'as pas pu tester, et pourquoi.

## 8. Pour finir

1. Arrête ton serveur (§4.2, étape 1) et supprime le dossier `.pglite-recette/`.
2. Vérifie avec `git status` que seuls ton rapport et tes captures sont nouveaux.
3. Présente à l'utilisateur le résumé et la liste des anomalies, avec le lien vers le rapport. Les corrections seront faites ensuite par un agent de construction, pendant l'É9 (recette) : propose-lui de leur transmettre ce rapport.
