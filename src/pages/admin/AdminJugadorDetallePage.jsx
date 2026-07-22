import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, User, Camera, Upload, CreditCard, MessageCircle } from 'lucide-react'
import PlayerCard from '../../components/card/PlayerCard'
import BuscadorJugador from '../../components/BuscadorJugador'

const lbl = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }
const inp = { width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', color: '#202124', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }

function CedulasViewer({ jugadorId, frontalPath, traseraPath }) {
  const [urls,    setUrls]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  async function handleVer() {
    if (visible) { setVisible(false); setUrls(null); return }
    setLoading(true)
    const getUrl = async (fullUrl) => {
      if (!fullUrl) return null
      const path = fullUrl.split('/cedulas/')[1]
      if (!path) return null
      const { data } = await supabase.storage.from('cedulas').createSignedUrl(path, 60)
      return data?.signedUrl || null
    }
    const [frontal, trasera] = await Promise.all([getUrl(frontalPath), getUrl(traseraPath)])
    setUrls({ frontal, trasera })
    setVisible(true)
    setLoading(false)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: visible ? '12px' : '0' }}>
        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>🪪 Documentos de identidad</div>
        <button onClick={handleVer} disabled={loading}
          style={{ padding: '6px 14px', background: visible ? '#f1f3f4' : '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: visible ? '#5f6368' : '#fff', fontSize: '.78rem', fontWeight: '600' }}>
          {loading ? 'Cargando...' : visible ? '🔒 Ocultar' : '🔓 Ver cédulas'}
        </button>
      </div>
      {visible && urls && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {urls.frontal && (
            <div>
              <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '4px' }}>Frontal</div>
              <img src={urls.frontal} style={{ height: '120px', borderRadius: '8px', border: '1px solid #e8eaed', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(urls.frontal, '_blank')}/>
            </div>
          )}
          {urls.trasera && (
            <div>
              <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '4px' }}>Trasera</div>
              <img src={urls.trasera} style={{ height: '120px', borderRadius: '8px', border: '1px solid #e8eaed', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(urls.trasera, '_blank')}/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color = '#1a73e8' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: '700', color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px', fontWeight: '500' }}>{label}</div>
    </div>
  )
}

function diasRestantes(fechaVenc) {
  if (!fechaVenc) return null
  return Math.ceil((new Date(fechaVenc) - new Date()) / (1000 * 60 * 60 * 24))
}

export default function AdminJugadorDetallePage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [jugador,       setJugador]       = useState(null)
  const [stats,         setStats]         = useState(null)
  const [torneos,       setTorneos]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [tab,           setTab]           = useState('resumen')
  const [msg,           setMsg]           = useState(null)
  const [uploading,     setUploading]     = useState({})
  const [modalMem,      setModalMem]      = useState(false)
  const [meses,         setMeses]         = useState(1)
  const [contrasena,    setContrasena]    = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [errMem,        setErrMem]        = useState('')
  const [formJugador,   setFormJugador]   = useState({})
  const [guardandoForm, setGuardandoForm] = useState(false)
  const [sanciones,        setSanciones]        = useState([])
  const [formSancion,      setFormSancion]      = useState({ motivo: '', duracion: '8' })
  const [guardandoSancion, setGuardandoSancion] = useState(false)

  useEffect(() => { fetchTodo() }, [id])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  async function fetchTodo() {
    setLoading(true)
    await Promise.all([fetchJugador(), fetchStats(), fetchTorneos(), fetchSanciones()])
    setLoading(false)
  }

  async function fetchSanciones() {
    try {
      const { data } = await supabase.from('sanciones').select('*').eq('player_id', id).order('created_at', { ascending: false })
      setSanciones(data || [])
    } catch { setSanciones([]) }
  }

  async function handleCrearSancion() {
    if (!formSancion.motivo.trim()) return showMsg('Escribe el motivo de la sanción', 'error')
    setGuardandoSancion(true)
    let fecha_fin = null
    if (formSancion.duracion !== 'siempre') {
      const f = new Date()
      f.setMonth(f.getMonth() + parseInt(formSancion.duracion))
      fecha_fin = f.toISOString()
    }
    const { error } = await supabase.from('sanciones').insert({
      player_id: id, tournament_id: null, motivo: formSancion.motivo.trim(), fecha_fin, activa: true,
    })
    setGuardandoSancion(false)
    if (error) return showMsg('Error al sancionar (¿ejecutaste migracion_sanciones.sql?)', 'error')
    showMsg('Jugador sancionado ⛔ — aplica en todos los torneos')
    setFormSancion({ motivo: '', duracion: '8' })
    fetchSanciones()
  }

  async function handleLevantarSancion(s) {
    if (!confirm('¿Levantar esta sanción? El jugador podrá volver a jugar.')) return
    await supabase.from('sanciones').update({ activa: false }).eq('id', s.id)
    showMsg('Sanción levantada ✓')
    fetchSanciones()
  }

  const sancionesActivas = sanciones.filter(s => s.activa && (!s.fecha_fin || new Date(s.fecha_fin) > new Date()))

  async function fetchJugador() {
    const { data } = await supabase.from('players').select('*').eq('id', id).single()
    setJugador(data)
    setFormJugador({
      name:              data?.name              || '',
      numero_cedula:     data?.numero_cedula     || '',
      telefono:          data?.telefono          || '',
      whatsapp:          data?.whatsapp          || '',
      fecha_nacimiento:  data?.fecha_nacimiento  || '',
      genero:            data?.genero            || '',
      city:              data?.city              || '',
      posicion_futbol5:  data?.posicion_futbol5  || '',
      posicion_futbol7:  data?.posicion_futbol7  || '',
      posicion_futbol11: data?.posicion_futbol11 || '',
      estatura:          data?.estatura          || '',
      peso:              data?.peso              || '',
      pie_dominante:     data?.pie_dominante     || '',
    })
  }

  async function fetchStats() {
    const { data: raw } = await supabase.from('player_match_stats').select('*').eq('player_id', id)
    const r        = raw || []
    const pj       = r.length
    const goles    = r.reduce((s, x) => s + (x.goals_scored   || 0), 0)
    const recibidos= r.reduce((s, x) => s + (x.goals_conceded || 0), 0)
    const pg       = r.filter(x => x.team_result === 'win').length
    const pe       = r.filter(x => x.team_result === 'draw').length
    const pp       = r.filter(x => x.team_result === 'loss').length
    const eficacia = pj > 0 ? Math.round((pg / pj) * 100) : 0
    const amarillas = r.reduce((s, x) => s + (x.yellow_cards || 0), 0)
    const azules    = r.reduce((s, x) => s + (x.blue_cards   || 0), 0)
    let racha = 0, maxRacha = 0
    for (const x of [...r].reverse()) {
      if (x.team_result === 'win') { racha++; maxRacha = Math.max(maxRacha, racha) }
      else racha = 0
    }
    setStats({ pj, goles, recibidos, pg, pe, pp, eficacia, maxRacha, amarillas, azules })
  }

  async function fetchTorneos() {
    const { data } = await supabase
      .from('tournament_player_registrations')
      .select('*, teams(id,name,logo_url), tournaments(id,name,modalidad,season,logo_url)')
      .eq('player_id', id).eq('activo', true)
    setTorneos(data || [])
  }

  async function handleFoto(file, tipo) {
    if (!file) return
    setUploading(u => ({ ...u, [tipo]: true }))
    const ext   = file.name.split('.').pop()
    const path  = `fotos/${id}_${tipo}.${ext}`
    const campo = tipo === 'tarjeta' ? 'photo_url' : 'photo_face_url'
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (error) { showMsg('Error al subir foto', 'error'); setUploading(u => ({ ...u, [tipo]: false })); return }
    const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', id)
    setJugador(j => ({ ...j, [campo]: urlData.publicUrl }))
    setUploading(u => ({ ...u, [tipo]: false }))
    showMsg('Foto actualizada ✓')
  }

  async function handleEliminarFoto(tipo) {
    if (!confirm('¿Eliminar esta foto? El jugador podrá subir una nueva.')) return
    const campo = tipo === 'tarjeta' ? 'photo_url' : 'photo_face_url'
    const { error } = await supabase.from('players').update({ [campo]: null }).eq('id', id)
    if (error) { showMsg('Error al eliminar foto', 'error'); return }
    setJugador(j => ({ ...j, [campo]: null }))
    showMsg('Foto eliminada ✓')
  }

  async function handleCedula(file, cara) {
    if (!file) return
    setUploading(u => ({ ...u, [cara]: true }))
    const ext  = file.name.split('.').pop()
    const path = `${id}_${cara}.${ext}`
    const { error } = await supabase.storage.from('cedulas').upload(path, file, { upsert: true })
    if (error) { showMsg('Error al subir cédula', 'error'); setUploading(u => ({ ...u, [cara]: false })); return }
    const { data: urlData } = supabase.storage.from('cedulas').getPublicUrl(path)
    const campo = cara === 'frontal' ? 'cedula_frontal_url' : 'cedula_trasera_url'
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', id)
    setJugador(j => ({ ...j, [campo]: urlData.publicUrl }))
    setUploading(u => ({ ...u, [cara]: false }))
    showMsg('Cédula subida ✓')
  }

  async function handleGuardarDatos() {
    if (!formJugador.name?.trim()) { showMsg('El nombre es obligatorio', 'error'); return }
    setGuardandoForm(true)
    // Verificar WhatsApp único si se cambió
    if (formJugador.whatsapp?.trim()) {
      const { data: yaExiste } = await supabase.from('players').select('id').eq('whatsapp', formJugador.whatsapp.trim()).neq('id', id).single()
      if (yaExiste) { showMsg('Este WhatsApp ya está registrado en otro jugador', 'error'); setGuardandoForm(false); return }
    }
    const { error } = await supabase.from('players').update(formJugador).eq('id', id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Datos actualizados ✓'); fetchJugador() }
    setGuardandoForm(false)
  }

  async function handleActivarMembresia() {
    const yaTieneAuth = !!jugador.user_id
    if (!yaTieneAuth && (!contrasena || contrasena.length < 6)) {
      setErrMem('La contraseña debe tener mínimo 6 caracteres'); return
    }
    setGuardando(true); setErrMem('')
    const fechaVenc = new Date(Date.now() + meses * 30 * 24 * 60 * 60 * 1000).toISOString()
    const email     = `${jugador.numero_cedula}@golmebol.com`
    try {
      let userId = jugador.user_id
      if (!yaTieneAuth) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email, password: contrasena,
          options: { data: { player_id: jugador.id, cedula: jugador.numero_cedula } }
        })
        if (authError) { setErrMem('Error al crear cuenta: ' + authError.message); setGuardando(false); return }
        userId = authData.user?.id
      }
      await supabase.from('players').update({
        user_id: userId, activo_membresia: true,
        fecha_pago: new Date().toISOString(), fecha_vencimiento: fechaVenc,
        meses_pagados: (jugador.meses_pagados || 0) + meses,
      }).eq('id', id)
      showMsg(`✅ Membresía activada por ${meses} mes${meses > 1 ? 'es' : ''} ✓`)
      setModalMem(false); setContrasena(''); fetchJugador()
    } catch (e) { setErrMem('Error: ' + e.message) }
    setGuardando(false)
  }

  async function handleDesactivar() {
    if (!confirm(`¿Desactivar membresía de ${jugador.name}?`)) return
    await supabase.from('players').update({ activo_membresia: false }).eq('id', id)
    showMsg('Membresía desactivada'); fetchJugador()
  }

  function abrirWhatsApp() {
    const dias    = diasRestantes(jugador.fecha_vencimiento)
    const vencida = dias !== null && dias <= 0
    const nombre  = jugador.name?.split(' ')[0] || 'jugador'
    const tel     = (jugador.whatsapp || jugador.telefono || '').replace(/\D/g, '')
    const texto   = vencida
      ? `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* ya venció. Renueva para seguir disfrutando tu tarjeta. ⚽🏆`
      : `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* vence en *${dias} día${dias !== 1 ? 's' : ''}*. ¡Renueva a tiempo! ⚽🏆`
    window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
  if (!jugador) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Jugador no encontrado</div>

  const dias      = diasRestantes(jugador.fecha_vencimiento)
  const vencida   = dias !== null && dias <= 0
  const porVencer = dias !== null && dias > 0 && dias <= 7
  const activo    = jugador.activo_membresia && !vencida
  const esPortero = jugador.posicion_futbol5 === 'Portero' || jugador.posicion_futbol7 === 'Portero' || jugador.posicion_futbol11 === 'Portero'

  const cardStats = {
    pj:          stats?.pj       || 0,
    golesContra: esPortero ? (stats?.recibidos || 0) : (stats?.goles || 0),
    promedio:    stats?.pj > 0 ? parseFloat((esPortero ? stats.recibidos / stats.pj : stats.goles / stats.pj).toFixed(2)) : 0,
    eficacia:    stats?.eficacia || 0,
    pg:          stats?.pg       || 0,
    pe:          stats?.pe       || 0,
    pp:          stats?.pp       || 0,
    amarillas:   stats?.amarillas || 0,
    azules:      stats?.azules    || 0,
  }

  const TABS = [
    { id: 'resumen',   label: 'Resumen'    },
    { id: 'buscador',  label: '🔎 Buscador' },
    { id: 'editar',    label: '✏️ Editar'  },
    { id: 'stats',     label: 'Stats'      },
    { id: 'torneos',   label: 'Torneos'    },
    { id: 'tarjeta',   label: 'Tarjeta'    },
    { id: 'sanciones', label: sancionesActivas.length > 0 ? `⛔ Sanciones (${sancionesActivas.length})` : '⛔ Sanciones' },
  ]

  const estadoColor = activo ? '#1e8e3e' : vencida && jugador.user_id ? '#d93025' : porVencer ? '#e8710a' : '#9aa0a6'
  const estadoBg    = activo ? '#e6f4ea'  : vencida && jugador.user_id ? '#fce8e6'  : porVencer ? '#fce8d9'  : '#f1f3f4'
  const estadoLabel = activo ? '✓ Activo' : vencida && jugador.user_id ? '✗ Vencido' : porVencer ? `⚠ ${dias}d` : 'Sin cuenta'

  // Campos faltantes
  const camposFaltantes = [
    !jugador.fecha_nacimiento && 'Fecha de nacimiento',
    !jugador.posicion_futbol5 && !jugador.posicion_futbol7 && !jugador.posicion_futbol11 && 'Posición',
    !jugador.telefono && !jugador.whatsapp && 'Teléfono/WhatsApp',
    !jugador.genero && 'Género',
  ].filter(Boolean)

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 9999, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Modal membresía */}
      {modalMem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '4px' }}>
              {!jugador.user_id ? 'Activar membresía' : activo ? 'Renovar membresía' : 'Reactivar membresía'}
            </div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '20px' }}>{jugador.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={lbl}>Meses a activar</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 6, 12].map(m => (
                    <button key={m} onClick={() => setMeses(m)}
                      style={{ flex: 1, padding: '8px 4px', border: meses === m ? '2px solid #1a73e8' : '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', background: meses === m ? '#e8f0fe' : '#fff', color: meses === m ? '#1a73e8' : '#5f6368', fontWeight: meses === m ? '700' : '400', fontSize: '.78rem' }}>
                      {m === 12 ? '1 año' : `${m}m`}
                    </button>
                  ))}
                </div>
              </div>
              {!jugador.user_id && (
                <div>
                  <label style={lbl}>Contraseña para el jugador *</label>
                  <input type="password" value={contrasena} onChange={e => setContrasena(e.target.value)} placeholder="Mínimo 6 caracteres" style={inp}/>
                  <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '4px' }}>Ingresa con cédula <b>{jugador.numero_cedula}</b> + esta contraseña</div>
                </div>
              )}
              {jugador.user_id && (
                <div style={{ background: '#e8f0fe', borderRadius: '8px', padding: '10px 14px', fontSize: '.78rem', color: '#1a73e8' }}>
                  🔐 Ya tiene cuenta. Solo se renueva el tiempo de acceso.
                </div>
              )}
              {errMem && <div style={{ fontSize: '.8rem', color: '#d93025', background: '#fce8e6', borderRadius: '8px', padding: '8px 12px' }}>{errMem}</div>}
              <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '.78rem', color: '#202124', fontWeight: '600' }}>Resumen</div>
                <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '4px' }}>
                  Acceso por <b>{meses} mes{meses > 1 ? 'es' : ''}</b> · Vence el{' '}
                  <b>{new Date(Date.now() + meses * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</b>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleActivarMembresia} disabled={guardando}
                  style={{ flex: 1, padding: '10px', background: '#1e8e3e', border: 'none', borderRadius: '10px', cursor: guardando ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: guardando ? .7 : 1 }}>
                  {guardando ? 'Procesando...' : !jugador.user_id ? '✅ Activar' : activo ? '🔄 Renovar' : '🔄 Reactivar'}
                </button>
                <button onClick={() => { setModalMem(false); setErrMem(''); setContrasena('') }}
                  style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Volver */}
      <button onClick={() => navigate('/admin/jugadores')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', marginBottom: '20px' }}>
        <ArrowLeft size={16}/> Volver
      </button>

      {/* Alerta datos faltantes */}
      {camposFaltantes.length > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#795548', fontSize: '.85rem' }}>⚠️ Datos incompletos</div>
            <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>Falta: {camposFaltantes.join(' · ')}</div>
          </div>
          <button onClick={() => setTab('editar')}
            style={{ padding: '7px 14px', background: '#e8710a', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700', flexShrink: 0 }}>
            ✏️ Completar datos
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          {/* Foto perfil */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f3f4', border: `3px solid ${estadoColor}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {jugador.photo_face_url
                ? <img src={jugador.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : jugador.photo_url
                ? <img src={jugador.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                : <User size={36} color="#9aa0a6"/>}
            </div>
            <label style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '26px', height: '26px', borderRadius: '50%', background: '#1a73e8', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}>
              <Camera size={12} color="#fff"/>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFoto(e.target.files[0], 'cara')} disabled={uploading.cara}/>
            </label>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: 0 }}>{jugador.name}</h1>
              <span style={{ fontSize: '.72rem', fontWeight: '700', color: estadoColor, background: estadoBg, borderRadius: '20px', padding: '3px 10px' }}>{estadoLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '.78rem', color: '#5f6368', marginBottom: '8px' }}>
              {jugador.numero_cedula   && <span>🪪 {jugador.numero_cedula}</span>}
              {(jugador.whatsapp || jugador.telefono) && <span>📞 {jugador.whatsapp || jugador.telefono}</span>}
              {jugador.city            && <span>📍 {jugador.city}</span>}
              {jugador.genero          && <span>👤 {jugador.genero}</span>}
              {jugador.fecha_nacimiento && <span>🎂 {new Date(jugador.fecha_nacimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
              {jugador.estatura        && <span>📏 {jugador.estatura}cm</span>}
              {jugador.peso            && <span>⚖️ {jugador.peso}kg</span>}
              {jugador.pie_dominante   && <span>🦶 {jugador.pie_dominante}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {jugador.posicion_futbol5  && <span style={{ fontSize: '.7rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 9px' }}>F5: {jugador.posicion_futbol5}</span>}
              {jugador.posicion_futbol7  && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '2px 9px' }}>F7: {jugador.posicion_futbol7}</span>}
              {jugador.posicion_futbol11 && <span style={{ fontSize: '.7rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 9px' }}>F11: {jugador.posicion_futbol11}</span>}
            </div>
          </div>

          {/* Botones acción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <button onClick={() => setModalMem(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: activo ? '#f1f3f4' : '#1e8e3e', border: activo ? '1px solid #dadce0' : 'none', borderRadius: '8px', cursor: 'pointer', color: activo ? '#5f6368' : '#fff', fontSize: '.8rem', fontWeight: '600' }}>
              <CreditCard size={14}/> {!jugador.user_id ? 'Activar' : activo ? 'Renovar' : 'Reactivar'}
            </button>
            {activo && (
              <button onClick={handleDesactivar}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid #fad2cf', borderRadius: '8px', cursor: 'pointer', color: '#d93025', fontSize: '.8rem' }}>
                Desactivar
              </button>
            )}
            {(jugador.whatsapp || jugador.telefono) && (
              <button onClick={abrirWhatsApp}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#25D366', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                <MessageCircle size={14}/> WhatsApp
              </button>
            )}
          </div>
        </div>

        {/* Info membresía */}
        {jugador.fecha_vencimiento && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f3f4', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '.78rem' }}>
            <div><span style={{ color: '#9aa0a6' }}>Meses pagados: </span><span style={{ fontWeight: '600', color: '#202124' }}>{jugador.meses_pagados || 0}</span></div>
            {jugador.fecha_pago && <div><span style={{ color: '#9aa0a6' }}>Último pago: </span><span style={{ fontWeight: '600', color: '#202124' }}>{new Date(jugador.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>}
            <div>
              <span style={{ color: '#9aa0a6' }}>Vencimiento: </span>
              <span style={{ fontWeight: '600', color: vencida ? '#d93025' : porVencer ? '#e8710a' : '#1e8e3e' }}>
                {new Date(jugador.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                {dias !== null && dias > 0 && ` (${dias} días)`}
                {vencida && ' (vencida)'}
              </span>
            </div>
          </div>
        )}

        {/* Fotos y documentos */}
        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.72rem', color: '#1a73e8', cursor: 'pointer', padding: '5px 12px', border: `1px solid ${jugador.photo_url ? '#1a73e8' : '#dadce0'}`, borderRadius: '8px', background: jugador.photo_url ? '#e8f0fe' : '#fff' }}>
            <Camera size={13}/> {uploading.tarjeta ? 'Subiendo...' : jugador.photo_url ? '✓ Foto tarjeta' : 'Foto tarjeta'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFoto(e.target.files[0], 'tarjeta')} disabled={uploading.tarjeta}/>
          </label>
          {jugador.photo_url && (
            <button onClick={() => handleEliminarFoto('tarjeta')} title="Eliminar foto de tarjeta (el jugador podrá subir otra)"
              style={{ display: 'flex', alignItems: 'center', fontSize: '.72rem', color: '#d93025', cursor: 'pointer', padding: '5px 10px', border: '1px solid #fad2cf', borderRadius: '8px', background: '#fff' }}>
              🗑️
            </button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.72rem', color: '#1e8e3e', cursor: 'pointer', padding: '5px 12px', border: `1px solid ${jugador.photo_face_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '8px', background: jugador.photo_face_url ? '#e6f4ea' : '#fff' }}>
            <User size={13}/> {uploading.cara ? 'Subiendo...' : jugador.photo_face_url ? '✓ Foto perfil' : 'Foto perfil'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFoto(e.target.files[0], 'cara')} disabled={uploading.cara}/>
          </label>
          {jugador.photo_face_url && (
            <button onClick={() => handleEliminarFoto('cara')} title="Eliminar foto de perfil (el jugador podrá subir otra)"
              style={{ display: 'flex', alignItems: 'center', fontSize: '.72rem', color: '#d93025', cursor: 'pointer', padding: '5px 10px', border: '1px solid #fad2cf', borderRadius: '8px', background: '#fff' }}>
              🗑️
            </button>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.72rem', color: jugador.cedula_frontal_url ? '#1e8e3e' : '#5f6368', cursor: 'pointer', padding: '5px 12px', border: `1px solid ${jugador.cedula_frontal_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '8px' }}>
            <Upload size={13}/> {uploading.frontal ? 'Subiendo...' : jugador.cedula_frontal_url ? '✓ Cédula frontal' : 'Cédula frontal'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCedula(e.target.files[0], 'frontal')} disabled={uploading.frontal}/>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.72rem', color: jugador.cedula_trasera_url ? '#1e8e3e' : '#5f6368', cursor: 'pointer', padding: '5px 12px', border: `1px solid ${jugador.cedula_trasera_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '8px' }}>
            <Upload size={13}/> {uploading.trasera ? 'Subiendo...' : jugador.cedula_trasera_url ? '✓ Cédula trasera' : 'Cédula trasera'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCedula(e.target.files[0], 'trasera')} disabled={uploading.trasera}/>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '4px', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', transition: 'all .15s', background: tab === t.id ? '#1a73e8' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <StatBox label="Partidos"    value={stats?.pj || 0}              color="#1a73e8"/>
            <StatBox label="Ganados"     value={stats?.pg || 0}              color="#1e8e3e"/>
            <StatBox label="Empatados"   value={stats?.pe || 0}              color="#e8710a"/>
            <StatBox label="Perdidos"    value={stats?.pp || 0}              color="#d93025"/>
            <StatBox label="Eficacia"    value={`${stats?.eficacia || 0}%`}  color="#6c35de"/>
            <StatBox label={esPortero ? 'Goles recibidos' : 'Goles'} value={esPortero ? (stats?.recibidos || 0) : (stats?.goles || 0)} color="#e8710a"/>
            <StatBox label="Mejor racha" value={stats?.maxRacha || 0}        color="#1e8e3e"/>
            <StatBox label="Torneos"     value={torneos.length}              color="#1a73e8"/>
          </div>
          {(jugador.cedula_frontal_url || jugador.cedula_trasera_url) && (
            <CedulasViewer jugadorId={jugador.id} frontalPath={jugador.cedula_frontal_url} traseraPath={jugador.cedula_trasera_url}/>
          )}
        </div>
      )}

      {/* ── EDITAR ── */}
      {tab === 'buscador' && (
        <BuscadorJugador playerId={id}/>
      )}

      {tab === 'editar' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '20px' }}>Datos del jugador</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={lbl}>Nombre completo *</label>
              <input value={formJugador.name} onChange={e => setFormJugador(f => ({ ...f, name: e.target.value }))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Número de cédula *</label>
              <input value={formJugador.numero_cedula} onChange={e => setFormJugador(f => ({ ...f, numero_cedula: e.target.value }))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Teléfono</label>
              <input value={formJugador.telefono} onChange={e => setFormJugador(f => ({ ...f, telefono: e.target.value }))} style={inp} placeholder="3001234567"/>
            </div>
            <div>
              <label style={lbl}>WhatsApp</label>
              <input value={formJugador.whatsapp} onChange={e => setFormJugador(f => ({ ...f, whatsapp: e.target.value }))} style={inp} placeholder="3001234567"/>
            </div>
            <div>
              <label style={lbl}>Fecha de nacimiento</label>
              <input type="date" value={formJugador.fecha_nacimiento} onChange={e => setFormJugador(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Género</label>
              <select value={formJugador.genero} onChange={e => setFormJugador(f => ({ ...f, genero: e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option>Masculino</option>
                <option>Femenino</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Ciudad</label>
              <input value={formJugador.city} onChange={e => setFormJugador(f => ({ ...f, city: e.target.value }))} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Pie dominante</label>
              <select value={formJugador.pie_dominante} onChange={e => setFormJugador(f => ({ ...f, pie_dominante: e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option>Derecho</option>
                <option>Izquierdo</option>
                <option>Ambidiestro</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Estatura (cm)</label>
              <input type="number" value={formJugador.estatura} onChange={e => setFormJugador(f => ({ ...f, estatura: e.target.value }))} style={inp} placeholder="175"/>
            </div>
            <div>
              <label style={lbl}>Peso (kg)</label>
              <input type="number" value={formJugador.peso} onChange={e => setFormJugador(f => ({ ...f, peso: e.target.value }))} style={inp} placeholder="70"/>
            </div>
            <div>
              <label style={lbl}>Posición Fútbol 5</label>
              <select value={formJugador.posicion_futbol5} onChange={e => setFormJugador(f => ({ ...f, posicion_futbol5: e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option>Portero</option><option>Cierre</option><option>Ala derecha</option><option>Ala izquierda</option><option>Pivot</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Posición Fútbol 7</label>
              <select value={formJugador.posicion_futbol7} onChange={e => setFormJugador(f => ({ ...f, posicion_futbol7: e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option>Portero</option><option>Defensa central</option><option>Lateral derecho</option><option>Lateral izquierdo</option><option>Mediocampista</option><option>Extremo derecho</option><option>Extremo izquierdo</option><option>Delantero</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Posición Fútbol 11</label>
              <select value={formJugador.posicion_futbol11} onChange={e => setFormJugador(f => ({ ...f, posicion_futbol11: e.target.value }))} style={inp}>
                <option value="">Seleccionar...</option>
                <option>Portero</option><option>Defensa central</option><option>Lateral derecho</option><option>Lateral izquierdo</option><option>Mediocampista defensivo</option><option>Mediocampista</option><option>Mediocampista ofensivo</option><option>Extremo derecho</option><option>Extremo izquierdo</option><option>Segundo delantero</option><option>Delantero centro</option>
              </select>
            </div>
          </div>
          <button onClick={handleGuardarDatos} disabled={guardandoForm}
            style={{ marginTop: '20px', padding: '10px 24px', background: guardandoForm ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: guardandoForm ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem' }}>
            {guardandoForm ? 'Guardando...' : '💾 Guardar datos'}
          </button>
        </div>
      )}

      {/* ── STATS ── */}
      {tab === 'stats' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          {stats?.pj === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9aa0a6' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
              <div>Sin partidos jugados aún</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Partidos jugados',         value: stats?.pj,                                       color: '#1a73e8', pct: 100 },
                { label: 'Victorias',                value: stats?.pg,                                       color: '#1e8e3e', pct: stats?.pj > 0 ? (stats.pg / stats.pj) * 100 : 0 },
                { label: 'Empates',                  value: stats?.pe,                                       color: '#e8710a', pct: stats?.pj > 0 ? (stats.pe / stats.pj) * 100 : 0 },
                { label: 'Derrotas',                 value: stats?.pp,                                       color: '#d93025', pct: stats?.pj > 0 ? (stats.pp / stats.pj) * 100 : 0 },
                { label: esPortero ? 'Goles recibidos' : 'Goles anotados', value: esPortero ? stats?.recibidos : stats?.goles, color: '#e8710a', pct: null },
                { label: 'Eficacia',                 value: `${stats?.eficacia || 0}%`,                      color: '#6c35de', pct: stats?.eficacia },
                { label: 'Mejor racha de victorias', value: stats?.maxRacha,                                 color: '#1e8e3e', pct: null },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '.8rem', color: '#5f6368' }}>{row.label}</span>
                    <span style={{ fontSize: '.8rem', fontWeight: '700', color: row.color }}>{row.value}</span>
                  </div>
                  {row.pct !== null && (
                    <div style={{ background: '#f1f3f4', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, row.pct)}%`, background: row.color, borderRadius: '6px', transition: 'width .4s' }}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TORNEOS ── */}
      {tab === 'torneos' && (
        <div>
          {torneos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏆</div>
              <div>No está inscrito en torneos activos</div>
            </div>
          ) : torneos.map(t => (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', cursor: 'pointer' }}
              onClick={() => navigate(`/admin/torneos/${t.tournament_id}`)}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {t.tournaments?.logo_url ? <img src={t.tournaments.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <span style={{ fontSize: '1.2rem' }}>🏆</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{t.tournaments?.name}</div>
                <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>{[t.tournaments?.modalidad, t.tournaments?.season].filter(Boolean).join(' · ')}</div>
              </div>
              {t.teams && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {t.teams.logo_url && <img src={t.teams.logo_url} style={{ width: '24px', height: '24px', objectFit: 'contain' }}/>}
                  <span style={{ fontSize: '.78rem', color: '#5f6368' }}>{t.teams.name}</span>
                </div>
              )}
              <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '20px', padding: '2px 8px' }}>Activo</span>
            </div>
          ))}
        </div>
      )}

      {/* ── TARJETA ── */}
      {tab === 'tarjeta' && (
        <div style={{ maxWidth: '380px', margin: '0 auto' }}>
          <div style={{ background: '#07070e', borderRadius: '16px', padding: '20px' }}>
            <PlayerCard
              playerName={jugador.name?.toUpperCase().split(' ')[0] || 'JUGADOR'}
              stats={cardStats}
              cardType={jugador.card_type || 'nivel1_verde'}
              esPortero={esPortero}
              photoUrlExterno={jugador.photo_url || null}
              hideShields={true}
            />
          </div>
          <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '12px 16px', fontSize: '.78rem', color: '#5f6368', display: 'flex', justifyContent: 'space-between' }}>
            <span>Tarjeta activa: <b style={{ color: '#202124' }}>{jugador.card_type || 'nivel1_verde'}</b></span>
            <span>Tarjetas vistas: <b style={{ color: '#1a73e8' }}>{(jugador.tarjetas_vistas || []).length}</b></span>
          </div>
        </div>
      )}

      {/* SANCIONES */}
      {tab === 'sanciones' && (
        <div>
          {sancionesActivas.length > 0 && (
            <div style={{ background: '#fce8e6', border: '2px solid #d93025', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '800', color: '#d93025', fontSize: '.9rem', marginBottom: '8px' }}>⛔ JUGADOR SANCIONADO — no puede jugar en ningún torneo</div>
              {sancionesActivas.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: '1px solid #fad2cf', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124' }}>{s.motivo || 'Sin motivo registrado'}</div>
                    <div style={{ fontSize: '.72rem', color: '#5f6368', marginTop: '2px' }}>
                      Desde {new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })} ·{' '}
                      {s.fecha_fin ? `hasta ${new Date(s.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}` : 'PARA SIEMPRE'}
                    </div>
                  </div>
                  <button onClick={() => handleLevantarSancion(s)}
                    style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem', fontWeight: '600', flexShrink: 0 }}>
                    Levantar sanción
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>⛔ Sancionar jugador</div>
            <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '14px' }}>
              Para faltas graves (pelear, golpear, etc.). Aplica en <b>todos los torneos</b>: no aparecerá disponible en ninguna planilla mientras dure la sanción.
              La suspensión automática de 1 fecha por tarjeta roja no se registra aquí — esa se aplica y se levanta sola.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Motivo *</label>
                <input value={formSancion.motivo} onChange={e => setFormSancion(f => ({ ...f, motivo: e.target.value }))}
                  style={{ width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', fontSize: '.875rem', boxSizing: 'border-box' }}
                  placeholder="Ej: agresión a un rival en el partido del 5 de julio"/>
              </div>
              <div>
                <label style={{ fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Duración</label>
                <select value={formSancion.duracion} onChange={e => setFormSancion(f => ({ ...f, duracion: e.target.value }))}
                  style={{ width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', fontSize: '.875rem', boxSizing: 'border-box' }}>
                  <option value="1">1 mes</option>
                  <option value="2">2 meses</option>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="8">8 meses</option>
                  <option value="12">1 año</option>
                  <option value="24">2 años</option>
                  <option value="siempre">⛔ Para siempre</option>
                </select>
              </div>
            </div>
            <button onClick={handleCrearSancion} disabled={guardandoSancion}
              style={{ padding: '10px 24px', background: guardandoSancion ? '#dadce0' : '#d93025', border: 'none', borderRadius: '8px', cursor: guardandoSancion ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
              {guardandoSancion ? 'Guardando...' : '⛔ Aplicar sanción'}
            </button>
          </div>

          {sanciones.filter(s => !sancionesActivas.includes(s)).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ padding: '12px 20px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontWeight: '700', fontSize: '.78rem', color: '#5f6368' }}>HISTORIAL DE SANCIONES</div>
              {sanciones.filter(s => !sancionesActivas.includes(s)).map((s, i, arr) => (
                <div key={s.id} style={{ padding: '10px 20px', borderBottom: i < arr.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                  <div style={{ fontSize: '.82rem', color: '#202124' }}>{s.motivo || 'Sin motivo'}</div>
                  <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '2px' }}>
                    {new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} ·{' '}
                    {!s.activa ? 'Levantada' : 'Cumplida'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
