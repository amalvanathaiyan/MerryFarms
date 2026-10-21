import { NextResponse } from "next/server"
import { generateAllPlanOrders } from "@/server/plans"

/**
 * Scheduled job: creates plan orders for today and tomorrow on every farm with plans on.
 * Call it each evening from any free scheduler (GitHub Actions, cron-job.org, Supabase pg_cron)
 * with the header  Authorization: Bearer <CRON_SECRET>.
 * Safe to call repeatedly; the Today screen also runs it when staff open the app.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ farms: await generateAllPlanOrders() })
}
