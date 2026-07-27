import { CHILD_WEIGHT, POINTS_BUDGET_BASE } from "@/lib/config/business-rules";

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
