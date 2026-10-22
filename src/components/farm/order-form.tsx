"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Minus, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createFarmOrder, searchCustomers, updateFarmOrder } from "@/app/actions/farm-orders"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { deliveryFee } from "@/domain/pricing"
import { cn } from "@/lib/utils"

export interface OrderFormData {
  /** pricePaise: today's price (offer included); listPricePaise: the most staff may charge. */
  products: { id: string; name: string; pack: string; pricePaise: number; listPricePaise: number; stockQty: number }[]
  slots: { key: string; label: string; full: boolean; left: number; afterCutoff: boolean }[]
  creditAccounts: boolean
  tracksStock: boolean
  deliveryFeePaise: number
  freeAbovePaise: number
}

type Address = { id: string; line: string; landmark: string | null }
type Customer = { id?: string; name: string; phone: string; language: "ta" | "en"; addresses: Address[] }
type Payment = "upi_on_delivery" | "cash_on_delivery" | "credit"
type Channel = "phone" | "whatsapp" | "walk_in"

export type OrderFormMode =
  | { kind: "new" }
  | {
      kind: "edit"
      orderId: string
      fromCall: boolean
      customer: Customer
      initial: { items: Record<string, number>; slotKey: string; addressId: string | null; paymentMethod: Payment; note: string; agreedPrices: Record<string, number> }
    }

