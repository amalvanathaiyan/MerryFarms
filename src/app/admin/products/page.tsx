import { getTranslations } from "next-intl/server"
import { listKinds, starterChanges } from "@/server/product-kinds"
import { MODULE_KEYS, isModuleKey } from "@/domain/modules"
import { isPicture } from "@/components/art/drawing-library"
import { MEASURES, type Measure } from "@/domain/product-kinds"
import { KindCard, StarterKindsButton, type KindView } from "./kind-form"

/**
 * Admin → Products: Farm For You's product kinds, by module. Each says how it's measured, its usual pack sizes, the
 * details asked for each product and defaults; farms build their categories from them (and can add their own).
 */
export default async function AdminProductsPage() {
  const t = await getTranslations("kinds")
  const tm = await getTranslations("modules")
  const kinds = await listKinds(true)
  const view = (k: (typeof kinds)[number]): KindView => ({
    id: k.id,
    module: isModuleKey(k.module) ? k.module : "selling",
    nameTa: k.nameTa,
    nameEn: k.nameEn,
    art: isPicture(k.art) ? k.art : "basket",
    measure: (MEASURES as readonly string[]).includes(k.measure) ? (k.measure as Measure) : "count",
    packs: k.packs,
    details: k.details,
    weighedOnDelivery: k.weighedOnDelivery,
    shelfLifeDays: k.shelfLifeDays,
    hsn: k.hsn,
    gstRate: [0, 5, 12, 18].includes(k.gstRate) ? (k.gstRate as KindView["gstRate"]) : 0,
    retired: k.retired,
  })
  const blank: KindView = { id: null, module: "crops", nameTa: "", nameEn: "", art: "basket", measure: "weight", packs: [], details: [], weighedOnDelivery: false, shelfLifeDays: null, hsn: null, gstRate: 0, retired: false }
  const changes = await starterChanges()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>
      {changes.count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
          <p>{kinds.length === 0 ? t("noneYet") : t("starterChanges", { count: changes.count })}</p>
          <StarterKindsButton label={kinds.length === 0 ? t("addStarters") : t("updateStarters")} />
        </div>
      )}
      <ul>
        <KindCard kind={blank} />
      </ul>
      {MODULE_KEYS.map((m) => {
        const list = kinds.filter((k) => k.module === m)
        if (!list.length) return null
        return (
          <section key={m} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{tm(m)}</h2>
            <ul className="flex flex-col gap-2">
              {list.map((k) => (
                <KindCard key={k.id} kind={view(k)} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
