import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold, getCurrentMember } from "@/lib/household/queries";
import { interpolate } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { loadPlannedSlots } from "@/lib/cards/planning";
import {
  addDays,
  currentWeekStart,
  todayInHouseholdTimezone,
} from "@/lib/week/dates";

export default async function Home() {
  const household = await getCurrentHousehold();

  // Compte connecté mais sans foyer : on l'envoie configurer le sien.
  if (!household) redirect("/bienvenue");

  const { locale, t } = await getCurrentDictionary();
  const member = await getCurrentMember();

  // A5.16 : « on mange quoi ce soir ? » doit se lire sans navigation.
  // On regarde aussi la semaine suivante, car un dimanche soir le bento du
  // lendemain appartient déjà à la semaine d'après.
  const today = todayInHouseholdTimezone();
  const tomorrow = addDays(today, 1);
  const slots = [
    ...(await loadPlannedSlots(currentWeekStart())),
    ...(await loadPlannedSlots(addDays(currentWeekStart(), 7))),
  ];
  const tonight = slots.find((s) => s.date === today && s.slot === "soir");
  const tomorrowLunch = slots.find((s) => s.date === tomorrow && s.slot === "midi");
  const ja = locale === "ja";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {member
              ? interpolate(t.home.greeting, { name: member.name })
              : t.app.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {interpolate(t.home.household_of, { name: household.name })}
          </p>
        </div>
        <Link
          href="/parametres"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.settings}
        </Link>
      </header>

      {/* La question du quotidien, en tête d'écran (parcours C1) */}
      <Card className="flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{t.home.tonight}</p>
          {tonight ? (
            <>
              <p className="mt-0.5 text-lg font-medium">
                {tonight.neutral
                  ? t.booster.neutral[tonight.neutral as "restaurant"]
                  : ja
                    ? tonight.title_ja
                    : tonight.title_fr}
              </p>
              {tonight.cardId ? (
                <Link
                  href={`/recette/${tonight.id}`}
                  className="text-sm font-medium text-accent underline underline-offset-4"
                >
                  {t.home.see_recipe}
                </Link>
              ) : null}
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted">{t.home.nothing_planned}</p>
          )}
        </div>

        {tomorrowLunch ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              {t.home.tomorrow_lunch}
            </p>
            <p className="mt-0.5 text-base">
              {tomorrowLunch.neutral
                ? t.booster.neutral[tomorrowLunch.neutral as "restaurant"]
                : ja
                  ? tomorrowLunch.title_ja
                  : tomorrowLunch.title_fr}
            </p>
            {tomorrowLunch.cardId ? (
              <Link
                href={`/recette/${tomorrowLunch.id}`}
                className="text-sm font-medium text-accent underline underline-offset-4"
              >
                {t.home.see_recipe}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-muted">{t.household.budget}</p>
          <p className="mt-1 text-xs text-muted">{t.household.budget_explain}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          {household.pointsBudget}
          <span className="ml-1 text-sm font-normal text-muted">
            {t.household.budget_unit}
          </span>
        </p>
      </Card>

      <Link
        href="/semainier"
        className="rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent"
      >
        <p className="font-medium">{t.week.title}</p>
        <p className="mt-1 text-sm text-muted">{t.home.week_hint}</p>
      </Link>

      <Link
        href="/frigo"
        className="rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent"
      >
        <p className="font-medium">{t.inventory.title}</p>
        <p className="mt-1 text-sm text-muted">{t.home.fridge_hint}</p>
      </Link>

      <Link
        href="/planning"
        className="rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent"
      >
        <p className="font-medium">{t.planning.title}</p>
        <p className="mt-1 text-sm text-muted">{t.home.planning_hint}</p>
      </Link>

      <Link
        href="/courses"
        className="rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-accent"
      >
        <p className="font-medium">{t.shopping.title}</p>
        <p className="mt-1 text-sm text-muted">{t.home.shopping_hint}</p>
      </Link>

      <Link
        href="/booster"
        className="rounded-2xl border border-accent bg-surface p-5 text-left transition-colors"
      >
        <p className="font-medium">{t.booster.title}</p>
        <p className="mt-1 text-sm text-muted">{t.home.booster_hint}</p>
      </Link>
    </main>
  );
}
