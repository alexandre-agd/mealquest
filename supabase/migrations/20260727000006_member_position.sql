-- Lot 1 — Ordre d'affichage stable des membres.
--
-- Les membres d'un foyer sont créés dans la même transaction : now() renvoie
-- l'heure de début de transaction, donc created_at est rigoureusement
-- identique pour tous. Trier dessus donnait un ordre arbitraire, qui pouvait
-- même changer d'un affichage à l'autre. Constaté en recette : le second
-- membre saisi apparaissait en premier.

alter table public.members
  add column position smallint not null default 0;

create index members_household_position_idx
  on public.members (household_id, position, created_at);

-- Renumérotation des foyers existants, dans leur ordre actuel.
with numerotes as (
  select id, row_number() over (partition by household_id order by created_at, id) - 1 as rang
  from public.members
)
update public.members m
set position = numerotes.rang
from numerotes
where m.id = numerotes.id;

-- create_household() renseigne désormais la position à partir de l'ordre de
-- saisie du tableau JSON.
create or replace function public.create_household(
  p_name text,
  p_goal household_goal,
  p_members jsonb,
  p_equipment text[]
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
  v_allergen text;
  v_position smallint := 0;
begin
  if v_user is null then
    raise exception 'Authentification requise';
  end if;

  if exists (
    select 1 from public.profiles
    where user_id = v_user and household_id is not null
  ) then
    raise exception 'Ce compte appartient deja a un foyer';
  end if;

  if p_members is null or jsonb_array_length(p_members) < 1 then
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
    insert into public.members (household_id, name, kind, locale, position)
    values (
      v_household,
      v_member ->> 'name',
      (v_member ->> 'kind')::member_kind,
      coalesce((v_member ->> 'locale')::app_locale, 'fr'),
      v_position
    )
    returning id into v_member_id;

    if v_first_member is null then
      v_first_member := v_member_id;
    end if;

    for v_allergen in
      select jsonb_array_elements_text(coalesce(v_member -> 'allergens', '[]'::jsonb))
    loop
      insert into public.member_allergens (member_id, allergen)
      values (v_member_id, v_allergen::allergen_family)
      on conflict do nothing;
    end loop;

    v_position := v_position + 1;
  end loop;

  update public.members set user_id = v_user where id = v_first_member;

  insert into public.household_equipment (household_id, equipment_key)
  select v_household, unnest(
    case
      when p_equipment is null or array_length(p_equipment, 1) is null
        then array['stove', 'pan', 'pot', 'microwave']
      else p_equipment
    end
  )
  on conflict do nothing;

  return v_household;
end;
$$;

revoke all on function public.create_household(text, household_goal, jsonb, text[]) from public, anon;
grant execute on function public.create_household(text, household_goal, jsonb, text[]) to authenticated;

-- Un membre ajouté après coup se place en fin de liste.
create or replace function public.set_member_position()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.position = 0 then
    select coalesce(max(position) + 1, 0) into new.position
    from public.members where household_id = new.household_id;
  end if;
  return new;
end;
$$;

revoke all on function public.set_member_position() from public, anon, authenticated;

create trigger members_set_position
  before insert on public.members
  for each row execute function public.set_member_position();
