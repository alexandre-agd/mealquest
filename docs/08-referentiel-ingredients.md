# 08 — Référentiel d'ingrédients

## Pourquoi ce document est critique

Le référentiel d'ingrédients est **le socle d'exactitude de toute l'application**. Si l'IA écrit des noms d'ingrédients en texte libre, alors :
- l'inventaire du frigo ne correspond jamais aux recettes,
- la liste de courses est fausse,
- les allergies ne sont plus détectables de façon fiable,
- le japonais des ingrédients devient une traduction automatique de qualité variable.

D'où la règle P2 : **l'IA choisit une clé dans le référentiel, elle n'invente jamais un ingrédient.**

---

## Structure

Le fichier de départ est `data/ingredients-seed.csv`. Colonnes :

| Colonne | Description |
|---|---|
| `key` | Identifiant stable, minuscules, tirets bas. Ne change jamais. |
| `name_fr` | Nom français |
| `name_ja` | Nom japonais tel qu'écrit en magasin au Japon |
| `name_en` | Nom anglais, utilisé pour la génération |
| `category` | Rayon, voir liste ci-dessous |
| `default_unit` | g / ml / piece / bunch / pack |
| `perishable` | `true` = apparaît dans l'inventaire du frigo |
| `staple` | `true` = jamais inventorié, va dans « à vérifier dans le placard » |
| `allergen` | Famille d'allergène japonaise, ou vide |
| `typical_pack` | Conditionnement usuel au Japon, sert à arrondir les quantités de courses |

Un ingrédient ne peut pas être à la fois `perishable = true` et `staple = true`.

---

## Catégories (ordre du parcours en magasin, RG-48)

| Clé | Français | 日本語 |
|---|---|---|
| `vegetables` | Légumes | 野菜 |
| `fruits` | Fruits | 果物 |
| `fish` | Poisson et fruits de mer | 魚介 |
| `meat` | Viande | 肉 |
| `dairy_eggs` | Produits laitiers et œufs | 乳製品・卵 |
| `soy` | Tofu et produits de soja | 豆腐・大豆製品 |
| `frozen` | Surgelés | 冷凍食品 |
| `dry_goods` | Épicerie sèche | 乾物・穀物 |
| `condiments` | Condiments et sauces | 調味料 |
| `drinks` | Boissons | 飲料 |
| `other` | Autre | その他 |

---

## Familles d'allergènes

On utilise la classification japonaise, plus utile localement que la classification européenne :

`egg` 卵 / `milk` 乳 / `wheat` 小麦 / `buckwheat` そば / `peanut` 落花生 / `shrimp` えび / `crab` かに / `soy` 大豆 / `sesame` ごま / `nuts` ナッツ類 / `fish` 魚 / vide si aucun

---

## Règles de curation

1. **Tout ingrédient du référentiel doit être trouvable dans un supermarché japonais ordinaire.** Pas dans une épicerie fine, pas en ligne. Si un ingrédient n'est disponible qu'à Kaldi ou Seijo Ishii, il peut figurer mais doit être clairement conditionné à un usage occasionnel.
2. **Le nom japonais est celui de l'étiquette en magasin**, pas la traduction du dictionnaire. Exemple : on écrit ピーマン, pas 青唐辛子.
3. **Un ingrédient = une entrée.** Pas de « poulet » générique si les morceaux se vendent séparément et ne se substituent pas.
4. **Les staples sont généreux.** Mieux vaut un ingrédient de trop dans « à vérifier dans le placard » qu'un ingrédient de trop dans l'inventaire du frigo, qui rallonge la saisie.

---

## Extension du référentiel

Le fichier de départ contient environ 150 entrées. C'est un socle, pas un objectif.

- L'utilisateur peut ajouter un ingrédient depuis les paramètres. L'ajout demande les trois noms (FR, JA, EN), la catégorie et l'unité.
- Un ingrédient ajouté devient immédiatement disponible pour l'IA.
- **Ne laisse jamais l'IA créer une entrée du référentiel automatiquement.** L'ajout est un acte humain.

---

## Point d'attention pour le lot 3

Avant d'importer, vérifie que :
- toutes les clés sont uniques,
- aucune ligne n'a `perishable` et `staple` à `true` en même temps,
- chaque catégorie utilisée existe dans la liste ci-dessus,
- chaque valeur d'allergène appartient à la liste ci-dessus.

Signale toute anomalie dans `PROGRESS.md` plutôt que de la corriger silencieusement. Le référentiel est un livrable de la MOA, ses erreurs doivent remonter.
