/**
 * Test de génération isolé (docs/05, §9).
 *
 * Permet de calibrer les prompts sans passer par toute l'interface : on
 * choisit un foyer, on décrit les besoins en ligne de commande, et on voit
 * la sortie brute, les rejets et les cartes retenues.
 *
 *   npm run generation -- --dinners 4 --orphans 1
 *   npm run generation -- --dinners 2 --raw        # affiche la sortie brute
 *   npm run generation -- --dry                    # sans appeler le modèle
 *
 * Lit .env.local. Nécessite SUPABASE_SERVICE_ROLE_KEY : le script se place
 * délibérément côté serveur, comme le fera l'application.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildUserPrompt, computeHandSize, type GenerationContext } from "@/lib/ai/context";
import { generateCards } from "@/lib/ai/generate";
import type { ValidationContext } from "@/lib/ai/types";
import type { AllergenFamily } from "@/lib/household/equipment";

function loadEnv() {
  try {
    const content = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Pas de .env.local : les variables viennent peut-être de l'environnement.
  }
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  loadEnv();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires.\n" +
        "Renseignez-les dans .env.local (voir .env.example).",
    );
    process.exit(1);
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Foyer -------------------------------------------------------------
  const { data: households } = await db
    .from("households")
    .select("id, name, goal, ai_provider, ai_model")
    .order("created_at")
    .limit(1);

  const household = households?.[0];
  if (!household) {
    console.error("Aucun foyer en base. Créez-en un depuis l'application.");
    process.exit(1);
  }

  const [{ data: members }, { data: equipment }, { data: ingredients }] =
    await Promise.all([
      db
        .from("members")
        .select("kind, member_allergens(allergen), member_dislikes(ingredient_id)")
        .eq("household_id", household.id),
      db.from("household_equipment").select("equipment_key").eq("household_id", household.id),
      db
        .from("ingredients")
        .select("id, key, name_en, name_ja, category, default_unit, allergen, perishable")
        .or(`household_id.is.null,household_id.eq.${household.id}`),
    ]);

  const allergens = new Set<AllergenFamily>();
  for (const member of members ?? []) {
    for (const entry of member.member_allergens ?? []) {
      allergens.add(entry.allergen as AllergenFamily);
    }
  }

  const dislikeIds = new Set(
    (members ?? []).flatMap((m) =>
      (m.member_dislikes ?? []).map((d: { ingredient_id: string }) => d.ingredient_id),
    ),
  );

  const equipmentKeys = (equipment ?? []).map((e) => e.equipment_key);
  const allIngredients = ingredients ?? [];

  // --- Besoins, décrits en ligne de commande -----------------------------
  const dinners = Number(arg("dinners", "4"));
  const orphans = Number(arg("orphans", "1"));
  const portions = Number(arg("portions", "2"));
  const versoPortions = Number(arg("verso", "1"));

  // --- Frigo : quelques niveaux 3 pour exercer l'anti-gaspillage ---------
  const perissables = allIngredients.filter((i) => i.perishable).slice(0, 3);

  const context: GenerationContext = {
    adults: (members ?? []).filter((m) => m.kind === "adulte").length || 2,
    children: (members ?? []).filter((m) => m.kind === "enfant").length,
    goal: household.goal,
    equipment: equipmentKeys,
    allergens: [...allergens],
    dislikes: allIngredients.filter((i) => dislikeIds.has(i.id)).map((i) => i.key),
    dinnerNeeds: Array.from({ length: dinners }, () => ({
      portions,
      versoPortions,
    })),
    orphanLunchPortions: Array.from({ length: orphans }, () => 1),
    fridge: perissables.map((i, index) => ({ key: i.key, level: index === 0 ? 3 : 2 })),
    // Le référentiel entier tient largement dans une fenêtre de contexte
    // moderne : inutile de le restreindre, et cela évite d'écarter par
    // erreur un ingrédient dont le modèle aurait besoin.
    ingredients: allIngredients.map((i) => ({
      key: i.key,
      name_en: i.name_en,
      name_ja: i.name_ja,
      category: i.category,
      default_unit: i.default_unit,
    })),
    recentDishes: [],
  };

  const validation: ValidationContext = {
    allowedIngredientKeys: new Set(allIngredients.map((i) => i.key)),
    allergenByIngredientKey: new Map(
      allIngredients.map((i) => [i.key, (i.allergen as AllergenFamily) ?? null]),
    ),
    householdAllergens: allergens,
    availableEquipment: new Set(equipmentKeys),
    allowedUnits: new Set(["g", "ml", "piece", "bunch", "pack"]),
    recentTitles: new Set(),
  };

  const hand = computeHandSize(dinners, orphans);

  console.log(`Foyer            : ${household.name}`);
  console.log(`Objectif         : ${household.goal}`);
  console.log(`Matériel         : ${equipmentKeys.join(", ") || "aucun"}`);
  console.log(`Allergies        : ${[...allergens].join(", ") || "aucune"}`);
  console.log(`Référentiel      : ${allIngredients.length} ingrédients`);
  console.log(`Cartes demandées : ${hand.standard} standard + ${hand.lunchSolo} lunch_solo`);
  console.log("");

  if (flag("dry")) {
    console.log("--- PROMPT UTILISATEUR (aucun appel au modèle) ---\n");
    console.log(buildUserPrompt(context));
    return;
  }

  // --- Clé du foyer, lue côté serveur uniquement -------------------------
  const { data: apiKey } = await db.rpc("get_ai_key_for_user", {
    p_user_id: (
      await db.from("profiles").select("user_id").eq("household_id", household.id).limit(1)
    ).data?.[0]?.user_id,
  });

  if (!apiKey) {
    console.error(
      "Aucune clé enregistrée pour ce foyer.\n" +
        "Saisissez-la depuis Paramètres → Génération de recettes.",
    );
    process.exit(1);
  }

  console.log("Génération en cours…\n");
  const startedAt = Date.now();

  const outcome = await generateCards({
    providerId: household.ai_provider,
    model: household.ai_model,
    apiKey,
    context,
    validation,
    expectedCards: hand.total,
    onAttempt(attempt) {
      console.log(
        `  tentative ${attempt.index + 1} : ${attempt.acceptedCount} acceptée(s), ` +
          `${attempt.rejected.length} rejetée(s) en ${attempt.durationMs} ms`,
      );
      for (const entry of attempt.rejected) {
        for (const reason of entry.reasons) {
          console.log(`      [${reason.rule}] ${reason.detail}`);
        }
      }
      if (flag("raw")) {
        console.log("\n--- SORTIE BRUTE ---");
        console.log(attempt.raw);
        console.log("--- FIN ---\n");
      }
    },
  });

  console.log(`\nTerminé en ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
  console.log(`Statut : ${outcome.status}\n`);

  if (outcome.status === "error") {
    console.error(`Échec (${outcome.reason}) : ${outcome.detail}`);
    process.exit(1);
  }

  for (const entry of outcome.cards) {
    const c = entry.card;
    console.log(`── ${c.title.fr}  /  ${c.title.ja}`);
    console.log(
      `   ${c.type} · ${c.cuisine} · ${c.points} pt · ${c.stars}★ · ${c.prep_minutes} min · ${c.reference_portions} portions`,
    );
    console.log(`   FR : ${c.description.fr}`);
    console.log(`   JA : ${c.description.ja}`);
    console.log(
      `   Ingrédients : ${c.ingredients.map((i) => `${i.key} ${i.quantity}${i.unit}`).join(", ")}`,
    );
    if (c.verso) {
      console.log(
        `   Verso (${c.verso.form}, ${entry.versoPoints} pt) : ${c.verso.title.fr} / ${c.verso.title.ja}`,
      );
    }
    for (const correction of entry.corrections) {
      console.log(`   corrigé [${correction.rule}] ${correction.detail}`);
    }
    for (const warning of entry.warnings) {
      console.log(`   signalé [${warning.rule}] ${warning.detail}`);
    }
    console.log("");
  }

  if (outcome.status === "insufficient") {
    console.log(
      `Attention : ${outcome.cards.length} carte(s) sur ${outcome.expected} demandées.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
