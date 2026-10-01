# Rapport de recette : Le Bon Chiffre (1er octobre 2026)

Recette faite par un agent Claude Code dans Chrome, le 01/10/2026 de 11 h 30 à 12 h 20, sur un build de production lancé en local (`127.0.0.1:3200`, base PGlite remplie par le seed). Ni la production ni la base Neon n'ont été touchées. Le plan suivi est celui de [prompt-recette-agent.md](prompt-recette-agent.md).

## 1. Résumé

- **Aucune anomalie bloquante ni majeure.** Les règles du jeu sont justes : j'ai recalculé à la main les points de 5 questions résolues, le podium, les ex æquo, le Juste Prix, les jokers, le classement, les flèches et les badges. Tout correspond.
- La confidentialité tient : la valeur témoin 987654 n'apparaît jamais, ni à l'écran ni dans le code des pages, et l'admin ne voit que des états avant la clôture.
- Deux anomalies mineures méritent une correction avant le 14 octobre : sur téléphone, **l'accueil déborde sur le côté** quand un nom long est dans le top 6 (R-01), et **le titre d'onglet des pages d'admin reste visible pour un joueur** sur la page 404 (R-02).
- Le reste est de la finition : un point caché sous l'étiquette « TOI », des messages de succès qui restent affichés, une majuscule après deux-points, l'espace des milliers peu visible.
- **Le site est prêt pour la recette avec les collègues.**

## 2. Bilan par phase

| Phase | OK | KO | Non testées |
|---|---|---|---|
| A. Tout regarder (16 lignes) | 15 | 1 (A7) | 0 |
| B. Scénario dans le temps (6) | 5 | 1 (B1) | 0 |
| C. Parcours joueur (7) | 7 | 0 | 0 |
| D. Comptes et accès (5) | 4 | 1 (D4) | 0 |
| E. Back-office (11) | 10 | 1 (E9) | 0 |
| F. Actions irréversibles (4) | 4 | 0 | 0 |
| G. Sur tout le site (5) | 3 | 2 (G1, G3) | 0 |
| H. Aperçu Vercel (facultative) | 0 | 0 | 1 (pas demandée) |
| **Total** | **48** | **6** | **1** |

Une ligne KO veut dire « une anomalie trouvée sur cette ligne », même si l'essentiel de la ligne fonctionne. Toutes les anomalies sont mineures ou des suggestions.

### Détail des lignes

**Phase A**

- A1 OK : Camille voit « NOUVEAU » sur la question oui/non, à l'accueil et dans `/pronos`.
- A2 OK : annonces avec date relative (« il y a 3 h », « il y a 2 j »), « SALUT CAMILLE », progression, barre segmentée, tuiles Position, Points et Jokers, clôtures triées avec compte à rebours rouge sous 48 h, top 6 avec la ligne du joueur au-delà, « Dernier résultat ».
- A3 OK : onglets avec compteurs, « Tous » ouvert par défaut, bandeau « 1 / 4 validés », « Pour t'aider » se déplie.
- A4 OK : la question programmée et le brouillon n'apparaissent nulle part, et leur adresse répond 404, admin compris.
- A5 OK : formulaire, lien BI dans un nouvel onglet, « L'an dernier », indice. La valeur 987654 est absente du code des pages pour Camille et pour l'admin.
- A6 OK : « webinaire » montre les pronos de tous, médiane 125 et moyenne 124 (vérifiées), graphique, « Résultat attendu le dim. 11 oct. à 11 h 31 », sans valeur réelle.
- A7 **KO (R-03)** : les points sont justes (Sarah 85, Julien 150, Inès et Camille 50, Thomas 25). Mais le point d'Inès est caché sous l'étiquette « TOI » de Camille.
- A8 OK : Mehdi 0 point sans podium, Sarah 80 + 20 = 100, Léa 45 + 10 = 55.
- A9 OK : 25 %, 63 %, 12 % (somme 100), « Bonne réponse », « (ton choix) », 50 × coefficient 2, × 2 pour le joker de Thomas (200).
- A10 OK : bandeau d'annulation, sans les pronos.
- A11 OK : ordre, flèches et « = » recalculés à la main, « (toi) », « (inactif) », note de départage, 3 saisons, lien vers le palmarès, noms reliés au profil de la même saison.
- A12 OK : profil de Sarah (écart moyen 3 %, badges en couleur avec compteur, historique).
- A13 OK : podium avec avatars et classement complet dépliable. Aucun lot n'était attribué aux saisons passées dans les données de test.
- A14 OK : `/lots` montre les 3 lots ; `/reglement` reprend exactement les valeurs de `constants.ts`, et l'exemple chiffré est juste.
- A15 OK : pied de page « Le Bon Chiffre · Saison 2026-2027 » avec ses liens, navigation active, lien « ADMIN » pour l'admin seulement, menu du compte.
- A16 OK : tableau de bord (« validés x / 9 », retardataires, « À résoudre », « Prochaines ouvertures »), filtres dans l'adresse, suivi en états seulement avant la clôture, valeurs visibles après, pages Joueurs, Catégories, Saisons, Annonces.

