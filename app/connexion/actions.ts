"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolvePublicOrigin, safeInternalPath } from "@/lib/app-url";

export type AuthState = { error?: string; info?: string };

// Clés de traduction plutôt que messages en dur : l'écran affiche le texte
// dans la langue du visiteur (A1.11).
const ERROR_INVALID = "auth.error_invalid_credentials";
const ERROR_EMAIL_TAKEN = "auth.error_email_taken";
const ERROR_NOT_ALLOWED = "auth.error_not_allowed";
const ERROR_GENERIC = "common.error_generic";
const INFO_CONFIRM_EMAIL = "auth.confirm_email";

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("suite") ?? "/");

  if (!email || !password) {
    return { error: ERROR_INVALID };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: ERROR_INVALID };
  }

  redirect(safeInternalPath(next));
}

export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    return { error: ERROR_GENERIC };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const message = error.message.toLowerCase();

    // Le trigger de liste d'accès remonte comme une erreur de base côté
    // GoTrue : sans ce traitement, l'utilisateur verrait « Database error »
    // et ne saurait pas que le problème est une autorisation manquante.
    if (
      message.includes("database error") ||
      message.includes("autoris") ||
      message.includes("not allowed")
    ) {
      return { error: ERROR_NOT_ALLOWED };
    }

    return { error: message.includes("already") ? ERROR_EMAIL_TAKEN : ERROR_GENERIC };
  }

  // Si la confirmation par e-mail est active, aucune session n'est ouverte
  // tout de suite : on le dit clairement plutôt que de laisser l'écran figé.
  if (!data.session) {
    return { info: INFO_CONFIRM_EMAIL };
  }

  redirect("/");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headerList = await headers();

  // Doit désigner le domaine public, pas l'adresse d'écoute du conteneur :
  // Supabase renverra le navigateur sur cette URL (voir lib/app-url.ts).
  const origin = resolvePublicOrigin(headerList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    console.error(
      "[auth] démarrage OAuth impossible :",
      error?.message,
      "| origine calculée :",
      origin,
    );
    redirect("/connexion?erreur=oauth");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
