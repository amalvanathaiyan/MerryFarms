import { getLocale, getTranslations } from "next-intl/server"
import QRCode from "qrcode"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { absoluteUrl } from "@/lib/urls"
import { pick } from "@/lib/i18n-helpers"
import { templateOverrides } from "@/server/messages"
import { fillTemplate, priceLines, TEMPLATE_KEYS, TEMPLATES, templateText, type Lang } from "@/domain/templates"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { istDate } from "@/domain/ist"
import { ShareCard } from "@/components/farm/share-card"
import { TemplateEditor } from "@/components/farm/template-editor"
import { currentPrice, offerActive } from "@/domain/offers"

/** Share the shop on WhatsApp, print its QR code, and edit every message the farm sends. */
export default async function WhatsAppPage() {
  const { tenant, db, staff } = await requireStaff()
  requireFeature(tenant, "whatsappLite")
  const locale = await getLocale()
  const t = await getTranslations("farm.whatsapp")
  const features = featuresOf(tenant)

  const [shopUrl, overrides, products] = await Promise.all([
    absoluteUrl("/"),
    templateOverrides(tenant.id),
    db.product.findMany({ where: { isActive: true, onWeb: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ])
  const qrSvg = await QRCode.toString(shopUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1f3d2b", light: "#ffffff" } })

  // Ready-to-send messages in both languages; the page shows the viewer's language first.
  const build = (lang: Lang) => {
    const farm = lang === "ta" ? tenant.nameTa : tenant.nameEn
    const phone = formatIndianMobile(tenant.phone)
    const prices = priceLines(
      products.map((p) => ({
        name: lang === "ta" ? p.nameTa : p.nameEn,
        pack: lang === "ta" ? p.packTa : p.packEn,
        price: offerActive(p, istDate(new Date())) ? `${formatRupees(currentPrice(p, istDate(new Date())))} (${formatRupees(p.pricePaise)})` : formatRupees(p.pricePaise),
        soldOut: features.stockTracking && p.stockQty <= 0,
      })),
      lang
    )
    const date = new Intl.DateTimeFormat(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${istDate(new Date())}T00:00:00Z`))
    return {
      shop: fillTemplate(templateText("share_shop", lang, overrides), { farm, link: shopUrl, phone }),
      prices: fillTemplate(templateText("price_list", lang, overrides), { farm, date, prices, link: shopUrl, phone }),
    }
  }
  const order: Lang[] = locale === "en" ? ["en", "ta"] : ["ta", "en"]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold print:hidden">{t("title")}</h1>

      <ShareCard messages={order.map((lang) => ({ lang, ...build(lang) }))} shopUrl={shopUrl} />

      <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-4 text-center print:border-0">
        <h2 className="self-start font-semibold print:self-center">{t("qrTitle")}</h2>
        <p className="self-start text-sm text-muted-foreground print:hidden">{t("qrHint")}</p>
        <div className="w-56 max-w-full" role="img" aria-label={t("qrTitle")} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="font-semibold">{pick(locale, tenant.nameTa, tenant.nameEn)}</p>
        <p className="text-sm text-muted-foreground">{t("qrScan")}</p>
      </section>

      {staff.roles.includes("owner") && (
        <TemplateEditor
          templates={TEMPLATE_KEYS.map((key) => ({
            key,
            vars: TEMPLATES[key].vars,
            defaults: TEMPLATES[key].defaults,
            ta: overrides[key]?.ta ?? "",
            en: overrides[key]?.en ?? "",
          }))}
        />
      )}
    </div>
  )
}
