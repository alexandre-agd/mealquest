"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Card as Panel, ErrorText, SectionTitle } from "@/components/ui";
import { interpolate, lookup, type Dictionary, type Locale } from "@/lib/i18n";
import type { Card } from "@/lib/cards/queries";
import { runBooster, type BoosterResult } from "./actions";

export function BoosterScreen({
  t,
  locale,
  weekStart,
  cards,
  dinnersNeeded,
  pointsBudget,
  hasKey,
}: {
  t: Dictionary;
  locale: Locale;
  weekStart: string;
  cards: Card[];
  dinnersNeeded: number;
  pointsBudget: number;
  hasKey: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BoosterResult | null>(null);
  // Sélection locale : garder ou passer ne touche la base qu'au placement.
  const [kept, setKept] = useState<Set<string>>(new Set());

  const ja = locale === "ja";
  const title = (card: Card) => (ja ? card.title_ja : card.title_fr);
  const description = (card: Card) => (ja ? card.description_ja : card.description_fr);

  const usedPoints = cards
    .filter((card) => kept.has(card.id))
    .reduce((total, card) => total + card.points + (card.verso?.points ?? 0), 0);

  function toggle(id: string) {
    setKept((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function launch() {
    setResult(null);
    startTransition(async () => {
      const outcome = await runBooster(weekStart);
      setResult(outcome);
      if (outcome.status === "ok" || outcome.status === "insufficient") {
        // Le serveur a écrit de nouvelles cartes : on relit plutôt que de
        // deviner ce qu'il a produit.
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* État d'attente explicite : la génération est longue et l'utilisateur
          doit savoir ce qui se passe (règle d'interface 7 de docs/03). */}
      {pending ? (
        <Panel className="flex flex-col gap-2">
          <p className="font-medium">{t.booster.generating}</p>
          <p className="text-sm text-muted">{t.booster.generating_hint}</p>
        </Panel>
      ) : null}

      {!pending && result && result.status !== "ok" ? (
        <Panel className="flex flex-col gap-3">
          {result.status === "insufficient" ? (
            <p className="text-sm">
              {interpolate(t.booster.partial, {
                generated: result.generated ?? 0,
                expected: result.expected ?? 0,
              })}
            </p>
          ) : (
            <ErrorText>{lookup(t, result.message ?? "common.error_generic")}</ErrorText>
          )}

          {result.status === "no_key" ? (
            <Link
              href="/parametres"
              className="text-sm font-medium text-accent underline underline-offset-4"
            >
              {t.booster.no_key_action}
            </Link>
          ) : null}
          {result.status === "no_needs" ? (
            <Link
              href="/semainier"
              className="text-sm font-medium text-accent underline underline-offset-4"
            >
              {t.booster.no_needs_action}
            </Link>
          ) : null}
        </Panel>
      ) : null}

      {/* Mode dégradé annoncé d'emblée, sans attendre un clic (RG-61, P3) */}
      {!hasKey ? (
        <Panel className="flex flex-col gap-3">
          <p className="text-sm">{t.booster.no_key}</p>
          <Link
            href="/parametres"
            className="text-sm font-medium text-accent underline underline-offset-4"
          >
            {t.booster.no_key_action}
          </Link>
        </Panel>
      ) : null}

      <Button onClick={launch} disabled={pending || !hasKey}>
        {pending
          ? t.common.loading
          : cards.length > 0
            ? t.booster.regenerate
            : t.booster.generate}
      </Button>

      {cards.length === 0 ? (
        <p className="text-sm text-muted">{t.booster.intro}</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <SectionTitle>{t.booster.hand_title}</SectionTitle>
            <span className="text-xs text-muted tabular-nums">
              {interpolate(t.booster.counter, {
                kept: kept.size,
                needed: dinnersNeeded,
              })}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {cards.map((card) => {
              const isKept = kept.has(card.id);
              return (
                <li key={card.id}>
                  <Panel
                    className={`flex flex-col gap-2 ${isKept ? "border-accent" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{title(card)}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {t.cuisines[card.cuisine as "japonaise"]} ·{" "}
                          {card.points} pt · {"★".repeat(card.stars)} ·{" "}
                          {interpolate(t.booster.minutes, { count: card.prepMinutes })}
                        </p>
                      </div>
                      <Button
                        variant={isKept ? "primary" : "secondary"}
                        className="!min-h-10 shrink-0 !px-4 text-sm"
                        onClick={() => toggle(card.id)}
                      >
                        {isKept ? t.booster.kept : t.booster.keep}
                      </Button>
                    </div>

                    <p className="text-sm text-muted">{description(card)}</p>

                    {/* Les ingrédients principaux, visibles sans ouvrir (B4) */}
                    <p className="text-xs text-muted">
                      {card.ingredients
                        .filter((i) => !i.forVerso)
                        .slice(0, 4)
                        .map((i) => (ja ? i.name_ja : i.name_fr))
                        .join(" · ")}
                    </p>

                    {card.verso ? (
                      <p className="border-t border-border pt-2 text-xs text-muted">
                        {ja ? card.verso.title_ja : card.verso.title_fr} ·{" "}
                        {card.verso.points} pt
                      </p>
                    ) : null}
                  </Panel>
                </li>
              );
            })}
          </ul>

          {/* Compteur de points : neutre, jamais bloquant, sans jugement
              (RG-41, P4). Un dépassement s'affiche, rien de plus. */}
          <div className="sticky bottom-0 mt-auto safe-bottom">
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
              <p className="text-sm font-medium tabular-nums">
                {interpolate(t.booster.points_counter, {
                  used: usedPoints,
                  budget: pointsBudget,
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted">{t.household.budget_explain}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
