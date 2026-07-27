import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Point d'atterrissage du flux OAuth Google : Supabase renvoie ici avec un
// code à échanger contre une session.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("suite") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/connexion?erreur=oauth`);
  }

  return NextResponse.redirect(
    `${origin}${next.startsWith("/") ? next : "/"}`,
  );
}
