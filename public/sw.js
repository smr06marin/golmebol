// Service worker de Golmebol: SOLO recibe los avisos push (chat de ayuda y avisos de torneos para el público).
// No guarda páginas ni archivos en caché: la app se comporta exactamente igual que antes.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { cuerpo: e.data ? e.data.text() : '' } }
  e.waitUntil((async () => {
    // Si la persona ya está mirando la app, no hace falta la notificación del sistema.
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (d.tag !== 'prueba' && ventanas.some(c => c.visibilityState === 'visible' && c.focused)) {
      const esChat = !d.tag || String(d.tag).startsWith('soporte')
      // chat: se actualiza solo · avisos de torneo: se muestran dentro de la app
      ventanas.forEach(c => c.postMessage(esChat ? { tipo: 'chat-nuevo' } : { tipo: 'aviso-torneo', titulo: d.titulo, cuerpo: d.cuerpo }))
      return
    }
    await self.registration.showNotification(d.titulo || 'Javier Gonzales · Golmebol', {
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
    // Aviso de torneo (público): abre o trae al frente Golmebol en la página del torneo
    if (!ruta.startsWith('/admin')) {
      const mia = ventanas.find(c => { try { return new URL(c.url).origin === self.location.origin } catch { return false } })
      if (mia) {
        try { await mia.focus(); if ('navigate' in mia) await mia.navigate(ruta); return } catch { /* abre una ventana nueva */ }
      }
      await self.clients.openWindow(ruta)
      return
    }
    const enAdmin = ventanas.find(c => { try { const u = new URL(c.url); return u.origin === self.location.origin && u.pathname.startsWith('/admin') } catch { return false } })
    if (enAdmin) {
      await enAdmin.focus()
      enAdmin.postMessage({ tipo: 'abrir-ayuda' })
      return
    }
    await self.clients.openWindow(ruta)
  })())
})

// Instalar con un toque en Android: Chrome solo ofrece el aviso de instalación automático si la página tiene un
// service worker con un manejador "fetch". Este NO hace nada (no guarda ni cambia ninguna respuesta): la app
// se comporta exactamente igual que antes.
self.addEventListener('fetch', () => {})
