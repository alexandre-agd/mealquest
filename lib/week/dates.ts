import { HOUSEHOLD_TIMEZONE } from "@/lib/config/business-rules";

/**
 * Dates du semainier.
 *
 * Toutes les dates manipulées ici sont des chaînes « AAAA-MM-JJ », sans
 * heure. C'est volontaire : une date de calendrier n'a pas d'heure, et la
 * stocker comme instant obligerait à convertir de fuseau à chaque lecture,
 * avec le risque classique du repas qui glisse d'un jour.
 *
 * Le seul endroit où le fuseau intervient réellement est « quel jour
 * sommes-nous ? » (C8 : Asia/Tokyo). Le reste est de l'arithmétique de
 * calendrier, indépendante du fuseau. Le Japon n'applique pas d'heure d'été,
 * ce qui écarte le dernier piège habituel.
 */

export type IsoDate = string; // AAAA-MM-JJ

/** Le jour courant à Tokyo, quel que soit le fuseau de l'appareil. */
export function todayInHouseholdTimezone(now: Date = new Date()): IsoDate {
  // « en-CA » produit directement le format AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOUSEHOLD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtcDate(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Décale une date d'un nombre de jours, positif ou négatif. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = toUtcDate(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return fromUtcDate(shifted);
}

/** Jour de la semaine, 1 = lundi … 7 = dimanche (convention ISO). */
export function isoWeekday(date: IsoDate): number {
  const day = toUtcDate(date).getUTCDay(); // 0 = dimanche
  return day === 0 ? 7 : day;
}

/** Le lundi de la semaine contenant cette date (RG-10, C9). */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -(isoWeekday(date) - 1));
}

/** Les sept dates d'une semaine, du lundi au dimanche. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Le lundi de la semaine en cours à Tokyo. */
export function currentWeekStart(now: Date = new Date()): IsoDate {
  return startOfWeek(todayInHouseholdTimezone(now));
}

/**
 * Libellé court d'un jour, dans la langue du membre.
 * Passe par Intl plutôt que par une table de traduction : les noms de jours
 * ne sont pas du contenu éditorial, et Intl les connaît déjà correctement
 * dans les deux langues.
 */
export function weekdayLabel(date: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

/** Numéro du jour dans le mois, pour l'affichage de la grille. */
export function dayOfMonth(date: IsoDate): number {
  return toUtcDate(date).getUTCDate();
}
