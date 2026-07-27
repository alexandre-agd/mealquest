"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STOCK_LEVELS } from "@/lib/config/business-rules";

export type InventoryActionResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

const MAX_LEVEL = Math.max(...STOCK_LEVELS);

const PayloadSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        ingredientId: z.string().uuid(),
        level: z.number().int().min(1).max(MAX_LEVEL),
      }),
    )
    .max(400),
});

export type InventoryPayload = z.input<typeof PayloadSchema>;

/**
 * Enregistre l'inventaire complet d'une semaine.
 *
 * On envoie l'état entier plutôt qu'un delta : le niveau 0 n'existe pas en
 * base (RG-32, l'absence de ligne vaut 0), donc un delta devrait distinguer
 * « passe à 0 » de « inchangé ». Remplacer l'ensemble rend l'opération
 * idempotente et supprime cette classe de bugs. Un frigo réel compte
 * quelques dizaines d'articles : la charge est négligeable.
 */
export async function saveInventory(
  payload: InventoryPayload,
): Promise<InventoryActionResult> {
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();

  // Crée le plan de semaine si besoin, sans risque de course entre deux
  // onglets ouverts en même temps.
  const { data: planId, error: planError } = await supabase.rpc(
    "open_week_plan",
    { p_week_start: parsed.data.weekStart },
  );

  if (planError || !planId) {
    console.error("[frigo] ouverture du plan :", planError?.message);
    return { error: GENERIC };
  }

  const keptIds = parsed.data.entries.map((entry) => entry.ingredientId);

  // Tout ce qui n'est plus dans la liste repasse à 0, donc disparaît.
  let deletion = supabase
    .from("inventory_items")
    .delete()
    .eq("week_plan_id", planId);

  if (keptIds.length > 0) {
    deletion = deletion.not("ingredient_id", "in", `(${keptIds.join(",")})`);
  }

  const { error: deleteError } = await deletion;
  if (deleteError) {
    console.error("[frigo] nettoyage :", deleteError.message);
    return { error: GENERIC };
  }

  if (parsed.data.entries.length > 0) {
    const { error } = await supabase.from("inventory_items").upsert(
      parsed.data.entries.map((entry) => ({
        week_plan_id: planId,
        ingredient_id: entry.ingredientId,
        level: entry.level,
      })),
      { onConflict: "week_plan_id,ingredient_id" },
    );

    if (error) {
      console.error("[frigo] enregistrement :", error.message);
      return { error: GENERIC };
    }
  }

  revalidatePath("/frigo");
  return { ok: true };
}
