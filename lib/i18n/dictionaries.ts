import fr from "./dictionaries/fr.json";
import ja from "./dictionaries/ja.json";

// Le français fait référence : le dictionnaire japonais doit exposer
// exactement les mêmes clés, sinon la compilation échoue. Un test runtime
// (tests/i18n.test.ts) double ce garde-fou.
export type Dictionary = typeof fr;

export const locales = ["fr", "ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

const dictionaries: Record<Locale, Dictionary> = { fr, ja };

export { dictionaries };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * Résout une clé pointée ("auth.error_invalid_credentials") dans le
 * dictionnaire. Les actions serveur renvoient une clé plutôt qu'un message,
 * pour que l'écran l'affiche dans la langue du visiteur (A1.11).
 * Retourne la clé elle-même si elle n'existe pas, ce qui rend l'oubli
 * visible à l'écran plutôt que silencieux.
 */
export function lookup(dict: Dictionary, path: string): string {
  let current: unknown = dict;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return path;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : path;
}

// Remplace les jetons {nom} d'un libellé par leur valeur.
// Exemple : t("Étape {current} sur {total}", { current: 2, total: 5 })
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
