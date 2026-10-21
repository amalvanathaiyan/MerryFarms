import type { Metadata, Viewport } from "next"
import { Noto_Sans_Tamil } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import "./globals.css"

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tamil",
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const locale = await getLocale()
  const name = tenant ? (locale === "ta" ? tenant.nameTa : tenant.nameEn) : "Farm4U"
  return {
    title: name,
    description: tenant ? `${tenant.nameEn} — farm-fresh orders` : "Farm-fresh orders from local farms",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  }
}

export const viewport: Viewport = {
  themeColor: "#0f8a42",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} className={tamil.variable}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
