// HTML de la página para los DOMINIOS PROPIOS de organizadores/torneos
// (ej. centegol.com), armado en el SERVIDOR con el título, el ícono (favicon)
// y la vista previa de ESA página — no los de Golmebol.
//
// Por qué hace falta: el index.html trae título e ícono de Golmebol, y React
// los cambia recién después de cargar. Google, WhatsApp, Facebook y el
// historial del navegador leen el HTML tal como llega, así que mostraban
// "Golmebol" y su logo. Acá el HTML ya sale con los datos correctos.
//
// vercel.json manda a esta función SOLO las visitas a dominios que no son de
// Golmebol (golmebol.com, *.vercel.app, localhost siguen igual de rápidos).
// Si algo falla (sin conexión a la base, dominio sin vincular), se devuelve
// el index.html normal: nunca se rompe la página.

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function consultar(tabla, columnas, host) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?select=${columnas}&custom_domain=ilike.${encodeURIComponent(host)}&limit=1`
  const r = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
  if (!r.ok) return null
  const filas = await r.json()
  return Array.isArray(filas) && filas[0] ? filas[0] : null
}

async function buscarIdentidad(host) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    const t = await consultar('tournaments', 'name,logo_url,favicon_url', host)
    if (t) return { titulo: t.name, icono: t.favicon_url || t.logo_url, imagen: t.logo_url, descripcion: '' }
    const o = await consultar('organizador_perfiles', 'nombre_publico,logo_url,favicon_url,descripcion', host)
    if (o) return { titulo: o.nombre_publico, icono: o.favicon_url || o.logo_url, imagen: o.logo_url, descripcion: o.descripcion || '' }
  } catch (e) { /* se sirve la página normal */ }
  return null
}

export default async function handler(req, res) {
  const hostCompleto = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase()
  const host = hostCompleto.split(':')[0].replace(/^www\./, '')
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()

  // El index.html compilado (archivo estático; no pasa por esta función porque tiene punto).
  let html
  try {
    const r = await fetch(`${proto}://${hostCompleto}/index.html`, { headers: { 'x-gm-interno': '1' } })
    html = await r.text()
  } catch (e) {
    res.statusCode = 502
    res.end('No se pudo cargar la página')
    return
  }

  const ident = await buscarIdentidad(host)
  if (ident && ident.titulo) {
    const titulo = esc(ident.titulo)
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titulo}</title>`)
    if (ident.icono) {
      const icono = esc(ident.icono)
      html = html.replace(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/gi, '')
      html = html.replace('</head>', `<link rel="icon" href="${icono}" />\n<link rel="apple-touch-icon" href="${icono}" />\n</head>`)
    }
    const metas = [
      `<meta property="og:title" content="${titulo}" />`,
      `<meta property="og:site_name" content="${titulo}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="https://${esc(hostCompleto)}${esc(req.url && req.url.startsWith('/') ? req.url.split('?')[0] : '/')}" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${titulo}" />`,
    ]
    if (ident.imagen) metas.push(`<meta property="og:image" content="${esc(ident.imagen)}" />`, `<meta name="twitter:image" content="${esc(ident.imagen)}" />`)
    if (ident.descripcion) {
      const d = esc(String(ident.descripcion).slice(0, 200))
      metas.push(`<meta name="description" content="${d}" />`, `<meta property="og:description" content="${d}" />`)
    }
    html = html.replace('</head>', `${metas.join('\n')}\n</head>`)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.end(html)
}
