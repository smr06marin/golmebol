// Vercel Routing Middleware: corre ANTES de servir cualquier archivo.
//
// Para los DOMINIOS PROPIOS de organizadores/torneos (ej. centegol.com) arma
// el HTML con el título, el ícono (favicon) y la vista previa de ESA página,
// en vez de los de Golmebol que trae el index.html. Google, WhatsApp, Facebook
// y el historial del navegador leen el HTML tal como llega del servidor (sin
// esperar a React), por eso antes mostraban "Golmebol" y su logo.
//
// Por qué middleware y no un rewrite en vercel.json: para la página de inicio
// ("/") Vercel sirve el archivo estático index.html ANTES de aplicar los
// rewrites, así que un rewrite nunca la alcanzaba. El middleware sí.
//
// golmebol.com, *.vercel.app y localhost pasan de largo sin costo alguno.
// Si algo falla (dominio sin vincular, base sin respuesta) se sirve la página
// normal: nunca se rompe nada.

export const config = {
  // Solo páginas (rutas sin punto): no toca /assets, /api, imágenes, .js, .css, index.html, etc.
  matcher: ['/((?!api/|assets/|.*\\..*).*)'],
}

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Equivale a next() de @vercel/functions: seguir con la petición normal.
const seguir = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

function esHostPropio(h) {
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('golmebol.com') || h.endsWith('.vercel.app')
}

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

export default async function middleware(request) {
  try {
    if (request.method !== 'GET') return seguir()
    const url = new URL(request.url)
    const hostCompleto = url.host.toLowerCase()
    const hostname = url.hostname.toLowerCase()
    if (esHostPropio(hostname)) return seguir()

    const ident = await buscarIdentidad(hostname.replace(/^www\./, ''))
    if (!ident || !ident.titulo) return seguir()

    // El index.html compilado (tiene punto: este middleware no lo intercepta).
    const base = await fetch(`${url.protocol}//${hostCompleto}/index.html`, { headers: { 'x-gm-interno': '1' } })
    if (!base.ok) return seguir()
    let html = await base.text()

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
      `<meta property="og:url" content="${esc(url.origin + url.pathname)}" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${titulo}" />`,
    ]
    if (ident.imagen) metas.push(`<meta property="og:image" content="${esc(ident.imagen)}" />`, `<meta name="twitter:image" content="${esc(ident.imagen)}" />`)
    if (ident.descripcion) {
      const d = esc(String(ident.descripcion).slice(0, 200))
      metas.push(`<meta name="description" content="${d}" />`, `<meta property="og:description" content="${d}" />`)
    }
    html = html.replace('</head>', `${metas.join('\n')}\n</head>`)

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (e) {
    return seguir()
  }
}
