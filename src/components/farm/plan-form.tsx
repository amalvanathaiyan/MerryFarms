"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Minus, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { savePlan } from "@/app/actions/plans"
import { searchCustomers } from "@/app/actions/farm-orders"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { planUnitPrice } from "@/domain/plans"
import { cn } from "@/lib/utils"

type Address = { id: string; line: string; landmark: string | null }
type Customer = { id: string; name: string; phone: string; addresses: Address[] }
type Payment = "upi_on_delivery" | "cash_on_delivery" | "credit"

export interface PlanFormData {
  products: { id: string; name: string; pack: string; pricePaise: number }[]
  slots: { id: string; label: string; daysOfWeek: number[] }[]
  weekdays: string[] // Sunday first
  creditAccounts: boolean
  today: string
}

export interface PlanFormInitial {
  id: string
  customer: Customer
  addressId: string | null
  slotId: string
  items: Record<string, number>
  daysOfWeek: number[]
  paymentMethod: Payment
  discountPct: number
  startDate: string
  note: string
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]

export function PlanForm({ data, initial }: { data: PlanFormData; initial?: PlanFormInitial }) {
  const t = useTranslations("farm.plans")
  const tf = useTranslations("farm.orderForm")
  const ts = useTranslations("shop")
  const te = useTranslations("errors")
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(initial?.customer ?? null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Customer[]>([])
  const [addressId, setAddressId] = useState<string | null>(initial?.addressId ?? null)
  const [items, setItems] = useState<Record<string, number>>(initial?.items ?? {})
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? [0])
  const [slotId, setSlotId] = useState(initial?.slotId ?? data.slots[0]?.id ?? "")
  const [payment, setPayment] = useState<Payment>(initial?.paymentMethod ?? "cash_on_delivery")
  const [discount, setDiscount] = useState(initial?.discountPct ?? 0)
  const [startDate, setStartDate] = useState(initial?.startDate ?? data.today)
  const [note, setNote] = useState(initial?.note ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const searching = !customer && query.trim().length >= 2
  useEffect(() => {
    if (!searching) return
    const id = setTimeout(async () => setResults((await searchCustomers(query)).map(({ id, name, phone, addresses }) => ({ id, name, phone, addresses }))), 250)
    return () => clearTimeout(id)
  }, [query, searching])

  const slot = data.slots.find((s) => s.id === slotId)
  const offDays = slot ? days.filter((d) => !slot.daysOfWeek.includes(d)) : []
  const perDelivery = data.products.reduce((a, p) => a + (items[p.id] ?? 0) * planUnitPrice(p.pricePaise, discount), 0)
  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return setError(te("customer_not_found"))
    setError(null)
    start(async () => {
      const r = await savePlan({
        id: initial?.id,
        customerId: customer.id,
        addressId: addressId ?? customer.addresses[0]?.id ?? null,
        slotId,
        items: Object.entries(items).map(([productId, qty]) => ({ productId, qty })),
        daysOfWeek: days,
        paymentMethod: payment,
        discountPct: discount,
        startDate,
        note: note || undefined,
      })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.push("/farm/plans")
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{tf("customer")}</h2>
        {customer ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">{customer.name}</div>
              <div className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(customer.phone)}</div>
            </div>
            {!initial && (
              <Button type="button" variant="ghost" onClick={() => (setCustomer(null), setQuery(""))}>
                {tf("change")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tf("searchCustomer")} aria-label={tf("searchCustomer")} className="h-11 pl-9" />
            </div>
            {searching && results.length > 0 && (
              <ul className="divide-y rounded-xl border">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => (setCustomer(c), setAddressId(c.addresses[0]?.id ?? null))} className="flex w-full justify-between gap-3 px-3 py-2 text-left">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">{t("customerHint")}</p>
          </>
        )}
        {customer && customer.addresses.length > 1 && (
          <div className="flex flex-col gap-1.5">
            {customer.addresses.map((a) => (
              <label key={a.id} className="flex items-start gap-2 text-sm">
                <input type="radio" name="address" className="mt-1 accent-[hsl(var(--primary))]" checked={(addressId ?? customer.addresses[0].id) === a.id} onChange={() => setAddressId(a.id)} />
                {a.line}
                {a.landmark && <span className="text-muted-foreground"> · {a.landmark}</span>}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-semibold">{t("eachDelivery")}</h2>
        <ul className="divide-y">
          {data.products.map((p) => {
            const qty = items[p.id] ?? 0
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {p.pack} · {formatRupees(planUnitPrice(p.pricePaise, discount))}
                    {discount > 0 && <span className="ml-1 line-through">{formatRupees(p.pricePaise)}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-primary text-primary">
                  <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={qty === 0} aria-label={ts("removeOne")} onClick={() => setItems({ ...items, [p.id]: qty - 1 })}>
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-8 text-center font-bold tabular-nums">{qty}</span>
                  <button type="button" className="grid size-10 place-items-center" aria-label={ts("addOne")} onClick={() => setItems({ ...items, [p.id]: qty + 1 })}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("days")}</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK.map((d) => (
            <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} className={cn(chip(days.includes(d)), "min-w-12 px-3")}>
              {data.weekdays[d]}
            </button>
          ))}
          <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className={chip(days.length === 7)}>
            {t("everyDay")}
          </button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{ts("slot")}</legend>
        <div className="flex flex-wrap gap-2">
          {data.slots.map((s) => (
            <button key={s.id} type="button" aria-pressed={slotId === s.id} onClick={() => setSlotId(s.id)} className={chip(slotId === s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        {offDays.length > 0 && <p className="rounded-lg bg-yolk px-3 py-2 text-sm text-yolk-foreground">{t("slotOffDays", { days: offDays.map((d) => data.weekdays[d]).join(", ") })}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("startDate")}
          <Input type="date" required min={data.today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("discountLabel")}
          <Input type="number" min={0} max={50} inputMode="numeric" value={discount} onChange={(e) => setDiscount(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} className="h-11 font-normal" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{ts("payment")}</legend>
        <div className="flex flex-wrap gap-2">
          {(data.creditAccounts ? (["upi_on_delivery", "cash_on_delivery", "credit"] as const) : (["upi_on_delivery", "cash_on_delivery"] as const)).map((m) => (
            <button key={m} type="button" aria-pressed={payment === m} onClick={() => setPayment(m)} className={chip(payment === m)}>
              {tf(`pay_${m}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ts("note")}
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11 font-normal" />
      </label>

      <div className="flex items-center justify-between rounded-2xl border-2 border-primary bg-accent p-4 font-bold tabular-nums">
        <span>{t("perDelivery")}</span>
        <span>{formatRupees(perDelivery)}</span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || perDelivery === 0 || days.length === 0 || !slotId}>
        {initial ? t("save") : t("create")}
      </Button>
    </form>
  )
}
