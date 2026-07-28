import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/week/dates";
import {
  computeShoppingList,
  type RequiredIngredient,
  type ShoppingList,
} from "./compute";

export type FreeLine = { id: string; label: string; checked: boolean };

export type ShoppingScreenData = {
  planId: string | null;
  list: ShoppingList;
  checked: Set<string>;
  freeLines: FreeLine[];
};

type CardRow = {
  reference_portions: number;
  card_ingredients: Array<{
    quantity: number;
    unit: string;
    for_verso: boolean;
    ingredients: IngredientRow | IngredientRow[] | null;
  }>;
};

type IngredientRow = {
  id: string;
  key: string;
  name_fr: string;
  name_ja: string;
  category: string;
  staple: boolean;
};

function first<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

/**
 * Assemble la liste de courses de la semaine.
 *
 * La liste se recalcule à chaque affichage à partir des créneaux réellement
 * planifiés : retirer une carte met la liste à jour sans rien à synchroniser.
 */
export async function loadShoppingList(
  weekStart: IsoDate,
): Promise<ShoppingScreenData> {
  const supabase = await createClient();
  const empty: ShoppingList = { toBuy: [], probablyEnough: [], pantry: [] };

  const { data: plan } = await supabase
    .from("week_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) {
    return { planId: null, list: empty, checked: new Set(), freeLines: [] };
  }

  const [{ data: slots }, { data: inventory }, { data: checks }, { data: free }] =
    await Promise.all([
      supabase
        .from("planned_slots")
        .select(
          `portions, is_verso, card_id,
           cards ( reference_portions,
                   card_ingredients ( quantity, unit, for_verso,
                     ingredients ( id, key, name_fr, name_ja, category, staple ) ) )`,
        )
        .eq("week_plan_id", plan.id)
        .not("card_id", "is", null),
      supabase
        .from("inventory_items")
        .select("ingredient_id, level")
        .eq("week_plan_id", plan.id),
      supabase
        .from("shopping_checks")
        .select("ingredient_id")
        .eq("week_plan_id", plan.id),
      supabase
        .from("shopping_free_lines")
        .select("id, label, checked")
        .eq("week_plan_id", plan.id)
        .order("created_at"),
    ]);

  const required: RequiredIngredient[] = [];

  for (const slot of slots ?? []) {
    const card = first(slot.cards as unknown as CardRow | CardRow[] | null);
    if (!card) continue;

    for (const line of card.card_ingredients ?? []) {
      // Un créneau occupé par le verso ne consomme que les ingrédients du
      // verso ; le recto a déjà été compté sur son propre créneau.
      if (line.for_verso !== slot.is_verso) continue;

      const ingredient = first(line.ingredients);
      if (!ingredient) continue;

      required.push({
        ingredientId: ingredient.id,
        key: ingredient.key,
        name_fr: ingredient.name_fr,
        name_ja: ingredient.name_ja,
        category: ingredient.category,
        unit: line.unit,
        staple: ingredient.staple,
        quantity: line.quantity,
        slotPortions: slot.portions,
        referencePortions: card.reference_portions,
      });
    }
  }

  const stockLevels = new Map(
    (inventory ?? []).map((row) => [row.ingredient_id as string, row.level as number]),
  );

  return {
    planId: plan.id,
    list: computeShoppingList(required, stockLevels),
    checked: new Set((checks ?? []).map((row) => row.ingredient_id as string)),
    freeLines: (free ?? []) as FreeLine[],
  };
}
