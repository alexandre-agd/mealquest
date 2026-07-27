import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitch } from "@/components/locale-switch";
import { Button, Card, SectionTitle } from "@/components/ui";
import { signOut } from "@/app/connexion/actions";
import {
  AccessSection,
  AiSection,
  CustomIngredientSection,
  type AllowedEmail,
  EquipmentSection,
  HouseholdSection,
  MembersSection,
  type IngredientOption,
} from "./sections";

export default async function SettingsPage() {
  const household = await getCurrentHousehold();
  if (!household) redirect("/bienvenue");

  const { locale, t } = await getCurrentDictionary();
  const supabase = await createClient();

  const [
    { data: user },
    { data: ingredientRows },
    { data: dislikeRows },
    { data: allowedRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ingredients")
      .select("id, name_fr, name_ja, category")
      .order("name_fr"),
    supabase.from("member_dislikes").select("member_id, ingredient_id"),
    // RLS ne renvoie ces lignes qu'à un administrateur : un membre ordinaire
    // reçoit une liste vide et ne voit donc pas la section.
    supabase.from("allowed_signups").select("email, note").order("created_at"),
  ]);

  const { data: isAdmin } = await supabase.rpc("is_admin");

  const dislikesByMember: Record<string, string[]> = {};
  for (const row of dislikeRows ?? []) {
    (dislikesByMember[row.member_id] ??= []).push(row.ingredient_id);
  }

  // Une adresse autorisée n'a pas forcément déjà servi à créer un compte.
  // La distinction est utile : elle dit si l'invitation a été utilisée.
  // auth.users n'est pas lisible depuis l'application, on se limite donc au
  // compte courant, seul dont on soit certain qu'il existe.
  const currentEmail = user?.user?.email?.toLowerCase() ?? null;
  const allowed: AllowedEmail[] = (allowedRows ?? []).map((row) => ({
    email: row.email,
    note: row.note,
    hasAccount: row.email === currentEmail,
  }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-7 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <Link
          href="/"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.nav.home}
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <SectionTitle>{t.settings.language_section}</SectionTitle>
        <Card className="flex flex-col gap-3">
          <LocaleSwitch current={locale} />
          <p className="text-xs text-muted">{t.settings.language_help}</p>
        </Card>
      </section>

      <HouseholdSection t={t} household={household} />

      <MembersSection
        t={t}
        household={household}
        ingredients={(ingredientRows ?? []) as IngredientOption[]}
        dislikesByMember={dislikesByMember}
        currentUserId={user?.user?.id ?? null}
      />

      <EquipmentSection t={t} household={household} />

      <CustomIngredientSection t={t} />

      {isAdmin ? (
        <AccessSection t={t} allowed={allowed} currentEmail={currentEmail} />
      ) : null}

      <AiSection t={t} household={household} />

      <form action={signOut} className="safe-bottom">
        <Button variant="secondary" type="submit" className="w-full">
          {t.auth.signout}
        </Button>
      </form>
    </main>
  );
}
