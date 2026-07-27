import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseConfig } from "./config";

// La configuration est passée explicitement en argument, et non lue depuis
// process.env : côté navigateur, seules les variables NEXT_PUBLIC_* seraient
// disponibles, et celles-ci sont figées dans l'image au moment du build
// (voir le commentaire détaillé dans ./config.ts).
//
// Un composant serveur lit la configuration au runtime et la transmet aux
// composants client. Le wiring complet (provider React) arrive au lot 1,
// avec le premier écran d'authentification.
export function createClient({ url, anonKey }: SupabaseConfig) {
  return createBrowserClient(url, anonKey);
}
