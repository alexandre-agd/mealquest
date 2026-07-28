-- Lot 5 — Liste de courses (RG-47 à RG-52).
--
-- La liste elle-même n'est pas stockée : elle se recalcule à partir des
-- cartes posées et de l'inventaire. Ainsi elle reste juste quand on retire
-- une carte, sans qu'aucune synchronisation ne soit à maintenir.
--
-- Seuls sont persistés l'état coché et les lignes ajoutées à la main, qui ne
-- se déduisent d'aucun calcul.

create table public.shopping_checks (
  week_plan_id uuid not null references public.week_plans(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (week_plan_id, ingredient_id)
);

-- RG-51 : on ajoute ce qu'on veut à la liste, sans lien avec les recettes.
create table public.shopping_free_lines (
  id uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references public.week_plans(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

create index shopping_free_lines_plan_idx
  on public.shopping_free_lines (week_plan_id, created_at);

alter table public.shopping_checks enable row level security;
alter table public.shopping_free_lines enable row level security;

create policy shopping_checks_own on public.shopping_checks
  for all to authenticated
  using (exists (select 1 from public.week_plans p
                 where p.id = week_plan_id and p.household_id = public.current_household_id()))
  with check (exists (select 1 from public.week_plans p
                      where p.id = week_plan_id and p.household_id = public.current_household_id()));

create policy shopping_free_lines_own on public.shopping_free_lines
  for all to authenticated
  using (exists (select 1 from public.week_plans p
                 where p.id = week_plan_id and p.household_id = public.current_household_id()))
  with check (exists (select 1 from public.week_plans p
                      where p.id = week_plan_id and p.household_id = public.current_household_id()));

-- RG-50 : l'état coché se partage entre les membres du foyer. Realtime
-- diffuse les changements aux autres appareils ; à défaut de réseau, la
-- synchronisation se fera au prochain chargement.
alter publication supabase_realtime add table public.shopping_checks;
alter publication supabase_realtime add table public.shopping_free_lines;
