# Cahier des charges — Le Bon Chiffre

> **Version 1.1 du 30/09/2026.** Toutes les décisions sont prises. La section 8 liste les quelques précisions que j'ai ajoutées en rédigeant cette version ; elles restent contestables.
>
> **Changement de la v1.1** (demandé et validé le 30/09/2026) : les saisons sont créées par l'admin, avec leur nom et leur date de début, au lieu de basculer à date fixe le 30 septembre, parce que les rentrées ne tombent pas toujours le même jour (sections 3, 4.8, 4.9 et 6).

---

## 1. Contexte et objectifs

**Contexte.** « Le Bon Chiffre » est un site de pronostics réservé à une équipe de chargé·e·s de l'EM Normandie (20 personnes au plus), inspiré de Mon Petit Prono. L'admin crée des questions sur les chiffres de l'école (participants à une JPO, candidatures au 31 mai, intégrés à une date donnée…), les joueurs pronostiquent, et un classement visible par tous désigne les meilleurs, qui gagnent des lots.

**Objectif principal.** Donner envie à l'équipe de connaître les chiffres de l'école. Pour bien pronostiquer, il faut aller dans les tableaux de bord BI, comparer avec l'an dernier, calculer des taux de transformation. Le jeu est le prétexte, la culture du chiffre est le but.

**Objectif secondaire.** Émulation et cohésion d'équipe.

**Lancement : 14 octobre 2026**, avec la campagne principale : la majorité des questions de la saison ouvre ce jour-là, pour une semaine. Tout le périmètre décrit ici est livré pour cette date. Quelques questions pourront s'ajouter en cours d'année, à la marge. Premier résultat attendu en novembre.

**Comment saura-t-on que ça marche ?**
- Au moins 80 % des joueurs valident tous leurs pronos de la campagne d'octobre.
- Les chiffres reviennent dans les conversations d'équipe à chaque résultat publié.

## 2. Utilisateurs et rôles

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| Joueur | uniquement les membres de l'équipe (20 au plus) | pronostique, consulte les résultats, le classement et le palmarès |
| Admin | toi (et éventuellement une deuxième personne) ; l'admin joue aussi | gère saisons, catégories, questions, résultats, joueurs, lots et annonces |

Usage : une semaine intense à la mi-octobre, puis des visites ponctuelles pour suivre les résultats et le classement.

## 3. Concepts

- **Saison** : une période créée par l'admin, avec un nom (par exemple « 2026-2027 ») et une date de début, choisie selon la rentrée. Une saison se termine quand la suivante commence : la bascule est automatique à la date de début de la nouvelle saison, que l'admin crée à l'avance. Tant que la saison suivante n'est pas créée, la saison en cours continue. La première saison est 2026-2027, créée avant le lancement du 14 octobre 2026. Chaque saison a son classement et ses lots.
- **Catégorie** : un thème créé par l'admin (JPO, Candidatures, Intégration…) pour ranger les questions. Il n'y a pas de classement par catégorie.
- **Question** : ce qu'il faut pronostiquer. Deux types :
  - **Nombre** : le joueur saisit une valeur (« combien de participants à la JPO du 15 novembre ? »). Variante **Juste Prix** : gagne le plus proche sans dépasser.
  - **Choix** : le joueur choisit une réponse parmi celles définies par l'admin (« quel programme aura le plus de candidatures ? »). Le oui/non est un choix à deux réponses.

  Une question contient : type, énoncé, catégorie, unité (pour un nombre), réponses possibles (pour un choix), source de la valeur réelle, date d'ouverture, date de clôture, date de résultat prévue, coefficient, bloc d'aide, puis la valeur réelle ou la bonne réponse.
- **Bloc « Pour t'aider »** : champs facultatifs remplis par l'admin sur chaque question : lien vers le tableau BI utile, valeur de l'an dernier, indice.
- **Prono** : la réponse d'un joueur à une question. Il a deux états :
  - **enregistré** : modifiable à volonté ;
  - **validé** : définitif. Un prono enregistré est validé automatiquement à la clôture.
