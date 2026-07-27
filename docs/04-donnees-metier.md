# 04 — Dictionnaire des données métier

Ce document décrit **les objets métier et leurs attributs fonctionnels**. Ce n'est pas un schéma de base de données. Le modèle physique, les relations, les index, les types exacts et les stratégies de normalisation sont ta responsabilité.

Ce que ce document impose : ces informations doivent exister, et ces contraintes doivent être respectées.

---

## Foyer

| Attribut | Description |
|---|---|
| Nom | Libre |
| Objectif | léger / équilibré / gourmand |
| Budget de points | Calculé (RG-08, RG-09), surchargeable manuellement |
| Fuseau horaire | Asia/Tokyo par défaut |
| Configuration IA | Fournisseur, clé API, modèle |
| Matériel de cuisine | Liste de références (voir plus bas) |

**Contrainte** : toutes les données de l'application sont rattachées à un foyer. L'isolation entre foyers est vérifiée au niveau de la couche de données (RG-63).

---

## Membre

| Attribut | Description |
|---|---|
| Nom | Prénom ou surnom |
| Type | adulte / enfant |
| Langue | fr / ja |
| Allergies | Références vers des ingrédients ou familles d'allergènes |
| Dégoûts | Références vers des ingrédients |
| Compte lié | Optionnel |

**Contrainte** : un enfant compte pour 0,6 portion dans tous les calculs (RG-09, RG-18).

---

## Matériel de cuisine

Liste fermée, extensible par le foyer. Référentiel de départ, avec traduction FR/JA :

| Clé | Français | 日本語 |
|---|---|---|
| `stove` | Plaque de cuisson | コンロ |
| `pan` | Poêle | フライパン |
| `pot` | Casserole | 鍋 |
| `donabe` | Marmite en terre | 土鍋 |
| `oven` | Four | オーブン |
| `microwave` | Four à micro-ondes | 電子レンジ |
| `fish_grill` | Gril à poisson | 魚焼きグリル |
| `rice_cooker` | Cuiseur à riz | 炊飯器 |
| `pressure_cooker` | Autocuiseur | 圧力鍋 |
| `air_fryer` | Friteuse à air | ノンフライヤー |
| `blender` | Blender | ミキサー |
| `hand_blender` | Mixeur plongeant | ハンドブレンダー |
| `food_processor` | Robot ménager | フードプロセッサー |
| `steamer` | Cuit-vapeur | 蒸し器 |
| `takoyaki_plate` | Plaque à takoyaki | たこ焼き器 |
| `hotplate` | Plaque chauffante de table | ホットプレート |
| `mortar` | Mortier | すり鉢 |
| `mandoline` | Mandoline | スライサー |
| `scale` | Balance de cuisine | キッチンスケール |
| `thermometer` | Thermomètre de cuisson | 調理用温度計 |
| `bento_box` | Boîte à bento | 弁当箱 |
| `freezer` | Congélateur | 冷凍庫 |

**Contrainte RG-07** : une carte ne peut jamais exiger un matériel absent du foyer. Cette contrainte est passée à l'IA en entrée et vérifiée à la validation de la sortie.

---

## Ingrédient (référentiel)

C'est **l'entité la plus critique du projet**. Voir `08-referentiel-ingredients.md` et `data/ingredients-seed.csv`.

| Attribut | Description |
|---|---|
| Clé | Identifiant stable, en anglais, en minuscules avec tirets bas |
| Nom FR | Nom français |
| Nom JA | Nom japonais, écriture usuelle en magasin |
| Nom EN | Pour la génération et les correspondances |
| Catégorie | Voir liste des rayons (RG-48) |
| Unité par défaut | g / ml / pièce / botte / paquet |
| Périssable | oui / non |
| Staple | oui / non — un staple n'est jamais inventorié (RG-30) |
| Famille d'allergènes | œuf, lait, blé, sarrasin, arachide, crevette, crabe, soja, sésame, fruits à coque, poisson, aucune |
| Conditionnement usuel | Quantité type d'un achat au Japon, sert à arrondir les courses |
| Fréquence d'usage | Compteur interne, sert au tri de l'inventaire (RG-33) |

**Contraintes fortes** :
- Le référentiel est **fermé du point de vue de l'IA**. Elle choisit une clé existante, elle n'en invente jamais (P2, RG-60).
- Un ingrédient ne présent nulle part au Japon n'a pas sa place dans le référentiel.
- L'utilisateur peut ajouter un ingrédient personnalisé depuis les paramètres. Il devient alors disponible pour l'IA.

---

## Inventaire

| Attribut | Description |
|---|---|
| Plan de semaine associé | L'inventaire est rattaché à une génération, pas permanent (RG-29) |
| Date de saisie | |
| Lignes | Ingrédient périssable + niveau 0 à 3 |

---

## Disponibilité

| Attribut | Description |
|---|---|
| Membre | |
| Date | |
| Créneau | midi / soir |
| Statut | maison / bento / exterieur / libre |

---

## Plan de semaine

| Attribut | Description |
|---|---|
| Semaine | Date du lundi, fuseau Asia/Tokyo |
| Budget de points | Copié du foyer au moment de la création, modifiable |
| Statut | brouillon / validé / clos |
| Total de points consommé | Calculé |

---

## Créneau planifié

| Attribut | Description |
|---|---|
| Plan | |
| Date, créneau | |
| Contenu | Une carte, un verso de carte, ou une carte neutre |
| Portions | Calculé (RG-18), surchargeable |
| Points comptés | Calculé (RG-22, RG-23) |
| Statut | prévu / cuisiné / abandonné |

---

## Carte

| Attribut | Description |
|---|---|
| Code | Identifiant lisible, généré |
| Type | standard / lunch_solo / waouh |
| Cuisine | Liste fermée (RG-25) |
| Points | 1 à 5 |
| Étoiles | 1 à 3 |
| Temps de préparation | En minutes |
| Portions de référence | Nombre pour lequel les quantités sont exprimées |
| Titre FR / JA | |
| Description courte FR / JA | Une phrase |
| Étapes FR / JA | Liste ordonnée |
| Ingrédients | Références vers le référentiel + quantité + unité |
| Matériel requis | Références |
| Verso | Optionnel, voir plus bas |
| Origine | générée / manuelle / rappelée |
| Statut | proposee / planifiee / cuisinee / abandonnee |
| Collection | Optionnel, pour V3 |

### Verso (partie d'une carte standard)

| Attribut | Description |
|---|---|
| Forme | restes / transforme / express (RG-21) |
| Titre FR / JA | |
| Étapes FR / JA | |
| Ingrédients supplémentaires | Peut être vide |
| Temps supplémentaire | En minutes, ≤ 10 si forme = express |
| Points | Calculé (RG-23) |

---

## Journal de cuisine

| Attribut | Description |
|---|---|
| Carte | |
| Date de préparation | |
| Note | 1 à 5, V2 |
| Commentaire | Libre, optionnel |
| Éligible au rappel | Calculé (RG-57) |

---

## Liste de courses

| Attribut | Description |
|---|---|
| Plan de semaine | |
| Lignes | Ingrédient + quantité + unité + rayon + état coché |
| Lignes libres | Texte libre saisi manuellement |
| Rubrique placard | Staples à vérifier, sans quantité |

**Contrainte** : l'état coché doit se synchroniser entre les membres du foyer.

---

## Ce que tu peux ajouter librement

Tout ce qui sert l'implémentation : tables de jointure, audit, cache, versions, journaux techniques, files d'attente de génération, etc. Ce document ne contraint que le métier.
