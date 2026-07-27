import { CHILD_WEIGHT } from "@/lib/config/business-rules";
import { addDays, weekDates, type IsoDate } from "./dates";

/**
 * Moteur de besoins : combien de repas préparer, sur quels créneaux, pour
 * combien de personnes (RG-15 à RG-19).
 *
 * Code déterministe, jamais confié à l'IA (docs/05, §2) : ces nombres doivent
 * être exacts et reproductibles, la liste de courses en dépend.
 */

export const MEAL_SLOTS = ["midi", "soir"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const AVAILABILITY_STATUSES = [
  "maison",
  "bento",
  "exterieur",
  "libre",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Statut d'un créneau non saisi (RG-13). */
export const DEFAULT_STATUS: AvailabilityStatus = "libre";

/** Le statut `bento` n'existe qu'au déjeuner (RG-12). */
export function statusesForSlot(slot: MealSlot): AvailabilityStatus[] {
  return slot === "midi"
    ? ["libre", "maison", "bento", "exterieur"]
    : ["libre", "maison", "exterieur"];
}

export function isStatusAllowed(
  slot: MealSlot,
  status: AvailabilityStatus,
): boolean {
  return statusesForSlot(slot).includes(status);
}

/** Statut suivant dans le cycle de la case (un tap = un cran). */
export function nextStatus(
  slot: MealSlot,
  current: AvailabilityStatus,
): AvailabilityStatus {
  const cycle = statusesForSlot(slot);
  const index = cycle.indexOf(current);
  return cycle[(index + 1) % cycle.length];
}

export type MemberKind = "adulte" | "enfant";

export type MemberRef = {
  id: string;
  kind: MemberKind;
};

/** Statut de chaque membre, indexé par `${date}|${slot}|${memberId}`. */
export type AvailabilityMap = Map<string, AvailabilityStatus>;

export function availabilityKey(
  date: IsoDate,
  slot: MealSlot,
  memberId: string,
): string {
  return `${date}|${slot}|${memberId}`;
}

export function statusOf(
  availabilities: AvailabilityMap,
  date: IsoDate,
  slot: MealSlot,
  memberId: string,
): AvailabilityStatus {
  return availabilities.get(availabilityKey(date, slot, memberId)) ?? DEFAULT_STATUS;
}

/**
 * Portions d'un besoin (RG-18) :
 *   portions = nb_adultes + nb_enfants × 0,6
 *   arrondi à l'entier supérieur, minimum 1.
 */
export function computePortions(members: MemberRef[]): number {
  if (members.length === 0) return 0;

  const weighted = members.reduce(
    (total, member) => total + (member.kind === "enfant" ? CHILD_WEIGHT : 1),
    0,
  );

  return Math.max(1, Math.ceil(weighted));
}

export type Need = {
  date: IsoDate;
  slot: MealSlot;
  /** Membres qui mangent un repas préparé à la maison sur ce créneau. */
  members: MemberRef[];
  portions: number;
  /**
   * Uniquement pour un besoin `midi` : le dîner de la veille peut-il le
   * couvrir par son verso (RG-17) ?
   */
  coveredByVerso?: boolean;
};

/**
 * Membres concernés par un créneau donné.
 * - soir : statut `maison` (RG-15)
 * - midi : statut `maison` ou `bento` (RG-16)
 */
function membersNeedingMeal(
  members: MemberRef[],
  availabilities: AvailabilityMap,
  date: IsoDate,
  slot: MealSlot,
): MemberRef[] {
  return members.filter((member) => {
    const status = statusOf(availabilities, date, slot, member.id);
    return slot === "soir"
      ? status === "maison"
      : status === "maison" || status === "bento";
  });
}

function buildNeed(
  members: MemberRef[],
  availabilities: AvailabilityMap,
  date: IsoDate,
  slot: MealSlot,
): Need | null {
  const concerned = membersNeedingMeal(members, availabilities, date, slot);
  if (concerned.length === 0) return null;

  return {
    date,
    slot,
    members: concerned,
    portions: computePortions(concerned),
  };
}

export type WeekNeeds = {
  dinners: Need[];
  lunches: Need[];
  /** Déjeuners sans dîner la veille : ils demandent une carte autonome. */
  orphanLunches: Need[];
  totalDinners: number;
  totalBentos: number;
};

/**
 * Besoins d'une semaine complète.
 *
 * `availabilities` peut contenir des dates hors semaine : la veille du lundi
 * est justement nécessaire pour savoir si le lundi midi est orphelin (RG-17).
 */
export function computeWeekNeeds(
  weekStart: IsoDate,
  members: MemberRef[],
  availabilities: AvailabilityMap,
): WeekNeeds {
  const dates = weekDates(weekStart);

  const dinners: Need[] = [];
  const lunches: Need[] = [];
  const orphanLunches: Need[] = [];

  for (const date of dates) {
    const dinner = buildNeed(members, availabilities, date, "soir");
    if (dinner) dinners.push(dinner);

    const lunch = buildNeed(members, availabilities, date, "midi");
    if (!lunch) continue;

    // RG-17 : un déjeuner est couvert par un verso s'il existe un besoin
    // dîner la veille au soir. Sinon il est orphelin — cas typique du lundi
    // midi, ou d'un lendemain de restaurant.
    const previousDinner = buildNeed(
      members,
      availabilities,
      addDays(date, -1),
      "soir",
    );
    lunch.coveredByVerso = previousDinner !== null;

    lunches.push(lunch);
    if (!lunch.coveredByVerso) orphanLunches.push(lunch);
  }

  // Compteur affiché en permanence à l'écran (parcours B1) : on compte les
  // bentos réellement emportés, pas les déjeuners pris à la maison.
  const totalBentos = dates.reduce((total, date) => {
    const count = members.filter(
      (member) => statusOf(availabilities, date, "midi", member.id) === "bento",
    ).length;
    return total + count;
  }, 0);

  return {
    dinners,
    lunches,
    orphanLunches,
    totalDinners: dinners.length,
    totalBentos,
  };
}

/**
 * Portions du verso, c'est-à-dire du déjeuner dérivé d'un dîner (RG-19).
 *
 * **Ce n'est pas le même nombre que le dîner de la veille**, et c'est le cas
 * normal, pas l'exception : on dîne à deux le lundi soir, mais une seule
 * personne emporte un bento le mardi midi. Retourne 0 si le lendemain midi
 * ne présente aucun besoin — le verso n'est alors pas affecté (RG-44).
 */
export function versoPortions(
  dinnerDate: IsoDate,
  members: MemberRef[],
  availabilities: AvailabilityMap,
): number {
  const lunch = buildNeed(
    members,
    availabilities,
    addDays(dinnerDate, 1),
    "midi",
  );
  return lunch ? lunch.portions : 0;
}