**Phase B** (question « Recette B » : ouverture 11 h 40, clôture 12 h, résultat prévu 12 h 05)

J'ai pris 20 minutes entre l'ouverture et la clôture au lieu de 12, pour avoir le temps de faire jouer trois comptes.

- B1 **KO (R-04)** : brouillon, puis « Programmée », 404 côté jeu et visible dans « Prochaines ouvertures ». Mais après la publication, la page affiche encore « Question créée en brouillon. Complète ses dates, puis publie-la. »
- B2 OK : à 11 h 40, la question apparaît chez Camille avec « NOUVEAU », et le compte à rebours défile seul.
- B3 OK : Camille a enregistré 300 sans valider, Sarah a validé 2 500, Julien a validé 280 avec joker. Côté admin : « Validés 2 / 9 », états seulement, aucune valeur dans le code de la page.
- B4 OK : à 12 h, la page s'est rafraîchie seule, sans rechargement complet, et affiche les pronos de tous. Le prono enregistré de Camille est passé « Validé ». La question est dans « À résoudre ».
- B5 OK : résultat 280. Julien 240 (Dans le mille, avec joker), Camille 55, Sarah 5. Classement et flèches justes, « Dernier résultat » à jour, badges de Julien attribués (Premier « Dans le mille », Tireur d'élite, Joker gagnant ×2).
- B6 OK : correction à 300. « Résultat corrigé le jeu. 1er oct. à 12 h 01. » Camille 120, Julien 110, Sarah 5 ; classement recalculé.

**Phase C**

- C1 OK : « 2 450 », « 2450,5 » et « 12.5 » acceptés. « 2.450 », « 12,345 », « -3 », « 1e5 », champ vide et « 1.234,5 » refusés avec le bon message.
- C2 OK : statut « Enregistré », « Prono enregistré. », date, prono modifiable.
- C3 OK : fenêtre « Valider ton prono ? » avec « 2 500 visiteurs » (et « Joker posé » pour Julien). Le focus est sur « Annuler », Échap ferme. Après validation : champ en lecture seule, plus de boutons.
- C4 OK : case grisée avec « Enregistre d'abord ton prono. », joker posé et retiré aussitôt, compteur de l'accueil à jour. Sans joker restant, la case est grisée (« 0 restant cette saison »). En forçant la case, le serveur répond « Tu as déjà utilisé tes 2 jokers cette saison. »
- C5 OK : choix (BBA) enregistré et validé, rappel « Le plus proche sans dépasser » pour le Juste Prix. Pour le oui/non, j'ai vérifié l'affichage des deux tuiles, sans enregistrer de prono.
- C6 OK : onglets et « Encore n pronos à valider » suivent les changements.
- C7 OK, fait avec Léa (pas Sarah) : nom d'1 caractère refusé, « SARAH » refusé (« Ce nom est déjà pris. »), 30 caractères au plus, nouveau nom visible dans l'en-tête et au classement, avatar changé. Mot de passe actuel faux et confirmation différente refusés, puis reconnexion avec le nouveau mot de passe. **Nom, avatar et mot de passe `Test-1234!` remis.**

**Phase D**

- D1 OK : toutes les pages du jeu et de l'admin renvoient vers `/connexion` ; `/connexion`, `/inscription` et `/api/health` restent accessibles.
- D2 OK : « Email ou mot de passe incorrect. », « Ton compte est désactivé. Contacte l'admin. » (Nora), puis « Trop de tentatives. Réessaie dans une minute. » au 6e essai. Un joueur connecté qui ouvre `/connexion` ou `/inscription` revient à l'accueil.
- D3 OK : hors liste blanche, adresse déjà inscrite, nom déjà pris (même en minuscules) et mots de passe différents refusés avec les bons messages. `nouveau1` accepté, arrivée sur l'accueil, connecté.
- D4 **KO (R-02)** : un joueur reçoit bien la page 404 sur `/admin` et ses sous-pages, et n'a pas de lien « ADMIN ». Mais l'onglet affiche « Back-office · Le Bon Chiffre ».
- D5 OK : « Mot de passe oublié ? Demande à l'admin un mot de passe provisoire. »

**Phase E**

- E1 OK : 4 types proposés, champs obligatoires refusés avec messages, saisie gardée après un refus. Réponses : ajout, ordre, retrait, « Deux réponses ont le même libellé. » La catégorie archivée n'est pas proposée.
- E2 OK : publication refusée sans dates, avec une clôture passée, une ouverture après la clôture ou un résultat prévu avant la clôture. Voir R-06 pour la forme des messages.
- E3 OK : « Dupliquer » (copie en brouillon sans dates, « Valeur de l'an dernier » préremplie avec le résultat), « Définir les dates » avec bilan (« Dates appliquées à 2 questions » + la raison de l'échec), « Publier » avec bilan (« 2 questions publiées. 2 déjà publiées. », puis un échec avec sa raison).
- E4 OK : sur une question avec pronos, type, énoncé, description, unité, source, coefficient et ouverture sont désactivés avec la raison ; catégorie, aide, clôture et résultat prévu restent modifiables ; avancer la clôture est refusé. Je n'ai pas testé le report dans une autre saison.
- E5 OK : suppression d'un brouillon après confirmation ; une question publiée n'a que « Annuler la question ».
- E6 OK : déverrouillage du prono de Mehdi, que Mehdi a pu modifier ; l'historique indique « Déverrouillé par Admin ». Le prono a été revalidé ensuite.
- E7 OK : ajout, renommage, doublon refusé quelle que soit la casse (« jpo », « CANDIDATURES »), archivage puis réactivation.
- E8 OK : compteur « n / 500 caractères », saisie bloquée à 500, modification, suppression avec confirmation, l'accueil montre les 3 plus récentes.
- E9 **KO (R-04, R-05, R-09)** : création (nom proposé, « à 0 h, heure de Paris »), renommage, déplacement refusé hors de l'intervalle, suppression, rappel « pense à créer la suivante », éditeur de lots (ajout, ordre, retrait, visible dans `/lots`), refus « même jour », « nom en double » et suppression d'une saison qui contient des questions : tout fonctionne. Défauts d'affichage détaillés dans les anomalies.
- E10 OK : ajout en série (virgules, points-virgules, lignes, majuscules et espaces nettoyés), bilan « 3 ajoutées, 1 déjà présente, 1 invalide. À corriger : pas-une-adresse », retrait d'une adresse sans compte. Une adresse qui a un compte n'a pas de bouton « Retirer ».
- E11 OK : Léa passée admin puis joueur. Aucune action sur son propre compte (« C'est toi »). Mot de passe provisoire affiché une fois, avec « Copier » et « Terminé », puis connexion de Léa avec ce mot de passe. Je n'ai pas cliqué sur « Copier », pour ne pas écrire dans ton presse-papiers.

**Phase F**

- F1 OK : annulation de « JPO du 15 novembre » après confirmation (« Ce n'est pas réversible »). Les joueurs la voient dans « Annulées », sans pronos. Le joker de Thomas est rendu (0/2 → 1/2).
- F2 OK : le bouton de la saison courante est désactivé, avec sa raison. La confirmation rappelle que c'est irréversible et que les lots seront figés. 2024-2025 apparaît au palmarès, ses lots ne sont plus modifiables.
- F3 OK : Hugo désactivé. Sa session ouverte à part (connexion HTTP depuis PowerShell) est renvoyée vers `/connexion`, sa connexion est refusée (« Ton compte est désactivé. »), et il apparaît « (inactif) » au classement. Puis réactivé.
- F4 OK : Camille, 1re du palmarès 2024-2025, devient « Ancien joueur 1 » partout, palmarès compris. Ses 170 points restent comptés et son adresse a quitté la liste blanche.

**Phase G**

- G1 **KO (R-01)** : à 390 px, menu « Menu », liste compacte de `/classement`, tableaux défilant dans leur cadre et boutons accessibles. Aucune des 11 pages joueur testées ni des 9 pages d'admin ne déborde, **sauf l'accueil**.
- G2 OK : Tab parcourt l'accueil, `/pronos` et le formulaire de question dans un ordre logique. Le focus est visible partout (contour bleu, porté par le cadre pour le champ du prono). Échap ferme les fenêtres.
- G3 **KO (R-06, R-07, R-08)** : aucun « pari », « mise » ni vouvoiement sur 23 pages (seule « Paris », la ville). Nombres et dates au bon format. Quelques défauts de forme détaillés plus bas.
- G4 OK : « Cette page n'existe pas. » et « Retour à l'accueil ».
- G5 OK : aucun bloc gris ne reste affiché ni ne clignote. Le serveur local est trop rapide pour les voir apparaître.

Console de Chrome : aucune erreur JavaScript. Journal du serveur : aucune erreur `⨯`, seulement les avertissements « Invalid password » attendus pendant D2.

## 3. Anomalies

### R-01 · G1 · mineure : sur téléphone, l'accueil déborde quand un nom long est dans le top 6

- **Page et compte** : `/`, Thomas puis l'admin, fenêtre de 390 px.
- **Pour reproduire** : avoir dans le top 6 de la saison un joueur au nom long, par exemple « Ancien joueur 1 (inactif) » après une anonymisation, ou un nom de 20 à 30 caractères. Ouvrir l'accueil sur un téléphone.
- **Attendu** : « À 390 px de large : aucun défilement horizontal de la page » (architecture §8.4).
- **Observé** : la page fait 424 px de large pour un écran de 390 px. Les blocs « Clôture imminente » et « Classement » dépassent à droite et la page défile sur le côté. La ligne « Ancien joueur 1 (inactif) » du classement réclame à elle seule 366 px. Avec les noms courts du seed, rien ne déborde : c'est pour cela que le test automatique de l'É8 passait. `/classement`, qui affiche la même liste, ne déborde pas.
- **Capture** : impossible. Chrome refuse de redimensionner la fenêtre principale, et la petite fenêtre de 390 px que j'ai ouverte pour mesurer est hors de portée de mon outil de capture. Mesures relevées dans cette fenêtre, sans barre de défilement : largeur de page 424 px pour 390 px visibles ; largeur minimale des sections : Clôture imminente 180 px, **Classement 408 px**.
- **Piste de cause** : dans [page.tsx](../../src/app/%28jeu%29/%28accueil%29/page.tsx#L105) (accueil), la grille `grid gap-4 lg:grid-cols-12` n'a pas de colonne définie sous 1 024 px. Sa colonne automatique prend la largeur minimale de son contenu. Le nom tronqué de la liste du classement ne se réduit pas : il manque sans doute un `min-w-0` dans la chaîne flex, ou un `grid-cols-1` / `minmax(0,1fr)` sur la grille.

### R-02 · D4 · mineure : le titre d'onglet des pages d'admin est visible par un joueur

- **Page et compte** : `/admin`, `/admin/joueurs`…, compte joueur (`nouveau1`).
- **Pour reproduire** : connecté en joueur, ouvrir `/admin`.
- **Attendu** : « Un joueur non admin reçoit la page 404 (on ne révèle pas l'existence du back-office) » (architecture §6.4).
- **Observé** : la page 404 s'affiche bien, mais l'onglet s'intitule « Back-office · Le Bon Chiffre ». Le code de la réponse contient « Back-office » sur `/admin` et « Joueurs · Le Bon Chiffre » sur `/admin/joueurs`. Une adresse qui n'existe pas (`/nimporte-quoi`) donne seulement « Le Bon Chiffre ». Un joueur curieux peut donc savoir que ces pages existent et comment elles s'appellent, sans voir aucune donnée.
- **Capture** : aucune, le titre d'onglet n'apparaît pas sur une capture de la page. Constaté dans le titre de l'onglet et dans le HTML renvoyé.
- **Piste de cause** : les pages de `src/app/admin/` exportent un `metadata` statique (par exemple [page.tsx](../../src/app/admin/page.tsx#L13) : `title: "Back-office"`). Next l'émet même quand [layout.tsx](../../src/app/admin/layout.tsx) appelle `requireAdmin()`, qui renvoie la 404. Piste : un `generateMetadata` qui vérifie le rôle, ou un titre défini dans le layout après le contrôle.

### R-03 · A7 · mineure : un point du graphique est caché sous l'étiquette « TOI »

- **Page et compte** : `/questions/4` (« JPO de septembre »), Camille.
- **Pour reproduire** : un autre joueur a fait le même prono que moi (Inès et Camille : 235).
- **Attendu** : chaque prono est un point du graphique (cahier des charges §4.4, architecture §8.2 StripChart).
- **Observé** : 5 pronos mais 4 points visibles. Le point gris d'Inès, placé sur la rangée du dessus, est recouvert par l'étiquette « TOI ».
- **Captures** : [a7-point-cache-sous-toi.jpg](captures/a7-point-cache-sous-toi.jpg), zoom : [a7-point-cache-sous-toi-zoom.png](captures/a7-point-cache-sous-toi-zoom.png).
- **Piste de cause** : dans [StripChart.tsx](../../src/components/game/StripChart.tsx#L82-L87), l'étiquette « TOI » est posée 20 px au-dessus du point du joueur, avec `z-10`. Les rangées n'étant espacées que de 14 px (`ROW_TOPS = [66, 52, 38, 24]`), un point de la rangée suivante à la même valeur tombe dessous.

### R-04 · B1, E9 · mineure : des messages de succès restent affichés après une autre action

- **Pages et compte** : `/admin/questions/<id>` et `/admin/saisons`, admin.
- **Pour reproduire** :
  1. Créer une question avec ses dates (« Enregistrer le brouillon »), puis cliquer sur « Publier ». En haut de la page, à côté du statut « Programmée », reste affiché « Question créée en brouillon. Complète ses dates, puis publie-la. », en plus de « Question enregistrée et publiée. ».
  2. Créer une saison, puis la supprimer. « Saison créée. » reste affiché sous le formulaire.
  3. Même chose, en moins gênant, pour « Catégorie ajoutée. » après un renommage refusé, et pour le bilan de la liste blanche après le retrait d'une adresse.
- **Attendu** : un message qui décrit l'état courant (architecture §8.5 : résultats d'actions annoncés). Aucune règle précise n'est écrite.
- **Observé** : des messages contradictoires (« Complète ses dates, puis publie-la » sur une question déjà programmée, « Saison créée » après une suppression).
- **Captures** : [b1-message-brouillon-apres-publication.jpg](captures/b1-message-brouillon-apres-publication.jpg), [e9-message-et-suggestion-perimes.jpg](captures/e9-message-et-suggestion-perimes.jpg).
- **Piste de cause** : pour la question, le message vient du paramètre `?creee=1` de l'adresse ([actions/questions.ts](../../src/lib/actions/questions.ts#L70), [page.tsx](../../src/app/admin/questions/%5Bid%5D/page.tsx#L233)), qui reste après la publication. Pour les autres, l'état du formulaire précédent n'est pas effacé.

### R-05 · E9 · mineure : après la suppression d'une saison, le formulaire propose encore une date fondée sur elle

- **Page et compte** : `/admin/saisons`, admin.
- **Pour reproduire** : créer la saison 2027-2028 (6 sept. 2027), puis la supprimer, sans recharger la page.
- **Attendu** : le formulaire propose la date de début de la dernière saison un an plus tard (décision du 30/09/2026), soit 01/10/2027 et « 2027-2028 ».
- **Observé** : il propose 06/09/2028 et « 2028-2029 », calculés d'après la saison supprimée. Après un rechargement, la proposition est juste.
- **Capture** : [e9-message-et-suggestion-perimes.jpg](captures/e9-message-et-suggestion-perimes.jpg).

### R-06 · G3 · mineure : majuscule après deux-points dans les refus de publication

- **Page et compte** : `/admin/questions/<id>`, bouton « Publier », admin.
- **Observé** : « Question enregistrée, mais pas publiée : La clôture est déjà passée. » et « … pas publiée : Il manque la date d'ouverture. Il manque la date de clôture. »
- **Attendu** : en français, pas de majuscule après un deux-points (architecture §8.6).
- **Capture** : [e2-majuscule-apres-deux-points.jpg](captures/e2-majuscule-apres-deux-points.jpg).

### R-07 · G3 · suggestion : l'espace des milliers est presque invisible

- **Pages** : graduations des graphiques et grands chiffres (`/questions/16` : « 1 000 », « 1 500 », « 1 027 »).
- **Observé** : le séparateur utilisé est une espace fine insécable. Dans la police du site, elle est si fine qu'on lit « 1000 », « 1500 » ou « 1027 ». Ailleurs (« 2 150 », « 2 500 visiteurs »), elle reste visible.
- **Attendu** : « Nombres au format français (« 2 450 ») » (architecture §8.6).
- **Capture** : [g3-separateur-milliers-peu-visible.png](captures/g3-separateur-milliers-peu-visible.png).

### R-08 · G3 · suggestion : dates sans année pour les saisons passées

- **Observé** : `/admin/saisons` affiche « Proclamé le ven. 27 févr. à 23 h » sans l'année, alors que `/palmares` affiche « 27 févr. 2026 ». Les questions résolues des saisons passées, dans `/questions`, portent « Résolue sam. 29 nov. à 23 h » ou « jeu. 19 déc. à 23 h », sans l'année.
- **Attendu** : le format « mer. 21 oct. à 18 h » (architecture §8.6), pensé pour la saison en cours. Pour des dates d'une autre année, l'année éviterait l'ambiguïté.

### R-09 · E9 · suggestion : « SAISON SAISON TEST »

- **Observé** : une saison nommée « Saison test » s'affiche « SAISON SAISON TEST » dans `/admin/saisons`, car le titre ajoute toujours « Saison » devant le nom. Cas rare : l'admin nommera ses saisons « 2027-2028 ».

## 4. Questions pour toi

Ces points ne sont pas des bogues au regard des documents, mais ils méritent ton avis.

1. **Admin qui joue et jokers** : avant la clôture, l'historique de la page admin d'une question montre qui a posé un joker (« Thomas · Joker posé »), sans les valeurs. C'est conforme à l'architecture (§6.6 : « types et horaires, sans valeurs »). Mais l'admin joue aussi : est-ce une information que tu acceptes de voir ?
2. **Juste Prix dépassé et départage** : un prono qui dépasse la valeur réelle rapporte 0 point, mais son écart (0,4 % pour Mehdi) compte dans l'écart moyen qui sert au départage (§5.6 : « Juste Prix compris »). Un prono trop haut peut donc aider au départage. C'est conforme au document : est-ce voulu ?
3. **Actions sans confirmation** : « Désactiver », « Passer admin / joueur » et « Retirer » (liste blanche) s'exécutent d'un clic. C'est conforme aux documents, qui ne demandent une confirmation que pour l'annulation, la suppression, l'anonymisation, la proclamation et le mot de passe provisoire. Toutes ces actions se défont, mais une désactivation par erreur coupe la session du joueur. Faut-il une confirmation ?
4. **Points dans le suivi de l'admin** : après le résultat, le tableau « Suivi » de la page admin d'une question montre la valeur et le joker, pas les points. Les points sont sur la page publique de la question. Ça te convient ?

## 5. Non testé

- **Phase H (aperçu Vercel)** : facultative, à faire seulement si tu le demandes.
- **Captures à 390 px** : Chrome n'a pas voulu redimensionner la fenêtre principale. J'ai fait les mesures dans une petite fenêtre de 390 px, que mon outil ne peut pas capturer. Les chiffres sont dans R-01.
- **Le mot « CLÔTURÉ »** du compte à rebours (B4) : la page s'est rafraîchie aussitôt la clôture passée, je ne l'ai pas vu s'afficher. Le rafraîchissement sans rechargement, lui, est vérifié.
- **Blocs gris de chargement** (G5) : invisibles en local, le serveur répond trop vite.
- **Oui/non** (C5) : affichage vérifié, aucun prono enregistré sur ce type.
- **Report de la clôture dans une autre saison** (E4) : pas testé.
- **Bouton « Copier »** du mot de passe provisoire (E11) : pas cliqué, pour ne pas écrire dans ton presse-papiers.
- **Lots attribués au palmarès** (A13) : les saisons passées du seed n'ont pas de lots.
- **Tuile Position « — » avec « Après le premier résultat »** (A2) : sans objet avec les données de test, qui ont déjà des résultats.

## 6. État laissé

- Serveur de test arrêté (seul le processus du port 3200), dossier `.pglite-recette/` supprimé : les modifications faites pendant la recette ont disparu avec lui.
- Aucun fichier du dépôt modifié en dehors de ce rapport et de `docs/recette/captures/`. Rien n'a été commité.
- Le dossier `.next` a été reconstruit par `next build`, comme le prévoit le prompt. Si ton `next dev` tournait, relance-le au besoin.
