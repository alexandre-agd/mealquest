import { describe, expect, it } from "vitest";
import {
  availabilityKey,
  computePortions,
  computeWeekNeeds,
  isStatusAllowed,
  nextStatus,
  statusesForSlot,
  statusOf,
  versoPortions,
  type AvailabilityMap,
  type AvailabilityStatus,
  type MealSlot,
  type MemberRef,
} from "@/lib/week/needs";

// Semaine de référence : lundi 16 mars 2026 au dimanche 22.
const LUNDI = "2026-03-16";
const MARDI = "2026-03-17";
const MERCREDI = "2026-03-18";
const DIMANCHE_PRECEDENT = "2026-03-15";

const MOI: MemberRef = { id: "moi", kind: "adulte" };
const ELLE: MemberRef = { id: "elle", kind: "adulte" };
const ENFANT: MemberRef = { id: "enfant", kind: "enfant" };

function build(
  entries: Array<[string, MealSlot, string, AvailabilityStatus]>,
): AvailabilityMap {
  return new Map(
    entries.map(([date, slot, memberId, status]) => [
      availabilityKey(date, slot, memberId),
      status,
    ]),
  );
}

describe("statuts proposés par créneau (RG-12)", () => {
  it("propose le bento au déjeuner (A2.2)", () => {
    expect(statusesForSlot("midi")).toContain("bento");
  });

  it("ne propose pas le bento au dîner (A2.3)", () => {
    expect(statusesForSlot("soir")).not.toContain("bento");
    expect(isStatusAllowed("soir", "bento")).toBe(false);
  });

  it("propose maison sur les deux créneaux", () => {
    expect(isStatusAllowed("midi", "maison")).toBe(true);
    expect(isStatusAllowed("soir", "maison")).toBe(true);
  });

  it("fait le tour du cycle sans jamais sortir des statuts autorisés", () => {
    for (const slot of ["midi", "soir"] as MealSlot[]) {
      let status: AvailabilityStatus = "libre";
      const seen = new Set<AvailabilityStatus>();
      for (let i = 0; i < statusesForSlot(slot).length; i++) {
        status = nextStatus(slot, status);
        expect(isStatusAllowed(slot, status)).toBe(true);
        seen.add(status);
      }
      // Un cycle complet revient au point de départ.
      expect(status).toBe("libre");
      expect(seen.size).toBe(statusesForSlot(slot).length);
    }
  });
});

describe("statut par défaut (RG-13, A2.12)", () => {
  it("une case jamais touchée vaut libre", () => {
    expect(statusOf(new Map(), LUNDI, "soir", "moi")).toBe("libre");
  });

  it("une case jamais touchée ne crée aucun besoin", () => {
    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], new Map());
    expect(needs.totalDinners).toBe(0);
    expect(needs.lunches).toHaveLength(0);
    expect(needs.totalBentos).toBe(0);
  });
});

describe("portions (RG-18)", () => {
  it("compte un adulte pour une portion", () => {
    expect(computePortions([MOI])).toBe(1);
    expect(computePortions([MOI, ELLE])).toBe(2);
  });

  it("compte un enfant pour 0,6 portion, arrondi au supérieur", () => {
    // 2 + 0,6 = 2,6 -> 3
    expect(computePortions([MOI, ELLE, ENFANT])).toBe(3);
    // 0,6 -> 1
    expect(computePortions([ENFANT])).toBe(1);
    // 1 + 0,6 = 1,6 -> 2
    expect(computePortions([MOI, ENFANT])).toBe(2);
    // 0,6 × 2 = 1,2 -> 2
    expect(computePortions([ENFANT, { id: "e2", kind: "enfant" }])).toBe(2);
  });

  it("applique le minimum de 1", () => {
    expect(computePortions([ENFANT])).toBeGreaterThanOrEqual(1);
  });

  it("rend 0 quand personne n'est concerné", () => {
    expect(computePortions([])).toBe(0);
  });
});

