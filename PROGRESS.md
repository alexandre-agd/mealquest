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

### Prochaine étape
Lot 3 — Référentiel d'ingrédients et inventaire du frigo
(`docs/07-backlog-batchs.md`). Le référentiel est déjà importé et contrôlé
depuis le lot 1 ; le lot 3 portera donc sur l'écran d'inventaire, le tri par
fréquence d'usage, la recherche et l'ajout d'ingrédient personnalisé.

**Avant de démarrer le lot 3** : la relecture des 170 noms japonais du
référentiel avec une locutrice native reste le prérequis annoncé par
`README-PACK.md`.
