"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AccessActionResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

/**
 * Autorise une adresse à créer un compte.
 *
 * L'autorisation est vérifiée par un trigger sur auth.users : ajouter une
 * ligne ici est la seule façon d'ouvrir l'accès, y compris pour Google.
 */
export async function allowEmail(formData: FormData): Promise<AccessActionResult> {
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email(),
      note: z.string().trim().max(60).optional(),
    })
    .safeParse({
      email: formData.get("email"),
      note: formData.get("note") || undefined,
    });

  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.from("allowed_signups").upsert(
    { email: parsed.data.email, note: parsed.data.note ?? null },
    { onConflict: "email" },
  );

  if (error) {
    console.error("[acces] autorisation :", error.message);
    return { error: GENERIC };
  }

  revalidatePath("/parametres");
  return { ok: true };
}

/**
 * Retire une adresse de la liste.
 *
 * N'efface pas le compte déjà créé : cela empêche seulement d'en recréer un.
 * Supprimer un compte existant reste une opération manuelle, volontairement,
 * pour éviter une perte de données irréversible depuis un écran de réglages.
 */
export async function revokeEmail(email: string): Promise<AccessActionResult> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(email);
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se retirer soi-même n'aurait aucun effet immédiat mais laisserait la
  // liste dans un état incohérent avec les comptes réels.
  if (user?.email?.toLowerCase() === parsed.data) {
    return { error: "access.cannot_revoke_self" };
  }

  const { error } = await supabase
    .from("allowed_signups")
    .delete()
    .eq("email", parsed.data);

  if (error) {
    console.error("[acces] retrait :", error.message);
    return { error: GENERIC };
  }

  revalidatePath("/parametres");
  return { ok: true };
}
