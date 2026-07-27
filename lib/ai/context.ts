import {
  BOOSTER_CARDS_PER_NEED,
  BOOSTER_MAX_CARDS,
  HAND_MAX_SCORE_5_CARDS,
  HAND_MIN_CUISINES,
  HAND_MIN_CUISINES_THRESHOLD_SIZE,
  HAND_MIN_LOW_SCORE_CARDS,
  HAND_MIN_SHARE_UNDER_30MIN,
} from "@/lib/config/business-rules";
import type { AllergenFamily } from "@/lib/household/equipment";

/**
 * Construction du message envoyé au modèle (docs/05, §3).
 *
 * Tout est en texte lisible plutôt qu'en JSON compact : les modèles suivent
 * mieux des contraintes formulées en langue naturelle, et cela reste
 * relisible tel quel lors du calibrage des prompts.
 */

export type IngredientForPrompt = {
  key: string;
  name_en: string;
  name_ja: string;
  category: string;
  default_unit: string;
};

export type NeedForPrompt = {
  /** Portions du dîner. */
  portions: number;
  /**
   * Portions du bento du lendemain, souvent différentes (RG-19).
   * 0 si aucun besoin le lendemain midi : le verso n'est alors pas affecté.
   */
  versoPortions: number;
};

export type GenerationContext = {
  adults: number;
  children: number;
  goal: string;
  equipment: string[];
  allergens: AllergenFamily[];
  dislikes: string[];
  dinnerNeeds: NeedForPrompt[];
  orphanLunchPortions: number[];
  /** Ingrédients de niveau 2 et 3 uniquement (docs/05, §3). */
  fridge: Array<{ key: string; level: number }>;
  ingredients: IngredientForPrompt[];
  recentDishes: string[];
};

/** Nombre de cartes à demander (RG-37), plafonné puis réduit proportionnellement. */
export function computeHandSize(
  dinnerNeeds: number,
  orphanLunches: number,
): { standard: number; lunchSolo: number; total: number } {
  const standard = BOOSTER_CARDS_PER_NEED * dinnerNeeds;
  const lunchSolo = BOOSTER_CARDS_PER_NEED * orphanLunches;
  const total = standard + lunchSolo;

  if (total <= BOOSTER_MAX_CARDS) return { standard, lunchSolo, total };

  // Réduction proportionnelle, en gardant au moins une carte de chaque type
  // demandé : sinon un besoin resterait sans proposition.
  const ratio = BOOSTER_MAX_CARDS / total;
  const reducedStandard = standard > 0 ? Math.max(1, Math.floor(standard * ratio)) : 0;
  const reducedLunchSolo =
    lunchSolo > 0 ? Math.max(1, BOOSTER_MAX_CARDS - reducedStandard) : 0;

  return {
    standard: reducedStandard,
    lunchSolo: reducedLunchSolo,
    total: reducedStandard + reducedLunchSolo,
  };
}

function listOrNone(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "aucun";
}

export function buildUserPrompt(context: GenerationContext): string {
  const hand = computeHandSize(
    context.dinnerNeeds.length,
    context.orphanLunchPortions.length,
  );

  const priority = context.fridge.filter((item) => item.level === 3);
  const available = context.fridge.filter((item) => item.level === 2);

  const sections: string[] = [];

  sections.push(
    [
      "# Le foyer",
      `- ${context.adults} adulte(s), ${context.children} enfant(s)`,
      `- Objectif : ${context.goal}`,
      `- Matériel disponible : ${listOrNone(context.equipment)}`,
      `- Allergies BLOQUANTES : ${listOrNone(context.allergens)}`,
      `- N'aime pas, à éviter en priorité : ${listOrNone(context.dislikes)}`,
    ].join("\n"),
  );

  const needLines = context.dinnerNeeds.map((need, index) => {
    const verso =
      need.versoPortions > 0
        ? `verso pour ${need.versoPortions} portion(s) le lendemain midi`
        : "pas de besoin le lendemain midi, le verso ne sera pas utilisé";
    return `- Dîner ${index + 1} : ${need.portions} portion(s), ${verso}`;
  });

  sections.push(
    [
      "# Les repas à couvrir",
      ...needLines,
      ...context.orphanLunchPortions.map(
        (portions, index) =>
          `- Déjeuner autonome ${index + 1} : ${portions} portion(s), sans dîner la veille`,
      ),
      "",
      "Le nombre de portions du bento est souvent différent de celui du dîner.",
      "C'est le cas normal : dimensionne chaque verso sur son propre chiffre.",
    ].join("\n"),
  );

  sections.push(
    [
      "# Le frigo",
      priority.length > 0
        ? `- À CONSOMMER EN PRIORITÉ : ${priority.map((i) => i.key).join(", ")}`
        : "- Rien à consommer en priorité",
      available.length > 0
        ? `- Déjà en stock : ${available.map((i) => i.key).join(", ")}`
        : "- Rien d'autre en stock",
      "",
      priority.length > 0
        ? "Au moins une carte doit consommer un ingrédient prioritaire."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(
    [
      "# Ce que tu dois produire",
      `- ${hand.standard} carte(s) de type "standard", chacune avec son verso`,
      hand.lunchSolo > 0
        ? `- ${hand.lunchSolo} carte(s) de type "lunch_solo", sans verso`
        : "- Aucune carte lunch_solo",
      "",
      "Équilibre de l'ensemble, à respecter autant que possible :",
      hand.total >= HAND_MIN_CUISINES_THRESHOLD_SIZE
        ? `- au moins ${HAND_MIN_CUISINES} cuisines différentes`
        : "- varie les cuisines",
      `- au maximum ${HAND_MAX_SCORE_5_CARDS} cartes à 5 points`,
      `- au minimum ${HAND_MIN_LOW_SCORE_CARDS} cartes à 1 ou 2 points`,
      `- au moins ${Math.round(HAND_MIN_SHARE_UNDER_30MIN * 100)} % des cartes en 30 minutes ou moins`,
    ].join("\n"),
  );

  if (context.recentDishes.length > 0) {
    sections.push(
      [
        "# Déjà cuisiné récemment, à ne pas reproposer",
        context.recentDishes.map((dish) => `- ${dish}`).join("\n"),
      ].join("\n"),
    );
  }

  sections.push(
    [
      "# Ingrédients autorisés",
      "",
      "Format : clé | nom anglais | nom japonais | rayon | unité par défaut",
      "Utilise EXCLUSIVEMENT ces clés. Toute autre clé fait rejeter la carte.",
      "",
      context.ingredients
        .map(
          (i) =>
            `${i.key} | ${i.name_en} | ${i.name_ja} | ${i.category} | ${i.default_unit}`,
        )
        .join("\n"),
    ].join("\n"),
  );

  return sections.join("\n\n");
}
