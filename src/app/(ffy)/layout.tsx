import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Mail, Phone } from "lucide-react"
import { FfyMark } from "@/components/art/brand-mark"
import { LanguageToggle } from "@/components/language-toggle"
import { formatIndianMobile } from "@/domain/phone"
import { billingProfile } from "@/server/platform-billing"
import { farmSignInUrl } from "@/lib/farm-url"
import { LEGAL_DOCS } from "@/content/legal"

export const dynamic = "force-dynamic"

/** Farm For You's own pages are Farm For You's, not the default farm's: its name and preview, and nothing to install. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home")
  const description = t("metaDescription")
  return {
    title: "Farm For You",
    description,
    manifest: null,
    openGraph: { type: "website", title: "Farm For You", description, siteName: "Farm For You", images: [{ url: "/img/share?ffy=1", width: 1200, height: 630, alt: "Farm For You" }] },
    twitter: { card: "summary_large_image", title: "Farm For You", description, images: ["/img/share?ffy=1"] },
  }
}

/**
 * Farm For You's public pages (home, Register your farm, legal): its mark and name, the language switch and one
 * button to register; at the foot, how to reach the team, sign-ins and the legal pages. Contact details are Farm For
 * You's billing details (admin · Billing), so they're set in one place.
 */
export default async function FfyLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("home")
  const tl = await getTranslations("legal")
  const contact = await billingProfile()
  return (
    <div className="ffy-chrome flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <FfyMark tone="tile" small className="size-10" />
            <span className="font-display text-lg leading-tight font-bold" lang="en">
              Farm For You
            </span>
          </Link>
          <LanguageToggle compact />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-card">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
          <section className="flex flex-col gap-2">
            <h2 className="font-bold">{t("contactTitle")}</h2>
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex min-h-11 items-center gap-2 font-medium hover:text-primary">
                <Phone className="size-4" aria-hidden /> <span className="tabular-nums">{formatIndianMobile(contact.phone)}</span>
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex min-h-11 items-center gap-2 font-medium break-all hover:text-primary">
                <Mail className="size-4 shrink-0" aria-hidden /> {contact.email}
              </a>
            )}
            {!contact.phone && !contact.email && <p className="text-muted-foreground">{t("contactSoon")}</p>}
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-bold">{t("signInTitle")}</h2>
            <a href={farmSignInUrl()} className="flex min-h-11 items-center font-medium hover:text-primary">
              {t("farmSignIn")}
            </a>
            <Link href="/join" className="flex min-h-11 items-center font-medium hover:text-primary">
              {t("register")}
            </Link>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-bold">{tl("title")}</h2>
            {LEGAL_DOCS.map((d) => (
              <Link key={d} href={`/legal/${d}`} className="flex min-h-9 items-center hover:text-primary">
                {tl(`doc_${d}`)}
              </Link>
            ))}
          </section>
        </div>
        <p className="pb-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Farm For You</p>
      </footer>
    </div>
  )
}
