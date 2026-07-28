import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadPlannedSlots } from "@/lib/cards/planning";
import { loadAvailabilities } from "@/lib/week/queries";
import { computeWeekNeeds } from "@/lib/week/needs";
import { computeAdjustedPointsBudget } from "@/lib/household/budget";
import { currentWeekStart, startOfWeek, weekDates } from "@/lib/week/dates";
import { PlanningGrid } from "./planning-grid";

export default async function PlanningPage({
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

  const [slots, availabilities] = await Promise.all([
    loadPlannedSlots(weekStart),
    loadAvailabilities(weekStart),
  ]);

  const needs = computeWeekNeeds(
    weekStart,
    household.members.map((m) => ({ id: m.id, kind: m.kind })),
    availabilities,
  );

  const mealsPlanned = needs.totalDinners + needs.orphanLunches.length;
  const pointsBudget =
    household.points_budget_override ??
    computeAdjustedPointsBudget(
      household.goal,
      household.adults,
      household.children,
      mealsPlanned,
    );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-4 px-1">
        <h1 className="text-2xl font-semibold">{t.planning.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <PlanningGrid
        t={t}
        locale={locale}
        weekStart={weekStart}
        dates={weekDates(weekStart)}
        slots={slots}
        needs={[
          ...needs.dinners.map((n) => ({
            date: n.date,
            slot: "soir" as const,
            portions: n.portions,
          })),
          ...needs.lunches.map((n) => ({
            date: n.date,
            slot: "midi" as const,
            portions: n.portions,
          })),
        ]}
        pointsBudget={pointsBudget}
      />
    </main>
  );
}
