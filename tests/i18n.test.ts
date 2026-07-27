import { describe, expect, it } from "vitest";
import { dictionaries, locales } from "@/lib/i18n";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("dictionnaires fr/ja", () => {
  it("exposent exactement les deux locales attendues", () => {
    expect(locales.sort()).toEqual(["fr", "ja"]);
  });

  it("ont le même jeu de clés dans chaque langue (C1)", () => {
    const [first, ...rest] = locales.map((locale) =>
      flattenKeys(dictionaries[locale]).sort(),
    );
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });
});
