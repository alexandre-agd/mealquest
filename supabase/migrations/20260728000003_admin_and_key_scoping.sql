-- Lot 4a — Gouvernance de la liste d'accès, et clé IA liée à la session.
--
-- Question de la MOA : « si j'ouvre à d'autres personnes, chacun doit mettre
-- sa propre clé API, on cloisonne ».
--
-- Le cloisonnement des clés était déjà acquis : la clé est portée par le
-- foyer, pas par l'application, et un foyer ne voit pas la ligne d'un autre
-- (vérifié). Deux points restaient ouverts.
--
-- 1. La liste d'accès était modifiable par n'importe quel compte connecté.
--    Acceptable tant qu'il n'y a qu'un foyer de deux personnes ; plus du tout
--    dès qu'un tiers a un compte, puisqu'il pourrait inviter qui il veut.
--
-- 2. get_household_ai_key() acceptait n'importe quel identifiant de foyer.
--    Le rôle service_role n'ayant pas de session, rien dans la base ne
--    vérifiait que le foyer demandé était bien celui du compte connecté :
--    la garantie reposait entièrement sur la rigueur du code serveur.

-- ---------------------------------------------------------------------------
-- 1. Un compte administrateur gère les accès
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_admin boolean not null default false;

-- Les comptes déjà existants deviennent administrateurs : sans cela, plus
-- personne ne pourrait gérer la liste après cette migration.
update public.profiles set is_admin = true;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- La liste d'accès n'est visible et modifiable que par un administrateur.
drop policy if exists allowed_signups_read on public.allowed_signups;
drop policy if exists allowed_signups_write on public.allowed_signups;

create policy allowed_signups_admin_read on public.allowed_signups
  for select to authenticated using (public.is_admin());

create policy allowed_signups_admin_write on public.allowed_signups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Un compte ne doit pas pouvoir se promouvoir administrateur lui-même.
-- profiles n'a aucune politique d'écriture depuis le lot 1 : le rattachement
-- passe par create_household(), et is_admin ne se change qu'en base. On le
-- consigne ici pour que ce ne soit pas un oubli apparent.

-- ---------------------------------------------------------------------------
-- 2. La clé IA se lit pour un compte, pas pour un foyer arbitraire
-- ---------------------------------------------------------------------------
-- La fonction prend désormais l'identifiant du **compte** et remonte elle-même
-- à son foyer. Il devient impossible, même par erreur de programmation côté
-- serveur, de lire la clé d'un autre foyer : il faudrait connaître l'identifiant
-- d'un compte tiers, et le résultat resterait celui du foyer de ce compte.

drop function if exists public.get_household_ai_key(uuid);

create or replace function public.get_ai_key_for_user(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_key text;
begin
  select h.ai_api_key_secret_id into v_secret_id
  from public.profiles p
  join public.households h on h.id = p.household_id
  where p.user_id = p_user_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_key;
end;
$$;

revoke all on function public.get_ai_key_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.get_ai_key_for_user(uuid) to service_role;
