"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { startOfWeek } from "@/lib/week/dates";
import { versoPointsFrom } from "@/lib/ai/validation";
import { CUISINES, CARD_TYPES } from "@/lib/ai/types";

export type ManualCardResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

const IngredientLine = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "piece", "bunch", "pack"]),
});

const ManualCard = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(CARD_TYPES as unknown as [string, ...string[]]),
  cuisine: z.enum(CUISINES as unknown as [string, ...string[]]),
  points: z.number().int().min(1).max(5),
  prepMinutes: z.number().int().min(1).max(600),
  portions: z.number().int().min(1).max(12),
  titleFr: z.string().trim().min(1).max(120),
  titleJa: z.string().trim().min(1).max(120),
  descriptionFr: z.string().trim().min(1).max(400),
  descriptionJa: z.string().trim().min(1).max(400),
  stepsFr: z.array(z.string().trim().min(1)).min(1).max(30),
  stepsJa: z.array(z.string().trim().min(1)).min(1).max(30),
  ingredients: z.array(IngredientLine).min(1).max(40),
});

export type ManualCardInput = z.input<typeof ManualCard>;

/** Étoiles déduites du temps annoncé (RG-24) : l'utilisateur n'a pas à y penser. */
function starsFor(minutes: number): number {
  if (minutes <= 20) return 1;
  if (minutes <= 40) return 2;
  return 3;
}

/**
 * Création d'une carte à la main (RG-61, A4.1).
 *
 * Chemin de repli garanti : sans clé API, ou après un échec de génération,
 * on doit pouvoir planifier sa semaine quand même. L'application ne se
 * bloque jamais (P3).
 *
 * Les deux langues restent obligatoires (RG-26) : une carte qui n'existerait
 * qu'en français serait illisible pour l'autre membre du foyer, ce qui est
 * précisément le point de rupture identifié par la MOA.
 */
export async function createManualCard(
  input: ManualCardInput,
): Promise<ManualCardResult> {
  const parsed = ManualCard.safeParse(input);
  if (!parsed.success) return { error: GENERIC };

  const data = parsed.data;
  if (data.stepsFr.length !== data.stepsJa.length) {
    return { error: "manual.steps_mismatch" };
  }

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();

  const { data: planId, error: planError } = await supabase.rpc("open_week_plan", {
    p_week_start: startOfWeek(data.weekStart),
  });
  if (planError || !planId) return { error: GENERIC };

  const { data: card, error } = await supabase
    .from("cards")
    .insert({
      household_id: household.id,
      week_plan_id: planId,
      type: data.type,
      cuisine: data.cuisine,
      points: data.points,
      stars: starsFor(data.prepMinutes),
      prep_minutes: data.prepMinutes,
      reference_portions: data.portions,
      title_fr: data.titleFr,
      title_ja: data.titleJa,
      description_fr: data.descriptionFr,
      description_ja: data.descriptionJa,
      steps_fr: data.stepsFr,
      steps_ja: data.stepsJa,
      origin: "manuelle",
      status: "proposee",
    })
    .select("id")
    .single();

  if (error || !card) {
    console.error("[carte manuelle] :", error?.message);
    return { error: GENERIC };
  }

  const { error: ingredientError } = await supabase.from("card_ingredients").insert(
    data.ingredients.map((line) => ({
      card_id: card.id,
      ingredient_id: line.ingredientId,
      quantity: line.quantity,
      unit: line.unit,
      for_verso: false,
    })),
  );

  if (ingredientError) {
    // La carte sans ses ingrédients fausserait la liste de courses : mieux
    // vaut ne rien laisser qu'une carte incomplète.
    await supabase.from("cards").delete().eq("id", card.id);
    return { error: GENERIC };
  }

  revalidatePath("/booster");
  return { ok: true };
}

/** Points du verso d'une carte manuelle, si elle en reçoit un plus tard. */
export async function manualVersoPoints(points: number): Promise<number> {
  return versoPointsFrom(points);
}
