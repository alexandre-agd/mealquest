"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, ErrorText, Field, Input } from "@/components/ui";
import { interpolate, lookup, type Dictionary, type Locale } from "@/lib/i18n";
import { ALLERGEN_FAMILIES, DEFAULT_EQUIPMENT, EQUIPMENT_KEYS } from "@/lib/household/equipment";
import { HOUSEHOLD_GOALS, computePointsBudget, type HouseholdGoal } from "@/lib/household/budget";
import { completeOnboarding } from "./actions";

type DraftMember = {
  name: string;
  kind: "adulte" | "enfant";
  locale: Locale;
  allergens: string[];
};

const STEP_COUNT = 4;

export function Onboarding({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [goal, setGoal] = useState<HouseholdGoal>("equilibre");
  const [equipment, setEquipment] = useState<string[]>([...DEFAULT_EQUIPMENT]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const budget = useMemo(
    () => computePointsBudget(goal, adults, children),
    [goal, adults, children],
  );

  // Les compteurs d'adultes et d'enfants pilotent la liste des prénoms :
  // on préserve ce qui a déjà été saisi quand le nombre change.
  function syncMembers(nextAdults: number, nextChildren: number) {
    setMembers((previous) => {
      const previousAdults = previous.filter((m) => m.kind === "adulte");
      const previousChildren = previous.filter((m) => m.kind === "enfant");

      const build = (kind: "adulte" | "enfant", count: number, source: DraftMember[]) =>
        Array.from({ length: count }, (_, index) =>
          source[index] ?? { name: "", kind, locale, allergens: [] },
        );

      return [
        ...build("adulte", nextAdults, previousAdults),
        ...build("enfant", nextChildren, previousChildren),
      ];
    });
  }

  function updateMember(index: number, patch: Partial<DraftMember>) {
    setMembers((previous) =>
      previous.map((member, i) => (i === index ? { ...member, ...patch } : member)),
    );
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  function goToMembers() {
    syncMembers(adults, children);
    setStep(1);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        name: name.trim(),
        goal,
        members: members.map((m) => ({ ...m, name: m.name.trim() })),
        equipment,
      });
      if (result?.error) setError(result.error);
    });
  }

  const membersValid =
    members.length > 0 && members.every((m) => m.name.trim().length > 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-sm text-muted">
        {interpolate(t.onboarding.step, { current: step + 1, total: STEP_COUNT })}
      </p>

      {step === 0 && (
        <section className="flex flex-1 flex-col gap-5">
          <h2 className="text-xl font-medium">{t.onboarding.household_title}</h2>

          <Field label={t.onboarding.household_name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.onboarding.household_name_placeholder}
              autoFocus
            />
          </Field>

          <Counter
            label={t.onboarding.adults}
            value={adults}
            min={1}
            onChange={setAdults}
          />
          <Counter
            label={t.onboarding.children}
            value={children}
            min={0}
            onChange={setChildren}
          />

          <div className="mt-auto safe-bottom">
            <Button
              className="w-full"
              onClick={goToMembers}
              disabled={name.trim().length === 0}
            >
              {t.common.next}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium">{t.onboarding.members_title}</h2>
            <p className="mt-1 text-sm text-muted">{t.onboarding.members_help}</p>
          </div>

          <div className="flex flex-col gap-4">
            {members.map((member, index) => {
              const sameKindIndex =
                members.filter((m, i) => m.kind === member.kind && i < index).length + 1;
              const placeholder = interpolate(
                member.kind === "adulte"
                  ? t.onboarding.member_placeholder_adult
                  : t.onboarding.member_placeholder_child,
                { index: sameKindIndex },
              );

              return (
                <Card key={index} className="flex flex-col gap-3">
                  <Input
                    value={member.name}
                    onChange={(e) => updateMember(index, { name: e.target.value })}
                    placeholder={placeholder}
                    aria-label={placeholder}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{t.member.language}</span>
                    {(["fr", "ja"] as const).map((code) => (
                      <Chip
                        key={code}
                        active={member.locale === code}
                        onClick={() => updateMember(index, { locale: code })}
                      >
                        {code === "fr" ? t.member.language_fr : t.member.language_ja}
                      </Chip>
                    ))}
                  </div>

                  <details>
                    <summary className="cursor-pointer text-xs text-muted">
                      {t.member.allergies} ({t.common.optional})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ALLERGEN_FAMILIES.map((allergen) => (
                        <Chip
                          key={allergen}
                          active={member.allergens.includes(allergen)}
                          onClick={() =>
                            updateMember(index, {
                              allergens: toggle(member.allergens, allergen),
                            })
                          }
                        >
                          {t.allergens[allergen]}
                        </Chip>
                      ))}
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>

          <div className="mt-auto flex gap-3 safe-bottom">
            <Button variant="secondary" onClick={() => setStep(0)}>
              {t.common.back}
            </Button>
            <Button
              className="flex-1"
              onClick={() => setStep(2)}
              disabled={!membersValid}
            >
              {t.common.next}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-1 flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium">{t.onboarding.goal_title}</h2>
            <p className="mt-1 text-sm text-muted">{t.onboarding.goal_help}</p>
          </div>

          <div className="flex flex-col gap-3">
            {HOUSEHOLD_GOALS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGoal(option)}
                aria-pressed={goal === option}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  goal === option
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface"
                }`}
              >
                <span className="font-medium">{t.household.goals[option]}</span>
                <span className="mt-1 block text-sm text-muted">
                  {t.household.goals[`${option}_description` as const]}
                </span>
              </button>
            ))}
          </div>

          <Card className="flex items-baseline justify-between">
            <span className="text-sm text-muted">{t.household.budget}</span>
            <span className="text-lg font-semibold">
              {budget} {t.household.budget_unit}
            </span>
          </Card>

          <div className="mt-auto flex gap-3 safe-bottom">
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t.common.back}
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              {t.common.next}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-1 flex-col gap-5">
          <div>
            <h2 className="text-xl font-medium">{t.onboarding.equipment_title}</h2>
            <p className="mt-1 text-sm text-muted">{t.onboarding.equipment_help}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_KEYS.map((key) => (
              <Chip
                key={key}
                active={equipment.includes(key)}
                onClick={() => setEquipment((prev) => toggle(prev, key))}
              >
                {t.equipment[key]}
              </Chip>
            ))}
          </div>

          {error ? <ErrorText>{lookup(t, error)}</ErrorText> : null}

          <div className="mt-auto flex gap-3 safe-bottom">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={pending}>
              {t.common.back}
            </Button>
            <Button className="flex-1" onClick={submit} disabled={pending}>
              {pending ? t.common.loading : t.common.finish}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="!min-h-11 !w-11 !px-0 text-xl"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label="−"
        >
          −
        </Button>
        <span className="w-6 text-center text-lg tabular-nums">{value}</span>
        <Button
          variant="secondary"
          className="!min-h-11 !w-11 !px-0 text-xl"
          onClick={() => onChange(value + 1)}
          aria-label="+"
        >
          +
        </Button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 rounded-full border px-3.5 text-sm transition-colors ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
