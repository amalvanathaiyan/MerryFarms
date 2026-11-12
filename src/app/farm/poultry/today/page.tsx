import { redirect } from "next/navigation"

/** The old "Enter today" screen is now Entry · All batches. */
export default async function EnterTodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams
  redirect(`/farm/poultry/entry?batch=all${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `&date=${date}` : ""}`)
}