- **Joker** : chaque joueur dispose de 2 jokers par saison. Un joker double les points d'une question.

Cycle de vie d'une question :

```
Brouillon ──> Ouverte ──> Clôturée ──────────> Résolue
 (admin)     (pronos)    (attente résultat)   (valeur réelle saisie, points attribués)
                 │            │
                 └────────────┴──> Annulée (aucun point)
```

## 4. Fonctionnalités

### 4.1 Comptes et connexion
- **Le site n'envoie aucun email.** On se connecte avec son adresse email et un mot de passe.
- L'admin tient une liste blanche d'adresses. Le joueur crée lui-même son compte (adresse, mot de passe, nom affiché), à condition que son adresse figure dans la liste blanche. L'adresse n'est pas vérifiée.
- Session sans expiration : on reste connecté tant qu'on ne se déconnecte pas.
- Mot de passe oublié : l'admin attribue un mot de passe provisoire depuis le back-office et le transmet au joueur, qui le change ensuite dans son profil.

### 4.2 Accueil
- En tête : les questions ouvertes, triées par clôture la plus proche, chacune avec un compte à rebours qui défile en direct pour que personne ne rate une clôture.
- Pour chaque question, mon état (à faire, enregistré, validé) et une pastille « Nouveau » si elle a été publiée depuis ma dernière visite.
- Ma progression sur les questions ouvertes (par exemple « 12 / 20 validés »).
- Ma position au classement.
- Les annonces de l'admin, la plus récente en premier.

### 4.3 Pronostiquer
- Une page liste toutes les questions ouvertes, chacune avec son champ de saisie (nombre ou choix), pour remplir la campagne d'octobre d'une traite. Chaque question a aussi sa page détaillée : énoncé complet, unité, dates, coefficient, bloc « Pour t'aider ».
- **Enregistrer** garde le prono modifiable. **Valider** le rend définitif. La validation se fait question par question.
- Avant la validation, un écran de confirmation affiche la valeur formatée (« 2 500 candidatures ») : une faute de frappe (25 000 au lieu de 2 500) serait sinon irréparable.
- À la clôture, tout prono enregistré est validé automatiquement et compte.
- Après validation, seul l'admin peut déverrouiller un prono, à la demande du joueur et avant la clôture. Chaque déverrouillage est tracé.
- Le joueur pose un joker sur un prono avant de le valider. Le compteur de jokers restants est affiché.
- Avant la clôture, personne ne voit les pronos des autres, pas même l'admin, puisqu'il joue : le back-office n'affiche que les états (à faire, enregistré, validé).

### 4.4 Après la clôture et au résultat
- **À la clôture** : chacun voit les pronos de tous et la « sagesse de la foule » :
  - question à nombre : moyenne et médiane de l'équipe, et un graphique qui place tous les pronos sur un axe ;
  - question à choix : la répartition des réponses (en % de l'équipe).
- **Au résultat** : l'admin saisit la valeur réelle ou la bonne réponse, les points sont calculés automatiquement (section 5) et la question passe en « Résolue ». La page ajoute la valeur réelle sur le graphique, l'écart et les points de chacun, et compare la sagesse de la foule à la réalité.

### 4.5 Classement
- Classement général de la saison, visible par tous : rang, avatar, nom, points, nombre de questions jouées. Personne n'est masqué.
- Des flèches ↑↓ indiquent l'évolution de chaque joueur depuis le résultat précédent.
- Mis à jour automatiquement à chaque résultat.

### 4.6 Profil joueur
- Page publique de chaque joueur : avatar, nom, rang, écart moyen, nombre de « Dans le mille », nombre de pronos joués, badges, historique des pronos résolus.
- Mon profil : changer mon nom affiché, mon avatar et mon mot de passe.
- **Avatar** : choisi dans une galerie d'illustrations prédéfinies (pas d'envoi de photo).
- **Badges**, attribués automatiquement :

