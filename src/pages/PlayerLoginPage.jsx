import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SponsorSplash from '../components/card/SponsorSplash'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

const inp = {
  width: '100%', background: '#fff', border: '1.5px solid #dadce0',
  borderRadius: '10px', padding: '12px 14px', color: '#202124',
  fontSize: '.95rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif', transition: 'border-color .15s',
}

const WA_LINK = (texto) =>
  `https://wa.me/573226490055?text=${encodeURIComponent(texto)}`

function ErrorBox({ error }) {
  if (!error) return null
  return (
    <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025' }}>
      {error}
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
    const { error: err } = await supabase.auth.updateUser({ password: pass })
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('players').update({ primer_ingreso: false }).eq('user_id', user.id)
    }
    setLoading(false)
    onCambiada()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔐</div>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem' }}>Crea tu contraseña</div>
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '6px', lineHeight: 1.5 }}>
            Por seguridad debes crear una contraseña personal antes de continuar
          </div>
        </div>
        <form onSubmit={handleCambiar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Nueva contraseña</label>
            <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={inp} autoFocus
              onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Confirmar contraseña</label>
            <input value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repite la contraseña" type="password" style={inp}
              onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
          </div>
          {error && <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ padding: '12px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.95rem' }}>
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
    await supabase.auth.resetPasswordForEmail(`${cedula.trim()}@golmebol.com`, {
      redirectTo: `${window.location.origin}/jugador/login?reset=true`,
    })
    setLoading(false)
    setEnviado(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        {!enviado ? (
          <>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>Recuperar contraseña</div>
            <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '20px' }}>Escribe tu cédula y te ayudamos a recuperar el acceso</div>
            <form onSubmit={handleRecuperar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Número de cédula</label>
                <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Tu cédula" type="number" style={inp} autoFocus
                  onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
              </div>
              {error && <div style={{ background: '#fce8e6', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025' }}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{ padding: '12px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.9rem' }}>
                {loading ? 'Buscando...' : 'Recuperar acceso'}
              </button>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.8rem' }}>Cancelar</button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📲</div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '8px' }}>Escríbenos por WhatsApp</div>
            <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '20px', lineHeight: 1.5 }}>
              Dinos tu cédula <b>{cedula}</b> y te ayudamos a recuperar el acceso
            </div>
            <a href={WA_LINK(`Hola! Olvidé mi contraseña de PREDIX Golmebol. Mi cédula es ${cedula}. Ayúdenme a recuperar el acceso 🙏`)}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '12px', background: '#25d366', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', textDecoration: 'none', marginBottom: '10px' }}>
              📲 Escribir a Golmebol
            </a>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.78rem' }}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayerLoginPage() {
  const navigate = useNavigate()

  const [step,            setStep]            = useState('cedula')
  const [cedula,          setCedula]          = useState('')
  const [pass,            setPass]            = useState('')
  const [pass2,           setPass2]           = useState('')
  const [nombreVerif,     setNombreVerif]     = useState('') // nombre + primer apellido para verificar identidad
  const [player,          setPlayer]          = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [showRecuperar,   setShowRecuperar]   = useState(false)
  const [showCambiarPass, setShowCambiarPass] = useState(false)
  const [splash,          setSplash]          = useState(null)

  async function fetchSplashData(playerId) {
    const { data: p } = await supabase.from('players').select('card_type').eq('id', playerId).single()
    const cardType   = p?.card_type || 'nivel1_verde'
    const cardDesign = CARD_DESIGNS.find(d => d.id === cardType)
    const { data: sponsor } = await supabase.from('sponsors').select('*').eq('card_id', cardType).eq('activo', true).single()
    return {
      sponsor:    sponsor || null,
      cardColor:  cardDesign?.color  || '#00ee55',
      cardNombre: cardDesign?.nombre || 'EL DEBUT',
      cardType,
    }
  }

  async function handleBuscarCedula(e) {
    e.preventDefault()
    if (!cedula.trim()) { setError('Ingresa tu número de cédula'); return }
    setLoading(true); setError('')
    // OJO: no usamos .single() acá — si por algún motivo quedaron dos filas con
    // la misma cédula (bug conocido, ver migracion_fusionar_cedulas_duplicadas.sql),
    // .single() revienta con 0 resultados y la persona ve "cédula no registrada"
    // aunque sí exista. Con una lista simple tomamos la fila correcta a mano:
    // la que ya tenga cuenta de acceso creada manda; si ninguna la tiene, la más
    // completa (más roles marcados).
    const { data: filas } = await supabase
      .from('players')
      .select('id, name, user_id, primer_ingreso, rol, es_arbitro, es_arbitro_lider, es_profesor, es_profesor_coordinador, es_acudiente, es_jugador_escuela, equipo_deseado')
      .eq('numero_cedula', cedula.trim())
    setLoading(false)
    const candidatas = filas || []
    let p = null
    if (candidatas.length === 1) {
      p = candidatas[0]
    } else if (candidatas.length > 1) {
      const puntaje = (x) => (x.user_id ? 100 : 0) + Number(!!x.es_arbitro) + Number(!!x.es_arbitro_lider) + Number(!!x.es_profesor) + Number(!!x.es_profesor_coordinador) + Number(!!x.es_acudiente) + Number(!!x.es_jugador_escuela)
      p = [...candidatas].sort((a, b) => puntaje(b) - puntaje(a))[0]
    }
    // Si el jugador existe pero aún no tiene cuenta, NO se muestra su nombre de
    // una vez: primero debe demostrar que es él escribiendo nombre y primer
    // apellido (si no, cualquiera con una cédula ajena podría crearse la cuenta).
    if (p) { setPlayer(p); if (p.user_id) setStep('login'); else setStep('verificar_nombre') }
    else {
      // Golmebol es gratis y no pide autorización — pero solo puede entrar
      // quien YA está registrado como jugador (por su equipo o por Golmebol).
      // Si la cédula no existe en players, no se deja crear cuenta desde acá.
      setStep('no_registrado')
    }
  }

  // Compara lo que escribió contra el nombre guardado (sin tildes ni mayúsculas)
  function handleVerificarNombre(e) {
    e.preventDefault()
    const normalizar = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim()
    const escrito  = normalizar(nombreVerif).split(/\s+/).filter(Boolean)
    const guardado = normalizar(player?.name).split(/\s+/).filter(Boolean)
    if (escrito.length < 2) { setError('Escribe tu nombre y tu primer apellido'); return }
    const coincide = escrito.every(palabra => guardado.includes(palabra))
    if (!coincide) { setError('Los datos no coinciden con el jugador registrado. Verifica tu nombre y primer apellido, o escríbenos por WhatsApp.'); return }
    setError('')
    setStep('crear_pass')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!pass.trim()) { setError('Ingresa tu contraseña'); return }
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: `${cedula.trim()}@golmebol.com`, password: pass })
    if (authError) { setError('Contraseña incorrecta'); setLoading(false); return }
    // Golmebol es gratis: ya no se revisa membresía activa ni verificación
    // manual — con contraseña correcta y cédula ya registrada, entra directo.
    const { data: pActual } = await supabase.from('players').select('primer_ingreso').eq('id', player.id).single()
    if (pActual?.primer_ingreso !== false) {
      setLoading(false)
      setShowCambiarPass(true)
      return
    }
    const splashData = await fetchSplashData(player.id)
    setLoading(false)
    setSplash(splashData)
  }

  async function handleCrearCuenta(e) {
    e.preventDefault()
    if (!pass.trim() || pass.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (pass !== pass2) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    const email = `${cedula.trim()}@golmebol.com`
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
          setError('Ya existe una cuenta con esta cédula pero no coincide con esta contraseña. Si ya la habías creado antes, usa esa contraseña, o escríbenos por WhatsApp para restablecerla.')
          setLoading(false)
          return
        }
        if (!player.user_id) await supabase.from('players').update({ user_id: signInData.user.id }).eq('id', player.id)
        const splashData = await fetchSplashData(player.id)
        setLoading(false)
        setSplash(splashData)
        return
      }
      setError('Error: ' + authError.message)
      setLoading(false)
      return
    }
    await supabase.from('players').update({ user_id: authData.user.id }).eq('id', player.id)
    const splashData = await fetchSplashData(player.id)
    setLoading(false)
    setSplash(splashData)
  }

  const volver = () => {
    setStep('cedula'); setPass(''); setPass2(''); setError('')
    setNombreVerif(''); setPlayer(null)
  }

  // Mostrar splash
  if (splash) return (
    <SponsorSplash
      cardType={splash.cardType}
      sponsor={splash.sponsor}
      cardColor={splash.cardColor}
      cardNombre={splash.cardNombre}
      onDone={() => {
        if (player?.es_arbitro_lider) navigate('/arbitro/lider')
        else if (player?.rol === 'arbitro' && !player?.es_arbitro) navigate('/arbitro')
        else if (player?.rol === 'profesor' || player?.es_profesor || player?.es_profesor_coordinador) navigate('/escuela')
        else if (player?.es_acudiente) navigate('/acudiente')
        else if (player?.es_jugador_escuela) navigate('/mi-tarjeta')
        else navigate('/jugador')
      }}
    />
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {showCambiarPass && (
          <ModalCambiarPass cedula={cedula} onCambiada={async () => {
            setShowCambiarPass(false)
            const splashData = await fetchSplashData(player.id)
            setSplash(splashData)
          }}/>
        )}

        {showRecuperar && <ModalRecuperarPass onClose={() => setShowRecuperar(false)}/>}

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: '#1a73e8', marginBottom: '14px' }}>
            <span style={{ fontSize: '1.8rem' }}>⚽</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#202124', letterSpacing: '.02em' }}>Golmebol</div>
          <div style={{ fontSize: '.85rem', color: '#5f6368', marginTop: '4px' }}>Portal del Jugador</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,.1), 0 4px 16px rgba(0,0,0,.06)' }}>

          {step === 'cedula' && (
            <>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '4px' }}>Bienvenido</div>
              <div style={{ fontSize: '.82rem', color: '#5f6368', marginBottom: '24px' }}>Ingresa tu cédula para continuar</div>
              <form onSubmit={handleBuscarCedula} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Número de cédula</label>
                  <input value={cedula} onChange={e => setCedula(e.target.value)} placeholder="Ej: 1094948981" type="number" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                <ErrorBox error={error}/>
                <button type="submit" disabled={loading}
                  style={{ marginTop: '4px', padding: '12px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.95rem' }}>
                  {loading ? 'Buscando...' : 'Continuar →'}
                </button>
              </form>
            </>
          )}

          {step === 'login' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>👤</div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.95rem' }}>{player?.name}</div>
                  <div style={{ fontSize: '.75rem', color: '#5f6368' }}>Cédula {cedula}</div>
                </div>
              </div>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Contraseña</label>
                  <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Tu contraseña" type="password" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'} autoFocus/>
                </div>
                <ErrorBox error={error}/>
                <button type="submit" disabled={loading}
                  style={{ marginTop: '4px', padding: '12px', background: loading ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.95rem' }}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
                <button type="button" onClick={() => setShowRecuperar(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: '.8rem', textDecoration: 'underline' }}>
                  ¿Olvidaste tu contraseña?
                </button>
                <button type="button" onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Usar otra cédula</button>
              </form>
            </>
          )}

          {step === 'verificar_nombre' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🛡️</div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.95rem' }}>¡Ya estás registrado!</div>
                  <div style={{ fontSize: '.75rem', color: '#5f6368' }}>Cédula {cedula}</div>
                </div>
              </div>
              <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '20px', background: '#f8f9fa', borderRadius: '8px', padding: '10px 12px', lineHeight: 1.5 }}>
                Para verificar que eres tú, escribe tu <b>nombre y primer apellido</b> tal como te registraron.
              </div>
              <form onSubmit={handleVerificarNombre} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Nombre y primer apellido</label>
                  <input value={nombreVerif} onChange={e => setNombreVerif(e.target.value)} placeholder="Ej: Juan Pérez" type="text" style={inp} autoFocus
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                {error && (
                  <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '10px 12px', fontSize: '.82rem', color: '#d93025' }}>
                    {error}
                    <a href={WA_LINK(`Hola! Estoy intentando activar mi cuenta de Golmebol con la cédula ${cedula} pero no me deja verificar mi nombre. ¿Me ayudan? 🙏`)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: '#25d366', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '.8rem', textDecoration: 'none', marginTop: '10px' }}>
                      📲 Escribir a Golmebol
                    </a>
                  </div>
                )}
                <button type="submit"
                  style={{ marginTop: '4px', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '600', fontSize: '.95rem' }}>
                  Verificar →
                </button>
                <button type="button" onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Usar otra cédula</button>
              </form>
            </>
          )}

          {step === 'crear_pass' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>✅</div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.95rem' }}>{player?.name}</div>
                  <div style={{ fontSize: '.75rem', color: '#1e8e3e', fontWeight: '500' }}>Identidad verificada · Crea tu contraseña</div>
                </div>
              </div>
              <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '12px', background: '#f8f9fa', borderRadius: '8px', padding: '10px 12px' }}>
                Tu perfil ya existe. Crea una contraseña para acceder al portal.
              </div>
              <a href={WA_LINK(`Hola! Soy ${player?.name}, cédula ${cedula}. Estoy activando mi cuenta de Golmebol ✅`)}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: '#e6f9ee', border: '1px solid #b7e4c7', borderRadius: '8px', color: '#128c4b', fontWeight: '700', fontSize: '.78rem', textDecoration: 'none', marginBottom: '20px' }}>
                📲 Avisar a Golmebol por WhatsApp (con mis datos guardados)
              </a>
              <form onSubmit={handleCrearCuenta} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Contraseña</label>
                  <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'} autoFocus/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Confirmar contraseña</label>
                  <input value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repite la contraseña" type="password" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                <ErrorBox error={error}/>
                <button type="submit" disabled={loading}
                  style={{ marginTop: '4px', padding: '12px', background: loading ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '600', fontSize: '.95rem' }}>
                  {loading ? 'Creando cuenta...' : 'Crear cuenta y entrar'}
                </button>
                <button type="button" onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Volver</button>
              </form>
            </>
          )}

          {step === 'no_registrado' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>🔍</div>
              <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem', marginBottom: '8px' }}>Cédula no registrada</div>
              <div style={{ fontSize: '.82rem', color: '#5f6368', lineHeight: 1.6, marginBottom: '16px' }}>
                La cédula <b>{cedula}</b> no está registrada como jugador en Golmebol. Golmebol es gratis y no pide autorización, pero solo puede entrar quien ya esté inscrito por su equipo o por Golmebol.
              </div>
              <div style={{ background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '12px 14px', fontSize: '.78rem', color: '#5f6368', marginBottom: '16px', lineHeight: 1.5, textAlign: 'left' }}>
                📋 Pídele a tu equipo que te inscriba con el link de registro, o escríbenos por WhatsApp para que te ayudemos.
              </div>
              <a href={WA_LINK(`Hola! Mi cédula ${cedula} no aparece registrada en Golmebol. ¿Me ayudan a quedar inscrito? 🙏`)}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: '#25d366', borderRadius: '12px', color: '#fff', fontWeight: '800', fontSize: '.95rem', textDecoration: 'none', marginBottom: '10px' }}>
                📲 Escribir a Golmebol por WhatsApp
              </a>
              <button onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Usar otra cédula</button>
            </div>
          )}

        </div>

        <button onClick={() => navigate('/login')}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.75rem' }}>
          Acceso administrador →
        </button>
      </div>
    </div>
  )
}
