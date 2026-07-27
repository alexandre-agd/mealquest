> **Ce document concerne le lot 7 (V3). Ne le lis pas avant d'avoir terminé et validé la V1.**

# 09 — Référentiel des twists aromatiques

## Le principe

Un **twist** est un ingrédient d'accent, ajouté en toute fin de préparation, qui rend une recette simple mémorable sans la compliquer.

C'est une mécanique reprise du concept d'origine et volontairement repoussée en V3, parce qu'elle n'a de valeur que lorsque le reste fonctionne. Mais c'est l'élément qui différencie les recettes générées de recettes génériques.

## Règles

**RG-T1** — Le twist est **optionnel**. Une recette est complète sans lui.

**RG-T2** — **Un seul twist par recette.** Jamais deux.

**RG-T3** — Le twist **ne modifie jamais le score en points** de la carte.

**RG-T4** — Le twist s'ajoute **en finition**, pas en cours de cuisson longue. Exception possible pour les marinades minute.

**RG-T5** — La carte indique toujours **comment** l'ajouter : où, quand, en quelle quantité. Jamais « ajouter du yuzu kosho » tout court.

**RG-T6** — Doses de référence, à respecter :

| Type | Dose maximale |
|---|---|
| Huile parfumée | 1 cuillère à café |
| Vinaigre | 1 cuillère à soupe |
| Pâte pimentée | 1 cuillère à café |
| Graines, noix concassées | 1 cuillère à soupe |
| Poudre, herbe séchée | 1 pincée à 1/2 cuillère à café |

**RG-T7** — Tous les twists correspondent à un ingrédient existant du référentiel principal, avec `staple = true`. Un twist n'ajoute donc **jamais** rien à la liste de courses hebdomadaire, il va dans « à vérifier dans le placard ».

**RG-T8** — Un twist qui contient un allergène d'un membre du foyer n'est jamais proposé sur une carte affectée à un créneau où ce membre est présent.

---

## Correspondance rapide par famille de plat

| Famille | Twists pertinents |
|---|---|
| Poisson | yuzu kosho, sansho, ponzu, aonori, sudachi |
| Volaille | paprika, shichimi, vinaigre de riz + sésame |
| Tofu et soja | rayu, ponzu, furikake, gochujang |
| Légumes | balsamique, origan, basilic, panko grillé, amandes |
| Riz et nouilles | furikake, huile de sésame, shichimi, ponzu |
| Viande rouge | balsamique, poivre, moutarde |

---

## Les quatre effets

Un twist produit un effet et un seul. C'est l'axe de sélection.

| Effet | Ce que ça fait | Twists |
|---|---|---|
| **Acidité** | Réveille, allège, coupe le gras | ponzu, vinaigre de riz, balsamique, sudachi, yuzu |
| **Piquant** | Donne du relief, réveille un plat plat | shichimi, ichimi, yuzu kosho, rayu, gochujang, sansho |
| **Umami** | Ajoute de la profondeur | miso, aonori, furikake, katsuobushi, parmesan |
| **Texture** | Crée un souvenir en bouche | panko grillé, sésame, amandes, noix |

Règle de sélection pour l'IA : identifier ce qui **manque** au plat, puis choisir un twist dans l'effet correspondant. Un plat déjà acide ne reçoit pas un twist d'acidité.

---

## Intégration sur la carte

Une ligne dédiée, distincte des étapes de recette :

- **FR** : *Twist (optionnel) : yuzu kosho, 1/2 cuillère à café dans la sauce*
- **JA** : *ひと工夫（お好みで）：柚子胡椒 小さじ1/2をたれに混ぜます*

Le fichier `data/twists-seed.csv` contient le référentiel de départ, avec la clé de l'ingrédient correspondant dans le référentiel principal.