| Badge | Condition |
|---|---|
| 🎯 Premier « Dans le mille » | premier prono à 1 % ou moins de la valeur réelle |
| 🔮 Nostradamus | 3 « Dans le mille » dans la même saison |
| 🥇 Tireur d'élite | prono le plus proche sur une question |
| 🃏 Joker gagnant | joker posé sur une question où l'on finit sur le podium, ou sur une bonne réponse |
| ✅ Assidu | un prono sur toutes les questions de la saison |
| 🏆 Champion | 1er du classement final d'une saison |

### 4.7 Lots et règlement
- Une page liste les lots de la saison et leur règle d'attribution (par exemple 1er, 2e et 3e du classement final).
- Une page règlement expose le barème, les jokers, les dates, les règles de validation et de départage. Dès qu'il y a des lots, elle évite les contestations.

### 4.8 Saisons et palmarès
- Bascule automatique à la date de début de la saison suivante, fixée par l'admin : une nouvelle saison commence et le classement repart de zéro.
- L'admin crée, renomme et supprime les saisons, et peut changer leur date de début. Il ne peut pas supprimer une saison qui contient déjà des questions, ni déplacer une date de début si cela ferait changer de saison une question qui a déjà des pronos (les jokers se comptent par saison).
- Une question appartient à la saison de sa **date de clôture**. Le classement final d'une saison est proclamé par l'admin quand toutes ses questions sont résolues, même si certains résultats tombent après la bascule.
- **Palmarès** : une page, visible par tous, affiche le classement final de chaque saison passée.
- Les données des saisons passées sont conservées. La liste blanche, les comptes et les catégories passent d'une saison à l'autre.

