/**
 * Which Android browsers install the app safely. Pure, so it is tested.
 *
 * Installing a site on Android wraps it in a small Android app. Chrome has Google build that app for current
 * Android, so Play Protect accepts it. Samsung Internet, Edge, Opera, Mi Browser and others build it for an old
 * Android version, and newer Play Protect blocks it as "Unsafe app blocked … built for an older version of Android".
 * So on Android, every browser but Chrome is sent to Chrome to install.
 *
 * Every Chromium browser says "Chrome/" in its user agent, so the others are recognised by their own marks.
 * Brave hides its mark from the user agent; the caller passes `brave` from `navigator.brave`.
 */
export function needsChromeToInstall(userAgent: string, brave = false): boolean {
  if (!/Android/i.test(userAgent)) return false
  if (brave) return true
  // An app's built-in browser (WebView, marked "wv") can't install at all.
  if (/; wv\)/.test(userAgent)) return true
  const others = /SamsungBrowser|EdgA|OPR\/|Opera|MiuiBrowser|XiaoMi|UCBrowser|YaBrowser|HeyTapBrowser|VivoBrowser|Firefox|DuckDuckGo|Silk\//
  if (others.test(userAgent)) return true
  return !/Chrome\//.test(userAgent)
}

/** A link that opens the same page in Chrome on Android (Android offers Chrome from Play Store if it is missing). */
export function openInChromeLink(host: string, path: string): string {
  return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`
}
