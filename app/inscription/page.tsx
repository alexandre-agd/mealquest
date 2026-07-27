import { getCurrentDictionary } from "@/lib/i18n/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { AuthForm } from "../connexion/auth-form";

export default async function SignUpPage() {
  const { locale, t } = await getCurrentDictionary();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold">{t.app.name}</h1>
        <LocaleSwitch current={locale} />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <h2 className="text-xl font-medium">{t.auth.signup_title}</h2>
        <AuthForm t={t} mode="signup" />
      </div>
    </main>
  );
}
