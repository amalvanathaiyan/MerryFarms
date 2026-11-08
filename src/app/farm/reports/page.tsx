import { redirect } from "next/navigation"

/** Old address: Reports is now Money (Sales and Profit). */
export default async function ReportsMoved({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()
  redirect(`/farm/money${q ? `?${q}` : ""}`)
}
