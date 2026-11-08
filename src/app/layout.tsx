import type { Metadata, Viewport } from "next"
import { Baloo_Thambi_2, Hind_Madurai } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import "./globals.css"
import { DISPLAY_SCRIPT } from "@/lib/display"

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
  const name = tenant ? (locale === "ta" ? tenant.nameTa : tenant.nameEn) : "FarmForYou"
  return {
    title: name,
    description: tenant ? `${tenant.nameEn} — farm-fresh orders` : "Farm-fresh orders from local farms",
    manifest: "/app-manifest",
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
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
  return (
    // The display choice (soft colours, light/dark, larger text) is set on <html> before React loads.
    <html lang={locale} className={`${body.variable} ${heading.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
