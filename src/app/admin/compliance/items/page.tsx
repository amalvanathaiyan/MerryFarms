import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { listItems } from "@/server/compliance"
import { STARTER_ITEMS } from "@/domain/compliance"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"
import { AddStarterList, ItemForm, NewItem } from "../compliance-forms"

const ACTION_STYLE: Record<string, string> = { block: "bg-destructive/15 text-destructive", hold: "bg-yolk text-yolk-foreground", licence: "bg-accent text-accent-foreground" }

/**
 * Admin · Compliance · Restricted items list: each entry with its words and action, opened to change it. The starter
 * examples can be added in one go; the whole list is to be checked by a legal expert before screening is switched on.
 */
export default async function RestrictedItemsPage() {
  const t = await getTranslations("admin.compliance")
  const locale = await getLocale()
  const items = await listItems()
  const missing = STARTER_ITEMS.filter((s) => !items.some((i) => i.labelEn === s.labelEn)).length
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/admin/compliance" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("listTitle")}</h1>
        <p className="text-muted-foreground">{t("listHint")}</p>
      </div>
      <p className="rounded-xl bg-yolk px-3 py-2 text-sm font-medium text-yolk-foreground">{t("legalCheck")}</p>

      <NewItem />
      {missing > 0 && <AddStarterList missing={missing} />}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noItems")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id}>
              <details className={cn("group rounded-2xl border bg-card", !i.active && "opacity-70")}>
                <summary className="flex min-h-16 cursor-pointer list-none flex-col gap-1 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{pick(locale, i.labelTa, i.labelEn)}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", ACTION_STYLE[i.action] ?? "bg-muted")}>{t(`action_${i.action}`)}</span>
                    {!i.active && <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold">{t("inactive")}</span>}
                    <span className="ml-auto text-sm font-normal underline group-open:hidden">{t("change")}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{[...i.wordsTa, ...i.wordsEn].join(", ")}</span>
                </summary>
                <div className="border-t p-4">
                  <ItemForm item={i} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
