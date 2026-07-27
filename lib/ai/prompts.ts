import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Chargement des prompts.
 *
 * docs/05 §9 impose que les prompts vivent dans des fichiers séparés et
 * versionnés, pas noyés dans le code : leur calibrage va demander plusieurs
 * itérations, et il doit être possible de comparer deux versions et de
 * revenir en arrière.
 *
 * Le numéro de version fait partie du nom de fichier et est journalisé avec
 * chaque génération : on saura toujours quel prompt a produit quelle carte.
 */

export const GENERATION_PROMPT_VERSION = "v1";

const cache = new Map<string, string>();

export async function loadPrompt(name: string): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "prompts", `${name}.md`);
  const content = await readFile(filePath, "utf8");
  cache.set(name, content);
  return content;
}

export function loadGenerationSystemPrompt(): Promise<string> {
  return loadPrompt(`generation-system.${GENERATION_PROMPT_VERSION}`);
}
