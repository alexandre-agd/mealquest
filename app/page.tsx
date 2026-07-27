import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold, getCurrentMember } from "@/lib/household/queries";
import { interpolate } from "@/lib/i18n";
import { Card } from "@/components/ui";

export default async function Home() {
  const household = await getCurrentHousehold();

  // Compte connecté mais sans foyer : on l'envoie configurer le sien.
  if (!household) redirect("/bienvenue");

  const { t } = await getCurrentDictionary();
  const member = await getCurrentMember();

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

      <p className="text-sm text-muted">{t.home.lot_notice}</p>
    </main>
  );
}
