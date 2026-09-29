# Maquette de référence — style B5 « Jour de match »

Maquette validée par l'utilisateur le 29/09/2026. Elle fixe l'apparence de l'application : couleurs, typographie, tailles, composants. Les spécifications détaillées sont dans [l'architecture, section 8](../../architecture/architecture.md#8-interface).

## Fichiers

| Fichier | Contenu |
|---|---|
| `Stade.dc.html` | La mise en page complète de l'écran d'accueil (en-tête, annonce, bienvenue, tuiles, questions avec compte à rebours, classement, saisie d'un prono, bloc d'aide, résultat avec graphique). |
| `StadeJour.dc.html` | La palette B5 appliquée à cette mise en page. |

## Comment la lire

- Ce sont des fichiers au format du canevas de design de claude.ai. **Ils ne s'exécutent pas tels quels** et ne doivent pas être copiés dans l'application.
- Les styles sont écrits en ligne (`style="…"`) : c'est la référence des tailles, espacements, graisses et rayons.
- Les couleurs apparaissent sous forme de trous `{{bg}}`, `{{accent}}`, etc. Leur valeur B5 est dans `StadeJour.dc.html` et reprise en jetons dans l'architecture (§8.1).
- Les textes et chiffres sont fictifs.

## Version en ligne

Canevas privé de l'utilisateur, planche « B5 · Jour de match » : https://claude.ai/artifact/TzTANTqDz81ZRrYNgesE3u
