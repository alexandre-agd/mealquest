import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadCardsForWeek } from "@/lib/cards/queries";
import { loadAvailabilities } from "@/lib/week/queries";
import { computeWeekNeeds } from "@/lib/week/needs";
import { currentWeekStart, startOfWeek } from "@/lib/week/dates";
import { BoosterScreen } from "./booster-screen";

export default async function BoosterPage({
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

  const [cards, availabilities] = await Promise.all([
    loadCardsForWeek(weekStart),
    loadAvailabilities(weekStart),
  ]);

  const needs = computeWeekNeeds(
    weekStart,
    household.members.map((m) => ({ id: m.id, kind: m.kind })),
    availabilities,
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-4 px-1">
        <h1 className="text-2xl font-semibold">{t.booster.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <BoosterScreen
        t={t}
        locale={locale}
        weekStart={weekStart}
        cards={cards}
        dinnersNeeded={needs.totalDinners}
        pointsBudget={household.pointsBudget}
        hasKey={household.has_ai_key}
      />
    </main>
  );
}
