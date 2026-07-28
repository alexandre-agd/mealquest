# PROGRESS.md — État d'avancement

## Lot 0 — Cadrage technique — TERMINÉ (2026-07-27)

### Ce qui marche
- Projet Next.js 16 (App Router, TypeScript, Tailwind v4) qui démarre en
  local (`npm run dev`) et se build (`npm run build`).
- Projet Supabase `mealquest` créé (région `ap-northeast-1`, Tokyo, palier
  gratuit), connexion vérifiée depuis la page d'accueil.
- Dictionnaires fr/ja en place (`lib/i18n`), avec un test garantissant la
  parité des clés entre les deux langues.
- Constantes métier chiffrées centralisées dans `lib/config/business-rules.ts`
  (budget de points, coefficient enfant, seuils du booster, fuseau horaire,
  début de semaine).
- PWA installable : manifest, icônes, meta Apple — installation sur écran
  d'accueil iPhone testable dès maintenant.
- Suite de tests Vitest posée (`npm run test`), 5 tests passent.
- `DECISIONS.md` documente les choix de stack, hébergement, auth, i18n,
  fournisseur IA, tests.
- `README.md` avec les commandes exactes d'installation et de lancement.
- Auth Google activée côté Supabase (fait par la MOA).
- Déploiement Vercel initial effectué puis abandonné au profit de Dokploy
  (VPS Hostinger existant de la MOA, cf. `DECISIONS.md`) — `next.config.ts`
  passé en `output: "standalone"`, `Dockerfile` multi-stage ajouté et
  vérifié (`npm run build` produit bien `.next/standalone/server.js`). Le
  build Docker complet n'a pas pu être testé localement (Docker non installé
  sur la machine de dev) ; premier test réel au déploiement Dokploy.
- Déploiement Dokploy opérationnel sur https://mealquest.agdevelopment.co
  après deux correctifs : régénération du `package-lock.json` (`npm ci`
  échouait sur Alpine) et passage de la configuration Supabase en lecture
  runtime sans préfixe `NEXT_PUBLIC_` (voir `DECISIONS.md`).

### Objectifs du lot 0 (docs/07-backlog-batchs.md)

| Objectif | Statut |
|---|---|
| `DECISIONS.md` avec choix de stack justifiés (C1-C10) | OK |
| Squelette du projet qui démarre en local | OK |
| `README.md` avec commandes d'installation et de lancement | OK |
| Stratégie de test et de déploiement documentée | OK |
| L'application affiche une page vide mais fonctionne, se déploie | OK sur Vercel (validé) ; migration Dokploy en attente du premier déploiement réel côté MOA |

### Volontairement laissé de côté
- Toute donnée métier (foyer, membres, cartes, etc.) — c'est le lot 1.
- CI (lint/test automatiques sur push) — pas mentionné dans le pack de specs,
  à discuter si utile pour un projet à un seul contributeur.

---

## Lot 1 — Fondations, foyer, paramètres — TERMINÉ (2026-07-27)

Déployé sur https://mealquest.agdevelopment.co

### Ce qui marche
- **Authentification** e-mail / mot de passe et Google, avec rafraîchissement
  de session par middleware et protection des routes privées.
- **Onboarding en 4 écrans** : nom du foyer et composition, prénoms avec
  langue et allergies par membre, objectif avec budget calculé en direct,
  matériel de cuisine. Création atomique en un seul appel base.
- **Interface bilingue intégrale** fr / ja, langue attachée au membre : les
  deux utilisateurs du foyer voient chacun la leur, sans influence mutuelle.
- **Paramètres** : foyer et objectif, membres (ajout, modification,
  suppression, langue, allergies, dégoûts avec recherche dans le
  référentiel), matériel, clé API du modèle, langue personnelle, déconnexion.
- **Isolation stricte par foyer** au niveau Postgres (RLS), vérifiée par un
  test d'impersonation, pas seulement par l'interface.
- **Clé API chiffrée** dans Supabase Vault, jamais réaffichée.
- **Référentiel d'ingrédients** : 170 entrées importées, contrôles
  d'intégrité de `docs/08` tous passés, aucune anomalie à signaler.
- 18 tests unitaires (budget de points, dictionnaires), `tsc`, `eslint` et
  `next build` sans erreur.

### Critères d'acceptation (docs/06)

