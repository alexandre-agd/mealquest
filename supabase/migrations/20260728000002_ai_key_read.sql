-- Lot 4a — Lecture de la clé IA, réservée au serveur.
--
-- La clé du fournisseur d'IA est chiffrée dans Vault depuis le lot 1. Le lot 4
-- doit maintenant la relire pour appeler le modèle. La question est : qui a le
-- droit de la déchiffrer ?
--
-- Choix : **personne côté navigateur**. La fonction ci-dessous n'est accordée
-- qu'au rôle `service_role`, utilisé uniquement par le serveur Next.js avec
-- une clé qui ne quitte jamais l'hébergeur. Concrètement :
--
--   - un appel à /rest/v1/rpc/get_household_ai_key avec la clé publishable
--     échoue, même authentifié ;
--   - une faille XSS dans l'interface ne permet pas d'exfiltrer la clé ;
--   - la table households ne contient que l'identifiant du secret, jamais
--     la clé elle-même.
--
-- Le foyer est passé en argument plutôt que déduit de auth.uid() : le rôle
-- service_role n'a pas de session utilisateur. C'est au code serveur de
-- déterminer le foyer du compte connecté avant d'appeler cette fonction.

create or replace function public.get_household_ai_key(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_key text;
begin
  select ai_api_key_secret_id into v_secret_id
  from public.households
  where id = p_household_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_key;
end;
$$;

revoke all on function public.get_household_ai_key(uuid)
  from public, anon, authenticated;
grant execute on function public.get_household_ai_key(uuid) to service_role;
