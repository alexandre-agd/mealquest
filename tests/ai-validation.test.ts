import { describe, expect, it } from "vitest";
import {
  validateGeneration,
  versoPointsFrom,
} from "@/lib/ai/validation";
import type { ValidationContext } from "@/lib/ai/types";

function contexte(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    allowedIngredientKeys: new Set([
      "chicken_thigh",
      "onion",
      "rice",
      "shrimp",
      "soy_sauce",
      "egg",
    ]),
    allergenByIngredientKey: new Map([
      ["chicken_thigh", null],
      ["onion", null],
      ["rice", null],
      ["shrimp", "shrimp"],
      ["soy_sauce", "soy"],
      ["egg", "egg"],
    ]),
    householdAllergens: new Set(),
    availableEquipment: new Set(["pan", "pot", "stove", "rice_cooker"]),
    allowedUnits: new Set(["g", "ml", "piece", "bunch", "pack"]),
    recentTitles: new Set(),
    ...overrides,
  };
}

function carteValide(overrides: Record<string, unknown> = {}) {
  return {
    type: "standard",
    cuisine: "japonaise",
    points: 3,
    stars: 2,
    prep_minutes: 30,
    reference_portions: 2,
    title: { fr: "Poulet mijoté", ja: "鶏の煮物" },
    description: { fr: "Un plat simple.", ja: "シンプルな一品です。" },
    steps: {
      fr: ["Couper l'oignon.", "Faire revenir le poulet.", "Mijoter 20 minutes."],
      ja: ["玉ねぎを切ります。", "鶏肉を炒めます。", "20分煮ます。"],
    },
    ingredients: [
      { key: "chicken_thigh", quantity: 300, unit: "g" },
      { key: "onion", quantity: 1, unit: "piece" },
    ],
    equipment: ["pan", "stove"],
    verso: {
      form: "restes",
      title: { fr: "Bento de poulet", ja: "鶏肉のお弁当" },
      steps: { fr: ["Répartir dans la boîte."], ja: ["お弁当箱に詰めます。"] },
      extra_ingredients: [{ key: "rice", quantity: 150, unit: "g" }],
      extra_minutes: 5,
    },
    ...overrides,
  };
}

describe("carte conforme", () => {
  it("est acceptée telle quelle", () => {
    const { accepted, rejected } = validateGeneration(
      { cards: [carteValide()] },
      contexte(),
    );
    expect(rejected).toHaveLength(0);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].corrections).toHaveLength(0);
  });
});

describe("S1 — aucun ingrédient inventé (P2)", () => {
  it("rejette une clé absente du référentiel", () => {
    const { accepted, rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            ingredients: [{ key: "truffe_blanche_alba", quantity: 10, unit: "g" }],
          }),
        ],
      },
      contexte(),
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reasons.some((r) => r.rule === "S1")).toBe(true);
  });

  it("contrôle aussi les ingrédients du verso", () => {
    const carte = carteValide();
    carte.verso.extra_ingredients = [{ key: "quinoa_rouge", quantity: 80, unit: "g" }];
    const { rejected } = validateGeneration({ cards: [carte] }, contexte());
    expect(rejected[0].reasons.some((r) => r.rule === "S1")).toBe(true);
  });
});

describe("S2 — allergies bloquantes (RG-05)", () => {
  it("rejette une carte contenant un allergène du foyer", () => {
    const { accepted, rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            ingredients: [{ key: "shrimp", quantity: 200, unit: "g" }],
          }),
        ],
      },
      contexte({ householdAllergens: new Set(["shrimp"]) }),
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reasons.some((r) => r.rule === "S2")).toBe(true);
  });

  it("accepte le même ingrédient si personne n'y est allergique", () => {
    const { accepted } = validateGeneration(
      {
        cards: [
          carteValide({
            ingredients: [{ key: "shrimp", quantity: 200, unit: "g" }],
          }),
        ],
      },
      contexte(),
    );
    expect(accepted).toHaveLength(1);
  });

  it("bloque un allergène caché dans le verso", () => {
    const carte = carteValide();
    carte.verso.extra_ingredients = [{ key: "egg", quantity: 1, unit: "piece" }];
    const { rejected } = validateGeneration(
      { cards: [carte] },
      contexte({ householdAllergens: new Set(["egg"]) }),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S2")).toBe(true);
  });
});

describe("S3 — matériel du foyer (RG-07)", () => {
  it("rejette une carte exigeant un four absent", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide({ equipment: ["oven"] })] },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S3")).toBe(true);
  });
});

describe("S4 — les deux langues (RG-26)", () => {
  it("rejette un nombre d'étapes différent entre français et japonais", () => {
    const { rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            steps: { fr: ["Une.", "Deux.", "Trois."], ja: ["一つ。", "二つ。"] },
          }),
        ],
      },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S4")).toBe(true);
  });

  it("rejette un titre japonais vide", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide({ title: { fr: "Poulet", ja: "" } })] },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "schema")).toBe(true);
  });
});

