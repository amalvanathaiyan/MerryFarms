import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { MapPin, PhoneCall, Search } from "lucide-react"
import { pick } from "@/lib/i18n-helpers"
import { farmUrl } from "@/lib/farm-url"
import { formatRupees } from "@/domain/money"
import { searchDirectory } from "@/server/directory"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FarmMark } from "@/app/admin/farm-bits"
import { FarmName } from "@/components/art/brand-mark"
import { ProductPicture } from "@/components/product-picture"
import { NearMeButton } from "@/components/platform/near-me-button"

export const metadata: Metadata = { title: "Farms near you · Farm For You" }

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : null)

/**
 * Farm For You's farm directory: farms by where the customer is (PIN code or their spot) and what they want. Farms
 * that deliver there come first, nearest first; then farms to ask. Each opens its page or its shop.
 */
export default async function FarmsPage({ searchParams }: { searchParams: Promise<{ pin?: string; q?: string; lat?: string; lng?: string }> }) {
  const sp = await searchParams
  const t = await getTranslations("directory")
  const locale = await getLocale()
  const lat = num(sp.lat)
  const lng = num(sp.lng)
  const location = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
  const pin = (sp.pin ?? "").replace(/\D/g, "").slice(0, 6)
  const q = (sp.q ?? "").trim().slice(0, 60)
  const { searched, results } = await searchDirectory({ pincode: pin || null, location, q: q || null })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <form action="/farms" className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("pin")}
            <Input name="pin" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={pin} placeholder="600001" className="h-12 text-lg font-normal tabular-nums" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("what")}
            <Input name="q" defaultValue={q} placeholder={t("whatExample")} className="h-12 font-normal" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" className="h-12">
            <Search aria-hidden /> {t("find")}
          </Button>
          <NearMeButton q={q} />
        </div>
      </form>

      {location && <p className="text-sm text-muted-foreground">{t("byLocation")}</p>}

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-muted-foreground">{searched || q ? t("none") : t("noneYet")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((f) => {
            const name = pick(locale, f.nameTa, f.nameEn)
            const tagline = pick(locale, f.taglineTa, f.taglineEn)
            return (
              <li key={f.slug} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
                <Link href={`/farms/${f.slug}`} className="flex items-center gap-3">
                  <FarmMark logoUrl={f.logoUrl} initials={f.invoicePrefix} />
                  <span className="min-w-0">
                    <FarmName name={name} colours={f.nameColours} className="block text-lg font-bold" />
                    {tagline && <span className="block text-sm text-muted-foreground">{tagline}</span>}
                  </span>
                </Link>
                {searched && (
                  <p className={f.reach.reach === "delivers" ? "flex items-center gap-2 font-semibold text-primary" : "flex items-center gap-2 font-semibold text-yolk-foreground"}>
                    {f.reach.reach === "delivers" ? <MapPin className="size-4 shrink-0" aria-hidden /> : <PhoneCall className="size-4 shrink-0" aria-hidden />}
                    {f.reach.reach === "delivers" ? t("delivers") : t("ask")}
                    {f.reach.distanceKm != null && <span className="font-normal text-muted-foreground">· {t(f.reach.approx ? "aboutKm" : "km", { km: f.reach.distanceKm })}</span>}
                  </p>
                )}
                {f.products.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {f.products.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 text-sm">
                        <ProductPicture src={p.imageUrl} kind={p.art} alt="" className="size-10" />
                        <span className="min-w-0 flex-1">
                          {pick(locale, p.nameTa, p.nameEn)} <span className="text-muted-foreground">({pick(locale, p.packTa, p.packEn)})</span>
                        </span>
                        <b className="tabular-nums">{formatRupees(p.pricePaise)}</b>
                      </li>
                    ))}
                    {f.more > 0 && <li className="text-sm text-muted-foreground">{t("more", { count: f.more })}</li>}
                  </ul>
                )}
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button asChild size="lg" className="h-12">
                    <a href={farmUrl(f.slug)}>{t("shop")}</a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12">
                    <Link href={`/farms/${f.slug}`}>{t("seeFarm")}</Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
