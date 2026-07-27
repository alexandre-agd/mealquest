"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAiKeyForCurrentUser, hasAdminClient } from "@/lib/supabase/admin";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadAvailabilities } from "@/lib/week/queries";
import { computeWeekNeeds, versoPortions } from "@/lib/week/needs";
import { startOfWeek, type IsoDate } from "@/lib/week/dates";
import { RECENT_CARDS_EXCLUSION_COUNT } from "@/lib/config/business-rules";
import { computeHandSize, type GenerationContext } from "@/lib/ai/context";
import { generateCards } from "@/lib/ai/generate";
import { logAttempts, persistCards } from "@/lib/ai/persist";
import type { AllergenFamily } from "@/lib/household/equipment";
import type { ValidationContext } from "@/lib/ai/types";

/**
 * Une relation jointe est typée tantôt comme objet, tantôt comme tableau
 * selon la façon dont le client Supabase infère la requête. On normalise
 * plutôt que de forcer un cast qui masquerait le cas réel.
 */
function joinedKey(relation: unknown): string | undefined {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return (row as { key?: string } | null | undefined)?.key;
}

export type BoosterResult = {
  status: "ok" | "insufficient" | "no_key" | "no_needs" | "error";
  /** Clé de traduction du message à afficher. */
  message?: string;
  generated?: number;
  expected?: number;
};

/**
 * Le booster (RG-36).
 *
 * Rassemble tout ce que `docs/05` §3 demande de transmettre au modèle, à
 * partir des données réelles du foyer : contraintes, besoins de la semaine
 * avec les portions du verso calculées séparément (RG-19), état du frigo,
 * référentiel autorisé, historique.
 *
 * Rien n'est confié au modèle qui puisse être calculé : les besoins, les
 * portions et les points restent du code déterministe (docs/05, §2).
 */
export async function runBooster(weekStartInput: string): Promise<BoosterResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartInput)) {
    return { status: "error", message: "common.error_generic" };
  }
  const weekStart = startOfWeek(weekStartInput) as IsoDate;

  const household = await getCurrentHousehold();
  if (!household) return { status: "error", message: "common.error_generic" };

  // Mode dégradé explicite : sans clé, l'application reste utilisable en
  // manuel, elle ne se bloque pas (RG-61, P3).
  if (!household.has_ai_key) {
    return { status: "no_key", message: "booster.no_key" };
  }
  if (!hasAdminClient()) {
    return { status: "error", message: "booster.server_not_configured" };
  }

  const supabase = await createClient();

  // --- Besoins de la semaine --------------------------------------------
  const availabilities = await loadAvailabilities(weekStart);
  const members = household.members.map((m) => ({ id: m.id, kind: m.kind }));
  const needs = computeWeekNeeds(weekStart, members, availabilities);

  if (needs.dinners.length === 0 && needs.orphanLunches.length === 0) {
    return { status: "no_needs", message: "booster.no_needs" };
  }

  // --- Plan de semaine ---------------------------------------------------
  const { data: planId, error: planError } = await supabase.rpc("open_week_plan", {
    p_week_start: weekStart,
  });
  if (planError || !planId) {
    return { status: "error", message: "common.error_generic" };
  }

  // --- Frigo : seuls les niveaux 2 et 3 sont transmis (docs/05, §3) ------
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("level, ingredients(key)")
    .eq("week_plan_id", planId)
    .gte("level", 2);

  // --- Référentiel autorisé ---------------------------------------------
  const { data: ingredientRows } = await supabase
    .from("ingredients")
    .select("id, key, name_en, name_ja, category, default_unit, allergen");

  const allIngredients = ingredientRows ?? [];
  const ingredientIdByKey = new Map(allIngredients.map((i) => [i.key, i.id]));

  // --- Historique anti-répétition (RG-39) -------------------------------
  const { data: recentCards } = await supabase
    .from("cards")
    .select("title_fr, title_ja")
    .eq("status", "cuisinee")
    .order("updated_at", { ascending: false })
    .limit(RECENT_CARDS_EXCLUSION_COUNT);

  const recentTitles = new Set<string>();
  for (const row of recentCards ?? []) {
    recentTitles.add(
      row.title_fr.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(),
    );
    recentTitles.add(row.title_ja.trim());
  }

  // --- Allergies et dégoûts ---------------------------------------------
  const householdAllergens = new Set<AllergenFamily>(
    household.members.flatMap((m) => m.allergens),
  );

  const { data: dislikeRows } = await supabase
    .from("member_dislikes")
    .select("ingredients(key)");

  const dislikes = [
    ...new Set(
      (dislikeRows ?? [])
        .map((row) => joinedKey(row.ingredients))
        .filter((key): key is string => Boolean(key)),
    ),
  ];

  // --- Contexte ----------------------------------------------------------
  const context: GenerationContext = {
    adults: household.adults,
    children: household.children,
    goal: household.goal,
    equipment: household.equipment,
    allergens: [...householdAllergens],
    dislikes,
    // RG-19 : chaque dîner emporte le nombre de portions de SON lendemain,
    // qui n'est presque jamais le même que celui du dîner.
    dinnerNeeds: needs.dinners.map((need) => ({
      portions: need.portions,
      versoPortions: versoPortions(need.date, members, availabilities),
    })),
    orphanLunchPortions: needs.orphanLunches.map((need) => need.portions),
    fridge: (inventory ?? [])
      .map((row) => ({ key: joinedKey(row.ingredients), level: row.level as number }))
      .filter((item): item is { key: string; level: number } => Boolean(item.key)),
    ingredients: allIngredients.map((i) => ({
      key: i.key,
      name_en: i.name_en,
      name_ja: i.name_ja,
      category: i.category,
      default_unit: i.default_unit,
    })),
    recentDishes: (recentCards ?? []).map((row) => row.title_fr),
  };

  const validation: ValidationContext = {
    allowedIngredientKeys: new Set(allIngredients.map((i) => i.key)),
    allergenByIngredientKey: new Map(
      allIngredients.map((i) => [i.key, (i.allergen as AllergenFamily) ?? null]),
    ),
    householdAllergens,
    availableEquipment: new Set(household.equipment),
    allowedUnits: new Set(["g", "ml", "piece", "bunch", "pack"]),
    recentTitles,
  };

  const hand = computeHandSize(
    needs.dinners.length,
    needs.orphanLunches.length,
  );

  // --- Génération --------------------------------------------------------
  const apiKey = await readAiKeyForCurrentUser();

  const outcome = await generateCards({
    providerId: household.ai_provider,
    model: household.ai_model,
    apiKey,
    context,
    validation,
    expectedCards: hand.total,
  });

  await logAttempts(
    household.id,
    planId,
    outcome.promptVersion,
    household.ai_provider,
    household.ai_model,
    outcome.attempts,
  );

  if (outcome.status === "error") {
    return {
      status: "error",
      message:
        outcome.reason === "no_key"
          ? "booster.no_key"
          : outcome.reason === "provider"
            ? "booster.provider_error"
            : "booster.unreadable",
    };
  }

  // Une relance ne détruit pas les cartes déjà affectées à un créneau
  // (RG-42) : on ne supprime que les propositions non retenues.
  await supabase
    .from("cards")
    .delete()
    .eq("week_plan_id", planId)
    .eq("status", "proposee");

  const persisted = await persistCards(
    household.id,
    planId,
    outcome.cards,
    ingredientIdByKey,
  );
  if (persisted.error) return { status: "error", message: persisted.error };

  revalidatePath("/booster");

  return {
    status: outcome.status === "ok" ? "ok" : "insufficient",
    generated: outcome.cards.length,
    expected: hand.total,
  };
}
