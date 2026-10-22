import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { pick } from "@/lib/i18n-helpers"
import { markSeen, thread } from "@/server/chat"
import { customerSend } from "@/app/actions/chat"
import { ChatThread } from "@/components/chat/chat-thread"
import { LanguageToggle } from "@/components/language-toggle"
import { chatTime } from "@/lib/chat-time"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

/** The customer's conversation with the farm. */
export default async function MyMessagesPage() {
  const tenant = await requireTenant()
  if (!featuresOf(tenant).messages) notFound()
  const me = await getSessionCustomer()
  if (!me) redirect("/my")
  const locale = await getLocale()
  const t = await getTranslations("chat")

  // Opening the conversation marks the farm's replies as seen (the farm sees ✓✓).
  await markSeen(tenant.id, me.id, "customer")
  const messages = await thread(tenant.id, me.id)

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-header px-4 py-3 text-header-foreground">
        <Link href="/my" className="flex min-w-0 items-center gap-2" aria-label={t("back")}>
          <ArrowLeft className="size-5 shrink-0" />
          <span className="line-clamp-2 font-semibold leading-snug">{pick(locale, tenant.nameTa, tenant.nameEn)}</span>
        </Link>
        <LanguageToggle compact />
      </header>
      <main className="flex flex-col gap-3 px-4 pt-4">
        <p className="rounded-xl bg-accent p-3 text-sm">{t("customerHint")}</p>
        <ChatThread
          messages={messages.map((m) => ({ id: m.id, mine: m.sender === "customer", body: m.body, time: chatTime(m.createdAt, locale), seen: !!m.seenAt }))}
          send={async (body: string) => {
            "use server"
            return customerSend({ body })
          }}
          placeholder={t("placeholder")}
        />
      </main>
    </div>
  )
}
