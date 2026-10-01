// Edge Function: reset-password-admin
//
// Permite que un ADMIN PRINCIPAL de Golmebol le cambie la contraseña a
// cualquier otra cuenta (organizador, árbitro, etc.) desde el panel de
// "Usuarios y permisos" — igual que ya se puede hacer con los jugadores
// (ver reset-player-password), pero sin depender de que a esa persona le
// llegue un correo y lo abra: útil cuando el organizador no revisa el
// correo o quedó sin acceso a él.
//
// Esto SOLO puede correr acá (en el servidor), nunca en el navegador: hace
// falta la Service Role Key de Supabase para poder cambiarle la contraseña
// a OTRA persona (auth.admin.updateUserById) — esa llave nunca se expone al
// código del sitio.
//
// Seguridad: antes de tocar nada, se verifica que quien llama (el token que
// manda en el header Authorization) sea de verdad un admin — ya sea de la
// lista fija ADMINS_PRINCIPALES, o con rol 'admin' activo en
// roles_plataforma. Si no, se rechaza con 403.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return json({ error: 'Falta autenticación' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente "normal" (con el token de quien llama) — solo para saber quién es.
    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user: caller }, error: callerError } = await supabaseCaller.auth.getUser()
    if (callerError || !caller?.email) return json({ error: 'Sesión inválida' }, 401)

    // Cliente con permisos de administrador (Service Role) — el único que
    // puede cambiar la contraseña de OTRA cuenta.
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const email = caller.email.toLowerCase()
    let esAdmin = ADMINS_PRINCIPALES.includes(email)
    if (!esAdmin) {
      const { data: rolRow } = await supabaseAdmin
        .from('roles_plataforma')
        .select('rol, activo')
        .eq('email', email)
        .maybeSingle()
      esAdmin = !!rolRow && rolRow.rol === 'admin' && rolRow.activo !== false
    }
    if (!esAdmin) return json({ error: 'No autorizado' }, 403)

    const { user_id, nueva_password } = await req.json()
    if (!user_id || !nueva_password || String(nueva_password).length < 6) {
      return json({ error: 'Datos inválidos (falta user_id o la contraseña es muy corta)' }, 400)
    }

    const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: String(nueva_password),
    })
    if (updError) return json({ error: updError.message }, 400)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})
