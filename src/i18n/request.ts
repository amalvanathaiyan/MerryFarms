import { getRequestConfig } from "next-intl/server"
import { headers } from "next/headers"
import { defaultLocale, isLocale } from "./routing"

export default getRequestConfig(async () => {
  const raw = (await headers()).get("x-locale")
  const locale = isLocale(raw) ? raw : defaultLocale

  return {
    locale,
    timeZone: "Asia/Kolkata",
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
