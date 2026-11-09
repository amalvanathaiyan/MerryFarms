import { NextResponse } from "next/server"
import { generateAllPlanOrders } from "@/server/plans"
import { pruneCodes } from "@/server/otp"
import { eveningReminders } from "@/server/reminders"

/**
 * Scheduled job: creates plan orders for today and tomorrow on every farm with plans on.
 * Call it each evening from any free scheduler (GitHub Actions, cron-job.org, Supabase pg_cron)
 * with the header  Authorization: Bearer <CRON_SECRET>.
 * On Vercel, vercel.json calls GET daily at 18:00 IST and sends that header itself when CRON_SECRET is set.
 * Safe to call repeatedly; the Today screen also runs it when staff open the app.
 * Also clears sign-in codes older than two days, and reminds poultry keepers of batches not entered today.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const farms = await generateAllPlanOrders()
  await pruneCodes()
  const notEntered = await eveningReminders()
  return NextResponse.json({ farms, notEntered })
}

export const GET = POST
