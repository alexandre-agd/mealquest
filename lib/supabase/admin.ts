import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * Client Supabase à privilèges élevés, réservé au serveur.
 *
 * Il court-circuite RLS : à n'utiliser que pour les opérations qui ne peuvent
 * pas passer par la session de l'utilisateur, et toujours après avoir vérifié
 * soi-même à quel foyer appartient le compte connecté.
 *
 * Aujourd'hui, un seul usage : relire la clé du fournisseur d'IA, que
 * personne ne doit pouvoir déchiffrer depuis le navigateur.
 *
 * La clé de service ne porte volontairement pas le préfixe NEXT_PUBLIC_ :
 * elle ne doit jamais partir dans le bundle envoyé au navigateur.
 */
export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY est absente de l'environnement du serveur. " +
        "Elle est nécessaire pour lire la clé du fournisseur d'IA.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Le client de service est-il configuré ? Sert à afficher un mode dégradé. */
export function hasAdminClient(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Clé du fournisseur d'IA du foyer, en clair.
 *
 * Ne jamais renvoyer cette valeur à un composant client, ni la journaliser.
 */
export async function readHouseholdAiKey(
  householdId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_household_ai_key", {
    p_household_id: householdId,
  });

  if (error) {
    console.error("[ia] lecture de la clé impossible :", error.message);
    return null;
  }

  return (data as string | null) ?? null;
}
