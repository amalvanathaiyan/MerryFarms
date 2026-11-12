import { taglineFor } from "@/domain/brand"

/** What the banner and the opening need of a farm's brand, in the reader's language. */
export type FarmBrand = { colours: string[]; tagline: string | null }

export function farmBrand(farm: { nameColours: string[]; taglineTa: string | null; taglineEn: string | null }, locale: string): FarmBrand {
  return { colours: farm.nameColours, tagline: taglineFor(locale, farm) }
}

type BrandedFarm = { nameTa: string; nameEn: string; nameColours: string[]; taglineTa: string | null; taglineEn: string | null; logoUrl: string | null; invoicePrefix: string; openingMark: string | null }

/** What a farm's opening shows: its name in the reader's language with the other one under it, tagline, logo or mark. */
export function farmOpening(farm: BrandedFarm, locale: string) {
  const name = locale === "ta" ? farm.nameTa : farm.nameEn
  const other = locale === "ta" ? farm.nameEn : farm.nameTa
  return {
    name,
    otherName: other && other !== name ? other : null,
    colours: farm.nameColours,
    tagline: taglineFor(locale, farm),
    logoUrl: farm.logoUrl,
    initials: farm.invoicePrefix,
    openingMark: farm.openingMark,
  }
}
