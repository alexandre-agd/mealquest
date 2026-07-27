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

## [2026-07-27] Hébergement (bascule) : Dokploy sur le VPS Hostinger existant

Contexte : la MOA possède déjà un serveur Hostinger avec Dokploy installé,
utilisé pour d'autres projets, et veut un nom de domaine personnalisé géré
directement dessus plutôt que de dépendre d'un service tiers supplémentaire.
Le nom de domaine n'est pas un argument technique en soi (Vercel Hobby
supporte aussi les domaines personnalisés gratuitement), mais consolider
l'infra sur un serveur déjà payé et déjà maîtrisé par la MOA est cohérent
avec C5 (coût marginal nul) et évite une dépendance externe de plus.

Choix : abandon de Vercel, déploiement du conteneur Docker de l'app sur
Dokploy. `next.config.ts` passe en `output: "standalone"` (build vérifié en
local). Un `Dockerfile` multi-stage (deps → build → runtime Node minimal,
utilisateur non-root) est ajouté à la racine. Les variables
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` doivent être
fournies comme **build args** Docker (elles sont inlinées dans le bundle
client au moment du build, pas seulement au runtime) — configuration à faire
côté Dokploy, hors de portée de ce dépôt.

Le projet Vercel existant (`mealquest-bice.vercel.app`) n'est pas supprimé
automatiquement ; la MOA décide si elle le désactive.

Alternatives écartées : garder Vercel + domaine personnalisé pointé dessus —
plus simple mais laisse une dépendance externe alors que l'infra Dokploy
existe déjà.

Réversible : oui, `output: "standalone"` fonctionne aussi bien sur Vercel que
sur tout hébergeur Docker.

---

## [2026-07-27] Configuration Supabase lue au runtime, sans préfixe NEXT_PUBLIC_

Contexte : au premier déploiement Dokploy, l'application affichait « Connexion
à Supabase impossible » alors que les variables étaient correctement
renseignées dans l'interface. Cause : Next.js **remplace en dur** les
variables préfixées `NEXT_PUBLIC_` par leur valeur littérale au moment du
`next build`, y compris dans le code serveur. Dokploy fournit ses variables
au runtime du conteneur, pas au build : elles ont donc été figées à chaîne
vide dans l'image.

Choix : les variables deviennent `SUPABASE_URL` et `SUPABASE_ANON_KEY`, sans
préfixe, lues au runtime côté serveur via `lib/supabase/config.ts`. L'image
Docker ne contient plus aucune configuration : la même image peut tourner en
local, en préproduction ou en production. Le `Dockerfile` n'a plus besoin de
build args.

Conséquence pour le navigateur : le client Supabase côté client
(`lib/supabase/client.ts`) ne peut plus lire la config depuis `process.env`.
Elle lui sera transmise explicitement par un composant serveur (provider
React) au lot 1, quand le premier écran d'authentification en aura besoin.

Alternative écartée : passer les valeurs comme build args Docker. Fonctionne,
mais fige la configuration dans l'image (reconstruction nécessaire pour
changer une URL) et dépend d'un champ « Build Args » dans l'interface de
l'hébergeur.

Vérification : build effectué sans aucune variable d'environnement, puis
conteneur démarré avec les variables au runtime — la connexion s'établit.

Réversible : oui.

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

## [2026-07-27] Dates du semainier stockées en `date`, pas en instant

Contexte : C8 impose Asia/Tokyo partout, C9 la semaine du lundi au dimanche.

Choix : une case du semainier est un jour de calendrier, pas un instant. La
colonne est de type `date` et le code manipule des chaînes « AAAA-MM-JJ ».
Le fuseau n'intervient qu'à un seul endroit, « quel jour sommes-nous à
Tokyo ? », résolu par `Intl.DateTimeFormat` sans dépendance externe. Le reste
est de l'arithmétique de calendrier, insensible au fuseau.

Stocker un `timestamptz` aurait obligé à reconvertir à chaque lecture, avec le
risque classique du repas qui glisse d'un jour selon le fuseau de l'appareil.
Le Japon n'appliquant pas d'heure d'été, le dernier piège habituel disparaît.

Réversible : oui, mais aucune raison.

---

## [2026-07-27] Les disponibilités ne sont pas rattachées à un plan de semaine

Contexte : `docs/04` décrit une entité « Plan de semaine » et une entité
« Disponibilité ». La tentation était de créer les deux tout de suite.

Choix : au lot 2, seule la table `availabilities` existe, clé sur
(membre, date, créneau). Un plan de semaine n'a rien à porter tant qu'il n'y
a ni inventaire (lot 3) ni cartes (lot 4) à y rattacher. La table
`week_plans` sera créée au lot 3, quand l'inventaire devra s'y accrocher
(RG-29).

Conséquence utile : le semainier fonctionne sur n'importe quelle semaine,
passée ou future, sans qu'il faille créer un plan au préalable.

Réversible : oui, ajouter une référence plus tard est trivial.

---

## [2026-07-27] Saisie du semainier en lots, avec mise à jour optimiste

Contexte : P1 et A2.13 — la saisie du semainier doit tenir en 60 secondes à
deux. Un aller-retour réseau par case rendrait ce budget intenable, et les
raccourcis modifient 7 ou 14 cases d'un coup.

Choix : l'écran tient l'état localement et l'affiche immédiatement ;
l'enregistrement part en arrière-plan, par lots. `saveAvailabilities()`
accepte un tableau et fait un seul `upsert`. Le compteur de dîners et de
bentos est recalculé côté client à chaque changement, à partir du même moteur
que le serveur (`lib/week/needs.ts`), donc sans divergence possible.

Limite assumée : en cas d'échec réseau, l'écran affiche une erreur mais
conserve l'affichage optimiste. Acceptable pour deux utilisateurs sur un
réseau domestique ; à revoir si l'usage au supermarché révèle des coupures.

Réversible : oui.

---

## [2026-07-27] Origine publique résolue explicitement, jamais depuis la requête

Contexte : la connexion Google renvoyait le navigateur sur
`http://0.0.0.0:3000`, injoignable. La route de callback construisait sa
redirection avec `request.nextUrl.origin`.

