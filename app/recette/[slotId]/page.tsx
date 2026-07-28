import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentDictionary } from "@/lib/i18n/server";
import { getCurrentHousehold } from "@/lib/household/queries";
import { createClient } from "@/lib/supabase/server";
import { RecipeView, type RecipeData } from "./recipe-view";

function first<T>(relation: T | T[] | null): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

// Formes des lignes telles qu'elles sortent de la base, en snake_case.
type NamedIngredient = { name_fr: string; name_ja: string };

type CardIngredientRow = {
  quantity: number;
  unit: string;
  for_verso: boolean;
  ingredients: NamedIngredient | NamedIngredient[] | null;
};

type VersoRow = {
  title_fr: string;
  title_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  extra_minutes: number;
  points: number;
};

type CardRow = {
  cuisine: string;
  points: number;
  stars: number;
  prep_minutes: number;
  reference_portions: number;
  title_fr: string;
  title_ja: string;
  description_fr: string;
  description_ja: string;
  steps_fr: string[];
  steps_ja: string[];
  card_ingredients: CardIngredientRow[] | null;
  card_equipment: Array<{ equipment_key: string }> | null;
  card_versos: VersoRow | VersoRow[] | null;
};

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const household = await getCurrentHousehold();
  if (!household) redirect("/bienvenue");

  const { locale, t } = await getCurrentDictionary();
  const { slotId } = await params;

  const supabase = await createClient();

  // RLS restreint déjà au foyer : une recette d'un autre foyer renvoie
  // simplement « introuvable ».
  const { data: slot } = await supabase
    .from("planned_slots")
    .select(
      `id, portions, is_verso, status,
       cards ( cuisine, points, stars, prep_minutes, reference_portions,
               title_fr, title_ja, description_fr, description_ja,
               steps_fr, steps_ja,
               card_ingredients ( quantity, unit, for_verso,
                 ingredients ( name_fr, name_ja ) ),
               card_equipment ( equipment_key ),
               card_versos ( title_fr, title_ja, steps_fr, steps_ja,
                             extra_minutes, points ) )`,
    )
    .eq("id", slotId)
    .maybeSingle();

  const card = slot ? first(slot.cards as unknown as CardRow | CardRow[] | null) : null;
  if (!slot || !card) notFound();

  const verso = first(card.card_versos);
  // Non nul seulement si ce créneau est bien occupé par le verso.
  const shownVerso = slot.is_verso ? verso : null;

  // RG-55 : les quantités suivent les portions du créneau, pas celles pour
  // lesquelles la carte a été écrite.
  const reference = card.reference_portions || 1;
  const ratio = slot.portions / reference;

  const ingredients = (card.card_ingredients ?? [])
    .filter((line) => line.for_verso === Boolean(slot.is_verso))
    .map((line) => {
      const ingredient = first(line.ingredients);
      const adjusted = line.quantity * ratio;
      return {
        name_fr: ingredient?.name_fr ?? "",
        name_ja: ingredient?.name_ja ?? "",
        quantity: adjusted < 10 ? Math.round(adjusted * 10) / 10 : Math.ceil(adjusted),
        unit: line.unit,
      };
    });

  const recipe: RecipeData = {
    slotId: slot.id,
    title_fr: shownVerso ? shownVerso.title_fr : card.title_fr,
    title_ja: shownVerso ? shownVerso.title_ja : card.title_ja,
    description_fr: card.description_fr,
    description_ja: card.description_ja,
    steps_fr: shownVerso ? shownVerso.steps_fr : card.steps_fr,
    steps_ja: shownVerso ? shownVerso.steps_ja : card.steps_ja,
    ingredients,
    portions: slot.portions,
    prepMinutes: shownVerso ? shownVerso.extra_minutes : card.prep_minutes,
    points: shownVerso ? shownVerso.points : card.points,
    stars: card.stars,
    cuisine: card.cuisine,
    equipment: (card.card_equipment ?? []).map((e) => e.equipment_key),
    alreadyCooked: slot.status === "cuisine",
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 py-6">
      <div className="flex justify-end">
        <Link
          href="/planning"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm"
        >
          {t.common.back}
        </Link>
      </div>

      <RecipeView t={t} locale={locale} recipe={recipe} />
    </main>
  );
}
