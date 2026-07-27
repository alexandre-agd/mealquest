import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { createClient as createServerClient } from "./server";

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
 * Clé du fournisseur d'IA du compte connecté, en clair.
 *
 * Le foyer n'est pas un paramètre : la fonction lit la session, et la base
 * remonte elle-même du compte à son foyer. Chaque espace utilise donc sa
 * propre clé, et aucune erreur de programmation ici ne peut faire lire la
 * clé d'un autre foyer.
 *
 * Ne jamais renvoyer cette valeur à un composant client, ni la journaliser.
 */
export async function readAiKeyForCurrentUser(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_ai_key_for_user", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("[ia] lecture de la clé impossible :", error.message);
    return null;
  }

  return (data as string | null) ?? null;
}
