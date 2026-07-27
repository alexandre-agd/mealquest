import { getCurrentDictionary } from "@/lib/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { AuthForm } from "./auth-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string; erreur?: string }>;
}) {
  const { locale, t } = await getCurrentDictionary();
  const { suite, erreur } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">{t.app.name}</h1>
        <LocaleSwitch current={locale} />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <h2 className="text-xl font-medium">{t.auth.signin_title}</h2>

        {erreur ? (
          <p role="alert" className="text-sm text-danger">
            {t.common.error_generic}
          </p>
        ) : null}

        <AuthForm t={t} mode="signin" next={suite} />
      </div>
    </main>
  );
}
