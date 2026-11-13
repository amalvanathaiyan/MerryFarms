import type { Metadata, Viewport } from "next"
import { Baloo_Thambi_2, Hind_Madurai } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { headers } from "next/headers"
import { getTenant } from "@/lib/tenant"
import { appIcon } from "@/domain/install-apps"
import "./globals.css"
import { DISPLAY_SCRIPT } from "@/lib/display"
import { openingScript } from "@/lib/opening"
import { farmOpening } from "@/lib/farm-brand"
import { FarmOpening, PlatformOpening } from "@/components/openings"
import { brandThemeCss, FFY_THEME } from "@/domain/brand-theme"

// Body: Hind Madurai, one family for Tamil and English. Headings: Baloo Thambi 2, rounded and warm.
const body = Hind_Madurai({
  subsets: ["tamil", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})
const heading = Baloo_Thambi_2({
  subsets: ["tamil", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const locale = await getLocale()
  const name = tenant ? (locale === "ta" ? tenant.nameTa : tenant.nameEn) : "Farm For You"
  const description = tenant ? `${tenant.nameEn} — farm-fresh orders` : "Farm-fresh orders from local farms"
  // Link previews need a full address, and each farm has its own (its subdomain), so it comes from the request.
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const base = host ? new URL(`${h.get("x-forwarded-proto") ?? "https"}://${host}`) : undefined
  // The farm's own preview picture (src/app/img/share); ?v changes when the farm's logo or name does.
  const image = { url: `/img/share?v=${tenant?.updatedAt.getTime() ?? 0}`, width: 1200, height: 630, alt: name }
  return {
    metadataBase: base,
    title: name,
    description,
    openGraph: { type: "website", title: name, description, siteName: "Farm For You", images: [image] },
    twitter: { card: "summary_large_image", title: name, description, images: [image.url] },
    manifest: "/app-manifest",
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { apple: appIcon("shop", tenant?.logoUrl, 180) },
  }
}

export const viewport: Viewport = {
  themeColor: "#f4f6ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const tenant = await getTenant()
  // The app that opens at this address and page (worked out by src/proxy.ts); only its opening is drawn
  const h = await headers()
  const opening = (["shop", "farm", "admin"] as const).find((a) => a === h.get("x-opening-app")) ?? "shop"
  return (
    // The display choice (soft colours, light/dark, larger text) is set on <html> before React loads.
    <html lang={locale} className={`${body.variable} ${heading.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: openingScript(opening) }} />
        {/* Brand colours: Farm For You's by default and always on its own screens (.ffy-chrome: admin, sign-in);
            the farm's own on its shop and farm app. Built from validated #rrggbb values only. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              brandThemeCss(FFY_THEME.primary, FFY_THEME.accent) +
              brandThemeCss(tenant?.themePrimary ?? FFY_THEME.primary, tenant?.themeAccent ?? FFY_THEME.accent, "", tenant?.nameColours ?? []) +
              brandThemeCss(FFY_THEME.primary, FFY_THEME.accent, ".ffy-chrome"),
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {/* The app's opening, when it has just been opened from its home-screen icon (src/lib/opening.ts):
              FarmForYou's alone for admin; FarmForYou's, then the farm's, for the shop and the farm app */}
          {opening !== "admin" && tenant ? <FarmOpening app={opening} farm={farmOpening(tenant, locale)} /> : <PlatformOpening app={opening} />}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
