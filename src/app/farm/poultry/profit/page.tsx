import { redirect } from "next/navigation"

/** Old address: Poultry care's Profit tab is now Costs (farm profit is under Money → Profit). */
export default async function PoultryProfitMoved({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString()
  redirect(`/farm/poultry/costs${q ? `?${q}` : ""}`)
}
