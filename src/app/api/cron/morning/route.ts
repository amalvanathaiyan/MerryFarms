import { NextResponse } from "next/server"
import { morningReminders } from "@/server/reminders"

/**
 * Scheduled job, each morning (vercel.json: 01:30 UTC = 7:00 IST): tells poultry keepers of vaccines due
 * today or late, and of warnings from yesterday's entries. Same Authorization: Bearer <CRON_SECRET> as the
 * evening job. Sending it twice only repeats the notification (it replaces the earlier one on the phone).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ farms: await morningReminders() })
}

export const GET = POST
