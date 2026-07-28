"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card as Panel, ErrorText, Field, Input, SectionTitle } from "@/components/ui";
import { lookup, type Dictionary, type Locale } from "@/lib/i18n";
import { CUISINES } from "@/lib/ai/types";
import { INGREDIENT_UNITS, type IngredientUnit } from "@/lib/inventory/ingredients";
import { createManualCard } from "./manual-actions";

export type IngredientChoice = {
  id: string;
  name_fr: string;
  name_ja: string;
  default_unit: string;
};

type Line = { ingredientId: string; label: string; quantity: string; unit: IngredientUnit };

/**
 * Saisie manuelle d'une carte (RG-61).
 *
 * Formulaire volontairement long : c'est un chemin de repli, pas le parcours
 * principal. Il doit être complet — une carte incomplète fausserait la liste
 * de courses — mais il n'a pas à tenir dans le budget de temps du dimanche
 * soir, qui concerne le booster.
 */
export function ManualCardForm({
  t,
  locale,
  weekStart,
  ingredients,
  onDone,
}: {
  t: Dictionary;
  locale: Locale;
  weekStart: string;
  ingredients: IngredientChoice[];
  onDone: () => void;
}) {
  const ja = locale === "ja";
  const [titleFr, setTitleFr] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [descFr, setDescFr] = useState("");
  const [descJa, setDescJa] = useState("");
  const [stepsFr, setStepsFr] = useState("");
  const [stepsJa, setStepsJa] = useState("");
  const [cuisine, setCuisine] = useState<string>("japonaise");
  const [points, setPoints] = useState(3);
  const [minutes, setMinutes] = useState(30);
  const [portions, setPortions] = useState(2);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label = (i: IngredientChoice) => (ja ? i.name_ja : i.name_fr);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return ingredients
      .filter(
        (i) =>
          i.name_fr.toLowerCase().includes(needle) || i.name_ja.includes(query.trim()),
      )
      .slice(0, 6);
  }, [ingredients, query]);

  const splitSteps = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const complete =
    titleFr.trim() &&
    titleJa.trim() &&
    descFr.trim() &&
    descJa.trim() &&
    splitSteps(stepsFr).length > 0 &&
    splitSteps(stepsJa).length > 0 &&
    lines.length > 0;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createManualCard({
        weekStart,
        type: "standard",
        cuisine,
        points,
        prepMinutes: minutes,
        portions,
        titleFr: titleFr.trim(),
        titleJa: titleJa.trim(),
        descriptionFr: descFr.trim(),
        descriptionJa: descJa.trim(),
        stepsFr: splitSteps(stepsFr),
        stepsJa: splitSteps(stepsJa),
        ingredients: lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: Number(line.quantity) || 0,
          unit: line.unit,
        })),
      });

      if (result?.error) setError(result.error);
      else {
        onDone();
        window.location.reload();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{t.manual.title}</h2>
          <Button
            variant="secondary"
            className="!min-h-10 shrink-0 !px-4 text-sm"
            onClick={onDone}
          >
            {t.common.cancel}
          </Button>
        </div>

        <p className="text-sm text-muted">{t.manual.help}</p>

        <Panel className="flex flex-col gap-3">
          <SectionTitle>{t.manual.in_french}</SectionTitle>
          <Field label={t.manual.card_title}>
            <Input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} lang="fr" />
          </Field>
          <Field label={t.manual.description}>
            <Input value={descFr} onChange={(e) => setDescFr(e.target.value)} lang="fr" />
          </Field>
          <Field label={t.manual.steps}>
            <textarea
              value={stepsFr}
              onChange={(e) => setStepsFr(e.target.value)}
              rows={5}
              lang="fr"
              className="rounded-xl border border-border bg-surface p-3 text-base outline-none focus:border-accent"
            />
          </Field>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionTitle>{t.manual.in_japanese}</SectionTitle>
          <Field label={t.manual.card_title}>
            <Input value={titleJa} onChange={(e) => setTitleJa(e.target.value)} lang="ja" />
          </Field>
          <Field label={t.manual.description}>
            <Input value={descJa} onChange={(e) => setDescJa(e.target.value)} lang="ja" />
          </Field>
          <Field label={t.manual.steps}>
            <textarea
              value={stepsJa}
              onChange={(e) => setStepsJa(e.target.value)}
              rows={5}
              lang="ja"
              className="rounded-xl border border-border bg-surface p-3 text-base outline-none focus:border-accent"
            />
          </Field>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t.manual.cuisine}</span>
            <div className="flex flex-wrap gap-1.5">
              {CUISINES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCuisine(option)}
                  aria-pressed={cuisine === option}
                  className={`min-h-9 rounded-full border px-3 text-xs ${
                    cuisine === option
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface"
                  }`}
                >
                  {t.cuisines[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label={t.manual.points}>
              <Input
                type="number"
                min={1}
                max={5}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </Field>
            <Field label={t.manual.minutes}>
              <Input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </Field>
            <Field label={t.manual.portions}>
              <Input
                type="number"
                min={1}
                value={portions}
                onChange={(e) => setPortions(Number(e.target.value))}
              />
            </Field>
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <SectionTitle>{t.manual.ingredients}</SectionTitle>

          {lines.map((line, index) => (
            <div key={index} className="flex items-end gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{line.label}</span>
              <Input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === index ? { ...l, quantity: e.target.value } : l,
                    ),
                  )
                }
                className="w-20 shrink-0"
                aria-label={t.manual.quantity}
              />
              <select
                value={line.unit}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === index ? { ...l, unit: e.target.value as IngredientUnit } : l,
                    ),
                  )
                }
                className="min-h-12 shrink-0 rounded-xl border border-border bg-surface px-2 text-sm"
              >
                {INGREDIENT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t.custom_ingredient.units[unit]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                className="shrink-0 pb-3 text-xs text-muted underline"
              >
                {t.common.delete}
              </button>
            </div>
          ))}

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.manual.search_ingredient}
            aria-label={t.manual.search_ingredient}
            type="search"
          />

          {matches.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((ingredient) => (
                <button
                  key={ingredient.id}
                  type="button"
                  onClick={() => {
                    setLines((prev) => [
                      ...prev,
                      {
                        ingredientId: ingredient.id,
                        label: label(ingredient),
                        quantity: "100",
                        unit: (INGREDIENT_UNITS as readonly string[]).includes(
                          ingredient.default_unit,
                        )
                          ? (ingredient.default_unit as IngredientUnit)
                          : "g",
                      },
                    ]);
                    setQuery("");
                  }}
                  className="min-h-9 rounded-full border border-border bg-surface px-3 text-xs"
                >
                  + {label(ingredient)}
                </button>
              ))}
            </div>
          ) : null}
        </Panel>

        {error ? <ErrorText>{lookup(t, error)}</ErrorText> : null}

        <div className="safe-bottom">
          <Button className="w-full" onClick={submit} disabled={pending || !complete}>
            {pending ? t.common.loading : t.manual.create}
          </Button>
        </div>
      </div>
    </div>
  );
}