Cause : derrière le reverse proxy de Dokploy (Traefik), le serveur Next.js
écoute sur `0.0.0.0:3000` et ne connaît pas le nom de domaine par lequel on
l'atteint. `request.nextUrl.origin` et l'en-tête `Host` renvoient l'adresse
interne du conteneur, pas le domaine public.

Choix : un helper unique `resolvePublicOrigin()` (`lib/app-url.ts`) résout
l'origine dans cet ordre : variable `APP_URL`, puis en-têtes
`X-Forwarded-Host` / `X-Forwarded-Proto` posés par le proxy, puis `Host` pour
le développement local. `APP_URL` est renseignée en production : c'est le seul
moyen qui ne dépende d'aucune configuration de proxy. Un second helper,
`safeInternalPath()`, empêche une redirection ouverte vers un domaine tiers
via le paramètre `?suite=`.

Couvert par `tests/app-url.test.ts`, dont un cas vérifie explicitement que
`0.0.0.0` ne peut plus ressortir.

Réversible : oui.

---

## [2026-07-27] Version de npm épinglée dans le Dockerfile

Contexte : le build Dokploy a échoué deux fois sur `npm ci`, avec des paquets
`@emnapi` tantôt manquants, tantôt en version incompatible. Ces paquets sont
tirés par `@img/sharp-wasm32`, le repli WebAssembly de `sharp`, lui-même
dépendance optionnelle de Next.js.

Cause réelle : la machine de développement utilisait npm 11.6.2, l'image
`node:24-alpine` embarquait npm 11.16.0. Deux versions de npm ne résolvent
pas l'arbre des dépendances optionnelles à l'identique, et `npm ci` est
strict : il rejette un lockfile qui ne correspond pas exactement à sa propre
résolution. La première correction (régénérer le lockfile) ne traitait que le
symptôme — l'ajout d'une dépendance a suffi à le recasser.

