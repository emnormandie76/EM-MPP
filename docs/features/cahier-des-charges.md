# Cahier des charges — Les petits pronos de la promo

> **Version 1.2 du 02/10/2026.** Toutes les décisions sont prises. La section 8 liste les précisions ajoutées en rédigeant ; elles restent contestables.
>
> **Changements de la v1.2** (demandés par l'utilisateur le 02/10/2026) :
> - le barème devient un **malus** égal à l'écart brut entre le prono et la valeur réelle, sans plafond : le premier est celui qui a le moins de malus ;
> - la variante Juste Prix et le bonus podium disparaissent ;
> - sur une question à choix, l'admin fixe le malus d'une mauvaise réponse ;
> - un joueur sans prono prend le malus du pire prono ;
> - les jokers sont autorisés ou non pour chaque saison, et divisent le malus par deux ;
> - l'admin peut prolonger une question pour un joueur absent ;
> - un chat général, avec des emojis ;
> - la couleur principale devient #0036B3.
>
> Sections concernées : 2 à 10.
>
> **Changement de la v1.1** (30/09/2026) : les saisons sont créées par l'admin, avec leur nom et leur date de début, au lieu de basculer à date fixe le 30 septembre, parce que les rentrées ne tombent pas toujours le même jour (sections 3, 4.8, 4.9 et 6).

---

## 1. Contexte et objectifs

**Contexte.** « Les petits pronos de la promo » (nommé « Le Bon Chiffre » jusqu'au 02/10/2026) est un site de pronostics réservé à une équipe de chargé·e·s de l'EM Normandie (20 personnes au plus), inspiré de Mon Petit Prono. L'admin crée des questions sur les chiffres de l'école (participants à une JPO, candidatures au 31 mai, intégrés à une date donnée…), les joueurs pronostiquent, et un classement visible par tous désigne les meilleurs, ceux qui ont le moins de points de malus. Ils gagnent des lots.

**Objectif principal.** Donner envie à l'équipe de connaître les chiffres de l'école. Pour bien pronostiquer, il faut aller dans les tableaux de bord BI, comparer avec l'an dernier, calculer des taux de transformation. Le jeu est le prétexte, la culture du chiffre est le but.

**Objectif secondaire.** Émulation et cohésion d'équipe.

**Lancement : 14 octobre 2026**, avec la campagne principale : la majorité des questions de la saison ouvre ce jour-là, pour une semaine. Tout le périmètre décrit ici est livré pour cette date. Quelques questions pourront s'ajouter en cours d'année, à la marge. Premier résultat attendu en novembre.

**Comment saura-t-on que ça marche ?**
- Au moins 80 % des joueurs valident tous leurs pronos de la campagne d'octobre.
- Les chiffres reviennent dans les conversations d'équipe à chaque résultat publié.

## 2. Utilisateurs et rôles

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| Joueur | uniquement les membres de l'équipe (20 au plus) | pronostique, consulte les résultats, le classement et le palmarès, discute dans le chat |
| Admin | toi (et éventuellement une deuxième personne) ; l'admin joue aussi | gère saisons, catégories, questions, résultats, prolongations, joueurs, lots et annonces ; modère le chat |

Usage : une semaine intense à la mi-octobre, puis des visites ponctuelles pour suivre les résultats et le classement.

## 3. Concepts

- **Saison** : une période créée par l'admin, avec un nom (par exemple « 2026-2027 ») et une date de début, choisie selon la rentrée. Une saison se termine quand la suivante commence : la bascule est automatique à la date de début de la nouvelle saison, que l'admin crée à l'avance. Tant que la saison suivante n'est pas créée, la saison en cours continue. La première saison est 2026-2027, créée avant le lancement du 14 octobre 2026. Chaque saison a son classement et ses lots. L'admin choisit aussi si les jokers sont autorisés pendant la saison (v1.2).
- **Catégorie** : un thème créé par l'admin (JPO, Candidatures, Intégration…) pour ranger les questions. Il n'y a pas de classement par catégorie.
- **Question** : ce qu'il faut pronostiquer. Deux types :
  - **Nombre** : le joueur saisit une valeur (« combien de participants à la JPO du 15 novembre ? »). Son malus est l'écart avec la valeur réelle.
  - **Choix** : le joueur choisit une réponse parmi celles définies par l'admin (« quel programme aura le plus de candidatures ? »). Le oui/non est un choix à deux réponses. L'admin fixe le malus d'une mauvaise réponse.

  Une question contient : type, énoncé, catégorie, unité (pour un nombre), réponses possibles et malus d'une mauvaise réponse (pour un choix), source de la valeur réelle, date d'ouverture, date de clôture, date de résultat prévue, coefficient, bloc d'aide, puis la valeur réelle ou la bonne réponse.
- **Bloc « Pour t'aider »** : champs facultatifs remplis par l'admin sur chaque question : lien vers le tableau BI utile, valeur de l'an dernier, indice.
- **Prono** : la réponse d'un joueur à une question. Il a deux états :
  - **enregistré** : modifiable à volonté ;
  - **validé** : définitif. Un prono enregistré est validé automatiquement à la clôture.
- **Malus** (v1.2) : les points du jeu. Chaque question résolue donne un malus à chaque joueur ; le classement les additionne, et **le premier est celui qui en a le moins**.
- **Joker** : si la saison les autorise, chaque joueur dispose de 2 jokers par saison. Un joker divise par deux le malus d'une question. C'est une assurance, à poser là où l'on est le moins sûr.
- **Prolongation** (v1.2) : l'admin rouvre une question pour un joueur absent, jusqu'à une date limite qui n'appartient qu'à lui, tant que le résultat n'est pas saisi.
- **Chat** (v1.2) : un fil de discussion unique pour toute l'équipe.

Cycle de vie d'une question :

```
Brouillon ──> Ouverte ──> Clôturée ──────────> Résolue
 (admin)     (pronos)    (attente résultat)   (valeur réelle saisie, malus calculés)
                 │            │
                 └────────────┴──> Annulée (aucun malus)
```

Une prolongation rouvre une question pour un seul joueur, qu'elle soit encore ouverte ou déjà clôturée. Tant qu'elle court, le résultat ne peut pas être saisi.

## 4. Fonctionnalités

### 4.1 Comptes et connexion
- **Le site n'envoie aucun email.** On se connecte avec son adresse email et un mot de passe.
- L'admin tient une liste blanche d'adresses. Le joueur crée lui-même son compte (adresse, mot de passe, nom affiché), à condition que son adresse figure dans la liste blanche. L'adresse n'est pas vérifiée.
- Session sans expiration : on reste connecté tant qu'on ne se déconnecte pas.
- Mot de passe oublié : l'admin attribue un mot de passe provisoire depuis le back-office et le transmet au joueur, qui le change ensuite dans son profil.

### 4.2 Accueil
- En tête : les questions ouvertes pour moi, triées par clôture la plus proche. Elles comprennent celles que l'admin m'a prolongées. Chacune a un compte à rebours qui défile en direct, pour que personne ne rate une clôture.
- Pour chaque question, mon état (à faire, enregistré, validé) et une pastille « Nouveau » si elle a été publiée depuis ma dernière visite (« Prolongée pour toi » si l'admin me l'a prolongée).
- Ma progression sur les questions ouvertes (par exemple « 12 / 20 validés »).
- Ma position au classement et mon malus.
- Les annonces de l'admin, la plus récente en premier.

### 4.3 Pronostiquer
- Une page liste toutes les questions ouvertes, chacune avec son champ de saisie (nombre ou choix), pour remplir la campagne d'octobre d'une traite. Chaque question a aussi sa page détaillée : énoncé complet, unité, dates, coefficient, malus d'une mauvaise réponse (choix), bloc « Pour t'aider ».
- **Enregistrer** garde le prono modifiable. **Valider** le rend définitif. La validation se fait question par question.
- Avant la validation, un écran de confirmation affiche la valeur formatée (« 2 500 candidatures ») : une faute de frappe (25 000 au lieu de 2 500) serait sinon irréparable, et coûterait cher en malus.
- À la clôture, tout prono enregistré est validé automatiquement et compte.
- Après validation, seul l'admin peut déverrouiller un prono, à la demande du joueur et avant la clôture. Chaque déverrouillage est tracé.
- Si la saison autorise les jokers, le joueur pose un joker sur un prono avant de le valider. Le compteur de jokers restants est affiché.
- Avant la clôture, personne ne voit les pronos des autres, pas même l'admin, puisqu'il joue : le back-office n'affiche que les états (à faire, enregistré, validé).

### 4.4 Après la clôture et au résultat
- **À la clôture** : chaque joueur qui a pronostiqué la question voit les pronos de tous et la « sagesse de la foule » :
  - question à nombre : moyenne et médiane de l'équipe, et un graphique qui place tous les pronos sur un axe ;
  - question à choix : la répartition des réponses (en % de l'équipe).
- **Un joueur qui n'a pas pronostiqué** ne voit ni les pronos des autres ni la moyenne avant le résultat : « Les pronos s'afficheront au résultat ». Sans cela, une prolongation (4.10) lui donnerait les réponses (décision du 02/10/2026).
- Le prono d'un joueur en prolongation reste caché des autres jusqu'à sa date limite. La page de la question signale qu'une prolongation est en cours.
- **Au résultat** : l'admin saisit la valeur réelle ou la bonne réponse, les malus sont calculés automatiquement (section 5) et la question passe en « Résolue ». La page ajoute la valeur réelle sur le graphique, ainsi que l'écart et le malus de chacun, absents compris, et compare la sagesse de la foule à la réalité.

### 4.5 Classement
- Classement général de la saison, visible par tous : rang, avatar, nom, malus, nombre de questions jouées. **Le premier est celui qui a le moins de malus.** Personne n'est masqué.
- Des flèches ↑↓ indiquent l'évolution de chaque joueur depuis le résultat précédent.
- Mis à jour automatiquement à chaque résultat.

### 4.6 Profil joueur
- Page publique de chaque joueur : avatar, nom, rang, malus, écart moyen, nombre de « Dans le mille », nombre de pronos joués, badges, historique des questions résolues (y compris celles qu'il n'a pas pronostiquées, avec le malus pris).
- Mon profil : changer mon nom affiché, mon avatar et mon mot de passe.
- **Avatar** : choisi dans une galerie d'illustrations prédéfinies (pas d'envoi de photo).
- **Badges**, attribués automatiquement :

| Badge | Condition |
|---|---|
| 🎯 Premier « Dans le mille » | premier prono à 1 % ou moins de la valeur réelle |
| 🔮 Nostradamus | 3 « Dans le mille » dans la même saison |
| 🥇 Tireur d'élite | prono le plus proche sur une question à nombre |
| 🃏 Joker gagnant | joker posé sur une question où l'on finit parmi les trois pronos les plus proches, ou sur une bonne réponse |
| ✅ Assidu | un prono sur toutes les questions de la saison |
| 🏆 Champion | 1er du classement final d'une saison |

### 4.7 Lots et règlement
- Une page liste les lots de la saison et leur règle d'attribution (par exemple 1er, 2e et 3e du classement final).
- Une page règlement expose le calcul du malus, les jokers, les dates, les prolongations, les règles de validation et de départage. Dès qu'il y a des lots, elle évite les contestations.

### 4.8 Saisons et palmarès
- Bascule automatique à la date de début de la saison suivante, fixée par l'admin : une nouvelle saison commence et le classement repart de zéro.
- L'admin crée, renomme et supprime les saisons, et peut changer leur date de début. Il ne peut pas supprimer une saison qui contient déjà des questions, ni déplacer une date de début si cela ferait changer de saison une question qui a déjà des pronos (les jokers se comptent par saison).
- **Jokers** (v1.2) : à la création et à la modification d'une saison, l'admin choisit si les jokers sont autorisés. Il peut les autoriser à tout moment, mais plus les retirer dès qu'un joueur en a posé un dans la saison.
- Une question appartient à la saison de sa **date de clôture**. Le classement final d'une saison est proclamé par l'admin quand toutes ses questions sont résolues, même si certains résultats tombent après la bascule.
- **Palmarès** : une page, visible par tous, affiche le classement final de chaque saison passée.
- Les données des saisons passées sont conservées. La liste blanche, les comptes et les catégories passent d'une saison à l'autre.

### 4.9 Back-office admin
- **Questions** : créer (nombre, choix, oui/non ; pour un choix, avec le malus d'une mauvaise réponse), publier, modifier, annuler ; créer en série pour la campagne d'octobre (mêmes dates pour un lot de questions) ; dupliquer une question d'une saison passée ; saisir puis corriger la valeur réelle, avec recalcul automatique.
- **Suivi** : pour chaque question ouverte, l'état de chaque joueur (à faire, enregistré, validé), sans les valeurs. L'admin relance les retardataires par ses propres moyens (Teams, à l'oral). Depuis ce suivi, il prolonge une question pour un joueur absent (4.10).
- **Pronos** : déverrouiller un prono validé avant la clôture.
- **Joueurs** : gérer la liste blanche, désactiver un compte, attribuer un mot de passe provisoire, donner le rôle admin.
- **Catégories** : créer, renommer, archiver.
- **Saisons** : créer (nom, date de début, jokers autorisés ou non), renommer, changer la date de début, autoriser ou retirer les jokers, supprimer une saison sans question, saisir les lots, proclamer le classement final.
- **Annonces** : publier, modifier, supprimer un message affiché sur l'accueil.
- **Chat** : supprimer n'importe quel message.

### 4.10 Prolongation pour un absent (v1.2)
- Un joueur absent n'a pas pu pronostiquer : l'admin rouvre la question pour lui seul, avec une date limite personnelle (48 h plus tard par défaut).
- Possible sur une question ouverte (absence prévue) ou clôturée, **jamais une fois le résultat saisi** : la réponse serait connue.
- Seulement pour un joueur qui n'a pas de prono sur la question. Un admin ne se prolonge pas lui-même : c'est l'autre admin qui le fait.
- Le joueur retrouve la question dans ses questions ouvertes, avec son propre compte à rebours et la mention « Prolongée pour toi ». Il pronostique, valide et pose un joker comme d'habitude. Son prono est validé automatiquement à sa date limite.
- L'admin peut changer la date limite ou annuler la prolongation. Si le joueur a déjà un prono, l'annulation le valide tel quel.
- Le résultat ne peut pas être saisi tant qu'une prolongation court.
- Le site n'envoyant aucun email, l'admin prévient le joueur lui-même (Teams, à l'oral).

### 4.11 Chat général (v1.2)
- Un onglet « Chat » : un fil unique pour toute l'équipe, réservé aux comptes connectés.
- Des messages de texte avec des emojis, choisis dans une grille d'emojis ou tapés au clavier ; 500 caractères au plus.
- Les messages sont conservés : on remonte tout l'historique avec « Messages plus anciens ».
- Tant que la page du chat est ouverte, les nouveaux messages arrivent en quelques secondes (pas instantanément).
- L'auteur peut supprimer ses messages ; l'admin peut supprimer n'importe quel message. Un message ne se modifie pas.
- Une pastille sur l'onglet indique le nombre de messages non lus.
- Quand l'admin saisit un résultat, un message automatique l'annonce dans le chat : la valeur réelle ou la bonne réponse, et le ou les pronos les plus proches.
- Rien n'empêche techniquement de donner son prono dans le chat avant la clôture ; le règlement demande de ne pas le faire.

## 5. Règles du jeu

### 5.1 Le malus
Chaque question résolue donne un **malus** à chaque joueur. Le classement additionne les malus de la saison : **le premier est celui qui en a le moins.**

### 5.2 Question à nombre

> malus = |prono − valeur réelle|

Le malus est l'écart brut, dans l'unité de la question, **sans plafond**. Valeur réelle 1 000 : un prono de 500 ou de 1 500 donne 500 points de malus ; une faute de frappe (25 000) en donne 24 000. Les décimales sont conservées : un prono de 12,6 pour un taux réel de 12,5 % donne 0,1.

Ce choix est assumé (décision du 02/10/2026) : une question sur un grand nombre (des milliers de candidatures) pèse beaucoup plus qu'une question sur un petit nombre (une JPO de 200 personnes, un taux). L'admin en tient compte dans le choix des questions et des coefficients.

**« Dans le mille »** : un prono à 1 % ou moins de la valeur réelle. Il ne change pas le malus, mais compte pour les badges et le départage.

### 5.3 Question à choix
Bonne réponse : 0. Mauvaise réponse : le malus fixé par l'admin sur la question, affiché aux joueurs avec la question. L'admin le choisit en le comparant aux écarts attendus sur les questions à nombre de la saison.

### 5.4 Coefficient et joker
- **Coefficient** : l'admin applique ×1, ×2 ou ×3 à chaque question, ce qui multiplie le malus.
- **Joker** : divise le malus de la question par deux. 2 jokers par saison, si la saison les autorise.

**Malus d'une question** = malus × coefficient ÷ 2 si joker.

*Exemple : JPO, coefficient ×1, valeur réelle 250. Un prono de 240 donne 10 points de malus ; avec un joker, 5. Un prono de 300 donne 50. Avec un coefficient ×3, ce serait 150.*

### 5.5 Pas de prono
Un joueur qui n'a pas de prono sur une question résolue prend le malus du **pire prono** de la question :
- question à nombre : l'écart le plus grand parmi les pronos de l'équipe, multiplié par le coefficient ;
- question à choix : le malus d'une mauvaise réponse, multiplié par le coefficient ;
- si personne n'a pronostiqué la question, 0 pour tout le monde.

Sans cette règle, ne pas répondre serait la meilleure stratégie. La prolongation (4.10) permet à un absent de jouer quand même.

### 5.6 Départage au classement
1. Le moins de malus.
2. Puis le plus grand nombre de « Dans le mille ».
3. Puis l'écart relatif moyen le plus faible (|prono − réel| / réel), sur les questions à nombre que le joueur a pronostiquées.
4. Sinon, ex æquo.

### 5.7 Cas particuliers
- Prono enregistré mais pas validé à la clôture (ou à la fin de sa prolongation) : validé automatiquement, il compte.
- Aucun prono : malus du pire prono (5.5).
- Résultat corrigé après publication : recalcul automatique, et la correction est signalée sur la page de la question.
- Question annulée : aucun malus pour personne, et le joker éventuellement posé est rendu au joueur.
- Joueur arrivé en cours de saison : il joue les questions encore ouvertes. Sur les questions déjà résolues, il prend le malus d'absence, sinon il serait premier. Pour une question clôturée sans résultat, l'admin peut lui accorder une prolongation.
- Joueur parti : compte désactivé, historique conservé. S'il n'a aucun prono dans une saison, il n'apparaît pas dans son classement.
- Une fois des pronos reçus, l'admin peut modifier l'aide et repousser la clôture, mais pas changer l'énoncé, les réponses possibles ni le malus d'une mauvaise réponse, ni avancer la clôture. Pour cela, il annule la question et en crée une nouvelle.
- Toutes les dates et heures sont celles de Paris.

## 6. Décisions prises

| Sujet | Décision |
|---|---|
| Dernier à pronostiquer (C1) | Clôture nettement avant le résultat ; accueil trié par clôture, avec compte à rebours |
| Barème (C2) | **Malus égal à l'écart brut, sans plafond ; le moins de malus gagne** (v1.2, 02/10/2026). Remplace l'écart relatif par paliers et le bonus podium de la v1.0 |
| Juste Prix | Supprimé (v1.2) |
| Questions à choix | Bonne réponse 0, mauvaise réponse : malus fixé par l'admin sur chaque question (v1.2) |
| Pas de prono | Malus du pire prono de la question (v1.2) |
| Jokers | Autorisés ou non pour chaque saison ; un joker divise le malus par deux (v1.2) |
| Prolongation | Pour un joueur sans prono, tant que le résultat n'est pas saisi (v1.2) |
| Pronos des autres après la clôture | Visibles seulement par ceux qui ont pronostiqué, jusqu'au résultat (v1.2) |
| Asymétrie d'information (C3) | Acceptée : ça fait partie du jeu |
| Classement (C4) | Tout le monde est visible |
| Saisons (C5) | Créées par l'admin (nom, date de début) ; bascule automatique à la date de début de la saison suivante ; une question appartient à la saison de sa clôture (v1.1, 30/09/2026) |
| Emails (C6, C9) | Aucun email : ni notification, ni code ; connexion par mot de passe sans vérification |
| Accès (C7) | Liste blanche |
| Confidentialité (C8) | Accès réservé à la liste blanche : validé |
| Nom et vocabulaire (C10) | « Les petits pronos de la promo » (changé le 02/10/2026, étape É8b) ; on parle de pronostics, de points de malus, jamais de paris |
| Couleur principale | #0036B3 (v1.2, remplace le bleu #1F5BFF de la maquette) |
| Chat | Chat général avec emojis, messages conservés, message automatique au résultat (v1.2 ; il était hors périmètre en v1.0) |
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

**Retenues.** I02 coefficient · I03 jokers (autorisés par saison depuis la v1.2) · I05 questions à choix et oui/non · I07 bloc « Pour t'aider » · I10 sagesse de la foule · I11 graphique des pronos · I15 flèches d'évolution · I18 profil joueur · I19 badges · I20 palmarès · I22 avatar · I27 duplication de questions · I28 historique horodaté des pronos · I31 annonces · I34 liste blanche · I36 pastille « Nouveau » · I37 chat général (v1.2) · I38 message de résultat dans le chat (v1.2) · I39 prolongation pour un absent (v1.2).

**Écartées.** I01 barème par paliers et bonus podium (remplacés par le malus en v1.2) · I04 bonus lève-tôt · I06 Juste Prix (retiré en v1.2) · I08 justification · I09 débrief · I12 prix du raisonnement · I13 questions proposées par les joueurs · I14 classement par catégorie · I16 classement du mois · I17 courbe du rang · I21 réactions et commentaires · I23 récap mensuel · I24 Teams · I25 lots intermédiaires · I26 calendrier · I29 relance en un clic · I30 export CSV · I32 exclusion d'un joueur · I33 import depuis le BI · I35 connexion Microsoft.

## 8. Précisions ajoutées en rédigeant (contestables)

**v1.0**
- **Mot de passe oublié** : l'admin attribue un mot de passe provisoire. Sans cela, un joueur qui perd son mot de passe ne pourrait plus jamais jouer, puisqu'il n'y a pas d'email.
- **Avatar** : galerie d'illustrations prédéfinies plutôt qu'envoi de photo. C'est plus simple, et il n'y a aucun fichier à stocker.
- **Badges** : la liste de la section 4.6, uniquement des badges positifs. Ils ne changent pas avec la v1.2 : le « plus proche » se calcule toujours, même sans bonus podium.
- **Joker** : il se pose avant la validation et il est rendu si la question est annulée.
- **Palmarès** : le classement final est figé au moment où l'admin le proclame. Si le barème change une année, les palmarès passés ne bougent pas.

**v1.2**
- **Pas de réponse à une question à choix** : elle compte comme une mauvaise réponse, même si tous les autres ont trouvé.
- **Joueur arrivé en cours de saison** : il prend le malus d'absence sur les questions déjà résolues (5.7).
- **Malus d'une mauvaise réponse** : obligatoire pour une question à choix, sans valeur proposée par défaut, car il dépend des écarts attendus sur les questions à nombre.
- **Prolongation** : 48 h par défaut. Les autres joueurs voient qu'une prolongation est en cours, sans le nom du joueur prolongé.
- **Visibilité pour l'admin** : un admin qui n'a pas pronostiqué une question clôturée ne voit pas non plus les valeurs dans le back-office avant le résultat. Il peut ainsi recevoir une prolongation de l'autre admin.
- **Chat** :
  - 10 messages par minute au plus ;
  - un message supprimé laisse « Message supprimé. » ;
  - les adresses web ne sont pas cliquables ;
  - les messages d'un compte anonymisé sont effacés ;
  - le message automatique n'est posté qu'à la première saisie du résultat ; une correction met son texte à jour.

## 9. Contraintes non fonctionnelles

- **Coût** : 0 €.
- **Charge** : 20 utilisateurs au plus, charge négligeable.
- **Écrans** : pensé d'abord pour ordinateur, utilisable sur mobile.
- **Localisation** : français uniquement, heure de Paris, nombres au format français (1 234).
- **Sécurité** :
  - tout le site est derrière la connexion ;
  - les mots de passe ne sont jamais stockés en clair (hachés) ;
  - le nombre de tentatives de connexion est limité ;
  - le back-office est réservé aux admins et contrôlé côté serveur ;
  - les pronos des autres ne sont jamais envoyés au navigateur avant la clôture, ni avant le résultat à un joueur qui n'a pas pronostiqué ;
  - les messages du chat sont affichés comme du texte, jamais interprétés.
- **Données personnelles** : le strict minimum (email professionnel, nom affiché, messages du chat) ; hébergement en Europe si possible ; suppression sur demande.
- **Autonomie de l'admin** : tout se gère depuis le back-office, sans toucher au code ni à la base de données. C'est la condition pour que le site serve d'une année sur l'autre.
- **Aucune dépendance extérieure au code de l'application** : ni service d'email, ni service de messagerie pour le chat, ni Power Automate, ni outil à faire tourner à côté.
- **Accessibilité de base** : contrastes suffisants, navigation au clavier, libellés sur les champs de formulaire.

## 10. Hors périmètre

- Argent, mises, paris réels.
- Tout envoi d'email (notifications, codes, mot de passe oublié) et toute intégration Teams ou Power Automate.
- Connexion Microsoft (SSO) et import automatique depuis le BI.
- Classements par catégorie ou par mois, commentaires sur les questions, réactions aux messages du chat.
- Chat instantané, messages privés, plusieurs salons de discussion.
- Questions Juste Prix (retirées en v1.2).
- Envoi de photo pour l'avatar.
- Application mobile native, plusieurs équipes ou ligues.

## 11. Suite

1. **Design** : fait. Style B5 « Jour de match », maquette dans [docs/design/maquette-b5/](../design/maquette-b5/). La couleur principale a changé en v1.2 (#0036B3).
2. **Architecture et plan de construction** : [docs/architecture/architecture.md](../architecture/architecture.md), suivi dans [avancement.md](../architecture/avancement.md).
3. **Développement** en 9 étapes, plus les étapes insérées É5b (saisons), É8b (nom du site), É8c (malus, jokers par saison, prolongations, couleur) et É8d (chat), puis recette avec deux ou trois collègues avant le 14 octobre.
4. **Contenu** : l'admin rédige les questions de la campagne d'octobre (énoncés, sources, liens BI, valeurs de l'an dernier, malus des questions à choix) avec le gabarit de l'architecture (annexe B), et les saisit avant le lancement.
