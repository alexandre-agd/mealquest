-- Lot 1 — create_household() accepte désormais l'onboarding complet.
--
-- La version précédente ne créait que le foyer et les membres. Il fallait
-- ensuite écrire les allergies et le matériel par des requêtes séparées, ce
-- qui posait deux problèmes :
--
--   - non atomique : un échec en cours de route laissait un foyer à moitié
--     configuré, sans moyen simple de reprendre ;
--   - impossible de rattacher les allergies au bon membre. Les membres sont
--     créés dans la même transaction, donc created_at est identique pour
--     tous (now() renvoie l'heure de début de transaction) : aucun tri ne
--     permettait de retrouver l'ordre de saisie.
--
-- Les allergies voyagent maintenant avec chaque membre dans le même JSON.

drop function if exists public.create_household(text, household_goal, jsonb);

create or replace function public.create_household(
  p_name text,
  p_goal household_goal,
  p_members jsonb,      -- [{ name, kind, locale, allergens: [...] }]
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

    for v_allergen in
      select jsonb_array_elements_text(coalesce(v_member -> 'allergens', '[]'::jsonb))
    loop
      insert into public.member_allergens (member_id, allergen)
      values (v_member_id, v_allergen::allergen_family)
      on conflict do nothing;
    end loop;
  end loop;

  -- Le compte qui crée le foyer est rattaché au premier membre déclaré.
  update public.members set user_id = v_user where id = v_first_member;

  insert into public.household_equipment (household_id, equipment_key)
  select v_household, unnest(
    case
      when p_equipment is null or array_length(p_equipment, 1) is null
        then array['stove', 'pan', 'pot', 'microwave']   -- parcours A5
      else p_equipment
    end
  )
  on conflict do nothing;

  return v_household;
end;
$$;

revoke all on function public.create_household(text, household_goal, jsonb, text[]) from public, anon;
grant execute on function public.create_household(text, household_goal, jsonb, text[]) to authenticated;
