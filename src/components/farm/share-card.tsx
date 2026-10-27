"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, MessageCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { waShareLink } from "@/domain/whatsapp-lite"
import { cn } from "@/lib/utils"

type Msg = { lang: "ta" | "en"; shop: string; prices: string }

/** One-tap sharing of the shop link and today's price list, in Tamil or English. */
export function ShareCard({ messages, shopUrl }: { messages: Msg[]; shopUrl: string }) {
  const t = useTranslations("farm.whatsapp")
  const [lang, setLang] = useState(messages[0].lang)
  const [kind, setKind] = useState<"shop" | "prices">("shop")
  const [copied, setCopied] = useState(false)
  const text = messages.find((m) => m.lang === lang)![kind]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (e.g. not HTTPS on a phone): the text is still selectable below.
    }
  }
  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 print:hidden">
      <h2 className="font-semibold">{t("shareTitle")}</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={kind === "shop"} onClick={() => setKind("shop")} className={chip(kind === "shop")}>
          {t("shareShop")}
        </button>
        <button type="button" aria-pressed={kind === "prices"} onClick={() => setKind("prices")} className={chip(kind === "prices")}>
          {t("sharePrices")}
        </button>
        <span className="mx-1 w-px self-stretch bg-border" />
        {messages.map((m) => (
          <button key={m.lang} type="button" aria-pressed={lang === m.lang} onClick={() => setLang(m.lang)} className={chip(lang === m.lang)}>
            {m.lang === "ta" ? "தமிழ்" : "English"}
          </button>
        ))}
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-sans text-sm select-all">{text}</pre>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild size="lg">
          <a href={waShareLink(text)} target="_blank" rel="noreferrer">
            <MessageCircle /> {t("sendWhatsApp")}
          </a>
        </Button>
        <Button size="lg" variant="outline" onClick={copy}>
          <Copy /> {copied ? t("copied") : t("copy")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("shareHint")}</p>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground select-all">{shopUrl}</span>
        <Button variant="ghost" size="sm" onClick={() => window.print()}>
          <Printer /> {t("printQr")}
        </Button>
      </div>
    </section>
  )
}
