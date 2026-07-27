-- Lot 4b — Cartes-recettes et affectation au planning (RG-20 à RG-28, RG-43).

create type card_type as enum ('standard', 'lunch_solo', 'waouh');
create type card_origin as enum ('generee', 'manuelle', 'rappelee');
create type card_status as enum ('proposee', 'planifiee', 'cuisinee', 'abandonnee');
create type verso_form as enum ('restes', 'transforme', 'express');
create type cuisine_kind as enum (
  'japonaise', 'francaise', 'italienne', 'chinoise', 'coreenne',
  'thailandaise', 'indienne', 'mexicaine', 'americaine',
  'mediterraneenne', 'autre'
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- Rattachement au booster qui l'a produite : sert à retrouver la main.
  week_plan_id uuid references public.week_plans(id) on delete set null,

  type card_type not null,
  cuisine cuisine_kind not null,
  points smallint not null check (points between 1 and 5),
  stars smallint not null check (stars between 1 and 3),
  prep_minutes smallint not null check (prep_minutes > 0),
  reference_portions smallint not null check (reference_portions > 0),

  -- Les deux langues vivent côte à côte : ce n'est pas de la traduction à la
  -- volée, chaque version est écrite pour elle-même (RG-26, P5).
  title_fr text not null,
  title_ja text not null,
  description_fr text not null,
  description_ja text not null,
  steps_fr jsonb not null,
  steps_ja jsonb not null,

  origin card_origin not null default 'generee',
  status card_status not null default 'proposee',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Une carte standard a toujours un verso, les autres jamais (RG-20).
  constraint cards_steps_same_length
    check (jsonb_array_length(steps_fr) = jsonb_array_length(steps_ja))
);

create index cards_household_idx on public.cards (household_id, created_at desc);
create index cards_week_plan_idx on public.cards (week_plan_id);
create index cards_status_idx on public.cards (household_id, status);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Verso : la déclinaison bento du lendemain (RG-21)
-- ---------------------------------------------------------------------------

create table public.card_versos (
  card_id uuid primary key references public.cards(id) on delete cascade,
  form verso_form not null,
  title_fr text not null,
  title_ja text not null,
  steps_fr jsonb not null,
  steps_ja jsonb not null,
  extra_minutes smallint not null default 0 check (extra_minutes >= 0),
  -- Calculé par le code, jamais repris du modèle (RG-23).
  points smallint not null check (points between 1 and 5),

  constraint versos_steps_same_length
    check (jsonb_array_length(steps_fr) = jsonb_array_length(steps_ja))
);

-- ---------------------------------------------------------------------------
-- Ingrédients et matériel d'une carte
-- ---------------------------------------------------------------------------

create table public.card_ingredients (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit ingredient_unit not null,
  -- true : ingrédient du verso, pas de la recette principale.
  for_verso boolean not null default false,
  unique (card_id, ingredient_id, for_verso)
);

create index card_ingredients_card_idx on public.card_ingredients (card_id);

create table public.card_equipment (
  card_id uuid not null references public.cards(id) on delete cascade,
  equipment_key text not null,
  primary key (card_id, equipment_key)
);

-- ---------------------------------------------------------------------------
-- Créneaux planifiés (docs/04, RG-43 à RG-46)
-- ---------------------------------------------------------------------------
-- Un créneau porte soit une carte, soit son verso, soit une carte neutre
-- (RG-28). Les cartes neutres ne sont pas des lignes de `cards` : elles ne
-- portent ni recette ni ingrédient, seulement des points.

create type neutral_card as enum ('restaurant', 'libre', 'restes');
create type slot_status as enum ('prevu', 'cuisine', 'abandonne');

create table public.planned_slots (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references public.week_plans(id) on delete cascade,
  date date not null,
  slot meal_slot not null,

  card_id uuid references public.cards(id) on delete cascade,
  -- true : c'est le verso de la carte qui occupe ce créneau, pas le recto.
  is_verso boolean not null default false,
  neutral neutral_card,

  portions smallint not null check (portions > 0),
  points smallint not null check (points >= 0),
  status slot_status not null default 'prevu',

  created_at timestamptz not null default now(),

  unique (week_plan_id, date, slot),

  -- Une carte ou une carte neutre, jamais les deux, jamais aucune.
  constraint planned_slots_one_content
    check ((card_id is not null) <> (neutral is not null)),
  -- Un verso ne peut venir que d'une carte.
  constraint planned_slots_verso_needs_card
    check (not is_verso or card_id is not null)
);

create index planned_slots_plan_idx on public.planned_slots (week_plan_id, date);

-- ---------------------------------------------------------------------------
-- Isolation par foyer (RG-63)
-- ---------------------------------------------------------------------------

alter table public.cards enable row level security;
alter table public.card_versos enable row level security;
alter table public.card_ingredients enable row level security;
alter table public.card_equipment enable row level security;
alter table public.planned_slots enable row level security;

create policy cards_all_own on public.cards
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy card_versos_all_own on public.card_versos
  for all to authenticated
  using (exists (select 1 from public.cards c
                 where c.id = card_id and c.household_id = public.current_household_id()))
  with check (exists (select 1 from public.cards c
                      where c.id = card_id and c.household_id = public.current_household_id()));

create policy card_ingredients_all_own on public.card_ingredients
  for all to authenticated
  using (exists (select 1 from public.cards c
                 where c.id = card_id and c.household_id = public.current_household_id()))
  with check (exists (select 1 from public.cards c
                      where c.id = card_id and c.household_id = public.current_household_id()));

create policy card_equipment_all_own on public.card_equipment
  for all to authenticated
  using (exists (select 1 from public.cards c
                 where c.id = card_id and c.household_id = public.current_household_id()))
  with check (exists (select 1 from public.cards c
                      where c.id = card_id and c.household_id = public.current_household_id()));

create policy planned_slots_all_own on public.planned_slots
  for all to authenticated
  using (exists (select 1 from public.week_plans p
                 where p.id = week_plan_id and p.household_id = public.current_household_id()))
  with check (exists (select 1 from public.week_plans p
                      where p.id = week_plan_id and p.household_id = public.current_household_id()));

-- ---------------------------------------------------------------------------
-- Traces de génération (docs/05, §9)
-- ---------------------------------------------------------------------------
-- Sans trace, calibrer les prompts revient à deviner. On conserve le contexte
-- envoyé, la sortie brute et le résultat de validation. Aucune donnée
-- personnelle superflue : ni e-mail, ni prénom, ni clé.

create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_plan_id uuid references public.week_plans(id) on delete set null,
  prompt_version text not null,
  provider text,
  model text,
  attempt smallint not null,
  raw_response text,
  accepted_count smallint not null default 0,
  rejections jsonb not null default '[]'::jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index generation_logs_household_idx
  on public.generation_logs (household_id, created_at desc);

alter table public.generation_logs enable row level security;

create policy generation_logs_own on public.generation_logs
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
