import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { allBalances } from "@/server/billing"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; dues?: string }> }) {
  const { q = "", dues } = await searchParams
  const { tenant, db } = await requireStaff()
  const t = await getTranslations("farm.customers")
  const query = q.trim()
  const digits = query.replace(/\D/g, "")

  const [customers, balances, orderCounts] = await Promise.all([
    db.customer.findMany({
      where: query
        ? { OR: [{ name: { contains: query, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    allBalances(tenant.id),
    db.order.groupBy({ by: ["customerId"], where: { status: "delivered" }, _count: { _all: true } }),
  ])
  const counts = new Map(orderCounts.map((r) => [r.customerId, r._count._all]))
  const onlyDues = dues === "1"
  const rows = customers
    .map((c) => ({ ...c, balance: balances.get(c.id) ?? 0, delivered: counts.get(c.id) ?? 0 }))
    .filter((c) => !onlyDues || c.balance > 0)
    .sort((a, b) => b.balance - a.balance || b.delivered - a.delivered)
  const totalDues = [...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link href={onlyDues ? "/farm/customers" : "/farm/customers?dues=1"} className={cn("rounded-full border px-3 py-1 text-sm font-medium", onlyDues ? "border-primary bg-accent" : "bg-card")}>
          {t("withDues")} · <span className="tabular-nums">{formatRupees(totalDues)}</span>
        </Link>
      </div>
      <form className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder={t("search")} aria-label={t("search")} className="h-11" />
        {onlyDues && <input type="hidden" name="dues" value="1" />}
      </form>

      {rows.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("none")}</p>}
      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/farm/customers/${c.id}`} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(c.phone)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.isTrusted && <span className="rounded bg-accent px-1.5 text-xs font-medium">{t("trusted")}</span>}
                  {c.delivered <= 1 && <span className="rounded border px-1.5 text-xs">{t("new")}</span>}
                  {c.creditLimitPaise > 0 && <span className="rounded border px-1.5 text-xs">{t("khata")}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={cn("font-bold tabular-nums", c.balance > 0 && "text-destructive")}>{c.balance > 0 ? formatRupees(c.balance) : c.balance < 0 ? `${t("advance")} ${formatRupees(-c.balance)}` : "—"}</div>
                <div className="text-xs text-muted-foreground">{t("orders", { count: c.delivered })}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
