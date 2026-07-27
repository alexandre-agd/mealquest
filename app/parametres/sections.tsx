"use client";

import { useState, useTransition } from "react";
import { Button, Card, ErrorText, Field, Input, SectionTitle } from "@/components/ui";
import { lookup, type Dictionary, type Locale } from "@/lib/i18n";
import { ALLERGEN_FAMILIES, EQUIPMENT_KEYS } from "@/lib/household/equipment";
import { HOUSEHOLD_GOALS, computePointsBudget, type HouseholdGoal } from "@/lib/household/budget";
import type { Household } from "@/lib/household/queries";
import {
  addMember,
  clearAiKey,
  deleteMember,
  saveAiConfig,
  updateEquipment,
  updateHousehold,
  updateMember,
} from "./actions";

export type IngredientOption = {
  id: string;
  name_fr: string;
  name_ja: string;
  category: string;
};

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

/** Feedback discret après enregistrement, sans modale (règle d'interface 4). */
function SaveRow({
  t,
  pending,
  saved,
  error,
  onSave,
}: {
  t: Dictionary;
  pending: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={onSave} disabled={pending}>
        {pending ? t.common.loading : t.common.save}
      </Button>
      {saved && !pending ? (
        <span className="text-sm text-accent">{t.common.saved}</span>
      ) : null}
      {error ? <ErrorText>{lookup(t, error)}</ErrorText> : null}
    </div>
  );
}

function useSaver() {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: true; error?: string }>) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return { pending, saved, error, run };
}

export function HouseholdSection({
  t,
  household,
}: {
  t: Dictionary;
  household: Household;
}) {
  const [name, setName] = useState(household.name);
  const [goal, setGoal] = useState<HouseholdGoal>(household.goal);
  const { pending, saved, error, run } = useSaver();

  const budget = computePointsBudget(goal, household.adults, household.children);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t.settings.household_section}</SectionTitle>
      <Card className="flex flex-col gap-4">
        <Field label={t.onboarding.household_name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t.household.goal}</span>
          <div className="flex flex-wrap gap-2">
            {HOUSEHOLD_GOALS.map((option) => (
              <Chip key={option} active={goal === option} onClick={() => setGoal(option)}>
                {t.household.goals[option]}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">
            {t.household.goals[`${goal}_description` as const]}
          </p>
        </div>

        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm text-muted">{t.household.budget}</span>
          <span className="text-lg font-semibold tabular-nums">
            {budget} {t.household.budget_unit}
          </span>
        </div>

        <SaveRow
          t={t}
          pending={pending}
          saved={saved}
          error={error}
          onSave={() => {
            const formData = new FormData();
            formData.set("name", name);
            formData.set("goal", goal);
            run(() => updateHousehold(formData));
          }}
        />
      </Card>
    </section>
  );
}

export function EquipmentSection({
  t,
  household,
}: {
  t: Dictionary;
  household: Household;
}) {
  const [selected, setSelected] = useState<string[]>(household.equipment);
  const { pending, saved, error, run } = useSaver();

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t.settings.equipment_section}</SectionTitle>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_KEYS.map((key) => (
            <Chip
              key={key}
              active={selected.includes(key)}
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
                )
              }
            >
              {t.equipment[key]}
            </Chip>
          ))}
        </div>
        <SaveRow
          t={t}
          pending={pending}
          saved={saved}
          error={error}
          onSave={() => run(() => updateEquipment(selected))}
        />
      </Card>
    </section>
  );
}

export function MembersSection({
  t,
  household,
  ingredients,
  dislikesByMember,
  currentUserId,
}: {
  t: Dictionary;
  household: Household;
  ingredients: IngredientOption[];
  dislikesByMember: Record<string, string[]>;
  currentUserId: string | null;
}) {
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"adulte" | "enfant">("adulte");
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t.settings.members_section}</SectionTitle>

      {household.members.map((member) => (
        <MemberCard
          key={member.id}
          t={t}
          member={member}
          ingredients={ingredients}
          dislikes={dislikesByMember[member.id] ?? []}
          isSelf={member.user_id !== null && member.user_id === currentUserId}
        />
      ))}

      <Card className="flex flex-col gap-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.member.name}
          aria-label={t.member.name}
        />
        <div className="flex gap-2">
          {(["adulte", "enfant"] as const).map((kind) => (
            <Chip key={kind} active={newKind === kind} onClick={() => setNewKind(kind)}>
              {kind === "adulte" ? t.member.adult : t.member.child}
            </Chip>
          ))}
        </div>
        <Button
          variant="secondary"
          disabled={pending || newName.trim().length === 0}
          onClick={() =>
            startTransition(async () => {
              const formData = new FormData();
              formData.set("name", newName.trim());
              formData.set("kind", newKind);
              await addMember(formData);
              setNewName("");
            })
          }
        >
          {t.common.add}
        </Button>
      </Card>
    </section>
  );
}

