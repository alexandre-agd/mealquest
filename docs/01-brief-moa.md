# 01 — Brief MOA

## 1. Le problème

Un couple franco-japonais vivant au Japon perd du temps et de l'énergie chaque semaine sur trois choses :

1. **Décider quoi manger le soir.** Décision répétée, coûteuse mentalement, souvent prise trop tard.
2. **Gérer les bentos du midi.** Les besoins sont irréguliers : certains jours l'un des deux mange dehors, l'autre a besoin d'un bento. Aujourd'hui c'est géré à l'oral, mal.
3. **Faire des courses cohérentes.** On achète sans plan, on jette du frais, on rachète ce qu'on a déjà.

Les solutions existantes échouent pour trois raisons : les applications de meal planning sont conçues pour un référentiel alimentaire occidental, elles ignorent la logique du bento, et elles supposent un inventaire de frigo exhaustif que personne ne tient.

## 2. La proposition de valeur

Une fois par semaine, en moins de trois minutes :
- chacun coche ses disponibilités,
- on coche ce qui reste de périssable dans le frigo,
- on ouvre un « booster » qui propose deux fois plus de cartes-recettes que nécessaire,
- on choisit celles qui font envie,
- la liste de courses se déduit toute seule, en français et en japonais.

Ce qu'on a cuisiné entre dans une collection qui s'enrichit avec le temps.

## 3. Les utilisateurs

### Utilisateur A — le porteur du projet
- Francophone, vit au Japon, à l'aise avec la technologie.
- Cuisine régulièrement, aime varier les cuisines du monde.
- Fait la majeure partie de la saisie et de la configuration.
- Langue d'interface : français.

### Utilisateur B — sa conjointe
- Japonaise, langue principale le japonais.
- **Ne doit jamais avoir à lire un mot de français ni d'anglais dans l'application.**
- Doit pouvoir, sans aide : consulter le menu de la semaine, cocher ses disponibilités, voir la liste de courses au supermarché, lire une recette pendant qu'elle cuisine.
- Son niveau d'exigence sur la qualité du japonais est celui d'une native. Un japonais approximatif discrédite l'application entière.
- Langue d'interface : japonais.

### Utilisateurs futurs (à ne pas développer, mais à ne pas empêcher)
- Le foyer peut évoluer : enfants, invités.
- L'application pourrait être ouverte à d'autres foyers plus tard. Le modèle de données doit le permettre. L'interface n'a pas à le gérer en V1.

## 4. Contexte d'usage réel

| Moment | Lieu | Contexte |
|---|---|---|
| Saisie hebdo | Canapé, dimanche soir | Téléphone en main, fatigue, tolérance à la friction proche de zéro |
| Consultation courses | Supermarché | Une main occupée, réseau parfois faible, lecture rapide par rayon |
| Consultation recette | Cuisine | Écran qui ne doit pas s'éteindre, texte lisible à 50 cm, mains sales |
| Consultation menu | N'importe où | « On mange quoi ce soir ? », réponse en un coup d'œil |

Ces quatre contextes dictent l'ergonomie. Ils priment sur l'esthétique.

## 5. Origine du concept

Le projet reprend une idée abandonnée de jeu de cartes-recettes physique (MealQuest). Trois mécaniques de ce concept sont conservées parce qu'elles ont une valeur fonctionnelle réelle :

1. **Le recto/verso** — une recette de dîner génère systématiquement sa déclinaison bento du lendemain. C'est la mécanique la plus utile du concept d'origine.
2. **Le score en points et le budget hebdomadaire** — un cadre simple pour éviter que la semaine ne soit composée que de plats lourds, sans discours diététique.
3. **La collection** — les recettes réussies s'accumulent et deviennent un patrimoine du foyer.

Tout le reste du concept d'origine (mascotte, univers narratif, cartes de jeu coopératives, défis, saisons commerciales) est **écarté**. Ce sont des mécaniques de vente d'un produit physique, sans utilité pour deux utilisateurs.

## 6. Périmètre

### V1 — l'application doit être utilisable une vraie semaine
- Authentification, création de foyer, membres
- Paramètres : objectif du foyer, matériel de cuisine, allergies, dégoûts, langue, clé API
- Semainier de disponibilités par membre et par créneau
- Inventaire frigo rapide au moment de la génération
- Génération de la main de cartes par l'IA
- Sélection des cartes et affectation aux créneaux
- Consultation d'une carte (recette complète, bilingue)
- Liste de courses déduite, groupée par rayon, cochable
- Marquer une carte comme cuisinée

### V2 — la boucle de fidélisation
- Collection : archive des cartes cuisinées, filtres par cuisine, par étoiles, par collection
- Notation d'une carte après l'avoir cuisinée
- Rappel de cartes anciennes bien notées dans les mains suivantes
- Statistiques simples du foyer

### V3 — le confort
- Twists aromatiques (voir `09-referentiel-twists.md`)
- Collections thématiques (Italie, Izakaya, Street food asiatique…)
- Substitution d'un ingrédient sur une carte
- Mode « on improvise » : proposition d'un plat unique à partir du frigo, hors planning

Ne développe rien de V2 tant que V1 n'est pas validée par un usage réel. Ne développe rien de V3 tant que V2 n'est pas validée.

## 7. Définition du succès

Le projet est un succès si, au bout de six semaines d'usage :
- la planification hebdomadaire a été faite au moins 4 semaines sur 6,
- la saisie du dimanche prend moins de 3 minutes à deux,
- au moins 60 % des cartes planifiées ont réellement été cuisinées,
- l'utilisatrice B utilise l'application seule, sans demander d'aide.

Le dernier point est le plus important. S'il n'est pas atteint, l'application a échoué quelle que soit la qualité du reste.

## 8. Risques identifiés

| Risque | Impact | Parade attendue |
|---|---|---|
| L'inventaire frigo est trop long à saisir | Abandon en 3 semaines | Liste courte, 4 niveaux, tri par fréquence d'usage, mémorisation de la saisie précédente |
| Le japonais généré sonne artificiel | Rejet par l'utilisatrice B | Noms d'ingrédients et d'ustensiles issus du référentiel, jamais traduits à la volée ; fournisseur d'IA remplaçable |
| L'IA propose des ingrédients introuvables au Japon | Liste de courses inutilisable | Référentiel fermé d'ingrédients, tous vérifiés disponibles au Japon |
| Les recettes se répètent | Lassitude | Historique des N dernières cartes fourni à l'IA comme exclusion |
| Trop de fonctionnalités avant la première utilisation réelle | Projet jamais fini | Découpage en lots, chaque lot livre quelque chose d'utilisable |
| L'IA génère une recette dangereuse ou aberrante | Perte de confiance | Validation stricte de la sortie, garde-fous documentés dans `05-moteur-ia.md` |
