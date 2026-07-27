import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePublicOrigin, safeInternalPath } from "@/lib/app-url";

// Point d'atterrissage du flux OAuth Google : Supabase renvoie ici avec un
// code à échanger contre une session.
export async function GET(request: NextRequest) {
  // Surtout pas request.nextUrl.origin : derrière le proxy, il vaut
  // l'adresse d'écoute interne du conteneur (voir lib/app-url.ts).
  const origin = resolvePublicOrigin(request.headers);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeInternalPath(request.nextUrl.searchParams.get("suite"));

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] échange du code OAuth :", error.message);
    return NextResponse.redirect(`${origin}/connexion?erreur=oauth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
