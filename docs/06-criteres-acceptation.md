# 06 — Critères d'acceptation

Chaque critère est vérifiable par un non-développeur, en manipulant l'application.

À la fin de chaque lot, tu listes chaque critère avec OK ou KO. Un lot n'est pas terminé tant qu'un critère est KO, sauf décision explicite consignée dans `DECISIONS.md`.

---

## Lot 1 — Fondations et foyer

| # | Critère | Règle |
|---|---|---|
| A1.1 | Je peux créer un compte avec email et mot de passe, puis me reconnecter | C6 |
| A1.2 | Je peux créer un compte avec Google | C6 |
| A1.3 | Je peux créer un foyer, déclarer 2 adultes et 0 enfant, et nommer chaque membre | RG-02 |
| A1.4 | Je peux définir la langue d'un membre en japonais, et toute l'interface passe en japonais pour lui | C1 |
| A1.5 | Je peux définir la langue de l'autre membre en français, et les deux coexistent | C1 |
| A1.6 | Je peux cocher mon matériel de cuisine et le retrouver après reconnexion | RG-07 |
| A1.7 | Je peux déclarer une allergie sur un membre | RG-03 |
| A1.8 | Je peux choisir un objectif, et le budget de points affiché change en conséquence | RG-08 |
| A1.9 | J'ajoute un enfant, et le budget est recalculé avec le coefficient 0,6 | RG-09 |
| A1.10 | L'application s'installe sur l'écran d'accueil d'un iPhone et s'ouvre en plein écran | C2 |
| A1.11 | Aucun texte de l'interface n'est en dur dans le code | P5 |
| A1.12 | Les données d'un foyer ne sont pas accessibles depuis un autre compte, vérifié au niveau des données et pas seulement de l'interface | RG-63 |

---

## Lot 2 — Semainier et calcul des besoins

| # | Critère | Règle |
|---|---|---|
| A2.1 | Je vois une grille lundi à dimanche, midi et soir | RG-10, RG-11 |
| A2.2 | Je peux régler chaque case sur maison / bento / exterieur / libre | RG-12 |
| A2.3 | Le statut `bento` n'est pas proposé sur le créneau du soir | RG-12 |
| A2.4 | Je bascule d'un membre à l'autre en un seul geste | B1 |
| A2.5 | Je peux appliquer un statut à toute une ligne en un geste | RG-14 |
| A2.6 | Je peux copier la semaine précédente en un geste | RG-14 |
| A2.7 | Un compteur m'indique en permanence le nombre de dîners et de bentos à prévoir | B1 |
| A2.8 | Cas de test : mardi soir, moi `maison` et ma femme `exterieur` → 1 besoin dîner, 1 portion | RG-15, RG-18 |
| A2.9 | Cas de test : mercredi midi, moi `exterieur` et ma femme `bento` → 1 besoin lunch, 1 portion | RG-16, RG-18 |
| A2.10 | Cas de test : lundi soir 2 personnes `maison`, mardi midi 1 seule `bento` → le verso est prévu pour 1 portion, pas 2 | **RG-19** |
| A2.11 | Cas de test : lundi midi avec besoin, dimanche soir sans besoin → le lundi midi est un besoin orphelin | RG-17 |
| A2.12 | Une case jamais touchée vaut `libre` et ne crée aucun besoin | RG-13 |
| A2.13 | La saisie complète du semainier pour deux personnes prend moins de 60 secondes, chronomètre en main | B1 |

---

## Lot 3 — Référentiel et inventaire

| # | Critère | Règle |
|---|---|---|
| A3.1 | Le référentiel d'ingrédients est chargé, chaque entrée a un nom FR, JA et EN | 08 |
| A3.2 | L'écran d'inventaire ne présente aucun ingrédient marqué `staple` | RG-30 |
| A3.3 | Chaque ligne a un sélecteur de niveau 0 à 3 réglable en un seul tap, sans ouvrir de menu | RG-31, B2 |
| A3.4 | Un ingrédient non touché vaut 0 | RG-32 |
| A3.5 | L'inventaire de la semaine précédente est pré-chargé | RG-34 |
| A3.6 | Les ingrédients les plus utilisés apparaissent en haut de liste | RG-33 |
| A3.7 | Je peux chercher et ajouter un périssable absent de la liste courte | RG-33 |
| A3.8 | Un bouton remet tout le frigo à 0 en un geste | B2 |
| A3.9 | La saisie de l'inventaire prend moins de 90 secondes, chronomètre en main | B2 |
| A3.10 | Je peux ajouter un ingrédient personnalisé depuis les paramètres, et il devient disponible partout | 04 |

---

## Lot 4 — Génération et planning

