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

function ErrorBox({ error, waTexto }) {
  if (!error) return null
  if (error === 'pendiente_verificacion') {
    return (
      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px', padding: '14px 16px' }}>
        <div style={{ fontWeight: '700', color: '#e8710a', fontSize: '.85rem', marginBottom: '6px' }}>
          ⏳ Tu cuenta está pendiente de verificación
        </div>
        <div style={{ fontSize: '.78rem', color: '#8a5a00', marginBottom: '12px', lineHeight: 1.5 }}>
          Para activarla, envíanos por WhatsApp tu nombre completo, cédula y el equipo en el que juegas. Apenas te verifiquemos podrás entrar.
        </div>
        <a href={WA_LINK(waTexto || 'Hola! Quiero verificar mi cuenta de Golmebol ✅')}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: '#25d366', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', textDecoration: 'none' }}>
          📲 Enviar mensaje de verificación
        </a>
      </div>
    )
  }
  if (error === 'membresia_inactiva' || error === 'membresia_vencida') {
    return (
      <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '12px', padding: '14px 16px' }}>
        <div style={{ fontWeight: '700', color: '#d93025', fontSize: '.85rem', marginBottom: '6px' }}>
          ⛔ {error === 'membresia_vencida' ? 'Tu membresía venció' : 'Tu membresía no está activa'}
        </div>
        <div style={{ fontSize: '.78rem', color: '#c5221f', marginBottom: '12px' }}>
          Escríbenos por WhatsApp y te reactivamos rápido 👇
        </div>
        <a href={WA_LINK('Hola! Quiero reactivar mi membresía de PREDIX Golmebol 🎯')}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: '#25d366', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', textDecoration: 'none' }}>
          📲 Escribir a Golmebol por WhatsApp
        </a>
      </div>
    )
  }
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
  const [nombre,          setNombre]          = useState('')
  const [whatsapp,        setWhatsapp]        = useState('')
  const [equipo,          setEquipo]          = useState('')
  const [nombreVerif,     setNombreVerif]     = useState('') // nombre + primer apellido para verificar identidad
  const [duenoDe,         setDuenoDe]         = useState(null) // equipo del que esta cédula es dueña
  const [player,          setPlayer]          = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [showPromo,       setShowPromo]       = useState(false)
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
    const { data: p } = await supabase
      .from('players')
      .select('id, name, activo_membresia, fecha_vencimiento, user_id, primer_ingreso, rol, es_arbitro, es_arbitro_lider, equipo_deseado')
      .eq('numero_cedula', cedula.trim())
      .single()
    setLoading(false)
    // Si el jugador existe pero aún no tiene cuenta, NO se muestra su nombre de
    // una vez: primero debe demostrar que es él escribiendo nombre y primer
    // apellido (si no, cualquiera con una cédula ajena podría crearse la cuenta).
    if (p) { setPlayer(p); if (p.user_id) setStep('login'); else setStep('verificar_nombre') }
    else {
      // ¿Esta cédula es DUEÑA de algún equipo? Sus datos ya están guardados:
      // se precargan para que no los vuelva a escribir.
      try {
        const { data: eq } = await supabase.from('teams')
          .select('name, representante_nombre, representante_telefono, created_at')
          .eq('representante_cedula', cedula.trim()).limit(1).maybeSingle()
        if (eq) {
          setDuenoDe(eq)
          if (eq.representante_nombre)  setNombre(eq.representante_nombre)
          if (eq.representante_telefono) setWhatsapp(eq.representante_telefono)
          setEquipo(eq.name)
        } else setDuenoDe(null)
      } catch (e) { setDuenoDe(null) }
      setShowPromo(true)
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
    const { data: pActual } = await supabase.from('players').select('activo_membresia, fecha_vencimiento, primer_ingreso, rol, es_arbitro, es_arbitro_lider, verificado').eq('id', player.id).single()
    if (pActual?.verificado === false) { await supabase.auth.signOut(); setError('pendiente_verificacion'); setLoading(false); return }
    if (!pActual?.activo_membresia) { await supabase.auth.signOut(); setError('membresia_inactiva'); setLoading(false); return }
    if (pActual.fecha_vencimiento && new Date(pActual.fecha_vencimiento) < new Date()) { await supabase.auth.signOut(); setError('membresia_vencida'); setLoading(false); return }
    if (pActual.primer_ingreso !== false) {
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
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: `${cedula.trim()}@golmebol.com`, password: pass })
    if (authError) { setError('Error: ' + authError.message); setLoading(false); return }
    await supabase.from('players').update({ user_id: authData.user.id }).eq('id', player.id)
    if (!player.activo_membresia) { await supabase.auth.signOut(); setError('membresia_inactiva'); setLoading(false); return }
    const splashData = await fetchSplashData(player.id)
    setLoading(false)
    setSplash(splashData)
  }

  async function handleRegistro(e) {
    e.preventDefault()
    if (!nombre.trim())                    { setError('Ingresa tu nombre'); return }
    if (!whatsapp.trim())                  { setError('Ingresa tu WhatsApp'); return }
    if (!pass.trim() || pass.length < 6)  { setError('Mínimo 6 caracteres'); return }
    // Verificar que el WhatsApp no esté registrado
    const { data: yaExiste } = await supabase.from('players').select('id').eq('whatsapp', whatsapp.trim()).single()
    if (yaExiste) { setError('Este número de WhatsApp ya está registrado en otro jugador'); setLoading(false); return }
    if (pass !== pass2)                    { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: `${cedula.trim()}@golmebol.com`, password: pass })
    if (authError) { setError('Error: ' + authError.message); setLoading(false); return }
    // Los registros nuevos quedan PENDIENTES de verificación por WhatsApp:
    // el jugador debe enviarnos nombre, cédula y equipo, y el admin lo aprueba
    // manualmente en Admin > Jugadores. Hasta entonces no puede entrar.
    const { data: nuevoPlayer, error: playerError } = await supabase.from('players').insert({
      user_id: authData.user?.id, name: nombre.trim(), numero_cedula: cedula.trim(),
      whatsapp: whatsapp.trim(), equipo_deseado: equipo.trim() || null, verificado: false,
      activo_membresia: true, primer_ingreso: false, fecha_registro: new Date().toISOString(),
    }).select().single()
    if (playerError) { setError('Error al crear perfil: ' + playerError.message); setLoading(false); return }
    await supabase.auth.signOut() // no entra hasta que el admin lo verifique
    setPlayer(nuevoPlayer)
    setLoading(false)
    setStep('verificar')
  }

  const volver = () => {
    setStep('cedula'); setPass(''); setPass2(''); setError('')
    setNombre(''); setWhatsapp(''); setEquipo(''); setNombreVerif(''); setPlayer(null); setShowPromo(false); setDuenoDe(null)
  }

  // Mensaje de WhatsApp con los datos que el admin necesita para verificar
  const textoVerificacion = (nom, ced, eq) =>
    `Hola! Quiero verificar mi cuenta de Golmebol ✅\nNombre: ${nom}\nCédula: ${ced}\nEquipo: ${eq || 'Ninguno — solo quiero PREDIX'}`

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

        {showPromo && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ width: '100%', maxWidth: '400px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div style={{ background: '#07070e', padding: '28px 24px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#00ddd0', letterSpacing: '3px', marginBottom: '8px' }}>PREDIX · GOLMEBOL</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'rgba(255,255,255,.7)' }}>Predice · Compite · Gana</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #1a73e8, #6c35de)', padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: 'rgba(255,255,255,.7)', letterSpacing: '2px', marginBottom: '4px' }}>🎯 PRIMER MES GRATIS</div>
                <div style={{ fontSize: '3.2rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '4px' }}>$50.000</div>
                <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.8)' }}>para el 1er puesto del ranking mensual</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #e8710a, #f9a825)', padding: '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '.75rem', fontWeight: '700', color: 'rgba(255,255,255,.85)', letterSpacing: '2px', marginBottom: '4px' }}>🏆 PLAN MENSUAL · $10.000</div>
                <div style={{ fontSize: '3.2rem', fontWeight: '900', color: '#fff', lineHeight: 1, marginBottom: '4px' }}>$500.000</div>
                <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.9)', fontWeight: '600' }}>3 ganadores cada mes</div>
                <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.7)', marginTop: '2px' }}>$500K · $300K · $200K</div>
              </div>
              <div style={{ background: '#07070e', padding: '20px 24px' }}>
                <div style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem' }}>🎁</span>
                  <div>
                    <div style={{ fontSize: '.82rem', fontWeight: '700', color: '#00ddd0' }}>¡Tu primer mes es GRATIS!</div>
                    <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.5)', marginTop: '2px' }}>Regístrate y compite por $50.000 sin pagar nada</div>
                  </div>
                </div>
                <button onClick={() => { setShowPromo(false); setStep('registro') }}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(90deg, #00ddd0, #1a73e8)', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '800', fontSize: '1rem', letterSpacing: '.5px', marginBottom: '10px' }}>
                  QUIERO MI MES GRATIS →
                </button>
                <button onClick={volver}
                  style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid rgba(255,255,255,.15)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontSize: '.78rem' }}>
                  Ya tengo cuenta
                </button>
              </div>
            </div>
          </div>
        )}

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
                <ErrorBox error={error} waTexto={textoVerificacion(player?.name || '', cedula.trim(), player?.equipo_deseado || '')}/>
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

          {step === 'verificar' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>📲</div>
              <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem', marginBottom: '8px' }}>¡Último paso, {nombre.split(' ')[0]}!</div>
              <div style={{ fontSize: '.82rem', color: '#5f6368', lineHeight: 1.6, marginBottom: '16px' }}>
                Tu cuenta quedó creada pero <b>pendiente de verificación</b>. Envíanos el mensaje de WhatsApp con tus datos y te activamos la cuenta.
              </div>
              {!equipo.trim() && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '10px 14px', fontSize: '.75rem', color: '#8a5a00', marginBottom: '16px', lineHeight: 1.5, textAlign: 'left' }}>
                  ⚠️ Como no estás registrado como jugador en ningún equipo, al verificarte solo podrás ingresar a <b>PREDIX</b> (predicciones y ranking).
                </div>
              )}
              <a href={WA_LINK(textoVerificacion(nombre.trim(), cedula.trim(), equipo.trim()))}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: '#25d366', borderRadius: '12px', color: '#fff', fontWeight: '800', fontSize: '.95rem', textDecoration: 'none', marginBottom: '10px' }}>
                📲 Enviar mensaje de verificación
              </a>
              <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '14px' }}>
                El mensaje ya lleva tu nombre, cédula y equipo — solo dale enviar.
              </div>
              <button onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Volver al inicio</button>
            </div>
          )}

          {step === 'registro' && (
            <>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '4px' }}>Crear cuenta gratis</div>
              {duenoDe && (
                <div style={{ background: '#fff8e1', border: '1px solid #f9a825', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#e8710a' }}>👑 Eres el dueño del equipo {duenoDe.name}</div>
                  <div style={{ fontSize: '.7rem', color: '#8a5a00', marginTop: '2px', lineHeight: 1.5 }}>
                    {duenoDe.created_at && `Equipo creado el ${new Date(duenoDe.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}. `}
                    Tus datos ya quedaron precargados — solo revisa y crea tu contraseña.
                  </div>
                </div>
              )}
              <div style={{ background: 'linear-gradient(90deg, #1a73e8, #6c35de)', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🎁</span>
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: '800', color: '#fff' }}>¡1 mes GRATIS!</div>
                  <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.8)' }}>Compite por $50.000 sin pagar nada</div>
                </div>
              </div>
              <form onSubmit={handleRegistro} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Nombre completo</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" type="text" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'} autoFocus/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>WhatsApp</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="Ej: 3001234567" type="tel" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>¿En qué equipo vas a jugar?</label>
                  <input value={equipo} onChange={e => setEquipo(e.target.value)} placeholder="Nombre del equipo (vacío si solo quieres PREDIX)" type="text" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                  {!equipo.trim() && (
                    <div style={{ fontSize: '.7rem', color: '#e8710a', marginTop: '5px', lineHeight: 1.4 }}>
                      ⚠️ Si no estás registrado como jugador en ningún equipo, solo podrás ingresar a PREDIX.
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Contraseña</label>
                  <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '.78rem', fontWeight: '500', color: '#5f6368', marginBottom: '6px' }}>Confirmar contraseña</label>
                  <input value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Repite la contraseña" type="password" style={inp}
                    onFocus={e => e.target.style.borderColor = '#1a73e8'} onBlur={e => e.target.style.borderColor = '#dadce0'}/>
                </div>
                <ErrorBox error={error}/>
                <button type="submit" disabled={loading}
                  style={{ marginTop: '4px', padding: '12px', background: loading ? '#dadce0' : 'linear-gradient(90deg, #00ddd0, #1a73e8)', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: loading ? '#9aa0a6' : '#000', fontWeight: '800', fontSize: '.95rem' }}>
                  {loading ? 'Creando cuenta...' : '🎯 ENTRAR GRATIS →'}
                </button>
                <button type="button" onClick={volver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>← Volver</button>
              </form>
            </>
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
