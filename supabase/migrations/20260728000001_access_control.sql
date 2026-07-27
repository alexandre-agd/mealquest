-- Lot 4a — Application strictement privée : liste d'accès nominative.
--
-- Demande explicite de la MOA : seuls les membres du foyer doivent pouvoir
-- se connecter. Sans ce garde-fou, n'importe qui connaissant l'adresse du
-- site pouvait créer un compte, puisque MealQuest est exposée sur Internet.
--
-- Le contrôle est posé dans la base, pas dans l'interface : il s'applique
-- aussi bien à l'inscription par mot de passe qu'à la connexion Google, et
-- même à un appel direct de l'API d'authentification. C'est la seule façon
-- de le rendre réellement contraignant.

create table public.allowed_signups (
  -- Stocké en minuscules : les adresses e-mail ne sont pas sensibles à la
  -- casse, et Google renvoie parfois une capitalisation différente.
  email text primary key check (position('@' in email) > 1),
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_signups enable row level security;

-- Application privée à deux personnes : tout compte déjà autorisé peut
-- gérer la liste. À revoir si le multi-foyer se concrétise un jour (C7) :
-- il faudrait alors rattacher l'autorisation à un foyer précis.
create policy allowed_signups_read on public.allowed_signups
  for select to authenticated using (true);

create policy allowed_signups_write on public.allowed_signups
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Le verrou
-- ---------------------------------------------------------------------------

create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_signups
    where email = lower(trim(new.email))
  ) then
    -- Message volontairement neutre : il ne dit pas si l'adresse existe
    -- déjà, seulement qu'elle n'est pas autorisée.
    raise exception 'Cette adresse n''est pas autorisée à créer un compte'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_signup_allowlist() from public, anon, authenticated;

create trigger enforce_signup_allowlist_trigger
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- ---------------------------------------------------------------------------
-- Amorçage
-- ---------------------------------------------------------------------------
-- Les comptes déjà créés sont autorisés d'office : le trigger ne s'applique
-- qu'aux nouvelles insertions, mais les lister évite qu'un compte existant
-- se retrouve bloqué s'il devait être recréé.

insert into public.allowed_signups (email, note)
select lower(trim(email)), 'Compte existant au moment de la mise en place'
from auth.users
on conflict (email) do nothing;
