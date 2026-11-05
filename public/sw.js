// Service worker de Golmebol: SOLO recibe los avisos push del chat de ayuda.
// No guarda páginas ni archivos en caché: la app se comporta exactamente igual que antes.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { cuerpo: e.data ? e.data.text() : '' } }
  e.waitUntil((async () => {
    // Si la persona ya está mirando la app, no hace falta la notificación: el chat se actualiza solo.
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (ventanas.some(c => c.visibilityState === 'visible' && c.focused)) {
      ventanas.forEach(c => c.postMessage({ tipo: 'chat-nuevo' }))
      return
    }
    await self.registration.showNotification(d.titulo || 'Soporte Golmebol', {
      body: d.cuerpo || 'Tienes un mensaje nuevo',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'soporte',
      renotify: true,
      data: { ruta: d.ruta || '/admin?ayuda=1' },
    })
  })())
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const ruta = e.notification.data?.ruta || '/admin?ayuda=1'
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const enAdmin = ventanas.find(c => { try { const u = new URL(c.url); return u.origin === self.location.origin && u.pathname.startsWith('/admin') } catch { return false } })
    if (enAdmin) {
      await enAdmin.focus()
      enAdmin.postMessage({ tipo: 'abrir-ayuda' })
      return
    }
    await self.clients.openWindow(ruta)
  })())
})