| # | Critère | Résultat |
|---|---|---|
| A1.1 | Compte e-mail + mot de passe, puis reconnexion | **OK** |
| A1.2 | Compte avec Google | **OK sous réserve** — bouton et flux OAuth en place, provider Google actif côté Supabase ; non testé de bout en bout faute de compte Google de test (voir ci-dessous) |
| A1.3 | Créer un foyer, 2 adultes 0 enfant, nommer chaque membre | **OK** |
| A1.4 | Langue d'un membre en japonais, interface entièrement en japonais | **OK** |
| A1.5 | Langue de l'autre membre en français, les deux coexistent | **OK** — vérifié en base : un membre `fr`, l'autre `ja`, indépendants |
| A1.6 | Cocher le matériel et le retrouver après reconnexion | **OK** |
| A1.7 | Déclarer une allergie sur un membre | **OK** — crevette sur ユキ, persistée |
| A1.8 | Changer d'objectif fait changer le budget affiché | **OK** — 24 / 30 / 36 pour 2 adultes |
| A1.9 | Ajouter un enfant recalcule le budget avec le coefficient 0,6 | **OK** — 30 → 39 points |
| A1.10 | Installation sur l'écran d'accueil d'un iPhone, plein écran | **À VÉRIFIER PAR LA MOA** — manifeste, icônes et `display: standalone` en place, mais l'installation réelle demande un iPhone |
| A1.11 | Aucun texte d'interface en dur dans le code | **OK** — tout passe par `lib/i18n`, test de parité des clés |
| A1.12 | Données inaccessibles depuis un autre compte, au niveau des données | **OK** — test RLS avec deux foyers : 0 ligne franchit la frontière |

### Ce qui demande une action de la MOA
1. **A1.2** — tester « Continuer avec Google » avec un vrai compte Google, sur
   le domaine de production. Prérequis déjà faits côté Supabase ; il reste à
   ajouter `https://mealquest.agdevelopment.co` dans Google Cloud Console
   (*Authorized JavaScript origins*) et dans Supabase (*Site URL* et
   *Redirect URLs*).
2. **A1.10** — installer l'application sur l'écran d'accueil d'un iPhone et
   confirmer l'ouverture en plein écran.
3. **Référentiel d'ingrédients** — la relecture des 170 noms japonais avec une
   locutrice native reste à faire avant le lot 3 (`README-PACK.md`). Les
   contrôles automatiques ne disent rien de la justesse des noms de magasin.

### Limites connues, assumées à ce stade
- **Confirmation d'e-mail active** : une inscription par e-mail n'ouvre pas de
  session tant que le lien de confirmation n'est pas suivi. L'écran le dit
  clairement. À désactiver dans Supabase si la MOA préfère un accès immédiat.
- **Suppression d'un compte** : supprimer le dernier compte d'un foyer laisse
  le foyer orphelin en base (aucune clé étrangère de `households` vers
  `auth.users`). Sans conséquence en V1, où la suppression de compte n'est pas
  une fonctionnalité exposée. À traiter si l'ouverture multi-foyer se
  concrétise.
