# MealQuest

Application privée de planification hebdomadaire des repas pour un foyer de
2 personnes. Voir `docs/01-brief-moa.md` pour le contexte complet, et
`DECISIONS.md` pour les choix techniques.

**État actuel : Lot 2 terminé.** Authentification, foyer et membres, interface
bilingue fr/ja par membre, allergies et dégoûts, objectif et budget de points,
matériel de cuisine, clé API du modèle, et semainier des disponibilités avec
calcul des besoins et des portions. Le frigo et la génération de recettes
arrivent aux lots suivants.
Voir `PROGRESS.md` pour le détail des critères d'acceptation.

---

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, Realtime) — projet `mealquest`, région Tokyo
- Vitest pour les tests
- Déploiement : conteneur Docker (`output: "standalone"`) sur Dokploy
  (VPS Hostinger existant) + Supabase (données)

---

## Prérequis

- Node.js ≥ 20 (testé avec Node 24)
- npm (fourni avec Node)

---

## Installation

```bash
npm install
```

⚠️ **Pour ajouter ou mettre à jour une dépendance**, régénérez le lockfile
avec la version de npm épinglée dans le `Dockerfile`, sinon le build de
production échouera sur `npm ci` :

```bash
npx --yes npm@11.16.0 install
```

La raison est expliquée dans `DECISIONS.md` (deux versions de npm ne
résolvent pas les dépendances optionnelles à l'identique).

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
SUPABASE_URL=https://ewcwyiqbpowluovtuifi.supabase.co
SUPABASE_ANON_KEY=<clé publishable du projet Supabase "mealquest">
```

Ces variables sont volontairement **sans préfixe `NEXT_PUBLIC_`** : elles
sont lues au runtime par le serveur, pas figées dans le build. Voir
`lib/supabase/config.ts` et `DECISIONS.md`.

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

## Déployer sur Dokploy

L'app se déploie comme un conteneur Docker classique. Dans Dokploy :

1. **Create Application → Docker** (ou "Dockerfile"), pointe sur ce dépôt
   git et la branche `main`. Dockerfile à la racine, rien à changer côté
   build command : Dokploy lit le `Dockerfile`.
2. **Environment** (variables de runtime classiques, aucun build arg
   nécessaire — l'image ne contient aucune configuration) :
   ```
   SUPABASE_URL=https://ewcwyiqbpowluovtuifi.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_pnopecUxQO-pMY0RBWztaw_H6Vpaa7e
   APP_URL=https://mealquest.agdevelopment.co
   ```
   `APP_URL` est indispensable derrière le proxy : le conteneur écoute sur
   `0.0.0.0:3000` et ne peut pas deviner le nom de domaine. Sans elle, la
   connexion Google renvoie le navigateur sur une adresse injoignable.
3. **Port** : le conteneur écoute sur `3000` (`EXPOSE 3000` dans le
   Dockerfile).
4. **Domain** : ajoute ton nom de domaine dans l'onglet Domains de Dokploy,
   Dokploy gère le certificat HTTPS (Let's Encrypt via Traefik).
5. **Deploy**.

Une fois le domaine connu, mets-le à jour à deux endroits :
- Google Cloud Console → Credentials → ton client OAuth →
  *Authorized JavaScript origins*
- Supabase → Authentication → URL Configuration → *Site URL* et
  *Redirect URLs* (`https://tondomaine.tld/**`)

Pour tester le build Docker en local avant de pousser (nécessite Docker
installé, ce qui n'est pas le cas sur cette machine de dev au moment de la
rédaction de ce README) :

```bash
docker build -t mealquest .
docker run -p 3000:3000 \
  -e SUPABASE_URL=https://ewcwyiqbpowluovtuifi.supabase.co \
  -e SUPABASE_ANON_KEY=sb_publishable_pnopecUxQO-pMY0RBWztaw_H6Vpaa7e \
  mealquest
```

---

## Installer sur l'écran d'accueil d'un iPhone (C2)

Une fois l'application déployée (ou testée sur le réseau local depuis un
iPhone) : Safari → icône de partage → « Sur l'écran d'accueil ». Aucun
passage par l'App Store.

---

## Ce qui reste à faire avant le lot 1

- Configurer l'application dans Dokploy (voir section ci-dessus) et brancher
  le nom de domaine — action MOA, pas automatisable depuis ce dépôt.

---

## Structure du projet

```
Dockerfile               Build de production, déploiement Dokploy
app/                    Routes Next.js (App Router)
lib/
  config/                Constantes métier centralisées (RG chiffrées)
  i18n/                  Dictionnaires fr/ja et sélecteur de langue
  supabase/              Clients Supabase (navigateur et serveur)
  household/             Règles du foyer : budget de points, matériel
  week/                  Dates Asia/Tokyo et moteur de besoins
components/              Primitives d'interface partagées
middleware.ts            Session Supabase et protection des routes
supabase/migrations/     Migrations SQL (schéma, RLS, référentiel)
tests/                   Tests Vitest
docs/                    Spécifications MOA (ne pas modifier sans MOA)
data/                    Référentiels seed (ingrédients, twists)
DECISIONS.md             Journal des décisions techniques
PROGRESS.md              État d'avancement par lot
```
