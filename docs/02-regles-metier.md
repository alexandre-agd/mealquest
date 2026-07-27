# 02 — Règles métier (le canon)

Ce document fait foi. En cas de contradiction avec un autre document du pack, c'est celui-ci qui gagne.

Chaque règle est identifiée (RG-xx). Les critères d'acceptation y font référence.

Toutes les valeurs chiffrées de ce document sont **paramétrables et centralisées**. Elles vont évoluer après les premières semaines d'usage.

---

## 1. Foyer et membres

**RG-01** — Un compte utilisateur appartient à exactement un foyer. Un foyer contient un ou plusieurs membres.

**RG-02** — À la création du foyer, on saisit le nombre d'adultes et le nombre d'enfants. Chaque membre est ensuite nommé individuellement (prénom ou surnom suffit).

**RG-03** — Un membre a : un nom, un type (adulte ou enfant), une langue d'affichage (français ou japonais), une liste d'allergies, une liste de dégoûts alimentaires.

**RG-04** — Un membre peut être rattaché à un compte de connexion, ou non. Un enfant n'a normalement pas de compte. Un membre sans compte est géré par les autres membres du foyer.

**RG-05** — Les allergies sont **bloquantes** : un ingrédient allergène pour un membre présent sur un créneau ne peut jamais apparaître dans une carte affectée à ce créneau. Aucune exception, aucun contournement.

**RG-06** — Les dégoûts sont **indicatifs** : l'IA les évite en priorité, mais peut passer outre si nécessaire. Dans ce cas, la carte affiche un avertissement discret.

**RG-07** — Le foyer possède un référentiel de matériel de cuisine (voir `04-donnees-metier.md`). Une carte ne peut jamais exiger un matériel absent du foyer.

**RG-08** — Le foyer a un objectif alimentaire, choisi à l'onboarding et modifiable :

| Objectif | Budget de points hebdo (base 2 adultes) |
|---|---|
| Léger | 24 |
| Équilibré (défaut) | 30 |
| Gourmand | 36 |

**RG-09** — Le budget est ajusté au nombre de membres : `budget = budget_de_base × (nb_adultes + nb_enfants × 0,6) / 2`, arrondi à l'entier supérieur.

---

## 2. Semainier et disponibilités

**RG-10** — La semaine va du **lundi au dimanche**, fuseau Asia/Tokyo.

**RG-11** — Deux créneaux planifiés par jour : **midi** et **soir**. Le petit-déjeuner n'est pas géré.

**RG-12** — Pour chaque créneau et chaque membre, un statut parmi quatre :

| Statut | Signification | Génère un besoin ? |
|---|---|---|
| `maison` | mange à la maison, repas à préparer | Oui |
| `bento` | mange dehors mais emporte un repas préparé à la maison | Oui |
| `exterieur` | mange dehors, rien à préparer | Non |
| `libre` | se débrouille seul, reste, improvisation | Non |

Le statut `bento` n'est proposé que sur le créneau **midi**. Le statut `maison` est proposé sur les deux.

**RG-13** — Le statut par défaut d'un créneau non saisi est `libre`. On ne force personne à tout remplir.

**RG-14** — La saisie doit permettre des raccourcis : appliquer un statut à toute une ligne (tous les midis de la semaine), copier la semaine précédente, appliquer le statut d'un membre à tous les membres. Ces raccourcis sont une exigence, pas un confort.

---

## 3. Calcul des besoins

**RG-15** — Un **besoin dîner** existe sur un créneau `soir` si au moins un membre a le statut `maison`.

**RG-16** — Un **besoin lunch** existe sur un créneau `midi` si au moins un membre a le statut `maison` ou `bento`.

**RG-17** — Un besoin lunch est dit **couvert par un verso** s'il existe un besoin dîner la veille au soir. Il est dit **orphelin** sinon (typiquement le lundi midi, ou après un soir au restaurant).

