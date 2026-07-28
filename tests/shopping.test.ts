import { describe, expect, it } from "vitest";
import {
  AISLE_ORDER,
  computeShoppingList,
  type RequiredIngredient,
} from "@/lib/shopping/compute";

function ingredient(
  overrides: Partial<RequiredIngredient> & Pick<RequiredIngredient, "ingredientId">,
): RequiredIngredient {
  return {
    key: "ingredient",
    name_fr: "Ingrédient",
    name_ja: "食材",
    category: "vegetables",
    unit: "g",
    staple: false,
    quantity: 100,
    slotPortions: 2,
    referencePortions: 2,
    ...overrides,
  };
}

const CAROTTE = {
  ingredientId: "carotte",
  key: "carrot",
  name_fr: "Carotte",
  name_ja: "にんじん",
  category: "vegetables",
};

const PORC = {
  ingredientId: "porc",
  key: "pork",
  name_fr: "Porc",
  name_ja: "豚肉",
  category: "meat",
};

const SAUCE_SOJA = {
  ingredientId: "soja",
  key: "soy_sauce",
  name_fr: "Sauce soja",
  name_ja: "しょうゆ",
  category: "condiments",
  staple: true,
};

describe("A5.2 — un ingrédient au niveau 2 ou 3 n'est pas acheté", () => {
  it("écarte un ingrédient dont il reste assez", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE })],
      new Map([["carotte", 2]]),
    );
    expect(list.toBuy).toHaveLength(0);
    expect(list.probablyEnough).toHaveLength(0);
  });

  it("écarte aussi un ingrédient à consommer en priorité", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE })],
      new Map([["carotte", 3]]),
    );
    expect(list.toBuy).toHaveLength(0);
  });
});

describe("A5.3 et A5.4 — le niveau 1 dépend du nombre d'usages", () => {
  it("un ingrédient utilisé une seule fois va dans « probablement suffisant »", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE })],
      new Map([["carotte", 1]]),
    );
    expect(list.toBuy).toHaveLength(0);
    expect(list.probablyEnough.map((l) => l.name_fr)).toEqual(["Carotte"]);
  });

  it("le même ingrédient utilisé deux fois passe dans les courses", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE }), ingredient({ ...CAROTTE })],
      new Map([["carotte", 1]]),
    );
    expect(list.probablyEnough).toHaveLength(0);
    expect(list.toBuy[0].lines[0].name_fr).toBe("Carotte");
    expect(list.toBuy[0].lines[0].quantity).toBe(200);
  });

  it("un ingrédient absent du frigo est toujours acheté", () => {
    const list = computeShoppingList([ingredient({ ...CAROTTE })], new Map());
    expect(list.toBuy[0].lines[0].name_fr).toBe("Carotte");
  });
});

describe("A5.5 — les staples vont dans le placard, sans quantité", () => {
  it("sépare les staples des courses", () => {
    const list = computeShoppingList(
      [ingredient({ ...SAUCE_SOJA, quantity: 30, unit: "ml" })],
      new Map(),
    );
    expect(list.toBuy).toHaveLength(0);
    expect(list.pantry).toEqual([
      { ingredientId: "soja", name_fr: "Sauce soja", name_ja: "しょうゆ" },
    ]);
  });

  it("y met le staple même si le frigo est vide", () => {
    const list = computeShoppingList(
      [ingredient({ ...SAUCE_SOJA })],
      new Map([["soja", 0]]),
    );
    expect(list.pantry).toHaveLength(1);
    expect(list.toBuy).toHaveLength(0);
  });
});

