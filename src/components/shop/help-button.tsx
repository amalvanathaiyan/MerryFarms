"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CircleHelp, MessageCircle, Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { waMeLink } from "@/domain/whatsapp-lite"
import { cn } from "@/lib/utils"
import { showHowTo } from "./how-to"

/**
 * "Help" on every customer screen, for anyone stuck: call the farm, order on WhatsApp instead (with what's in
 * the basket already written out), or see how ordering works. A labelled button, never just an icon.
 * `raised` lifts it above the shop's basket bar.
 */
export function HelpButton({ phone, whatsappNumber, basket, raised }: { phone: string; whatsappNumber: string; basket?: string[]; raised?: boolean }) {
  const t = useTranslations("help")
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const text = basket?.length ? t("waWithCart", { items: basket.join("\n") }) : t("waEmpty")
  const howTo = () => {
    setOpen(false)
    if (path === "/") showHowTo()
    else {
      showHowTo()
      router.push("/?browse")
    }
  }

  const big = "flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left"
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "fixed right-3 z-30 inline-flex h-12 items-center gap-2 rounded-full border bg-card px-4 font-semibold text-foreground shadow-lg print:hidden",
          "transition-[bottom,background-color,border-color,box-shadow,transform] duration-200 hover:border-primary hover:bg-accent hover:text-primary active:scale-95",
          raised ? "bottom-[calc(env(safe-area-inset-bottom,0px)+132px)] sm:bottom-[calc(env(safe-area-inset-bottom,0px)+88px)]" : "bottom-[calc(env(safe-area-inset-bottom,0px)+16px)]"
        )}
      >
        <CircleHelp className="size-5 text-primary" aria-hidden />
        {t("button")}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={() => setOpen(false)}>
            <div className="flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="help-title" className="text-xl font-bold">
                  {t("title")}
                </h2>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  <X /> {t("close")}
                </Button>
              </div>
              <a href={`tel:${phone}`} className={big}>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Phone className="size-6" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-bold">{t("call")}</span>
                  <span className="text-sm text-muted-foreground">{t("callHint")}</span>
                </span>
              </a>
              <a href={waMeLink(whatsappNumber, text)} target="_blank" rel="noreferrer" className={big}>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
                  <MessageCircle className="size-6" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-lg font-bold">{t("whatsapp")}</span>
                  <span className="text-sm text-muted-foreground">{basket?.length ? t("whatsappWithCart") : t("whatsappHint")}</span>
                </span>
              </a>
              <button type="button" onClick={howTo} className={big}>
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-primary">
                  <CircleHelp className="size-6" aria-hidden />
                </span>
                <span className="text-lg font-bold">{t("howTo")}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
