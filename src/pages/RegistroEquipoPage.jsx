import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, Check, Users, Upload } from 'lucide-react'

const POSICIONES = {
  'Fútbol 5':  ['Portero', 'Cierre', 'Ala derecha', 'Ala izquierda', 'Pivot'],
  'Fútbol 7':  ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista', 'Extremo derecho', 'Extremo izquierdo', 'Delantero'],
  'Fútbol 11': ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista defensivo', 'Mediocampista central', 'Mediocampista ofensivo', 'Extremo derecho', 'Extremo izquierdo', 'Delantero centro', 'Segunda punta'],
}

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '10px', padding: '10px 14px', color: '#202124',
  fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '600', color: '#5f6368',
  display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em',
}

const EMPTY_FORM = {
  name: '', telefono: '', city: '', genero: '', fecha_nacimiento: '',
  posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
}

function FotoUpload({ label, preview, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label} *</label>
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${preview ? '#1a73e8' : '#dadce0'}`,
        borderRadius: '10px', padding: '16px', cursor: 'pointer',
        background: preview ? '#e8f0fe' : '#f8f9fa', minHeight: '100px',
        transition: 'all .2s',
      }}>
        {preview
          ? <img src={preview} style={{ maxHeight: '120px', borderRadius: '6px', objectFit: 'cover' }}/>
          : <>
              <Upload size={24} color="#9aa0a6" style={{ marginBottom: '6px' }}/>
              <span style={{ fontSize: '.8rem', color: '#9aa0a6' }}>Toca para subir foto</span>
            </>
        }
        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onChange}/>
      </label>
    </div>
  )
}

export default function RegistroEquipoPage() {
  const { token, tournamentId } = useParams()

  const [equipo,        setEquipo]        = useState(null)
  const [torneo,        setTorneo]        = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [cedula,        setCedula]        = useState('')
  const [deudaJugador,  setDeudaJugador]  = useState(null) // deuda personal de tarjetas
  const [sancionJugador, setSancionJugador] = useState(null) // sanción activa
  const [verificacion,  setVerificacion]  = useState(null) // { codigo, telefono, tipo, nombre }
  const [codigoInput,   setCodigoInput]   = useState('')
  const [errorCodigo,   setErrorCodigo]   = useState('')
  const [buscando,      setBuscando]      = useState(false)
  const [jugadorExiste, setJugadorExiste] = useState(null)
  const [mostrarNuevo,  setMostrarNuevo]  = useState(false)
  const [formNuevo,     setFormNuevo]     = useState(EMPTY_FORM)
  const [guardando,     setGuardando]     = useState(false)
  const [msg,           setMsg]           = useState(null)
  const [exito,         setExito]         = useState(false)

  // Fotos cédula
  const [fotoFrontal,        setFotoFrontal]        = useState(null)
  const [fotoTrasera,        setFotoTrasera]        = useState(null)
  const [previewFrontal,     setPreviewFrontal]     = useState(null)
  const [previewTrasera,     setPreviewTrasera]     = useState(null)
  const [subiendoFotos,      setSubiendoFotos]      = useState(false)

  useEffect(() => { fetchDatos() }, [token, tournamentId])

  async function fetchDatos() {
    const [{ data: eq }, { data: tor }] = await Promise.all([
      supabase.from('teams').select('*').eq('registro_token', token).single(),
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
    ])
    setEquipo(eq)
    setTorneo(tor)
    setLoading(false)
  }

  function showMsg(text, type = 'error') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 5000)
  }

  function handleFotoFrontal(e) {
    const file = e.target.files[0]; if (!file) return
    setFotoFrontal(file)
    setPreviewFrontal(URL.createObjectURL(file))
  }

  function handleFotoTrasera(e) {
    const file = e.target.files[0]; if (!file) return
    setFotoTrasera(file)
    setPreviewTrasera(URL.createObjectURL(file))
  }

  async function subirFotosCedula(playerId) {
    const urls = {}
    if (fotoFrontal) {
      const ext  = fotoFrontal.name.split('.').pop()
      const path = `${playerId}_frontal.${ext}`
      await supabase.storage.from('cedulas').upload(path, fotoFrontal, { upsert: true })
      const { data } = supabase.storage.from('cedulas').getPublicUrl(path)
      urls.cedula_frontal_url = data.publicUrl
    }
    if (fotoTrasera) {
      const ext  = fotoTrasera.name.split('.').pop()
      const path = `${playerId}_trasera.${ext}`
      await supabase.storage.from('cedulas').upload(path, fotoTrasera, { upsert: true })
      const { data } = supabase.storage.from('cedulas').getPublicUrl(path)
      urls.cedula_trasera_url = data.publicUrl
    }
    if (Object.keys(urls).length > 0) {
      await supabase.from('players').update(urls).eq('id', playerId)
    }
  }

  async function handleBuscarCedula() {
    if (!cedula.trim()) return showMsg('Ingresa tu número de cédula')
    setBuscando(true)
    setJugadorExiste(null)
    setMostrarNuevo(false)
    setDeudaJugador(null)
    setSancionJugador(null)

    // Buscar jugador
    const { data: jugador } = await supabase.from('players').select('*').eq('numero_cedula', cedula.trim()).single()

    if (jugador) {
      // Verificar si ya está registrado en ESTE torneo (en cualquier equipo)
      const { data: yaEnTorneo } = await supabase
        .from('tournament_player_registrations')
        .select('*, teams(name)')
        .eq('tournament_id', tournamentId)
        .eq('player_id', jugador.id)
        .eq('activo', true)
        .single()

      if (yaEnTorneo) {
        showMsg(`⚠️ Ya estás registrado en este torneo con el equipo "${yaEnTorneo.teams?.name}"`, 'warning')
        setBuscando(false)
        return
      }
      // Verificar deuda personal de tarjetas de torneos anteriores
      try {
        const { data: deudas } = await supabase
          .from('torneo_finanzas').select('monto, concepto')
          .eq('player_id', jugador.id).eq('tipo', 'deuda_personal').eq('pagado', false)
        const total = (deudas || []).reduce((a, d) => a + (d.monto || 0), 0)
        if (total > 0) setDeudaJugador({ total, concepto: (deudas || []).map(d => d.concepto).filter(Boolean)[0] || 'tarjetas de torneos anteriores' })
      } catch { /* tabla de finanzas aún no creada */ }
      // Verificar sanción activa (aplica a todos los torneos)
      try {
        const { data: sanc } = await supabase
          .from('sanciones').select('motivo, fecha_fin')
          .eq('player_id', jugador.id).eq('activa', true)
        const ahora = new Date()
        const activa = (sanc || []).find(s => !s.fecha_fin || new Date(s.fecha_fin) > ahora)
        if (activa) setSancionJugador(activa)
      } catch { /* tabla de sanciones aún no creada */ }
      setJugadorExiste(jugador)
    } else {
      setMostrarNuevo(true)
      setFormNuevo({ ...EMPTY_FORM })
    }
    setBuscando(false)
  }

  // ── Verificación por WhatsApp ─────────────────────────────
  function iniciarVerificacion(tipo) {
    const telRaw  = tipo === 'existente' ? (jugadorExiste?.whatsapp || jugadorExiste?.telefono) : (formNuevo.whatsapp || formNuevo.telefono)
    const nombre  = tipo === 'existente' ? jugadorExiste?.name : formNuevo.name
    const telefono = (telRaw || '').replace(/\D/g, '')
    if (!telefono) return null // sin número no se puede verificar
    const codigo = String(Math.floor(1000 + Math.random() * 9000))
    setCodigoInput('')
    setErrorCodigo('')
    setVerificacion({ codigo, telefono, tipo, nombre })
    return true
  }

  function enviarCodigoWhatsApp() {
    if (!verificacion) return
    const texto = `🔒 GOLMEBOL — Tu código de confirmación es: *${verificacion.codigo}*\n\n${verificacion.nombre?.split(' ')[0] || 'Hola'}, te están inscribiendo al equipo *${equipo.name}* para el torneo *${torneo.name}*.\n\n✅ Si aceptas unirte, comparte este código con la persona que te está inscribiendo.\n❌ Si NO quieres estar en ese equipo, ignora este mensaje.`
    window.open(`https://wa.me/57${verificacion.telefono}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  function handleVerificarCodigo() {
    if (codigoInput.trim() !== verificacion.codigo) {
      setErrorCodigo('Código incorrecto — pídele al jugador el código que le llegó a su WhatsApp')
      return
    }
    const tipo = verificacion.tipo
    setVerificacion(null)
    setErrorCodigo('')
    if (tipo === 'existente') registrarExistente()
    else crearYRegistrarReal()
  }

  function handleConfirmarExistente() {
    if (sancionJugador) return showMsg(`⛔ No puedes inscribirte: estás sancionado${sancionJugador.fecha_fin ? ` hasta el ${new Date(sancionJugador.fecha_fin).toLocaleDateString('es-CO')}` : ' de forma permanente'}.`, 'warning')
    if (deudaJugador) return showMsg(`🚫 No puedes inscribirte: debes $${Math.round(deudaJugador.total).toLocaleString('es-CO')} de ${deudaJugador.concepto}. Comunícate con la organización para pagarla.`, 'warning')
    // Confirmación por WhatsApp: el jugador debe aceptar con el código que le llega
    if (iniciarVerificacion('existente')) return
    // Sin número registrado: continuar directo (no hay a dónde enviar el código)
    registrarExistente()
  }

  async function registrarExistente() {
    setGuardando(true)

    // Insertar en tournament_player_registrations
    const { error } = await supabase.from('tournament_player_registrations').insert({
      tournament_id: tournamentId,
      team_id:       equipo.id,
      player_id:     jugadorExiste.id,
      activo:        true,
    })
    if (error) { showMsg('Error al registrarte. Intenta de nuevo.'); setGuardando(false); return }

    // Si no está en team_players, agregarlo
    const { data: yaEnEquipo } = await supabase.from('team_players').select('id').eq('team_id', equipo.id).eq('player_id', jugadorExiste.id).single()
    if (!yaEnEquipo) {
      await supabase.from('team_players').insert({ team_id: equipo.id, player_id: jugadorExiste.id, activo: true })
    }

    // Subir fotos si las puso
    await subirFotosCedula(jugadorExiste.id)

    setExito(true)
    setGuardando(false)
  }

  async function handleCrearYRegistrar() {
    if (!formNuevo.name)             return showMsg('El nombre es obligatorio')
    if (!formNuevo.telefono)         return showMsg('El teléfono es obligatorio')
    if (!formNuevo.city)             return showMsg('La ciudad es obligatoria')
    if (!formNuevo.genero)           return showMsg('El género es obligatorio')
    if (!formNuevo.fecha_nacimiento) return showMsg('La fecha de nacimiento es obligatoria')
    if (!formNuevo.posicion_futbol5 && !formNuevo.posicion_futbol7 && !formNuevo.posicion_futbol11)
      return showMsg('Selecciona al menos una posición')
    if (!fotoFrontal) return showMsg('La foto frontal de la cédula es obligatoria')
    if (!fotoTrasera) return showMsg('La foto trasera de la cédula es obligatoria')

    // Confirmación por WhatsApp al número que registró
    if (iniciarVerificacion('nuevo')) return
    crearYRegistrarReal()
  }

  async function crearYRegistrarReal() {
    setGuardando(true)
    setSubiendoFotos(true)

    // Crear jugador
    const { data: nuevo, error } = await supabase.from('players').insert({
      ...formNuevo,
      numero_cedula: cedula.trim(),
      activo_membresia: true,
      fecha_registro: new Date().toISOString(),
    }).select().single()
    if (error) { showMsg('Error al crear el jugador. Intenta de nuevo.'); setGuardando(false); setSubiendoFotos(false); return }

    // Subir fotos cédula
    await subirFotosCedula(nuevo.id)
    setSubiendoFotos(false)

    // Registrar en torneo
    const { error: e2 } = await supabase.from('tournament_player_registrations').insert({
      tournament_id: tournamentId,
      team_id:       equipo.id,
      player_id:     nuevo.id,
      activo:        true,
    })
    if (e2) { showMsg('Jugador creado pero error al registrarlo en el torneo.'); setGuardando(false); return }

    // Registrar en equipo base
    await supabase.from('team_players').insert({ team_id: equipo.id, player_id: nuevo.id, activo: true })

    setExito(true)
    setGuardando(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#1a73e8', fontSize: '.9rem' }}>Cargando...</div>
    </div>
  )

  if (!equipo || !torneo) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <Shield size={48} color="#dadce0"/>
      <div style={{ color: '#9aa0a6', fontSize: '.9rem' }}>Link de registro inválido</div>
    </div>
  )

  // El link para registrar jugadores vence 24h después de que se compartió
  // (teams.registro_token_generado_en se actualiza cada vez que el admin/
  // coordinador lo copia para enviarlo). Si nunca se registró esa fecha
  // (equipos viejos, antes de este cambio) se deja pasar sin restricción.
  const vencido = equipo.registro_token_generado_en &&
    (Date.now() - new Date(equipo.registro_token_generado_en).getTime()) > 24 * 60 * 60 * 1000

  if (vencido) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', maxWidth: '380px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>⏰</div>
        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#d93025', marginBottom: '10px' }}>Link vencido</div>
        <div style={{ fontSize: '.85rem', color: '#5f6368', lineHeight: 1.6, marginBottom: '22px' }}>
          Este link de registro ya venció (es válido por 24 horas desde que se envió).
          Pide a Golmebol que te comparta uno nuevo para seguir inscribiendo jugadores del equipo <strong>{equipo.name}</strong> en el torneo <strong>{torneo.name}</strong>.
        </div>
        <a href={`https://wa.me/573226490055?text=${encodeURIComponent(`Hola! Quiero registrar otro jugador, ¿me podrías enviar el link? Equipo: ${equipo.name} — Torneo: ${torneo.name}`)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: '#25D366', borderRadius: '10px', color: '#fff', fontWeight: '800', fontSize: '.9rem', textDecoration: 'none' }}>
          📲 Escribir a Golmebol por WhatsApp
        </a>
      </div>
    </div>
  )

  if (exito) return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '360px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Check size={32} color="#1e8e3e"/>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>¡Registrado!</div>
        <div style={{ fontSize: '.875rem', color: '#5f6368', lineHeight: 1.6, marginBottom: '20px' }}>
          Quedaste inscrito en el torneo<br/>
          <strong>{torneo.name}</strong><br/>
          con el equipo <strong>{equipo.name}</strong>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e8f0fe', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {equipo.logo_url ? <img src={equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={18} color="#1a73e8"/>}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{equipo.name}</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>{torneo.name}</div>
          </div>
        </div>
        <button
          onClick={() => {
            setExito(false); setCedula(''); setJugadorExiste(null); setMostrarNuevo(false)
            setDeudaJugador(null); setSancionJugador(null); setFormNuevo(EMPTY_FORM); setGuardando(false)
            setFotoFrontal(null); setFotoTrasera(null); setPreviewFrontal(null); setPreviewTrasera(null)
            window.scrollTo({ top: 0 })
          }}
          style={{ marginTop: '18px', width: '100%', padding: '13px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600' }}>
          ➕ Registrar nuevo jugador
        </button>
        <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '8px' }}>
          ¿Falta alguien del equipo? Regístralo desde este mismo teléfono
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Modal verificación WhatsApp */}
      {verificacion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📲</div>
              <div style={{ fontWeight: '800', color: '#202124', fontSize: '1rem' }}>Confirmación del jugador</div>
              <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '6px', lineHeight: 1.5 }}>
                Para inscribir a <strong>{verificacion.nombre}</strong> se necesita su autorización.
                Envíale el código a su WhatsApp (📱 …{verificacion.telefono.slice(-4)}) y escribe aquí el código que él te comparta.
              </div>
            </div>

            <button onClick={enviarCodigoWhatsApp}
              style={{ width: '100%', padding: '12px', background: '#25D366', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '700', marginBottom: '14px' }}>
              💬 Enviar código por WhatsApp
            </button>

            <label style={{ fontSize: '.75rem', fontWeight: '600', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Código que recibió el jugador</label>
            <input value={codigoInput} onChange={e => { setCodigoInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setErrorCodigo('') }}
              inputMode="numeric" placeholder="• • • •"
              style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${errorCodigo ? '#d93025' : '#dadce0'}`, borderRadius: '10px', padding: '12px', fontSize: '1.4rem', fontWeight: '800', textAlign: 'center', letterSpacing: '8px', outline: 'none', marginBottom: errorCodigo ? '6px' : '14px' }}/>
            {errorCodigo && <div style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '600', marginBottom: '10px' }}>{errorCodigo}</div>}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setVerificacion(null); setCodigoInput(''); setErrorCodigo('') }}
                style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>
                Cancelar
              </button>
              <button onClick={handleVerificarCodigo} disabled={codigoInput.length !== 4}
                style={{ flex: 1, padding: '11px', background: codigoInput.length === 4 ? '#1a73e8' : '#dadce0', border: 'none', borderRadius: '10px', cursor: codigoInput.length === 4 ? 'pointer' : 'not-allowed', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                ✓ Confirmar
              </button>
            </div>
            <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '10px', textAlign: 'center' }}>
              El jugador recibe el mensaje y solo comparte el código si acepta unirse al equipo
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a237e 0%, #1a73e8 100%)', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
          {equipo.logo_url ? <img src={equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }}/> : <Shield size={32} color="#fff"/>}
        </div>
        <h1 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: '800', margin: '0 0 2px' }}>{equipo.name}</h1>
        <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '.8rem', marginBottom: '6px' }}>Registro para el torneo</div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,.2)', borderRadius: '20px', padding: '3px 14px' }}>
          <span style={{ color: '#fff', fontSize: '.82rem', fontWeight: '600' }}>🏆 {torneo.name}</span>
        </div>
      </div>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>

        {msg && (
          <div style={{
            background: msg.type === 'warning' ? '#fff8e1' : msg.type === 'ok' ? '#e6f4ea' : '#fce8e6',
            border: `1px solid ${msg.type === 'warning' ? '#ffe082' : msg.type === 'ok' ? '#ceead6' : '#fad2cf'}`,
            color: msg.type === 'warning' ? '#f57f17' : msg.type === 'ok' ? '#1e8e3e' : '#d93025',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '.875rem', lineHeight: 1.5,
          }}>
            {msg.text}
          </div>
        )}

        {/* PASO 1 — Cédula */}
        {!jugadorExiste && !mostrarNuevo && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>Ingresa tu número de cédula</div>
            <div style={{ fontSize: '.8rem', color: '#9aa0a6', marginBottom: '20px' }}>Verificamos si ya estás registrado en Golmebol</div>
            <label style={labelStyle}>Número de cédula</label>
            <input
              value={cedula}
              onChange={e => setCedula(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscarCedula()}
              placeholder="Ej: 1094948981"
              style={inputStyle}
              type="number"
              inputMode="numeric"
            />
            <button onClick={handleBuscarCedula} disabled={buscando}
              style={{ width: '100%', marginTop: '14px', padding: '13px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: buscando ? .7 : 1 }}>
              {buscando ? 'Buscando...' : 'Continuar →'}
            </button>
          </div>
        )}

        {/* Jugador encontrado */}
        {jugadorExiste && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ background: '#e6f4ea', border: '1px solid #ceead6', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#1e8e3e', marginBottom: '10px', letterSpacing: '.05em' }}>✓ JUGADOR ENCONTRADO EN GOLMEBOL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#ceead6', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {jugadorExiste.photo_url ? <img src={jugadorExiste.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Users size={24} color="#1e8e3e"/>}
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>{jugadorExiste.name}</div>
                  <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '2px' }}>🪪 {jugadorExiste.numero_cedula}</div>
                  {jugadorExiste.city && <div style={{ fontSize: '.8rem', color: '#5f6368' }}>📍 {jugadorExiste.city}</div>}
                </div>
              </div>
            </div>

            {(jugadorExiste.es_arbitro || jugadorExiste.rol === 'arbitro') && (
              <div style={{ background: '#e8f0fe', border: '1px solid #aecbfa', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#1a73e8', marginBottom: '4px' }}>🟡 Esta persona ya está registrada como árbitro en Golmebol</div>
                <div style={{ fontSize: '.8rem', color: '#5f6368' }}>
                  Si confirman la inscripción, <strong>{jugadorExiste.name}</strong> quedará también habilitado como jugador usando los mismos datos —
                  podrá entrar con la misma cuenta y contraseña tanto al portal de jugador como al de árbitro.
                </div>
              </div>
            )}

            {/* Fotos cédula opcionales para jugadores existentes */}
            {(!jugadorExiste.cedula_frontal_url || !jugadorExiste.cedula_trasera_url) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '12px', background: '#fff8e1', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ffe082' }}>
                  📸 Aprovecha para subir tu foto de cédula si aún no la tienes registrada
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FotoUpload label="Cédula Frontal" preview={previewFrontal} onChange={handleFotoFrontal}/>
                  <FotoUpload label="Cédula Trasera" preview={previewTrasera} onChange={handleFotoTrasera}/>
                </div>
              </div>
            )}

            {sancionJugador && (
              <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#d93025', marginBottom: '4px' }}>⛔ JUGADOR SANCIONADO — NO PUEDE INSCRIBIRSE</div>
                <div style={{ fontSize: '.8rem', color: '#5f6368' }}>
                  {sancionJugador.motivo || 'Sanción disciplinaria'}.{' '}
                  {sancionJugador.fecha_fin
                    ? <>Sancionado hasta el <strong style={{ color: '#d93025' }}>{new Date(sancionJugador.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.</>
                    : <strong style={{ color: '#d93025' }}>Sanción permanente.</strong>}
                </div>
              </div>
            )}
            {deudaJugador && (
              <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '.8rem', fontWeight: '800', color: '#d93025', marginBottom: '4px' }}>🚫 NO PUEDES INSCRIBIRTE POR DEUDA DE TARJETAS</div>
                <div style={{ fontSize: '.8rem', color: '#5f6368' }}>
                  Debes <strong style={{ color: '#d93025' }}>${Math.round(deudaJugador.total).toLocaleString('es-CO')}</strong> de {deudaJugador.concepto}.
                  Comunícate con la organización para ponerte al día y poder inscribirte.
                </div>
              </div>
            )}

            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '16px' }}>
              ¿Eres tú? Confirma para inscribirte en <strong>{torneo.name}</strong> con <strong>{equipo.name}</strong>.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleConfirmarExistente} disabled={guardando || !!deudaJugador || !!sancionJugador}
                style={{ flex: 1, padding: '13px', background: (deudaJugador || sancionJugador) ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: (deudaJugador || sancionJugador) ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Registrando...' : sancionJugador ? '⛔ Jugador sancionado' : deudaJugador ? '🚫 Inscripción bloqueada' : '✓ Confirmar inscripción'}
              </button>
              <button onClick={() => { setJugadorExiste(null); setCedula(''); setDeudaJugador(null); setSancionJugador(null) }}
                style={{ padding: '13px 16px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
                No soy yo
              </button>
            </div>
          </div>
        )}

        {/* Jugador nuevo */}
        {mostrarNuevo && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,.06)', border: '1px solid #e8eaed' }}>
            <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '.8rem', color: '#d93025', fontWeight: '600' }}>⚠️ Cédula {cedula} no está registrada en Golmebol</div>
              <div style={{ fontSize: '.75rem', color: '#d93025', marginTop: '3px' }}>Completa tus datos para registrarte por primera vez</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div>
                <label style={labelStyle}>Nombre completo *</label>
                <input value={formNuevo.name} onChange={e => setFormNuevo(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Tu nombre completo"/>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Teléfono *</label>
                  <input value={formNuevo.telefono} onChange={e => setFormNuevo(f => ({ ...f, telefono: e.target.value }))} style={inputStyle} placeholder="300 000 0000" type="tel"/>
                </div>
                <div>
                  <label style={labelStyle}>Ciudad *</label>
                  <input value={formNuevo.city} onChange={e => setFormNuevo(f => ({ ...f, city: e.target.value }))} style={inputStyle} placeholder="Tu ciudad"/>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Género *</label>
                  <select value={formNuevo.genero} onChange={e => setFormNuevo(f => ({ ...f, genero: e.target.value }))} style={inputStyle}>
                    <option value="">Seleccionar</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha de nacimiento *</label>
                  <input type="date" value={formNuevo.fecha_nacimiento} onChange={e => setFormNuevo(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={inputStyle}/>
                </div>
              </div>

              {/* Posiciones */}
              <div>
                <label style={{ ...labelStyle, marginBottom: '10px' }}>Posición *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(POSICIONES).map(([mod, posiciones]) => (
                    <div key={mod}>
                      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '4px', fontWeight: '500' }}>{mod}</div>
                      <select
                        value={formNuevo[`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]}
                        onChange={e => setFormNuevo(f => ({ ...f, [`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]: e.target.value }))}
                        style={inputStyle}>
                        <option value="">No juego {mod}</option>
                        {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fotos cédula — obligatorias para nuevos */}
              <div>
                <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124', marginBottom: '10px' }}>📸 Fotos de la cédula</div>
                <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginBottom: '12px' }}>Necesitamos ambas caras de tu cédula para verificar tu identidad</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FotoUpload label="Cara Frontal" preview={previewFrontal} onChange={handleFotoFrontal}/>
                  <FotoUpload label="Cara Trasera" preview={previewTrasera} onChange={handleFotoTrasera}/>
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleCrearYRegistrar} disabled={guardando}
                style={{ flex: 1, padding: '13px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '600', opacity: guardando ? .7 : 1 }}>
                {guardando ? (subiendoFotos ? 'Subiendo fotos...' : 'Registrando...') : '⚽ Registrarme en Golmebol'}
              </button>
              <button onClick={() => { setMostrarNuevo(false); setCedula('') }}
                style={{ padding: '13px 16px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368' }}>←</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Powered by </span>
          <span style={{ fontSize: '.75rem', fontWeight: '700', color: '#1a73e8' }}>GOLMEBOL</span>
        </div>
      </div>
    </div>
  )
}
