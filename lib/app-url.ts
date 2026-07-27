import "server-only";

/**
 * Origine publique de l'application (« https://mealquest.example.com »).
 *
 * Derrière un reverse proxy — Traefik pour Dokploy — le serveur Next.js
 * écoute sur 0.0.0.0:3000 et ne connaît pas le nom de domaine par lequel on
 * l'atteint. `request.nextUrl.origin` et le header `host` renvoient alors
 * l'adresse interne : toute redirection construite à partir d'eux envoie le
 * navigateur sur `http://0.0.0.0:3000`, injoignable depuis l'extérieur.
 * C'est ce qui cassait le retour de connexion Google.
 *
 * Ordre de résolution :
 *   1. APP_URL, si la variable est définie — le seul moyen sûr, et le seul
 *      qui fonctionne aussi hors requête HTTP.
 *   2. Les en-têtes X-Forwarded-*, renseignés par le proxy.
 *   3. L'en-tête Host, pour le développement local.
 */
export function resolvePublicOrigin(headers: Headers): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ?? headers.get("host");

  if (!host) {
    // Aucune information exploitable : mieux vaut un chemin relatif qu'une
    // redirection vers une adresse fausse.
    return "";
  }

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = forwardedProto ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}`;
}

/** Empêche une redirection ouverte vers un domaine tiers. */
export function safeInternalPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
