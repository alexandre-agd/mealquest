import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/week/dates";

export type PlannedSlot = {
  id: string;
  date: IsoDate;
  slot: "midi" | "soir";
  isVerso: boolean;
  neutral: string | null;
  portions: number;
  points: number;
  cardId: string | null;
  title_fr: string;
  title_ja: string;
};

type Titled = { title_fr: string; title_ja: string };
type VersoHolder = { card_versos: Titled | Titled[] | null };

function firstRelation<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

/** Ce qui est posé sur le semainier pour une semaine donnée. */
export async function loadPlannedSlots(weekStart: IsoDate): Promise<PlannedSlot[]> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("week_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) return [];

  const { data, error } = await supabase
    .from("planned_slots")
    .select(
      `id, date, slot, is_verso, neutral, portions, points, card_id,
       cards ( title_fr, title_ja ),
       card_versos_ref:cards ( card_versos ( title_fr, title_ja ) )`,
    )
    .eq("week_plan_id", plan.id)
    .order("date")
    .order("slot");

  if (error) {
    console.error("[planning] lecture :", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const card = firstRelation(
      row.cards as unknown as Titled | Titled[] | null,
    );

    // Un créneau occupé par un verso porte le titre du verso, pas celui du
    // recto : c'est un autre repas, avec ses propres étapes (RG-21).
    const versoHolder = firstRelation(
      row.card_versos_ref as unknown as VersoHolder | VersoHolder[] | null,
    );
    const verso = versoHolder ? firstRelation(versoHolder.card_versos) : null;

    const useVerso = row.is_verso && verso;

    return {
      id: row.id,
      date: row.date as IsoDate,
      slot: row.slot as "midi" | "soir",
      isVerso: row.is_verso,
      neutral: row.neutral,
      portions: row.portions,
      points: row.points,
      cardId: row.card_id,
      title_fr: useVerso ? verso.title_fr : (card?.title_fr ?? ""),
      title_ja: useVerso ? verso.title_ja : (card?.title_ja ?? ""),
    };
  });
}
