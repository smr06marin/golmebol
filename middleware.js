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
// TAMBIÉN arma la vista previa de los LINKS que se mandan por WhatsApp (cuentas
// del equipo, deudores de tarjetas, planillar, registro de jugadores, etc.):
// en vez de "Golmebol" a secas, la tarjeta dice para qué es el link.
//
// El resto de páginas de golmebol.com, *.vercel.app y localhost pasan de largo sin costo alguno.
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

// ── Vista previa de cada tipo de link (lo que se ve al pegarlo en WhatsApp) ──
const RUTAS_LINK = [
  { re: /^\/finanzas\/([^/]+)\/?$/, titulo: 'Revisa las cuentas de tu equipo', desc: 'Mira lo que debe tu equipo y los pagos que ha hecho. Entra con la cédula del representante.', dinamico: 'finanzas' },
  { re: /^\/deudores-tarjetas\/[^/]+\/?$/, titulo: 'Deudores de tarjetas', desc: 'Revisa qué equipos y jugadores deben tarjetas y registra sus pagos. Solo para quien organiza.' },
  { re: /^\/planillar\/[^/]+\/?$/, titulo: 'Planillar el partido', desc: 'Link para llenar la planilla del partido: goles, tarjetas y resultado.' },
  { re: /^\/reloj\/[^/]+\/?$/, titulo: 'Reloj del partido', desc: 'Link para manejar el reloj del partido desde el celular.' },
  { re: /^\/en-vivo-control\/[^/]+\/?$/, titulo: 'Control de la transmisión en vivo', desc: 'Panel para manejar los gráficos de la transmisión: marcador, repeticiones, tabla y patrocinadores.' },
  { re: /^\/registro\/equipo\/[^/]+\/[^/]+\/?$/, titulo: 'Inscribe a los jugadores de tu equipo', desc: 'Registra a los jugadores del equipo en el torneo con sus datos y foto.' },
  { re: /^\/registro\/escuela\/[^/]+\/?$/, titulo: 'Registro de escuela deportiva', desc: 'Inscribe al deportista en la escuela.' },
  { re: /^\/reservar\/[^/]+\/?$/, titulo: 'Reserva tu cancha', desc: 'Mira los horarios disponibles y reserva la cancha.' },
  { re: /^\/pedir\/[^/]+\/?$/, titulo: 'Haz tu pedido', desc: 'Pide desde tu celular en el escenario.' },
  { re: /^\/escenarios\/?$/, titulo: 'Escenarios deportivos', desc: 'Canchas y escenarios para reservar y jugar.' },
  { re: /^\/organizador\/[^/]+\/?$/, titulo: 'Torneos del organizador', desc: 'Mira todos los torneos, partidos y resultados de este organizador.' },
  { re: /^\/t\/([^/]+)\/?$/, titulo: 'Torneo en Golmebol', desc: 'Tabla de posiciones, próximos partidos, resultados y goleadores.', dinamico: 'torneo' },
]

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function datosTorneoPorId(id) {
  if (!ES_UUID.test(id)) return null
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tournaments?select=name,logo_url&id=eq.${id}&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
  if (!r.ok) return null
  const f = await r.json()
  return Array.isArray(f) && f[0] ? f[0] : null
}

async function datosTorneoPorTokenFinanzas(token) {
  if (!ES_UUID.test(token)) return null
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/finanzas_link_info`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  })
  if (!r.ok) return null
  const d = await r.json()
  return d && d.torneo ? d.torneo : null
}

// Devuelve { titulo, descripcion, imagen } del link, o null si la ruta no es de un link conocido.
async function metaDeLink(pathname) {
  for (const r of RUTAS_LINK) {
    const m = pathname.match(r.re)
    if (!m) continue
    const out = { titulo: r.titulo, descripcion: r.desc, imagen: null }
    if (r.dinamico && SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        if (r.dinamico === 'finanzas') {
          const t = await datosTorneoPorTokenFinanzas(m[1])
          if (t?.name) { out.descripcion = `${t.name}: mira lo que debe tu equipo y los pagos que ha hecho. Entra con la cédula del representante.`; out.imagen = t.logo_url || null }
        } else if (r.dinamico === 'torneo') {
          const t = await datosTorneoPorId(m[1])
          if (t?.name) { out.titulo = t.name; out.imagen = t.logo_url || null }
        }
      } catch (e) { /* se queda con el texto general */ }
    }
    return out
  }
  return null
}

export default async function middleware(request) {
  try {
    if (request.method !== 'GET') return seguir()
    const url = new URL(request.url)
    const hostCompleto = url.host.toLowerCase()
    const hostname = url.hostname.toLowerCase()
    const propio = esHostPropio(hostname)

    const link = await metaDeLink(url.pathname)
    // Dominio de Golmebol y no es un link con vista previa propia: pasa de largo.
    if (propio && !link) return seguir()

    const ident = propio ? null : await buscarIdentidad(hostname.replace(/^www\./, ''))
    if (!link && (!ident || !ident.titulo)) return seguir()

    // El index.html compilado (tiene punto: este middleware no lo intercepta).
    const base = await fetch(`${url.protocol}//${hostCompleto}/index.html`, { headers: { 'x-gm-interno': '1' } })
    if (!base.ok) return seguir()
    let html = await base.text()

    const sitio = ident?.titulo || 'Golmebol'
    const tituloPag = esc(link ? link.titulo : ident.titulo)
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${tituloPag}</title>`)
    if (ident?.icono) {
      const icono = esc(ident.icono)
      html = html.replace(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/gi, '')
      html = html.replace('</head>', `<link rel="icon" href="${icono}" />\n<link rel="apple-touch-icon" href="${icono}" />\n</head>`)
    }
    const imagen = (link && link.imagen) || ident?.imagen || `${url.origin}/icon-512.png`
    const descripcion = link ? link.descripcion : (ident.descripcion || '')
    const metas = [
      `<meta property="og:title" content="${tituloPag}" />`,
      `<meta property="og:site_name" content="${esc(sitio)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:url" content="${esc(url.origin + url.pathname)}" />`,
      `<meta name="twitter:card" content="summary" />`,
      `<meta name="twitter:title" content="${tituloPag}" />`,
      `<meta property="og:image" content="${esc(imagen)}" />`,
      `<meta name="twitter:image" content="${esc(imagen)}" />`,
    ]
    if (descripcion) {
      const d = esc(String(descripcion).slice(0, 200))
      metas.push(`<meta name="description" content="${d}" />`, `<meta property="og:description" content="${d}" />`, `<meta name="twitter:description" content="${d}" />`)
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