- **Trois champs portent le libellé « Prénom »** sur l'écran de paramètres
  (deux membres + le champ d'ajout). Sans conséquence visuelle, mais ambigu
  pour un lecteur d'écran. À affiner si l'accessibilité devient un sujet.
- **Dégoûts alimentaires** : la recherche porte sur les noms français et
  japonais du référentiel, sans tolérance aux fautes de frappe ni aux accents.

---

## Lot 2 — Semainier et moteur de besoins — TERMINÉ (2026-07-27)

### Ce qui marche
- **Grille 7 jours × 2 créneaux**, une couche par membre, bascule en un tap.
- **Quatre statuts** par case, cycle au tap. Le `bento` n'existe qu'au midi,
  garanti par une contrainte en base et pas seulement par l'interface.
- **Raccourcis** : régler toute une colonne en un geste, copier la semaine
  précédente, appliquer la semaine du membre courant à tous les autres,
  remettre la semaine à zéro.
- **Compteur permanent** de dîners et de bentos, recalculé à chaque tap, avec
  mention des déjeuners orphelins.
- **Moteur de besoins** (`lib/week/needs.ts`) : besoins dîner et déjeuner,
  déjeuners orphelins, portions avec coefficient enfant, portions du verso.
- **Navigation de semaine** libre, passé comme futur. Une URL bricolée avec
  un mercredi est ramenée au lundi de sa semaine.
- 68 tests au total, dont 26 sur les dates et le moteur de besoins.

### Critères d'acceptation (docs/06)

| # | Critère | Résultat |
|---|---|---|
| A2.1 | Grille lundi à dimanche, midi et soir | **OK** |
| A2.2 | Régler chaque case sur les 4 statuts | **OK** |
| A2.3 | `bento` non proposé le soir | **OK** — vérifié à l'écran (cycle du soir à 3 états) et en base (contrainte `check` qui rejette l'insertion) |
| A2.4 | Basculer d'un membre à l'autre en un geste | **OK** |
| A2.5 | Appliquer un statut à toute une ligne en un geste | **OK** — un tap sur l'en-tête règle les 7 jours |
| A2.6 | Copier la semaine précédente en un geste | **OK** — copie vérifiée en base, distributions identiques |
| A2.7 | Compteur permanent dîners / bentos | **OK** — passe de 1 à 7 dîners en direct |
| A2.8 | Mardi soir, 1 `maison` + 1 `exterieur` → 1 besoin, 1 portion | **OK** — test unitaire dédié |
| A2.9 | Mercredi midi, 1 `exterieur` + 1 `bento` → 1 besoin, 1 portion | **OK** — test unitaire dédié |
| A2.10 | Dîner 2 personnes, bento du lendemain pour 1 → verso à 1 portion | **OK** — le point dur du lot : 5 tests dédiés, dont le cas inverse (verso plus grand que le dîner) et le cas sans besoin le lendemain |
| A2.11 | Lundi midi avec besoin, dimanche soir sans → orphelin | **OK** — test unitaire dédié |
| A2.12 | Case jamais touchée = `libre`, aucun besoin | **OK** |
| A2.13 | Saisie complète en moins de 60 secondes, chronomètre en main | **À VÉRIFIER PAR LA MOA** — voir ci-dessous |

### Ce qui demande une action de la MOA
- **A2.13** est un critère chronométré, à deux personnes : il ne peut pas être
  validé autrement qu'en conditions réelles. Ordre de grandeur observé en
  test : une semaine type se saisit en une dizaine de taps (un tap par
  colonne réglée, un tap pour appliquer à l'autre membre, quelques
  corrections), et une semaine qui ressemble à la précédente en un seul.
  À confirmer avec un vrai dimanche soir.

### Limites connues, assumées à ce stade
- **Mise à jour optimiste** : l'écran affiche le changement avant confirmation
  du serveur. En cas d'échec réseau, un message apparaît mais l'affichage
  n'est pas rétabli. Acceptable sur un réseau domestique, à revoir si des
  coupures se produisent.
- **Pas de table `week_plans`** : elle arrive au lot 3, quand l'inventaire
  devra s'y rattacher (RG-29). Le semainier fonctionne sans.
- **Copie de semaine et membres supprimés** : copier une semaine dont un
  membre a été supprimé entre-temps ignore simplement ses lignes.

---

## Lot 3 — Référentiel et inventaire du frigo — TERMINÉ (2026-07-27)

### Ce qui marche
- **Plan de semaine** créé automatiquement à la première saisie, un par
  semaine et par foyer. L'inventaire y est rattaché : c'est une photo prise
  à un moment donné, pas un stock vivant (RG-29).
- **Inventaire des périssables uniquement** : 107 lignes, aucun `staple`.
- **Sélecteur à quatre niveaux** visible directement sur chaque ligne, un
  seul tap, sans menu à ouvrir.
- **Tri** : ce qui est déjà dans le frigo remonte en tête, puis les
  ingrédients les plus souvent déclarés par le foyer, puis le rayon.
- **Recherche** en français et en japonais sur les 107 périssables.
- **Préchargement** de l'inventaire de la semaine précédente, avec un message
  qui l'annonce.
- **Frigo vide** en un geste.
- **Ingrédient personnalisé** ajouté depuis les paramètres, disponible
  immédiatement dans le frigo.
- 75 tests au total.

### Critères d'acceptation (docs/06)

| # | Critère | Résultat |
|---|---|---|
| A3.1 | Référentiel chargé, noms FR, JA et EN | **OK** — 170 entrées, contrôles de `docs/08` passés sans anomalie |
| A3.2 | Aucun `staple` sur l'écran d'inventaire | **OK** — 107 lignes présentées, 63 staples exclus |
| A3.3 | Sélecteur 0 à 3 réglable en un tap, sans menu | **OK** |
| A3.4 | Ingrédient non touché = 0 | **OK** — l'absence de ligne vaut 0 |
| A3.5 | Inventaire de la semaine précédente préchargé | **OK** |
| A3.6 | Les plus utilisés en haut de liste | **OK** |
| A3.7 | Chercher et ajouter un périssable absent de la liste courte | **OK** — recherche FR et JA |
| A3.8 | Remise à zéro du frigo en un geste | **OK** |
| A3.9 | Saisie de l'inventaire en moins de 90 secondes | **À VÉRIFIER PAR LA MOA** — critère chronométré |
| A3.10 | Ingrédient personnalisé disponible partout | **OK** |