**RG-18** — Le nombre de portions d'un besoin est calculé ainsi : `portions = nb_adultes_concernés + nb_enfants_concernés × 0,6`, arrondi à l'entier supérieur, minimum 1.

**RG-19** — Un besoin lunch peut avoir un nombre de portions différent du besoin dîner de la veille. Exemple concret et fréquent : dîner pour deux le lundi soir, mais seule une personne a besoin d'un bento le mardi midi. Le verso est alors prévu pour une portion. **Cette asymétrie doit être gérée nativement, elle est le cas normal et pas l'exception.**

---

## 4. Cartes

**RG-20** — Une carte est une recette. Trois types :

| Type | Recto | Verso | Usage |
|---|---|---|---|
| `standard` | Recette de dîner | Déclinaison lunch du lendemain | Le cas général |
| `lunch_solo` | Recette de lunch autonome | Aucun | Couvre un besoin lunch orphelin |
| `waouh` | Plat événement, plus long ou plus festif | Aucun | Week-end, occasions |

**RG-21** — Le verso d'une carte standard réutilise la base du dîner. Trois formes possibles, l'IA choisit et l'indique :
- `restes` : on cuisine plus le soir, on emporte le surplus tel quel
- `transforme` : les restes changent de forme (curry du soir → curry pain, poulet → sandwich)
- `express` : une préparation courte le matin ou la veille, ≤ 10 minutes, à partir des mêmes ingrédients

**RG-22** — Une carte porte un score en **points de 1 à 5**. Le score qualifie la richesse et la lourdeur du plat, pas sa valeur nutritionnelle chiffrée. Repères :

| Points | Repère |
|---|---|
| 1 | Très léger : soupe, salade repas, légumes vapeur, tofu froid |
| 2 | Léger : poisson grillé, sauté de légumes, bol de riz simple |
| 3 | Standard : plat mijoté, pâtes, curry maison, poulet rôti |
| 4 | Riche : friture, gratin, plat en sauce crémeuse |
| 5 | Très riche : plat de fête, friture + féculent + sauce, pièce de viande grasse |

**RG-23** — Le score du verso est **la moitié du score du recto, arrondi à l'entier inférieur, minimum 1**. Un verso ne se compte pas comme un plat complet.

**RG-24** — Une carte porte aussi une notation en **étoiles de 1 à 3** représentant la **difficulté / l'effort**, indépendante des points :
- 1 étoile : ≤ 20 minutes, une casserole ou une poêle
- 2 étoiles : 20 à 40 minutes, plusieurs préparations
- 3 étoiles : > 40 minutes ou technique particulière

**RG-25** — Une carte appartient à une **cuisine** parmi une liste fermée : japonaise, française, italienne, chinoise, coréenne, thaïlandaise, indienne, mexicaine, américaine, méditerranéenne, autre.

**RG-26** — Chaque carte existe intégralement en français **et** en japonais : titre, description, étapes, notes. Les deux versions décrivent la même recette, ce ne sont pas deux recettes différentes.

**RG-27** — Une carte a un statut :

| Statut | Signification |
|---|---|
| `proposee` | sortie d'un booster, non retenue |
| `planifiee` | affectée à un créneau |
| `cuisinee` | réellement préparée, entre dans la collection |
| `abandonnee` | planifiée mais jamais cuisinée |

---

## 5. Cartes neutres

**RG-28** — Trois cartes neutres existent en permanence et peuvent être posées sur n'importe quel créneau sans génération IA :

| Carte neutre | Points | Usage |
|---|---|---|
| `restaurant` | 4 | Repas au restaurant |
| `libre` | 2 | Repas improvisé maison sans recette |
| `restes` | 0 | On finit ce qu'il y a |

Ces cartes ne génèrent aucun ingrédient et n'entrent pas dans la collection.

---

## 6. Inventaire du frigo

