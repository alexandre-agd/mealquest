import { describe, expect, it } from "vitest";
import { computeHandSize, buildUserPrompt, type GenerationContext } from "@/lib/ai/context";
import { extractJson } from "@/lib/ai/provider";
import type { ValidationContext } from "@/lib/ai/types";

describe("taille de la main (RG-37)", () => {
  it("propose deux fois le nombre de besoins", () => {
    expect(computeHandSize(4, 0)).toEqual({ standard: 8, lunchSolo: 0, total: 8 });
    expect(computeHandSize(3, 2)).toEqual({ standard: 6, lunchSolo: 4, total: 10 });
  });

  it("plafonne à 20 cartes en réduisant proportionnellement", () => {
    const hand = computeHandSize(9, 4);
    expect(hand.total).toBeLessThanOrEqual(20);
    expect(hand.standard).toBeGreaterThan(0);
    expect(hand.lunchSolo).toBeGreaterThan(0);
  });

  it("ne demande aucune carte lunch_solo sans besoin orphelin", () => {
    expect(computeHandSize(2, 0).lunchSolo).toBe(0);
  });

  it("garde au moins une carte de chaque type demandé", () => {
    const hand = computeHandSize(20, 1);
    expect(hand.lunchSolo).toBeGreaterThanOrEqual(1);
    expect(hand.standard).toBeGreaterThanOrEqual(1);
  });
});

function contexteGeneration(
  overrides: Partial<GenerationContext> = {},
): GenerationContext {
  return {
    adults: 2,
    children: 0,
    goal: "equilibre",
    equipment: ["pan", "pot"],
    allergens: ["shrimp"],
    dislikes: ["natto"],
    dinnerNeeds: [{ portions: 2, versoPortions: 1 }],
    orphanLunchPortions: [1],
    fridge: [
      { key: "carrot", level: 3 },
      { key: "onion", level: 2 },
    ],
    ingredients: [
      {
        key: "carrot",
        name_en: "Carrot",
        name_ja: "にんじん",
        category: "vegetables",
        default_unit: "piece",
      },
    ],
    recentDishes: ["Curry japonais"],
    ...overrides,
  };
}

describe("contexte envoyé au modèle (docs/05 §3)", () => {
  const prompt = buildUserPrompt(contexteGeneration());

  it("annonce les allergies comme bloquantes", () => {
    expect(prompt).toContain("BLOQUANTES");
    expect(prompt).toContain("shrimp");
  });

  it("transmet le matériel disponible", () => {
    expect(prompt).toContain("pan, pot");
  });

  it("signale les ingrédients à consommer en priorité (RG-35)", () => {
    expect(prompt).toContain("À CONSOMMER EN PRIORITÉ");
    expect(prompt).toContain("carrot");
  });

  it("donne les portions du verso séparément de celles du dîner (RG-19)", () => {
    expect(prompt).toContain("2 portion(s)");
    expect(prompt).toContain("verso pour 1 portion(s)");
    expect(prompt).toContain("souvent différent");
  });

  it("indique quand le verso ne servira pas (RG-44)", () => {
    const sansVerso = buildUserPrompt(
      contexteGeneration({ dinnerNeeds: [{ portions: 2, versoPortions: 0 }] }),
    );
    expect(sansVerso).toContain("le verso ne sera pas utilisé");
  });

  it("liste les plats récents à ne pas reproposer (RG-39)", () => {
    expect(prompt).toContain("Curry japonais");
  });

  it("fournit le référentiel avec le nom japonais (P5)", () => {
    expect(prompt).toContain("carrot | Carrot | にんじん");
  });

  it("insiste sur l'usage exclusif des clés fournies (P2)", () => {
    expect(prompt).toContain("EXCLUSIVEMENT");
  });

  it("ne mentionne rien à consommer en priorité si le frigo n'a aucun niveau 3", () => {
    const sansPriorite = buildUserPrompt(
      contexteGeneration({ fridge: [{ key: "onion", level: 2 }] }),
    );
    expect(sansPriorite).toContain("Rien à consommer en priorité");
  });
});

describe("extraction du JSON de la réponse", () => {
  it("lit une réponse JSON directe", () => {
    expect(extractJson('{"cards":[]}')).toEqual({ cards: [] });
  });

  it("lit une réponse encadrée par un bloc de code", () => {
    expect(extractJson('```json\n{"cards":[1]}\n```')).toEqual({ cards: [1] });
  });

  it("lit une réponse précédée d'une phrase d'introduction", () => {
    expect(extractJson('Voici vos cartes :\n{"cards":[2]}')).toEqual({ cards: [2] });
  });

  it("rend null quand rien n'est exploitable", () => {
    expect(extractJson("désolé, je ne peux pas")).toBeNull();
  });
});

// Le contexte de validation n'est pas exercé ici : il l'est en détail dans
// tests/ai-validation.test.ts. On vérifie seulement qu'il se construit.
describe("contexte de validation", () => {
  it("se compose des ensembles attendus", () => {
    const validation: ValidationContext = {
      allowedIngredientKeys: new Set(["carrot"]),
      allergenByIngredientKey: new Map([["carrot", null]]),
      householdAllergens: new Set(["shrimp"]),
      availableEquipment: new Set(["pan"]),
      allowedUnits: new Set(["g"]),
      recentTitles: new Set(["curry japonais"]),
    };
    expect(validation.allowedIngredientKeys.has("carrot")).toBe(true);
    expect(validation.householdAllergens.has("shrimp")).toBe(true);
  });
});
