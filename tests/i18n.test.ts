import { describe, expect, it } from "vitest";
import { dictionaries, interpolate, locales, lookup } from "@/lib/i18n";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("dictionnaires fr/ja", () => {
  it("expose exactement les deux locales attendues", () => {
    expect([...locales].sort()).toEqual(["fr", "ja"]);
  });

  it("a le même jeu de clés dans chaque langue (C1)", () => {
    const [first, ...rest] = locales.map((locale) =>
      flattenKeys(dictionaries[locale]).sort(),
    );
    for (const keys of rest) {
      expect(keys).toEqual(first);
    }
  });

  it("n'a aucune valeur vide (A1.11)", () => {
    for (const locale of locales) {
      for (const key of flattenKeys(dictionaries[locale])) {
        expect(lookup(dictionaries[locale], key).trim()).not.toBe("");
      }
    }
  });

  it("traduit le japonais, il ne recopie pas le français", () => {
    // Quelques libellés partagent volontairement la même valeur dans les
    // deux langues : nom du produit, noms de langues affichés tels quels,
    // et symboles typographiques qui n'appartiennent à aucune langue.
    const sharedOnPurpose = new Set([
      "app.name",
      "member.language_fr",
      "member.language_ja",
      "week.status_short.libre", // « — » : case vide dans la grille
      // Symboles d'unités internationaux : « g » et « ml » s'écrivent de la
      // même façon sur une étiquette française et japonaise.
      "custom_ingredient.units.g",
      "custom_ingredient.units.ml",
    ]);

    const identical = flattenKeys(dictionaries.fr).filter(
      (key) =>
        !sharedOnPurpose.has(key) &&
        lookup(dictionaries.fr, key) === lookup(dictionaries.ja, key),
    );

    expect(identical).toEqual([]);
  });
});

describe("interpolate", () => {
  it("remplace les jetons présents", () => {
    expect(interpolate("Étape {current} sur {total}", { current: 2, total: 4 })).toBe(
      "Étape 2 sur 4",
    );
  });

  it("laisse intact un jeton sans valeur", () => {
    expect(interpolate("Bonjour {name}", {})).toBe("Bonjour {name}");
  });
});

describe("lookup", () => {
  it("résout une clé pointée", () => {
    expect(lookup(dictionaries.fr, "auth.signin_title")).toBe("Connexion");
  });

  it("retourne la clé si elle n'existe pas, pour rendre l'oubli visible", () => {
    expect(lookup(dictionaries.fr, "auth.inexistant")).toBe("auth.inexistant");
  });
});
