import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { istDate } from "@/domain/ist"
import { exportFarm } from "@/server/export"

/** Owner only: one JSON file with all of this farm's data. */
export async function GET() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const data = await exportFarm(tenant.id)
  const name = `farmforyou-${tenant.slug}-${istDate(new Date())}.json`
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  })
}