/** One form for a new farm-side order and for editing an order before it's packed. */
export function OrderForm({ data, mode }: { data: OrderFormData; mode: OrderFormMode }) {
  const t = useTranslations("farm.orderForm")
  const te = useTranslations("errors")
  const ts = useTranslations("shop")
  const router = useRouter()
  const editing = mode.kind === "edit"
  const init = editing ? mode.initial : null

  const [channel, setChannel] = useState<Channel>("phone")
  const [customer, setCustomer] = useState<Customer | null>(editing ? mode.customer : null)
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", language: "ta" as "ta" | "en" })
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Customer[]>([])
  const [items, setItems] = useState<Record<string, number>>(init?.items ?? {})
  const [slotKey, setSlotKey] = useState(init?.slotKey ?? data.slots.find((s) => !s.full && !s.afterCutoff)?.key ?? data.slots[0]?.key ?? "")
  const [addressId, setAddressId] = useState<string | "new">(init?.addressId ?? "new")
  const [newAddress, setNewAddress] = useState({ line: "", landmark: "", pincode: "" })
  const [payment, setPayment] = useState<Payment>(init?.paymentMethod ?? "upi_on_delivery")
  const [handover, setHandover] = useState<"cash" | "upi" | "credit">("cash")
  const [note, setNote] = useState(init?.note ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const walkIn = !editing && channel === "walk_in"

  // Customer search, debounced. Results only show while a search is active.
  const searching = !editing && !customer && query.trim().length >= 2
  useEffect(() => {
    if (!searching) return
    const id = setTimeout(async () => setResults(await searchCustomers(query)), 250)
    return () => clearTimeout(id)
  }, [query, searching])
  const shownResults = searching ? results : []

  const pickCustomer = (c: Customer) => {
    setCustomer(c)
    // Default to their most recent address.
    setAddressId(c.addresses[0]?.id ?? "new")
  }

  // Prices agreed with the customer on this order (a discount), by product, in paise.
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [priceEdit, setPriceEdit] = useState<{ id: string; rupees: string } | null>(null)
  const defaultPrice = (p: OrderFormData["products"][number]) => init?.agreedPrices[p.id] ?? p.pricePaise
  const priceOf = (p: OrderFormData["products"][number]) => prices[p.id] ?? defaultPrice(p)
  const applyPrice = (p: OrderFormData["products"][number]) => {
    if (!priceEdit) return
    const paise = Math.round(Number(priceEdit.rupees) * 100)
    if (!(paise >= 100 && paise <= p.listPricePaise)) return setError(te("price_invalid"))
    setError(null)
    setPrices((c) => {
      const next = { ...c }
      if (paise === defaultPrice(p)) delete next[p.id]
      else next[p.id] = paise
      return next
    })
    setPriceEdit(null)
  }
  const lines = useMemo(() => data.products.filter((p) => (items[p.id] ?? 0) > 0).map((p) => ({ p, qty: items[p.id] })), [data.products, items])
  const subtotal = lines.reduce((a, l) => a + priceOf(l.p) * l.qty, 0)
  const fee = walkIn ? 0 : deliveryFee(subtotal, data)
  const slot = data.slots.find((s) => s.key === slotKey)

  const setQty = (id: string, qty: number) => setItems((c) => ({ ...c, [id]: Math.max(0, qty) }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const itemList = lines.map((l) => ({ productId: l.p.id, qty: l.qty }))
    const agreedPrices = Object.fromEntries(Object.entries(prices).filter(([id]) => (items[id] ?? 0) > 0))
    const address =
      addressId === "new"
        ? { line: newAddress.line || undefined, landmark: newAddress.landmark || undefined, pincode: /^[1-9]\d{5}$/.test(newAddress.pincode) ? newAddress.pincode : undefined }
        : { id: addressId }
    start(async () => {
      if (mode.kind === "edit") {
        const r = await updateFarmOrder({ orderId: mode.orderId, items: itemList, slotKey, address, paymentMethod: payment, note: note || undefined, fromCall: mode.fromCall, prices: agreedPrices })
        if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
        router.push(mode.fromCall ? "/farm/orders?tab=open" : "/farm/orders")
        return
      }
      const who = customer ?? { name: newCustomer.name, phone: newCustomer.phone, language: newCustomer.language, addresses: [] }
      const r = await createFarmOrder({
        channel,
        customer: { name: who.name, phone: who.phone, language: who.language },
        address: walkIn ? null : address,
        items: itemList,
        slotKey: walkIn ? null : slotKey,
        paymentMethod: payment,
        note: note || undefined,
        handover: walkIn ? handover : undefined,
        prices: agreedPrices,
      })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.push(r.invoiceId ? `/farm/invoices/${r.invoiceId}` : "/farm/orders")
    })
  }

  const chip = (selected: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", selected ? "border-primary bg-accent" : "bg-card")

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {!editing && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t("channel")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["phone", "whatsapp", "walk_in"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)} className={chip(channel === c)}>
                {t(`channel_${c}`)}
              </button>
            ))}
          </div>
          {channel === "whatsapp" && <p className="text-sm text-muted-foreground">{t("whatsappHint")}</p>}
        </fieldset>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("customer")}</h2>
        {customer ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{customer.name}</div>
              <div className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(customer.phone)}</div>
            </div>
            {!editing && (
              <Button type="button" variant="ghost" onClick={() => (setCustomer(null), setQuery(""))}>
                {t("change")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchCustomer")} aria-label={t("searchCustomer")} className="h-11 pl-9" />
            </div>
            {shownResults.length > 0 && (
              <ul className="divide-y rounded-xl border">
                {shownResults.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickCustomer(c)} className="flex w-full justify-between gap-3 px-3 py-2 text-left">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">{t("orNew")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input required value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder={ts("name")} aria-label={ts("name")} className="h-11" />
              <Input required type="tel" inputMode="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder={ts("phone")} aria-label={ts("phone")} className="h-11" />
            </div>
            <div className="flex gap-2">
              {(["ta", "en"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={newCustomer.language === l} onClick={() => setNewCustomer({ ...newCustomer, language: l })} className={chip(newCustomer.language === l)}>
                  {l === "ta" ? "தமிழ்" : "English"}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-semibold">{t("items")}</h2>
        <ul className="divide-y">
          {data.products.map((p) => {
            const qty = items[p.id] ?? 0
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {p.pack} · {formatRupees(priceOf(p))}
                    {priceOf(p) < p.listPricePaise && <s className="ml-1">{formatRupees(p.listPricePaise)}</s>}
                    {data.tracksStock && ` · ${ts("left", { count: p.stockQty })}`}
                  </div>
                  {qty > 0 &&
                    (priceEdit?.id === p.id ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-sm">₹</span>
                        <Input
                          autoFocus
                          type="number"
                          min={1}
                          step="0.5"
                          inputMode="decimal"
                          aria-label={t("agreedPrice")}
                          value={priceEdit.rupees}
                          onChange={(e) => setPriceEdit({ id: p.id, rupees: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyPrice(p))}
                          className="h-9 w-24 tabular-nums"
                        />
                        <Button type="button" size="sm" onClick={() => applyPrice(p)}>
                          OK
                        </Button>
                      </div>
                    ) : (
                      <button type="button" className="mt-0.5 text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => setPriceEdit({ id: p.id, rupees: String(priceOf(p) / 100) })}>
                        {prices[p.id] !== undefined ? t("discountGiven", { amount: formatRupees((defaultPrice(p) - priceOf(p)) * qty) }) : t("changePrice")}
                      </button>
                    ))}
                </div>
                <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-primary text-primary">
                  <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={qty === 0} aria-label={ts("removeOne")} onClick={() => setQty(p.id, qty - 1)}>
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-8 text-center font-bold tabular-nums">{qty}</span>
                  <button type="button" className="grid size-10 place-items-center" aria-label={ts("addOne")} onClick={() => setQty(p.id, qty + 1)}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {!walkIn && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{ts("slot")}</legend>
            <div className="flex flex-wrap gap-2">
              {data.slots.map((s) => (
                <button key={s.key} type="button" aria-pressed={slotKey === s.key} onClick={() => setSlotKey(s.key)} className={chip(slotKey === s.key)}>
                  {s.label}
                  {s.full ? ` · ${ts("full")}` : ""}
                </button>
              ))}
            </div>
            {slot && (slot.full || slot.afterCutoff) && <p className="rounded-lg bg-yolk px-3 py-2 text-sm text-yolk-foreground">{slot.full ? t("slotFullWarning") : t("afterCutoffWarning")}</p>}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{ts("address")}</legend>
            {customer?.addresses.map((a) => (
              <label key={a.id} className="flex items-start gap-2">
                <input type="radio" name="address" className="mt-1.5 accent-[hsl(var(--primary))]" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                <span>
                  {a.line}
                  {a.landmark && <span className="text-muted-foreground"> · {a.landmark}</span>}
                </span>
              </label>
            ))}
            {customer && customer.addresses.length > 0 && (
              <label className="flex items-center gap-2">
                <input type="radio" name="address" className="accent-[hsl(var(--primary))]" checked={addressId === "new"} onChange={() => setAddressId("new")} />
                {t("newAddress")}
              </label>
            )}
            {addressId === "new" && (
              <div className="flex flex-col gap-2">
                <textarea rows={2} value={newAddress.line} onChange={(e) => setNewAddress({ ...newAddress, line: e.target.value })} placeholder={ts("address")} aria-label={ts("address")} className="rounded-md border border-input bg-transparent px-3 py-2" />
                <Input value={newAddress.landmark} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} placeholder={ts("landmark")} aria-label={ts("landmark")} className="h-11" />
                <Input inputMode="numeric" maxLength={6} value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder={ts("area.pincode")} aria-label={ts("area.pincode")} className="h-11 w-40 tabular-nums" />
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{ts("payment")}</legend>
            <div className="flex flex-wrap gap-2">
              {(data.creditAccounts ? (["upi_on_delivery", "cash_on_delivery", "credit"] as const) : (["upi_on_delivery", "cash_on_delivery"] as const)).map((m) => (
                <button key={m} type="button" aria-pressed={payment === m} onClick={() => setPayment(m)} className={chip(payment === m)}>
                  {t(`pay_${m}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {walkIn && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{t("paidNow")}</legend>
          <div className="flex flex-wrap gap-2">
            {(data.creditAccounts ? (["cash", "upi", "credit"] as const) : (["cash", "upi"] as const)).map((h) => (
              <button key={h} type="button" aria-pressed={handover === h} onClick={() => setHandover(h)} className={chip(handover === h)}>
                {t(`handover_${h}`)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ts("note")}
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11 font-normal" />
      </label>

      <dl className="flex flex-col gap-1 rounded-2xl border bg-card p-4 tabular-nums">
        <div className="flex justify-between">
          <dt>{ts("subtotal")}</dt>
          <dd>{formatRupees(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{ts("delivery")}</dt>
          <dd>{fee ? formatRupees(fee) : ts("free")}</dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <dt>{ts("toPay")}</dt>
          <dd>{formatRupees(subtotal + fee)}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || lines.length === 0 || (!walkIn && !slotKey)}>
        {editing ? (mode.fromCall ? t("saveAndConfirm") : t("saveChanges")) : walkIn ? t("completeSale") : t("placeOrder")}
      </Button>
    </form>
  )
}
