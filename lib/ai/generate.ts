import { AI_MAX_REGENERATION_ATTEMPTS } from "@/lib/config/business-rules";
import { buildUserPrompt, type GenerationContext } from "./context";
import { loadGenerationSystemPrompt, GENERATION_PROMPT_VERSION } from "./prompts";
import {
  AiProviderError,
  extractJson,
  getProvider,
  type ChatMessage,
} from "./provider";
import type { RejectionReason, ValidatedCard, ValidationContext } from "./types";
import { validateGeneration } from "./validation";

/**
 * Orchestration d'une génération (RG-60).
 *
 * Boucle : appeler, valider, et si le compte n'y est pas, redemander en
 * expliquant au modèle ce qui a été refusé. Deux régénérations au maximum,
 * puis échec explicite — l'application propose alors la saisie manuelle,
 * elle ne reste jamais bloquée (P3, RG-61).
 *
 * Chaque tentative laisse une trace : contexte envoyé, sortie brute, résultat
 * de validation (docs/05, §9). C'est ce qui rendra le calibrage des prompts
 * possible.
 */

export type GenerationAttempt = {
  index: number;
  raw: string;
  acceptedCount: number;
  rejected: Array<{ reasons: RejectionReason[] }>;
  durationMs: number;
  usage?: { promptTokens?: number; completionTokens?: number };
};

export type GenerationOutcome =
  | {
      status: "ok";
      cards: ValidatedCard[];
      attempts: GenerationAttempt[];
      promptVersion: string;
    }
  | {
      status: "insufficient";
      cards: ValidatedCard[];
      attempts: GenerationAttempt[];
      promptVersion: string;
      /** Nombre de cartes attendues, pour l'expliquer à l'utilisateur. */
      expected: number;
    }
  | {
      status: "error";
      reason: "no_key" | "provider" | "unreadable";
      detail: string;
      attempts: GenerationAttempt[];
      promptVersion: string;
    };

export type GenerateOptions = {
  providerId: string | null;
  model: string | null;
  apiKey: string | null;
  context: GenerationContext;
  validation: ValidationContext;
  expectedCards: number;
  signal?: AbortSignal;
  /** Journalisation, injectée pour rester testable. */
  onAttempt?: (attempt: GenerationAttempt) => void;
};

/** Résume les rejets pour que la relance soit utile plutôt que répétitive. */
function buildRetryMessage(
  rejected: Array<{ reasons: RejectionReason[] }>,
  missing: number,
): string {
  const details = rejected
    .flatMap((entry) => entry.reasons)
    .map((reason) => `- [${reason.rule}] ${reason.detail}`);

  // Un même motif revient souvent sur plusieurs cartes : le répéter n'aide pas.
  const uniques = [...new Set(details)].slice(0, 12);

  return [
    `${missing} carte(s) manquent encore.`,
    "",
    "Les cartes précédentes ont été refusées pour ces raisons :",
    ...uniques,
    "",
    "Reprends en corrigeant ces points. Rappel : les clés d'ingrédients",
    "doivent venir exactement de la liste fournie, et les allergènes du foyer",
    "sont interdits sans exception.",
  ].join("\n");
}

export async function generateCards(
  options: GenerateOptions,
): Promise<GenerationOutcome> {
  const attempts: GenerationAttempt[] = [];
  const promptVersion = GENERATION_PROMPT_VERSION;

  if (!options.apiKey) {
    return {
      status: "error",
      reason: "no_key",
      detail: "aucune clé du fournisseur d'IA n'est configurée pour ce foyer",
      attempts,
      promptVersion,
    };
  }

  const provider = getProvider(options.providerId);
  const model = options.model?.trim() || provider.defaultModel;
  const systemPrompt = await loadGenerationSystemPrompt();
  const userPrompt = buildUserPrompt(options.context);

  const accepted: ValidatedCard[] = [];
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // 1 tentative initiale + N régénérations (RG-60).
  const maxAttempts = AI_MAX_REGENERATION_ATTEMPTS + 1;

  for (let index = 0; index < maxAttempts; index++) {
    const startedAt = Date.now();
    let raw: string;
    let usage: GenerationAttempt["usage"];

    try {
      const result = await provider.complete({
        model,
        apiKey: options.apiKey,
        messages,
        signal: options.signal,
      });
      raw = result.raw;
      usage = result.usage;
    } catch (error) {
      const detail =
        error instanceof AiProviderError
          ? error.message
          : "appel au fournisseur impossible";
      // Une panne réseau n'est pas une sortie invalide : inutile d'insister,
      // et l'utilisateur doit voir un message distinct (docs/05, §8).
      return { status: "error", reason: "provider", detail, attempts, promptVersion };
    }

    const payload = extractJson(raw);
    const outcome =
      payload === null
        ? {
            accepted: [],
            rejected: [
              {
                card: raw,
                reasons: [
                  { rule: "schema" as const, detail: "réponse non exploitable en JSON" },
                ],
              },
            ],
          }
        : validateGeneration(payload, options.validation);

    // Une carte déjà retenue ne doit pas revenir au tour suivant.
    const dejaRetenus = new Set(
      accepted.map((entry) => entry.card.title.fr.toLowerCase()),
    );
    for (const candidate of outcome.accepted) {
      if (!dejaRetenus.has(candidate.card.title.fr.toLowerCase())) {
        accepted.push(candidate);
        dejaRetenus.add(candidate.card.title.fr.toLowerCase());
      }
    }

    const attempt: GenerationAttempt = {
      index,
      raw,
      acceptedCount: outcome.accepted.length,
      rejected: outcome.rejected.map((entry) => ({ reasons: entry.reasons })),
      durationMs: Date.now() - startedAt,
      usage,
    };
    attempts.push(attempt);
    options.onAttempt?.(attempt);

    if (accepted.length >= options.expectedCards) {
      return {
        status: "ok",
        cards: accepted.slice(0, options.expectedCards),
        attempts,
        promptVersion,
      };
    }

    const derniereTentative = index === maxAttempts - 1;
    if (derniereTentative) break;

    messages.push({
      role: "user",
      content: buildRetryMessage(
        outcome.rejected,
        options.expectedCards - accepted.length,
      ),
    });
  }

  // Mieux vaut rendre trois cartes valides que rien du tout : l'utilisateur
  // complétera à la main s'il le souhaite (P3).
  if (accepted.length > 0) {
    return {
      status: "insufficient",
      cards: accepted,
      attempts,
      promptVersion,
      expected: options.expectedCards,
    };
  }

  return {
    status: "error",
    reason: "unreadable",
    detail: `aucune carte valide après ${maxAttempts} tentatives`,
    attempts,
    promptVersion,
  };
}
