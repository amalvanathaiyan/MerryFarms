import { NextResponse } from "next/server"
import { requireStaff, OWNER_ONLY } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { cleanRange, csvRupees, toCsv } from "@/domain/reports"
import { documentsIn, duesList, loadReport, paymentsIn } from "@/server/reports"

/** "90000 10004": no leading +, so spreadsheets don't take it for a formula. */
const csvPhone = (e164: string) => {
  const d = e164.replace(/\D/g, "").slice(-10)
  return `${d.slice(0, 5)} ${d.slice(5)}`
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).format(d)

/**
 * Excel downloads for the farm's accountant (CSV, UTF-8 with BOM so Tamil opens correctly).
 *   ?type=sales|payments|dues|products&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const { tenant } = await requireStaff(OWNER_ONLY)
  if (!featuresOf(tenant).reports) return NextResponse.json({ error: "reports_off" }, { status: 404 })
  const url = new URL(request.url)
  const type = url.searchParams.get("type")
  const range = cleanRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined, new Date())
  if (!range && type !== "dues") return NextResponse.json({ error: "bad_range" }, { status: 400 })

  let name = ""
  let csv = ""
  if (type === "sales") {
    // Sales register: one row per invoice / credit note; credit notes are negative.
    const docs = await documentsIn(tenant.id, range!.from, range!.to)
    csv = toCsv(
      ["Date", "Number", "Type", "Against", "Order", "Customer", "Phone", "Taxable value", "CGST", "SGST", "Delivery", "Total"],
      docs.map((d) => {
        const sign = d.type === "credit_note" ? -1 : 1
        const cgst = d.s.taxByRate.reduce((a, r) => a + r.cgstPaise, 0)
        const sgst = d.s.taxByRate.reduce((a, r) => a + r.sgstPaise, 0)
        // Prices include GST, so the taxable value is the goods amount less the tax in it.
        const taxable = d.s.subtotalPaise - cgst - sgst
        return [
          fmtDate(d.issuedAt),
          d.number,
          d.type === "credit_note" ? "Credit note" : d.type === "tax_invoice" ? "Tax invoice" : "Bill of supply",
          d.s.against?.number ?? "",
          d.s.orderCode,
          d.s.customer.name,
          csvPhone(d.s.customer.phone),
          csvRupees(sign * taxable),
          csvRupees(sign * cgst),
          csvRupees(sign * sgst),
          csvRupees(sign * d.s.deliveryFeePaise),
          csvRupees(sign * d.totalPaise),
        ]
      })
    )
    name = `sales-register-${range!.from}-to-${range!.to}`
  } else if (type === "payments") {
    const rows = await paymentsIn(tenant.id, range!.from, range!.to)
    csv = toCsv(
      ["Date", "Customer", "Phone", "Method", "Status", "Amount", "Reference"],
      rows.map((p) => [fmtDate(p.at), p.customer.name, csvPhone(p.customer.phone), p.method === "cash_on_delivery" ? "Cash" : "UPI", p.status === "refunded" ? "Refund" : "Received", csvRupees(p.status === "refunded" ? -p.amountPaise : p.amountPaise), p.reference ?? ""])
    )
    name = `payments-${range!.from}-to-${range!.to}`
  } else if (type === "dues") {
    const rows = await duesList(tenant.id)
    csv = toCsv(
      ["Customer", "Phone", "Balance due", "Credit limit"],
      rows.map((r) => [r.customer.name, csvPhone(r.customer.phone), csvRupees(r.balancePaise), r.customer.creditLimitPaise ? csvRupees(r.customer.creditLimitPaise) : ""])
    )
    name = `dues-${new Date().toISOString().slice(0, 10)}`
  } else if (type === "products") {
    const { products } = await loadReport(tenant.id, range!.from, range!.to)
    csv = toCsv(
      ["Product (Tamil)", "Product (English)", "Pack", "Quantity", "Value"],
      products.map((p) => [p.product?.nameTa ?? "", p.product?.nameEn ?? "", p.product?.packEn ?? "", p.qty, csvRupees(p.paise)])
    )
    name = `products-${range!.from}-to-${range!.to}`
  } else {
    return NextResponse.json({ error: "bad_type" }, { status: 400 })
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
