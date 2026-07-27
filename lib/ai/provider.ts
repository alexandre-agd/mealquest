/**
 * Abstraction du fournisseur de modèle (C3).
 *
 * La contrainte C3 dit que le fournisseur doit être remplaçable « via
 * configuration, sans refactor ». Concrètement : le reste du moteur ne
 * connaît que l'interface ci-dessous. Changer de fournisseur, c'est ajouter
 * une entrée dans le registre et modifier une valeur en base — rien d'autre.
 *
 * La qualité du japonais est le motif de bascule explicitement anticipé par
 * la MOA (docs/05, §6). Ce n'est donc pas une abstraction spéculative.
 */

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type CompletionRequest = {
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  /** Les cartes sont longues : il faut de la marge. */
  maxTokens?: number;
  /** Bas par défaut : on veut de la régularité, pas de la fantaisie. */
  temperature?: number;
  signal?: AbortSignal;
};

export type CompletionResult = {
  /** Texte brut renvoyé par le modèle, avant toute analyse. */
  raw: string;
  /** Consommation, quand le fournisseur la communique. */
  usage?: { promptTokens?: number; completionTokens?: number };
};

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: { status?: number; body?: string },
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export type AiProvider = {
  /** Identifiant stocké en base, dans households.ai_provider. */
  id: string;
  /** Modèle proposé par défaut à l'utilisateur. */
  defaultModel: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
};

/**
 * Fournisseurs exposant une API compatible avec le format « chat
 * completions ». DeepSeek, OpenAI, Mistral et plusieurs autres le suivent :
 * une seule implémentation les couvre tous, seule l'URL de base change.
 */
function openAiCompatible(
  id: string,
  baseUrl: string,
  defaultModel: string,
): AiProvider {
  return {
    id,
    defaultModel,
    async complete({
      model,
      apiKey,
      messages,
      maxTokens = 8000,
      temperature = 0.7,
      signal,
    }) {
      let response: Response;

      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            // Impose une réponse JSON quand le fournisseur le sait faire :
            // c'est ce qui évite les préambules du type « Voici vos cartes ».
            response_format: { type: "json_object" },
          }),
          signal,
        });
      } catch (error) {
        // Réseau injoignable, requête annulée : l'appelant doit pouvoir
        // distinguer ce cas d'une réponse invalide (P3, mode dégradé).
        throw new AiProviderError(
          error instanceof Error ? error.message : "appel réseau impossible",
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AiProviderError(
          `le fournisseur « ${id} » a répondu ${response.status}`,
          { status: response.status, body: body.slice(0, 500) },
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const raw = payload.choices?.[0]?.message?.content;
      if (!raw) {
        throw new AiProviderError("réponse du fournisseur sans contenu");
      }

      return {
        raw,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
        },
      };
    },
  };
}

export const AI_PROVIDERS: Record<string, AiProvider> = {
  deepseek: openAiCompatible(
    "deepseek",
    "https://api.deepseek.com/v1",
    "deepseek-chat",
  ),
  openai: openAiCompatible("openai", "https://api.openai.com/v1", "gpt-4o-mini"),
  mistral: openAiCompatible(
    "mistral",
    "https://api.mistral.ai/v1",
    "mistral-large-latest",
  ),
};

export const DEFAULT_PROVIDER_ID = "deepseek";

export function getProvider(id: string | null | undefined): AiProvider {
  return AI_PROVIDERS[id ?? DEFAULT_PROVIDER_ID] ?? AI_PROVIDERS[DEFAULT_PROVIDER_ID];
}

export function listProviderIds(): string[] {
  return Object.keys(AI_PROVIDERS);
}

/**
 * Extrait l'objet JSON d'une réponse.
 *
 * Malgré `response_format`, certains modèles encadrent encore leur sortie
 * d'un bloc ```json ou d'une phrase d'introduction. Plutôt que de rejeter la
 * génération pour un défaut de forme, on va chercher le premier objet
 * complet. Le contenu, lui, reste validé strictement ensuite.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // On continue : la réponse est probablement enrobée.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Idem.
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // Rien d'exploitable.
    }
  }

  return null;
}
