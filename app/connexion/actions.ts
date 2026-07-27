"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

// Clés de traduction plutôt que messages en dur : l'écran affiche le texte
// dans la langue du visiteur (A1.11).
const ERROR_INVALID = "auth.error_invalid_credentials";
const ERROR_EMAIL_TAKEN = "auth.error_email_taken";
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

  redirect(next.startsWith("/") ? next : "/");
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
    return {
      error: error.message.toLowerCase().includes("already")
        ? ERROR_EMAIL_TAKEN
        : ERROR_GENERIC,
    };
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

  // L'origine est déduite de la requête : la même image Docker fonctionne
  // en local et derrière le nom de domaine, sans variable supplémentaire.
  const origin =
    headerList.get("origin") ??
    `https://${headerList.get("host") ?? "localhost:3000"}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/connexion?erreur=oauth");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
