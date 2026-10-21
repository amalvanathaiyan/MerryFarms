"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetTemplate, saveTemplate } from "@/app/actions/messages"
import { fillTemplate, type TemplateKey } from "@/domain/templates"
import { cn } from "@/lib/utils"

type Row = { key: TemplateKey; vars: string[]; defaults: { ta: string; en: string }; ta: string; en: string }

/** Sample values so the owner sees what customers will actually receive. */
const SAMPLE: Record<string, { ta: string; en: string }> = {
  name: { ta: "பிரியா", en: "Priya" },
  code: { ta: "MF-1047", en: "MF-1047" },
  items: { ta: "2 × நாட்டுக் கோழி முட்டை (30 முட்டை)", en: "2 × Country eggs (Tray of 30)" },
  total: { ta: "₹780", en: "₹780" },
  slot: { ta: "நாளை 7–9 AM", en: "Tomorrow 7–9 AM" },
  payment: { ta: "UPI", en: "UPI" },
  farm: { ta: "மெர்ரி ஃபார்ம்ஸ்", en: "Merry Farms" },
  amount: { ta: "₹390", en: "₹390" },
  upi: { ta: "merryfarms@okaxis", en: "merryfarms@okaxis" },
  number: { ta: "MF/2026-27/0001", en: "MF/2026-27/0001" },
  link: { ta: "https://merryfarms.example/…", en: "https://merryfarms.example/…" },
  phone: { ta: "+91 90000 20001", en: "+91 90000 20001" },
  date: { ta: "22 அக்.", en: "22 Oct" },
  prices: { ta: "• நாட்டுக் கோழி முட்டை, 30 முட்டை — ₹390", en: "• Country eggs, Tray of 30 — ₹390" },
}
const sample = (lang: "ta" | "en") => Object.fromEntries(Object.entries(SAMPLE).map(([k, v]) => [k, v[lang]]))

export function TemplateEditor({ templates }: { templates: Row[] }) {
  const t = useTranslations("farm.whatsapp")
  const [open, setOpen] = useState<TemplateKey | null>(null)
  return (
    <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4 print:hidden">
      <h2 className="font-semibold">{t("templatesTitle")}</h2>
      <p className="mb-2 text-sm text-muted-foreground">{t("templatesHint")}</p>
      <ul className="divide-y">
        {templates.map((row) => (
          <li key={row.key}>
            <button type="button" onClick={() => setOpen(open === row.key ? null : row.key)} aria-expanded={open === row.key} className="flex w-full items-center justify-between gap-3 py-3 text-left">
              <span>
                <span className="block font-medium">{t(`tpl_${row.key}`)}</span>
                {(row.ta || row.en) && <span className="text-xs font-semibold text-primary">{t("customised")}</span>}
              </span>
              <ChevronDown className={cn("size-5 shrink-0 transition-transform", open === row.key && "rotate-180")} />
            </button>
            {open === row.key && <TemplateRow row={row} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function TemplateRow({ row }: { row: Row }) {
  const t = useTranslations("farm.whatsapp")
  const te = useTranslations("errors")
  const [text, setText] = useState({ ta: row.ta || row.defaults.ta, en: row.en || row.defaults.en })
  const [lang, setLang] = useState<"ta" | "en">("ta")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      setError(null)
      // Saving the default unchanged stores nothing, so future improvements to defaults still apply.
      const r = await saveTemplate({
        key: row.key,
        bodyTa: text.ta === row.defaults.ta ? "" : text.ta,
        bodyEn: text.en === row.defaults.en ? "" : text.en,
      })
      if (!r.ok) {
        setError(r.error === "template_unknown" ? t("unknownPlaceholders", { names: (r.unknown ?? []).map((n) => `{${n}}`).join(", ") }) : te.has(r.error) ? te(r.error) : te("generic"))
        if (r.lang) setLang(r.lang)
      } else setSaved(true)
    })

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex gap-2">
        {(["ta", "en"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", lang === l ? "border-primary bg-accent" : "bg-card")}>
            {l === "ta" ? "தமிழ்" : "English"}
          </button>
        ))}
      </div>
      <textarea
        rows={5}
        lang={lang}
        value={text[lang]}
        onChange={(e) => (setSaved(false), setText({ ...text, [lang]: e.target.value }))}
        aria-label={t(`tpl_${row.key}`)}
        className="rounded-md border border-input bg-transparent px-3 py-2"
      />
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground">{t("placeholders")}</span>
        {row.vars.map((v) => (
          <button key={v} type="button" onClick={() => setText({ ...text, [lang]: `${text[lang]}{${v}}` })} className="rounded-md border bg-muted px-1.5 font-mono text-xs">
            {`{${v}}`}
          </button>
        ))}
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">{t("preview")}</div>
        <div className="whitespace-pre-wrap rounded-xl rounded-tl-sm bg-accent p-3 text-sm">{fillTemplate(text[lang], sample(lang))}</div>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending} className="flex-1">
          {saved ? t("saved") : t("save")}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await resetTemplate(row.key)
              setText({ ta: row.defaults.ta, en: row.defaults.en })
              setSaved(false)
            })
          }
        >
          {t("reset")}
        </Button>
      </div>
    </div>
  )
}
