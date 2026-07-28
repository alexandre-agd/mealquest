"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, SectionTitle } from "@/components/ui";
import { getDictionary, interpolate, type Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingList } from "@/lib/shopping/compute";
import type { FreeLine } from "@/lib/shopping/queries";
import {
  addFreeLine,
  removeFreeLine,
  toggleCheck,
  toggleFreeLine,
} from "./actions";

/**
 * Liste de courses.
 *
 * Seul écran de l'application où les deux langues cohabitent (RG-49) : on
 * fait les courses à deux, ou séparément, et la ligne doit être comprise par
 * le conjoint comme par la caissière.
 *
 * Contexte d'usage : une main occupée, en marchant, réseau parfois faible.
 * D'où des cases larges, un état optimiste, et aucune confirmation.
 */
// Les noms de rayons en japonais, quelle que soit la langue du membre :
// l'en-tête de rayon est bilingue comme les lignes (RG-49).
const aisleJa = getDictionary("ja").categories;

export function ShoppingListScreen({
  t,
  planId,
  list,
  initialChecked,
  initialFreeLines,
  supabaseConfig,
}: {
  t: Dictionary;
  planId: string | null;
  list: ShoppingList;
  initialChecked: string[];
  initialFreeLines: FreeLine[];
  supabaseConfig: { url: string; anonKey: string };
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  const [freeLines, setFreeLines] = useState<FreeLine[]>(initialFreeLines);
  const [newLabel, setNewLabel] = useState("");
  const [, startTransition] = useTransition();

  // RG-50 : l'état coché est partagé. Quand l'un coche au rayon fruits,
  // l'autre le voit depuis le rayon poisson.
  useEffect(() => {
    if (!planId) return;

    const supabase = createClient(supabaseConfig);
    const channel = supabase
      .channel(`courses-${planId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_checks",
          filter: `week_plan_id=eq.${planId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { ingredient_id?: string };
          if (!row?.ingredient_id) return;
          setChecked((previous) => {
            const next = new Set(previous);
            if (payload.eventType === "DELETE") next.delete(row.ingredient_id!);
            else next.add(row.ingredient_id!);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_free_lines",
          filter: `week_plan_id=eq.${planId}`,
        },
        () => {
          // Les lignes libres changent rarement : un rechargement complet
          // reste plus simple qu'une réconciliation ligne à ligne.
          window.location.reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId, supabaseConfig]);

  function toggle(ingredientId: string) {
    if (!planId) return;
    const willCheck = !checked.has(ingredientId);

    setChecked((previous) => {
      const next = new Set(previous);
      if (willCheck) next.add(ingredientId);
      else next.delete(ingredientId);
      return next;
    });

    startTransition(async () => {
      await toggleCheck(planId, ingredientId, willCheck);
    });
  }

  const totalLines = list.toBuy.reduce((sum, group) => sum + group.lines.length, 0);
  const remaining =
    totalLines - list.toBuy.flatMap((g) => g.lines).filter((l) => checked.has(l.ingredientId)).length;

  if (!planId || (totalLines === 0 && list.pantry.length === 0)) {
    return (
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm">{t.shopping.empty}</p>
        <p className="text-sm text-muted">{t.shopping.empty_hint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {list.toBuy.map((group) => (
        <section key={group.aisle} className="flex flex-col gap-2">
          <SectionTitle>
            {t.categories[group.aisle]} · <span lang="ja">{aisleJa[group.aisle]}</span>
          </SectionTitle>

          <ul className="flex flex-col divide-y divide-border">
            {group.lines.map((line) => {
              const isChecked = checked.has(line.ingredientId);
              return (
                <li key={line.ingredientId}>
                  <button
                    type="button"
                    onClick={() => toggle(line.ingredientId)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm ${
                        isChecked
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border"
                      }`}
                    >
                      {isChecked ? "✓" : ""}
                    </span>

                    {/* RG-49 : les deux langues, toujours, sur la même ligne */}
                    <span
                      className={`min-w-0 flex-1 ${isChecked ? "text-muted line-through" : ""}`}
                    >
                      <span className="block text-base leading-tight">{line.name_fr}</span>
                      <span lang="ja" className="block text-base leading-tight">
                        {line.name_ja}
                      </span>
                    </span>

                    <span
                      className={`shrink-0 text-base tabular-nums ${isChecked ? "text-muted" : ""}`}
                    >
                      {line.quantity} {line.unit}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {list.probablyEnough.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>{t.shopping.probably_enough}</SectionTitle>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {list.probablyEnough.map((line) => (
              <li key={line.ingredientId}>
                {line.name_fr} · <span lang="ja">{line.name_ja}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Rubrique placard : sans quantité, on vérifie seulement (RG-47) */}
      {list.pantry.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionTitle>{t.shopping.pantry}</SectionTitle>
          <ul className="flex flex-col gap-1 text-sm text-muted">
            {list.pantry.map((item) => (
              <li key={item.ingredientId}>
                {item.name_fr} · <span lang="ja">{item.name_ja}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle>{t.shopping.free_lines}</SectionTitle>

        <ul className="flex flex-col divide-y divide-border">
          {freeLines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => {
                  const next = !line.checked;
                  setFreeLines((prev) =>
                    prev.map((l) => (l.id === line.id ? { ...l, checked: next } : l)),
                  );
                  startTransition(async () => {
                    await toggleFreeLine(line.id, next);
                  });
                }}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm ${
                    line.checked
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border"
                  }`}
                >
                  {line.checked ? "✓" : ""}
                </span>
                <span className={line.checked ? "text-muted line-through" : ""}>
                  {line.label}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await removeFreeLine(line.id);
                    setFreeLines((prev) => prev.filter((l) => l.id !== line.id));
                  })
                }
                className="shrink-0 text-xs text-muted underline underline-offset-4"
              >
                {t.common.delete}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder={t.shopping.add_placeholder}
            aria-label={t.shopping.add_placeholder}
            className="flex-1"
          />
          <Button
            variant="secondary"
            disabled={!newLabel.trim() || !planId}
            onClick={() => {
              const label = newLabel.trim();
              setNewLabel("");
              startTransition(async () => {
                await addFreeLine(planId!, label);
                window.location.reload();
              });
            }}
          >
            {t.shopping.add}
          </Button>
        </div>
      </section>

      <div className="sticky bottom-0 mt-auto safe-bottom">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
          <p className="text-sm font-medium tabular-nums">
            {interpolate(t.shopping.remaining, { count: remaining })}
          </p>
        </div>
      </div>
    </div>
  );
}