describe("quantités ajustées aux portions réelles (RG-47, RG-55)", () => {
  it("réduit quand le créneau demande moins de portions que la carte", () => {
    // Carte pour 2 portions, créneau d'une seule personne.
    const list = computeShoppingList(
      [ingredient({ ...PORC, quantity: 300, referencePortions: 2, slotPortions: 1 })],
      new Map(),
    );
    expect(list.toBuy[0].lines[0].quantity).toBe(150);
  });

  it("augmente quand le créneau demande plus de portions", () => {
    const list = computeShoppingList(
      [ingredient({ ...PORC, quantity: 300, referencePortions: 2, slotPortions: 3 })],
      new Map(),
    );
    expect(list.toBuy[0].lines[0].quantity).toBe(450);
  });

  it("additionne les besoins de plusieurs recettes", () => {
    const list = computeShoppingList(
      [
        ingredient({ ...PORC, quantity: 300, referencePortions: 2, slotPortions: 2 }),
        ingredient({ ...PORC, quantity: 200, referencePortions: 2, slotPortions: 1 }),
      ],
      new Map(),
    );
    // 300 + 100 = 400
    expect(list.toBuy[0].lines[0].quantity).toBe(400);
    expect(list.toBuy[0].lines[0].usedCount).toBe(2);
  });

  it("arrondit à l'entier supérieur au-delà de 10", () => {
    const list = computeShoppingList(
      [ingredient({ ...PORC, quantity: 100, referencePortions: 3, slotPortions: 2 })],
      new Map(),
    );
    // 66,67 -> 67, plutôt qu'un chiffre inutilisable en magasin
    expect(list.toBuy[0].lines[0].quantity).toBe(67);
  });

  it("garde une décimale pour les petites quantités, comme les pièces", () => {
    const list = computeShoppingList(
      [
        ingredient({
          ...CAROTTE,
          unit: "piece",
          quantity: 3,
          referencePortions: 2,
          slotPortions: 1,
        }),
      ],
      new Map(),
    );
    expect(list.toBuy[0].lines[0].quantity).toBe(1.5);
  });
});

describe("A5.6 — groupement par rayon, dans l'ordre du parcours", () => {
  it("range les rayons dans l'ordre du magasin, pas alphabétique", () => {
    const list = computeShoppingList(
      [
        ingredient({ ...SAUCE_SOJA, staple: false, ingredientId: "mirin" }),
        ingredient({ ...PORC }),
        ingredient({ ...CAROTTE }),
      ],
      new Map(),
    );
    expect(list.toBuy.map((group) => group.aisle)).toEqual([
      "vegetables",
      "meat",
      "condiments",
    ]);
  });

  it("suit l'ordre défini par RG-48", () => {
    expect(AISLE_ORDER[0]).toBe("vegetables");
    expect(AISLE_ORDER[AISLE_ORDER.length - 1]).toBe("other");
  });

  it("classe les lignes d'un rayon par nom", () => {
    const list = computeShoppingList(
      [
        ingredient({ ...CAROTTE, ingredientId: "b", name_fr: "Brocoli" }),
        ingredient({ ...CAROTTE, ingredientId: "a", name_fr: "Ail" }),
      ],
      new Map(),
    );
    expect(list.toBuy[0].lines.map((l) => l.name_fr)).toEqual(["Ail", "Brocoli"]);
  });

  it("range une catégorie inconnue dans « autre »", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE, category: "inconnue" })],
      new Map(),
    );
    expect(list.toBuy[0].aisle).toBe("other");
  });
});

describe("A5.7 — chaque ligne porte les deux langues", () => {
  it("conserve le nom français et le nom japonais", () => {
    const list = computeShoppingList([ingredient({ ...CAROTTE })], new Map());
    const line = list.toBuy[0].lines[0];
    expect(line.name_fr).toBe("Carotte");
    expect(line.name_ja).toBe("にんじん");
  });

  it("les garde aussi dans la rubrique placard", () => {
    const list = computeShoppingList([ingredient({ ...SAUCE_SOJA })], new Map());
    expect(list.pantry[0].name_ja).toBe("しょうゆ");
  });
});

describe("cas limites", () => {
  it("rend une liste vide sans aucune carte", () => {
    const list = computeShoppingList([], new Map());
    expect(list.toBuy).toHaveLength(0);
    expect(list.probablyEnough).toHaveLength(0);
    expect(list.pantry).toHaveLength(0);
  });

  it("ne divise pas par zéro si la carte n'a pas de portions de référence", () => {
    const list = computeShoppingList(
      [ingredient({ ...CAROTTE, referencePortions: 0, quantity: 120 })],
      new Map(),
    );
    expect(list.toBuy[0].lines[0].quantity).toBe(120);
  });

  it("n'inscrit un staple qu'une fois, même utilisé par plusieurs recettes", () => {
    const list = computeShoppingList(
      [ingredient({ ...SAUCE_SOJA }), ingredient({ ...SAUCE_SOJA })],
      new Map(),
    );
    expect(list.pantry).toHaveLength(1);
  });
});
