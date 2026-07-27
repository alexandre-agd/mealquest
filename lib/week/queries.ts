import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, weekDates, type IsoDate } from "./dates";
import {
  availabilityKey,
  type AvailabilityMap,
  type AvailabilityStatus,
  type MealSlot,
} from "./needs";

/**
 * Charge les disponibilités d'une semaine.
 *
 * La veille du lundi est incluse volontairement : sans elle, impossible de
 * savoir si le lundi midi est couvert par le dîner du dimanche ou s'il est
 * orphelin (RG-17).
 *
 * Aucun filtre par foyer : c'est RLS qui restreint (RG-63).
 */
export async function loadAvailabilities(
  weekStart: IsoDate,
): Promise<AvailabilityMap> {
  const supabase = await createClient();
  const dates = weekDates(weekStart);

  const { data, error } = await supabase
    .from("availabilities")
    .select("member_id, date, slot, status")
    .gte("date", addDays(weekStart, -1))
    .lte("date", dates[6]);

  if (error) {
    console.error("[semainier] lecture des disponibilités :", error.message);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [
      availabilityKey(row.date as IsoDate, row.slot as MealSlot, row.member_id),
      row.status as AvailabilityStatus,
    ]),
  );
}

/** Y a-t-il au moins une saisie sur la semaine ? Sert au raccourci de copie. */
export async function hasAnyAvailability(weekStart: IsoDate): Promise<boolean> {
  const supabase = await createClient();
  const dates = weekDates(weekStart);

  const { count } = await supabase
    .from("availabilities")
    .select("id", { count: "exact", head: true })
    .gte("date", dates[0])
    .lte("date", dates[6])
    .neq("status", "libre");

  return (count ?? 0) > 0;
}
