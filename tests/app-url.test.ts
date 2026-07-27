import { afterEach, describe, expect, it } from "vitest";
import { resolvePublicOrigin, safeInternalPath } from "@/lib/app-url";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("résolution de l'origine publique", () => {
  it("privilégie APP_URL quand elle est définie", () => {
    process.env.APP_URL = "https://mealquest.agdevelopment.co";
    expect(
      resolvePublicOrigin(headers({ host: "0.0.0.0:3000" })),
    ).toBe("https://mealquest.agdevelopment.co");
  });

  it("retire la barre oblique finale d'APP_URL", () => {
    process.env.APP_URL = "https://mealquest.agdevelopment.co/";
    expect(resolvePublicOrigin(headers({}))).toBe(
      "https://mealquest.agdevelopment.co",
    );
  });

  it("utilise les en-têtes du proxy plutôt que l'adresse interne", () => {
    delete process.env.APP_URL;
    // Ce que Traefik envoie réellement au conteneur.
    const result = resolvePublicOrigin(
      headers({
        host: "0.0.0.0:3000",
        "x-forwarded-host": "mealquest.agdevelopment.co",
        "x-forwarded-proto": "https",
      }),
    );
    expect(result).toBe("https://mealquest.agdevelopment.co");
  });

  it("ne renvoie jamais l'adresse d'écoute du conteneur quand le proxy renseigne l'hôte", () => {
    delete process.env.APP_URL;
    const result = resolvePublicOrigin(
      headers({ host: "0.0.0.0:3000", "x-forwarded-host": "exemple.fr" }),
    );
    expect(result).not.toContain("0.0.0.0");
  });

  it("garde http en développement local", () => {
    delete process.env.APP_URL;
    expect(resolvePublicOrigin(headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("ne retient que le premier protocole d'une liste transmise", () => {
    delete process.env.APP_URL;
    const result = resolvePublicOrigin(
      headers({ host: "exemple.fr", "x-forwarded-proto": "https, http" }),
    );
    expect(result).toBe("https://exemple.fr");
  });

  it("retombe sur un chemin relatif faute d'information", () => {
    delete process.env.APP_URL;
    expect(resolvePublicOrigin(headers({}))).toBe("");
  });
});

describe("chemin de redirection interne", () => {
  it("accepte un chemin absolu du site", () => {
    expect(safeInternalPath("/parametres")).toBe("/parametres");
  });

  it("refuse une redirection vers un domaine tiers", () => {
    expect(safeInternalPath("//exemple-malveillant.fr")).toBe("/");
    expect(safeInternalPath("https://exemple-malveillant.fr")).toBe("/");
  });

  it("retombe sur l'accueil quand rien n'est fourni", () => {
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath(undefined)).toBe("/");
    expect(safeInternalPath("")).toBe("/");
  });
});
