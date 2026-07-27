-- Lot 1 — Durcissement des fonctions, suite au linter de sécurité Supabase.
--
-- Deux problèmes relevés :
--
-- 1. Supabase accorde EXECUTE aux rôles `anon` et `authenticated` de façon
--    explicite, pas via le rôle PUBLIC. Un `revoke ... from public` ne
--    suffit donc pas : toutes les fonctions restaient appelables sans être
--    connecté, via /rest/v1/rpc/<nom>.
--
-- 2. Les fonctions de trigger n'ont aucune raison d'être exposées dans l'API
--    REST, et set_updated_at n'avait pas de search_path figé (une fonction
--    sans search_path explicite peut être détournée par un schéma
--    positionné en amont du chemin de recherche).

-- ---------------------------------------------------------------------------
-- Fonctions de trigger : jamais appelables depuis l'API
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- `revoke ... from public` est indispensable en plus : Postgres accorde
-- EXECUTE au rôle PUBLIC à la création d'une fonction, et anon en hérite.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions métier : réservées aux comptes connectés
-- ---------------------------------------------------------------------------

revoke all on function public.current_household_id() from anon;
revoke all on function public.create_household(text, household_goal, jsonb) from anon;
revoke all on function public.set_household_ai_config(text, text, text) from anon;
revoke all on function public.clear_household_ai_key() from anon;

grant execute on function public.current_household_id() to authenticated;
grant execute on function public.create_household(text, household_goal, jsonb) to authenticated;
grant execute on function public.set_household_ai_config(text, text, text) to authenticated;
grant execute on function public.clear_household_ai_key() to authenticated;
