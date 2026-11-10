import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { registrarSesionDispositivo, marcarInicioLogin } from '../lib/deviceSession'
import { conTimeout } from '../lib/conTimeout'

const MSG_TIMEOUT = 'Esto está tardando demasiado. Revisa tu internet e intenta de nuevo.'
const MSG_CONEXION = 'No se pudo conectar. Revisa tu internet e intenta de nuevo.'
const msgFalla = (err) => (err?.message === 'TIMEOUT' ? MSG_TIMEOUT : MSG_CONEXION)
import BotonVolverLogin from '../components/BotonVolverLogin'
import { abrirChatAyuda } from '../lib/abrirChat'

// Letra del sistema (clara y grande): la fuente angosta de la app se leía muy chica en el celular de varias personas
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

// Oscuro y limpio, igual que el resto de los paneles de Golmebol: un solo color de acento (verde) y mucho aire.
const VERDE = '#6fcf3d'
const inp = {
  width: '100%', background: '#161616', border: '1.5px solid #333',
  borderRadius: '14px', padding: '16px', minHeight: '60px', color: '#fff',
  fontSize: '1.2rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
  fontFamily: FONT, transition: 'border-color .15s',
}
const lbl = { display: 'block', fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }
const foco  = e => { e.target.style.borderColor = VERDE }
const sinFoco = e => { e.target.style.borderColor = '#333' }
const btnGrande = (deshabilitado) => ({
  width: '100%', minHeight: '60px', padding: '16px', background: deshabilitado ? '#2a2a2a' : VERDE, border: 'none',
  borderRadius: '14px', cursor: deshabilitado ? 'not-allowed' : 'pointer', color: deshabilitado ? '#777' : '#0a1a05', fontWeight: 900,
  fontSize: '1.15rem', fontFamily: FONT,
})
const btnTexto = { background: 'none', border: 'none', cursor: 'pointer', color: '#8a8a8a', fontSize: '1rem', fontWeight: 600, fontFamily: FONT, padding: '12px 6px', textDecoration: 'underline' }

// Cédula recordada en este celular: así no hay que escribirla cada vez
const CLAVE_CEDULA = 'golmebol_jugador_cedula'
const leerCedulaGuardada = () => { try { return (localStorage.getItem(CLAVE_CEDULA) || '').replace(/\D/g, '') } catch { return '' } }
const guardarCedula = (c) => { try { const d = String(c || '').replace(/\D/g, ''); if (d) localStorage.setItem(CLAVE_CEDULA, d) } catch { /* sin almacenamiento: no se recuerda */ } }
const olvidarCedula = () => { try { localStorage.removeItem(CLAVE_CEDULA) } catch { /* nada */ } }

function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div role="alert" style={{ background: 'rgba(229,67,61,.14)', borderRadius: '12px', padding: '14px 16px', fontSize: '1rem', lineHeight: 1.4, color: '#ff8a80', fontWeight: 600 }}>
      {error}
    </div>
  )
}

// Campo de contraseña con botón para VER lo que se escribe
function CampoClave({ value, onChange, placeholder, autoComplete = 'current-password', autoFocus = false }) {
  const [ver, setVer] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={onChange} placeholder={placeholder} aria-label={placeholder} type={ver ? 'text' : 'password'} style={{ ...inp, paddingRight: '92px' }}
        autoComplete={autoComplete} autoFocus={autoFocus} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        onFocus={foco} onBlur={sinFoco}/>
      <button type="button" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', borderRadius: '10px', padding: '10px 12px', minHeight: '44px', color: VERDE, fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', fontFamily: FONT }}>
        {ver ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}

