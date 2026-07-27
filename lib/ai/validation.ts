import { z } from "zod";
import {
  VERSO_EXPRESS_MAX_MINUTES,
} from "@/lib/config/business-rules";
import {
  CARD_TYPES,
  CUISINES,
  POINTS_RANGE,
  STARS_RANGE,
  VERSO_FORMS,
  type Correction,
  type GeneratedCard,
  type RejectionReason,
  type ValidatedCard,
  type ValidationContext,
  type ValidationOutcome,
  type Warning,
} from "./types";

/**
 * Validation des cartes produites par le modèle (docs/05, §4).
 *
 * Principe : une sortie non conforme n'est jamais affichée. Selon la
 * contrainte violée, la carte est soit rejetée, soit corrigée
 * automatiquement. La distinction vient du tableau de `docs/05` :
 *
 *   S1, S2, S3, S4, S7, S8, S9  -> rejet
 *   S5, S6                      -> correction automatique
 *   S10                         -> signalement, non bloquant
 *
 * Rien ici n'appelle le modèle : c'est du code déterministe, testable seul,
 * et c'est voulu. La justesse de la liste de courses en dépend.
 */

const bilingualText = z.object({
  fr: z.string().trim().min(1),
  ja: z.string().trim().min(1),
});

const bilingualSteps = z.object({
  fr: z.array(z.string().trim().min(1)).min(1),
  ja: z.array(z.string().trim().min(1)).min(1),
});

const ingredient = z.object({
  key: z.string().trim().min(1),
  quantity: z.number().positive().finite(),
  unit: z.string().trim().min(1),
});

const verso = z.object({
  form: z.enum(VERSO_FORMS as unknown as [string, ...string[]]),
  title: bilingualText,
  steps: bilingualSteps,
  extra_ingredients: z.array(ingredient).default([]),
  extra_minutes: z.number().int().min(0).max(240),
});

const card = z.object({
  type: z.enum(CARD_TYPES as unknown as [string, ...string[]]),
  cuisine: z.enum(CUISINES as unknown as [string, ...string[]]),
  points: z.number().int(),
  stars: z.number().int(),
  prep_minutes: z.number().int().min(1).max(600),
  reference_portions: z.number().int().min(1).max(12),
  title: bilingualText,
  description: bilingualText,
  steps: bilingualSteps,
  ingredients: z.array(ingredient).min(1),
  equipment: z.array(z.string().trim().min(1)).default([]),
  verso: verso.optional(),
});

export const generationResponseSchema = z.object({
  cards: z.array(z.unknown()).min(1),
});

/** Points du verso : moitié du recto, arrondi à l'inférieur, minimum 1 (RG-23). */
export function versoPointsFrom(rectoPoints: number): number {
  return Math.max(1, Math.floor(rectoPoints / 2));
}

/**
 * Étoiles attendues d'après le temps annoncé (RG-24).
 * Sert à corriger une incohérence, pas à rejeter.
 */
