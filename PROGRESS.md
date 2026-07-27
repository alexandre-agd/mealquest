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

### Objectifs du lot 0 (docs/07-backlog-batchs.md)

| Objectif | Statut |
|---|---|
| `DECISIONS.md` avec choix de stack justifiés (C1-C10) | OK |
| Squelette du projet qui démarre en local | OK |
| `README.md` avec commandes d'installation et de lancement | OK |
| Stratégie de test et de déploiement documentée | OK |
| L'application affiche une page vide mais fonctionne, se déploie | OK (déploiement Vercel non encore effectué, voir ci-dessous) |

### Ce qui reste (avant de démarrer réellement le lot 1)
- Déploiement Vercel effectif (compte Vercel à connecter — action MOA).
- Activation du provider Google dans Supabase Auth (nécessite un client
  OAuth Google Cloud Console — action MOA, voir README.md).

### Volontairement laissé de côté
- Toute donnée métier (foyer, membres, cartes, etc.) — c'est le lot 1.
- Chiffrement effectif de la clé API IA (Supabase Vault) — décision prise
  dans `DECISIONS.md`, implémentation au lot 1 avec l'écran de paramètres.
- CI (lint/test automatiques sur push) — pas mentionné dans le pack de specs,
  à discuter si utile pour un projet à un seul contributeur.

### Prochaine étape
Lot 1 — Fondations, foyer, paramètres (`docs/07-backlog-batchs.md`), une fois
ce document validé.
