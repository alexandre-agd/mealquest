-- Lot 2 — Disponibilités du semainier (RG-10 à RG-14).
--
-- Une ligne = un membre, une date, un créneau. La date est de type `date`,
-- sans heure : une case du semainier est un jour de calendrier, pas un
-- instant. Stocker un timestamp obligerait à reconvertir en Asia/Tokyo à
-- chaque lecture, avec le risque que le repas glisse d'un jour (C8).

create type meal_slot as enum ('midi', 'soir');

create type availability_status as enum (
  'maison',      -- mange à la maison, repas à préparer      -> besoin
  'bento',       -- mange dehors, emporte un repas préparé   -> besoin
  'exterieur',   -- mange dehors, rien à préparer            -> pas de besoin
  'libre'        -- se débrouille, restes, improvisation     -> pas de besoin
);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  slot meal_slot not null,
  status availability_status not null,
  updated_at timestamptz not null default now(),

  -- Un même membre n'a qu'un statut par créneau.
  unique (member_id, date, slot),

  -- RG-12 : le bento n'est proposé qu'au déjeuner. La règle est dans la
  -- base, pas seulement dans l'interface : elle doit tenir même si une
  -- requête est forgée à la main.
  constraint availabilities_bento_only_at_lunch
    check (not (slot = 'soir' and status = 'bento'))
);

create index availabilities_member_date_idx
  on public.availabilities (member_id, date);

create index availabilities_date_idx on public.availabilities (date);

create trigger availabilities_set_updated_at
  before update on public.availabilities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Isolation par foyer, via le membre (RG-63)
-- ---------------------------------------------------------------------------
-- Même approche que member_allergens : pas de household_id dupliqué ici, donc
-- aucun risque qu'il diverge de celui du membre.

alter table public.availabilities enable row level security;

create policy availabilities_all_own on public.availabilities
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = member_id and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = member_id and m.household_id = public.current_household_id()
    )
  );
