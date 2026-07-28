/**
 * Calcul de la liste de courses (RG-47).
 *
 * Code déterministe, jamais confié à l'IA : une liste fausse rend
 * l'application inutilisable au supermarché (docs/05, §2). Module pur, sans
 * base ni réseau, donc testable seul.
 */

/** Rayons, dans l'ordre d'un parcours de supermarché japonais (RG-48). */
export const AISLE_ORDER = [
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

export type Aisle = (typeof AISLE_ORDER)[number];

/** Un ingrédient demandé par une carte posée sur un créneau. */
export type RequiredIngredient = {
  ingredientId: string;
  key: string;
  name_fr: string;
  name_ja: string;
  category: string;
  unit: string;
  staple: boolean;
  /** Quantité pour les portions de référence de la carte. */
  quantity: number;
  /** Portions réellement prévues sur le créneau (RG-55). */
  slotPortions: number;
  /** Portions pour lesquelles la carte exprime ses quantités. */
  referencePortions: number;
};

export type ShoppingLine = {
  ingredientId: string;
  name_fr: string;
  name_ja: string;
  aisle: Aisle;
  quantity: number;
  unit: string;
  /** Nombre de recettes distinctes qui l'utilisent, pour appliquer RG-47. */
  usedCount: number;
};

export type ShoppingList = {
  /** À acheter, groupé par rayon dans l'ordre du parcours. */
  toBuy: Array<{ aisle: Aisle; lines: ShoppingLine[] }>;
  /** Niveau 1 utilisé une seule fois : sans doute suffisant. */
  probablyEnough: ShoppingLine[];
  /** Staples, sans quantité : « à vérifier dans le placard ». */
  pantry: Array<{ ingredientId: string; name_fr: string; name_ja: string }>;
};

function aisleOf(category: string): Aisle {
  return (AISLE_ORDER as readonly string[]).includes(category)
    ? (category as Aisle)
    : "other";
}

/**
 * Arrondi des quantités.
 *
 * On ne vend pas 133,3 g de porc. Sous 10, on garde une décimale (utile pour
 * les pièces et les bottes) ; au-delà, on arrondit à l'entier supérieur — il
 * vaut mieux un peu trop qu'un ingrédient manquant en pleine recette.
 */
function roundQuantity(value: number): number {
  if (value < 10) return Math.round(value * 10) / 10;
  return Math.ceil(value);
}

/**
 * Construit la liste à partir des ingrédients requis et de l'état du frigo.
 *
 * `stockLevels` donne le niveau saisi à l'inventaire (RG-31). Un ingrédient
 * absent de la table vaut 0, conformément à RG-32.
 */
export function computeShoppingList(
  required: RequiredIngredient[],
  stockLevels: Map<string, number>,
): ShoppingList {
  // Agrégation par ingrédient, avec ajustement aux portions réelles du
  // créneau : une carte prévue pour 2 posée sur un créneau de 1 ne doit pas
  // faire acheter le double (RG-47, RG-55).
  const aggregated = new Map<
    string,
    Omit<ShoppingLine, "aisle"> & { category: string; staple: boolean }
  >();

  for (const item of required) {
    const ratio =
      item.referencePortions > 0 ? item.slotPortions / item.referencePortions : 1;
    const adjusted = item.quantity * ratio;

    const existing = aggregated.get(item.ingredientId);
    if (existing) {
      existing.quantity += adjusted;
      existing.usedCount += 1;
    } else {
      aggregated.set(item.ingredientId, {
        ingredientId: item.ingredientId,
        name_fr: item.name_fr,
        name_ja: item.name_ja,
        quantity: adjusted,
        unit: item.unit,
        usedCount: 1,
        category: item.category,
        staple: item.staple,
      });
    }
  }

  const byAisle = new Map<Aisle, ShoppingLine[]>();
  const probablyEnough: ShoppingLine[] = [];
  const pantry: ShoppingList["pantry"] = [];

  for (const entry of aggregated.values()) {
    // Les staples ne sont jamais inventoriés (RG-30) : ils vont dans la
    // rubrique placard, sans quantité, quel que soit l'état du frigo.
    if (entry.staple) {
      pantry.push({
        ingredientId: entry.ingredientId,
        name_fr: entry.name_fr,
        name_ja: entry.name_ja,
      });
      continue;
    }

    const level = stockLevels.get(entry.ingredientId) ?? 0;

    // Niveau 2 ou 3 : il y en a assez, on n'achète pas.
    if (level >= 2) continue;

    const line: ShoppingLine = {
      ingredientId: entry.ingredientId,
      name_fr: entry.name_fr,
      name_ja: entry.name_ja,
      aisle: aisleOf(entry.category),
      quantity: roundQuantity(entry.quantity),
      unit: entry.unit,
      usedCount: entry.usedCount,
    };

    // Niveau 1 : le reste suffit si l'ingrédient ne sert qu'une fois.
    if (level === 1 && entry.usedCount < 2) {
      probablyEnough.push(line);
      continue;
    }

    const lines = byAisle.get(line.aisle) ?? [];
    lines.push(line);
    byAisle.set(line.aisle, lines);
  }

  const collator = new Intl.Collator("fr");
  const toBuy = AISLE_ORDER.filter((aisle) => byAisle.has(aisle)).map((aisle) => ({
    aisle,
    lines: (byAisle.get(aisle) ?? []).sort((a, b) =>
      collator.compare(a.name_fr, b.name_fr),
    ),
  }));

  probablyEnough.sort((a, b) => collator.compare(a.name_fr, b.name_fr));
  pantry.sort((a, b) => collator.compare(a.name_fr, b.name_fr));

  return { toBuy, probablyEnough, pantry };
}
