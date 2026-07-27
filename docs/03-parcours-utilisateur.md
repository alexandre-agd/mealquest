# 03 — Parcours utilisateur et écrans

Ce document décrit **ce que l'utilisateur doit pouvoir faire** et **en combien de gestes**. Il ne décrit pas l'implémentation, ni la mise en page précise. Tu es libre du design tant que les contraintes de gestes et de contexte sont respectées.

Rappel du principe directeur : **la saisie hebdomadaire complète doit tenir sous 3 minutes à deux personnes.** Chaque écran ci-dessous indique son budget de gestes.

---

## Parcours A — Premier lancement (une seule fois)

**A1. Connexion**
Email + mot de passe, ou Google. Deux entrées, rien d'autre. Pas de page marketing, pas de tour guidé.

**A2. Création du foyer**
- Nom du foyer
- Nombre d'adultes, nombre d'enfants (sélecteurs numériques)
- Puis un champ prénom par membre déclaré

**A3. Profil de chaque membre**
- Langue d'affichage
- Allergies (sélection dans une liste fermée, voir `08-referentiel-ingredients.md`)
- Dégoûts (recherche libre dans le référentiel d'ingrédients)

**A4. Objectif du foyer**
Trois choix : léger / équilibré / gourmand. Une phrase de description chacun, sans jargon diététique.

**A5. Matériel de cuisine**
Grille de pictogrammes à cocher (voir liste dans `04-donnees-metier.md`). Tout est décoché par défaut sauf les éléments universels (poêle, casserole, couteau, four à micro-ondes).
Budget : 30 secondes.

**A6. Clé API du modèle**
Champ de saisie, avec un lien d'aide expliquant où obtenir une clé. Étape **passable** : on peut utiliser l'application sans, en mode manuel.

Le parcours A entier doit tenir en moins de 3 minutes. Chaque étape est passable sauf A1 et A2.

---

## Parcours B — Le rituel hebdomadaire (le cœur du produit)

C'est le parcours à optimiser au maximum. Tout le reste est secondaire.

### B1. Semainier des disponibilités
**Budget : 60 secondes pour deux personnes.**

Une grille 7 jours × 2 créneaux. Chaque membre a sa propre couche, on bascule d'un membre à l'autre en un tap.

Chaque case se cycle entre les quatre statuts (`maison`, `bento`, `exterieur`, `libre`) par taps successifs, ou via un sélecteur rapide. Pas de menu déroulant, pas de modale.

Raccourcis obligatoires :
- « Copier la semaine précédente »
- « Appliquer à toute la ligne » (tous les midis, tous les soirs)
- « Copier sur l'autre membre »

Un compteur en bas indique en permanence : *X dîners, Y bentos à prévoir*.

### B2. Inventaire du frigo
**Budget : 90 secondes.**

Une seule liste, pas d'onglets, pas de navigation. Uniquement des périssables. Pré-remplie avec la saisie de la semaine précédente.

Chaque ligne = un ingrédient + un sélecteur 4 niveaux visible directement (pas de tap pour ouvrir). Le geste est : je scanne la liste, je corrige ce qui a changé.

- Les ingrédients les plus utilisés par le foyer remontent en haut.
- Un champ de recherche permet d'ajouter un périssable absent de la liste.
- Un bouton « Frigo vide » remet tout à 0 en un geste.
- Aucun ingrédient `staple` n'apparaît ici.

### B3. Ouvrir le booster
Un bouton unique. Pendant la génération, afficher un état d'attente clair et une estimation. La génération peut prendre 20 à 60 secondes, c'est acceptable si l'utilisateur le sait.

Si la génération échoue : message clair, bouton « réessayer », bouton « créer une carte manuellement ».

### B4. Choisir dans la main
**Budget : 60 secondes.**

Les cartes proposées s'affichent une par une ou en grille, au choix du design. Pour chaque carte, on voit sans avoir à ouvrir : titre, cuisine, points, étoiles, temps, et les 3 à 4 ingrédients principaux.

Deux actions : garder / passer. On peut ouvrir une carte pour voir la recette complète avant de décider.

Un compteur permanent : cartes gardées / dîners à couvrir, et total de points / budget.

### B5. Affecter au planning
Les cartes gardées se posent sur les créneaux ayant un besoin. Deux modes possibles, tu choisis :
- automatique avec réarrangement manuel possible,
- ou manuel par glisser-déposer.

L'affectation d'une carte standard place automatiquement son verso au lendemain midi si un besoin y existe (RG-43).

Les cartes neutres (restaurant, libre, restes) sont accessibles en permanence depuis cet écran.

### B6. Valider la semaine
Un bouton. Il génère la liste de courses et fige le plan. Un plan validé reste modifiable.

Si des créneaux avec besoin sont restés vides, on l'indique sans bloquer.

---

## Parcours C — Pendant la semaine

### C1. Écran d'accueil
La question à laquelle cet écran répond en moins d'une seconde : **on mange quoi aujourd'hui ?**

Affiche : le repas du soir du jour, le lunch du lendemain s'il existe, et l'accès direct à la recette. Le reste de la semaine est en dessous, en plus petit.

Un bouton « cuisiné » directement accessible sur le repas du jour.

### C2. Liste de courses
Groupée par rayon dans l'ordre de parcours d'un supermarché. Chaque ligne cochable, en français et japonais simultanément (RG-49).

Doit rester lisible et utilisable avec une main, en marchant, avec un réseau faible.

Une rubrique séparée en bas : « à vérifier dans le placard » (les staples).
Un bouton pour ajouter une ligne libre.

### C3. Recette
Affiche tout ce que décrit RG-53. Contraintes de contexte cuisine :
- texte lisible à 50 cm,
- étapes numérotées, une par bloc, cochables au fur et à mesure,
- l'écran ne s'éteint pas,
- les quantités correspondent aux portions réelles du créneau.

Le verso est accessible depuis la carte du dîner, avec ses propres étapes.

### C4. Marquer comme cuisiné
Un geste. La carte entre dans la collection. En V2, une notation en étoiles est proposée juste après, mais reste passable.

---

## Parcours D — Paramètres

Accessible à tout moment, sans parcours guidé :
- Membres du foyer (ajouter, modifier, supprimer)
- Objectif du foyer
- Matériel de cuisine
- Clé API et fournisseur de modèle
- Langue de l'utilisateur courant
- Référentiel d'ingrédients (consultation, ajout d'un ingrédient personnalisé)
- Export des données du foyer

---

## Parcours E — Collection (V2)

Grille de cartes cuisinées. Filtres : cuisine, étoiles, points, note, période.
Une carte de la collection peut être re-planifiée directement sur un créneau, sans passer par le booster.

---

## Règles d'interface transverses

1. **Aucun texte en dur.** Tout passe par les fichiers de traduction.
2. **Aucune langue mélangée** dans l'interface, sauf la liste de courses (RG-49).
3. **Tous les nombres de portions sont réels**, jamais théoriques.
4. **Aucune modale bloquante** dans le parcours B. Les confirmations ralentissent, et ce parcours est chronométré.
5. **Tout est annulable.** Une suppression de carte, une affectation, une génération.
6. **L'application doit fonctionner à une main**, pouce droit ou gauche. Les actions principales sont en bas d'écran.
7. **Les états de chargement sont explicites** avec ce qui se passe, pas un simple indicateur tournant, en particulier pour la génération IA.
