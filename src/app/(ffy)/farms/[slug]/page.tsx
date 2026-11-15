import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, MapPin, MessageCircle, Phone, Store } from "lucide-react"
import { pick } from "@/lib/i18n-helpers"
import { farmUrl } from "@/lib/farm-url"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { farmProfile } from "@/server/directory"
import { groupSizes } from "@/domain/sizes"
import { Button } from "@/components/ui/button"
import { FarmMark } from "@/app/admin/farm-bits"
import { FarmName } from "@/components/art/brand-mark"
import { ProductPicture } from "@/components/product-picture"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = await farmProfile((await params).slug)
  return f ? { title: `${f.nameEn} · Farm For You`, description: f.taglineEn ?? f.storyEn?.slice(0, 150) ?? undefined } : { title: "Farm For You" }
}

/**
 * A farm's page on Farm For You: who they are in their own words, what they sell, where they deliver, and one tap to
 * its shop, a call or WhatsApp. Only farms listed in the directory have one.
 */
export default async function FarmProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = await farmProfile((await params).slug)
  if (!f) notFound()
  const t = await getTranslations("directory")
  const locale = await getLocale()
  const name = pick(locale, f.nameTa, f.nameEn)
  const tagline = pick(locale, f.taglineTa, f.taglineEn)
  const story = pick(locale, f.storyTa, f.storyEn)
  const wa = f.whatsappNumber.replace(/\D/g, "")

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <Link href="/farms" className="flex items-center gap-1.5 self-start font-semibold text-primary">
        <ArrowLeft className="size-4" aria-hidden /> {t("allFarms")}
      </Link>

      <header className="flex items-center gap-4">
        <FarmMark logoUrl={f.logoUrl} initials={f.invoicePrefix} className="size-20" />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">
            <FarmName name={name} colours={f.nameColours} />
          </h1>
          {tagline && <p className="text-muted-foreground">{tagline}</p>}
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button asChild size="lg" className="h-12">
          <a href={farmUrl(f.slug)}>
            <Store aria-hidden /> {t("shop")}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <a href={`tel:${f.phone}`}>
            <Phone aria-hidden /> {t("call")}
          </a>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>

      {story && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-semibold">{t("about")}</h2>
          <p className="whitespace-pre-line">{story}</p>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-primary" aria-hidden /> {t("deliversTo")}
        </h2>
        {f.area.radiusKm || f.area.pincodes.length ? (
          <>
            {f.area.radiusKm ? <p>{t("withinKm", { km: f.area.radiusKm })}</p> : null}
            {f.area.pincodes.length > 0 && (
              <p className="tabular-nums">
                {t("pins")}: {f.area.pincodes.join(", ")}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{t("askArea", { phone: formatIndianMobile(f.phone) })}</p>
        )}
      </section>

      {f.products.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("sells")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {groupSizes(f.products, (p) => p.family).map(({ key, sizes }) => (
              <li key={key} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <ProductPicture src={sizes.find((s) => s.imageUrl)?.imageUrl ?? null} kind={sizes[0].art} alt="" className="size-16" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{pick(locale, sizes[0].nameTa, sizes[0].nameEn)}</span>
                  {sizes.map((p) => (
                    <span key={p.id} className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{pick(locale, p.packTa, p.packEn)}</span>
                      <b className="tabular-nums">{formatRupees(p.pricePaise)}</b>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="h-12 self-start">
            <a href={farmUrl(f.slug)}>
              <Store aria-hidden /> {t("orderFrom", { farm: name })}
            </a>
          </Button>
        </section>
      )}

      {f.videos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("videos")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.videos.map((v) => (
              <div key={v.id} className="aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.src)}`}
                  title={v.title || t("videos")}
                  loading="lazy"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="size-full border-0"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
