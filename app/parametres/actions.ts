"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/lib/i18n";
import { ALLERGEN_FAMILIES, EQUIPMENT_KEYS } from "@/lib/household/equipment";
import { HOUSEHOLD_GOALS } from "@/lib/household/budget";
import { getCurrentHousehold } from "@/lib/household/queries";

export type ActionResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

// Aucune de ces actions ne filtre par household_id : c'est RLS qui décide ce
// que le compte connecté peut écrire (RG-63). Passer un identifiant d'un
// autre foyer ne produit aucune ligne modifiée.

export async function updateHousehold(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(60),
      goal: z.enum(HOUSEHOLD_GOALS as [string, ...string[]]),
    })
    .safeParse({
      name: formData.get("name"),
      goal: formData.get("goal"),
    });

  if (!parsed.success) return { error: GENERIC };

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ name: parsed.data.name, goal: parsed.data.goal })
    .eq("id", household.id);

  if (error) return { error: GENERIC };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateEquipment(keys: string[]): Promise<ActionResult> {
  const parsed = z
    .array(z.enum(EQUIPMENT_KEYS as unknown as [string, ...string[]]))
    .safeParse(keys);
  if (!parsed.success) return { error: GENERIC };

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();

  // Remplacement intégral : la sélection à l'écran fait foi.
  const { error: deleteError } = await supabase
    .from("household_equipment")
    .delete()
    .eq("household_id", household.id);
  if (deleteError) return { error: GENERIC };

  if (parsed.data.length > 0) {
    const { error } = await supabase.from("household_equipment").insert(
      parsed.data.map((equipment_key) => ({
        household_id: household.id,
        equipment_key,
      })),
    );
    if (error) return { error: GENERIC };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

const MemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["adulte", "enfant"]),
  locale: z.enum(locales as unknown as [string, ...string[]]),
  allergens: z.array(z.enum(ALLERGEN_FAMILIES as unknown as [string, ...string[]])),
  dislikes: z.array(z.string().uuid()),
});

export async function updateMember(
  payload: z.input<typeof MemberSchema>,
): Promise<ActionResult> {
  const parsed = MemberSchema.safeParse(payload);
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();
  const { id, name, kind, locale, allergens, dislikes } = parsed.data;

  const { error } = await supabase
    .from("members")
    .update({ name, kind, locale })
    .eq("id", id);
  if (error) return { error: GENERIC };

  await supabase.from("member_allergens").delete().eq("member_id", id);
  if (allergens.length > 0) {
    await supabase
      .from("member_allergens")
      .insert(allergens.map((allergen) => ({ member_id: id, allergen })));
  }

  await supabase.from("member_dislikes").delete().eq("member_id", id);
  if (dislikes.length > 0) {
    await supabase
      .from("member_dislikes")
      .insert(dislikes.map((ingredient_id) => ({ member_id: id, ingredient_id })));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addMember(formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(40),
      kind: z.enum(["adulte", "enfant"]),
    })
    .safeParse({ name: formData.get("name"), kind: formData.get("kind") });

  if (!parsed.success) return { error: GENERIC };

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.from("members").insert({
    household_id: household.id,
    name: parsed.data.name,
    kind: parsed.data.kind,
  });

  if (error) return { error: GENERIC };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMember(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se supprimer soi-même laisserait le foyer sans compte propriétaire.
  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (member?.user_id && member.user_id === user?.id) {
    return { error: GENERIC };
  }

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { error: GENERIC };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveAiConfig(formData: FormData): Promise<ActionResult> {
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const apiKey = String(formData.get("api_key") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_household_ai_config", {
    p_provider: provider,
    p_model: model,
    p_api_key: apiKey,
  });

  if (error) {
    console.error("[parametres] configuration IA :", error.message);
    return { error: GENERIC };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearAiKey(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_household_ai_key");
  if (error) return { error: GENERIC };

  revalidatePath("/", "layout");
  return { ok: true };
}