| # | Critère | Règle |
|---|---|---|
| A4.1 | Sans clé API, l'application reste utilisable et je peux créer une carte manuellement | RG-61, P3 |
| A4.2 | Avec une clé configurée, le bouton booster produit des cartes | B3 |
| A4.3 | Le nombre de cartes proposées vaut 2 fois le nombre de besoins dîner | RG-37 |
| A4.4 | Des cartes lunch_solo sont proposées s'il existe des besoins lunch orphelins | RG-37 |
| A4.5 | Sur une main de 8 cartes ou plus, au moins 4 cuisines différentes sont représentées | RG-38 |
| A4.6 | Au plus 2 cartes de score 5, au moins 2 cartes de score 1 ou 2 | RG-38 |
| A4.7 | Au moins la moitié des cartes ont un temps ≤ 30 minutes | RG-38 |
| A4.8 | Test allergène : je déclare une allergie à la crevette, je relance, aucune carte ne contient de crevette | RG-05, S2 |
| A4.9 | Test matériel : je décoche le four, je relance, aucune carte n'exige un four | RG-07, S3 |
| A4.10 | Test niveau 3 : je mets un ingrédient au niveau 3, au moins une carte proposée le consomme | RG-35, RG-38 |
| A4.11 | Test anti-répétition : après avoir cuisiné 3 cartes, elles ne réapparaissent pas au booster suivant | RG-39 |
| A4.12 | Chaque carte générée existe intégralement en français et en japonais | RG-26, S4 |
| A4.13 | Chaque carte standard a un verso complet, avec sa forme indiquée | RG-21, S7 |
| A4.14 | Tous les ingrédients des cartes générées existent dans le référentiel, aucun ingrédient inventé | **P2, S1** |
| A4.15 | Le score du verso est bien la moitié arrondie à l'inférieur, minimum 1 | RG-23 |
| A4.16 | J'affecte une carte à un soir, son verso se place automatiquement au lendemain midi si un besoin y existe | RG-43 |
| A4.17 | S'il n'y a pas de besoin le lendemain midi, le verso n'est pas affecté et ne compte pas de points | RG-44 |
| A4.18 | Je peux déplacer, remplacer et supprimer une affectation manuellement | RG-45, P7 |
| A4.19 | Les cartes neutres restaurant, libre et restes sont posables à tout moment | RG-28 |
| A4.20 | Dépasser le budget de points affiche un compteur neutre, sans blocage ni message de jugement | RG-41, P4 |
| A4.21 | Une sortie IA invalide est régénérée automatiquement, au plus 2 fois, puis échoue proprement | RG-60 |
| A4.22 | Le japonais généré est validé comme naturel par une locutrice native | P5, section 6 de 05 |

Le critère A4.22 est un critère d'acceptation à part entière. Il se teste avec une vraie personne, pas avec un outil.

---

## Lot 5 — Courses, recette, cuisiner

| # | Critère | Règle |
|---|---|---|
| A5.1 | La liste de courses se génère automatiquement à la validation du plan | RG-47 |
| A5.2 | Un ingrédient au niveau 2 ou 3 n'apparaît pas dans les courses | RG-47 |
| A5.3 | Un ingrédient au niveau 1 utilisé une seule fois va dans « probablement suffisant » | RG-47 |
| A5.4 | Un ingrédient au niveau 1 utilisé deux fois ou plus va dans les courses | RG-47 |
| A5.5 | Les staples apparaissent dans une rubrique « à vérifier dans le placard », sans quantité | RG-47 |
| A5.6 | La liste est groupée par rayon, dans l'ordre d'un parcours de supermarché | RG-48 |
| A5.7 | Chaque ligne affiche le nom en français et en japonais simultanément | **RG-49** |
| A5.8 | Les quantités sont chiffrées avec une unité utilisable en magasin | RG-52 |
| A5.9 | Je coche une ligne sur un téléphone, elle apparaît cochée sur l'autre | RG-50 |
| A5.10 | Je peux ajouter une ligne libre à la liste | RG-51 |
| A5.11 | L'écran recette affiche tout ce que décrit RG-53 | RG-53 |
| A5.12 | Les quantités affichées correspondent aux portions réelles du créneau, pas aux portions de référence de la carte | RG-55 |
| A5.13 | L'écran ne s'éteint pas pendant la consultation d'une recette | RG-54 |
| A5.14 | Je peux cocher les étapes une par une | C3 de 03 |
| A5.15 | Un bouton « cuisiné » fait passer la carte en collection | RG-56 |
| A5.16 | L'écran d'accueil répond à « on mange quoi ce soir » sans navigation | C1 de 03 |
| A5.17 | Aucune calorie, aucun macronutriment, aucun message de jugement nulle part dans l'application | RG-62, P4 |

---

## Lot 6 et suivants

Les critères des lots V2 et V3 seront écrits après validation de la V1 par un usage réel. Ne les anticipe pas.

---

## Recette finale de la V1

L'application est acceptée en V1 quand, en conditions réelles :

1. Une semaine complète est planifiée de bout en bout par les deux utilisateurs, ensemble, en **moins de 3 minutes** hors temps de génération IA.
2. La liste de courses obtenue est utilisée telle quelle dans un vrai supermarché, sans correction manuelle majeure.
3. Au moins **4 recettes générées sont réellement cuisinées** dans la semaine.
4. L'utilisatrice japonaise a utilisé l'application seule, sans poser de question, et juge le japonais naturel.

Le point 4 est bloquant.