**RG-29** — L'inventaire est saisi **au moment de la génération**, pas comme un état permanent tenu à jour. Un inventaire est rattaché à un plan de semaine, il n'est pas un stock vivant.

**RG-30** — On n'inventorie **que les périssables** : produits frais et surgelés. Les ingrédients marqués `staple` (secs, condiments, épices, sauces, conserves, huiles) ne sont **jamais** demandés à la saisie. Ils sont supposés présents ou facilement achetables.

**RG-31** — Pour chaque périssable proposé, la saisie se fait en un seul tap sur un niveau :

| Niveau | Signification | Effet sur les courses |
|---|---|---|
| 0 | Je n'en ai pas | À acheter si une carte l'utilise |
| 1 | Il en reste peu | À acheter si une carte l'utilise deux fois ou plus |
| 2 | J'en ai assez | Ne pas acheter |
| 3 | J'en ai beaucoup, à consommer en priorité | Ne pas acheter, et **signaler à l'IA comme prioritaire** |

**RG-32** — Le niveau par défaut de tout périssable non touché est **0**. Ne rien saisir doit rester possible et cohérent : on considère alors que le frigo est vide.

**RG-33** — La liste des périssables présentée à la saisie est **triée par fréquence d'utilisation dans le foyer**, puis par catégorie. Les ingrédients jamais utilisés descendent en bas. Une recherche permet d'en ajouter un absent de la liste courte.

**RG-34** — La saisie de l'inventaire précédent est pré-chargée comme point de départ. On modifie, on ne recommence pas de zéro.

**RG-35** — Les ingrédients de niveau 3 sont un signal fort : l'IA doit prioritairement construire des recettes qui les consomment. C'est la fonction anti-gaspillage de l'application.

---

## 7. Le booster

**RG-36** — Le booster est déclenché manuellement par un bouton, après saisie des disponibilités et de l'inventaire.

**RG-37** — **Nombre de cartes proposées** :
```
nb_cartes_standard  = 2 × nombre de besoins dîner
nb_cartes_lunch_solo = 2 × nombre de besoins lunch orphelins
```
Le total est plafonné à 20 cartes par booster. Si le calcul dépasse, on réduit proportionnellement.

**RG-38** — Composition de la main proposée, à respecter dans la mesure du possible :
- Au moins **4 cuisines différentes** représentées si la main compte 8 cartes ou plus.
- Au maximum **2 cartes de score 5**.
- Au minimum **2 cartes de score 1 ou 2**.
- Au moins **la moitié des cartes** doit être réalisable avec un temps de préparation ≤ 30 minutes.
- Au moins **une carte** doit consommer un ingrédient de niveau 3, s'il en existe.

**RG-39** — Aucune carte proposée ne doit reprendre le plat principal d'une des **20 dernières cartes cuisinées** par le foyer.

**RG-40** — L'utilisateur choisit librement dans la main. Il n'est pas obligé de tout prendre, ni de respecter le budget de points.

**RG-41** — Le budget est **indicatif**. Un dépassement s'affiche, ne bloque rien, et ne produit aucun message de jugement. Formulation neutre du type « 34 / 30 points ».

**RG-42** — Le booster peut être relancé. Une relance ne détruit pas les cartes déjà affectées à un créneau.

---

## 8. Affectation au planning

**RG-43** — Une carte standard retenue s'affecte à un créneau `soir`. Son verso s'affecte automatiquement au créneau `midi` du lendemain, si un besoin lunch y existe.

**RG-44** — Si le lendemain midi ne présente aucun besoin, le verso n'est pas affecté. Il reste consultable sur la carte mais ne compte pas dans les points ni dans les courses.

**RG-45** — L'utilisateur peut toujours déplacer, remplacer ou supprimer une affectation manuellement.

**RG-46** — Un créneau ayant un besoin et resté vide au moment de la validation est signalé, sans blocage.

---

## 9. Liste de courses

