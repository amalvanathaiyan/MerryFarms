"use client"

import { useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Minus, Phone, Plus, ShoppingBasket, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LanguageToggle } from "@/components/language-toggle"
import { placeWebOrder } from "@/app/actions/shop"
import { formatRupees } from "@/domain/money"
import { deliveryFee } from "@/domain/pricing"
import { orderCode } from "@/domain/orders"
import { waMeLink } from "@/domain/whatsapp-lite"
import { cn } from "@/lib/utils"

export interface ShopData {
  farm: {
    name: string
    phone: string
    whatsappNumber: string
    orderPrefix: string
    deliveryFeePaise: number
    freeAbovePaise: number
    paused: boolean
  }
  categories: { id: string; name: string }[]
  products: {
    id: string
    categoryId: string
    name: string
    pack: string
    note: string | null
    pricePaise: number
    stockQty: number
  }[]
  slots: { key: string; label: string; full: boolean; left: number }[]
  nextDelivery: { label: string; orderBy: string } | null
}

type View = "shop" | "cart" | "done"

export function Shop({ data }: { data: ShopData }) {
  const t = useTranslations("shop")
  const te = useTranslations("errors")
  const locale = useLocale()
  const [view, setView] = useState<View>("shop")
  const [cart, setCart] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    name: "",
    phone: "",
    addressLine: "",
    landmark: "",
    note: "",
    slotKey: data.slots.find((s) => !s.full)?.key ?? "",
    paymentMethod: "upi_on_delivery" as "upi_on_delivery" | "cash_on_delivery",
  })
  const [error, setError] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ code: string; totalPaise: number; needsCall: boolean; lines: string } | null>(null)
  const [pending, start] = useTransition()

  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])
  const lines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && byId.has(id))
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const subtotal = lines.reduce((a, l) => a + l.qty * l.product.pricePaise, 0)
  const fee = deliveryFee(subtotal, data.farm)
  const total = subtotal + fee
  const canOrder = !data.farm.paused && data.slots.some((s) => !s.full)

  const change = (id: string, delta: number) => {
    const p = byId.get(id)
    if (!p) return
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(p.stockQty, (c[id] ?? 0) + delta)) }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await placeWebOrder({
        ...form,
        landmark: form.landmark || undefined,
        note: form.note || undefined,
        language: locale === "en" ? "en" : "ta",
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      })
      if (!r.ok) {
        setError(te.has(r.error) ? te(r.error) : te("generic"))
        return
      }
      setPlaced({
        code: orderCode(data.farm.orderPrefix, r.orderNumber),
        totalPaise: r.totalPaise,
        needsCall: r.needsCall,
        lines: lines.map((l) => `${l.qty} × ${l.product.name} (${l.product.pack})`).join("\n"),
      })
      setCart({})
      setView("done")
    })
  }

  const header = (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {data.farm.orderPrefix}
        </span>
        <span className="truncate text-lg font-semibold">{data.farm.name}</span>
      </div>
      <LanguageToggle />
    </header>
  )

  if (view === "done" && placed) {
    const waText = t("waOrderText", { code: placed.code, items: placed.lines, total: formatRupees(placed.totalPaise), name: form.name })
    return (
      <div className="mx-auto min-h-dvh max-w-md">
        {header}
        <main className="flex flex-col gap-4 px-4 py-8">
          <h1 className="text-2xl font-bold">{t("placedTitle", { code: placed.code })}</h1>
          <p className="text-lg">{placed.needsCall ? t("placedCall", { farm: data.farm.name }) : t("placedConfirmed")}</p>
          <pre className="whitespace-pre-wrap rounded-xl border bg-card p-4 font-sans text-base">
            {placed.lines}
            {"\n"}
            {t("toPay")}: {formatRupees(placed.totalPaise)}
          </pre>
          <Button asChild size="lg" className="h-12 text-base">
            <a href={waMeLink(data.farm.whatsappNumber, waText)} target="_blank" rel="noreferrer">
              {t("placedWhatsApp")}
            </a>
          </Button>
          <Button variant="outline" size="lg" className="h-12 text-base" onClick={() => setView("shop")}>
            {t("orderMore")}
          </Button>
        </main>
      </div>
    )
  }

  if (view === "cart") {
    return (
      <div className="mx-auto min-h-dvh max-w-md pb-10">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
          <h1 className="text-xl font-semibold">{t("cartTitle")}</h1>
          <Button variant="ghost" size="icon" aria-label={t("orderMore")} onClick={() => setView("shop")}>
            <X />
          </Button>
        </header>
        <form onSubmit={submit} className="flex flex-col gap-5 px-4 pt-4">
          <ul className="divide-y rounded-xl border bg-card">
            {lines.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {product.pack} · {formatRupees(product.pricePaise * qty)}
                  </div>
                </div>
                <Stepper qty={qty} max={product.stockQty} onChange={(d) => change(product.id, d)} labels={{ add: t("addOne"), remove: t("removeOne") }} />
              </li>
            ))}
          </ul>

          <Field label={t("name")} id="name">
            <Input id="name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12" />
          </Field>
          <Field label={t("phone")} id="phone" hint={t("phoneHint")}>
            <Input id="phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12" />
          </Field>
          <Field label={t("address")} id="address">
            <textarea
              id="address"
              required
              rows={2}
              autoComplete="street-address"
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2"
            />
          </Field>
          <Field label={t("landmark")} id="landmark">
            <Input id="landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className="h-12" />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("slot")}</legend>
            <div className="flex flex-wrap gap-2">
              {data.slots.map((s) => (
                <Choice key={s.key} selected={form.slotKey === s.key} disabled={s.full} onClick={() => setForm({ ...form, slotKey: s.key })}>
                  {s.label}
                  {s.full ? ` · ${t("full")}` : s.left <= 3 ? ` · ${t("left", { count: s.left })}` : ""}
                </Choice>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{t("payment")}</legend>
            <div className="flex flex-wrap gap-2">
              {(["upi_on_delivery", "cash_on_delivery"] as const).map((m) => (
                <Choice key={m} selected={form.paymentMethod === m} onClick={() => setForm({ ...form, paymentMethod: m })}>
                  {t(`pay_${m}`)}
                </Choice>
              ))}
            </div>
          </fieldset>

          <Field label={t("note")} id="note">
            <Input id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-12" />
          </Field>

          <dl className="flex flex-col gap-1 rounded-xl border bg-card p-4 tabular-nums">
            <Row label={t("subtotal")} value={formatRupees(subtotal)} />
            <Row label={t("delivery")} value={fee ? formatRupees(fee) : t("free")} />
            <Row label={t("toPay")} value={formatRupees(total)} strong />
          </dl>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || !canOrder || count === 0 || !form.slotKey}>
            {pending ? t("placing") : t("placeOrder", { total: formatRupees(total) })}
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-28">
      {header}
      <main className="flex flex-col gap-5 px-4 pt-4">
        <h1 className="text-2xl font-bold">{t("hello")}</h1>

        {data.farm.paused ? (
          <p className="rounded-xl bg-destructive/10 p-4 font-medium text-destructive">{te("shop_paused")}</p>
        ) : data.nextDelivery ? (
          <section className="rounded-2xl bg-yolk p-4 text-yolk-foreground">
            <div className="text-sm font-medium">{t("nextDelivery")}</div>
            <div className="text-lg font-bold">{data.nextDelivery.label}</div>
            <div className="text-sm">
              {t("orderBy", { time: data.nextDelivery.orderBy })}
              {data.farm.deliveryFeePaise > 0 && data.farm.freeAbovePaise > 0 && ` · ${t("freeAbove", { amount: formatRupees(data.farm.freeAbovePaise) })}`}
            </div>
          </section>
        ) : (
          <p className="rounded-xl bg-yolk p-4 text-yolk-foreground">{t("noSlots")}</p>
        )}

        {data.categories.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("noProducts")}</p>}

        {data.categories.map((c) => (
          <section key={c.id} className="flex flex-col gap-3" aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="text-lg font-semibold">
              {c.name}
            </h2>
            {data.products
              .filter((p) => p.categoryId === c.id)
              .map((p) => {
                const qty = cart[p.id] ?? 0
                const soldOut = p.stockQty <= 0
                return (
                  <article key={p.id} className={cn("flex items-center justify-between gap-3 rounded-2xl border bg-card p-4", soldOut && "opacity-60")}>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {p.pack}
                        {p.note && ` · ${p.note}`}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums">{formatRupees(p.pricePaise)}</p>
                    </div>
                    {soldOut ? (
                      <span className="shrink-0 rounded-full border px-3 py-1 text-sm">{t("soldOut")}</span>
                    ) : qty === 0 ? (
                      <Button variant="outline" size="lg" className="shrink-0 border-primary text-primary" disabled={!canOrder} onClick={() => change(p.id, 1)}>
                        {t("add")}
                      </Button>
                    ) : (
                      <Stepper qty={qty} max={p.stockQty} onChange={(d) => change(p.id, d)} labels={{ add: t("addOne"), remove: t("removeOne") }} />
                    )}
                  </article>
                )
              })}
          </section>
        ))}

        <a href={`tel:${data.farm.phone}`} className="flex items-center justify-center gap-2 py-4 text-primary underline-offset-4 hover:underline">
          <Phone className="size-4" /> {t("callFarm")}
        </a>
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <button
            type="button"
            onClick={() => setView("cart")}
            className="flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 text-lg font-semibold text-primary-foreground shadow-lg"
          >
            <span className="flex items-center gap-2 tabular-nums">
              <ShoppingBasket className="size-5" />
              {t("cartBar", { count, total: formatRupees(total) })}
            </span>
            <span>{t("viewCart")} →</span>
          </button>
        </div>
      )}
    </div>
  )
}

function Stepper({ qty, max, onChange, labels }: { qty: number; max: number; onChange: (delta: number) => void; labels: { add: string; remove: string } }) {
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-primary text-primary">
      <button type="button" className="grid size-11 place-items-center" aria-label={labels.remove} onClick={() => onChange(-1)}>
        <Minus className="size-5" />
      </button>
      <span className="min-w-8 text-center text-lg font-bold tabular-nums">{qty}</span>
      <button type="button" className="grid size-11 place-items-center disabled:opacity-40" aria-label={labels.add} disabled={qty >= max} onClick={() => onChange(1)}>
        <Plus className="size-5" />
      </button>
    </div>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Choice({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:line-through disabled:opacity-50",
        selected ? "border-primary bg-accent" : "bg-card"
      )}
    >
      {children}
    </button>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "border-t pt-2 text-lg font-bold")}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
