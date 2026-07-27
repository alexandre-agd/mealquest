import { describe, expect, it } from "vitest";
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_UNITS,
  slugifyIngredientKey,
} from "@/lib/inventory/ingredients";

// La contrainte posée en base sur ingredients.key.
const KEY_PATTERN = /^[a-z0-9_]+$/;

describe("clé d'ingrédient personnalisé", () => {
  it("met en minuscules et remplace les espaces", () => {
    expect(slugifyIngredientKey("Sweet Potato")).toBe("sweet_potato");
  });

  it("retire les accents", () => {
    expect(slugifyIngredientKey("Crème fraîche")).toBe("creme_fraiche");
  });

  it("supprime la ponctuation et les tirets de bord", () => {
    expect(slugifyIngredientKey("  Yuzu-Kosho! ")).toBe("yuzu_kosho");
    expect(slugifyIngredientKey("A & B")).toBe("a_b");
  });

  it("produit toujours une clé acceptée par la contrainte SQL", () => {
    const noms = [
      "Sweet Potato",
      "Crème fraîche",
      "  Yuzu-Kosho! ",
      "Tofu (firm)",
      "100% orange",
      "Œuf",
    ];
    for (const nom of noms) {
      expect(slugifyIngredientKey(nom)).toMatch(KEY_PATTERN);
    }
  });

  it("ne rend jamais une clé vide, même sans caractère latin", () => {
    // Cas réel : l'utilisateur saisit le nom japonais dans le champ anglais.
    const key = slugifyIngredientKey("だいこん");
    expect(key.length).toBeGreaterThan(0);
    expect(key).toMatch(KEY_PATTERN);
  });
});

describe("listes fermées du référentiel (docs/08)", () => {
  it("reprend les onze rayons dans l'ordre du parcours en magasin", () => {
    expect(INGREDIENT_CATEGORIES).toEqual([
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
    ]);
  });

  it("n'accepte que les unités utilisables en magasin (RG-52)", () => {
    expect(INGREDIENT_UNITS).toEqual(["g", "ml", "piece", "bunch", "pack"]);
  });
});
