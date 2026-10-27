"use client"

import { useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Phone, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KindDrawing } from "@/components/art/kind-drawing"
import { CartIcon } from "@/components/art/cart-icon"

/** Remembered on this phone once dismissed; the help button can bring it back. */
const KEY = "ffy-howto-seen"
const EVENT = "ffy:howto"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(EVENT, onChange)
  }
}
const seenOnThisPhone = () => {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false // private mode: show it; dismissing still works for this visit via the event
  }
}

/** Shows the guide again (help button → "How to order"). */
export function showHowTo() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
  requestAnimationFrame(() => document.getElementById("how-to")?.scrollIntoView({ behavior: "smooth", block: "center" }))
}

/**
 * "How to order" in three pictures, for people new to ordering online: choose, open the basket, the farm
 * calls and brings it (pay on arrival). Shown on a phone's first visit until "Got it"; hidden while the page
 * is rendered on the server, so it never flashes for people who have already seen it.
 */
export function HowTo({ calls, addLabel }: { calls: boolean; addLabel: string }) {
  const t = useTranslations("howTo")
  const seen = useSyncExternalStore(subscribe, seenOnThisPhone, () => true)
  if (seen) return null

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1")
    } catch {}
    window.dispatchEvent(new Event(EVENT))
  }

  const steps = [
    {
      title: t("step1Title"),
      text: t("step1", { add: addLabel }),
      art: (
        <>
          <KindDrawing kind="egg" className="size-10" />
          <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-sun text-sun-foreground">
            <Plus className="size-4" strokeWidth={3} aria-hidden />
          </span>
        </>
      ),
    },
    { title: t("step2Title"), text: t("step2"), art: <KindDrawing kind="basket" className="size-10" /> },
    {
      title: t("step3Title"),
      text: calls ? t("step3Call") : t("step3NoCall"),
      art: (
        <>
          <CartIcon className="size-10" />
          {calls && (
            <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <Phone className="size-3.5" aria-hidden />
            </span>
          )}
        </>
      ),
    },
  ]

  return (
    <section id="how-to" aria-labelledby="how-to-title" className="flex flex-col gap-4 rounded-3xl border-2 border-dashed border-primary/40 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="how-to-title" className="text-xl font-bold">
          {t("title")}
        </h2>
        <Button type="button" variant="outline" onClick={dismiss}>
          {t("gotIt")}
        </Button>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 sm:flex-col">
            <div className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-accent text-primary" aria-hidden>
              {s.art}
              <span className="absolute -top-2 -left-2 grid size-7 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-base font-bold">
                <span className="sr-only">{i + 1}. </span>
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
