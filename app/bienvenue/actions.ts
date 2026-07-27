"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/lib/i18n";
import { ALLERGEN_FAMILIES, EQUIPMENT_KEYS } from "@/lib/household/equipment";
import { HOUSEHOLD_GOALS } from "@/lib/household/budget";

// La saisie est validée ici avant d'atteindre la base : les contraintes SQL
// sont le dernier rempart, pas le premier.
const OnboardingSchema = z.object({
  name: z.string().trim().min(1).max(60),
  goal: z.enum(HOUSEHOLD_GOALS as [string, ...string[]]),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        kind: z.enum(["adulte", "enfant"]),
        locale: z.enum(locales as unknown as [string, ...string[]]),
        allergens: z.array(z.enum(ALLERGEN_FAMILIES as unknown as [string, ...string[]])),
      }),
    )
    .min(1)
    .max(12),
  equipment: z.array(z.enum(EQUIPMENT_KEYS as unknown as [string, ...string[]])),
});

export type OnboardingPayload = z.input<typeof OnboardingSchema>;

export async function completeOnboarding(
  payload: OnboardingPayload,
): Promise<{ error?: string }> {
  const parsed = OnboardingSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: "common.error_generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_goal: parsed.data.goal,
    p_members: parsed.data.members,
    p_equipment: parsed.data.equipment,
  });

  if (error) {
    console.error("[onboarding] création du foyer impossible :", error.message);
    return { error: "common.error_generic" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
