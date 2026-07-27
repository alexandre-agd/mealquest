import fr from "./dictionaries/fr.json";
import ja from "./dictionaries/ja.json";

export const dictionaries = { fr, ja } as const;

export type Locale = keyof typeof dictionaries;

export const locales: Locale[] = ["fr", "ja"];

export const defaultLocale: Locale = "fr";

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
