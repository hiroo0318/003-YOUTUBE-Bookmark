// 채널담 서비스 워커: 웹 푸시 알림을 띄우고, 알림을 누르면 해당 화면을 연다. 오프라인 캐시는 하지 않는다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "채널담", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      lang: "ko",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      // 이미 열린 채널담 창이 있으면 그 창을 앞으로 가져와 이동하고, 없으면 새로 연다.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          await client.navigate(url);
          return;
        } catch {
          break;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
