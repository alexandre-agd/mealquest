// Configuration Supabase lue au **runtime**, côté serveur uniquement.
//
// Pourquoi pas NEXT_PUBLIC_* : Next.js remplace en dur les variables
// préfixées NEXT_PUBLIC_ par leur valeur littérale au moment du `next build`.
// Dans une image Docker, ça fige la configuration dans l'image : il faut
// reconstruire pour changer une URL, et si la variable manque au build elle
// est inlinée à chaîne vide (le conteneur démarre alors avec une config
// vide, même si l'hébergeur fournit bien la variable au runtime).
//
// Les variables sans préfixe sont lues normalement au runtime côté serveur.
// La valeur est ensuite transmise au navigateur explicitement quand c'est
// nécessaire (voir SupabaseProvider), jamais par inlining au build.

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase manquante : SUPABASE_URL et SUPABASE_ANON_KEY " +
        "doivent être définies dans l'environnement du serveur.",
    );
  }

  return { url, anonKey };
}