describe("besoin dîner (RG-15)", () => {
  it("A2.8 — mardi soir, moi maison et elle exterieur : 1 besoin, 1 portion", () => {
    const availabilities = build([
      [MARDI, "soir", "moi", "maison"],
      [MARDI, "soir", "elle", "exterieur"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.totalDinners).toBe(1);
    expect(needs.dinners[0].date).toBe(MARDI);
    expect(needs.dinners[0].portions).toBe(1);
    expect(needs.dinners[0].members.map((m) => m.id)).toEqual(["moi"]);
  });

  it("ne crée pas de besoin si tout le monde est dehors ou libre", () => {
    const availabilities = build([
      [MARDI, "soir", "moi", "exterieur"],
      [MARDI, "soir", "elle", "libre"],
    ]);
    expect(computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities).totalDinners).toBe(0);
  });
});

describe("besoin déjeuner (RG-16)", () => {
  it("A2.9 — mercredi midi, moi exterieur et elle bento : 1 besoin, 1 portion", () => {
    const availabilities = build([
      [MERCREDI, "midi", "moi", "exterieur"],
      [MERCREDI, "midi", "elle", "bento"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.lunches).toHaveLength(1);
    expect(needs.lunches[0].portions).toBe(1);
    expect(needs.lunches[0].members.map((m) => m.id)).toEqual(["elle"]);
  });

  it("compte aussi le statut maison au déjeuner", () => {
    const availabilities = build([[MERCREDI, "midi", "moi", "maison"]]);
    expect(computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities).lunches).toHaveLength(1);
  });
});

describe("déjeuner orphelin (RG-17, A2.11)", () => {
  it("lundi midi avec besoin, dimanche soir sans besoin : orphelin", () => {
    const availabilities = build([[LUNDI, "midi", "moi", "bento"]]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.orphanLunches).toHaveLength(1);
    expect(needs.orphanLunches[0].date).toBe(LUNDI);
    expect(needs.lunches[0].coveredByVerso).toBe(false);
  });

  it("un dîner la veille couvre le déjeuner par son verso", () => {
    const availabilities = build([
      [DIMANCHE_PRECEDENT, "soir", "moi", "maison"],
      [LUNDI, "midi", "moi", "bento"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.orphanLunches).toHaveLength(0);
    expect(needs.lunches[0].coveredByVerso).toBe(true);
  });

  it("un lendemain de restaurant redevient orphelin", () => {
    const availabilities = build([
      [LUNDI, "soir", "moi", "exterieur"],
      [MARDI, "midi", "moi", "bento"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.orphanLunches.map((n) => n.date)).toEqual([MARDI]);
  });
});

describe("A2.10 — asymétrie dîner / bento du lendemain (RG-19)", () => {
  // Le cas d'usage réel le plus fréquent du foyer, et celui que les
  // applications concurrentes ratent. Traité comme le cas normal.
  const availabilities = build([
    [LUNDI, "soir", "moi", "maison"],
    [LUNDI, "soir", "elle", "maison"],
    [MARDI, "midi", "moi", "exterieur"],
    [MARDI, "midi", "elle", "bento"],
  ]);

  it("le dîner du lundi est prévu pour 2 portions", () => {
    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);
    const lundiSoir = needs.dinners.find((n) => n.date === LUNDI);
    expect(lundiSoir?.portions).toBe(2);
  });

  it("le verso du mardi midi est prévu pour 1 portion, pas 2", () => {
    expect(versoPortions(LUNDI, [MOI, ELLE], availabilities)).toBe(1);
  });

  it("le déjeuner du mardi est bien couvert par le verso, pas orphelin", () => {
    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);
    const mardiMidi = needs.lunches.find((n) => n.date === MARDI);
    expect(mardiMidi?.coveredByVerso).toBe(true);
    expect(mardiMidi?.portions).toBe(1);
  });

  it("rend 0 portion quand le lendemain midi n'a aucun besoin (RG-44)", () => {
    const sansBesoin = build([
      [LUNDI, "soir", "moi", "maison"],
      [MARDI, "midi", "moi", "exterieur"],
      [MARDI, "midi", "elle", "exterieur"],
    ]);
    expect(versoPortions(LUNDI, [MOI, ELLE], sansBesoin)).toBe(0);
  });

  it("le verso peut aussi être plus grand que le dîner", () => {
    // Dîner en solo, mais les deux emportent un bento le lendemain.
    const inverse = build([
      [LUNDI, "soir", "moi", "maison"],
      [MARDI, "midi", "moi", "bento"],
      [MARDI, "midi", "elle", "bento"],
    ]);
    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], inverse);
    expect(needs.dinners.find((n) => n.date === LUNDI)?.portions).toBe(1);
    expect(versoPortions(LUNDI, [MOI, ELLE], inverse)).toBe(2);
  });
});

describe("compteur permanent (parcours B1, A2.7)", () => {
  it("compte les dîners à prévoir et les bentos à emporter", () => {
    const availabilities = build([
      [LUNDI, "soir", "moi", "maison"],
      [LUNDI, "soir", "elle", "maison"],
      [MARDI, "soir", "moi", "maison"],
      [MARDI, "midi", "elle", "bento"],
      [MERCREDI, "midi", "moi", "bento"],
      [MERCREDI, "midi", "elle", "bento"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);

    expect(needs.totalDinners).toBe(2);
    expect(needs.totalBentos).toBe(3);
  });

  it("ne compte pas un déjeuner pris à la maison comme un bento", () => {
    const availabilities = build([[MARDI, "midi", "moi", "maison"]]);
    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE], availabilities);
    expect(needs.lunches).toHaveLength(1);
    expect(needs.totalBentos).toBe(0);
  });
});

describe("semaine complète avec un enfant", () => {
  it("applique le coefficient enfant aux portions du besoin", () => {
    const availabilities = build([
      [LUNDI, "soir", "moi", "maison"],
      [LUNDI, "soir", "elle", "maison"],
      [LUNDI, "soir", "enfant", "maison"],
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI, ELLE, ENFANT], availabilities);

    // 2 adultes + 1 enfant = 2,6 -> 3 portions
    expect(needs.dinners[0].portions).toBe(3);
  });

  it("ignore les dates hors de la semaine demandée", () => {
    const availabilities = build([
      [DIMANCHE_PRECEDENT, "soir", "moi", "maison"],
      ["2026-03-23", "soir", "moi", "maison"], // lundi suivant
    ]);

    const needs = computeWeekNeeds(LUNDI, [MOI], availabilities);

    // Le dimanche précédent ne compte pas comme besoin de cette semaine,
    // même s'il sert à déterminer si le lundi midi est orphelin.
    expect(needs.totalDinners).toBe(0);
  });
});
