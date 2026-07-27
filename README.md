# MealQuest

Application privée de planification hebdomadaire des repas pour un foyer de
2 personnes. Voir `docs/01-brief-moa.md` pour le contexte complet, et
`DECISIONS.md` pour les choix techniques.

**État actuel : Lot 0 (cadrage technique).** L'application affiche une page
de vérification (i18n fr/ja + connexion Supabase), rien de fonctionnel
côté métier pour l'instant. Voir `PROGRESS.md`.

---

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Realtime) — projet `mealquest`, région Tokyo
- Vitest pour les tests
- Déploiement visé : Vercel (app) + Supabase (données)

---

## Prérequis

- Node.js ≥ 20 (testé avec Node 24)
- npm (fourni avec Node)

---

## Installation

```bash
npm install
```

---

## Configuration

L'application a besoin de deux variables d'environnement pour parler à
Supabase. Un fichier `.env.local` est déjà présent avec les valeurs du projet
`mealquest` existant — rien à faire pour démarrer en local.

Si ce fichier venait à manquer, recréez-le à partir du modèle :

```bash
cp .env.example .env.local
```

Puis renseignez :

```
NEXT_PUBLIC_SUPABASE_URL=https://ewcwyiqbpowluovtuifi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé publishable du projet Supabase "mealquest">
```

La clé publishable (pas secrète, utilisable côté navigateur) se trouve dans
le dashboard Supabase du projet : Project Settings → API.

**La clé de votre fournisseur d'IA (DeepSeek ou autre) ne se configure pas
ici.** Elle se saisit depuis l'écran Paramètres de l'application une fois
connecté (C4) — cet écran arrive au lot 1/4.

---

## Lancer en local

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). La page doit afficher
« Connexion à Supabase établie. » si la configuration est correcte.

---

## Tests

```bash
npm run test        # une passe
npm run test:watch  # mode watch
```

---

## Build de production

```bash
npm run build
npm run start
```

---

## Installer sur l'écran d'accueil d'un iPhone (C2)

Une fois l'application déployée (ou testée sur le réseau local depuis un
iPhone) : Safari → icône de partage → « Sur l'écran d'accueil ». Aucun
passage par l'App Store.

---

## Ce qui reste à faire avant le lot 1

- Activer le provider Google dans Supabase Auth (Authentication → Providers →
  Google), ce qui demande de créer un client OAuth côté Google Cloud Console.
  C'est une action MOA, pas automatisable depuis ce dépôt.
- Déployer sur Vercel et y reporter les mêmes variables d'environnement.

---

## Structure du projet

```
app/                    Routes Next.js (App Router)
lib/
  config/                Constantes métier centralisées (RG chiffrées)
  i18n/                  Dictionnaires fr/ja et sélecteur de langue
  supabase/              Clients Supabase (navigateur et serveur)
supabase/migrations/     Migrations SQL (vide au lot 0)
tests/                   Tests Vitest
docs/                    Spécifications MOA (ne pas modifier sans MOA)
data/                    Référentiels seed (ingrédients, twists)
DECISIONS.md             Journal des décisions techniques
PROGRESS.md              État d'avancement par lot
```
