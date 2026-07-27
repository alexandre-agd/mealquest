import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, type IsoDate } from "@/lib/week/dates";

export type PerishableIngredient = {
  id: string;
  key: string;
  name_fr: string;
  name_ja: string;
  category: string;
  default_unit: string;
  /** Nombre de semaines où le foyer a déclaré en avoir (RG-33). */
  weeksUsed: number;
  /** Ingrédient ajouté par le foyer, absent du référentiel commun. */
  custom: boolean;
};

export type InventorySnapshot = {
  weekStart: IsoDate;
  /** Niveaux courants, par identifiant d'ingrédient. Absent = niveau 0. */
  levels: Record<string, number>;
  /** Vrai si ces niveaux viennent de la semaine précédente (RG-34). */
  preloaded: boolean;
  ingredients: PerishableIngredient[];
};

/**
 * Charge l'inventaire d'une semaine.
 *
 * Ne présente que les périssables : les `staple` ne sont jamais demandés à la
 * saisie (RG-30), c'est ce qui garde l'écran court. Ils réapparaîtront dans
 * la rubrique « à vérifier dans le placard » de la liste de courses.
 *
 * Si la semaine n'a pas encore d'inventaire, on précharge celui de la semaine
 * précédente (RG-34) : on modifie, on ne recommence pas de zéro. Ce
 * préchargement n'est pas écrit en base tant que l'utilisateur n'a rien
 * touché — il le sera au premier enregistrement.
 */
export async function loadInventory(
  weekStart: IsoDate,
): Promise<InventorySnapshot> {
  const supabase = await createClient();

  const [{ data: ingredientRows }, { data: usageRows }, { data: planRows }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("id, key, name_fr, name_ja, category, default_unit, household_id")
        .eq("perishable", true),
      supabase.from("ingredient_usage").select("ingredient_id, weeks_used"),
      supabase
        .from("week_plans")
        .select("id, week_start")
        .in("week_start", [weekStart, addDays(weekStart, -7)]),
    ]);

  const usage = new Map(
    (usageRows ?? []).map((row) => [row.ingredient_id, row.weeks_used]),
  );

  const ingredients: PerishableIngredient[] = (ingredientRows ?? []).map(
    (row) => ({
      id: row.id,
      key: row.key,
      name_fr: row.name_fr,
      name_ja: row.name_ja,
      category: row.category,
      default_unit: row.default_unit,
      weeksUsed: usage.get(row.id) ?? 0,
      custom: row.household_id !== null,
    }),
  );

  const currentPlan = (planRows ?? []).find((p) => p.week_start === weekStart);
  const previousPlan = (planRows ?? []).find(
    (p) => p.week_start === addDays(weekStart, -7),
  );

  const sourcePlanId = currentPlan?.id ?? previousPlan?.id;
  let levels: Record<string, number> = {};

  if (sourcePlanId) {
    const { data: items } = await supabase
      .from("inventory_items")
      .select("ingredient_id, level")
      .eq("week_plan_id", sourcePlanId);

    levels = Object.fromEntries(
      (items ?? []).map((item) => [item.ingredient_id, item.level]),
    );
  }

  return {
    weekStart,
    levels,
    preloaded: !currentPlan && Boolean(previousPlan),
    ingredients,
  };
}
