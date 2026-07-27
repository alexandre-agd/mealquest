// Référentiel d'ingrédients : listes fermées partagées entre le formulaire
// d'ajout et la validation serveur (docs/08).

export const INGREDIENT_CATEGORIES = [
  "vegetables",
  "fruits",
  "fish",
  "meat",
  "dairy_eggs",
  "soy",
  "frozen",
  "dry_goods",
  "condiments",
  "drinks",
  "other",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const INGREDIENT_UNITS = ["g", "ml", "piece", "bunch", "pack"] as const;

export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/**
 * Fabrique une clé stable à partir du nom anglais.
 *
 * La clé n'est jamais affichée : elle sert d'identifiant pour l'IA, qui doit
 * choisir dans une liste fermée (P2). D'où le format volontairement pauvre —
 * minuscules, chiffres et tirets bas — imposé par la contrainte SQL.
 */
export function slugifyIngredientKey(nameEn: string): string {
  const slug = nameEn
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Un nom entièrement non latin (saisi en japonais par erreur, par exemple)
  // ne laisserait rien : on garantit une clé exploitable malgré tout.
  return slug || `ingredient_${Date.now().toString(36)}`;
}
