# CLAUDE.md — Directives globales du projet MealQuest

## 0. Ce que ce fichier est

Ce fichier est le contrat de collaboration entre la maîtrise d'ouvrage (le propriétaire du projet) et toi, Claude Code, qui assures la maîtrise d'œuvre.

- La MOA définit **le besoin, les règles métier, les contraintes et les critères d'acceptation**.
- Tu définis **l'architecture, la stack, le schéma de données, les librairies, les patterns**.

Aucune techno n'est imposée dans ce pack. Si un document mentionne une techno, c'est un exemple, pas une consigne. Tu choisis. Tu documentes ton choix. Tu t'y tiens.

## 1. Contexte projet en une phrase

Application privée pour un foyer de 2 personnes (un francophone, une japonaise) vivant au Japon, qui planifie ses repas de la semaine sous forme de cartes-recettes générées par IA à partir des disponibilités de chacun et du contenu réel du frigo, avec liste de courses automatique et collection de cartes cuisinées.

Lis `docs/01-brief-moa.md` avant toute chose.

## 2. Ordre de lecture obligatoire

1. `CLAUDE.md` (ce fichier)
2. `docs/01-brief-moa.md` — vision, utilisateurs, périmètre
3. `docs/02-regles-metier.md` — **le document le plus important, c'est le canon**
4. `docs/03-parcours-utilisateur.md` — les écrans et le flux
5. `docs/04-donnees-metier.md` — dictionnaire des entités (métier, pas SQL)
6. `docs/05-moteur-ia.md` — attentes fonctionnelles de la génération
7. `docs/06-criteres-acceptation.md` — la recette de validation
8. `docs/07-backlog-batchs.md` — l'ordre dans lequel tu construis
9. `docs/08-referentiel-ingredients.md` + `data/ingredients-seed.csv`
10. `docs/09-referentiel-twists.md` + `data/twists-seed.csv` (lot 6 uniquement)

## 3. Contraintes non négociables

Ces contraintes sont métier, pas techniques. La façon de les satisfaire t'appartient.

| # | Contrainte | Raison |
|---|---|---|
| C1 | **Bilingue FR / JA intégral**, chaque utilisateur choisit sa langue et voit toute l'interface ET tout le contenu généré dans sa langue | Les deux utilisateurs ne partagent pas de langue commune confortable |
| C2 | **Mobile-first**, installable sur l'écran d'accueil d'un iPhone sans passer par un store | Usage réel : debout dans la cuisine, ou au supermarché |
| C3 | **Le fournisseur d'IA doit être remplaçable via configuration**, sans refactor | La clé fournie sera DeepSeek, mais la qualité du japonais devra peut-être être réévaluée |
| C4 | **La clé API du modèle est saisie par l'utilisateur** dans les paramètres, jamais en dur dans le code | Coût porté par l'utilisateur, portabilité |
| C5 | **Coût d'hébergement proche de zéro** pour un usage de 2 personnes | Projet personnel |
| C6 | **Authentification email + mot de passe ET Google** | Confort d'usage |
| C7 | **Multi-foyer dès le schéma de données**, même si un seul foyer existe au départ | Ouverture éventuelle à d'autres utilisateurs plus tard |
| C8 | **Fuseau horaire Asia/Tokyo (UTC+9)** partout, y compris pour le calcul des semaines | Utilisateurs au Japon |
| C9 | **Semaine du lundi au dimanche** | Convention locale |
| C10 | **Aucune donnée de santé ni de poids collectée** | Le but est ludique, pas médical |

## 4. Règles de conduite pendant le développement

### Autonomie
Tu travailles en autonomie sur un lot complet (voir `docs/07-backlog-batchs.md`). Tu ne demandes pas validation à chaque fichier.

### Quand tu dois t'arrêter et demander
Arrête-toi et pose la question uniquement si :
- Une règle métier de `02-regles-metier.md` est contradictoire ou impossible à implémenter telle quelle.
- Un choix a un impact irréversible sur les données déjà saisies par les utilisateurs.
- Une contrainte de la section 3 ne peut pas être respectée.

Sinon : tu décides, tu notes ta décision dans `DECISIONS.md`, tu continues.

### Journal de décisions
Tu maintiens un fichier `DECISIONS.md` à la racine. Une entrée par décision structurante, format court :
```
## [Date] Titre de la décision
Contexte : 2 lignes max
Choix : ce qui a été retenu
Alternatives écartées : 1 ligne
Réversible : oui / non
```

### État d'avancement
Tu maintiens `PROGRESS.md` à la racine, mis à jour à la fin de chaque lot : lot terminé, ce qui marche, ce qui reste, ce qui a été volontairement laissé de côté.

