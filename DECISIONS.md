# DECISIONS.md — Journal de décisions techniques

Ce fichier consigne les choix structurants pris en autonomie (CLAUDE.md §4).
Une entrée par décision. Le format est volontairement court.

---

## [2026-07-27] Stack applicative : Next.js (App Router) + TypeScript

Contexte : besoin d'un mobile-first installable (C2), coût d'hébergement proche
de zéro (C5), un seul développeur, projet à faire évoluer par quelqu'un
d'autre dans six mois (§7).

Choix : Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4.
Un seul dépôt, pas de monorepo — l'équipe et le périmètre ne le justifient
pas.

Alternatives écartées : SvelteKit et Remix (écosystème plus petit, moins
d'exemples pour PWA + Supabase) ; app native React Native (exclue par le
périmètre, cf. CLAUDE.md §6).

Réversible : non sans réécriture, mais le risque est faible (stack très
répandue, pas de verrouillage propriétaire).

---

## [2026-07-27] Backend : Supabase (Postgres + Auth + Realtime)

Contexte : C4 (clé API utilisateur, jamais en dur), C5 (coût proche de zéro
pour 2 personnes), C6 (email/mot de passe + Google), C7 (multi-foyer dès le
schéma), RG-50 (case cochée synchronisée en temps réel), RG-63 (isolation des
données au niveau de la couche de données, pas seulement de l'interface).

Choix : Supabase, projet `mealquest` créé en région `ap-northeast-1` (Tokyo),
palier gratuit (0 $/mois confirmé à la création). Postgres pour toutes les
données métier, Supabase Auth pour l'authentification, Supabase Realtime pour
la synchronisation de la liste de courses (RG-50). Row Level Security (RLS)
activé sur chaque table dès sa création, avec `household_id` comme clé
d'isolation — c'est la réponse à RG-63 : l'isolation est vérifiée par Postgres,
pas par le code applicatif.

Alternatives écartées : Firebase (moins naturel pour un schéma relationnel
avec agrégations comme la liste de courses) ; backend applicatif maison sur
un VPS (coût et maintenance disproportionnés pour 2 utilisateurs).

Réversible : partiellement. Le schéma Postgres est portable, la dépendance
forte est Supabase Auth (migration de comptes utilisateurs non triviale).

---

## [2026-07-27] Authentification : Supabase Auth (email/mot de passe + Google OAuth)

Contexte : C6 impose les deux méthodes.

Choix : Supabase Auth gère les deux nativement. Le provider Google OAuth sera
activé dans le dashboard Supabase au lot 1 (nécessite la création d'un client
OAuth Google, une étape MOA — voir README.md).

Alternatives écartées : Auth.js (NextAuth) en parallèle de Supabase — aurait
dupliqué la gestion de session sans bénéfice, Supabase Auth suffit seul.

Réversible : oui, la couche d'accès (`lib/supabase/*`) isole l'appelant du
fournisseur d'auth.

---

## [2026-07-27] Hébergement : Vercel (app) + Supabase (données)

Contexte : C5, usage de 2 personnes, pas de pic de trafic prévisible.

Choix : Vercel, palier gratuit (Hobby), déploiement à partir du dépôt git.
Combiné au palier gratuit Supabase, le coût d'hébergement total est nul en
usage normal.

Alternatives écartées : auto-hébergement (VPS) — coût de maintenance non
justifié pour 2 utilisateurs (C5, et §9 du backlog : ne pas passer de temps
sur l'infra avant d'en avoir besoin).

Réversible : oui, Next.js ne verrouille pas à Vercel.

---

## [2026-07-27] Internationalisation : dictionnaires statiques fr/ja, pas de routing par locale

Contexte : C1 — chaque utilisateur voit l'interface **et** le contenu généré
dans sa langue, choisie par utilisateur et stockée en base (`membre.langue`),
pas déduite du navigateur. Ce n'est donc pas de l'i18n "site public" classique
avec des URLs `/fr/...` et `/ja/...`.

Choix : dictionnaires JSON statiques (`lib/i18n/dictionaries/{fr,ja}.json`)
pour les textes d'interface, chargés selon la langue du membre connecté
(mécanisme de session à finaliser au lot 1). Le contenu généré par l'IA
(titres, étapes de recette) est distinct : chaque carte stocke ses deux
versions (`titre_fr`/`titre_ja`, etc.) en base, ce n'est pas de la traduction
à la volée (P5, RG-26). Un test (`tests/i18n.test.ts`) garantit que les deux
dictionnaires ont exactement le même jeu de clés, pour éviter qu'un texte
n'existe que dans une langue.

Alternatives écartées : next-intl avec routing par préfixe d'URL — pertinent
pour un site multilingue public, pas pour une app privée où la langue est un
attribut du compte, pas du visiteur.

Réversible : oui, le point d'entrée `getDictionary(locale)` peut être remplacé
par une lib dédiée sans toucher les appelants.

---

## [2026-07-27] Fournisseur IA : abstraction par interface, DeepSeek en premier

Contexte : C3 — le fournisseur doit être remplaçable par configuration, sans
refactor. C4 — la clé est saisie par l'utilisateur, jamais en dur.

Choix : une interface `AiProvider` (à écrire au lot 4) avec une implémentation
par fournisseur (DeepSeek au départ). Le foyer stocke en base le fournisseur
choisi, le modèle, et la clé API. La clé est utilisée uniquement côté serveur
(route API Next.js), jamais exposée au client. Le chiffrement au repos de la
clé (Supabase Vault / pgsodium) sera mis en place au lot 1 en même temps que
l'écran de paramètres — c'est une décision d'architecture prise maintenant
pour ne pas avoir à la reprendre plus tard.

Alternatives écartées : appel direct à l'API IA depuis le client — rejeté,
exposerait la clé de l'utilisateur dans le navigateur.

Réversible : oui, c'est tout l'intérêt de l'abstraction.

---

## [2026-07-27] Fuseau horaire et semaine : constantes centralisées

Contexte : C8 (Asia/Tokyo partout), C9 (semaine lundi-dimanche), §7 (valeurs
chiffrées centralisées, pas dispersées).

Choix : `lib/config/business-rules.ts` centralise `HOUSEHOLD_TIMEZONE =
"Asia/Tokyo"` et `WEEK_START_DAY = 1` (lundi), ainsi que toutes les valeurs
chiffrées de `docs/02-regles-metier.md` (budget de points, coefficient
enfant, seuils du booster, etc.). Le calcul réel des limites de semaine en
Asia/Tokyo est différé au lot 2 (semainier), mais la constante existe dès
maintenant pour que rien ne soit codé en dur ailleurs.

Réversible : oui.

---

## [2026-07-27] Gestionnaire de paquets : npm

Contexte : `pnpm` n'est pas installé sur la machine de développement, `npm`
l'est déjà (v11.6.2).

Choix : npm, pour ne pas ajouter une dépendance d'environnement non
nécessaire.

Alternatives écartées : pnpm (aurait demandé une installation globale sans
bénéfice mesurable pour un projet à un seul contributeur).

Réversible : oui.

---

## [2026-07-27] Stratégie de test

Contexte : §7 impose au minimum le calcul des besoins, le calcul de la liste
de courses, et la validation des sorties IA.

Choix : Vitest pour les tests unitaires (calculs métier purs, schémas de
validation Zod des sorties IA). Pas de suite e2e en V1 — hors du "à ne pas
faire" du backlog (§9) tant que le produit n'est pas stabilisé. Chaque lot
ajoute ses tests au fur et à mesure (le lot 0 pose seulement la config et deux
tests de garde : parité des dictionnaires fr/ja, constantes métier).

Réversible : oui.

---

## [2026-07-27] Note : avertissements npm audit sur les dépendances de build

Contexte : `npm audit` signale 12 vulnérabilités "high" au lot 0, toutes dans
des dépendances de build/dev (`eslint` transitif via `minimatch`/
`brace-expansion`, et `postcss`/`sharp` embarqués par Next.js lui-même). Le
correctif proposé par `npm audit fix --force` rétrograderait Next.js vers la
version 9, ce qui casserait l'application (régression majeure) sans rapport
avec le risque réel : aucune de ces dépendances ne traite d'entrée non fiable
en production dans cette application.

Choix : ne pas forcer la rétrogradation. À surveiller à chaque lot via
`npm audit` ; corriger dès qu'un correctif non cassant existe.

Réversible : oui, décision de suivi, pas un choix d'architecture.

---

## [2026-07-27] Placeholder `lang="fr"` sur `<html>`

Contexte : au lot 0, il n'existe encore aucune session utilisateur ni membre
connu, donc aucune langue réelle à appliquer.

Choix : `lang="fr"` en dur dans `app/layout.tsx` comme valeur par défaut
temporaire. Au lot 1, cet attribut devra être dérivé de la langue du membre
connecté (C1, A1.4, A1.5).

Réversible : oui, changement d'une ligne.
