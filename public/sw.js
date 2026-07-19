self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "Weebx", body: event.data ? event.data.text() : "" }
  }

  const title = data.title || "Weebx — Новая серия"
  const options = {
    body: data.body || "Вышло новая серия аниме из вашего списка",
    icon: data.icon || "/icon-light-32x32.png",
    badge: data.badge || "/icon-light-32x32.png",
    data: data.data || {},
    vibrate: [100, 50, 100],
    tag: data.tag || "episode-update",
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
