"use server"

import { revalidatePath } from "next/cache"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { issueToken } from "@/server/customers"

/** New key for the customer: their old link and any phone remembering them stop working. */
export async function resetPersonalLink(customerId: string) {
  const { tenant } = await requireStaff(ORDER_DESK)
  await issueToken(tenant.id, customerId)
  revalidatePath(`/farm/customers/${customerId}`)
  return { ok: true as const }
}
