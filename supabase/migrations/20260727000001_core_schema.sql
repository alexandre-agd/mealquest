-- Lot 1 — Schéma de base : foyer, membres, référentiel d'ingrédients.
--
-- Toutes les données métier sont rattachées à un foyer (docs/04, RG-63).
-- L'isolation entre foyers est assurée par RLS (migration 000002), pas par
-- le code applicatif.

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

create type member_kind as enum ('adulte', 'enfant');           -- RG-03
create type app_locale as enum ('fr', 'ja');                    -- C1
create type household_goal as enum ('leger', 'equilibre', 'gourmand'); -- RG-08

-- Classification japonaise des allergènes (docs/08).
create type allergen_family as enum (
  'egg', 'milk', 'wheat', 'buckwheat', 'peanut', 'shrimp',
  'crab', 'soy', 'sesame', 'nuts', 'fish'
);

-- Rayons, dans l'ordre du parcours en magasin (RG-48).
create type ingredient_category as enum (
  'vegetables', 'fruits', 'fish', 'meat', 'dairy_eggs', 'soy',
  'frozen', 'dry_goods', 'condiments', 'drinks', 'other'
);

create type ingredient_unit as enum ('g', 'ml', 'piece', 'bunch', 'pack');

-- ---------------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Foyer
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  goal household_goal not null default 'equilibre',
  -- Le budget est normalement calculé (RG-08, RG-09) ; cette colonne permet
  -- de le surcharger manuellement (docs/04).
  points_budget_override integer check (points_budget_override > 0),
  timezone text not null default 'Asia/Tokyo',                  -- C8
  -- Configuration IA (C3, C4). La clé elle-même n'est jamais stockée ici :
  -- seul l'identifiant du secret Vault l'est.
  ai_provider text,
  ai_model text,
  ai_api_key_secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membres
-- ---------------------------------------------------------------------------

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind member_kind not null,
  locale app_locale not null default 'fr',
  -- Un membre peut ne pas avoir de compte de connexion (RG-04).
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_household_id_idx on public.members (household_id);

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rattachement compte -> foyer
-- ---------------------------------------------------------------------------
-- Un compte appartient à exactement un foyer (RG-01). Cette table est le
-- point d'ancrage de toutes les politiques RLS : elle seule fait le lien
-- entre auth.uid() et un household_id.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  created_at timestamptz not null default now()
);

create index profiles_household_id_idx on public.profiles (household_id);

-- Chaque nouvel utilisateur reçoit un profil vide ; le foyer est rattaché
-- plus tard, à l'onboarding.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Allergies (bloquantes, RG-05) et dégoûts (indicatifs, RG-06)
-- ---------------------------------------------------------------------------

create table public.member_allergens (
  member_id uuid not null references public.members(id) on delete cascade,
  allergen allergen_family not null,
  primary key (member_id, allergen)
);

-- ---------------------------------------------------------------------------
-- Référentiel d'ingrédients
-- ---------------------------------------------------------------------------
-- household_id null  = entrée du référentiel commun, visible par tous
-- household_id défini = ingrédient personnalisé, visible du seul foyer
-- L'IA choisit toujours une clé existante, elle n'en invente jamais (P2).

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9_]+$'),
  name_fr text not null,
  name_ja text not null,
  name_en text not null,
  category ingredient_category not null,
  default_unit ingredient_unit not null,
  perishable boolean not null default false,
  staple boolean not null default false,
  allergen allergen_family,
  typical_pack numeric,
  household_id uuid references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Un ingrédient ne peut pas être à la fois périssable et staple (docs/08).
  constraint ingredients_perishable_xor_staple
    check (not (perishable and staple))
);

create unique index ingredients_global_key_idx
  on public.ingredients (key) where household_id is null;

create unique index ingredients_household_key_idx
  on public.ingredients (household_id, key) where household_id is not null;

create index ingredients_category_idx on public.ingredients (category);
create index ingredients_perishable_idx on public.ingredients (perishable);

create table public.member_dislikes (
  member_id uuid not null references public.members(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  primary key (member_id, ingredient_id)
);

-- ---------------------------------------------------------------------------
-- Matériel de cuisine (RG-07)
-- ---------------------------------------------------------------------------
-- La liste des clés possibles et leurs libellés FR/JA vivent dans les
-- fichiers de traduction, pas en base (aucun texte en dur, A1.11).

create table public.household_equipment (
  household_id uuid not null references public.households(id) on delete cascade,
  equipment_key text not null,
  primary key (household_id, equipment_key)
);