### Ce qui demande une action de la MOA
- **A3.9**, chronométré, à valider en conditions réelles. La liste complète
  fait 107 lignes : à partir de la deuxième semaine le préchargement réduit
  le travail à corriger ce qui a changé, mais la première saisie sera plus
  longue. Si elle dépasse le budget, la piste est de raccourcir la liste
  initiale plutôt que d'accélérer les gestes.
- **Relecture des 170 noms japonais** avec une locutrice native
  (`README-PACK.md`). Toujours en attente, et c'est le prérequis qui
  conditionne l'exactitude de la liste de courses au lot 5.

### Limites connues, assumées à ce stade
- **Liste longue à la première utilisation** : les 107 périssables sont
  présentés d'emblée, faute d'historique. Le tri par fréquence ne devient
  utile qu'à partir de la deuxième semaine.
- **Recherche sans tolérance** aux fautes de frappe ni aux accents partiels.
- **Suppression d'un ingrédient personnalisé** non exposée : on peut en
  ajouter, pas en retirer depuis l'interface.
- **`week_plans.points_budget` reste vide** : la colonne existe pour le lot 4,
  rien ne l'alimente encore.

---

## Lot 4a — Sécurité d'accès et moteur de génération — TERMINÉ (2026-07-28)

Le lot 4 est scindé en deux, comme le prévoit `docs/07`. Le 4a couvre tout ce
qui est testable sans interface ; le 4b portera le booster et le planning.

### Ajout hors périmètre initial : l'application devient strictement privée
Demande de la MOA au démarrage du lot, motivée par l'arrivée d'un secret à
protéger.

- **Liste d'accès nominative** : un trigger sur `auth.users` refuse toute
  adresse absente de `allowed_signups`. S'applique au mot de passe, à Google
  et à un appel direct de l'API. Gérée depuis les paramètres, par un
  administrateur uniquement.
- **La clé du modèle n'est déchiffrable que par le serveur** : la fonction de
  lecture n'est accordée qu'au rôle `service_role`. Un compte connecté ne
  peut pas la récupérer, même avec une session valide.
- **Un espace, une clé** : vérifié sur deux foyers, chacun ne résout que sa
  propre clé. Un nouvel arrivant devra saisir la sienne.

### Ce qui marche
- **Validation stricte des sorties** (`lib/ai/validation.ts`), module pur sans
  réseau ni base : rejet pour S1, S2, S3, S4, S7, S8, S9 ; correction
  automatique pour S5 et S6 ; signalement pour S10. Les points du verso sont
  calculés par le code, jamais repris du modèle (RG-23).
- **Abstraction du fournisseur** (C3) : une implémentation couvre DeepSeek,
  OpenAI et Mistral. Changer de fournisseur ne touche pas le moteur.
- **Prompts dans des fichiers versionnés** (`prompts/`), avec le numéro de
  version journalisé à chaque génération.
- **Contexte de génération** conforme à `docs/05` §3 : contraintes du foyer,
  besoins avec portions du verso distinctes, frigo niveaux 2 et 3,
  référentiel complet, historique, règles d'équilibre de la main.
- **Régénération dirigée** : la relance transmet les motifs de rejet plutôt
  que de répéter la demande. Deux tentatives maximum, cartes déjà validées
  conservées, échec explicite ensuite.
- **Script de test isolé** : `npm run generation`.
- 121 tests au total, dont 46 sur le moteur.

