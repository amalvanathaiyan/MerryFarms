import { describe, expect, it } from "vitest"
import { needsChromeToInstall, openInChromeLink } from "./install-browser"

const chrome = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
const samsung = "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"
const edge = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0"
const opera = "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0"
const mi = "Mozilla/5.0 (Linux; U; Android 13; en-in; 22101316I) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.0.0 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.0"
const firefox = "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0"
const webview = "Mozilla/5.0 (Linux; Android 14; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36"
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const desktopEdge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"

describe("install browser", () => {
  it("lets Chrome on Android install", () => {
    expect(needsChromeToInstall(chrome)).toBe(false)
  })

  it("sends other Android browsers to Chrome", () => {
    for (const ua of [samsung, edge, opera, mi, firefox, webview]) expect(needsChromeToInstall(ua)).toBe(true)
    expect(needsChromeToInstall(chrome, true)).toBe(true) // Brave looks like Chrome
  })

  it("leaves iPhone and computers alone", () => {
    expect(needsChromeToInstall(iphone)).toBe(false)
    expect(needsChromeToInstall(desktopEdge)).toBe(false)
  })

  it("opens the same page in Chrome", () => {
    expect(openInChromeLink("merry-farms.vercel.app", "/farm")).toBe("intent://merry-farms.vercel.app/farm#Intent;scheme=https;package=com.android.chrome;end")
  })
})