describe("S7 — verso des cartes standard (RG-20, RG-21)", () => {
  it("rejette une carte standard sans verso", () => {
    const carte = carteValide();
    delete (carte as Record<string, unknown>).verso;
    const { rejected } = validateGeneration({ cards: [carte] }, contexte());
    expect(rejected[0].reasons.some((r) => r.rule === "S7")).toBe(true);
  });

  it("rejette un verso sur une carte lunch_solo", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide({ type: "lunch_solo" })] },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S7")).toBe(true);
  });

  it("rejette un verso express au-delà de 10 minutes", () => {
    const carte = carteValide();
    carte.verso.form = "express";
    carte.verso.extra_minutes = 25;
    const { rejected } = validateGeneration({ cards: [carte] }, contexte());
    expect(rejected[0].reasons.some((r) => r.rule === "S7")).toBe(true);
  });

  it("accepte une carte lunch_solo sans verso", () => {
    const carte = carteValide({ type: "lunch_solo" });
    delete (carte as Record<string, unknown>).verso;
    const { accepted } = validateGeneration({ cards: [carte] }, contexte());
    expect(accepted).toHaveLength(1);
    expect(accepted[0].versoPoints).toBeNull();
  });
});

describe("S8 — unités utilisables en magasin (RG-52)", () => {
  it("rejette « une pincée »", () => {
    const { rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            ingredients: [{ key: "onion", quantity: 1, unit: "pincée" }],
          }),
        ],
      },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S8")).toBe(true);
  });

  it("rejette une quantité nulle ou négative", () => {
    const { rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            ingredients: [{ key: "onion", quantity: 0, unit: "piece" }],
          }),
        ],
      },
      contexte(),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "schema")).toBe(true);
  });
});

describe("S9 — anti-répétition (RG-39)", () => {
  it("rejette un plat déjà cuisiné récemment", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide()] },
      contexte({ recentTitles: new Set(["poulet mijote"]) }),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S9")).toBe(true);
  });

  it("compare sans tenir compte des accents ni de la casse", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide({ title: { fr: "POULET MIJOTÉ", ja: "鶏の煮物" } })] },
      contexte({ recentTitles: new Set(["poulet mijote"]) }),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S9")).toBe(true);
  });

  it("repère aussi une reprise par le titre japonais", () => {
    const { rejected } = validateGeneration(
      { cards: [carteValide()] },
      contexte({ recentTitles: new Set(["鶏の煮物"]) }),
    );
    expect(rejected[0].reasons.some((r) => r.rule === "S9")).toBe(true);
  });
});

describe("S5 et S6 — corrections automatiques", () => {
  it("ramène un score hors bornes dans l'intervalle", () => {
    const { accepted } = validateGeneration(
      { cards: [carteValide({ points: 9 })] },
      contexte(),
    );
    expect(accepted[0].card.points).toBe(5);
    expect(accepted[0].corrections.some((c) => c.rule === "S5")).toBe(true);
  });

  it("aligne les étoiles sur le temps annoncé", () => {
    const { accepted } = validateGeneration(
      { cards: [carteValide({ prep_minutes: 15, stars: 3 })] },
      contexte(),
    );
    expect(accepted[0].card.stars).toBe(1);
    expect(accepted[0].corrections.some((c) => c.rule === "S6")).toBe(true);
  });

  it("ne corrige rien quand tout est cohérent", () => {
    const { accepted } = validateGeneration(
      { cards: [carteValide({ prep_minutes: 50, stars: 3 })] },
      contexte(),
    );
    expect(accepted[0].corrections).toHaveLength(0);
  });
});

describe("S10 — incohérence de temps, signalée sans bloquer", () => {
  it("accepte la carte mais la signale", () => {
    const { accepted } = validateGeneration(
      {
        cards: [
          carteValide({
            prep_minutes: 8,
            stars: 1,
            steps: {
              fr: ["Un.", "Deux.", "Trois.", "Quatre.", "Cinq.", "Six."],
              ja: ["一。", "二。", "三。", "四。", "五。", "六。"],
            },
          }),
        ],
      },
      contexte(),
    );
    expect(accepted).toHaveLength(1);
    expect(accepted[0].warnings.some((w) => w.rule === "S10")).toBe(true);
  });
});

describe("points du verso (RG-23)", () => {
  it("vaut la moitié du recto, arrondie à l'inférieur", () => {
    expect(versoPointsFrom(4)).toBe(2);
    expect(versoPointsFrom(5)).toBe(2);
    expect(versoPointsFrom(3)).toBe(1);
  });

  it("ne descend jamais sous 1", () => {
    expect(versoPointsFrom(1)).toBe(1);
    expect(versoPointsFrom(0)).toBe(1);
  });

  it("est calculé par le code, jamais repris du modèle", () => {
    const { accepted } = validateGeneration(
      { cards: [carteValide({ points: 5 })] },
      contexte(),
    );
    expect(accepted[0].versoPoints).toBe(2);
  });
});

describe("robustesse de la réponse", () => {
  it("rejette une réponse qui n'est pas { cards: [...] }", () => {
    const { accepted, rejected } = validateGeneration(
      { recettes: [] },
      contexte(),
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reasons[0].rule).toBe("schema");
  });

  it("garde les bonnes cartes et n'écarte que les mauvaises", () => {
    const { accepted, rejected } = validateGeneration(
      {
        cards: [
          carteValide(),
          carteValide({
            title: { fr: "Autre plat", ja: "別の料理" },
            ingredients: [{ key: "ingredient_invente", quantity: 1, unit: "g" }],
          }),
        ],
      },
      contexte(),
    );
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("accumule plusieurs motifs de rejet sur une même carte", () => {
    const { rejected } = validateGeneration(
      {
        cards: [
          carteValide({
            equipment: ["oven"],
            ingredients: [{ key: "inconnu", quantity: 1, unit: "cuillère" }],
          }),
        ],
      },
      contexte(),
    );
    const regles = rejected[0].reasons.map((r) => r.rule);
    expect(regles).toContain("S1");
    expect(regles).toContain("S3");
    expect(regles).toContain("S8");
  });
});