### Fin de lot
À la fin de chaque lot, tu produis :
1. L'application dans un état **démarrable et testable** par un non-développeur.
2. Un `README.md` avec les commandes exactes pour installer, configurer et lancer.
3. La mise à jour de `PROGRESS.md`.
4. Le résultat des critères d'acceptation du lot (`docs/06-criteres-acceptation.md`), listés un par un avec OK / KO.

Ne commence jamais le lot suivant avant que le lot courant passe ses critères.

## 5. Principes de conception à respecter

**P1 — La friction tue le projet.** La saisie hebdomadaire complète (disponibilités des deux personnes + inventaire frigo) doit tenir sous **3 minutes**. Si une fonctionnalité rallonge cette saisie, elle est mauvaise, même si elle est intelligente. Optimise chaque tap.

**P2 — L'IA ne doit jamais inventer un ingrédient.** Elle choisit dans un référentiel fermé fourni en entrée. C'est la condition pour que la liste de courses soit juste. Voir `docs/05-moteur-ia.md`.

**P3 — Rien de bloquant.** Si l'appel IA échoue, si la clé est absente, si l'utilisateur n'a rien saisi : l'application reste utilisable en mode manuel. On peut toujours planifier une semaine à la main.

**P4 — Pas de culpabilisation.** Aucun message de jugement sur les choix alimentaires. Pas de calories affichées. Pas de rouge/vert moralisateur. Le score en points est un budget de jeu, pas une note.

**P5 — Le japonais doit être naturel.** Registre poli standard (ですます), pas de traduction littérale du français, pas de second degré. Les noms d'ingrédients et d'ustensiles viennent du référentiel, jamais d'une traduction à la volée.

**P6 — Sobriété visuelle.** Une carte = un template, une couleur de collection, un pictogramme, des étoiles. Pas d'images générées, pas de mascotte, pas d'illustration en V1.

**P7 — Tout est réversible côté utilisateur.** Toute proposition de l'IA peut être remplacée, déplacée, supprimée manuellement.

## 6. Ce qui est explicitement hors périmètre

Ne code pas ça, même si ça semble une bonne idée :
- Le petit-déjeuner planifié
- Le suivi nutritionnel, les calories, les macros, le poids
- Les notifications push (en V1)
- Le partage social, les commentaires, le multi-foyer collaboratif
- Les images générées par IA
- Une application native iOS ou Android
- Un mode hors-ligne complet
- L'import de recettes depuis le web
- La reconnaissance d'image du frigo

## 7. Qualité attendue

- Le code doit pouvoir être repris par quelqu'un d'autre dans six mois. Nommage explicite, structure lisible.
- Les règles métier chiffrées (budget de points, seuils, ratios) sont **centralisées dans un seul endroit configurable**, jamais dispersées dans le code. Elles vont bouger.
- Les textes d'interface sont externalisés dans des fichiers de traduction, jamais en dur.
- Tests : couvre au minimum le calcul des besoins en repas, le calcul de la liste de courses et la validation des sorties de l'IA. Le reste est à ton appréciation.
- Le contenu généré par l'IA est validé contre un schéma strict avant d'être stocké. Une sortie invalide est rejetée et régénérée, jamais affichée telle quelle.

## 8. Glossaire

| Terme | Définition |
|---|---|
| **Foyer** | Le compte partagé. Contient plusieurs membres, un référentiel de matériel, un historique. |
| **Membre** | Une personne du foyer. Adulte ou enfant. A une langue, des allergies, des dégoûts. |
| **Créneau** | Une case du semainier : une date + un moment (midi ou soir). |
| **Besoin** | Un créneau pour lequel au moins un membre a besoin d'un repas préparé à la maison. |
| **Carte** | Une recette. Recto = dîner. Verso = repas suivant dérivé (le bento du lendemain midi). |
| **Verso** | La déclinaison lunch d'une carte dîner. Réutilise les restes ou la même base. |
| **Points** | Score 1 à 5 d'une carte, indicateur de gourmandise / lourdeur. Pas une calorie. |
| **Budget** | Total de points autorisé sur la semaine, dépend de l'objectif choisi par le foyer. |
| **Booster** | L'action de générer la sélection de cartes de la semaine. |
| **Main** | Les cartes proposées par le booster, parmi lesquelles on choisit. |
| **Collection** | L'archive des cartes réellement cuisinées et notées. |
| **Twist** | Un ingrédient d'accent optionnel qui signe une recette (lot 6). |
| **Staple** | Ingrédient sec ou condiment à longue conservation, non inventorié. |