### Ce qui demande une action de la MOA
- **Calibrage des prompts** : lancer `npm run generation` avec une vraie clé
  et juger la sortie, en particulier la qualité du japonais (critère A4.22,
  qui ne se teste qu'avec une locutrice native).
- **`SUPABASE_SERVICE_ROLE_KEY`** doit être renseignée dans Dokploy, sinon la
  génération ne pourra pas lire la clé du foyer.

### Limites connues, assumées à ce stade
- **Les cartes ne sont pas encore persistées** : le 4a s'arrête à la
  génération validée. Les tables `cards` arrivent au 4b, avec le booster.
- **Aucun appel réel au modèle n'a encore été effectué** : le moteur est
  vérifié par des tests déterministes, pas contre l'API DeepSeek. Le premier
  appel réel se fera par le script.
- **Les traces de génération ne sont pas encore stockées en base** : elles
  sont exposées par l'orchestrateur et affichées par le script, mais leur
  archivage attend le 4b.
- **S4 ne vérifie pas le sens** : on contrôle que les deux langues existent et
  ont la même structure, pas qu'elles décrivent le même plat. Seule une
  lectrice native peut le juger.

### Prochaine étape
Lot 4b — booster, sélection dans la main, affectation au planning, cartes
neutres, compteur de points, création manuelle de carte.

---

## Lot 5 — Courses, recette, cuisiner — TERMINÉ (2026-07-28)

**Fin de la V1.**

### Ce qui marche
- **Liste de courses** calculée selon RG-47 : quantités ajustées aux portions
  réelles du créneau, agrégation par ingrédient, niveau 2 ou 3 exclu, niveau 1
  selon le nombre d'usages, staples renvoyés au placard sans quantité.
- **Groupée par rayon** dans l'ordre d'un parcours de supermarché japonais.
- **Bilingue simultané** : le seul écran où les deux langues cohabitent.
- **Cases cochables partagées** entre les membres par Realtime, avec mise à
  jour optimiste.
- **Lignes libres** ajoutables et supprimables.
- **Écran recette** pensé pour la cuisine : texte large, étapes cochables une
  par une, écran maintenu allumé, quantités aux portions du créneau.
- **Bouton « J'ai cuisiné »** : le créneau passe à cuisiné, la carte entre
  dans la collection.
- **Accueil** qui répond à « on mange quoi ce soir » sans navigation, avec le
  lunch du lendemain et l'accès direct à la recette.
- 149 tests, dont 21 sur le calcul de la liste.

### Critères d'acceptation (docs/06)

| # | Critère | Résultat |
|---|---|---|
| A5.1 | Liste générée automatiquement | **OK** — recalculée à chaque affichage |
| A5.2 | Niveau 2 ou 3 non acheté | **OK** |
| A5.3 | Niveau 1 utilisé une fois → « probablement suffisant » | **OK** |
| A5.4 | Niveau 1 utilisé deux fois → acheté | **OK** |
| A5.5 | Staples au placard, sans quantité | **OK** |
| A5.6 | Groupé par rayon, ordre du magasin | **OK** |
| A5.7 | Français et japonais simultanés | **OK** |
| A5.8 | Quantités chiffrées avec unité de magasin | **OK** |
| A5.9 | Case cochée visible sur l'autre téléphone | **À VÉRIFIER PAR LA MOA** — Realtime en place, demande deux appareils |
| A5.10 | Ligne libre ajoutable | **OK** |
| A5.11 | Écran recette complet (RG-53) | **OK** |
| A5.12 | Quantités aux portions réelles du créneau | **OK** |
| A5.13 | Écran qui ne s'éteint pas | **OK sous réserve** — Wake Lock demandé ; non supporté par tous les navigateurs iOS |
| A5.14 | Étapes cochables une par une | **OK** |
| A5.15 | Bouton « cuisiné » → collection | **OK** |
| A5.16 | Accueil répond sans navigation | **OK** |
| A5.17 | Aucune calorie ni jugement | **OK** — aucun de ces termes dans les dictionnaires |

### Limites connues
- **Cochage partagé non éprouvé** : le canal Realtime est ouvert et les tables
  publiées, mais le comportement à deux téléphones sur réseau instable n'a pas
  été observé.
- **Wake Lock** : l'API n'est pas disponible partout, notamment sur d'anciennes
  versions de Safari iOS. Son absence est sans conséquence, la recette reste
  lisible, mais l'écran peut s'éteindre.
- **Les étapes cochées ne sont pas persistées** : elles servent à suivre la
  progression pendant qu'on cuisine et repartent à zéro au rechargement.
- **La notation d'une carte cuisinée** relève du lot 6 (V2), comme prévu.

### Recette finale de la V1 (docs/06)
Les quatre points se vérifient en conditions réelles, pas ici :
1. Une semaine planifiée de bout en bout à deux, en moins de 3 minutes.
2. La liste de courses utilisée telle quelle dans un vrai supermarché.
3. Au moins 4 recettes générées réellement cuisinées.
4. **L'utilisatrice japonaise utilise l'application seule et juge le japonais
   naturel.** Ce point est bloquant.
