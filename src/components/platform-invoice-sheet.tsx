import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import type { InvoiceLine } from "@/domain/platform-billing"

type Party = { name?: string; nameTa?: string; nameEn?: string; address?: string; phone?: string; email?: string; gstin?: string | null; sac?: string | null; upiId?: string; bank?: string }

export interface PlatformInvoiceData {
  number: string
  issuedOn: string
  dueOn: string
  periodStart: string | null
  periodEnd: string | null
  lines: InvoiceLine[]
  subtotalPaise: number
  gstRatePct: number
  gstKind: string
  gstPaise: number
  totalPaise: number
  paidPaise: number
  status: string
  seller: unknown
  buyer: unknown
  notes: string | null
}

const day = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))

/**
 * Farm For You's invoice to a farm, as printed. Labels in Tamil and English, like the farms' own invoices, because a
 * farm owner and an accountant both read it. "Tax invoice" only while GST is on; otherwise a plain invoice.
 */
export function PlatformInvoiceSheet({ inv }: { inv: PlatformInvoiceData }) {
  const s = (inv.seller ?? {}) as Party
  const b = (inv.buyer ?? {}) as Party
  const tax = inv.gstKind !== "none"
  const left = Math.max(0, inv.totalPaise - inv.paidPaise)
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border bg-card p-5 text-card-foreground print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-xl leading-tight font-bold">{s.name}</h1>
          {s.address && <p className="text-sm whitespace-pre-line">{s.address}</p>}
          {s.phone && <p className="text-sm tabular-nums">{formatIndianMobile(s.phone)}</p>}
          {s.email && <p className="text-sm">{s.email}</p>}
          {s.gstin && <p className="text-sm tabular-nums">GSTIN: {s.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{tax ? "வரி விலைப்பட்டியல் · Tax invoice" : "விலைப்பட்டியல் · Invoice"}</p>
          <p className="tabular-nums">{inv.number}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{day(inv.issuedOn)}</p>
          {inv.status === "void" && <p className="font-bold text-destructive">ரத்து · Cancelled</p>}
        </div>
      </header>

      <section>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">பண்ணை · Farm</p>
        <p className="font-semibold">
          {b.nameTa}
          {b.nameEn && b.nameEn !== b.nameTa && <span className="font-normal"> · {b.nameEn}</span>}
        </p>
        {b.phone && <p className="text-sm tabular-nums">{formatIndianMobile(b.phone)}</p>}
        {b.gstin && <p className="text-sm tabular-nums">GSTIN: {b.gstin}</p>}
        {inv.periodStart && inv.periodEnd && (
          <p className="mt-1 text-sm tabular-nums">
            காலம் · Period: {day(inv.periodStart)} – {day(inv.periodEnd)}
          </p>
        )}
      </section>

      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-2 font-semibold">விவரம் · Description{tax && s.sac ? ` (SAC ${s.sac})` : ""}</th>
            <th className="py-2 text-right font-semibold">தொகை · Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i} className="border-b border-dashed align-top">
              <td className="py-2 pr-2">{l.text}</td>
              <td className="py-2 text-right">{formatRupees(l.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm tabular-nums">
        {tax && <Line label="மதிப்பு · Taxable value" value={formatRupees(inv.subtotalPaise)} />}
        {inv.gstKind === "cgst_sgst" && (
          <>
            <Line label={`CGST ${inv.gstRatePct / 2}%`} value={formatRupees(inv.gstPaise / 2)} />
            <Line label={`SGST ${inv.gstRatePct / 2}%`} value={formatRupees(inv.gstPaise / 2)} />
          </>
        )}
        {inv.gstKind === "igst" && <Line label={`IGST ${inv.gstRatePct}%`} value={formatRupees(inv.gstPaise)} />}
        <Line label="மொத்தம் · Total" value={formatRupees(inv.totalPaise)} strong />
        {inv.paidPaise > 0 && <Line label="செலுத்தியது · Paid" value={formatRupees(inv.paidPaise)} />}
        {inv.status !== "void" && <Line label="செலுத்த வேண்டியது · To pay" value={formatRupees(left)} strong={left > 0} />}
        {left > 0 && inv.status !== "void" && <p className="text-right text-xs text-muted-foreground">கடைசி நாள் · Pay by {day(inv.dueOn)}</p>}
      </dl>

      {left > 0 && inv.status !== "void" && (s.upiId || s.bank) && (
        <section className="flex flex-col gap-1 rounded-xl bg-muted p-3 text-sm">
          <p className="font-semibold">எப்படிச் செலுத்துவது · How to pay</p>
          {s.upiId && (
            <p>
              UPI: <span className="font-mono font-semibold">{s.upiId}</span>
            </p>
          )}
          {s.bank && <p className="whitespace-pre-line">{s.bank}</p>}
          <p className="text-muted-foreground">
            குறிப்பில் {inv.number} எழுதுங்கள் · Write {inv.number} in the note
          </p>
        </section>
      )}
      {inv.notes && <p className="text-sm whitespace-pre-line">{inv.notes}</p>}
    </article>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between gap-3 border-t pt-1 text-base font-bold" : "flex justify-between gap-3"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
