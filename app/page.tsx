import { getDictionary, locales } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();
    // "Auth session missing" est attendu tant que personne n'est connecté :
    // ça prouve que la requête a bien atteint le projet Supabase.
    return !error || error.name === "AuthSessionMissingError";
  } catch {
    return false;
  }
}

export default async function Home() {
  const supabaseOk = await checkSupabaseConnection();

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold">MealQuest</h1>

      <div className="flex flex-col gap-2">
        {locales.map((locale) => {
          const dict = getDictionary(locale);
          return (
            <p key={locale} lang={locale} className="text-base">
              {dict.home.tagline}
            </p>
          );
        })}
      </div>

      <p
        className={`text-sm ${supabaseOk ? "text-green-700" : "text-red-700"}`}
      >
        {supabaseOk
          ? getDictionary("fr").home.status_supabase_connected
          : getDictionary("fr").home.status_supabase_error}
      </p>

      <p className="text-xs text-neutral-500">
        {getDictionary("fr").home.status_ok} — Lot 0
      </p>
    </main>
  );
}
