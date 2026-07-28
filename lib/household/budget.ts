import {
  CHILD_WEIGHT,
  FULL_WEEK_MEALS,
  POINTS_BUDGET_BASE,
} from "@/lib/config/business-rules";

export type HouseholdGoal = keyof typeof POINTS_BUDGET_BASE;

export const HOUSEHOLD_GOALS: HouseholdGoal[] = [
  "leger",
  "equilibre",
  "gourmand",
];

/**
 * Budget de points hebdomadaire du foyer (RG-08, RG-09).
 *
 *   budget = budget_de_base × (nb_adultes + nb_enfants × 0,6) / 2
 *   arrondi à l'entier supérieur
 *
 * Le budget de base est celui de l'objectif choisi, exprimé pour 2 adultes.
 */
export function computePointsBudget(
  goal: HouseholdGoal,
  adults: number,
  children: number,
): number {
  const base = POINTS_BUDGET_BASE[goal];
  const weightedPeople = adults + children * CHILD_WEIGHT;
  return Math.ceil((base * weightedPeople) / 2);
}

/**
 * Budget ajusté au nombre de repas réellement prévus.
 *
 * Les valeurs de RG-08 valent pour une semaine pleine, soit sept dîners.
 * Une semaine où l'on ne cuisine que quatre soirs reçoit une enveloppe
 * proportionnellement plus petite : sinon le repère ne dit plus rien, on ne
 * peut plus le dépasser et il cesse d'être un repère.
 *
 * L'enveloppe reste **hebdomadaire et commune** : rien n'est réservé à un
 * repas précis. C'est ce qui permet un plat généreux un soir et un dîner
 * léger le lendemain — la raison d'être d'un budget à la semaine.
 *
 * Les déjeuners autonomes comptent comme des repas à part entière : ils
 * demandent leur propre carte, donc leurs propres points.
 */
export function computeAdjustedPointsBudget(
  goal: HouseholdGoal,
  adults: number,
  children: number,
  mealsPlanned: number,
): number {
  const full = computePointsBudget(goal, adults, children);
  if (mealsPlanned <= 0) return 0;
  return Math.max(1, Math.ceil((full * mealsPlanned) / FULL_WEEK_MEALS));
}

/**
 * Budget effectif : la valeur surchargée manuellement l'emporte sur le
 * calcul (docs/04, « Budget de points … surchargeable manuellement »).
 */
export function effectivePointsBudget(
  goal: HouseholdGoal,
  adults: number,
  children: number,
  override: number | null | undefined,
): number {
  return override && override > 0
    ? override
    : computePointsBudget(goal, adults, children);
}
