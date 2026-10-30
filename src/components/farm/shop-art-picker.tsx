"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtStrip } from "@/components/art/art-strip"
import { DRAWINGS, DRAWING_GROUPS, MAX_SHOP_ART } from "@/components/art/drawing-library"
import { setShopArt } from "@/app/actions/look"
import { cn } from "@/lib/utils"

/**
 * Pick the drawings that decorate the shop: the village set fits every farm, then one group per kind of product.
 * Tap to add or remove (up to MAX_SHOP_ART); the strip at the top shows what customers will see.
 * The groups for what the farm sells come first.
 */
export function ShopArtPicker({ picked: initial, isDefault, kinds, suggested }: { picked: string[]; isDefault: boolean; kinds: string[]; suggested: string[] }) {
  const t = useTranslations("farm.look")
  const te = useTranslations("errors")
  const locale = useLocale()
  const router = useRouter()
  const [picked, setPicked] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const full = picked.length >= MAX_SHOP_ART

  const groups = [...DRAWING_GROUPS].sort((a, b) => rank(a.key) - rank(b.key))
  function rank(key: string) {
    return key === "village" ? 0 : kinds.includes(key) ? 1 : 2
  }

  const toggle = (id: string) => {
    setMsg(null)
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_SHOP_ART ? p : [...p, id]))
  }
  const save = (ids: string[]) =>
    start(async () => {
      const r = await setShopArt(ids)
      if (!r.ok) return setMsg({ ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      setMsg({ ok: true, text: t("saved") })
      router.refresh()
    })

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-bold">{t("artTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("artHint", { max: MAX_SHOP_ART })}</p>
      </div>

      <div className="rounded-2xl bg-background p-4">
        <ArtStrip drawings={picked.map((id) => DRAWINGS.get(id)!).filter(Boolean)} caption={t("artPreviewCaption")} />
        {picked.length === 0 && <p className="text-center text-sm text-muted-foreground">{t("artNonePicked")}</p>}
      </div>
      <p className="text-sm font-medium" aria-live="polite">
        {t("artCount", { count: picked.length, max: MAX_SHOP_ART })}
        {isDefault && ` · ${t("artSuggested")}`}
      </p>

      {groups.map((g) => (
        <fieldset key={g.key} className="flex flex-col gap-2">
          <legend className="font-semibold">
            {locale === "ta" ? g.ta : g.en}
            {kinds.includes(g.key) && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium">{t("youSellThis")}</span>}
          </legend>
          <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6">
            {g.items.map((d) => {
              const on = picked.includes(d.id)
              const [, , w, h] = d.vb.split(" ").map(Number)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(d.id)}
                  className={cn(
                    "relative flex min-h-24 flex-col items-center justify-end gap-1.5 rounded-2xl border p-2 text-center text-xs leading-tight disabled:cursor-not-allowed disabled:opacity-40",
                    on ? "border-2 border-primary bg-accent" : "bg-card"
                  )}
                >
                  <svg viewBox={d.vb} width={Math.round(Math.min(48, (w / h) * 36))} height={Math.round(Math.min(36, (h / w) * 48))} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>
                    <path d={d.d} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span className="max-w-full wrap-anywhere">{locale === "ta" ? d.ta : d.en}</span>
                  {on && (
                    <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl px-3 py-2 font-medium", msg.ok ? "bg-accent" : "bg-destructive/10 text-destructive")}>
          {msg.text}
        </p>
      )}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] flex flex-wrap gap-2 rounded-2xl border bg-card/95 p-2 shadow-md backdrop-blur lg:bottom-4">
        <Button type="button" size="lg" className="h-12" disabled={pending} onClick={() => save(picked)}>
          {t("saveArt")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12"
          disabled={pending}
          onClick={() => {
            setPicked(suggested)
            save([])
          }}
        >
          {t("useSuggested")}
        </Button>
      </div>
    </section>
  )
}
