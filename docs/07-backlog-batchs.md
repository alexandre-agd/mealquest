# 07 — Backlog et découpage en lots

## Principe de découpage

Chaque lot livre quelque chose de **démarrable et testable par un non-développeur**. Aucun lot ne se termine sur un chantier ouvert.

Tu peux exécuter un lot entier en autonomie. Tu ne commences pas le lot suivant avant que le lot courant passe ses critères d'acceptation (`06-criteres-acceptation.md`).

---

## Lot 0 — Cadrage technique

**Objectif** : figer l'architecture avant d'écrire du code applicatif.

À produire :
- `DECISIONS.md` avec le choix de stack, d'hébergement, de base de données, d'authentification, d'internationalisation, et la justification de chacun au regard des contraintes C1 à C10.
- Squelette du projet qui démarre en local.
- `README.md` avec les commandes d'installation et de lancement.
- Stratégie de test et de déploiement.

**Fin de lot** : l'application affiche une page vide mais fonctionne, se déploie, et le README permet à quelqu'un d'autre de la lancer.

---

## Lot 1 — Fondations, foyer, paramètres

**Objectif** : un foyer configuré de bout en bout.

Contenu :
- Authentification email et Google
- Création et gestion du foyer, des membres, des types adulte/enfant
- Langue par membre, interface entièrement bilingue
- Allergies et dégoûts
- Objectif du foyer et calcul du budget
- Matériel de cuisine
- Configuration de la clé API et du fournisseur de modèle
- Isolation stricte des données par foyer
- Installation sur l'écran d'accueil mobile

**Critères** : A1.1 à A1.12

**Attention particulière** : l'internationalisation doit être posée correctement dès ce lot. La reprendre plus tard coûterait très cher.

---

## Lot 2 — Semainier et moteur de besoins

**Objectif** : savoir exactement combien de repas préparer, pour combien de personnes, sur quels créneaux.

Contenu :
- Grille de disponibilités 7 jours × 2 créneaux, par membre
- Les quatre statuts, avec la restriction du statut `bento` au midi
- Les raccourcis de saisie
- Le calcul des besoins dîner, lunch, et lunch orphelin
- Le calcul des portions par créneau, avec le coefficient enfant
- Le compteur permanent

**Critères** : A2.1 à A2.13

**Le point dur de ce lot** est A2.10 : l'asymétrie entre les portions du dîner et celles du bento du lendemain. C'est le cas d'usage réel le plus fréquent du foyer, et c'est celui que les applications concurrentes ratent. Traite-le comme le cas normal, pas comme un cas limite.

---

## Lot 3 — Référentiel d'ingrédients et inventaire

**Objectif** : décrire le contenu du frigo en 90 secondes.

Contenu :
- Import du référentiel depuis `data/ingredients-seed.csv`
- Écran d'inventaire, périssables uniquement, sélecteur 4 niveaux
- Tri par fréquence d'usage, recherche, pré-chargement de la semaine précédente
- Remise à zéro en un geste
- Ajout d'ingrédient personnalisé depuis les paramètres

**Critères** : A3.1 à A3.10

**Ce lot est plus important qu'il n'en a l'air.** La qualité du référentiel conditionne l'exactitude de tout le reste. Prends le temps de vérifier que l'import est propre et que les correspondances FR/JA/EN sont cohérentes.

---

## Lot 4 — Moteur de génération et planning

**Objectif** : le cœur du produit.

Contenu :
- Abstraction du fournisseur de modèle
- Construction du contexte de génération
- Validation stricte de la sortie et régénération
- Écran de booster et de sélection dans la main
- Affectation au planning, placement automatique du verso
- Cartes neutres
- Compteur de points, budget indicatif
- Création manuelle de carte, mode sans clé API
- Script de test de génération isolé

**Critères** : A4.1 à A4.22

C'est le lot le plus long et le plus incertain. Prévois plusieurs itérations sur les prompts. Livre d'abord une génération qui fonctionne, puis affine la qualité.

Si le lot devient trop gros, tu peux le scinder en 4a (génération et validation, testable en ligne de commande) et 4b (interface de booster et planning). Consigne ce choix dans `DECISIONS.md`.

---

## Lot 5 — Courses, recette, journal

**Objectif** : rendre la semaine réellement exécutable.

Contenu :
- Calcul de la liste de courses selon RG-47
- Groupement par rayon, affichage bilingue simultané
- Cases à cocher synchronisées entre membres
- Lignes libres
- Rubrique placard
- Écran recette optimisé pour la cuisine
- Bouton cuisiné et entrée en collection
- Écran d'accueil « on mange quoi »

**Critères** : A5.1 à A5.17

**Fin du lot 5 = fin de la V1.** Arrête-toi ici et attends un retour d'usage réel.

---

## Après la V1 — ne commence pas sans validation

### Lot 6 — Collection et rappel (V2)
Archive filtrable, notation des cartes cuisinées, statut rappelable, intégration des cartes rappelées dans le booster selon RG-58, statistiques simples.

### Lot 7 — Twists (V3)
Intégration du référentiel de twists (`09-referentiel-twists.md`), ligne twist sur les cartes, mise en avant saisonnière.

### Lot 8 — Confort (V3)
Collections thématiques, substitution d'ingrédient, mode improvisation à partir du frigo seul.

---

## Ordre de priorité en cas d'arbitrage

Si tu dois choisir entre deux chantiers, la priorité est, dans cet ordre :

1. **La justesse des données** — un ingrédient faux ou une portion fausse rend l'application inutilisable.
2. **La rapidité de saisie** — au-delà de 3 minutes, l'application sera abandonnée.
3. **La qualité du japonais** — en dessous du niveau natif, une des deux utilisatrices décroche.
4. **La robustesse en mode dégradé** — l'application doit survivre à une clé absente ou une IA en panne.
5. **L'esthétique** — importante, mais après les quatre points ci-dessus.

---

## Ce sur quoi tu ne dois pas passer de temps

- Optimisation de performance avant d'avoir un problème mesuré
- Système de design complet, bibliothèque de composants exhaustive
- Tests exhaustifs sur les écrans de paramètres
- Gestion de cas multi-foyer dans l'interface
- Animations, transitions, effets de carte
- Documentation technique au-delà de `README.md`, `DECISIONS.md` et `PROGRESS.md`
