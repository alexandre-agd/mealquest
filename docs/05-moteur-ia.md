# 05 — Moteur IA : attentes fonctionnelles

Ce document décrit **ce que le moteur IA doit produire et ne jamais produire**. La façon d'y parvenir (structure des prompts, découpage des appels, format d'échange, gestion des erreurs, mise en cache) est ta responsabilité.

---

## 1. Contexte technique de départ

- L'utilisateur fournit sa propre clé API. La première clé utilisée sera **DeepSeek**.
- Le fournisseur doit être remplaçable par configuration (C3). Prévois cette bascule dès le départ, elle sera probablement utilisée.
- Le coût par génération doit rester négligeable. Ne fais pas 40 appels là où 2 suffisent.
- Une génération peut prendre jusqu'à 60 secondes sans que ce soit un problème, à condition que l'utilisateur soit informé.

---

## 2. Le rôle exact de l'IA

L'IA fait **une seule chose** : produire des cartes-recettes qui respectent un ensemble de contraintes dures.

Elle ne décide pas du planning. Elle ne calcule pas la liste de courses. Elle ne compte pas les points du budget. Ces trois choses sont du code déterministe, pas de l'IA. Raison : elles doivent être exactes et reproductibles.

---

## 3. Entrées à fournir au modèle

Le contexte transmis pour une génération doit contenir :

**Contraintes du foyer**
- Nombre d'adultes et d'enfants, portions à prévoir
- Objectif (léger / équilibré / gourmand)
- Matériel de cuisine disponible, en clés
- Allergies de chaque membre, en clés — **bloquantes**
- Dégoûts, en clés — indicatifs

**Besoins de la semaine**
- Nombre de besoins dîner et leurs portions respectives
- Nombre de besoins lunch orphelins et leurs portions
- Pour chaque besoin dîner, le nombre de portions du lunch du lendemain (souvent différent, RG-19)

**État du frigo**
- Les ingrédients de niveau 2 et 3 avec leur niveau, sous forme de clés
- Les ingrédients de niveau 3 identifiés comme **prioritaires à consommer**
- Les ingrédients de niveau 0 ne sont pas transmis, la liste serait trop longue et inutile

**Référentiel**
- La liste des clés d'ingrédients autorisées, avec leur nom anglais et leur catégorie
- Si cette liste est trop volumineuse pour un seul appel, tu peux la restreindre intelligemment, mais l'IA ne doit jamais pouvoir sortir de la liste transmise

**Historique**
- Les titres et plats principaux des 20 dernières cartes cuisinées, à ne pas répéter (RG-39)

**Composition attendue**
- Nombre de cartes standard et lunch_solo à produire (RG-37)
- Les règles d'équilibre de la main (RG-38)

---

## 4. Sortie attendue

Une liste de cartes, chacune contenant tout ce que décrit la section « Carte » de `04-donnees-metier.md`, en français **et** en japonais.

### Contraintes de sortie non négociables

| # | Contrainte | Traitement si violée |
|---|---|---|
| S1 | Tout ingrédient référencé est une **clé existante du référentiel transmis** | Rejet et régénération |
| S2 | Aucun ingrédient allergène pour un membre du foyer | Rejet, sans exception |
| S3 | Aucun matériel requis absent du foyer | Rejet et régénération |
| S4 | Les deux langues sont présentes et décrivent la même recette | Rejet et régénération |
| S5 | Le score en points est entre 1 et 5, cohérent avec le contenu du plat | Correction automatique possible |
| S6 | Les étoiles sont entre 1 et 3, cohérentes avec le temps annoncé | Correction automatique possible |
| S7 | Toute carte `standard` a un verso complet | Rejet et régénération |
| S8 | Les quantités sont chiffrées, avec une unité du référentiel | Rejet |
| S9 | Aucune carte ne reprend un plat des 20 dernières cuisinées | Rejet de la carte concernée |
| S10 | Le temps annoncé est cohérent avec le nombre d'étapes | Signalement, non bloquant |

**Limite de tentatives** : 2 régénérations maximum, puis échec explicite avec option de saisie manuelle (RG-60).

---

## 5. Exigences sur le français

- Registre courant, ni familier ni gastronomique.
- Vocabulaire de cuisine domestique standard. Pas de terme technique de restauration non expliqué.
- Étapes formulées à l'infinitif ou à l'impératif, de façon cohérente sur toute l'application.
- Une étape = une action. Pas de paragraphe de cinq lignes.

---

## 6. Exigences sur le japonais

C'est le point de vigilance le plus élevé du projet. L'utilisatrice japonaise est native et son jugement est le critère de succès (`01-brief-moa.md`, section 7).

- **Registre ですます**, poli standard, celui d'un livre de cuisine grand public japonais.
- **Aucune traduction littérale du français.** Le japonais doit être écrit comme une recette japonaise, pas comme la traduction d'une recette française. Si les deux versions divergent légèrement dans la formulation, c'est normal et souhaitable.
- **Les noms d'ingrédients viennent du référentiel**, jamais d'une traduction produite par le modèle. C'est le garde-fou principal (P5).
- **Les unités japonaises usuelles sont respectées** : 大さじ (cuillère à soupe), 小さじ (cuillère à café), 適量 uniquement dans les étapes, jamais dans la liste de courses.
- **Aucun humour, aucun second degré, aucune familiarité.**
- **Les noms de plats étrangers sont en katakana** selon l'usage japonais courant, pas selon une translittération inventée.

Si la qualité du japonais produit par le modèle configuré n'est pas satisfaisante, c'est un motif valable de basculer de fournisseur. Prévois cette bascule (C3).

---

## 7. Ce que l'IA ne doit jamais produire

- Une recette dangereuse : cuisson insuffisante de viande ou volaille, conservation à risque, consommation crue d'un produit qui ne s'y prête pas.
- **Aucun conseil de conservation d'un bento sans mention de réfrigération** si le plat le nécessite. Le bento est consommé plusieurs heures après préparation, souvent sans réfrigération. Toute recette de verso doit tenir compte de cette contrainte, et éviter les préparations à risque (œuf peu cuit, poisson cru, crème, mayonnaise maison) pour les formes `restes` et `transforme`.
- Un ingrédient introuvable au Japon.
- Un message évaluant les choix de l'utilisateur (P4, RG-62).
- Une calorie, un macronutriment, une allégation de santé.
- Un texte publicitaire ou une marque commerciale.

---

## 8. Modes dégradés à prévoir

| Situation | Comportement attendu |
|---|---|
| Aucune clé API configurée | L'application fonctionne intégralement en manuel (RG-61). Le bouton booster explique comment configurer une clé. |
| Appel en échec réseau | Message clair, bouton réessayer, aucune perte de la saisie |
| Sortie invalide 3 fois | Message clair, proposition de créer une carte à la main, ou de rejouer avec un frigo moins contraint |
| Frigo entièrement vide | La génération fonctionne normalement, elle produit des recettes complètes à acheter intégralement |
| Génération trop lente | Affichage de la progression, possibilité d'annuler |

---

## 9. Qualité et itération

Le calibrage des prompts va demander plusieurs itérations. Pour permettre cette itération :

- **Les prompts sont dans des fichiers séparés et versionnés**, pas noyés dans le code applicatif.
- **Chaque génération conserve une trace** : contexte envoyé, sortie brute reçue, résultat de la validation. Consultable en développement, effaçable, sans donnée personnelle superflue.
- **Un moyen de tester une génération isolément** existe, sans passer par toute l'interface. Un script en ligne de commande suffit.
