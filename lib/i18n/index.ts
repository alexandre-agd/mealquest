// Point d'entrée neutre : utilisable aussi bien côté serveur que côté client.
// La résolution de la langue du membre connecté vit dans ./server.ts, qui
// dépend de next/headers et ne doit donc jamais être importé par un
// composant client.
export {
  dictionaries,
  locales,
  defaultLocale,
  getDictionary,
  isLocale,
  interpolate,
  lookup,
  type Locale,
  type Dictionary,
} from "./dictionaries";
