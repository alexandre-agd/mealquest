"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ShoppingActionResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

/**
 * Coche ou décoche une ligne (RG-50).
 *
 * La présence d'une ligne vaut « coché » : pas de booléen à maintenir, et
 * l'état se partage entre les membres du foyer par Realtime.
 */
export async function toggleCheck(
  planId: string,
  ingredientId: string,
  checked: boolean,
): Promise<ShoppingActionResult> {
  const parsed = z
    .object({ planId: z.string().uuid(), ingredientId: z.string().uuid() })
    .safeParse({ planId, ingredientId });
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();

  const { error } = checked
    ? await supabase
        .from("shopping_checks")
        .upsert(
          { week_plan_id: parsed.data.planId, ingredient_id: parsed.data.ingredientId },
          { onConflict: "week_plan_id,ingredient_id" },
        )
    : await supabase
        .from("shopping_checks")
        .delete()
        .eq("week_plan_id", parsed.data.planId)
        .eq("ingredient_id", parsed.data.ingredientId);

  if (error) return { error: GENERIC };
  return { ok: true };
}

/** Ajoute une ligne libre : papier toilette, bière, ce qu'on veut (RG-51). */
export async function addFreeLine(
  planId: string,
  label: string,
): Promise<ShoppingActionResult> {
  const parsed = z
    .object({ planId: z.string().uuid(), label: z.string().trim().min(1).max(80) })
    .safeParse({ planId, label });
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_free_lines").insert({
    week_plan_id: parsed.data.planId,
    label: parsed.data.label,
  });

  if (error) return { error: GENERIC };
  revalidatePath("/courses");
  return { ok: true };
}

export async function toggleFreeLine(
  id: string,
  checked: boolean,
): Promise<ShoppingActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_free_lines")
    .update({ checked })
    .eq("id", id);

  if (error) return { error: GENERIC };
  return { ok: true };
}

export async function removeFreeLine(id: string): Promise<ShoppingActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.from("shopping_free_lines").delete().eq("id", id);

  if (error) return { error: GENERIC };
  revalidatePath("/courses");
  return { ok: true };
}
