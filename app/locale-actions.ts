"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n/server";

/**
 * Change la langue d'affichage.
 *
 * Connecté : la langue est enregistrée sur le membre, elle suit donc le
 * compte d'un appareil à l'autre et n'affecte aucun autre membre du foyer
 * (C1, A1.4, A1.5). Non connecté : simple cookie, le temps d'arriver sur
 * l'écran de connexion dans la bonne langue.
 */
export async function setLocale(formData: FormData) {
  const value = String(formData.get("locale") ?? "");
  if (!isLocale(value)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("members").update({ locale: value }).eq("user_id", user.id);
  }

  revalidatePath("/", "layout");
}
