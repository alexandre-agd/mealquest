// Formes de données du moteur de génération (docs/05-moteur-ia.md).

import { CARD_POINTS_MAX, CARD_POINTS_MIN, CARD_STARS_MAX, CARD_STARS_MIN } from "@/lib/config/business-rules";
import type { AllergenFamily } from "@/lib/household/equipment";

/** Liste fermée des cuisines (RG-25). */
export const CUISINES = [
  "japonaise",
  "francaise",
  "italienne",
  "chinoise",
  "coreenne",
  "thailandaise",
  "indienne",
  "mexicaine",
  "americaine",
  "mediterraneenne",
  "autre",
] as const;
export type Cuisine = (typeof CUISINES)[number];

/** Types de carte (RG-20). */
export const CARD_TYPES = ["standard", "lunch_solo", "waouh"] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Formes de verso (RG-21). */
export const VERSO_FORMS = ["restes", "transforme", "express"] as const;
export type VersoForm = (typeof VERSO_FORMS)[number];

export type BilingualText = { fr: string; ja: string };
export type BilingualSteps = { fr: string[]; ja: string[] };

export type GeneratedIngredient = {
  key: string;
  quantity: number;
  unit: string;
};

export type GeneratedVerso = {
  form: VersoForm;
  title: BilingualText;
  steps: BilingualSteps;
  extra_ingredients: GeneratedIngredient[];
  extra_minutes: number;
};

export type GeneratedCard = {
  type: CardType;
  cuisine: Cuisine;
  points: number;
  stars: number;
  prep_minutes: number;
  reference_portions: number;
  title: BilingualText;
  description: BilingualText;
  steps: BilingualSteps;
  ingredients: GeneratedIngredient[];
  equipment: string[];
  verso?: GeneratedVerso;
};

/** Ce que le validateur doit connaître du foyer pour trancher. */
export type ValidationContext = {
  /** Clés d'ingrédients autorisées : le référentiel transmis au modèle. */
  allowedIngredientKeys: Set<string>;
  /** Famille d'allergène de chaque ingrédient, pour appliquer RG-05. */
  allergenByIngredientKey: Map<string, AllergenFamily | null>;
  /** Allergènes déclarés dans le foyer. Bloquants, sans exception. */
  householdAllergens: Set<AllergenFamily>;
  /** Matériel de cuisine réellement disponible (RG-07). */
  availableEquipment: Set<string>;
  /** Unités acceptées, issues du référentiel. */
  allowedUnits: Set<string>;
  /**
   * Titres et plats principaux des dernières cartes cuisinées, en minuscules.
   * Une carte qui les reprend est rejetée (RG-39).
   */
  recentTitles: Set<string>;
};

export type RejectionReason =
  | { rule: "S1"; detail: string }
  | { rule: "S2"; detail: string }
  | { rule: "S3"; detail: string }
  | { rule: "S4"; detail: string }
  | { rule: "S7"; detail: string }
  | { rule: "S8"; detail: string }
  | { rule: "S9"; detail: string }
  | { rule: "schema"; detail: string };

export type Correction = { rule: "S5" | "S6"; detail: string };
export type Warning = { rule: "S10"; detail: string };

export type ValidatedCard = {
  card: GeneratedCard;
  /** Points du verso, calculés par le code et non par l'IA (RG-23). */
  versoPoints: number | null;
  corrections: Correction[];
  warnings: Warning[];
};

export type ValidationOutcome = {
  accepted: ValidatedCard[];
  rejected: Array<{ card: unknown; reasons: RejectionReason[] }>;
};

export const POINTS_RANGE = { min: CARD_POINTS_MIN, max: CARD_POINTS_MAX };
export const STARS_RANGE = { min: CARD_STARS_MIN, max: CARD_STARS_MAX };