function expectedStars(prepMinutes: number): number {
  if (prepMinutes <= 20) return 1;
  if (prepMinutes <= 40) return 2;
  return 3;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateOne(
  raw: unknown,
  context: ValidationContext,
): { ok: true; value: ValidatedCard } | { ok: false; reasons: RejectionReason[] } {
  const parsed = card.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      reasons: parsed.error.issues.slice(0, 6).map((issue) => ({
        rule: "schema" as const,
        detail: `${issue.path.join(".") || "(racine)"} : ${issue.message}`,
      })),
    };
  }

  const value = parsed.data as GeneratedCard;
  const reasons: RejectionReason[] = [];
  const corrections: Correction[] = [];
  const warnings: Warning[] = [];

  const allIngredients = [
    ...value.ingredients,
    ...(value.verso?.extra_ingredients ?? []),
  ];

  // S1 — l'IA choisit dans le référentiel transmis, elle n'invente jamais.
  // C'est la condition pour que la liste de courses soit juste (P2).
  for (const item of allIngredients) {
    if (!context.allowedIngredientKeys.has(item.key)) {
      reasons.push({
        rule: "S1",
        detail: `ingrédient hors référentiel : « ${item.key} »`,
      });
    }
  }

  // S2 — allergies bloquantes, aucune exception, aucun contournement (RG-05).
  for (const item of allIngredients) {
    const allergen = context.allergenByIngredientKey.get(item.key) ?? null;
    if (allergen && context.householdAllergens.has(allergen)) {
      reasons.push({
        rule: "S2",
        detail: `« ${item.key} » contient l'allergène « ${allergen} »`,
      });
    }
  }

  // S3 — jamais de matériel absent du foyer (RG-07).
  for (const key of value.equipment) {
    if (!context.availableEquipment.has(key)) {
      reasons.push({ rule: "S3", detail: `matériel absent du foyer : « ${key} »` });
    }
  }

  // S4 — les deux langues décrivent la même recette. On ne peut pas vérifier
  // le sens ici, mais on peut exiger la même structure : un nombre d'étapes
  // différent trahit une version tronquée.
  if (value.steps.fr.length !== value.steps.ja.length) {
    reasons.push({
      rule: "S4",
      detail: `${value.steps.fr.length} étapes en français contre ${value.steps.ja.length} en japonais`,
    });
  }
  if (value.verso && value.verso.steps.fr.length !== value.verso.steps.ja.length) {
    reasons.push({
      rule: "S4",
      detail: "le verso n'a pas le même nombre d'étapes dans les deux langues",
    });
  }

  // S7 — toute carte standard porte un verso complet (RG-20, RG-21).
  if (value.type === "standard" && !value.verso) {
    reasons.push({ rule: "S7", detail: "carte standard sans verso" });
  }
  if (value.type !== "standard" && value.verso) {
    reasons.push({
      rule: "S7",
      detail: `une carte « ${value.type} » ne doit pas avoir de verso`,
    });
  }
  if (
    value.verso?.form === "express" &&
    value.verso.extra_minutes > VERSO_EXPRESS_MAX_MINUTES
  ) {
    reasons.push({
      rule: "S7",
      detail: `verso « express » annoncé à ${value.verso.extra_minutes} min, maximum ${VERSO_EXPRESS_MAX_MINUTES}`,
    });
  }

  // S8 — quantités chiffrées, unités issues du référentiel (RG-52).
  for (const item of allIngredients) {
    if (!context.allowedUnits.has(item.unit)) {
      reasons.push({
        rule: "S8",
        detail: `unité inconnue « ${item.unit} » pour « ${item.key} »`,
      });
    }
  }

  // S9 — aucune reprise d'un plat récemment cuisiné (RG-39).
  const titleFr = normalize(value.title.fr);
  const titleJa = value.title.ja.trim();
  if (context.recentTitles.has(titleFr) || context.recentTitles.has(titleJa)) {
    reasons.push({
      rule: "S9",
      detail: `« ${value.title.fr} » figure parmi les dernières cartes cuisinées`,
    });
  }

  if (reasons.length > 0) return { ok: false, reasons };

  // S5 — score hors bornes : on ramène dans l'intervalle plutôt que de
  // jeter une carte par ailleurs correcte.
  const corrected: GeneratedCard = { ...value };
  if (value.points < POINTS_RANGE.min || value.points > POINTS_RANGE.max) {
    corrected.points = Math.min(
      POINTS_RANGE.max,
      Math.max(POINTS_RANGE.min, value.points),
    );
    corrections.push({
      rule: "S5",
      detail: `points ramenés de ${value.points} à ${corrected.points}`,
    });
  }

  // S6 — étoiles incohérentes avec le temps annoncé : on aligne sur le temps,
  // qui est l'information la plus concrète pour l'utilisateur.
  const attendu = expectedStars(value.prep_minutes);
  if (
    value.stars < STARS_RANGE.min ||
    value.stars > STARS_RANGE.max ||
    value.stars !== attendu
  ) {
    corrected.stars = attendu;
    corrections.push({
      rule: "S6",
      detail: `étoiles ramenées de ${value.stars} à ${attendu} pour ${value.prep_minutes} min`,
    });
  }

  // S10 — temps manifestement incohérent avec le nombre d'étapes. Signalé,
  // jamais bloquant : une recette peut légitimement avoir de longues attentes.
  if (value.steps.fr.length >= 6 && value.prep_minutes <= 10) {
    warnings.push({
      rule: "S10",
      detail: `${value.steps.fr.length} étapes annoncées en ${value.prep_minutes} min`,
    });
  }

  return {
    ok: true,
    value: {
      card: corrected,
      versoPoints: corrected.verso ? versoPointsFrom(corrected.points) : null,
      corrections,
      warnings,
    },
  };
}

/**
 * Valide une réponse complète du modèle.
 * Les cartes fautives sont écartées une à une : une mauvaise carte ne doit
 * pas faire perdre les bonnes.
 */
export function validateGeneration(
  payload: unknown,
  context: ValidationContext,
): ValidationOutcome {
  const envelope = generationResponseSchema.safeParse(payload);
  if (!envelope.success) {
    return {
      accepted: [],
      rejected: [
        {
          card: payload,
          reasons: [
            {
              rule: "schema",
              detail: "réponse illisible : un objet { cards: [...] } est attendu",
            },
          ],
        },
      ],
    };
  }

  const accepted: ValidationOutcome["accepted"] = [];
  const rejected: ValidationOutcome["rejected"] = [];

  for (const raw of envelope.data.cards) {
    const result = validateOne(raw, context);
    if (result.ok) accepted.push(result.value);
    else rejected.push({ card: raw, reasons: result.reasons });
  }

  return { accepted, rejected };
}
