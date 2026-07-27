import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/week/dates";

export type CardIngredient = {
  name_fr: string;
  name_ja: string;
  quantity: number;
  unit: string;
  forVerso: boolean;
};

export type CardVerso = {
  form: string;
  title_fr: string;
  title_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  extraMinutes: number;
  points: number;
};

export type Card = {
  id: string;
  type: string;
  cuisine: string;
  points: number;
  stars: number;
  prepMinutes: number;
  referencePortions: number;
  title_fr: string;
  title_ja: string;
  description_fr: string;
  description_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  status: string;
  ingredients: CardIngredient[];
  verso: CardVerso | null;
};

type RawIngredient = {
  quantity: number;
  unit: string;
  for_verso: boolean;
  ingredients: { name_fr: string; name_ja: string } | { name_fr: string; name_ja: string }[] | null;
};

/** La ligne telle qu'elle sort de la base, en snake_case. */
type RawVerso = {
  form: string;
  title_fr: string;
  title_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  extra_minutes: number;
  points: number;
};

function firstRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

/** Cartes rattachées au plan de la semaine, quel que soit leur statut. */
export async function loadCardsForWeek(weekStart: IsoDate): Promise<Card[]> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("week_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) return [];

  const { data, error } = await supabase
    .from("cards")
    .select(
      `id, type, cuisine, points, stars, prep_minutes, reference_portions,
       title_fr, title_ja, description_fr, description_ja, steps_fr, steps_ja, status,
       card_ingredients ( quantity, unit, for_verso, ingredients ( name_fr, name_ja ) ),
       card_versos ( form, title_fr, title_ja, steps_fr, steps_ja, extra_minutes, points )`,
    )
    .eq("week_plan_id", plan.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[booster] lecture des cartes :", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const verso = firstRelation(
      row.card_versos as unknown as RawVerso | RawVerso[] | null,
    );

    return {
      id: row.id,
      type: row.type,
      cuisine: row.cuisine,
      points: row.points,
      stars: row.stars,
      prepMinutes: row.prep_minutes,
      referencePortions: row.reference_portions,
      title_fr: row.title_fr,
      title_ja: row.title_ja,
      description_fr: row.description_fr,
      description_ja: row.description_ja,
      steps_fr: (row.steps_fr as string[]) ?? [],
      steps_ja: (row.steps_ja as string[]) ?? [],
      status: row.status,
      ingredients: ((row.card_ingredients as RawIngredient[]) ?? []).map((item) => {
        const ingredient = firstRelation(item.ingredients);
        return {
          name_fr: ingredient?.name_fr ?? "",
          name_ja: ingredient?.name_ja ?? "",
          quantity: item.quantity,
          unit: item.unit,
          forVerso: item.for_verso,
        };
      }),
      verso: verso
        ? {
            form: verso.form,
            title_fr: verso.title_fr,
            title_ja: verso.title_ja,
            steps_fr: verso.steps_fr ?? [],
            steps_ja: verso.steps_ja ?? [],
            extraMinutes: verso.extra_minutes,
            points: verso.points,
          }
        : null,
    };
  });
}
