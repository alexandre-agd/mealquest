"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { addDays, weekDates, type IsoDate } from "@/lib/week/dates";
import {
  AVAILABILITY_STATUSES,
  MEAL_SLOTS,
  isStatusAllowed,
  type AvailabilityStatus,
  type MealSlot,
} from "@/lib/week/needs";

export type WeekActionResult = { ok?: true; error?: string };

const GENERIC = "common.error_generic";

const EntrySchema = z.object({
  memberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(MEAL_SLOTS as unknown as [string, ...string[]]),
  status: z.enum(AVAILABILITY_STATUSES as unknown as [string, ...string[]]),
});

export type AvailabilityEntry = z.input<typeof EntrySchema>;

/**
 * Enregistre un lot de cases.
 *
 * L'écran envoie toujours des lots, jamais des cases isolées : un raccourci
 * en modifie sept ou quatorze d'un coup, et la saisie est chronométrée
 * (60 secondes à deux, A2.13). Un aller-retour réseau par case rendrait ce
 * budget intenable.
 */
export async function saveAvailabilities(
  entries: AvailabilityEntry[],
): Promise<WeekActionResult> {
  const parsed = z.array(EntrySchema).max(500).safeParse(entries);
  if (!parsed.success) return { error: GENERIC };
  if (parsed.data.length === 0) return { ok: true };

  // RG-12 : le bento n'existe qu'au déjeuner. La base refuserait la ligne de
  // toute façon, mais autant ne pas lui envoyer une saisie incohérente.
  const invalid = parsed.data.find(
    (entry) =>
      !isStatusAllowed(entry.slot as MealSlot, entry.status as AvailabilityStatus),
  );
  if (invalid) return { error: GENERIC };

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  // Un membre d'un autre foyer serait de toute façon rejeté par RLS ; on
  // s'arrête avant, pour renvoyer une erreur claire plutôt qu'un échec muet.
  const memberIds = new Set(household.members.map((m) => m.id));
  if (parsed.data.some((entry) => !memberIds.has(entry.memberId))) {
    return { error: GENERIC };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("availabilities").upsert(
    parsed.data.map((entry) => ({
      member_id: entry.memberId,
      date: entry.date,
      slot: entry.slot,
      status: entry.status,
    })),
    { onConflict: "member_id,date,slot" },
  );

  if (error) {
    console.error("[semainier] enregistrement :", error.message);
    return { error: GENERIC };
  }

  revalidatePath("/semainier");
  return { ok: true };
}

/**
 * Recopie la semaine précédente sur la semaine affichée (RG-14).
 * Raccourci exigé par la MOA, pas un confort : sans lui, la saisie
 * hebdomadaire ne tient pas dans son budget de temps.
 */
export async function copyPreviousWeek(
  weekStart: IsoDate,
): Promise<WeekActionResult & { copied?: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: GENERIC };

  const household = await getCurrentHousehold();
  if (!household) return { error: GENERIC };

  const supabase = await createClient();
  const previousStart = addDays(weekStart, -7);
  const previousDates = weekDates(previousStart);

  const { data, error } = await supabase
    .from("availabilities")
    .select("member_id, date, slot, status")
    .gte("date", previousDates[0])
    .lte("date", previousDates[6])
    .neq("status", "libre");

  if (error) {
    console.error("[semainier] lecture de la semaine précédente :", error.message);
    return { error: GENERIC };
  }

  if (!data || data.length === 0) {
    return { ok: true, copied: 0 };
  }

  const { error: upsertError } = await supabase.from("availabilities").upsert(
    data.map((row) => ({
      member_id: row.member_id,
      // Même jour de la semaine, sept jours plus tard.
      date: addDays(row.date as IsoDate, 7),
      slot: row.slot,
      status: row.status,
    })),
    { onConflict: "member_id,date,slot" },
  );

  if (upsertError) {
    console.error("[semainier] copie :", upsertError.message);
    return { error: GENERIC };
  }

  revalidatePath("/semainier");
  return { ok: true, copied: data.length };
}
