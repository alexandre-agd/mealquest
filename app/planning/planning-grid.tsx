"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card as Panel, ErrorText } from "@/components/ui";
import { interpolate, lookup, type Dictionary, type Locale } from "@/lib/i18n";
import { dayOfMonth, weekdayLabel, type IsoDate } from "@/lib/week/dates";
import { MEAL_SLOTS, type MealSlot } from "@/lib/week/needs";
import type { PlannedSlot } from "@/lib/cards/planning";
import { clearSlot, setNeutralCard } from "../booster/plan-actions";

const NEUTRALS = ["restaurant", "libre", "restes"] as const;

export type NeedCell = { date: IsoDate; slot: MealSlot; portions: number };

export function PlanningGrid({
  t,
  locale,
  weekStart,
  dates,
  slots,
  needs,
  pointsBudget,
}: {
  t: Dictionary;
  locale: Locale;
  weekStart: string;
  dates: IsoDate[];
  slots: PlannedSlot[];
  needs: NeedCell[];
  pointsBudget: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Créneau vide sur lequel on propose les cartes neutres.
  const [openCell, setOpenCell] = useState<string | null>(null);

  const ja = locale === "ja";
  const byCell = new Map(slots.map((s) => [`${s.date}|${s.slot}`, s]));
  const needByCell = new Map(needs.map((n) => [`${n.date}|${n.slot}`, n]));

  const usedPoints = slots.reduce((total, slot) => total + slot.points, 0);
  // Un créneau qui a un besoin mais reste vide est signalé, sans bloquer (RG-46).
  const emptyNeeds = needs.filter((n) => !byCell.has(`${n.date}|${n.slot}`));

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setOpenCell(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {error ? <ErrorText>{lookup(t, error)}</ErrorText> : null}

      <div className="flex flex-col gap-3">
        {dates.map((date) => (
          <div key={date} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase text-muted">
              {weekdayLabel(date, locale)} {dayOfMonth(date)}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {MEAL_SLOTS.map((slot) => {
                const cell = `${date}|${slot}`;
                const placed = byCell.get(cell);
                const need = needByCell.get(cell);

                if (placed) {
                  const title = ja ? placed.title_ja : placed.title_fr;
                  return (
                    <Panel key={slot} className="!p-3">
                      <p className="text-[0.65rem] uppercase text-muted">
                        {slot === "midi" ? t.week.lunch : t.week.dinner}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">
                        {placed.neutral
                          ? t.booster.neutral[placed.neutral as "restaurant"]
                          : title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {placed.isVerso ? `${t.planning.verso} · ` : ""}
                        {interpolate(t.booster.portions, { count: placed.portions })} ·{" "}
                        {placed.points} pt
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        {placed.cardId ? (
                          <Link
                            href={`/recette/${placed.id}`}
                            className="text-xs font-medium text-accent underline underline-offset-4"
                          >
                            {t.recipe.title}
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => clearSlot(placed.id))}
                          className="text-xs text-muted underline underline-offset-4"
                        >
                          {t.common.delete}
                        </button>
                      </div>
                    </Panel>
                  );
                }

                return (
                  <div key={slot} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenCell(openCell === cell ? null : cell)}
                      className={`min-h-[4.5rem] rounded-2xl border border-dashed p-3 text-left ${
                        need ? "border-accent/60" : "border-border"
                      }`}
                    >
                      <span className="block text-[0.65rem] uppercase text-muted">
                        {slot === "midi" ? t.week.lunch : t.week.dinner}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {need ? t.planning.to_fill : t.planning.no_need}
                      </span>
                    </button>

                    {/* Cartes neutres, accessibles en permanence (RG-28) */}
                    {openCell === cell ? (
                      <div className="flex flex-wrap gap-1">
                        {NEUTRALS.map((neutral) => (
                          <button
                            key={neutral}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                setNeutralCard(weekStart, date, slot, neutral),
                              )
                            }
                            className="min-h-9 rounded-full border border-border bg-surface px-3 text-xs"
                          >
                            {t.booster.neutral[neutral]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-auto safe-bottom">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
          <p className="text-sm font-medium tabular-nums">
            {interpolate(t.booster.points_counter, {
              used: usedPoints,
              budget: pointsBudget,
            })}
          </p>
          {emptyNeeds.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted">
              {interpolate(t.planning.empty_needs, { count: emptyNeeds.length })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
