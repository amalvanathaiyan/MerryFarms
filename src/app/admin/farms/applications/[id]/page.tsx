import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, MapPin, MessageCircle, Phone, TriangleAlert } from "lucide-react"
import { applicationDetail } from "@/server/applications"
import { applicationNumber, cleanChecklist, isOpen, missingChecks, nextStates } from "@/domain/applications"
import { formatIndianMobile } from "@/domain/phone"
import { pick } from "@/lib/i18n-helpers"
import { Button } from "@/components/ui/button"
import { Panel } from "../../../admin-ui"
import { ApplicationBadge } from "../application-badge"
import { ApplicationDecision, ReviewChecklist } from "./review-forms"

/**
 * Admin · one farm's application, read top to bottom: what the farm told us (with a call and WhatsApp a tap away),
 * the reviewer's checklist and notes, then what to do: add the farm (once the phone and location are checked), ask
 * for more details, hold, or turn it down.
 */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await applicationDetail(id)
  if (!a) notFound()
  const t = await getTranslations("admin.join")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  const wa = a.phone.replace(/^\+/, "")
  const open = isOpen(a.status)
  const missing = missingChecks(a.checklist)

  const rows: [string, React.ReactNode][] = [
    [t("f_owner"), a.ownerName],
    [t("f_email"), <a key="e" href={`mailto:${a.email}`} className="break-all text-primary underline">{a.email}</a>],
    [t("f_farm"), [a.nameTa, a.nameEn].filter(Boolean).join(" · ")],
    [t("f_modules"), a.modules.length ? a.modules.map((m) => (tm.has(m) ? tm(m) : m)).join(", ") : "—"],
    [t("f_address"), <span key="a" className="whitespace-pre-line">{`${a.address}\n${a.district} ${a.pincode}`}</span>],
    [t("f_plan"), a.plan ? pick(locale, a.plan.nameTa, a.plan.nameEn) : t("noPlan")],
    ["FSSAI", a.fssai ?? "—"],
    ["GSTIN", a.gstin ?? "—"],
    ["PAN", a.pan ?? "—"],
    [t("f_language"), a.language === "en" ? "English" : "தமிழ்"],
    [t("f_agreed"), t("agreedOn", { date: when.format(a.agreedAt), version: a.agreementVersion })],
  ]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/admin/farms/applications" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">{a.nameTa}</h1>
          <ApplicationBadge status={a.status} label={t(`state_${a.status}`)} />
        </div>
        <p className="text-muted-foreground tabular-nums">
          {applicationNumber(a.number)} · {t("sent", { date: when.format(a.createdAt) })}
        </p>
      </div>

      {(a.sameFarmPhone || a.earlier.length > 0) && (
        <div className="flex flex-col gap-1 rounded-2xl bg-yolk p-4 text-yolk-foreground">
          {a.sameFarmPhone && (
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-5 shrink-0" aria-hidden />
              <Link href={`/admin/farms/${a.sameFarmPhone.id}`} className="underline">
                {t("phoneIsFarm", { farm: pick(locale, a.sameFarmPhone.nameTa, a.sameFarmPhone.nameEn) })}
              </Link>
            </p>
          )}
          {a.earlier.map((e) => (
            <p key={e.id} className="text-sm">
              <Link href={`/admin/farms/applications/${e.id}`} className="underline">
                {t("appliedBefore", { number: applicationNumber(e.number), date: when.format(e.createdAt), state: t(`state_${e.status}`) })}
              </Link>
            </p>
          ))}
        </div>
      )}

      <Panel title={t("toldUs")}>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" className="h-12">
            <a href={`tel:${a.phone}`}>
              <Phone aria-hidden /> <span className="tabular-nums">{formatIndianMobile(a.phone)}</span>
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12">
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          </Button>
          {a.lat != null && a.lng != null && (
            <Button asChild size="lg" variant="outline" className="h-12">
              <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer">
                <MapPin aria-hidden /> {t("onMap")}
              </a>
            </Button>
          )}
        </div>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {a.message && <p className="rounded-xl bg-muted p-3 text-sm whitespace-pre-line">{a.message}</p>}
      </Panel>

      <ReviewChecklist id={a.id} checklist={cleanChecklist(a.checklist)} notes={a.notes ?? ""} locked={!open} />

      {a.status === "approved" && a.farm ? (
        <Panel title={t("state_approved")}>
          <Button asChild size="lg" className="h-12 self-start">
            <Link href={`/admin/farms/${a.farm.id}`}>{t("openFarm", { farm: pick(locale, a.farm.nameTa, a.farm.nameEn) })}</Link>
          </Button>
        </Panel>
      ) : (
        <ApplicationDecision
          id={a.id}
          status={a.status}
          next={nextStates(a.status)}
          missing={missing}
          reply={a.reply}
          phone={wa}
          number={applicationNumber(a.number)}
        />
      )}
    </div>
  )
}
