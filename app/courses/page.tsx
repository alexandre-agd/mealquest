import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadShoppingList } from "@/lib/shopping/queries";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { currentWeekStart, startOfWeek } from "@/lib/week/dates";
import { ShoppingListScreen } from "./shopping-list";

export default async function ShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) redirect("/bienvenue");

  const { t } = await getCurrentDictionary();
  const { semaine } = await searchParams;

  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(semaine ?? "")
    ? startOfWeek(semaine!)
    : currentWeekStart();

  const data = await loadShoppingList(weekStart);

  // La configuration part au client pour ouvrir le canal Realtime (RG-50).
  // Ce sont les valeurs publiques, jamais la clé de service.
  const { url, anonKey } = getSupabaseConfig();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-4 px-1">
        <h1 className="text-2xl font-semibold">{t.shopping.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <ShoppingListScreen
        t={t}
        planId={data.planId}
        list={data.list}
        initialChecked={[...data.checked]}
        initialFreeLines={data.freeLines}
        supabaseConfig={{ url, anonKey }}
      />
    </main>
  );
}
