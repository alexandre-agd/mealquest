import { describe, expect, it } from "vitest";
import {
  computeAdjustedPointsBudget,
  computePointsBudget,
  effectivePointsBudget,
} from "@/lib/household/budget";
import { POINTS_BUDGET_BASE } from "@/lib/config/business-rules";

describe("budget de points du foyer (RG-08, RG-09)", () => {
  it("rend le budget de base pour 2 adultes sans enfant", () => {
    // budget = base × (2 + 0) / 2 = base
    expect(computePointsBudget("leger", 2, 0)).toBe(POINTS_BUDGET_BASE.leger);
    expect(computePointsBudget("equilibre", 2, 0)).toBe(30);
    expect(computePointsBudget("gourmand", 2, 0)).toBe(36);
  });

  it("applique le coefficient 0,6 par enfant (A1.9)", () => {
    // 30 × (2 + 1 × 0,6) / 2 = 30 × 2,6 / 2 = 39
    expect(computePointsBudget("equilibre", 2, 1)).toBe(39);
    // 24 × (2 + 2 × 0,6) / 2 = 24 × 3,2 / 2 = 38,4 -> 39
    expect(computePointsBudget("leger", 2, 2)).toBe(39);
  });

  it("arrondit à l'entier supérieur", () => {
    // 30 × (1 + 0,6) / 2 = 24 exactement, aucun arrondi
    expect(computePointsBudget("equilibre", 1, 1)).toBe(24);
    // 36 × (1 + 1 × 0,6) / 2 = 28,8 -> 29
    expect(computePointsBudget("gourmand", 1, 1)).toBe(29);
    // 24 × (3 + 0) / 2 = 36 exactement
    expect(computePointsBudget("leger", 3, 0)).toBe(36);
  });

  it("suit le changement d'objectif à composition constante (A1.8)", () => {
    const leger = computePointsBudget("leger", 2, 0);
    const equilibre = computePointsBudget("equilibre", 2, 0);
    const gourmand = computePointsBudget("gourmand", 2, 0);
    expect(leger).toBeLessThan(equilibre);
    expect(equilibre).toBeLessThan(gourmand);
  });

  it("échelonne avec le nombre d'adultes", () => {
    expect(computePointsBudget("equilibre", 1, 0)).toBe(15);
    expect(computePointsBudget("equilibre", 2, 0)).toBe(30);
    expect(computePointsBudget("equilibre", 4, 0)).toBe(60);
  });
});

describe("surcharge manuelle du budget (docs/04)", () => {
  it("l'emporte sur le calcul quand elle est renseignée", () => {
    expect(effectivePointsBudget("equilibre", 2, 0, 42)).toBe(42);
  });

  it("retombe sur le calcul si elle est absente ou nulle", () => {
    expect(effectivePointsBudget("equilibre", 2, 0, null)).toBe(30);
    expect(effectivePointsBudget("equilibre", 2, 0, undefined)).toBe(30);
    expect(effectivePointsBudget("equilibre", 2, 0, 0)).toBe(30);
  });
});

describe("budget ajusté au nombre de repas prévus", () => {
  it("rend le budget plein pour une semaine complète", () => {
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 7)).toBe(30);
  });

  it("réduit proportionnellement quand on cuisine moins de soirs", () => {
    // 30 × 4/7 = 17,1 -> 18
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 4)).toBe(18);
    // 30 × 5/7 = 21,4 -> 22
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 5)).toBe(22);
    // 30 × 2/7 = 8,6 -> 9
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 2)).toBe(9);
  });

  it("dépasse le budget plein si la semaine compte plus de sept repas", () => {
    // 5 dîners + 3 midis orphelins : le foyer prépare plus que d'habitude.
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 8)).toBe(35);
  });

  it("suit l'objectif du foyer", () => {
    expect(computeAdjustedPointsBudget("leger", 2, 0, 4)).toBe(14);
    expect(computeAdjustedPointsBudget("gourmand", 2, 0, 4)).toBe(21);
  });

  it("tient compte du coefficient enfant", () => {
    // 39 × 4/7 = 22,3 -> 23
    expect(computeAdjustedPointsBudget("equilibre", 2, 1, 4)).toBe(23);
  });

  it("rend 0 quand aucun repas n'est prévu", () => {
    expect(computeAdjustedPointsBudget("equilibre", 2, 0, 0)).toBe(0);
  });

  it("reste une enveloppe commune, pas un plafond par repas", () => {
    // Un seul repas généreux peut consommer une grande part du budget :
    // c'est voulu, on se rattrape sur les autres soirs.
    const budget = computeAdjustedPointsBudget("equilibre", 2, 0, 4);
    expect(budget).toBeGreaterThan(5);
  });
});
