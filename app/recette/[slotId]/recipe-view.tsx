"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, SectionTitle } from "@/components/ui";
import { interpolate, lookup, type Dictionary, type Locale } from "@/lib/i18n";
import { markCooked } from "./actions";

export type RecipeIngredient = {
  name_fr: string;
  name_ja: string;
  quantity: number;
  unit: string;
};

export type RecipeData = {
  slotId: string;
  title_fr: string;
  title_ja: string;
  description_fr: string;
  description_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  ingredients: RecipeIngredient[];
  portions: number;
  prepMinutes: number;
  points: number;
  stars: number;
  cuisine: string;
  equipment: string[];
  alreadyCooked: boolean;
};

/**
 * Écran recette, pensé pour la cuisine (docs/03, parcours C3).
 *
 * Texte large, lisible à cinquante centimètres, étapes cochables une par une
 * pour retrouver où l'on en est, et écran qui ne s'éteint pas (RG-54).
 *
 * Les quantités sont celles du créneau, pas celles de la carte : une recette
 * prévue pour deux posée sur un créneau d'une personne affiche des quantités
 * pour une (RG-55).
 */
export function RecipeView({
  t,
  locale,
  recipe,
}: {
  t: Dictionary;
  locale: Locale;
  recipe: RecipeData;
}) {
  const ja = locale === "ja";
  const steps = ja ? recipe.steps_ja : recipe.steps_fr;
  const [done, setDone] = useState<Set<number>>(new Set());
  const [cooked, setCooked] = useState(recipe.alreadyCooked);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // RG-54 : l'écran ne doit pas s'éteindre pendant qu'on cuisine.
  // L'API n'existe pas partout ; son absence ne doit rien casser.
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      }
    ).wakeLock;

    if (wakeLock) {
      wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) void lock.release();
          else sentinel = lock;
        })
        .catch(() => {
          // Refusé par le navigateur ou onglet en arrière-plan : sans
          // conséquence, la recette reste lisible.
        });
    }

    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight">
          {ja ? recipe.title_ja : recipe.title_fr}
        </h1>
        <p className="text-sm text-muted">
          {t.cuisines[recipe.cuisine as "japonaise"]} · {recipe.points} pt ·{" "}
          {"★".repeat(recipe.stars)} ·{" "}
          {interpolate(t.booster.minutes, { count: recipe.prepMinutes })}
        </p>
        <p className="mt-1 text-base">
          {ja ? recipe.description_ja : recipe.description_fr}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <SectionTitle>
          {t.recipe.ingredients} ·{" "}
          {interpolate(t.recipe.adjusted, { count: recipe.portions })}
        </SectionTitle>
        <ul className="flex flex-col gap-2 text-base">
          {recipe.ingredients.map((item, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span>{ja ? item.name_ja : item.name_fr}</span>
              <span className="shrink-0 text-muted tabular-nums">
                {item.quantity} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {recipe.equipment.length > 0 ? (
        <p className="text-sm text-muted">
          {recipe.equipment.map((key) => t.equipment[key as "pan"]).join(" · ")}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionTitle>{t.recipe.steps}</SectionTitle>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => {
            const isDone = done.has(index);
            return (
              <li key={index}>
                {/* Étapes cochables : on retrouve où on en est après avoir
                    posé le téléphone pour remuer la casserole. */}
                <button
                  type="button"
                  onClick={() =>
                    setDone((previous) => {
                      const next = new Set(previous);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                  className="flex w-full items-start gap-3 rounded-xl p-2 text-left"
                >
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm tabular-nums ${
                      isDone
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span className={`text-base leading-relaxed ${isDone ? "text-muted" : ""}`}>
                    {step}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="text-xs text-muted">{t.recipe.screen_awake}</p>

      <div className="sticky bottom-0 mt-auto safe-bottom">
        {cooked ? (
          <p className="rounded-2xl border border-accent bg-surface px-4 py-3 text-center text-sm text-accent">
            {t.recipe.cooked_done}
          </p>
        ) : (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await markCooked(recipe.slotId);
                if (result?.error) setError(result.error);
                else setCooked(true);
              });
            }}
          >
            {pending ? t.common.loading : t.recipe.cooked}
          </Button>
        )}
        {error ? (
          <p className="mt-2 text-center text-sm text-danger">{lookup(t, error)}</p>
        ) : null}
      </div>
    </div>
  );
}
