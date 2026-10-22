// Added to the app's service worker by next-pwa (customWorkerSrc: "src/worker" in next.config.ts).
// Shows phone notifications sent by the server and opens the right page when tapped.

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Merry Farms", body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "Merry Farms"
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        renotify: !!data.tag,
        data: { url: data.url || "/" },
        lang: "ta",
      }),
      // A count on the home-screen icon where the phone supports it.
      self.navigator && "setAppBadge" in self.navigator ? self.navigator.setAppBadge().catch(() => {}) : Promise.resolve(),
    ])
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === url && "focus" in w) return w.focus()
      }
      if (self.navigator && "clearAppBadge" in self.navigator) self.navigator.clearAppBadge().catch(() => {})
      return self.clients.openWindow(url)
    })
  )
})