### 4.9 Back-office admin
- **Questions** : créer (nombre, nombre « Juste Prix », choix, oui/non), publier, modifier, annuler ; créer en série pour la campagne d'octobre (mêmes dates pour un lot de questions) ; dupliquer une question d'une saison passée ; saisir puis corriger la valeur réelle, avec recalcul automatique.
- **Suivi** : pour chaque question ouverte, l'état de chaque joueur (à faire, enregistré, validé), sans les valeurs. L'admin relance les retardataires par ses propres moyens (Teams, à l'oral).
- **Pronos** : déverrouiller un prono validé avant la clôture.
- **Joueurs** : gérer la liste blanche, désactiver un compte, attribuer un mot de passe provisoire, donner le rôle admin.
- **Catégories** : créer, renommer, archiver.
- **Saisons** : créer (nom et date de début), renommer, changer la date de début, supprimer une saison sans question, saisir les lots, proclamer le classement final.
- **Annonces** : publier, modifier, supprimer un message affiché sur l'accueil.

## 5. Règles du jeu

### 5.1 Question à nombre
Les questions ont des ordres de grandeur très différents : environ 200 participants pour une JPO, plusieurs milliers de candidatures. Se tromper de 50 n'a pas le même sens dans les deux cas. On note donc l'**écart relatif** :

> écart = |prono − valeur réelle| / valeur réelle

| Écart | Points | Libellé |
|---|---|---|
| 1 % ou moins | 100 | Dans le mille 🎯 |
| 3 % ou moins | 80 | |
| 5 % ou moins | 65 | |
| 10 % ou moins | 45 | |
| 20 % ou moins | 25 | |
| 35 % ou moins | 10 | |
| plus de 35 % | 0 | |

**Bonus podium.** Les trois pronos les plus proches gagnent +20, +10 et +5 points. Les ex æquo reçoivent le même bonus. Sur une question très dure où tout le monde est loin, le meilleur est quand même récompensé.

**Variante Juste Prix.** Un prono supérieur à la valeur réelle rapporte 0 point. Les autres sont notés avec le barème ci-dessus, et le bonus podium se joue entre eux.

### 5.2 Question à choix
Bonne réponse : 50 points. Mauvaise réponse : 0 point. Pas de bonus podium. Pour une question à choix plus difficile, l'admin augmente le coefficient.

### 5.3 Coefficient et joker
- **Coefficient** : l'admin applique ×1, ×2 ou ×3 à chaque question (par exemple ×3 sur le total des candidatures de la saison).
- **Joker** : double les points de la question. 2 jokers par saison.

**Total d'une question** = (points du barème + bonus podium) × coefficient × 2 si joker.

*Exemple : JPO, coefficient ×1, valeur réelle 250. Un prono de 240 donne un écart de 4 %, soit 65 points. S'il est le plus proche de tous, il gagne +20, soit 85 points ; avec un joker, 170 points. Un prono de 300 donne un écart de 20 %, soit 25 points.*

### 5.4 Départage au classement
1. Le plus grand nombre de « Dans le mille ».
2. Puis l'écart relatif moyen le plus faible sur les questions à nombre.
3. Sinon, ex æquo.

### 5.5 Cas particuliers
- Prono enregistré mais pas validé à la clôture : validé automatiquement, il compte.
- Aucun prono : 0 point, sans pénalité.
- Valeur réelle égale à 0 : l'écart relatif ne se calcule pas. On évite ce type de question ; à défaut, 100 points si le prono vaut 0, sinon 0.
- Résultat corrigé après publication : recalcul automatique, et la correction est signalée sur la page de la question.
- Question annulée : aucun point pour personne, et le joker éventuellement posé est rendu au joueur.
- Joueur arrivé en cours de saison : il joue les questions encore ouvertes.
- Joueur parti : compte désactivé, historique conservé.
- Une fois des pronos reçus, l'admin peut modifier l'aide et repousser la clôture, mais pas changer l'énoncé, les réponses possibles, ni avancer la clôture. Pour cela, il annule la question et en crée une nouvelle.
- Toutes les dates et heures sont celles de Paris.

## 6. Décisions prises

| Sujet | Décision |
|---|---|
| Dernier à pronostiquer (C1) | Clôture nettement avant le résultat ; accueil trié par clôture, avec compte à rebours |
| Barème (C2) | Écart relatif par paliers, avec bonus podium |
| Asymétrie d'information (C3) | Acceptée : ça fait partie du jeu |
| Classement (C4) | Tout le monde est visible |
| Saisons (C5) | Créées par l'admin (nom, date de début) ; bascule automatique à la date de début de la saison suivante ; une question appartient à la saison de sa clôture (v1.1, 30/09/2026) |
| Emails (C6, C9) | Aucun email : ni notification, ni code ; connexion par mot de passe sans vérification |
| Accès (C7) | Liste blanche |
| Confidentialité (C8) | Accès réservé à la liste blanche : validé |
| Nom et vocabulaire (C10) | « Le Bon Chiffre » ; on parle de pronostics et de points, jamais de paris |
| Gratuité de Vercel (C11) | Risque accepté |
| Joueurs (Q1) | Uniquement l'équipe |
| Admin (Q2) | Il joue aussi |
| Valeur réelle (Q5) | Saisie par l'admin |
| Validation (P1, P2) | Question par question ; tout prono enregistré est validé automatiquement à la clôture |
| Déverrouillage (P3) | Possible par l'admin, avant la clôture, tracé |
| Création des comptes (P4) | Par le joueur lui-même, si son adresse est dans la liste blanche |
| Saisons passées (P5) | Données conservées, palmarès des classements finaux visible par tous |
| Aide (P6) | Bloc « Pour t'aider » rempli par l'admin |
| Lancement | 14 octobre 2026, tout le périmètre livré |
| Affichage | Pensé d'abord pour ordinateur |

## 7. Idées

**Retenues.** I01 barème et bonus podium · I02 coefficient · I03 jokers · I05 questions à choix et oui/non · I06 Juste Prix · I07 bloc « Pour t'aider » · I10 sagesse de la foule · I11 graphique des pronos · I15 flèches d'évolution · I18 profil joueur · I19 badges · I20 palmarès · I22 avatar · I27 duplication de questions · I28 historique horodaté des pronos · I31 annonces · I34 liste blanche · I36 pastille « Nouveau ».

**Écartées.** I04 bonus lève-tôt · I08 justification · I09 débrief · I12 prix du raisonnement · I13 questions proposées par les joueurs · I14 classement par catégorie · I16 classement du mois · I17 courbe du rang · I21 réactions et commentaires · I23 récap mensuel · I24 Teams · I25 lots intermédiaires · I26 calendrier · I29 relance en un clic · I30 export CSV · I32 exclusion d'un joueur · I33 import depuis le BI · I35 connexion Microsoft.

## 8. Précisions ajoutées en v1.0 (contestables)

- **Mot de passe oublié** : l'admin attribue un mot de passe provisoire. Sans cela, un joueur qui perd son mot de passe ne pourrait plus jamais jouer, puisqu'il n'y a pas d'email.
- **Question à choix** : 50 points pour une bonne réponse, soit l'équivalent d'un prono à nombre juste à 10 % près. Une bonne réponse au hasard est bien plus facile à obtenir qu'un « Dans le mille ».
- **Avatar** : galerie d'illustrations prédéfinies plutôt qu'envoi de photo. C'est plus simple, et il n'y a aucun fichier à stocker.
- **Badges** : la liste de la section 4.6, uniquement des badges positifs.
- **Joker** : il se pose avant la validation et il est rendu si la question est annulée.
- **Palmarès** : le classement final est figé au moment où l'admin le proclame. Si le barème change une année, les palmarès passés ne bougent pas.

## 9. Contraintes non fonctionnelles

- **Coût** : 0 €.
- **Charge** : 20 utilisateurs au plus, charge négligeable.
- **Écrans** : pensé d'abord pour ordinateur, utilisable sur mobile.
- **Localisation** : français uniquement, heure de Paris, nombres au format français (1 234).
- **Sécurité** : tout le site derrière la connexion ; mots de passe jamais stockés en clair (hachés) ; nombre de tentatives de connexion limité ; back-office réservé aux admins et contrôlé côté serveur ; pronos des autres jamais envoyés au navigateur avant la clôture.
- **Données personnelles** : le strict minimum (email professionnel, nom affiché) ; hébergement en Europe si possible ; suppression sur demande.
- **Autonomie de l'admin** : tout se gère depuis le back-office, sans toucher au code ni à la base de données. C'est la condition pour que le site serve d'une année sur l'autre.
- **Aucune dépendance extérieure au code de l'application** : ni service d'email, ni Power Automate, ni outil à faire tourner à côté.
- **Accessibilité de base** : contrastes suffisants, navigation au clavier, libellés sur les champs de formulaire.

## 10. Hors périmètre

- Argent, mises, paris réels.
- Tout envoi d'email (notifications, codes, mot de passe oublié) et toute intégration Teams ou Power Automate.
- Connexion Microsoft (SSO) et import automatique depuis le BI.
- Classements par catégorie ou par mois, commentaires et réactions.
- Envoi de photo pour l'avatar.
- Application mobile native, chat, plusieurs équipes ou ligues.

## 11. Suite

1. **Design** : fait. Style B5 « Jour de match », maquette dans [docs/design/maquette-b5/](../design/maquette-b5/).
2. **Architecture et plan de construction** : [docs/architecture/architecture.md](../architecture/architecture.md), suivi dans [avancement.md](../architecture/avancement.md).
3. **Développement** en 9 étapes, puis recette avec deux ou trois collègues avant le 14 octobre.
4. **Contenu** : l'admin rédige les questions de la campagne d'octobre (énoncés, sources, liens BI, valeurs de l'an dernier) avec le gabarit de l'architecture (annexe B), et les saisit avant le lancement.
