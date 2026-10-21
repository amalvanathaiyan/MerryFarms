export const locales = ["ta", "en"] as const
export type Locale = (typeof locales)[number]
/** Tamil first: every customer screen defaults to Tamil. */
export const defaultLocale: Locale = "ta"

export const LOCALE_LABELS: Record<Locale, string> = {
  ta: "தமிழ்",
  en: "English",
}

export const isLocale = (v: string | null | undefined): v is Locale =>
  !!v && (locales as readonly string[]).includes(v)
