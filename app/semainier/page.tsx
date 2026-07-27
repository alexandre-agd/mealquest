import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadAvailabilities } from "@/lib/week/queries";
import { currentWeekStart, startOfWeek } from "@/lib/week/dates";
import { WeekGrid } from "./week-grid";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) redirect("/bienvenue");

  const { locale, t } = await getCurrentDictionary();
  const { semaine } = await searchParams;

  // Toujours ramener au lundi : une URL bricolée avec un mercredi ne doit pas
  // produire une grille décalée (RG-10).
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(semaine ?? "")
    ? startOfWeek(semaine!)
    : currentWeekStart();

  const availabilities = await loadAvailabilities(weekStart);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-4 px-2">
        <h1 className="text-2xl font-semibold">{t.week.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <WeekGrid
        t={t}
        locale={locale}
        weekStart={weekStart}
        members={household.members.map((member) => ({
          id: member.id,
          kind: member.kind,
          name: member.name,
        }))}
        initialAvailabilities={Object.fromEntries(availabilities)}
      />
    </main>
  );
}
