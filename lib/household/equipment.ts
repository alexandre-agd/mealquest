// Référentiel du matériel de cuisine (docs/04-donnees-metier.md).
// Les libellés FR / JA vivent dans les fichiers de traduction, sous la clé
// `equipment.<clé>` : aucun texte affichable ici (A1.11).

export const EQUIPMENT_KEYS = [
  "stove",
  "pan",
  "pot",
  "donabe",
  "oven",
  "microwave",
  "fish_grill",
  "rice_cooker",
  "pressure_cooker",
  "air_fryer",
  "blender",
  "hand_blender",
  "food_processor",
  "steamer",
  "takoyaki_plate",
  "hotplate",
  "mortar",
  "mandoline",
  "scale",
  "thermometer",
  "bento_box",
  "freezer",
] as const;

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

// Matériel supposé présent dans toute cuisine : coché par défaut à
// l'onboarding (parcours A5). Doit rester cohérent avec la valeur par
// défaut appliquée par la fonction SQL create_household().
export const DEFAULT_EQUIPMENT: EquipmentKey[] = [
  "stove",
  "pan",
  "pot",
  "microwave",
];

// Familles d'allergènes, classification japonaise (docs/08).
export const ALLERGEN_FAMILIES = [
  "egg",
  "milk",
  "wheat",
  "buckwheat",
  "peanut",
  "shrimp",
  "crab",
  "soy",
  "sesame",
  "nuts",
  "fish",
] as const;

export type AllergenFamily = (typeof ALLERGEN_FAMILIES)[number];
