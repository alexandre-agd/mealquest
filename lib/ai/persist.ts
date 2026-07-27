import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GenerationAttempt } from "./generate";
import type { ValidatedCard } from "./types";

/**
 * Enregistrement des cartes produites, et des traces de génération.
 *
 * Les cartes sont écrites avec le statut `proposee` : elles constituent la
 * main du booster. Seules celles que l'utilisateur retient passeront à
 * `planifiee` (RG-27).
 */

export async function persistCards(
  householdId: string,
  weekPlanId: string,
  cards: ValidatedCard[],
  ingredientIdByKey: Map<string, string>,
): Promise<{ error?: string }> {
  if (cards.length === 0) return {};

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("cards")
    .insert(
      cards.map(({ card }) => ({
        household_id: householdId,
        week_plan_id: weekPlanId,
        type: card.type,
        cuisine: card.cuisine,
        points: card.points,
        stars: card.stars,
        prep_minutes: card.prep_minutes,
        reference_portions: card.reference_portions,
        title_fr: card.title.fr,
        title_ja: card.title.ja,
        description_fr: card.description.fr,
        description_ja: card.description.ja,
        steps_fr: card.steps.fr,
        steps_ja: card.steps.ja,
        origin: "generee" as const,
        status: "proposee" as const,
      })),
    )
    .select("id");

  if (error || !inserted) {
    console.error("[booster] enregistrement des cartes :", error?.message);
    return { error: "common.error_generic" };
  }

  // L'ordre du retour suit celui de l'insertion : on peut apparier par index.
  const versos = [];
  const ingredients = [];
  const equipment = [];

  for (const [index, entry] of cards.entries()) {
    const cardId = inserted[index].id;
    const { card } = entry;

    for (const item of card.ingredients) {
      const ingredientId = ingredientIdByKey.get(item.key);
      if (!ingredientId) continue; // Impossible après validation S1.
      ingredients.push({
        card_id: cardId,
        ingredient_id: ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        for_verso: false,
      });
    }

    for (const key of card.equipment) {
      equipment.push({ card_id: cardId, equipment_key: key });
    }

    if (card.verso && entry.versoPoints !== null) {
      versos.push({
        card_id: cardId,
        form: card.verso.form,
        title_fr: card.verso.title.fr,
        title_ja: card.verso.title.ja,
        steps_fr: card.verso.steps.fr,
        steps_ja: card.verso.steps.ja,
        extra_minutes: card.verso.extra_minutes,
        points: entry.versoPoints,
      });

      for (const item of card.verso.extra_ingredients) {
        const ingredientId = ingredientIdByKey.get(item.key);
        if (!ingredientId) continue;
        ingredients.push({
          card_id: cardId,
          ingredient_id: ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          for_verso: true,
        });
      }
    }
  }

  const [versoResult, ingredientResult, equipmentResult] = await Promise.all([
    versos.length ? supabase.from("card_versos").insert(versos) : { error: null },
    ingredients.length
      ? supabase.from("card_ingredients").upsert(ingredients, {
          onConflict: "card_id,ingredient_id,for_verso",
        })
      : { error: null },
    equipment.length
      ? supabase.from("card_equipment").upsert(equipment, {
          onConflict: "card_id,equipment_key",
        })
      : { error: null },
  ]);

  const failure = versoResult.error ?? ingredientResult.error ?? equipmentResult.error;
  if (failure) {
    console.error("[booster] détails des cartes :", failure.message);
    return { error: "common.error_generic" };
  }

  return {};
}

/**
 * Trace d'une génération (docs/05, §9).
 * Un échec d'écriture ne doit jamais faire perdre la génération elle-même :
 * la trace est un outil de calibrage, pas une donnée métier.
 */
export async function logAttempts(
  householdId: string,
  weekPlanId: string | null,
  promptVersion: string,
  provider: string | null,
  model: string | null,
  attempts: GenerationAttempt[],
): Promise<void> {
  if (attempts.length === 0) return;

  try {
    const supabase = await createClient();
    await supabase.from("generation_logs").insert(
      attempts.map((attempt) => ({
        household_id: householdId,
        week_plan_id: weekPlanId,
        prompt_version: promptVersion,
        provider,
        model,
        attempt: attempt.index,
        // Tronqué : une sortie complète peut faire des dizaines de milliers
        // de caractères, et seuls les premiers servent au diagnostic.
        raw_response: attempt.raw.slice(0, 20000),
        accepted_count: attempt.acceptedCount,
        rejections: attempt.rejected.map((entry) => entry.reasons),
        duration_ms: attempt.durationMs,
      })),
    );
  } catch (error) {
    console.error("[booster] trace non enregistrée :", error);
  }
}