Choix : la version de npm est épinglée dans le `Dockerfile` (`ARG
NPM_VERSION`), et le lockfile est régénéré avec cette même version via
`npx --yes npm@<version> install`. Le lockfile et le conteneur utilisent donc
toujours le même résolveur, y compris quand l'image de base évolue.

Alternatives écartées : remplacer `npm ci` par `npm install` dans le
Dockerfile — supprimerait l'erreur, mais aussi la reproductibilité du build,
qui est précisément ce qu'apporte le lockfile.

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

## [2026-07-27] Isolation par foyer : RLS Postgres, pas de filtre applicatif

Contexte : RG-63 et A1.12 exigent que les données d'un foyer soient
inaccessibles à un autre compte, « vérifié au niveau des données et pas
seulement de l'interface ».

Choix : chaque table porte une politique RLS adossée à une fonction
`current_household_id()` (SECURITY DEFINER) qui lit le rattachement du compte
dans `profiles`. Le code applicatif ne filtre **jamais** par `household_id` :
une requête forgée à la main ne franchit pas la frontière. La création du
foyer passe par une RPC atomique `create_household()` plutôt que par des
politiques d'insertion permissives sur `households` et `profiles`.

Vérification : test SQL en transaction annulée, deux foyers, impersonation du
rôle `authenticated`. Le compte A voit 1 foyer / 1 membre / 1 matériel, et
0 ligne du foyer B sur toutes les tables. Le référentiel commun reste lisible.

Réversible : oui, mais aucune raison de revenir en arrière.

---

## [2026-07-27] Clé API du modèle chiffrée dans Supabase Vault

Contexte : C4 — la clé est saisie par l'utilisateur, jamais en dur. Elle ne
doit pas être lisible en clair par simple lecture de table.

Choix : `set_household_ai_config()` stocke la clé dans Vault et ne conserve
dans `households` que l'identifiant du secret. L'écran de paramètres n'affiche
jamais la clé, seulement un état « enregistrée / non enregistrée », et
propose de la remplacer ou de la supprimer.

Vérification : après enregistrement, aucune occurrence de la clé en clair
dans `households` ; le déchiffrement n'aboutit que depuis un rôle privilégié.

Réversible : oui.

---

## [2026-07-27] Ordre des membres : colonne `position`, pas `created_at`

Contexte : les membres d'un foyer sont créés dans une seule transaction.
`now()` renvoyant l'heure de début de transaction, `created_at` est
rigoureusement identique pour tous. Constaté en recette : le deuxième membre
saisi s'affichait en premier, de façon non déterministe.

Choix : colonne `position` renseignée par l'ordre de saisie, plus un trigger
qui place en fin de liste tout membre ajouté après coup.

Réversible : oui.

---

## [2026-07-27] Le référentiel d'ingrédients est importé dès le lot 1

Contexte : le backlog place l'import au lot 3, mais le lot 1 doit livrer les
dégoûts alimentaires (`docs/07`, contenu du lot 1), qui référencent des
ingrédients. Sans référentiel, l'écran serait vide.

Choix : import des 170 entrées de `data/ingredients-seed.csv` au lot 1, avec
les contrôles d'intégrité prévus par `docs/08` (clés uniques, pas de ligne
à la fois périssable et staple, catégories et allergènes dans les listes
fermées, trois noms renseignés) : **aucune anomalie**. Le lot 3 conserve son
objet propre : l'écran d'inventaire, le tri par fréquence, la recherche et
l'ajout d'ingrédient personnalisé.

Réversible : sans objet.

---

## [2026-07-27] Placeholder `lang="fr"` sur `<html>`

Contexte : au lot 0, il n'existe encore aucune session utilisateur ni membre
connu, donc aucune langue réelle à appliquer.

Choix : `lang="fr"` en dur dans `app/layout.tsx` comme valeur par défaut
temporaire. Au lot 1, cet attribut devra être dérivé de la langue du membre
connecté (C1, A1.4, A1.5).

Réversible : oui, changement d'une ligne.
