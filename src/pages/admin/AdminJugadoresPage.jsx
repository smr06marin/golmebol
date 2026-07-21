import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Plus, Pencil, Trash2, Users, Upload, X, Camera, Eye, CreditCard, AlertTriangle, CheckCircle, Clock, MessageCircle, User } from 'lucide-react'

const POSICIONES = {
  'Fútbol 5':  ['Portero', 'Cierre', 'Ala derecha', 'Ala izquierda', 'Pivot'],
  'Fútbol 7':  ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista', 'Extremo derecho', 'Extremo izquierdo', 'Delantero'],
  'Fútbol 11': ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista defensivo', 'Mediocampista central', 'Mediocampista ofensivo', 'Extremo derecho', 'Extremo izquierdo', 'Delantero centro', 'Segunda punta'],
}
const GENEROS = ['Masculino', 'Femenino']
const EMPTY = {
  name: '', telefono: '', numero_cedula: '', city: '', genero: '',
  fecha_nacimiento: '', posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
}
const inp = { width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', color: '#202124', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }
const lbl = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

function diasRestantes(fechaVenc) {
  if (!fechaVenc) return null
  const diff = new Date(fechaVenc) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ModalMembresia({ jugador, onClose, onActivar }) {
  const [meses,   setMeses]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const yaTieneAuth = !!jugador.user_id

  async function handleActivar() {
    setLoading(true); setError('')
    const err = await onActivar(jugador, meses, yaTieneAuth)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>
              {!jugador.user_id ? 'Activar membresía' : jugador.activo_membresia ? 'Renovar membresía' : 'Reactivar membresía'}
            </div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '2px' }}>{jugador.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>Meses a activar</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 6, 12].map(m => (
                <button key={m} onClick={() => setMeses(m)}
                  style={{ flex: 1, padding: '8px 4px', border: meses === m ? '2px solid #1a73e8' : '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', background: meses === m ? '#e8f0fe' : '#fff', color: meses === m ? '#1a73e8' : '#5f6368', fontWeight: meses === m ? '700' : '400', fontSize: '.8rem' }}>
                  {m === 12 ? '1 año' : `${m} mes${m > 1 ? 'es' : ''}`}
                </button>
              ))}
            </div>
          </div>
          {!yaTieneAuth && (
            <div style={{ background: '#e8f0fe', borderRadius: '8px', padding: '10px 14px', fontSize: '.78rem', color: '#1a73e8' }}>
              🔐 La contraseña inicial será la cédula: <b>{jugador.numero_cedula}</b>. El jugador deberá cambiarla al primer ingreso.
            </div>
          )}
          {yaTieneAuth && (
            <div style={{ background: '#e8f0fe', borderRadius: '8px', padding: '10px 14px', fontSize: '.78rem', color: '#1a73e8' }}>
              🔐 Ya tiene cuenta creada. Solo se renovará el tiempo de acceso.
            </div>
          )}
          {error && (
            <div style={{ fontSize: '.8rem', color: '#d93025', background: '#fce8e6', borderRadius: '8px', padding: '8px 12px' }}>{error}</div>
          )}
          <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '.78rem', color: '#202124', fontWeight: '600' }}>Resumen</div>
            <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '4px' }}>
              Acceso por <b>{meses} mes{meses > 1 ? 'es' : ''}</b> · Vence el{' '}
              <b>{new Date(Date.now() + meses * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</b>
            </div>
          </div>
          <button onClick={handleActivar} disabled={loading}
            style={{ padding: '10px', background: '#1e8e3e', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: loading ? .7 : 1 }}>
            {loading ? 'Procesando...' : !jugador.user_id ? '✅ Activar membresía' : jugador.activo_membresia ? '🔄 Renovar' : '🔄 Reactivar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminJugadoresPage() {
  const navigate = useNavigate()
  const { rol } = useAuthStore()
  const [jugadores,       setJugadores]       = useState([])
  const [form,            setForm]            = useState(EMPTY)
  const [editId,          setEditId]          = useState(null)
  const [showForm,        setShowForm]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [uploading,       setUploading]       = useState({})
  const [msg,             setMsg]             = useState(null)
  const [search,          setSearch]          = useState('')
  const [filtroMembresia, setFiltroMembresia] = useState('todos')

  // Flujo "cédula primero": al crear un jugador nuevo, lo primero que se
  // pide es la cédula para revisar si esa persona ya existe en Golmebol
  // (por ejemplo, ya está registrada como árbitro) antes de pedir el resto.
  const [cedulaBuscar,       setCedulaBuscar]       = useState('')
  const [buscandoCedula,     setBuscandoCedula]     = useState(false)
  const [personaEncontrada,  setPersonaEncontrada]  = useState(null)
  const [mostrarCamposNuevo, setMostrarCamposNuevo] = useState(false)
  const [modalMembresia,  setModalMembresia]  = useState(null)
  const [modalReset,      setModalReset]      = useState(null)
  const [loadingReset,    setLoadingReset]    = useState(false)

  useEffect(() => { fetchJugadores() }, [])

  useEffect(() => {
    if (!jugadores.length) return
    const hoy = new Date()
    const vencidos = jugadores.filter(j =>
      j.activo_membresia && j.fecha_vencimiento && new Date(j.fecha_vencimiento) < hoy
    )
    if (!vencidos.length) return
    Promise.all(vencidos.map(j => supabase.from('players').update({ activo_membresia: false }).eq('id', j.id)))
      .then(() => setJugadores(prev => prev.map(j => vencidos.some(v => v.id === j.id) ? { ...j, activo_membresia: false } : j)))
  }, [jugadores])

  // Los jugadores de toda la plataforma son solo del admin principal — el
  // organizador ve los jugadores de su torneo desde el detalle de su propio
  // torneo, no desde este listado global.
  useEffect(() => { if (rol?.rol === 'organizador') navigate('/admin', { replace: true }) }, [rol])
  if (rol?.rol === 'organizador') return null

  async function fetchJugadores() {
    const { data } = await supabase.from('players').select('*').order('name')
    setJugadores(data || [])
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  function rolActualLabel(p) {
    const esArbitro = p.es_arbitro || p.rol === 'arbitro'
    const esJugador = p.rol === 'jugador' || !esArbitro
    if (esArbitro && esJugador) return p.es_arbitro_lider ? 'jugador y coordinador de árbitros' : 'jugador y árbitro'
    if (esArbitro) return p.es_arbitro_lider ? 'coordinador de árbitros' : 'árbitro'
    return 'jugador'
  }

  function cerrarFormNuevo() {
    setShowForm(false); setForm(EMPTY); setEditId(null)
    setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false)
  }

  // Paso 1 del alta: revisar si ya existe una persona con esta cédula en
  // Golmebol (en cualquier rol) antes de pedir el resto de los datos.
  async function handleBuscarCedulaNueva() {
    if (!cedulaBuscar.trim()) return showMsg('Ingresa la cédula', 'error')
    setBuscandoCedula(true)
    setPersonaEncontrada(null)
    setMostrarCamposNuevo(false)
    const { data } = await supabase.from('players').select('*').eq('numero_cedula', cedulaBuscar.trim()).maybeSingle()
    if (data) setPersonaEncontrada(data)
    else { setMostrarCamposNuevo(true); setForm(f => ({ ...f, numero_cedula: cedulaBuscar.trim() })) }
    setBuscandoCedula(false)
  }

  async function handleConfirmarPersonaEncontrada() {
    const existente = personaEncontrada
    const yaEsJugador = existente.rol === 'jugador' || !existente.es_arbitro
    if (yaEsJugador) {
      showMsg(`${existente.name} ya está registrado como jugador con esta cédula`, 'error')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('players').update({ rol: existente.rol, es_arbitro: existente.es_arbitro }).eq('id', existente.id)
    setLoading(false)
    if (error) return showMsg('Error al actualizar', 'error')
    showMsg(`${existente.name} ahora también está registrado como jugador ✓ — entra con la misma cuenta`)
    cerrarFormNuevo()
    fetchJugadores()
  }

  async function handleSave() {
    if (!form.name)          return showMsg('El nombre es obligatorio', 'error')
    if (!form.numero_cedula) return showMsg('El número de cédula es obligatorio', 'error')
    if (!form.posicion_futbol5 && !form.posicion_futbol7 && !form.posicion_futbol11)
      return showMsg('Debe seleccionar al menos una posición', 'error')
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('players').update(form).eq('id', editId)
      if (error) showMsg('Error al guardar', 'error')
      else { showMsg('Jugador actualizado ✓'); setEditId(null) }
    } else {
      const { error } = await supabase.from('players').insert({ ...form, activo_membresia: true, fecha_registro: new Date().toISOString() })
      if (error) showMsg('Error al crear', 'error')
      else showMsg('Jugador creado ✓')
    }
    setForm(EMPTY); setShowForm(false); setLoading(false); fetchJugadores()
  }

  function handleEdit(j) {
    setForm({
      name: j.name||'', telefono: j.telefono||'', numero_cedula: j.numero_cedula||'',
      city: j.city||'', genero: j.genero||'', fecha_nacimiento: j.fecha_nacimiento||'',
      posicion_futbol5: j.posicion_futbol5||'', posicion_futbol7: j.posicion_futbol7||'',
      posicion_futbol11: j.posicion_futbol11||'',
    })
    setEditId(j.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar jugador?')) return
    await supabase.from('players').delete().eq('id', id)
    fetchJugadores(); showMsg('Eliminado')
  }

  async function handleActivarMembresia(jugador, meses, yaTieneAuth) {
    const fechaVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString() })()
    const email     = `${jugador.numero_cedula}@golmebol.com`
    try {
      let userId = jugador.user_id
      if (!yaTieneAuth) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: String(jugador.numero_cedula),
          options: { data: { player_id: jugador.id, cedula: jugador.numero_cedula } }
        })
        if (authError) return 'Error al crear cuenta: ' + authError.message
        if (!authData.user) return 'No se pudo crear la cuenta.'
        userId = authData.user.id
      }
      const { error: updError } = await supabase.from('players').update({
        user_id:           userId,
        activo_membresia:  true,
        fecha_pago:        new Date().toISOString(),
        fecha_vencimiento: fechaVenc,
        meses_pagados:     (jugador.meses_pagados || 0) + meses,
        primer_ingreso:    true,
      }).eq('id', jugador.id)
      if (updError) return 'Error al activar: ' + updError.message
      showMsg(`✅ Membresía activada por ${meses} mes${meses > 1 ? 'es' : ''} ✓`)
      setModalMembresia(null)
      fetchJugadores()
      return null
    } catch (e) {
      return 'Error: ' + e.message
    }
  }

  async function handleDesactivar(jugador) {
    if (!confirm(`¿Desactivar membresía de ${jugador.name}?`)) return
    await supabase.from('players').update({ activo_membresia: false }).eq('id', jugador.id)
    showMsg('Membresía desactivada')
    fetchJugadores()
  }

  async function handleResetPassword(jugador) {
    if (!jugador.user_id) return showMsg('Este jugador no tiene cuenta', 'error')
    setLoadingReset(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://obvlyexpbbdhxwijjqyd.supabase.co/functions/v1/reset-player-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id:        jugador.user_id,
          nueva_password: String(jugador.numero_cedula),
        }),
      })
      const data = await res.json()
      if (data.error) showMsg('Error: ' + data.error, 'error')
      else {
        await supabase.from('players').update({ primer_ingreso: true }).eq('id', jugador.id)
        showMsg(`✅ Contraseña de ${jugador.name} reseteada a su cédula`)
        fetchJugadores()
      }
    } catch (e) {
      showMsg('Error: ' + e.message, 'error')
    }
    setLoadingReset(false)
    setModalReset(null)
  }

  // ── Verificación de cuentas nuevas (registradas desde la app) ────────────
  async function handleVerificarJugador(j) {
    await supabase.from('players').update({ verificado: true }).eq('id', j.id)
    showMsg(`✅ ${j.name} verificado — ya puede entrar`)
    fetchJugadores()
  }
  async function handleRechazarJugador(j) {
    if (!confirm(`¿Bloquear la cuenta de ${j.name}? No podrá entrar hasta que la reactives.`)) return
    await supabase.from('players').update({ activo_membresia: false }).eq('id', j.id)
    showMsg(`Cuenta de ${j.name} bloqueada`)
    fetchJugadores()
  }
  function abrirWhatsAppVerificacion(j) {
    const numero = (j.whatsapp || '').replace(/\D/g, '')
    const nombre = j.name?.split(' ')[0] || 'jugador'
    const texto  = `Hola ${nombre} 👋, recibimos tu registro en *Golmebol*. Para verificar tu cuenta confírmanos tu nombre completo, cédula y el equipo en el que juegas. ✅`
    window.open(`https://wa.me/57${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  function abrirWhatsApp(jugador) {
    const numero  = (jugador.whatsapp || jugador.telefono || '').replace(/\D/g, '')
    const dias    = diasRestantes(jugador.fecha_vencimiento)
    const vencida = dias !== null && dias <= 0
    const nombre  = jugador.name?.split(' ')[0] || 'jugador'
    const texto   = vencida
      ? `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* ya venció. Para seguir compitiendo en PREDIX y optar por los premios, renueva por solo $10.000. ¡Te esperamos! 🎯⚽`
      : `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* vence en *${dias} día${dias !== 1 ? 's' : ''}*. Recuerda renovarla para seguir compitiendo en PREDIX. ⚽🏆`
    window.open(`https://wa.me/57${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  function abrirWhatsAppNuevo(jugador) {
    const numero = (jugador.whatsapp || '').replace(/\D/g, '')
    const nombre = jugador.name?.split(' ')[0] || 'jugador'
    const texto  = `Hola ${nombre} 👋, vimos que te registraste en *PREDIX Golmebol*. Tu primer mes es *GRATIS* 🎁 — activa tu cuenta y compite por *$50.000* este mes. ¿Te activamos ahora?`
    window.open(`https://wa.me/57${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  async function handleFoto(jugador, file, tipo) {
    if (!file) return
    const key   = jugador.id + '_' + tipo
    setUploading(u => ({ ...u, [key]: true }))
    const ext   = file.name.split('.').pop()
    const path  = `fotos/${jugador.id}_${tipo}.${ext}`
    const campo = tipo === 'tarjeta' ? 'photo_url' : 'photo_face_url'
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (error) { setUploading(u => ({ ...u, [key]: false })); showMsg('Error al subir foto', 'error'); return }
    const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', jugador.id)
    setJugadores(prev => prev.map(j => j.id === jugador.id ? { ...j, [campo]: urlData.publicUrl } : j))
    setUploading(u => ({ ...u, [key]: false }))
    showMsg('Foto subida ✓')
  }

  async function handleCedula(jugador, file, cara) {
    if (!file) return
    const key   = jugador.id + '_' + cara
    setUploading(u => ({ ...u, [key]: true }))
    const ext   = file.name.split('.').pop()
    const path  = `${jugador.id}_${cara}.${ext}`
    const { error } = await supabase.storage.from('cedulas').upload(path, file, { upsert: true })
    if (error) { setUploading(u => ({ ...u, [key]: false })); showMsg('Error al subir cédula', 'error'); return }
    const { data: urlData } = supabase.storage.from('cedulas').getPublicUrl(path)
    const campo = cara === 'frontal' ? 'cedula_frontal_url' : 'cedula_trasera_url'
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', jugador.id)
    setJugadores(prev => prev.map(j => j.id === jugador.id ? { ...j, [campo]: urlData.publicUrl } : j))
    setUploading(u => ({ ...u, [key]: false }))
    showMsg('Cédula subida ✓')
  }

  const cActivos    = jugadores.filter(j => j.activo_membresia).length
  const cVencidos   = jugadores.filter(j => !j.activo_membresia && j.user_id && !j.whatsapp).length
  const cSinCuenta  = jugadores.filter(j => !j.user_id).length
  const cPorVencer  = jugadores.filter(j => { const d = diasRestantes(j.fecha_vencimiento); return d !== null && d > 0 && d <= 7 }).length
  const cPendientes = jugadores.filter(j => j.user_id && j.whatsapp && !j.activo_membresia).length

  const filtered = jugadores.filter(j => {
    const matchSearch = j.name?.toLowerCase().includes(search.toLowerCase()) || String(j.numero_cedula || '').includes(search)
    if (!matchSearch) return false
    if (filtroMembresia === 'activos')    return j.activo_membresia
    if (filtroMembresia === 'vencidos')   return !j.activo_membresia && j.user_id && !j.whatsapp
    if (filtroMembresia === 'sin_cuenta') return !j.user_id
    if (filtroMembresia === 'pendientes') return j.user_id && j.whatsapp && !j.activo_membresia
    return true
  })

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 9999, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)', whiteSpace: 'nowrap' }}>
          {msg.text}
        </div>
      )}

      {modalMembresia && (
        <ModalMembresia jugador={modalMembresia} onClose={() => setModalMembresia(null)} onActivar={handleActivarMembresia}/>
      )}

      {modalReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fce8e6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <AlertTriangle size={28} color="#d93025"/>
              </div>
              <div style={{ fontWeight: '700', color: '#d93025', fontSize: '1.1rem', marginBottom: '6px' }}>⚠️ Resetear contraseña</div>
              <div style={{ fontSize: '.85rem', color: '#5f6368', lineHeight: 1.5 }}>
                ¿Seguro que quieres resetear la contraseña de <b>{modalReset.name}</b>?<br/>
                La nueva contraseña será su cédula <b>{modalReset.numero_cedula}</b> y deberá cambiarla al próximo ingreso.
              </div>
            </div>
            <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '.78rem', color: '#d93025', fontWeight: '600', textAlign: 'center' }}>
              🚨 Esta acción no se puede deshacer
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModalReset(null)}
                style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontWeight: '600', fontSize: '.875rem' }}>
                Cancelar
              </button>
              <button onClick={() => handleResetPassword(modalReset)} disabled={loadingReset}
                style={{ flex: 1, padding: '10px', background: '#d93025', border: 'none', borderRadius: '10px', cursor: loadingReset ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: loadingReset ? .7 : 1 }}>
                {loadingReset ? 'Reseteando...' : '🔄 Sí, resetear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pendientes de verificación por WhatsApp ── */}
      {jugadores.filter(j => j.verificado === false && j.activo_membresia).length > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontWeight: '700', color: '#e8710a', fontSize: '.95rem', marginBottom: '4px' }}>
            ⏳ Pendientes de verificación ({jugadores.filter(j => j.verificado === false && j.activo_membresia).length})
          </div>
          <div style={{ fontSize: '.75rem', color: '#8a5a00', marginBottom: '14px' }}>
            Se registraron desde la app. Compara con el mensaje de WhatsApp que te enviaron y verifica solo si los datos coinciden.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jugadores.filter(j => j.verificado === false && j.activo_membresia).map(j => (
              <div key={j.id} style={{ background: '#fff', border: '1px solid #f1e3b0', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '.88rem' }}>{j.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#5f6368', marginTop: '2px' }}>
                    🪪 {j.numero_cedula} · 📱 {j.whatsapp || 'sin WhatsApp'}
                  </div>
                  <div style={{ fontSize: '.72rem', color: j.equipo_deseado ? '#1a73e8' : '#e8710a', marginTop: '2px', fontWeight: '600' }}>
                    {j.equipo_deseado ? `⚽ Dice jugar en: ${j.equipo_deseado}` : '🎯 Sin equipo — solo PREDIX'}
                  </div>
                  {j.fecha_registro && <div style={{ fontSize: '.65rem', color: '#9aa0a6', marginTop: '2px' }}>Registrado: {new Date(j.fecha_registro).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => abrirWhatsAppVerificacion(j)}
                    style={{ padding: '8px 12px', background: '#25d366', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.75rem', fontWeight: '700' }}>
                    📲 WhatsApp
                  </button>
                  <button onClick={() => handleVerificarJugador(j)}
                    style={{ padding: '8px 12px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.75rem', fontWeight: '700' }}>
                    ✓ Verificar
                  </button>
                  <button onClick={() => handleRechazarJugador(j)}
                    style={{ padding: '8px 12px', background: '#fff', border: '1px solid #fad2cf', borderRadius: '8px', cursor: 'pointer', color: '#d93025', fontSize: '.75rem', fontWeight: '700' }}>
                    ✗ Bloquear
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Jugadores</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{jugadores.length} registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
          <Plus size={18}/> Nuevo jugador
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Activos',    value: cActivos,    color: '#1e8e3e', bg: '#e6f4ea', icon: <CheckCircle size={16} color="#1e8e3e"/>, id: 'activos' },
          { label: 'Pendientes', value: cPendientes, color: '#1a73e8', bg: '#e8f0fe', icon: <Clock size={16} color="#1a73e8"/>,      id: 'pendientes' },
          { label: 'Vencidos',   value: cVencidos,   color: '#d93025', bg: '#fce8e6', icon: <AlertTriangle size={16} color="#d93025"/>, id: 'vencidos' },
          { label: 'Sin cuenta', value: cSinCuenta,  color: '#9aa0a6', bg: '#f1f3f4', icon: <Users size={16} color="#9aa0a6"/>,      id: 'sin_cuenta' },
          { label: 'Por vencer', value: cPorVencer,  color: '#e8710a', bg: '#fce8d9', icon: <Clock size={16} color="#e8710a"/>,      id: 'por_vencer' },
        ].map(({ label, value, color, bg, icon, id }) => (
          <div key={label} style={{ background: bg, borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => setFiltroMembresia(id)}>
            {icon}
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '.68rem', color, opacity: .8, fontWeight: '500' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {cPendientes > 0 && (
        <div style={{ background: '#e8f0fe', border: '1px solid #1a73e8', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageCircle size={18} color="#1a73e8"/>
            <div>
              <div style={{ fontWeight: '600', color: '#1a73e8', fontSize: '.875rem' }}>
                {cPendientes} jugador{cPendientes > 1 ? 'es' : ''} pendiente{cPendientes > 1 ? 's' : ''} de activación
              </div>
              <div style={{ fontSize: '.75rem', color: '#5f6368' }}>Se registraron solos — contáctalos para activar su membresía</div>
            </div>
          </div>
          <button onClick={() => setFiltroMembresia('pendientes')}
            style={{ padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
            Ver pendientes
          </button>
        </div>
      )}

      {showForm && editId && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124' }}>Editar jugador</div>
            <button onClick={cerrarFormNuevo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>Datos personales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo"/></div>
              <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="300 000 0000"/></div>
              <div><label style={lbl}>Número de cédula *</label><input value={form.numero_cedula} onChange={e => setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="000000000"/></div>
              <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
              <div>
                <label style={lbl}>Género</label>
                <select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}>
                  <option value="">Seleccionar</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Fecha de nacimiento</label><input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f=>({...f,fecha_nacimiento:e.target.value}))} style={inp}/></div>
            </div>
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px', marginTop: '8px' }}>Posiciones por modalidad</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {Object.entries(POSICIONES).map(([modalidad, posiciones]) => {
                const key = `posicion_${modalidad.toLowerCase().replace('ú','u').replace(' ','')}`
                return (
                  <div key={modalidad}>
                    <label style={lbl}>{modalidad}</label>
                    <select value={form[key]} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} style={inp}>
                      <option value="">No juega</option>
                      {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando...' : 'Actualizar'}
            </button>
            <button onClick={cerrarFormNuevo}
              style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 1: cédula primero */}
      {showForm && !editId && !personaEncontrada && !mostrarCamposNuevo && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124' }}>Nuevo jugador</div>
            <button onClick={cerrarFormNuevo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
          </div>
          <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '14px' }}>Primero escribe su número de cédula — así revisamos si ya está registrado en Golmebol.</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={cedulaBuscar} onChange={e => setCedulaBuscar(e.target.value)} onKeyDown={e => e.key==='Enter' && handleBuscarCedulaNueva()} style={{ ...inp, maxWidth: '260px' }} placeholder="Número de cédula" autoFocus/>
            <button onClick={handleBuscarCedulaNueva} disabled={buscandoCedula} style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600', opacity: buscandoCedula?.7:1 }}>{buscandoCedula?'Buscando...':'Buscar'}</button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 2a: ya existe una persona con esa cédula */}
      {showForm && !editId && personaEncontrada && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ background: '#e8f0fe', border: '1px solid #aecbfa', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#1a73e8', marginBottom: '10px', letterSpacing: '.05em' }}>YA ESTÁ REGISTRADO EN GOLMEBOL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: '#d2e3fc', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {personaEncontrada.photo_face_url||personaEncontrada.photo_url ? <img src={personaEncontrada.photo_face_url||personaEncontrada.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '1.2rem' }}>👤</span>}
              </div>
              <div>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>{personaEncontrada.name}</div>
                <div style={{ fontSize: '.8rem', color: '#5f6368', marginTop: '2px' }}>🪪 {personaEncontrada.numero_cedula} · actualmente registrado como <strong>{rolActualLabel(personaEncontrada)}</strong></div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '.85rem', color: '#202124', marginBottom: '16px' }}>
            ¿Es <strong>{personaEncontrada.name}</strong> la persona que estás registrando? Si confirmas, también quedará habilitado como <strong>jugador</strong> — con los mismos datos y podrá entrar con la misma cuenta y contraseña a los dos portales.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleConfirmarPersonaEncontrada} disabled={loading} style={{ flex: 1, padding: '11px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600', opacity: loading?.7:1 }}>{loading?'Guardando...':`✓ Sí, también registrar a ${personaEncontrada.name.split(' ')[0]} como jugador`}</button>
            <button onClick={() => { setPersonaEncontrada(null); setCedulaBuscar('') }} style={{ padding: '11px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>No, buscar otra</button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 2b: no existe, se completan los datos */}
      {showForm && !editId && mostrarCamposNuevo && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124' }}>Nuevo jugador</div>
            <button onClick={cerrarFormNuevo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
          </div>
          <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '16px' }}>⚠️ No hay nadie registrado con la cédula <strong>{form.numero_cedula}</strong>. Completa sus datos para crearlo.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>Datos personales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo"/></div>
              <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="300 000 0000"/></div>
              <div><label style={lbl}>Número de cédula *</label><input value={form.numero_cedula} disabled style={{...inp, background:'#f1f3f4', color:'#9aa0a6'}}/></div>
              <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
              <div>
                <label style={lbl}>Género</label>
                <select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}>
                  <option value="">Seleccionar</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Fecha de nacimiento</label><input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f=>({...f,fecha_nacimiento:e.target.value}))} style={inp}/></div>
            </div>
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px', marginTop: '8px' }}>Posiciones por modalidad</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {Object.entries(POSICIONES).map(([modalidad, posiciones]) => {
                const key = `posicion_${modalidad.toLowerCase().replace('ú','u').replace(' ','')}`
                return (
                  <div key={modalidad}>
                    <label style={lbl}>{modalidad}</label>
                    <select value={form[key]} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} style={inp}>
                      <option value="">No juega</option>
                      {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando...' : 'Crear jugador'}
            </button>
            <button onClick={cerrarFormNuevo}
              style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o cédula..."
          style={{ ...inp, maxWidth: '300px' }}/>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'todos',      label: `Todos (${jugadores.length})` },
            { id: 'pendientes', label: `Pendientes (${cPendientes})`, alert: cPendientes > 0 },
            { id: 'activos',    label: `Activos (${cActivos})` },
            { id: 'vencidos',   label: `Vencidos (${cVencidos})` },
            { id: 'sin_cuenta', label: `Sin cuenta (${cSinCuenta})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroMembresia(f.id)}
              style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.78rem', fontWeight: '500', background: filtroMembresia === f.id ? '#1a73e8' : f.alert ? '#e8f0fe' : '#f1f3f4', color: filtroMembresia === f.id ? '#fff' : f.alert ? '#1a73e8' : '#5f6368', transition: 'all .15s' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
            <Users size={40} style={{ opacity: .3, display: 'block', margin: '0 auto 12px' }}/>
            <div style={{ fontSize: '.875rem' }}>{search ? 'No se encontraron jugadores' : 'No hay jugadores en esta categoría'}</div>
          </div>
        ) : filtered.map((j, i) => {
          const dias        = diasRestantes(j.fecha_vencimiento)
          const vencida     = dias !== null && dias <= 0
          const porVencer   = dias !== null && dias > 0 && dias <= 7
          const activo      = j.activo_membresia && !vencida
          const esPendiente = j.user_id && j.whatsapp && !j.activo_membresia

          return (
            <div key={j.id} style={{ padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f1f3f4' : 'none', background: esPendiente ? '#f0f7ff' : vencida && !esPendiente ? '#fff8f8' : porVencer ? '#fffbf0' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f3f4', border: `2px solid ${activo ? '#1e8e3e' : esPendiente ? '#1a73e8' : vencida && j.user_id ? '#d93025' : '#e8eaed'}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {j.photo_face_url ? <img src={j.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : j.photo_url  ? <img src={j.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                      : <User size={22} color="#9aa0a6"/>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {j.name}
                      {activo      && <span style={{ fontSize: '.65rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>✓ Activo</span>}
                      {esPendiente && <span style={{ fontSize: '.65rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>⏳ Pendiente</span>}
                      {vencida && j.user_id && !esPendiente && <span style={{ fontSize: '.65rem', color: '#d93025', background: '#fce8e6', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>✗ Vencido</span>}
                      {porVencer   && <span style={{ fontSize: '.65rem', color: '#e8710a', background: '#fce8d9', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>⚠ {dias}d</span>}
                      {!j.user_id  && <span style={{ fontSize: '.65rem', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>Sin cuenta</span>}
                    </div>
                    <div style={{ color: '#9aa0a6', fontSize: '.72rem', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {j.numero_cedula && <span>🪪 {j.numero_cedula}</span>}
                      {j.whatsapp      && <span>📲 {j.whatsapp}</span>}
                      {!j.whatsapp && j.telefono && <span>📞 {j.telefono}</span>}
                      {j.city          && <span>📍 {j.city}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                      {j.posicion_futbol5  && <span style={{ fontSize: '.68rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '1px 7px' }}>F5: {j.posicion_futbol5}</span>}
                      {j.posicion_futbol7  && <span style={{ fontSize: '.68rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '1px 7px' }}>F7: {j.posicion_futbol7}</span>}
                      {j.posicion_futbol11 && <span style={{ fontSize: '.68rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '1px 7px' }}>F11: {j.posicion_futbol11}</span>}
                      {j.fecha_vencimiento && !vencida && (
                        <span style={{ fontSize: '.68rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '10px', padding: '1px 7px' }}>
                          Vence: {new Date(j.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => navigate(`/admin/jugadores/${j.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#1a73e8', fontSize: '.72rem', fontWeight: '500' }}>
                      <Eye size={12}/> Perfil
                    </button>
                    <button onClick={() => handleEdit(j)}
                      style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={14}/>
                    </button>
                    <button onClick={() => handleDelete(j.id)}
                      style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {esPendiente && (
                      <button onClick={() => abrirWhatsAppNuevo(j)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#25D366', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '700' }}>
                        <MessageCircle size={12}/> Contactar
                      </button>
                    )}
                    <button onClick={() => setModalMembresia(j)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: activo ? '#f1f3f4' : '#1e8e3e', border: activo ? '1px solid #dadce0' : 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: activo ? '#5f6368' : '#fff', fontSize: '.72rem', fontWeight: '600' }}>
                      <CreditCard size={12}/> {!j.user_id ? 'Activar' : activo ? 'Renovar' : 'Activar'}
                    </button>
                    {activo && (
                      <button onClick={() => handleDesactivar(j)}
                        style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', fontSize: '.72rem' }}>
                        Desactivar
                      </button>
                    )}
                    {j.user_id && (
                      <button onClick={() => setModalReset(j)}
                        style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', fontSize: '.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        🔄 Reset
                      </button>
                    )}
                    {(j.telefono || j.whatsapp) && (vencida || porVencer) && !esPendiente && (
                      <button onClick={() => abrirWhatsApp(j)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#25D366', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '600' }}>
                        <MessageCircle size={12}/> WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.68rem', color: '#1a73e8', cursor: 'pointer', padding: '3px 9px', border: `1px solid ${j.photo_url ? '#1a73e8' : '#dadce0'}`, borderRadius: '6px', background: j.photo_url ? '#e8f0fe' : 'transparent' }}>
                  <Camera size={12}/> {uploading[j.id+'_tarjeta'] ? 'Subiendo...' : j.photo_url ? '✓ Foto tarjeta' : 'Foto tarjeta'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFoto(j, e.target.files[0], 'tarjeta')} disabled={uploading[j.id+'_tarjeta']}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.68rem', color: '#1e8e3e', cursor: 'pointer', padding: '3px 9px', border: `1px solid ${j.photo_face_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px', background: j.photo_face_url ? '#e6f4ea' : 'transparent' }}>
                  <User size={12}/> {uploading[j.id+'_cara'] ? 'Subiendo...' : j.photo_face_url ? '✓ Foto perfil' : 'Foto perfil'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFoto(j, e.target.files[0], 'cara')} disabled={uploading[j.id+'_cara']}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.68rem', color: j.cedula_frontal_url ? '#1e8e3e' : '#5f6368', cursor: 'pointer', padding: '3px 9px', border: `1px solid ${j.cedula_frontal_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px' }}>
                  <Upload size={12}/> {uploading[j.id+'_frontal'] ? 'Subiendo...' : j.cedula_frontal_url ? '✓ Cédula frontal' : 'Cédula frontal'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCedula(j, e.target.files[0], 'frontal')} disabled={uploading[j.id+'_frontal']}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.68rem', color: j.cedula_trasera_url ? '#1e8e3e' : '#5f6368', cursor: 'pointer', padding: '3px 9px', border: `1px solid ${j.cedula_trasera_url ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px' }}>
                  <Upload size={12}/> {uploading[j.id+'_trasera'] ? 'Subiendo...' : j.cedula_trasera_url ? '✓ Cédula trasera' : 'Cédula trasera'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCedula(j, e.target.files[0], 'trasera')} disabled={uploading[j.id+'_trasera']}/>
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
>
  )
}