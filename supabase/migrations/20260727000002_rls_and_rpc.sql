-- Lot 1 — Isolation des données par foyer (RG-63) et opérations métier.
--
-- Principe : aucune table n'est lisible sans passer par une politique qui
-- rattache la ligne au foyer du compte authentifié. L'interface n'a aucun
-- rôle dans cette isolation : même une requête forgée à la main ne peut pas
-- traverser la frontière entre deux foyers.

-- ---------------------------------------------------------------------------
-- Fonction d'ancrage : le foyer du compte courant
-- ---------------------------------------------------------------------------
-- security definer pour pouvoir lire public.profiles sans déclencher
-- récursivement la politique RLS de cette même table.

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where user_id = auth.uid();
$$;

revoke execute on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Activation de RLS
-- ---------------------------------------------------------------------------

alter table public.households          enable row level security;
alter table public.members             enable row level security;
alter table public.profiles            enable row level security;
alter table public.member_allergens    enable row level security;
alter table public.member_dislikes     enable row level security;
alter table public.household_equipment enable row level security;
alter table public.ingredients         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles : chacun ne voit que son propre rattachement
-- ---------------------------------------------------------------------------
-- Aucune politique d'écriture : le rattachement à un foyer passe
-- exclusivement par la fonction create_household() ci-dessous.

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

create policy households_select_own on public.households
  for select to authenticated
  using (id = public.current_household_id());

create policy households_update_own on public.households
  for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

create policy members_select_own on public.members
  for select to authenticated
  using (household_id = public.current_household_id());

create policy members_insert_own on public.members
  for insert to authenticated
  with check (household_id = public.current_household_id());

create policy members_update_own on public.members
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy members_delete_own on public.members
  for delete to authenticated
  using (household_id = public.current_household_id());

-- ---------------------------------------------------------------------------
-- member_allergens / member_dislikes : rattachés via le membre
-- ---------------------------------------------------------------------------

create policy member_allergens_all_own on public.member_allergens
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

create policy member_dislikes_all_own on public.member_dislikes
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

-- ---------------------------------------------------------------------------
-- household_equipment
-- ---------------------------------------------------------------------------

create policy household_equipment_all_own on public.household_equipment
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------------------------------------------------------------------------
-- ingredients
-- ---------------------------------------------------------------------------
-- Le référentiel commun (household_id null) est lisible par tous les comptes
-- authentifiés, mais modifiable par personne depuis l'application : il évolue
-- uniquement par migration. Les ingrédients personnalisés appartiennent au
-- foyer qui les a créés.

create policy ingredients_select_global_or_own on public.ingredients
  for select to authenticated
  using (household_id is null or household_id = public.current_household_id());

create policy ingredients_insert_own on public.ingredients
  for insert to authenticated
  with check (household_id = public.current_household_id());

create policy ingredients_update_own on public.ingredients
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy ingredients_delete_own on public.ingredients
  for delete to authenticated
  using (household_id = public.current_household_id());

-- ---------------------------------------------------------------------------
-- Création du foyer (parcours A2 / A3)
-- ---------------------------------------------------------------------------
-- Opération atomique : sans elle il faudrait ouvrir une politique d'insertion
-- permissive sur households et profiles, ce qui affaiblirait l'isolation.

create or replace function public.create_household(
  p_name text,
  p_goal household_goal,
  p_members jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
  v_member jsonb;
  v_member_id uuid;
  v_first_member uuid;
begin
  if v_user is null then
    raise exception 'Authentification requise';
  end if;

  if exists (
    select 1 from public.profiles
    where user_id = v_user and household_id is not null
  ) then
    raise exception 'Ce compte appartient déjà à un foyer';
  end if;

  if jsonb_array_length(p_members) < 1 then
    raise exception 'Un foyer doit compter au moins un membre';
  end if;

  insert into public.households (name, goal)
  values (p_name, p_goal)
  returning id into v_household;

  insert into public.profiles (user_id, household_id)
  values (v_user, v_household)
  on conflict (user_id) do update set household_id = excluded.household_id;

  for v_member in select * from jsonb_array_elements(p_members)
  loop
    insert into public.members (household_id, name, kind, locale)
    values (
      v_household,
      v_member ->> 'name',
      (v_member ->> 'kind')::member_kind,
      coalesce((v_member ->> 'locale')::app_locale, 'fr')
    )
    returning id into v_member_id;

    if v_first_member is null then
      v_first_member := v_member_id;
    end if;
  end loop;

  -- Le compte qui crée le foyer est rattaché au premier membre déclaré.
  update public.members set user_id = v_user where id = v_first_member;

  -- Matériel supposé présent partout (parcours A5).
  insert into public.household_equipment (household_id, equipment_key)
  select v_household, unnest(array['stove', 'pan', 'pot', 'microwave'])
  on conflict do nothing;

  return v_household;
end;
$$;

revoke execute on function public.create_household(text, household_goal, jsonb) from public;
grant execute on function public.create_household(text, household_goal, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Clé API du fournisseur d'IA (C4)
-- ---------------------------------------------------------------------------
-- La clé est chiffrée au repos par Supabase Vault. La table households ne
-- conserve que l'identifiant du secret : lire households ne donne jamais
-- accès à la clé en clair.

create or replace function public.set_household_ai_config(
  p_provider text,
  p_model text,
  p_api_key text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_household uuid := public.current_household_id();
  v_secret_id uuid;
begin
  if v_household is null then
    raise exception 'Aucun foyer rattaché à ce compte';
  end if;

  select ai_api_key_secret_id into v_secret_id
  from public.households where id = v_household;

  if p_api_key is not null and length(trim(p_api_key)) > 0 then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        p_api_key,
        'ai_api_key_' || v_household::text,
        'Clé API du fournisseur d''IA du foyer ' || v_household::text
      );
    else
      perform vault.update_secret(v_secret_id, p_api_key);
    end if;
  end if;

  update public.households
  set ai_provider = p_provider,
      ai_model = p_model,
      ai_api_key_secret_id = v_secret_id
  where id = v_household;
end;
$$;

revoke execute on function public.set_household_ai_config(text, text, text) from public;
grant execute on function public.set_household_ai_config(text, text, text) to authenticated;

-- Suppression de la clé sans toucher au reste de la configuration.
create or replace function public.clear_household_ai_key()
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_household uuid := public.current_household_id();
  v_secret_id uuid;
begin
  if v_household is null then
    raise exception 'Aucun foyer rattaché à ce compte';
  end if;

  select ai_api_key_secret_id into v_secret_id
  from public.households where id = v_household;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
    update public.households
    set ai_api_key_secret_id = null
    where id = v_household;
  end if;
end;
$$;

revoke execute on function public.clear_household_ai_key() from public;
grant execute on function public.clear_household_ai_key() to authenticated;
