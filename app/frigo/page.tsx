import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadInventory } from "@/lib/inventory/queries";
import { currentWeekStart, startOfWeek } from "@/lib/week/dates";
import { InventoryList } from "./inventory-list";

export default async function FridgePage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) redirect("/bienvenue");

  const { locale, t } = await getCurrentDictionary();
  const { semaine } = await searchParams;

  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(semaine ?? "")
    ? startOfWeek(semaine!)
    : currentWeekStart();

  const inventory = await loadInventory(weekStart);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-4 px-1">
        <h1 className="text-2xl font-semibold">{t.inventory.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <InventoryList
        t={t}
        locale={locale}
        weekStart={weekStart}
        ingredients={inventory.ingredients}
        initialLevels={inventory.levels}
        preloaded={inventory.preloaded}
      />
    </main>
  );
}
