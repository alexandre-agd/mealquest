"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import { STOCK_LEVELS } from "@/lib/config/business-rules";
import type { PerishableIngredient } from "@/lib/inventory/queries";
import { saveInventory } from "./actions";

// Ordre du parcours en magasin (RG-48), réutilisé ici pour regrouper.
const CATEGORY_ORDER = [
  "vegetables",
  "fruits",
  "fish",
  "meat",
  "dairy_eggs",
  "soy",
  "frozen",
  "dry_goods",
  "condiments",
  "drinks",
  "other",
];

export function InventoryList({
  t,
  locale,
  weekStart,
  ingredients,
  initialLevels,
  preloaded,
}: {
  t: Dictionary;
  locale: Locale;
  weekStart: string;
  ingredients: PerishableIngredient[];
  initialLevels: Record<string, number>;
  preloaded: boolean;
}) {
  const [levels, setLevels] = useState<Record<string, number>>(initialLevels);
  // Figé à l'ouverture : dès que le préchargement est enregistré, le serveur
  // ne considère plus la semaine comme reprise et renverrait `false`. Le
  // message disparaîtrait sous les yeux de l'utilisateur, alors qu'il décrit
  // justement d'où viennent les valeurs affichées.
  const [wasPreloaded] = useState(preloaded);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = (ingredient: PerishableIngredient) =>
    locale === "ja" ? ingredient.name_ja : ingredient.name_fr;

  /**
   * Ordre figé au montage.
   *
   * RG-33 demande un tri par fréquence d'usage, mais recalculer l'ordre à
   * chaque tap ferait sauter les lignes sous le doigt : on toucherait la
   * mauvaise. L'ordre est donc calculé une fois, à partir de l'état initial,
   * et ne bouge plus de la session.
   */
  const ordered = useMemo(() => {
    return [...ingredients].sort((a, b) => {
      // Ce qui est déjà dans le frigo remonte : c'est ce qu'on vient relire.
      const inFridge = (initialLevels[b.id] ?? 0) - (initialLevels[a.id] ?? 0);
      if (inFridge !== 0) return inFridge > 0 ? 1 : -1;

      if (a.weeksUsed !== b.weeksUsed) return b.weeksUsed - a.weeksUsed;

      const category =
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (category !== 0) return category;

      return name(a).localeCompare(name(b), locale);
    });
    // Volontairement indépendant de `levels` : voir le commentaire ci-dessus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, locale]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter(
      (ingredient) =>
        ingredient.name_fr.toLowerCase().includes(needle) ||
        ingredient.name_ja.includes(query.trim()) ||
        ingredient.key.includes(needle),
    );
  }, [ordered, query]);

  const inFridgeCount = Object.values(levels).filter((level) => level > 0).length;

  // Enregistrement différé : on ne part en base qu'une fois la rafale de
  // taps terminée. La saisie est chronométrée (90 secondes, A3.9), elle ne
  // doit jamais attendre le réseau.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLevels = useRef(levels);

  function persistSoon(next: Record<string, number>) {
    pendingLevels.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setError(null);
      startTransition(async () => {
        const result = await saveInventory({
          weekStart,
          entries: Object.entries(pendingLevels.current)
            .filter(([, level]) => level > 0)
            .map(([ingredientId, level]) => ({ ingredientId, level })),
        });
        if (result?.error) setError(t.common.error_generic);
        else setSavedAt(Date.now());
      });
    }, 700);
  }

  useEffect(() => {
    // Un préchargement de la semaine précédente n'existe qu'à l'écran tant
    // que rien n'a été enregistré : on le fige tout de suite, sinon quitter
    // l'écran sans y toucher perdrait la reprise (RG-34).
    if (preloaded && Object.keys(initialLevels).length > 0) {
      persistSoon(initialLevels);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setLevel(ingredientId: string, level: number) {
    setLevels((previous) => {
      const next = { ...previous };
      if (level === 0) delete next[ingredientId];
      else next[ingredientId] = level;
      persistSoon(next);
      return next;
    });
  }

  function emptyFridge() {
    setLevels({});
    persistSoon({});
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-sm text-muted">
        {wasPreloaded ? t.inventory.preloaded : t.inventory.intro}
      </p>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.inventory.search_placeholder}
          aria-label={t.inventory.search_placeholder}
          className="flex-1"
          type="search"
        />
        <Button variant="secondary" onClick={emptyFridge} className="whitespace-nowrap">
          {t.inventory.empty_fridge}
        </Button>
      </div>

      {/* Légende des quatre niveaux (RG-31) */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted">
        {STOCK_LEVELS.map((level) => (
          <span key={level}>
            <b className="font-medium text-foreground">
              {t.inventory.levels[String(level) as "0"]}
            </b>{" "}
            {t.inventory.levels_help[String(level) as "0"]}
          </span>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {visible.map((ingredient) => {
          const level = levels[ingredient.id] ?? 0;
          return (
            <li
              key={ingredient.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{name(ingredient)}</span>
                {level === 3 ? (
                  <span className="text-[0.7rem] text-accent">
                    {t.inventory.priority_hint}
                  </span>
                ) : null}
              </span>

              {/* A3.3 — sélecteur visible directement, un seul tap */}
              <div className="flex shrink-0 gap-1" role="group">
                {STOCK_LEVELS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLevel(ingredient.id, option)}
                    aria-pressed={level === option}
                    aria-label={`${name(ingredient)} — ${
                      t.inventory.levels_help[String(option) as "0"]
                    }`}
                    className={`h-10 w-12 shrink-0 overflow-hidden rounded-lg border text-[0.7rem] leading-none transition-colors ${
                      level === option
                        ? option === 0
                          ? "border-border bg-background text-muted"
                          : "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-surface text-muted"
                    }`}
                  >
                    {t.inventory.levels[String(option) as "0"]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {t.inventory.no_result}
        </p>
      ) : null}

      <div className="sticky bottom-0 mt-auto safe-bottom">
        <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
          <p className="text-sm font-medium">
            {interpolate(t.inventory.in_fridge, { count: inFridgeCount })}
          </p>
          {error ? (
            <p className="text-xs text-danger">{error}</p>
          ) : pending ? (
            <p className="text-xs text-muted">{t.inventory.saving}</p>
          ) : savedAt ? (
            <p className="text-xs text-muted">{t.inventory.saved}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
