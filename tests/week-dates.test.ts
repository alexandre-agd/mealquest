import { describe, expect, it } from "vitest";
import {
  addDays,
  currentWeekStart,
  dayOfMonth,
  isoWeekday,
  startOfWeek,
  todayInHouseholdTimezone,
  weekDates,
  weekdayLabel,
} from "@/lib/week/dates";

describe("jour courant à Tokyo (C8)", () => {
  it("rend la date japonaise, pas celle du fuseau de l'appareil", () => {
    // 2026-03-15 22:00 UTC = 2026-03-16 07:00 à Tokyo : c'est déjà demain.
    const instant = new Date("2026-03-15T22:00:00Z");
    expect(todayInHouseholdTimezone(instant)).toBe("2026-03-16");
  });

  it("reste sur la veille juste avant la bascule japonaise", () => {
    // 2026-03-15 14:59 UTC = 2026-03-15 23:59 à Tokyo.
    const instant = new Date("2026-03-15T14:59:00Z");
    expect(todayInHouseholdTimezone(instant)).toBe("2026-03-15");
  });

  it("bascule à 15:00 UTC, soit minuit à Tokyo", () => {
    expect(todayInHouseholdTimezone(new Date("2026-03-15T15:00:00Z"))).toBe(
      "2026-03-16",
    );
  });
});

describe("arithmétique de calendrier", () => {
  it("décale d'un nombre de jours", () => {
    expect(addDays("2026-03-15", 1)).toBe("2026-03-16");
    expect(addDays("2026-03-15", -1)).toBe("2026-03-14");
    expect(addDays("2026-03-15", 7)).toBe("2026-03-22");
  });

  it("franchit les fins de mois et d'année", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("gère le 29 février d'une année bissextile", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("semaine du lundi au dimanche (RG-10, C9)", () => {
  it("numérote les jours de 1 (lundi) à 7 (dimanche)", () => {
    expect(isoWeekday("2026-03-16")).toBe(1); // lundi
    expect(isoWeekday("2026-03-22")).toBe(7); // dimanche
  });

  it("un lundi est déjà son propre début de semaine", () => {
    expect(startOfWeek("2026-03-16")).toBe("2026-03-16");
  });

  it("un dimanche appartient à la semaine qui commence le lundi précédent", () => {
    // Le piège classique : avec une semaine commençant le dimanche, on
    // basculerait ici sur la semaine suivante.
    expect(startOfWeek("2026-03-22")).toBe("2026-03-16");
  });

  it("rattache chaque jour de la semaine au même lundi", () => {
    const lundi = "2026-03-16";
    for (const date of weekDates(lundi)) {
      expect(startOfWeek(date)).toBe(lundi);
    }
  });

  it("produit sept dates consécutives, lundi puis dimanche", () => {
    const dates = weekDates("2026-03-16");
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-03-16");
    expect(dates[6]).toBe("2026-03-22");
    expect(isoWeekday(dates[0])).toBe(1);
    expect(isoWeekday(dates[6])).toBe(7);
  });

  it("déduit la semaine courante de l'heure japonaise", () => {
    // Dimanche 22 mars 2026, 23:30 à Tokyo (14:30 UTC) : encore la semaine
    // du 16. Une heure plus tard on passe au lundi 23.
    expect(currentWeekStart(new Date("2026-03-22T14:30:00Z"))).toBe("2026-03-16");
    expect(currentWeekStart(new Date("2026-03-22T15:30:00Z"))).toBe("2026-03-23");
  });
});

describe("affichage de la grille", () => {
  it("donne le numéro du jour dans le mois", () => {
    expect(dayOfMonth("2026-03-16")).toBe(16);
    expect(dayOfMonth("2026-03-01")).toBe(1);
  });

  it("libelle les jours dans les deux langues", () => {
    // On ne fige pas la casse ni la ponctuation, qui dépendent de la
    // plateforme : on vérifie que chaque langue produit bien un libellé
    // distinct et non vide.
    const fr = weekdayLabel("2026-03-16", "fr");
    const ja = weekdayLabel("2026-03-16", "ja");
    expect(fr.length).toBeGreaterThan(0);
    expect(ja).toContain("月"); // lundi en japonais
    expect(fr).not.toBe(ja);
  });
});
