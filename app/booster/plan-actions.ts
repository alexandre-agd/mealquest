"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { loadAvailabilities } from "@/lib/week/queries";
import { computeWeekNeeds } from "@/lib/week/needs";
import { addDays, startOfWeek, type IsoDate } from "@/lib/week/dates";

export type PlanResult = { ok?: true; error?: string; placed?: number };

const GENERIC = "common.error_generic";

/**
 * Place les cartes retenues sur les créneaux qui ont un besoin (RG-43).
 *
 * Les cartes sont posées dans l'ordre des dîners de la semaine. Le verso
 * d'une carte standard suit automatiquement au lendemain midi, mais
 * seulement si un besoin y existe : sinon il reste consultable sur la carte
 * sans occuper de créneau ni compter de points (RG-44).
 *
 * Les portions viennent du besoin réel, jamais des portions de référence de
 * la carte (RG-55) : c'est ce qui permet un dîner pour deux et un bento pour
 * une seule personne.
 */
export async function assignCards(
  weekStartInput: string,
  cardIds: string[],
): Promise<PlanResult> {
  const parsed = z
    .object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      cardIds: z.array(z.string().uuid()).max(30),
    })
    .safeParse({ weekStart: weekStartInput, cardIds });

  if (!parsed.success) return { error: GENERIC };
  if (parsed.data.cardIds.length === 0) return { ok: true, placed: 0 };

  const weekStart = startOfWeek(parsed.data.weekStart) as IsoDate;

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();

  const { data: planId, error: planError } = await supabase.rpc("open_week_plan", {
    p_week_start: weekStart,
  });
  if (planError || !planId) return { error: GENERIC };

  // Les cartes retenues, avec leur verso éventuel.
  const { data: cards } = await supabase
    .from("cards")
    .select("id, type, points, card_versos(points)")
    .in("id", parsed.data.cardIds);

  if (!cards || cards.length === 0) return { error: GENERIC };

  const members = household.members.map((m) => ({ id: m.id, kind: m.kind }));
  const availabilities = await loadAvailabilities(weekStart);
  const needs = computeWeekNeeds(weekStart, members, availabilities);

  // Les créneaux déjà occupés ne sont pas écrasés : une relance du booster
  // ne détruit pas ce qui a été placé (RG-42).
  const { data: existing } = await supabase
    .from("planned_slots")
    .select("date, slot")
    .eq("week_plan_id", planId);

  const occupied = new Set(
    (existing ?? []).map((row) => `${row.date}|${row.slot}`),
  );

  const lunchByDate = new Map(needs.lunches.map((need) => [need.date, need]));
  const rows: Array<Record<string, unknown>> = [];

  // Les cartes standard couvrent les dîners ; les lunch_solo, les midis
  // orphelins. On respecte l'ordre de la semaine.
  const standards = cards.filter((c) => c.type === "standard" || c.type === "waouh");
  const lunchSolos = cards.filter((c) => c.type === "lunch_solo");

  const freeDinners = needs.dinners.filter(
    (need) => !occupied.has(`${need.date}|soir`),
  );

  for (const [index, need] of freeDinners.entries()) {
    const card = standards[index];
    if (!card) break;

    rows.push({
      week_plan_id: planId,
      date: need.date,
      slot: "soir",
      card_id: card.id,
      is_verso: false,
      portions: need.portions,
      points: card.points,
    });
    occupied.add(`${need.date}|soir`);

    // RG-43 : le verso se place au lendemain midi s'il y a un besoin.
    const versoPoints = (
      Array.isArray(card.card_versos) ? card.card_versos[0] : card.card_versos
    )?.points;

    const nextDay = addDays(need.date, 1);
    const lunch = lunchByDate.get(nextDay);

    if (
      versoPoints !== undefined &&
      lunch &&
      !occupied.has(`${nextDay}|midi`)
    ) {
      rows.push({
        week_plan_id: planId,
        date: nextDay,
        slot: "midi",
        card_id: card.id,
        is_verso: true,
        // Portions du besoin du lendemain, pas celles du dîner (RG-19).
        portions: lunch.portions,
        points: versoPoints,
      });
      occupied.add(`${nextDay}|midi`);
    }
  }

  const freeOrphans = needs.orphanLunches.filter(
    (need) => !occupied.has(`${need.date}|midi`),
  );

  for (const [index, need] of freeOrphans.entries()) {
    const card = lunchSolos[index];
    if (!card) break;

    rows.push({
      week_plan_id: planId,
      date: need.date,
      slot: "midi",
      card_id: card.id,
      is_verso: false,
      portions: need.portions,
      points: card.points,
    });
    occupied.add(`${need.date}|midi`);
  }

  if (rows.length === 0) return { ok: true, placed: 0 };

  const { error } = await supabase.from("planned_slots").insert(rows);
  if (error) {
    console.error("[planning] affectation :", error.message);
    return { error: GENERIC };
  }

  // Les cartes posées passent de « proposée » à « planifiée » (RG-27).
  const placedCardIds = [...new Set(rows.map((row) => row.card_id as string))];
  await supabase
    .from("cards")
    .update({ status: "planifiee" })
    .in("id", placedCardIds);

  revalidatePath("/booster");
  revalidatePath("/");

  return { ok: true, placed: rows.length };
}

/** Retire une affectation. Tout est réversible côté utilisateur (P7, RG-45). */
export async function clearSlot(slotId: string): Promise<PlanResult> {
  if (!z.string().uuid().safeParse(slotId).success) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.from("planned_slots").delete().eq("id", slotId);
  if (error) return { error: GENERIC };

  revalidatePath("/booster");
  revalidatePath("/");
  return { ok: true };
}

/** Pose une carte neutre sur un créneau (RG-28). */
export async function setNeutralCard(
  weekStartInput: string,
  date: string,
  slot: "midi" | "soir",
  neutral: "restaurant" | "libre" | "restes",
): Promise<PlanResult> {
  const parsed = z
    .object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.enum(["midi", "soir"]),
      neutral: z.enum(["restaurant", "libre", "restes"]),
    })
    .safeParse({ weekStart: weekStartInput, date, slot, neutral });

  if (!parsed.success) return { error: GENERIC };

  const supabase = await createClient();
  const { data: planId } = await supabase.rpc("open_week_plan", {
    p_week_start: startOfWeek(parsed.data.weekStart),
  });
  if (!planId) return { error: GENERIC };

  // Points fixes des cartes neutres (RG-28).
  const points = { restaurant: 4, libre: 2, restes: 0 }[parsed.data.neutral];

  await supabase
    .from("planned_slots")
    .delete()
    .eq("week_plan_id", planId)
    .eq("date", parsed.data.date)
    .eq("slot", parsed.data.slot);

  const { error } = await supabase.from("planned_slots").insert({
    week_plan_id: planId,
    date: parsed.data.date,
    slot: parsed.data.slot,
    neutral: parsed.data.neutral,
    portions: 1,
    points,
  });

  if (error) return { error: GENERIC };

  revalidatePath("/booster");
  revalidatePath("/");
  return { ok: true, placed: 1 };
}
