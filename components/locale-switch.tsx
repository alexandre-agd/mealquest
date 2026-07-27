import { setLocale } from "@/app/locale-actions";
import { locales, getDictionary, type Locale } from "@/lib/i18n";

/**
 * Bascule fr / ja. Deux boutons visibles en permanence plutôt qu'un menu :
 * l'utilisatrice japonaise doit pouvoir sortir d'un écran en français sans
 * avoir à le lire (C1).
 */
export function LocaleSwitch({ current }: { current: Locale }) {
  return (
    // shrink-0 : sans lui, l'étiquette « 日本語 » se replie caractère par
    // caractère sur une colonne quand le titre voisin est long (constaté sur
    // l'écran d'onboarding en 375 px).
    <div className="flex shrink-0 gap-1 rounded-full border border-border bg-surface p-1">
      {locales.map((locale) => {
        const label =
          locale === "fr"
            ? getDictionary("fr").member.language_fr
            : getDictionary("ja").member.language_ja;
        const active = locale === current;

        return (
          <form action={setLocale} key={locale}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              aria-current={active ? "true" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
