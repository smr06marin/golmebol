// Edge Function: reset-arbitro-password
//
// El coordinador de árbitros (árbitro líder) o un admin le reinicia la contraseña a un ÁRBITRO que la
// olvidó: queda igual a su cédula y se le pide cambiarla al próximo ingreso (primer_ingreso = true),
// igual que el reseteo de jugadores del panel de admin.
//
// Seguridad: corre en el servidor (usa la Service Role Key, que nunca llega al navegador). El navegador
// solo manda el id del árbitro (player_id): la cédula y la cuenta se leen aquí de la base, nunca se
// confía en lo que mande el navegador. Solo puede llamarla un admin o un árbitro líder con sesión real,
// y solo sobre cuentas de árbitros (un coordinador no puede reiniciar a otro coordinador).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Falta autenticación' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseCaller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: caller }, error: callerError } = await supabaseCaller.auth.getUser()
    if (callerError || !caller || caller.is_anonymous) return json({ error: 'Sesión inválida' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    // ¿Quién llama? Admin (lista fija o rol admin activo) o árbitro líder.
    const email = (caller.email || '').toLowerCase()
    let esAdmin = !!email && ADMINS_PRINCIPALES.includes(email)
    if (!esAdmin && email) {
      const { data: rolRow } = await admin.from('roles_plataforma').select('rol, activo').eq('email', email).maybeSingle()
      esAdmin = !!rolRow && rolRow.rol === 'admin' && rolRow.activo !== false
    }
    let esLider = false
    if (!esAdmin) {
      const { data: yo } = await admin.from('players').select('id, es_arbitro_lider').eq('user_id', caller.id).eq('es_arbitro_lider', true).limit(1)
      esLider = !!(yo && yo.length)
    }
    if (!esAdmin && !esLider) return json({ error: 'No autorizado' }, 403)

    const { player_id } = await req.json()
    if (!player_id) return json({ error: 'Falta el árbitro' }, 400)

    const { data: arb, error: arbErr } = await admin.from('players')
      .select('id, name, user_id, numero_cedula, rol, es_arbitro, es_arbitro_lider').eq('id', player_id).maybeSingle()
    if (arbErr || !arb) return json({ error: 'Árbitro no encontrado' }, 404)
    if (!(arb.es_arbitro || arb.rol === 'arbitro')) return json({ error: 'Esa persona no es árbitro' }, 400)
    if (!arb.user_id) return json({ error: 'Este árbitro aún no tiene cuenta: usa "Activar"' }, 400)
    if (arb.es_arbitro_lider && !esAdmin && arb.user_id !== caller.id) return json({ error: 'Solo un admin puede reiniciar a otro coordinador' }, 403)
    const cedula = String(arb.numero_cedula || '').trim()
    if (cedula.length < 6) return json({ error: 'El árbitro no tiene una cédula válida registrada (mínimo 6 dígitos)' }, 400)

    const { error: updError } = await admin.auth.admin.updateUserById(arb.user_id, { password: cedula })
    if (updError) return json({ error: updError.message }, 400)
    await admin.from('players').update({ primer_ingreso: true }).eq('id', arb.id)

    return json({ ok: true, nombre: arb.name })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
