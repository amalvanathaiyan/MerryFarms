"use client"

import { useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { BadgeCheck, MessageCircle, Minus, PackageSearch, Phone, Plus, ShoppingBasket, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { SignInFlow } from "@/components/shop/sign-in-flow"
import { formatIndianMobile } from "@/domain/phone"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { placeWebOrder } from "@/app/actions/shop"
import { formatRupees } from "@/domain/money"
import { deliveryFee } from "@/domain/pricing"
import { orderCode } from "@/domain/orders"
import { waMeLink } from "@/domain/whatsapp-lite"
import { cn } from "@/lib/utils"
import { AreaCheck, type AreaResult } from "./area-check"
import { EnablePush } from "@/components/push/enable-push"
import { ProductPicture } from "@/components/product-picture"
import type { ArtKind } from "@/domain/product-art"
import { FarmBanner } from "@/components/farm-banner"

export interface ShopData {
  farm: {
    name: string
    phone: string
    whatsappNumber: string
    orderPrefix: string
    deliveryFeePaise: number
    freeAbovePaise: number
    paused: boolean
    webOrdering: boolean
    tracksStock: boolean
    radiusKm: number | null
    accounts: boolean
    /** Phone notifications are on for this farm. */
    push: boolean
    /** Customers sign in with a one-time code to order. */
    otp: boolean
    /** In-app messages to the farm are on. */
    messages: boolean
  }
  me: { name: string; phone: string; address: { line: string; landmark: string; pincode: string; lat: number | null; lng: number | null } | null } | null
  initialCart: Record<string, number> | null
  categories: { id: string; name: string }[]
  products: {
    id: string
    categoryId: string
    name: string
    pack: string
    note: string | null
    /** Today's price (the offer price while an offer runs). */
    pricePaise: number
    /** The usual price, shown struck through during an offer; null otherwise. */
    listPricePaise: number | null
    offerPct: number
    /** "Sat, 25 Oct" — last day of the offer, if it has one. */
    offerEnds: string | null
    stockQty: number
    /** The farm's photo, or null for a drawn placeholder. */
    imageUrl: string | null
    art: ArtKind
  }[]
  slots: { key: string; label: string; full: boolean; left: number }[]
  nextDelivery: { label: string; orderBy: string } | null
}

type View = "shop" | "cart" | "done"

export function Shop({ data }: { data: ShopData }) {
  const t = useTranslations("shop")
  const ti = useTranslations("signIn")
  const router = useRouter()
  const te = useTranslations("errors")
  const locale = useLocale()
  const [view, setView] = useState<View>(data.initialCart && Object.keys(data.initialCart).length ? "cart" : "shop")
  const [cart, setCart] = useState<Record<string, number>>(data.initialCart ?? {})
  const [form, setForm] = useState({
    name: data.me?.name ?? "",
    phone: data.me ? formatIndianMobile(data.me.phone) : "",
    addressLine: data.me?.address?.line ?? "",
    landmark: data.me?.address?.landmark ?? "",
    pincode: data.me?.address?.pincode ?? "",
    note: "",
    slotKey: data.slots.find((s) => !s.full)?.key ?? "",
    paymentMethod: "upi_on_delivery" as "upi_on_delivery" | "cash_on_delivery",
  })
  // Signing in on the cart page refreshes `data.me`: fill the form from it once.
  const [filledFor, setFilledFor] = useState(data.me?.phone ?? null)
  if (data.me && filledFor !== data.me.phone) {
    setFilledFor(data.me.phone)
    setForm((f) => ({
      ...f,
      name: data.me!.name,
      phone: formatIndianMobile(data.me!.phone),
      addressLine: f.addressLine || data.me!.address?.line || "",
      landmark: f.landmark || data.me!.address?.landmark || "",
      pincode: f.pincode || data.me!.address?.pincode || "",
    }))
  }
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    data.me?.address?.lat != null && data.me.address.lng != null ? { lat: data.me.address.lat, lng: data.me.address.lng } : null
  )
  const [area, setArea] = useState<AreaResult | null>(null)
  const [placed, setPlaced] = useState<{ code: string; totalPaise: number; needsCall: boolean; lines: string; account: "connected" | "known" | "off" } | null>(null)
  const [pending, start] = useTransition()

  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])
  const lines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && byId.has(id))
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const subtotal = lines.reduce((a, l) => a + l.qty * l.product.pricePaise, 0)
  const fee = deliveryFee(subtotal, data.farm)
  const total = subtotal + fee
  const canOrder = !data.farm.paused && data.farm.webOrdering && data.slots.some((s) => !s.full)
  // Without stock tracking, the farm decides availability by hiding products; no stock limit applies.
  const maxQty = (p: { stockQty: number }) => (data.farm.tracksStock ? p.stockQty : 50)

  const change = (id: string, delta: number) => {
    const p = byId.get(id)
    if (!p) return
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(maxQty(p), (c[id] ?? 0) + delta)) }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await placeWebOrder({
        ...form,
        landmark: form.landmark || undefined,
        note: form.note || undefined,
        lat: location?.lat,
        lng: location?.lng,
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
        account: r.account,
        lines: lines.map((l) => `${l.qty} × ${l.product.name} (${l.product.pack})`).join("\n"),
      })
      setCart({})
      setView("done")
    })
  }

  const header = (
    <FarmBanner
      name={data.farm.name}
      initials={data.farm.orderPrefix}
      myOrders={data.farm.accounts ? { href: "/my", label: t("myOrders") } : undefined}
    />
  )

  if (view === "done" && placed) {
    // The order is already with the farm (saved, and on staff phones); nothing to forward.
    const tracked = placed.account === "connected"
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
          {tracked && !data.farm.otp && <p className="rounded-xl bg-accent p-3 text-sm">{t("rememberedHere")}</p>}
          {placed.account === "known" && <p className="rounded-xl bg-accent p-3 text-sm">{t("farmWillSendLink")}</p>}
          {tracked && (
            <Button asChild size="lg" className="h-12 text-base">
              <Link href="/my">
                <PackageSearch /> {t("trackOrder")}
              </Link>
            </Button>
          )}
          {tracked && data.farm.messages && (
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <Link href="/my/messages">
                <MessageCircle /> {t("messageFarm")}
              </Link>
            </Button>
          )}
          {tracked && data.farm.push && <EnablePush who="customer" />}
          <Button variant="outline" size="lg" className="h-12 text-base" onClick={() => setView("shop")}>
            {t("orderMore")}
          </Button>
        </main>
      </div>
    )
  }

  if (view === "cart") {
    const cartLines = (
      <ul className="divide-y rounded-xl border bg-card">
        {lines.map(({ product, qty }) => (
          <li key={product.id} className="flex items-center justify-between gap-3 p-3">
            <ProductPicture src={product.imageUrl} kind={product.art} alt="" className="size-12" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{product.name}</div>
              <div className="text-sm text-muted-foreground">
                {product.pack} · {formatRupees(product.pricePaise * qty)}
              </div>
            </div>
            <Stepper qty={qty} max={maxQty(product)} onChange={(d) => change(product.id, d)} labels={{ add: t("addOne"), remove: t("removeOne") }} />
          </li>
        ))}
      </ul>
    )
    const cartHeader = (
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-semibold">{t("cartTitle")}</h1>
        <Button variant="ghost" size="icon" aria-label={t("orderMore")} onClick={() => setView("shop")}>
          <X />
        </Button>
      </header>
    )
    // Code sign-in: the number is verified before the order form appears; the cart is kept.
    if (data.farm.otp && !data.me) {
      return (
        <div className="mx-auto min-h-dvh max-w-md pb-10">
          {cartHeader}
          <div className="flex flex-col gap-5 px-4 pt-4">
            {cartLines}
            <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <h2 className="text-lg font-semibold">{ti("verifyToOrder")}</h2>
              <SignInFlow onDone={() => router.refresh()} />
            </section>
          </div>
        </div>
      )
    }
    return (
      <div className="mx-auto min-h-dvh max-w-md pb-10">
        {cartHeader}
        <form onSubmit={submit} className="flex flex-col gap-5 px-4 pt-4">
          {cartLines}

          <Field label={t("name")} id="name">
            <Input id="name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12" />
          </Field>
          {data.farm.otp && data.me ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("phone")}</span>
              <p className="flex items-center gap-2 text-lg tabular-nums">
                {formatIndianMobile(data.me.phone)} <BadgeCheck className="size-5 text-primary" aria-label={ti("verified")} />
              </p>
            </div>
          ) : (
            <Field label={t("phone")} id="phone" hint={t("phoneHint")}>
              <Input id="phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12" />
            </Field>
          )}
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
          <AreaCheck
            pincode={form.pincode}
            onPincode={(pincode) => setForm((f) => ({ ...f, pincode }))}
            location={location}
            onLocation={setLocation}
            onResult={setArea}
            radiusKm={data.farm.radiusKm}
          />

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
          <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || !canOrder || count === 0 || !form.slotKey || area === "outside"}>
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

        {!data.farm.webOrdering && !data.farm.paused && (
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-accent p-4">
            <p className="font-medium">{t("orderingOff")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild size="lg">
                <a href={`tel:${data.farm.phone}`}>
                  <Phone /> {t("callFarm")}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={waMeLink(data.farm.whatsappNumber, t("hello"))} target="_blank" rel="noreferrer">
                  {t("whatsappFarm")}
                </a>
              </Button>
            </div>
          </section>
        )}

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
                const soldOut = data.farm.tracksStock && p.stockQty <= 0
                return (
                  <article key={p.id} className={cn("flex gap-3 rounded-2xl border bg-card p-3", soldOut && "opacity-60")}>
                    <div className="relative shrink-0">
                      <ProductPicture src={p.imageUrl} kind={p.art} alt={p.name} className="size-24" />
                      {p.offerPct > 0 && (
                        <span className="absolute -top-1.5 -left-1.5 rounded-full bg-yolk px-2 py-0.5 text-xs font-bold text-yolk-foreground shadow-sm tabular-nums">
                          {t("percentOff", { pct: p.offerPct })}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="font-semibold leading-snug">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {p.pack}
                        {p.note && ` · ${p.note}`}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="flex flex-col">
                          <p className="flex items-baseline gap-1.5 tabular-nums">
                            <span className="text-lg font-bold">{formatRupees(p.pricePaise)}</span>
                            {p.listPricePaise && <s className="text-sm text-muted-foreground">{formatRupees(p.listPricePaise)}</s>}
                          </p>
                          {p.offerEnds && <span className="text-xs text-muted-foreground">{t("offerUntil", { day: p.offerEnds })}</span>}
                        </div>
                        {soldOut ? (
                          <span className="rounded-full border px-3 py-1 text-sm">{t("soldOut")}</span>
                        ) : !data.farm.webOrdering ? null : qty === 0 ? (
                          <Button variant="outline" className="h-10 border-primary px-5 text-primary" disabled={!canOrder} onClick={() => change(p.id, 1)}>
                            {t("add")}
                          </Button>
                        ) : (
                          <Stepper qty={qty} max={maxQty(p)} onChange={(d) => change(p.id, d)} labels={{ add: t("addOne"), remove: t("removeOne") }} />
                        )}
                      </div>
                    </div>
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
