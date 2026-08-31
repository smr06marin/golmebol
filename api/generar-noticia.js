// Proxy del lado del servidor hacia la API de Anthropic (Claude), usado por
// AdminNoticiasPage.jsx para generar noticias del torneo con IA.
//
// Antes esto se llamaba DIRECTO desde el navegador con
// VITE_ANTHROPIC_API_KEY — cualquier prefijo VITE_ queda incluido en el
// código fuente que baja al navegador, así que la clave quedaba visible con
// solo abrir las herramientas de desarrollador (F12). Ahora la clave real
// (ANTHROPIC_API_KEY, SIN el prefijo VITE_) solo vive en las variables de
// entorno del servidor de Vercel y nunca viaja al navegador — esta función
// es la única que la usa.
//
// También exige que quien llame tenga una sesión válida de Supabase (el
// token que ya usa toda la app), para que este endpoint no quede abierto a
// que cualquiera en internet lo use y gaste el crédito de la cuenta.

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

async function usuarioValido(token) {
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido' } })
    return
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!(await usuarioValido(token))) {
    res.status(401).json({ error: { message: 'Sesión inválida — vuelve a ingresar e intenta de nuevo' } })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel' } })
    return
  }

  const { messages, maxTokens } = req.body || {}
  if (!messages) {
    res.status(400).json({ error: { message: 'Faltan los mensajes para la IA' } })
    return
  }

  try {
    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens || 600,
        messages,
      }),
    })
    const data = await respuesta.json()
    res.status(respuesta.status).json(data)
  } catch (e) {
    res.status(500).json({ error: { message: e.message } })
  }
}
