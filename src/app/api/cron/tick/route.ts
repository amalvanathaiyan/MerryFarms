import { NextResponse } from "next/server"
import { tick } from "@/server/automation"

/**
 * The automation engine's heartbeat (src/server/automation.ts), called every ~10 minutes by the GitHub Actions
 * schedule in .github/workflows/tick.yml (Vercel's free plan only runs daily jobs). Same Authorization:
 * Bearer <CRON_SECRET> as the other scheduled jobs. Running it twice is harmless: every alert goes out once.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await tick())
}

export const GET = POST
