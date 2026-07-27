import { describe, expect, it } from "vitest";
import {
  CHILD_WEIGHT,
  HOUSEHOLD_TIMEZONE,
  POINTS_BUDGET_BASE,
  WEEK_START_DAY,
} from "@/lib/config/business-rules";

describe("constantes métier (docs/02-regles-metier.md)", () => {
  it("applique le coefficient enfant de 0,6 (RG-09, RG-18)", () => {
    expect(CHILD_WEIGHT).toBe(0.6);
  });

  it("fixe le budget de points de base par objectif (RG-08)", () => {
    expect(POINTS_BUDGET_BASE).toEqual({
      leger: 24,
      equilibre: 30,
      gourmand: 36,
    });
  });

  it("fixe le fuseau horaire et le début de semaine (C8, C9)", () => {
    expect(HOUSEHOLD_TIMEZONE).toBe("Asia/Tokyo");
    expect(WEEK_START_DAY).toBe(1);
  });
});
