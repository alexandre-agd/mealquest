import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";
import type { AllergenFamily } from "./equipment";
import { effectivePointsBudget, type HouseholdGoal } from "./budget";

export type Member = {
  id: string;
  name: string;
  kind: "adulte" | "enfant";
  locale: Locale;
  user_id: string | null;
  allergens: AllergenFamily[];
};

export type Household = {
  id: string;
  name: string;
  goal: HouseholdGoal;
  points_budget_override: number | null;
  ai_provider: string | null;
  ai_model: string | null;
  has_ai_key: boolean;
  members: Member[];
  equipment: string[];
  adults: number;
  children: number;
  pointsBudget: number;
};

/**
 * Charge le foyer du compte connecté, ou null s'il n'en a pas encore
 * (l'onboarding n'est pas passé). Toutes les requêtes sont filtrées par RLS :
 * il n'y a aucun filtre household_id côté application, et c'est voulu —
 * l'isolation est garantie par la base, pas par ce fichier (RG-63).
 */
export async function getCurrentHousehold(): Promise<Household | null> {
  const supabase = await createClient();

  const { data: household } = await supabase
    .from("households")
    .select(
      "id, name, goal, points_budget_override, ai_provider, ai_model, ai_api_key_secret_id",
    )
    .maybeSingle();

  if (!household) return null;

  const [{ data: memberRows }, { data: equipmentRows }] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, kind, locale, user_id, member_allergens(allergen)")
      // position, pas created_at : les membres créés à l'onboarding partagent
      // le même created_at (une seule transaction), voir migration 000006.
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("household_equipment").select("equipment_key"),
  ]);

  const members: Member[] = (memberRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    locale: row.locale,
    user_id: row.user_id,
    allergens: (row.member_allergens ?? []).map(
      (a: { allergen: AllergenFamily }) => a.allergen,
    ),
  }));

  const adults = members.filter((m) => m.kind === "adulte").length;
  const children = members.filter((m) => m.kind === "enfant").length;

  return {
    id: household.id,
    name: household.name,
    goal: household.goal,
    points_budget_override: household.points_budget_override,
    ai_provider: household.ai_provider,
    ai_model: household.ai_model,
    has_ai_key: Boolean(household.ai_api_key_secret_id),
    members,
    equipment: (equipmentRows ?? []).map((e) => e.equipment_key),
    adults,
    children,
    pointsBudget: effectivePointsBudget(
      household.goal,
      adults,
      children,
      household.points_budget_override,
    ),
  };
}

/** Le membre correspondant au compte connecté, s'il existe. */
export async function getCurrentMember(): Promise<Member | null> {
  const household = await getCurrentHousehold();
  if (!household) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return household.members.find((m) => m.user_id === user.id) ?? null;
}