function MemberCard({
  t,
  member,
  ingredients,
  dislikes,
  isSelf,
}: {
  t: Dictionary;
  member: Household["members"][number];
  ingredients: IngredientOption[];
  dislikes: string[];
  isSelf: boolean;
}) {
  const [name, setName] = useState(member.name);
  const [kind, setKind] = useState(member.kind);
  const [locale, setLocale] = useState<Locale>(member.locale);
  const [allergens, setAllergens] = useState<string[]>(member.allergens);
  const [selectedDislikes, setSelectedDislikes] = useState<string[]>(dislikes);
  const [query, setQuery] = useState("");
  const { pending, saved, error, run } = useSaver();
  const [removing, startRemoving] = useTransition();

  const matches = query.trim()
    ? ingredients
        .filter((ingredient) => {
          const needle = query.trim().toLowerCase();
          return (
            ingredient.name_fr.toLowerCase().includes(needle) ||
            ingredient.name_ja.includes(query.trim())
          );
        })
        .slice(0, 8)
    : [];

  const label = (ingredient: IngredientOption) =>
    locale === "ja" ? ingredient.name_ja : ingredient.name_fr;

  return (
    <Card className="flex flex-col gap-4">
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label={t.member.name} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{t.member.kind}</span>
        {(["adulte", "enfant"] as const).map((option) => (
          <Chip key={option} active={kind === option} onClick={() => setKind(option)}>
            {option === "adulte" ? t.member.adult : t.member.child}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{t.member.language}</span>
        {(["fr", "ja"] as const).map((code) => (
          <Chip key={code} active={locale === code} onClick={() => setLocale(code)}>
            {code === "fr" ? t.member.language_fr : t.member.language_ja}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">{t.member.allergies}</span>
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_FAMILIES.map((allergen) => (
            <Chip
              key={allergen}
              active={allergens.includes(allergen)}
              onClick={() =>
                setAllergens((prev) =>
                  prev.includes(allergen)
                    ? prev.filter((a) => a !== allergen)
                    : [...prev, allergen],
                )
              }
            >
              {t.allergens[allergen]}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted">{t.member.allergies_help}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">{t.member.dislikes}</span>

        {selectedDislikes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedDislikes.map((id) => {
              const ingredient = ingredients.find((i) => i.id === id);
              if (!ingredient) return null;
              return (
                <Chip
                  key={id}
                  active
                  onClick={() =>
                    setSelectedDislikes((prev) => prev.filter((x) => x !== id))
                  }
                >
                  {label(ingredient)} ×
                </Chip>
              );
            })}
          </div>
        ) : null}

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.common.search}
          aria-label={t.member.dislikes}
        />

        {matches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {matches
              .filter((ingredient) => !selectedDislikes.includes(ingredient.id))
              .map((ingredient) => (
                <Chip
                  key={ingredient.id}
                  active={false}
                  onClick={() => {
                    setSelectedDislikes((prev) => [...prev, ingredient.id]);
                    setQuery("");
                  }}
                >
                  + {label(ingredient)}
                </Chip>
              ))}
          </div>
        ) : null}

        <p className="text-xs text-muted">{t.member.dislikes_help}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <SaveRow
          t={t}
          pending={pending}
          saved={saved}
          error={error}
          onSave={() =>
            run(() =>
              updateMember({
                id: member.id,
                name: name.trim(),
                kind,
                locale,
                allergens,
                dislikes: selectedDislikes,
              }),
            )
          }
        />
        {!isSelf ? (
          <Button
            variant="ghost"
            disabled={removing}
            onClick={() => startRemoving(async () => void (await deleteMember(member.id)))}
          >
            {t.common.delete}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function AiSection({ t, household }: { t: Dictionary; household: Household }) {
  const [provider, setProvider] = useState(household.ai_provider ?? "deepseek");
  const [model, setModel] = useState(household.ai_model ?? "deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const { pending, saved, error, run } = useSaver();
  const [clearing, startClearing] = useTransition();

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t.settings.ai_section}</SectionTitle>
      <Card className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t.ai.help}</p>

        <Field label={t.ai.provider}>
          <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
        </Field>

        <Field label={t.ai.model}>
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </Field>

        <Field label={t.ai.api_key} hint={t.ai.key_never_shown}>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t.ai.api_key_placeholder}
            autoComplete="off"
          />
        </Field>

        <p className={`text-sm ${household.has_ai_key ? "text-accent" : "text-muted"}`}>
          {household.has_ai_key ? t.ai.configured : t.ai.not_configured}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <SaveRow
            t={t}
            pending={pending}
            saved={saved}
            error={error}
            onSave={() => {
              const formData = new FormData();
              formData.set("provider", provider);
              formData.set("model", model);
              formData.set("api_key", apiKey);
              run(async () => {
                const result = await saveAiConfig(formData);
                setApiKey("");
                return result;
              });
            }}
          />
          {household.has_ai_key ? (
            <Button
              variant="ghost"
              disabled={clearing}
              onClick={() => startClearing(async () => void (await clearAiKey()))}
            >
              {t.ai.clear}
            </Button>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
