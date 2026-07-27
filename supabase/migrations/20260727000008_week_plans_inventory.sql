-- Lot 3 — Plan de semaine et inventaire du frigo (RG-29 à RG-35).
--
-- RG-29 : l'inventaire n'est pas un stock vivant tenu à jour. C'est une
-- photo prise au moment de la génération, rattachée à une semaine. D'où le
-- rattachement à week_plans plutôt qu'au foyer.

create type week_plan_status as enum ('brouillon', 'valide', 'clos');

create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  -- Toujours un lundi, fuseau Asia/Tokyo (RG-10, C8, C9).
  week_start date not null,
  status week_plan_status not null default 'brouillon',
  -- Budget copié du foyer à la création, puis modifiable (docs/04) : il ne
  -- doit pas bouger rétroactivement si le foyer change d'objectif plus tard.
  points_budget integer check (points_budget > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (household_id, week_start),
  constraint week_plans_starts_on_monday
    check (extract(isodow from week_start) = 1)
);

create index week_plans_household_week_idx
  on public.week_plans (household_id, week_start desc);

create trigger week_plans_set_updated_at
  before update on public.week_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lignes d'inventaire
-- ---------------------------------------------------------------------------
-- Seuls les niveaux 1 à 3 sont stockés. L'absence de ligne vaut niveau 0
-- (RG-32 : « le niveau par défaut de tout périssable non touché est 0 »).
-- Un frigo réel compte quelques dizaines d'articles, pas 107 : inutile
-- d'écrire une ligne par ingrédient du référentiel.

create table public.inventory_items (
  week_plan_id uuid not null references public.week_plans(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  level smallint not null check (level between 1 and 3),
  primary key (week_plan_id, ingredient_id)
);

create index inventory_items_ingredient_idx
  on public.inventory_items (ingredient_id);

-- ---------------------------------------------------------------------------
-- Isolation par foyer (RG-63)
-- ---------------------------------------------------------------------------

alter table public.week_plans enable row level security;
alter table public.inventory_items enable row level security;

create policy week_plans_all_own on public.week_plans
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy inventory_items_all_own on public.inventory_items
  for all to authenticated
  using (
    exists (
      select 1 from public.week_plans p
      where p.id = week_plan_id and p.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.week_plans p
      where p.id = week_plan_id and p.household_id = public.current_household_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Ouverture d'un plan de semaine
-- ---------------------------------------------------------------------------
-- Renvoie le plan de la semaine, en le créant au besoin. Passe par une RPC
-- plutôt que par un insert applicatif : deux onglets ouverts en même temps
-- se disputeraient la création, et la contrainte d'unicité ferait échouer
-- l'un des deux.

create or replace function public.open_week_plan(p_week_start date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_plan uuid;
begin
  if v_household is null then
    raise exception 'Aucun foyer rattaché à ce compte';
  end if;

  if extract(isodow from p_week_start) <> 1 then
    raise exception 'Une semaine commence un lundi';
  end if;

  select id into v_plan
  from public.week_plans
  where household_id = v_household and week_start = p_week_start;

  if v_plan is not null then
    return v_plan;
  end if;

  insert into public.week_plans (household_id, week_start)
  values (v_household, p_week_start)
  on conflict (household_id, week_start) do update
    set week_start = excluded.week_start   -- no-op, pour récupérer l'id
  returning id into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.open_week_plan(date) from public, anon;
grant execute on function public.open_week_plan(date) to authenticated;

-- ---------------------------------------------------------------------------
-- Fréquence d'usage des ingrédients (RG-33)
-- ---------------------------------------------------------------------------
-- Nombre de semaines où le foyer a déclaré avoir cet ingrédient. Sert à
-- remonter en haut de l'inventaire ce que le foyer achète réellement, et à
-- faire descendre ce qu'il n'utilise jamais.
--
-- Vue plutôt que compteur dénormalisé : la source de vérité reste les
-- inventaires passés, il n'y a rien à maintenir en cohérence.

create or replace view public.ingredient_usage
with (security_invoker = true) as
select
  p.household_id,
  i.ingredient_id,
  count(*)::int as weeks_used
from public.inventory_items i
join public.week_plans p on p.id = i.week_plan_id
group by p.household_id, i.ingredient_id;
