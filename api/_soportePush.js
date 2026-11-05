// Manda el aviso push al organizador cuando soporte le responde.
// Nunca rompe el flujo: si algo falla (sin claves, sin suscripciones, servicio caído) solo se anota en el log.
// Variables en Vercel: VITE_VAPID_PUBLIC_KEY (pública) y VAPID_PRIVATE_KEY (secreta).

export async function avisarOrganizador(admin, chatId, texto) {
  try {
    const pub = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
    const priv = process.env.VAPID_PRIVATE_KEY
    if (!pub || !priv) return
    const { data: chat } = await admin.from('soporte_chats').select('user_id').eq('id', chatId).maybeSingle()
    if (!chat?.user_id) return
    const { data: subs } = await admin.from('soporte_push').select('id, endpoint, p256dh, auth').eq('user_id', chat.user_id)
    if (!subs?.length) return

    const webpush = (await import('web-push')).default
    webpush.setVapidDetails('https://golmebol.com', pub, priv)
    const payload = JSON.stringify({
      titulo: 'Soporte Golmebol',
      cuerpo: String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Tienes un mensaje nuevo',
      ruta: '/admin?ayuda=1',
      tag: 'soporte',
    })
    await Promise.all(subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high', timeout: 8000 })
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from('soporte_push').delete().eq('id', s.id) // el navegador ya no existe
        else console.error('soporte push:', e?.statusCode || e?.message)
      }
    }))
  } catch (e) {
    console.error('soporte push:', e?.message)
  }
}
