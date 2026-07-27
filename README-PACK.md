# Pack de spécifications MealQuest — mode d'emploi

Ce dossier contient les spécifications MOA du projet. Il ne contient aucun code.

## Contenu

```
CLAUDE.md                        Directives globales, contraintes, glossaire
README-PACK.md                   Ce fichier
docs/
  01-brief-moa.md                Vision, utilisateurs, périmètre, risques
  02-regles-metier.md            Les 63 règles de gestion — le canon
  03-parcours-utilisateur.md     Écrans, gestes, budgets de temps
  04-donnees-metier.md           Dictionnaire des entités métier
  05-moteur-ia.md                Attentes fonctionnelles de la génération
  06-criteres-acceptation.md     Recette de validation par lot
  07-backlog-batchs.md           Découpage en 6 lots
  08-referentiel-ingredients.md  Doc du référentiel
  09-referentiel-twists.md       Doc des twists (lot 7, V3)
data/
  ingredients-seed.csv           170 ingrédients FR/JA/EN vérifiés Japon
  twists-seed.csv                26 twists aromatiques
```

## Comment lancer Claude Code dessus

1. Copie tout ce dossier à la racine de ton nouveau projet.
2. Ouvre Claude Code dans ce dossier.
3. Premier prompt :

```
Lis CLAUDE.md, puis tous les fichiers de docs/ dans l'ordre indiqué.
Ensuite exécute le Lot 0 de docs/07-backlog-batchs.md.
Ne commence pas le Lot 1 avant de m'avoir présenté DECISIONS.md.
```

4. Pour chaque lot suivant :

```
Exécute le Lot N de docs/07-backlog-batchs.md.
À la fin, liste chaque critère d'acceptation du lot avec OK ou KO,
et mets à jour PROGRESS.md.
```

## Ce que tu dois faire toi-même

**Avant le lot 3** : relis `data/ingredients-seed.csv` avec ta femme. Les 170 noms japonais sont ceux de l'étiquette en magasin, mais fais-les valider. C'est le seul livrable du pack qui ne peut pas être vérifié par une IA, et c'est celui qui conditionne l'exactitude de toute l'application.

Ajoute au passage ce qui manque à vos habitudes réelles. Le référentiel de départ est générique, le vôtre doit être personnel.

**Après le lot 4** : le critère A4.22 (qualité du japonais) se teste avec elle, pas avec un outil. Si le rendu ne va pas, c'est le moment de basculer de fournisseur d'IA. C'est prévu par la contrainte C3.

## Ce que le pack ne fixe pas volontairement

Aucune techno n'est imposée : pas de framework, pas de base de données, pas d'hébergeur. Claude Code choisit, justifie dans `DECISIONS.md`, et s'y tient.

Si tu veux forcer un choix (par exemple parce que tu as déjà un compte quelque part), ajoute-le dans la section 3 de `CLAUDE.md` avant de lancer, en le formulant comme une contrainte avec sa raison.

## Estimation de charge

| Lot | Charge indicative |
|---|---|
| Lot 0 — cadrage | 1 session |
| Lot 1 — foyer et paramètres | 1 à 2 sessions |
| Lot 2 — semainier et besoins | 1 session |
| Lot 3 — référentiel et inventaire | 1 session |
| Lot 4 — génération et planning | 3 à 5 sessions, le lot incertain |
| Lot 5 — courses et recettes | 2 sessions |

Le lot 4 concentre le risque. Prévois d'y revenir plusieurs fois pour le calibrage des prompts, indépendamment de la vitesse d'écriture du code.