**RG-47** — La liste de courses est calculée automatiquement :
```
Pour chaque ingrédient requis par les cartes affectées au plan :
  quantité_requise = somme des quantités, ajustées aux portions de chaque créneau
  Si ingrédient est staple :
      → rubrique « À vérifier dans le placard », sans quantité
  Sinon :
      Si niveau_stock = 0                          → à acheter, quantité totale
      Si niveau_stock = 1 et utilisé ≥ 2 fois      → à acheter, quantité totale
      Si niveau_stock = 1 et utilisé 1 fois        → rubrique « Probablement suffisant »
      Si niveau_stock ≥ 2                          → ne pas acheter
```

**RG-48** — La liste est groupée par **rayon de magasin**, pas par recette. L'ordre des rayons suit un parcours de supermarché japonais type : légumes, fruits, poisson, viande, produits laitiers et œufs, tofu et produits de soja, surgelés, épicerie sèche, condiments et sauces, boissons, autre.

**RG-49** — Chaque ligne affiche le nom de l'ingrédient **dans les deux langues simultanément** (français et japonais), quelle que soit la langue de l'utilisateur. C'est le seul écran bilingue simultané de l'application. Raison : les deux utilisateurs font les courses ensemble ou séparément, et l'affichage doit être compris par la caissière comme par le conjoint.

**RG-50** — Chaque ligne est cochable. L'état coché est partagé en temps réel entre les membres du foyer, ou à défaut synchronisé au retour du réseau.

**RG-51** — On peut ajouter manuellement une ligne libre à la liste (papier toilette, bière, ce que l'on veut). Ces lignes ne sont pas liées aux recettes.

**RG-52** — Les quantités sont exprimées dans des unités utilisables en magasin japonais : grammes, millilitres, pièces, bottes, paquets. Pas de « une pincée » ni de « au goût » dans la liste de courses.

---

## 10. Consultation d'une recette

**RG-53** — L'écran recette affiche : titre, cuisine, points, étoiles, temps, portions, matériel nécessaire, liste d'ingrédients avec quantités ajustées aux portions réelles, étapes numérotées, et le verso s'il existe.

**RG-54** — Pendant la consultation d'une recette, l'écran ne doit pas s'éteindre automatiquement.

**RG-55** — Les quantités affichées sont recalculées pour le nombre de portions réel du créneau, pas pour un nombre de portions théorique.

---

## 11. Cuisiner et collection

**RG-56** — Un bouton « cuisiné » sur une carte planifiée la fait passer au statut `cuisinee` et l'ajoute à la collection du foyer.

**RG-57** — En V2, on peut noter une carte cuisinée de 1 à 5. Une carte notée 4 ou 5 devient **rappelable**.

**RG-58** — En V2, une partie des cartes d'un booster est tirée des cartes rappelables plutôt que générée. Ratio de départ : **30 % de cartes rappelées, 70 % de cartes neuves**, arrondi à l'entier inférieur pour les rappels. Une carte rappelée ne l'est pas deux fois en moins de 6 semaines.

**RG-59** — La collection est consultable et filtrable par cuisine, par nombre d'étoiles, par points, par note, par période.

---

## 12. Règles transverses

**RG-60** — Toute donnée générée par l'IA est validée avant stockage. Une sortie non conforme est régénérée, dans la limite de 2 tentatives, puis l'échec est signalé à l'utilisateur avec une option de saisie manuelle.

**RG-61** — Si aucune clé API n'est configurée, toute l'application reste utilisable en mode manuel : on crée ses cartes à la main, on planifie, on obtient sa liste de courses.

**RG-62** — Aucun écran ne doit afficher de calorie, de macronutriment, de poids, ni de message évaluant la qualité des choix alimentaires de l'utilisateur.

**RG-63** — Les données du foyer ne sont jamais visibles par un autre foyer. Cette isolation est vérifiée au niveau de la couche de données, pas seulement de l'interface.
