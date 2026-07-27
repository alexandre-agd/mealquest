"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import {
  addDays,
  dayOfMonth,
  weekDates,
  weekdayLabel,
  type IsoDate,
} from "@/lib/week/dates";
import {
  availabilityKey,
  computeWeekNeeds,
  MEAL_SLOTS,
  nextStatus,
  statusOf,
  type AvailabilityMap,
  type AvailabilityStatus,
  type MealSlot,
  type MemberRef,
} from "@/lib/week/needs";
import { copyPreviousWeek, saveAvailabilities } from "./actions";

type Member = MemberRef & { name: string };

// Couleurs d'état, neutres : elles distinguent, elles ne jugent pas (P4).
const STATUS_STYLE: Record<AvailabilityStatus, string> = {
  maison: "border-accent bg-accent text-accent-foreground",
  bento: "border-accent bg-accent/15 text-foreground",
  exterieur: "border-border bg-background text-muted",
  libre: "border-dashed border-border bg-transparent text-muted",
};

export function WeekGrid({
  t,
  locale,
  weekStart,
  members,
  initialAvailabilities,
}: {
  t: Dictionary;
  locale: Locale;
  weekStart: IsoDate;
  members: Member[];
  initialAvailabilities: Record<string, AvailabilityStatus>;
}) {
  const [availabilities, setAvailabilities] = useState<AvailabilityMap>(
    () => new Map(Object.entries(initialAvailabilities)),
  );
  const [activeMemberId, setActiveMemberId] = useState(members[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const dates = useMemo(() => weekDates(weekStart), [weekStart]);
  const needs = useMemo(
    () => computeWeekNeeds(weekStart, members, availabilities),
    [weekStart, members, availabilities],
  );

  /**
   * Applique un lot de changements : l'écran se met à jour tout de suite,
   * l'enregistrement suit. La saisie est chronométrée, elle ne doit jamais
   * attendre le réseau (parcours B1).
   */
  function apply(
    changes: Array<{ memberId: string; date: IsoDate; slot: MealSlot; status: AvailabilityStatus }>,
  ) {
    if (changes.length === 0) return;

    setAvailabilities((previous) => {
      const next = new Map(previous);
      for (const change of changes) {
        next.set(
          availabilityKey(change.date, change.slot, change.memberId),
          change.status,
        );
      }
      return next;
    });

    startTransition(async () => {
      const result = await saveAvailabilities(changes);
      if (result?.error) setNotice(t.common.error_generic);
    });
  }

  function toggleCell(date: IsoDate, slot: MealSlot) {
    const current = statusOf(availabilities, date, slot, activeMemberId);
    apply([
      { memberId: activeMemberId, date, slot, status: nextStatus(slot, current) },
    ]);
  }

  /** A2.5 — un geste applique un statut à toute la ligne (tous les midis). */
  function cycleWholeRow(slot: MealSlot) {
    const current = statusOf(availabilities, dates[0], slot, activeMemberId);
    const target = nextStatus(slot, current);
    apply(
      dates.map((date) => ({
        memberId: activeMemberId,
        date,
        slot,
        status: target,
      })),
    );
  }

  /** RG-14 — recopier la semaine du membre courant sur les autres. */
  function copyToOtherMembers() {
    const others = members.filter((member) => member.id !== activeMemberId);
    if (others.length === 0) return;

    const changes = others.flatMap((member) =>
      dates.flatMap((date) =>
        MEAL_SLOTS.map((slot) => ({
          memberId: member.id,
          date,
          slot,
          status: statusOf(availabilities, date, slot, activeMemberId),
        })),
      ),
    );
    apply(changes);
    setNotice(t.week.copied);
  }

  function copyPrevious() {
    setNotice(null);
    startTransition(async () => {
      const result = await copyPreviousWeek(weekStart);
      if (result?.error) {
        setNotice(t.common.error_generic);
      } else if (result.copied === 0) {
        setNotice(t.week.nothing_to_copy);
      } else {
        // Le serveur a écrit : on relit plutôt que de deviner.
        window.location.reload();
      }
    });
  }

  function clearWeek() {
    apply(
      dates.flatMap((date) =>
        MEAL_SLOTS.map((slot) => ({
          memberId: activeMemberId,
          date,
          slot,
          status: "libre" as AvailabilityStatus,
        })),
      ),
    );
  }

  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Navigation de semaine */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/semainier?semaine=${previousWeek}`}
          aria-label={t.week.previous_week}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg"
        >
          ‹
        </Link>
        <p className="text-sm font-medium tabular-nums">
          {dayOfMonth(dates[0])} – {dayOfMonth(dates[6])}
        </p>
        <Link
          href={`/semainier?semaine=${nextWeek}`}
          aria-label={t.week.next_week}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-lg"
        >
          ›
        </Link>
      </div>

      {/* A2.4 — bascule d'un membre à l'autre en un seul geste */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setActiveMemberId(member.id)}
            aria-pressed={member.id === activeMemberId}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors ${
              member.id === activeMemberId
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface"
            }`}
          >
            {member.name}
          </button>
        ))}
      </div>

      {/* Grille 7 jours × 2 créneaux (A2.1) */}
      <div className="grid grid-cols-[2.75rem_1fr_1fr] gap-1.5">
        <div />
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => cycleWholeRow(slot)}
            title={t.week.apply_to_row}
            className="min-h-9 rounded-lg border border-border bg-surface text-xs font-medium text-muted"
          >
            {slot === "midi" ? t.week.lunch : t.week.dinner}
          </button>
        ))}

        {dates.map((date) => (
          <FragmentRow
            key={date}
            date={date}
            locale={locale}
            t={t}
            availabilities={availabilities}
            memberId={activeMemberId}
            onToggle={toggleCell}
          />
        ))}
      </div>

      {/* Raccourcis (RG-14) */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copyPrevious} disabled={pending}>
          {t.week.copy_previous_week}
        </Button>
        {members.length > 1 ? (
          <Button variant="secondary" onClick={copyToOtherMembers} disabled={pending}>
            {t.week.copy_to_other_members}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={clearWeek} disabled={pending}>
          {t.week.clear_week}
        </Button>
      </div>

      {notice ? <p className="text-sm text-muted">{notice}</p> : null}

      {/* A2.7 — compteur permanent, visible sans défiler */}
      <div className="sticky bottom-0 mt-auto safe-bottom">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
          <p className="text-sm font-medium">
            {interpolate(t.week.counter, {
              dinners: needs.totalDinners,
              bentos: needs.totalBentos,
            })}
          </p>
          {needs.orphanLunches.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted">
              {interpolate(t.week.orphan_lunches, {
                count: needs.orphanLunches.length,
              })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  date,
  locale,
  t,
  availabilities,
  memberId,
  onToggle,
}: {
  date: IsoDate;
  locale: Locale;
  t: Dictionary;
  availabilities: AvailabilityMap;
  memberId: string;
  onToggle: (date: IsoDate, slot: MealSlot) => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center justify-center">
        <span className="text-[0.65rem] uppercase text-muted">
          {weekdayLabel(date, locale)}
        </span>
        <span className="text-sm tabular-nums">{dayOfMonth(date)}</span>
      </div>

      {MEAL_SLOTS.map((slot) => {
        const status = statusOf(availabilities, date, slot, memberId);
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onToggle(date, slot)}
            aria-label={`${weekdayLabel(date, locale)} ${
              slot === "midi" ? t.week.lunch : t.week.dinner
            } — ${t.week.status[status]}`}
            className={`min-h-12 rounded-xl border text-sm transition-colors ${STATUS_STYLE[status]}`}
          >
            {t.week.status_short[status]}
          </button>
        );
      })}
    </>
  );
}
