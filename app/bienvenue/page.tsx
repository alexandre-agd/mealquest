import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { LocaleSwitch } from "@/components/locale-switch";
import { Onboarding } from "./onboarding";

export default async function WelcomePage() {
  // Un foyer déjà configuré n'a rien à faire ici.
  if (await getCurrentHousehold()) redirect("/");

  const { locale, t } = await getCurrentDictionary();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.onboarding.welcome_title}</h1>
          <p className="mt-1 text-sm text-muted">{t.onboarding.welcome_text}</p>
        </div>
        <LocaleSwitch current={locale} />
      </div>

      <Onboarding t={t} locale={locale} />
    </main>
  );
}