function ModalCambiarPass({ cedula, onCambiada }) {
  const [pass,    setPass]    = useState('')
  const [pass2,   setPass2]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleCambiar(e) {
    e.preventDefault()
    if (!pass || pass.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (pass !== pass2)           { setError('Las contraseñas no coinciden'); return }
    if (pass === cedula)          { setError('La nueva contraseña no puede ser tu cédula'); return }
    setLoading(true); setError('')
    try {
      await conTimeout((async () => {
        const { error: err } = await supabase.auth.updateUser({ password: pass })
        if (err) { setError('Error: ' + err.message); return }
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('players').update({ primer_ingreso: false }).eq('user_id', user.id)
        }
        onCambiada()
      })())
    } catch (e2) {
      setError(msgFalla(e2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)', fontFamily: FONT, WebkitTextSizeAdjust: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.4rem' }}>Crea tu contraseña</div>
          <div style={{ fontSize: '1.02rem', color: '#8a8a8a', marginTop: '8px', lineHeight: 1.45 }}>
            Por seguridad debes crear una contraseña personal antes de continuar
          </div>
        </div>
        <form onSubmit={handleCambiar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Nueva contraseña</label>
            <CampoClave value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" autoFocus/>
          </div>
          <div>
            <label style={lbl}>Confirmar contraseña</label>
            <CampoClave value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password"/>
          </div>
          <ErrorBox error={error}/>
          <button type="submit" disabled={loading}
            style={btnGrande(loading)}>
            {loading ? 'Guardando...' : 'Guardar y entrar →'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ModalRecuperarPass({ onClose }) {
  const [cedula,  setCedula]  = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error,   setError]   = useState('')

  async function handleRecuperar(e) {
    e.preventDefault()
    if (!cedula.trim()) { setError('Ingresa tu cédula'); return }
    setLoading(true); setError('')
    try {
      await conTimeout(supabase.auth.resetPasswordForEmail(`${cedula.trim()}@golmebol.com`, {
        redirectTo: `${window.location.origin}/jugador/login?reset=true`,
      }))
      setEnviado(true)
    } catch (err) {
      setError(msgFalla(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)', fontFamily: FONT, WebkitTextSizeAdjust: '100%' }}>
        {!enviado ? (
          <>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.4rem', marginBottom: '6px' }}>Recuperar contraseña</div>
            <div style={{ fontSize: '1.02rem', color: '#8a8a8a', marginBottom: '20px', lineHeight: 1.45 }}>Escribe tu cédula y te ayudamos a recuperar el acceso</div>
            <form onSubmit={handleRecuperar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Número de cédula</label>
                <input value={cedula} onChange={e => setCedula(e.target.value.replace(/\D/g, ''))} placeholder="Tu cédula" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" style={inp} autoFocus
                  onFocus={foco} onBlur={sinFoco}/>
              </div>
              <ErrorBox error={error}/>
              <button type="submit" disabled={loading} style={btnGrande(loading)}>
                {loading ? 'Buscando...' : 'Recuperar acceso'}
              </button>
              <button type="button" onClick={onClose} style={btnTexto}>Cancelar</button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: '1.4rem', marginBottom: '8px' }}>Escríbenos por el chat</div>
            <div style={{ fontSize: '1.02rem', color: '#8a8a8a', marginBottom: '20px', lineHeight: 1.5 }}>
              Dinos tu cédula <b>{cedula}</b> y te ayudamos a recuperar el acceso
            </div>
            <button type="button" onClick={() => { abrirChatAyuda(`Hola! Olvidé mi contraseña de PREDIX Golmebol. Mi cédula es ${cedula}. Ayúdenme a recuperar el acceso 🙏`); onClose() }}
              style={{ display: 'block', width: '100%', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: '16px', background: '#6fcf3d', borderRadius: '14px', color: '#0a1a05', fontWeight: 900, fontSize: '1.15rem', marginBottom: '10px' }}>
              💬 Abrir el chat de ayuda
            </button>
            <button onClick={onClose} style={btnTexto}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// A dónde va cada cuenta al terminar de entrar (jugador por defecto).
function rutaDeCuenta(p) {
  if (p?.es_arbitro_lider) return '/arbitro/lider'
  if (p?.rol === 'arbitro' && !p?.es_arbitro) return '/arbitro'
  if (p?.rol === 'profesor' || p?.es_profesor || p?.es_profesor_coordinador) return '/escuela'
  if (p?.es_encargado_escenario) return '/escenario'
  if (p?.es_acudiente) return '/acudiente'
  if (p?.es_jugador_escuela) return '/mi-tarjeta'
  return '/jugador'
}

// Baja el código de la pantalla de destino mientras todavía se está entrando (así no hay que esperarlo después).
// Es el mismo archivo que usa App.jsx con lazy(): el navegador lo descarga una sola vez.
function precargarDestino(ruta) {
  const cargar = {
    '/arbitro/lider': () => import('./ArbitroLiderPage'),
    '/arbitro': () => import('./ArbitroHomePage'),
    '/escuela': () => import('./EscuelaHomePage'),
    '/escenario': () => import('./EscenarioHomePage'),
    '/acudiente': () => import('./AcudientePage'),
    '/mi-tarjeta': () => import('./MiTarjetaEscuelaPage'),
    '/jugador': () => import('./PlayerHomePage'),
  }[ruta]
  if (cargar) cargar().catch(() => {})
}

export default function PlayerLoginPage() {
  const navigate = useNavigate()

  const [step,            setStep]            = useState('cedula')
  const [cedula,          setCedula]          = useState(() => leerCedulaGuardada())
  const [recordada]                              = useState(() => !!leerCedulaGuardada()) // la cédula ya estaba guardada en este celular
  const [entrandoAuto,    setEntrandoAuto]    = useState(() => !!leerCedulaGuardada()) // buscando la cuenta solita al abrir
  const [pass,            setPass]            = useState('')
  const [pass2,           setPass2]           = useState('')
  const [nombreVerif,     setNombreVerif]     = useState('') // nombre + primer apellido para verificar identidad
  const [player,          setPlayer]          = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [showRecuperar,   setShowRecuperar]   = useState(false)
  const [showCambiarPass, setShowCambiarPass] = useState(false)

  // Error "la función no existe todavía en la base" → se usa el camino de antes.
  const faltaFuncion = (err) => !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function/i.test(err.message || ''))

  // Camino anterior (lee `players` directo). Solo se usa si la base aún no tiene
  // las funciones login_buscar_cedula / login_verificar_nombre.
  async function buscarCedulaLegacy() {
      // OJO: no usamos .single() acá — si por algún motivo quedaron dos filas con
      // la misma cédula (bug conocido, ver migracion_fusionar_cedulas_duplicadas.sql),
      // .single() revienta con 0 resultados y la persona ve "cédula no registrada"
      // aunque sí exista. Con una lista simple tomamos la fila correcta a mano:
      // la que ya tenga cuenta de acceso creada manda; si ninguna la tiene, la más
      // completa (más roles marcados).
      // es_encargado_escenario es columna nueva (migracion_escenarios.sql); si
      // todavía no se corrió esa migración en Supabase, este select fallaría
      // para TODO el login de la plataforma — se reintenta sin esa columna.
      let { data: filas, error: errFilas } = await supabase
        .from('players')
        .select('id, name, user_id, primer_ingreso, rol, es_arbitro, es_arbitro_lider, es_profesor, es_profesor_coordinador, es_encargado_escenario, es_acudiente, es_jugador_escuela, equipo_deseado')
        .eq('numero_cedula', cedula.trim())
      if (errFilas) {
        ;({ data: filas } = await supabase
          .from('players')
          .select('id, name, user_id, primer_ingreso, rol, es_arbitro, es_arbitro_lider, es_profesor, es_profesor_coordinador, es_acudiente, es_jugador_escuela, equipo_deseado')
          .eq('numero_cedula', cedula.trim()))
      }
      const candidatas = filas || []
      let p = null
      if (candidatas.length === 1) {
        p = candidatas[0]
      } else if (candidatas.length > 1) {
        const puntaje = (x) => (x.user_id ? 100 : 0) + Number(!!x.es_arbitro) + Number(!!x.es_arbitro_lider) + Number(!!x.es_profesor) + Number(!!x.es_profesor_coordinador) + Number(!!x.es_encargado_escenario) + Number(!!x.es_acudiente) + Number(!!x.es_jugador_escuela)
        p = [...candidatas].sort((a, b) => puntaje(b) - puntaje(a))[0]
      }
      // Si el jugador existe pero aún no tiene cuenta, NO se muestra su nombre de
      // una vez: primero debe demostrar que es él escribiendo nombre y primer
      // apellido (si no, cualquiera con una cédula ajena podría crearse la cuenta).
      if (p) { setPlayer(p); if (p.user_id) setStep('login'); else setStep('verificar_nombre') }
      else {
        // No hay jugador con esa cédula — pero puede ser el DUEÑO de un
        // equipo (representante_cedula), registrado al crear el equipo sin
        // que nadie lo haya inscrito como jugador. Esa persona también debe
        // poder entrar y administrar su equipo, así que le creamos aquí
        // mismo un perfil mínimo con los datos que ya puso el organizador
        // (nombre/teléfono) y seguimos el mismo flujo de siempre (verificar
        // nombre y crear contraseña) como si fuera cualquier jugador nuevo.
        // Se busca por función (búsqueda exacta por esta cédula): la tabla de equipos ya no se puede leer
        // en bloque desde fuera. Con la base sin migrar, se usa la consulta de antes.
        let equipoDueno = null
        const rDueno = await supabase.rpc('dueno_equipo_por_cedula', { p_cedula: cedula.trim() })
        if (!rDueno.error) {
          equipoDueno = rDueno.data || null
        } else {
          const { data: legacy } = await supabase.from('teams')
            .select('name, representante_nombre, representante_telefono')
            .eq('representante_cedula', cedula.trim())
            .not('representante_nombre', 'is', null)
            .limit(1)
            .maybeSingle()
          equipoDueno = legacy || null
        }
        if (equipoDueno) {
          const { data: nuevo, error: errCrear } = await supabase.from('players').insert({
            name: equipoDueno.representante_nombre,
            telefono: equipoDueno.representante_telefono || null,
            numero_cedula: cedula.trim(),
            rol: 'jugador',
            activo_membresia: true,
            primer_ingreso: true,
            fecha_registro: new Date().toISOString(),
          }).select('id, name, user_id, primer_ingreso, rol, es_arbitro, es_arbitro_lider, es_profesor, es_profesor_coordinador, es_acudiente, es_jugador_escuela, equipo_deseado').single()
          if (!errCrear && nuevo) {
            setPlayer(nuevo)
            setStep('verificar_nombre')
            return
          }
        }
        // Golmebol es gratis y no pide autorización — pero solo puede entrar
        // quien YA está registrado como jugador o dueño de equipo.
        setStep('no_registrado')
      }
  }

  async function handleBuscarCedula(e) {
    e.preventDefault()
    await buscarCedula(cedula)
  }

  // Busca la cédula. Con una cédula recordada se llama sola al abrir la pantalla:
  // la persona solo tiene que escribir su contraseña.
  async function buscarCedula(cedulaBuscada, { auto = false } = {}) {
    const c = String(cedulaBuscada || '').trim()
    if (!c) { setError('Escribe tu número de cédula'); return }
    setLoading(true); setError('')
    try {
      await conTimeout((async () => {
        // La búsqueda se hace en el servidor: solo devuelve lo mínimo (si existe,
        // si ya tiene cuenta, sus roles y el PRIMER nombre). El nombre completo
        // solo se entrega después de verificar la identidad.
        const r = await supabase.rpc('login_buscar_cedula', { p_cedula: c })
        if (r.error) {
          if (faltaFuncion(r.error)) { await buscarCedulaLegacy(); return }
          throw r.error
        }
        const p = r.data
        if (p && p.encontrado) {
          setPlayer({ ...p, name: p.nombre_corto || '', user_id: p.tiene_cuenta ? 'tiene-cuenta' : null })
          setStep(p.tiene_cuenta ? 'login' : 'verificar_nombre')
        } else {
          if (auto) olvidarCedula()
          setStep('no_registrado')
        }
      })())
    } catch (err) {
      setError(msgFalla(err))
    } finally {
      setLoading(false)
      setEntrandoAuto(false)
    }
  }

  // Al abrir con una cédula recordada: se busca sola y se pasa directo a pedir la contraseña
  useEffect(() => {
    if (recordada && cedula) buscarCedula(cedula, { auto: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compara lo que escribió contra el nombre guardado (sin tildes ni mayúsculas)
  async function handleVerificarNombre(e) {
    e.preventDefault()
    const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim()
    const escrito  = normalizar(nombreVerif).split(/\s+/).filter(Boolean)
    if (escrito.length < 2) { setError('Escribe tu nombre y tu primer apellido'); return }
    setLoading(true); setError('')
    try {
      await conTimeout((async () => {
        let ok
        const r = await supabase.rpc('login_verificar_nombre', { p_cedula: cedula.trim(), p_nombre: nombreVerif })
        if (r.error) {
          if (!faltaFuncion(r.error)) throw r.error
          // Base sin migrar: comparación de antes, en el navegador
          const guardado = normalizar(player?.name).split(/\s+/).filter(Boolean)
          ok = escrito.every(palabra => guardado.includes(palabra))
        } else {
          ok = !!r.data?.ok
          if (ok && r.data.nombre) setPlayer(prev => ({ ...prev, name: r.data.nombre }))
        }
        if (!ok) { setError('Los datos no coinciden con el jugador registrado. Verifica tu nombre y primer apellido, o escríbenos por el chat de ayuda.'); return }
        setError('')
        setStep('crear_pass')
      })())
    } catch (err) {
      setError(msgFalla(err))
    } finally {
      setLoading(false)
    }
  }

  // Une la cuenta recién creada con el jugador (la función del servidor revisa que
  // el email de la sesión sea {cédula}@golmebol.com). Si no existe, camino de antes.
  async function vincularCuenta(playerId, userId) {
    const r = await supabase.rpc('vincular_auth_player', { p_player_id: playerId })
    if (r.error) await supabase.from('players').update({ user_id: userId }).eq('id', playerId)
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!pass.trim()) { setError('Ingresa tu contraseña'); return }
    setLoading(true); setError('')
    marcarInicioLogin()
    try {
      // Cualquier falla de red/conexión a mitad de camino (o una conexión
      // muy lenta que se queda colgada) no puede dejar el botón trabado en
      // "Ingresando..." para siempre — por eso todo esto va con un límite de
      // tiempo (conTimeout): si pasa, se avisa y se libera el botón.
      await conTimeout((async () => {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: `${cedula.trim()}@golmebol.com`, password: pass })
        if (authError) { setError('Contraseña incorrecta'); return }
        // Mientras se verifica lo demás, ya se va bajando la pantalla de destino.
        const ruta = rutaDeCuenta(player)
        precargarDestino(ruta)
        // Golmebol es gratis: con contraseña correcta y cédula ya registrada, entra directo.
        // `primer_ingreso` ya vino en la búsqueda de la cédula: solo si parece primer ingreso se confirma en la base
        // (antes se consultaba SIEMPRE, una ida y vuelta más en cada entrada).
        if (player?.primer_ingreso !== false) {
          const { data: pActual } = await supabase.from('players').select('primer_ingreso').eq('id', player.id).single()
          if (pActual?.primer_ingreso !== false) {
            setShowCambiarPass(true)
            return
          }
        }
        // Sin pantalla de bienvenida para nadie: se entra de una. La sesión del dispositivo se reclama por detrás
        // (SessionGuard ya espera ese instante, no expulsa a quien acaba de entrar).
        guardarCedula(cedula)
        registrarSesionDispositivo(player.id).catch(() => {})
        navigate(ruta)
      })())
    } catch (err) {
      setError(msgFalla(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCrearCuenta(e) {
    e.preventDefault()
    if (!pass.trim() || pass.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    marcarInicioLogin()
    const email = `${cedula.trim()}@golmebol.com`
    try {
      await conTimeout((async () => {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: pass })
      if (authError) {
        // "User already registered" pasa cuando quedó una cuenta huérfana de un
        // intento anterior (por ejemplo si algo falló justo después de crearla
        // y nunca se vinculó a este jugador). En vez de dejar a la persona
        // atascada pidiendo lo mismo una y otra vez, probamos iniciar sesión
        // con la misma contraseña que acaba de escribir — si es la cuenta que
        // ella misma creó antes, entra directo y queda vinculada.
        const msg = (authError.message || '').toLowerCase()
        if (msg.includes('already registered') || msg.includes('ya existe') || msg.includes('already exists')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass })
          if (signInError || !signInData?.user) {
            setError('Ya existe una cuenta con esta cédula pero no coincide con esta contraseña. Si ya la habías creado antes, usa esa contraseña, o escríbenos por el chat de ayuda para restablecerla.')
            return
          }
          if (!player.user_id) await vincularCuenta(player.id, signInData.user.id)
          guardarCedula(cedula)
          registrarSesionDispositivo(player.id).catch(() => {})
          navigate(rutaDeCuenta(player))
          return
        }
        setError('Error: ' + authError.message)
        return
      }
      await vincularCuenta(player.id, authData.user.id)
      guardarCedula(cedula)
      registrarSesionDispositivo(player.id).catch(() => {})
      navigate(rutaDeCuenta(player))
      })())
    } catch (err) {
      setError(msgFalla(err))
    } finally {
      setLoading(false)
    }
  }

  const volver = () => {
    olvidarCedula()   // «usar otra cédula»: ya no se recuerda la anterior
    setStep('cedula'); setPass(''); setPass2(''); setError('')
    setNombreVerif(''); setPlayer(null); setCedula('')
  }

  // Campo oculto con la cédula: así el celular (Chrome, Samsung, iPhone) puede guardar y completar usuario + contraseña solo
  const campoUsuarioOculto = (
    <input type="text" name="username" autoComplete="username" value={cedula} readOnly tabIndex={-1} aria-hidden="true"
      style={{ position: 'absolute', opacity: 0, height: 0, width: 0, border: 0, padding: 0, pointerEvents: 'none' }}/>
  )
  const Titulo = ({ children }) => <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-.02em', lineHeight: 1.15, margin: '0 0 10px', color: '#fff' }}>{children}</h1>
  const Sub = ({ children }) => <p style={{ fontSize: '1.05rem', color: '#8a8a8a', lineHeight: 1.5, margin: '0 0 28px' }}>{children}</p>
  const formStyle = { display: 'flex', flexDirection: 'column', gap: '14px' }
  const ayudaChat = (mensaje) => abrirChatAyuda(mensaje, { nombre: player?.name || '' })

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', justifyContent: 'center', padding: '110px 22px 40px', boxSizing: 'border-box', fontFamily: FONT, WebkitTextSizeAdjust: '100%', textSizeAdjust: '100%', color: '#fff' }}>
      <BotonVolverLogin tema="oscuro"/>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {showCambiarPass && (
          <ModalCambiarPass cedula={cedula} onCambiada={async () => {
            setShowCambiarPass(false)
            guardarCedula(cedula)
            registrarSesionDispositivo(player.id).catch(() => {})
            navigate(rutaDeCuenta(player))
          }}/>
        )}
        {showRecuperar && <ModalRecuperarPass onClose={() => setShowRecuperar(false)}/>}

        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: VERDE, marginBottom: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>⚽</span> Golmebol
        </div>

        {entrandoAuto && (
          <div>
            <Titulo>Buscando tu cuenta…</Titulo>
            <Sub>Un momento</Sub>
          </div>
        )}

        {!entrandoAuto && step === 'cedula' && (
          <>
            <Titulo>Entra con tu cédula</Titulo>
            <Sub>Escribe solo los números.</Sub>
            <form onSubmit={handleBuscarCedula} style={formStyle}>
              <input id="cedula-jugador" name="username" aria-label="Número de cédula" value={cedula} onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
                placeholder="Número de cédula" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={15}
                style={{ ...inp, fontSize: '1.4rem', letterSpacing: '1px', minHeight: '64px' }} onFocus={foco} onBlur={sinFoco}/>
              <ErrorBox error={error}/>
              <button type="submit" disabled={loading} style={btnGrande(loading)}>{loading ? 'Buscando…' : 'Continuar'}</button>
            </form>
          </>
        )}

        {!entrandoAuto && step === 'login' && (
          <>
            <Titulo>Hola{player?.name ? `, ${player.name}` : ''}</Titulo>
            <Sub>Cédula {cedula} · <button type="button" onClick={volver} style={{ ...btnTexto, padding: 0, fontSize: 'inherit' }}>No soy yo</button></Sub>
            <form onSubmit={handleLogin} style={formStyle}>
              {campoUsuarioOculto}
              <CampoClave value={pass} onChange={e => setPass(e.target.value)} placeholder="Contraseña" autoFocus/>
              <ErrorBox error={error}/>
              <button type="submit" disabled={loading} style={btnGrande(loading)}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button type="button" onClick={() => setShowRecuperar(true)} style={btnTexto}>¿Olvidaste tu contraseña?</button>
            </div>
          </>
        )}

        {!entrandoAuto && step === 'verificar_nombre' && (
          <>
            <Titulo>Confirma que eres tú</Titulo>
            <Sub>Escribe tu nombre y primer apellido, como te registraron.</Sub>
            <form onSubmit={handleVerificarNombre} style={formStyle}>
              <input aria-label="Nombre y primer apellido" value={nombreVerif} onChange={e => setNombreVerif(e.target.value)} placeholder="Ej: Juan Pérez" type="text" style={inp} autoFocus autoComplete="name"
                onFocus={foco} onBlur={sinFoco}/>
              <ErrorBox error={error}/>
              <button type="submit" style={btnGrande(false)}>Continuar</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              {error && <button type="button" onClick={() => ayudaChat(`Hola! Estoy intentando activar mi cuenta de Golmebol con la cédula ${cedula} pero no me deja verificar mi nombre. ¿Me ayudan? 🙏`)} style={btnTexto}>Pedir ayuda por el chat</button>}
              <button type="button" onClick={volver} style={btnTexto}>Usar otra cédula</button>
            </div>
          </>
        )}

        {!entrandoAuto && step === 'crear_pass' && (
          <>
            <Titulo>Crea tu contraseña</Titulo>
            <Sub>Listo, {player?.name}. Mínimo 6 caracteres.</Sub>
            <form onSubmit={handleCrearCuenta} style={formStyle}>
              {campoUsuarioOculto}
              <CampoClave value={pass} onChange={e => setPass(e.target.value)} placeholder="Contraseña" autoComplete="new-password" autoFocus/>
              <CampoClave value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password"/>
              <ErrorBox error={error}/>
              <button type="submit" disabled={loading} style={btnGrande(loading)}>{loading ? 'Creando…' : 'Crear cuenta y entrar'}</button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button type="button" onClick={volver} style={btnTexto}>Volver</button>
            </div>
          </>
        )}

        {!entrandoAuto && step === 'no_registrado' && (
          <>
            <Titulo>No encontramos tu cédula</Titulo>
            <Sub>La cédula {cedula} no está registrada. Pídele a tu equipo que te inscriba con su link de registro.</Sub>
            <button type="button" onClick={volver} style={btnGrande(false)}>Probar con otra cédula</button>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button type="button" onClick={() => ayudaChat(`Hola! Mi cédula ${cedula} no aparece registrada en Golmebol. ¿Me ayudan a quedar inscrito? 🙏`)} style={btnTexto}>Necesito ayuda</button>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '.85rem', padding: '12px', fontFamily: FONT }}>Acceso administrador</button>
        </div>
      </div>
    </div>
  )
}
