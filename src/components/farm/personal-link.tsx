"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Copy, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetPersonalLink } from "@/app/actions/customers"

/** The customer's personal "My orders" link: send it, copy it, or reset it if it was shared. */
export function PersonalLink({ customerId, link, waLink }: { customerId: string; link: string; waLink: string | null }) {
  const t = useTranslations("farm.customers")
  const [copied, setCopied] = useState(false)
  const [armed, setArmed] = useState(false)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  return (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">{t("personalLink")}</h2>
      <p className="text-sm text-muted-foreground">{t("personalLinkHint")}</p>
      <div className="flex flex-wrap gap-2">
        {waLink && (
          <Button asChild className="flex-1">
            <a href={waLink} target="_blank" rel="noreferrer">
              <MessageCircle /> {t("sendLink")}
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            } catch {
              // Clipboard blocked: the link is selectable below.
            }
          }}
        >
          <Copy /> {copied ? t("copied") : t("copyLink")}
        </Button>
      </div>
      <p className="truncate text-xs text-muted-foreground select-all">{link}</p>
      <button
        type="button"
        disabled={pending}
        className="self-start text-sm text-destructive underline-offset-4 hover:underline"
        onClick={() => {
          if (!armed) return setArmed(true)
          start(async () => {
            await resetPersonalLink(customerId)
            setArmed(false)
            setDone(true)
          })
        }}
      >
        {done ? t("linkReset") : armed ? t("resetConfirm") : t("resetLink")}
      </button>
    </section>
  )
}
