// Constantes métier chiffrées de MealQuest V1.
// Centralisées ici (CLAUDE.md §7) car elles vont bouger après les premières
// semaines d'usage réel. Toute règle chiffrée de docs/02-regles-metier.md
// doit être lue depuis ce fichier, jamais recopiée en dur ailleurs.

export const HOUSEHOLD_TIMEZONE = "Asia/Tokyo"; // C8
export const WEEK_START_DAY = 1; // 1 = lundi (C9, RG-10)

// RG-09, RG-18 : un enfant compte pour 0,6 portion / point de budget.
export const CHILD_WEIGHT = 0.6;

// RG-08 : budget de points hebdomadaire, base 2 adultes.
export const POINTS_BUDGET_BASE = {
  leger: 24,
  equilibre: 30,
  gourmand: 36,
} as const;

// RG-08 bis — Nombre de repas que représente une semaine « pleine ».
//
// Les budgets de POINTS_BUDGET_BASE sont exprimés pour une semaine complète,
// soit sept dîners. Quand la semaine réelle en compte moins, l'enveloppe est
// réduite dans la même proportion : 30 points pour quatre dîners ne serait
// plus un repère, juste un plafond hors d'atteinte.
//
// L'enveloppe reste hebdomadaire et commune : c'est ce qui permet de se
// rattraper un autre jour après un repas généreux. On ajuste sa taille, on
// ne la découpe pas en budgets par repas.
export const FULL_WEEK_MEALS = 7;

// RG-37 : nombre de cartes proposées par le booster.
export const BOOSTER_CARDS_PER_NEED = 2;
export const BOOSTER_MAX_CARDS = 20;

// RG-38 : composition de la main.
export const HAND_MIN_CUISINES = 4;
export const HAND_MIN_CUISINES_THRESHOLD_SIZE = 8;
export const HAND_MAX_SCORE_5_CARDS = 2;
export const HAND_MIN_LOW_SCORE_CARDS = 2; // score 1 ou 2
export const HAND_MIN_SHARE_UNDER_30MIN = 0.5;

// RG-39 : fenêtre d'exclusion anti-répétition.
export const RECENT_CARDS_EXCLUSION_COUNT = 20;

// RG-22 : score en points.
export const CARD_POINTS_MIN = 1;
export const CARD_POINTS_MAX = 5;

// RG-24 : étoiles de difficulté.
export const CARD_STARS_MIN = 1;
export const CARD_STARS_MAX = 3;

// RG-21 : temps supplémentaire max d'un verso "express".
export const VERSO_EXPRESS_MAX_MINUTES = 10;

// Niveaux de stock de l'inventaire frigo (RG-31).
export const STOCK_LEVELS = [0, 1, 2, 3] as const;

// RG-60 : nombre de régénérations IA avant échec explicite.
export const AI_MAX_REGENERATION_ATTEMPTS = 2;

// Budgets de temps du parcours B (docs/03), en secondes.
export const TIME_BUDGET_AVAILABILITY_SECONDS = 60; // B1
export const TIME_BUDGET_INVENTORY_SECONDS = 90; // B2
export const TIME_BUDGET_HAND_SELECTION_SECONDS = 60; // B4
export const TIME_BUDGET_TOTAL_WEEKLY_SECONDS = 180; // P1

// Les règles V2 (RG-57, RG-58 — rappel de cartes) et V3 (twists) seront
// ajoutées ici au démarrage des lots correspondants, pas avant.
