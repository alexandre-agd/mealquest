import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  defaultLocale,
  getDictionary,
  isLocale,
  type Dictionary,
  type Locale,
} from "./dictionaries";

// Cookie utilisé uniquement avant la connexion (écrans de login et
// d'inscription). Une fois le compte relié à un membre, c'est la colonne
// members.locale qui fait foi : chaque membre du foyer voit l'application
// dans sa propre langue, indépendamment de l'autre (C1, A1.4, A1.5).
export const LOCALE_COOKIE = "mq_locale";

export async function getCurrentLocale(): Promise<Locale> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("members")
        .select("locale")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data && isLocale(data.locale)) {
        return data.locale;
      }
    }
  } catch {
    // Base injoignable : on retombe sur le cookie puis sur le français.
    // L'application doit rester affichable même dégradée (P3).
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : defaultLocale;
}

export async function getCurrentDictionary(): Promise<{
  locale: Locale;
  t: Dictionary;
}> {
  const locale = await getCurrentLocale();
  return { locale, t: getDictionary(locale) };
}
