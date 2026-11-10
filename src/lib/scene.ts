import "server-only"
import { getTranslations } from "next-intl/server"
import { featuresOf } from "@/lib/features"
import { pick } from "@/lib/i18n-helpers"
import { phaseAt, sceneFor, type SceneSpot } from "@/domain/scenes"
import type { SceneProps } from "@/components/art/farm-scene"
import type { Tenant } from "@/lib/tenant"

/** What FarmScene needs for this farm, spot and moment, worked out on the server so the first paint is right. */
export async function sceneProps(tenant: Tenant, locale: string, spot: SceneSpot, at = new Date()): Promise<SceneProps> {
  const t = await getTranslations("scene")
  const farmScenes = featuresOf(tenant).poultryScenes
  return {
    kind: sceneFor({ farmScenes, spot, at }),
    phase: phaseAt(at),
    farmScenes,
    spot,
    words: { name: pick(locale, tenant.nameTa, tenant.nameEn), shop: t("shop"), eggs: t("eggs"), chicken: t("chicken"), fresh: t("fresh") },
  }
}
