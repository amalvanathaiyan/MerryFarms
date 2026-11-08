import { redirect } from "next/navigation"

/** Old address: Farm records now lives in Poultry care (batches) and Money (spending, made). */
export default async function RecordsMoved({ searchParams }: { searchParams: Promise<{ on?: string }> }) {
  const { on } = await searchParams
  redirect(on ? `/farm/poultry?on=${encodeURIComponent(on)}` : "/farm/money/spending")
}
