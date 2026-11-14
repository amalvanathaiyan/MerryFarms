import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { isLegalKey, LEGAL, LEGAL_DOCS, LEGAL_REVIEWED, LEGAL_UPDATED } from "@/content/legal"
import { cn } from "@/lib/utils"

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params
  if (!isLegalKey(doc)) return {}
  const locale = await getLocale()
  return { title: `${LEGAL[doc].title[locale === "ta" ? "ta" : "en"]} · Farm For You` }
}

/** One of Farm For You's legal pages (src/content/legal.ts), with the others one tap away. */
export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  if (!isLegalKey(doc)) notFound()
  const t = await getTranslations("legal")
  const locale = (await getLocale()) === "ta" ? "ta" : "en"
  const d = LEGAL[doc]
  const updated = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${LEGAL_UPDATED}T00:00:00Z`))
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <nav aria-label={t("title")} className="flex gap-1.5 overflow-x-auto pb-1">
        {LEGAL_DOCS.map((k) => (
          <Link
            key={k}
            href={`/legal/${k}`}
            aria-current={k === doc ? "page" : undefined}
            className={cn("flex min-h-10 shrink-0 items-center rounded-full border px-3 text-sm font-semibold", k === doc ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
          >
            {t(`doc_${k}`)}
          </Link>
        ))}
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{d.title[locale]}</h1>
        <p className="text-sm text-muted-foreground">{t("updated", { date: updated })}</p>
        {!LEGAL_REVIEWED && <p className="rounded-xl bg-yolk px-3 py-2 text-sm font-medium text-yolk-foreground">{t("draft")}</p>}
        <p className="text-lg">{d.intro[locale]}</p>
      </header>
      {d.sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">{s.heading[locale]}</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {s.points.map((p, j) => (
              <li key={j}>{p[locale]}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}
