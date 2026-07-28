"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CookedResult = { ok?: true; error?: string };

/**
 * Marque un repas comme cuisiné (RG-56).
 *
 * Le créneau passe à « cuisiné » et la carte entre dans la collection du
 * foyer. Un seul geste, aucune confirmation : c'est fait en cuisine, souvent
 * les mains occupées.
 *
 * Un verso ne fait pas entrer la carte une seconde fois dans la collection :
 * c'est le même plat, décliné.
 */
export async function markCooked(slotId: string): Promise<CookedResult> {
  if (!z.string().uuid().safeParse(slotId).success) {
    return { error: "common.error_generic" };
  }

  const supabase = await createClient();

  const { data: slot, error: slotError } = await supabase
    .from("planned_slots")
    .select("id, card_id, is_verso")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError || !slot) return { error: "common.error_generic" };

  const { error } = await supabase
    .from("planned_slots")
    .update({ status: "cuisine" })
    .eq("id", slotId);

  if (error) return { error: "common.error_generic" };

  if (slot.card_id && !slot.is_verso) {
    await supabase
      .from("cards")
      .update({ status: "cuisinee" })
      .eq("id", slot.card_id);
  }

  revalidatePath("/");
  revalidatePath("/planning");
  return { ok: true };
}
