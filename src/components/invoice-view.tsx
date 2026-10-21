import type { InvoiceSnapshot } from "@/domain/invoices"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"

/**
 * The invoice as printed. Labels are always bilingual (Tamil / English) because an
 * invoice is a document the customer, the farm and an accountant all read.
 */
export function InvoiceView({ s }: { s: InvoiceSnapshot }) {
  const issued = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(s.issuedAt))
  const isTax = s.type === "tax_invoice"

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border bg-card p-5 text-card-foreground print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{s.farm.nameTa}</h1>
          <p className="font-semibold">{s.farm.nameEn}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(s.farm.phone)}</p>
          {s.farm.gstin && <p className="text-sm tabular-nums">GSTIN: {s.farm.gstin}</p>}
          {s.farm.fssaiNo && <p className="text-sm tabular-nums">FSSAI: {s.farm.fssaiNo}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{isTax ? "வரி விலைப்பட்டியல் · Tax invoice" : "பில் · Bill of supply"}</p>
          <p className="tabular-nums">{s.number}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {issued} · {s.orderCode}
          </p>
        </div>
      </header>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">வாடிக்கையாளர் · Customer</p>
        <p className="font-semibold">{s.customer.name}</p>
        <p className="text-sm tabular-nums">{formatIndianMobile(s.customer.phone)}</p>
        {s.customer.address && <p className="text-sm">{s.customer.address}</p>}
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-semibold">பொருள் · Item</th>
              <th className="py-2 pr-2 font-semibold">HSN</th>
              <th className="py-2 pr-2 text-right font-semibold">அளவு · Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">விலை · Rate</th>
              {isTax && <th className="py-2 pr-2 text-right font-semibold">GST</th>}
              <th className="py-2 text-right font-semibold">தொகை · Amount</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l, i) => (
              <tr key={i} className="border-b border-dashed align-top">
                <td className="py-2 pr-2">
                  {l.nameTa} · {l.packTa}
                  <span className="block text-xs text-muted-foreground">
                    {l.nameEn} · {l.packEn}
                  </span>
                </td>
                <td className="py-2 pr-2">{l.hsn ?? "—"}</td>
                <td className="py-2 pr-2 text-right">{l.qty}</td>
                <td className="py-2 pr-2 text-right">{formatRupees(l.unitPricePaise)}</td>
                {isTax && <td className="py-2 pr-2 text-right">{l.gstRate}%</td>}
                <td className="py-2 text-right">{formatRupees(l.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm tabular-nums">
        <Line label="பொருட்கள் · Items" value={formatRupees(s.subtotalPaise)} />
        <Line label="டெலிவரி · Delivery" value={s.deliveryFeePaise ? formatRupees(s.deliveryFeePaise) : "—"} />
        <Line label="மொத்தம் · Total" value={formatRupees(s.totalPaise)} strong />
        {isTax &&
          s.taxByRate.map((r) => (
            <div key={r.rate} className="text-xs text-muted-foreground">
              <Line label={`${r.rate}% · Taxable`} value={formatRupees(r.taxablePaise)} />
              <Line label={`CGST ${r.rate / 2}%`} value={formatRupees(r.cgstPaise)} />
              <Line label={`SGST ${r.rate / 2}%`} value={formatRupees(r.sgstPaise)} />
            </div>
          ))}
      </dl>

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        {isTax ? "விலைகள் GST உட்பட · Prices include GST." : "GST விலக்கு பெற்ற பொருட்கள் / பதிவு இல்லை · GST-exempt supply or unregistered supplier."}
        {s.farm.upiId && <span className="block tabular-nums">UPI: {s.farm.upiId}</span>}
      </footer>
    </article>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t pt-1 text-base font-bold" : "flex justify-between"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
