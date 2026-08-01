import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Upload, X, Building2 } from 'lucide-react'

const EMPTY = { name: '', telefono: '', numero_cedula: '', city: '', genero: '' }
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'8px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

function SelectorEscenarios({ escenarios, seleccionados, onToggle }) {
  if (escenarios.length === 0) return <div style={{ fontSize:'.78rem', color:'#9aa0a6' }}>Todavía no hay escenarios creados.</div>
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'160px', overflowY:'auto', border:'1px solid #dadce0', borderRadius:'8px', padding:'10px' }}>
      {escenarios.map(e => (
        <label key={e.id} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'.82rem', color:'#202124', cursor:'pointer' }}>
          <input type="checkbox" checked={seleccionados.includes(e.id)} onChange={() => onToggle(e.id)}/>
          🏟️ {e.name}{e.city ? ` · ${e.city}` : ''}
        </label>
      ))}
    </div>
  )
}

function ModalMembresia({ encargado, onClose, onActivar }) {
  const [meses,   setMeses]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const yaTieneAuth = !!encargado.user_id

  async function handleActivar() {
    setLoading(true); setError('')
    const err = await onActivar(encargado, meses, yaTieneAuth)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'28px', width:'400px', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#202124', fontSize:'1rem' }}>
              {!yaTieneAuth ? 'Activar acceso' : encargado.activo_membresia ? 'Renovar acceso' : 'Reactivar acceso'}
            </div>
            <div style={{ fontSize:'.8rem', color:'#5f6368', marginTop:'2px' }}>{encargado.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={18}/></button>
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Meses de acceso</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[1,2,3,6,12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                style={{ flex:1, padding:'8px 4px', borderRadius:'8px', border:`1px solid ${meses===m?'#1a73e8':'#dadce0'}`, background: meses===m?'#1a73e8':'#fff', color: meses===m?'#fff':'#5f6368', cursor:'pointer', fontSize:'.8rem', fontWeight:'600' }}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:'#f8f9fa', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px', fontSize:'.8rem', color:'#5f6368' }}>
          <div style={{ marginBottom:'4px' }}>📧 Email: <b>{encargado.numero_cedula}@golmebol.com</b></div>
          <div>🔑 Contraseña inicial: <b>{encargado.numero_cedula}</b></div>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'12px' }}>{error}</div>}
        <button onClick={handleActivar} disabled={loading}
          style={{ width:'100%', padding:'11px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
          {loading ? 'Procesando...' : !yaTieneAuth ? '✅ Activar acceso' : '🔄 Renovar'}
        </button>
      </div>
    </div>
  )
}

function ModalActivarEscenario({ escenario, onClose, onActivar }) {
  const [meses,   setMeses]   = useState(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleActivar() {
    setLoading(true); setError('')
    const err = await onActivar(escenario, meses)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'28px', width:'400px', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#202124', fontSize:'1rem' }}>Activar / renovar escenario</div>
            <div style={{ fontSize:'.8rem', color:'#5f6368', marginTop:'2px' }}>{escenario.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={18}/></button>
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Meses a activar</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[1,2,3,6,12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                style={{ flex:1, padding:'8px 4px', borderRadius:'8px', border:`1px solid ${meses===m?'#1e8e3e':'#dadce0'}`, background: meses===m?'#1e8e3e':'#fff', color: meses===m?'#fff':'#5f6368', cursor:'pointer', fontSize:'.8rem', fontWeight:'600' }}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'12px' }}>{error}</div>}
        <button onClick={handleActivar} disabled={loading}
          style={{ width:'100%', padding:'11px', background:'#1e8e3e', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
          {loading ? 'Procesando...' : `✅ Activar por ${meses} mes${meses>1?'es':''}`}
        </button>
      </div>
    </div>
  )
}

export default function AdminEscenariosPage() {
  const [escenarios,  setEscenarios]  = useState([])
  const [encargados,  setEncargados]  = useState([])
  const [showCrear,   setShowCrear]   = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [ciudadNueva, setCiudadNueva] = useState('')
  const [guardandoEsc,setGuardandoEsc]= useState(false)
  const [errorEsc,    setErrorEsc]    = useState('')
  const [form,        setForm]        = useState(EMPTY)
  const [editId,      setEditId]      = useState(null)
  const [showForm,    setShowForm]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [uploading,   setUploading]   = useState(null)
  const [msg,         setMsg]         = useState(null)
  const [search,      setSearch]      = useState('')
  const [modalMem,    setModalMem]    = useState(null)
  const [modalActivarEsc, setModalActivarEsc] = useState(null)

  const [cedulaBuscar,       setCedulaBuscar]       = useState('')
  const [buscandoCedula,     setBuscandoCedula]     = useState(false)
  const [personaEncontrada,  setPersonaEncontrada]  = useState(null)
  const [mostrarCamposNuevo, setMostrarCamposNuevo] = useState(false)
  const [escenariosAsignados, setEscenariosAsignados] = useState([]) // array de escenario_id — un encargado puede tener varios

  useEffect(() => { fetchEscenarios(); fetchEncargados() }, [])

  async function fetchEscenarios() {
    const { data } = await supabase.from('escenarios').select('*').order('created_at', { ascending: false })
    setEscenarios(data || [])
  }

  async function fetchEncargados() {
    const { data: players } = await supabase.from('players')
      .select('*')
      .eq('es_encargado_escenario', true)
      .order('name')
    const { data: asignaciones } = await supabase.from('escenario_encargados').select('player_id, escenarios(id, name, city)')
    const porPlayer = {}
    ;(asignaciones || []).forEach(a => {
      if (!a.escenarios) return
      porPlayer[a.player_id] = porPlayer[a.player_id] || []
      porPlayer[a.player_id].push(a.escenarios)
    })
    setEncargados((players || []).map(p => ({ ...p, escenarios: porPlayer[p.id] || [] })))
  }

  function toggleEscenarioAsignado(id) {
    setEscenariosAsignados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function sincronizarAsignaciones(playerId, ids) {
    const { error: errDel } = await supabase.from('escenario_encargados').delete().eq('player_id', playerId)
    if (errDel) return 'Error al actualizar asignaciones: ' + errDel.message
    if (ids.length > 0) {
      const { error: errIns } = await supabase.from('escenario_encargados').insert(ids.map(escenario_id => ({ escenario_id, player_id: playerId })))
      if (errIns) return 'Error al asignar escenario(s): ' + errIns.message
    }
    return null
  }

  function showMsgFn(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), type === 'error' ? 7000 : 3000)
  }

  function cerrarFormNuevo() {
    setShowForm(false); setForm(EMPTY); setEditId(null)
    setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false); setEscenariosAsignados([])
  }

  async function handleCrearEscenario() {
    setErrorEsc('')
    if (!nombreNuevo.trim()) { setErrorEsc('Ponle un nombre al escenario'); return }
    setGuardandoEsc(true)
    const { error } = await supabase.from('escenarios').insert({ name: nombreNuevo.trim(), city: ciudadNueva.trim() || null })
    setGuardandoEsc(false)
    if (error) { setErrorEsc('No se pudo crear: ' + error.message); return }
    setShowCrear(false); setNombreNuevo(''); setCiudadNueva('')
    showMsgFn('Escenario creado ✓ — ahora asignale un encargado')
    fetchEscenarios()
  }

  async function handleActivarEscenario(escenario, meses) {
    const base = escenario.fecha_vencimiento && new Date(escenario.fecha_vencimiento) > new Date() ? new Date(escenario.fecha_vencimiento) : new Date()
    base.setMonth(base.getMonth() + meses)
    const payload = { activo: true, fecha_vencimiento: base.toISOString(), meses_pagados: (escenario.meses_pagados || 0) + meses }
    const { error } = await supabase.from('escenarios').update(payload).eq('id', escenario.id)
    if (error) return 'Error al activar: ' + error.message
    showMsgFn(`✅ ${escenario.name} activado por ${meses} mes${meses>1?'es':''}`)
    setModalActivarEsc(null); fetchEscenarios(); return null
  }

  async function handleBloquearEscenario(escenario) {
    if (!confirm(`¿Bloquear "${escenario.name}"? El encargado no va a poder entrar a su portal y la página pública de reservas quedará deshabilitada hasta que lo reactives.`)) return
    const { error } = await supabase.from('escenarios').update({ activo: false }).eq('id', escenario.id)
    if (error) return showMsgFn('Error al bloquear: ' + error.message, 'error')
    showMsgFn(`🔒 ${escenario.name} bloqueado`)
    fetchEscenarios()
  }

  async function handleDesbloquearEscenario(escenario) {
    const { error } = await supabase.from('escenarios').update({ activo: true }).eq('id', escenario.id)
    if (error) return showMsgFn('Error al desbloquear: ' + error.message, 'error')
    showMsgFn(`✅ ${escenario.name} desbloqueado`)
    fetchEscenarios()
  }

  async function handleBuscarCedulaNueva() {
    if (!cedulaBuscar.trim()) return showMsgFn('Ingresa la cédula', 'error')
    setBuscandoCedula(true)
    setPersonaEncontrada(null)
    setMostrarCamposNuevo(false)
    const { data } = await supabase.from('players').select('*').eq('numero_cedula', cedulaBuscar.trim()).maybeSingle()
    if (data) {
      setPersonaEncontrada(data)
      // Si ya es encargado de otro(s) escenario(s), se los precargamos
      // seleccionados para no perderlos al guardar (un encargado puede
      // tener varios escenarios a la vez).
      if (data.es_encargado_escenario) {
        const { data: asign } = await supabase.from('escenario_encargados').select('escenario_id').eq('player_id', data.id)
        const yaAsignados = (asign || []).map(a => a.escenario_id)
        setEscenariosAsignados(prev => Array.from(new Set([...prev, ...yaAsignados])))
      }
    }
    else { setMostrarCamposNuevo(true); setForm(f => ({ ...f, numero_cedula: cedulaBuscar.trim() })) }
    setBuscandoCedula(false)
  }

  async function handleConfirmarPersonaEncontrada() {
    const existente = personaEncontrada
    setLoading(true)
    const payload = existente.es_encargado_escenario
      ? { es_encargado_escenario: true }
      : { es_encargado_escenario: true, activo_membresia: true, fecha_vencimiento: null }
    const { error } = await supabase.from('players').update(payload).eq('id', existente.id)
    if (error) { setLoading(false); return showMsgFn('Error al habilitar como encargado: ' + error.message, 'error') }
    const errSync = await sincronizarAsignaciones(existente.id, escenariosAsignados)
    setLoading(false)
    if (errSync) return showMsgFn(errSync, 'error')
    showMsgFn(`${existente.name} ahora es encargado de ${escenariosAsignados.length} escenario${escenariosAsignados.length===1?'':'s'} ✓`)
    cerrarFormNuevo()
    fetchEncargados()
  }

  async function handleSave() {
    if (!form.name)          return showMsgFn('El nombre es obligatorio', 'error')
    if (!form.numero_cedula) return showMsgFn('La cédula es obligatoria', 'error')
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('players').update(form).eq('id', editId)
      if (error) { setLoading(false); return showMsgFn('Error al guardar: ' + error.message, 'error') }
      const errSync = await sincronizarAsignaciones(editId, escenariosAsignados)
      if (errSync) showMsgFn(errSync, 'error')
      else { showMsgFn('Encargado actualizado ✓'); setEditId(null) }
    } else {
      const payload = {
        ...form, es_encargado_escenario: true,
        activo_membresia: true, fecha_vencimiento: null, primer_ingreso: false,
      }
      const { data: nuevo, error } = await supabase.from('players').insert(payload).select().single()
      let errSync = null
      if (!error && nuevo) errSync = await sincronizarAsignaciones(nuevo.id, escenariosAsignados)
      if (error) showMsgFn('Error al crear: ' + error.message, 'error')
      else if (errSync) showMsgFn(errSync, 'error')
      else showMsgFn('Encargado creado ✓ — ya puede entrar con su cédula en /jugador/login')
    }
    cerrarFormNuevo(); setLoading(false); fetchEncargados()
  }

  async function handleActivarGratis(encargado) {
    const { error } = await supabase.from('players').update({
      activo_membresia: true, fecha_vencimiento: null, primer_ingreso: false,
    }).eq('id', encargado.id)
    if (error) return showMsgFn('Error al activar', 'error')
    showMsgFn('✅ Acceso gratuito activado')
    fetchEncargados()
  }

  async function handleFoto(encargado, file) {
    if (!file) return
    setUploading(encargado.id)
    const path = `fotos/${encargado.id}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
      await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', encargado.id)
      fetchEncargados()
    }
    setUploading(null)
  }

  async function handleActivarMembresia(encargado, meses, yaTieneAuth) {
    const fechaVenc = (() => { const d = new Date(); d.setMonth(d.getMonth() + meses); return d.toISOString() })()
    const email = `${encargado.numero_cedula}@golmebol.com`
    try {
      let userId = encargado.user_id
      if (!yaTieneAuth) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email, password: String(encargado.numero_cedula),
          options: { data: { player_id: encargado.id, cedula: encargado.numero_cedula, rol: 'encargado_escenario' } }
        })
        if (authError) return 'Error al crear cuenta: ' + authError.message
        if (!authData.user) return 'No se pudo crear la cuenta.'
        userId = authData.user.id
      }
      const { error: updError } = await supabase.from('players').update({
        user_id: userId, activo_membresia: true,
        fecha_pago: new Date().toISOString(), fecha_vencimiento: fechaVenc,
        meses_pagados: (encargado.meses_pagados || 0) + meses, primer_ingreso: true,
      }).eq('id', encargado.id)
      if (updError) return 'Error al activar: ' + updError.message
      showMsgFn(`✅ Acceso activado por ${meses} mes${meses > 1 ? 'es' : ''}`)
      setModalMem(null); fetchEncargados(); return null
    } catch(e) { return 'Error: ' + e.message }
  }

  async function handleDesactivar(encargado) {
    if (!confirm(`¿Desactivar acceso de ${encargado.name}?`)) return
    await supabase.from('players').update({ activo_membresia: false }).eq('id', encargado.id)
    showMsgFn('Acceso desactivado'); fetchEncargados()
  }

  async function handleQuitarRol(encargado) {
    if (!confirm(`¿Quitar rol de encargado a ${encargado.name}?`)) return
    await supabase.from('players').update({ es_encargado_escenario: false }).eq('id', encargado.id)
    await supabase.from('escenario_encargados').delete().eq('player_id', encargado.id)
    showMsgFn('Rol de encargado removido')
    fetchEncargados()
  }

  const filtrados = encargados.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {msg && (
        <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background: msg.type==='ok'?'#e6f4ea':'#fce8e6', color: msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 12px rgba(0,0,0,.15)', maxWidth:'340px' }}>
          {msg.text}
        </div>
      )}

      {modalMem && <ModalMembresia encargado={modalMem} onClose={() => setModalMem(null)} onActivar={handleActivarMembresia}/>}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:0 }}>Escenarios Deportivos</h1>
          <p style={{ color:'#5f6368', margin:'4px 0 0', fontSize:'.875rem' }}>{escenarios.length} escenarios · {encargados.length} encargados</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => { setShowCrear(!showCrear); setErrorEsc(''); setNombreNuevo(''); setCiudadNueva('') }}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1e8e3e', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600' }}>
            <Building2 size={16}/> Crear escenario
          </button>
          <button onClick={() => { setForm(EMPTY); setEditId(null); setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false); setEscenariosAsignados([]); setShowForm(true) }}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600' }}>
            <Plus size={16}/> Encargado nuevo
          </button>
        </div>
      </div>

      {/* Crear escenario */}
      {showCrear && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'6px' }}>Crear escenario</div>
          <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'14px' }}>Ponle el nombre y la ciudad — el resto (logo, WhatsApp, horarios, precios, productos) lo termina de llenar el encargado desde su portal.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div><label style={lbl}>Nombre del escenario *</label><input value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} style={inp} placeholder="Ej: Canchas El Gol" autoFocus/></div>
            <div><label style={lbl}>Ciudad</label><input value={ciudadNueva} onChange={e => setCiudadNueva(e.target.value)} style={inp} placeholder="Ciudad"/></div>
          </div>
          {errorEsc && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'12px' }}>{errorEsc}</div>}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleCrearEscenario} disabled={guardandoEsc}
              style={{ padding:'8px 20px', background:'#1e8e3e', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:guardandoEsc?.7:1 }}>
              {guardandoEsc ? 'Creando...' : 'Crear escenario'}
            </button>
            <button onClick={() => setShowCrear(false)} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background:'#e8f0fe', border:'1px solid #aecbfa', borderRadius:'10px', padding:'14px 16px', marginBottom:'20px', fontSize:'.8rem', color:'#1a4a8c' }}>
        💡 Creá el escenario y asignale un encargado (cédula). El encargado entra con su cédula en <b>/jugador/login</b> y desde su portal (<b>/escenario</b>) termina de configurar todo: logo, imagen de fondo, WhatsApp, horarios, precios, productos y canchas.
      </div>

      {/* Lista de escenarios */}
      {escenarios.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginBottom:'24px' }}>
          {escenarios.map((e, i) => {
            const dias = e.fecha_vencimiento ? Math.ceil((new Date(e.fecha_vencimiento) - new Date()) / 86400000) : null
            const bloqueado = e.activo === false || (dias !== null && dias <= 0)
            return (
            <div key={e.id} style={{ padding:'12px 20px', borderBottom: i<escenarios.length-1?'1px solid #f1f3f4':'none', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', overflow:'hidden', background:'#f1f3f4', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {e.logo_url ? <img src={e.logo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Building2 size={16} color="#9aa0a6"/>}
              </div>
              <div style={{ flex:1, minWidth:'140px' }}>
                <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#202124' }}>{e.name}</div>
                <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>{e.city || 'Sin ciudad'}</div>
              </div>
              <div style={{ textAlign:'center', flexShrink:0 }}>
                {bloqueado ? (
                  <span style={{ fontSize:'.72rem', color:'#d93025', background:'#fce8e6', borderRadius:'6px', padding:'2px 8px', fontWeight:'600' }}>🔒 Bloqueado</span>
                ) : dias !== null ? (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                    <div style={{ fontSize:'.65rem', color:'#9aa0a6' }}>{dias}d restantes</div>
                  </div>
                ) : (
                  <span style={{ fontSize:'.72rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</span>
                )}
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => setModalActivarEsc(e)}
                  style={{ background:'#1e8e3e', border:'none', borderRadius:'6px', padding:'5px 12px', cursor:'pointer', color:'#fff', fontSize:'.8rem', fontWeight:'600' }}>
                  {bloqueado || dias === null ? 'Activar' : 'Renovar'}
                </button>
                {e.activo === false ? (
                  <button onClick={() => handleDesbloquearEscenario(e)}
                    style={{ background:'none', border:'1px solid #1a73e8', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#1a73e8', fontSize:'.8rem' }}>Desbloquear</button>
                ) : (
                  <button onClick={() => handleBloquearEscenario(e)}
                    style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#d93025', fontSize:'.8rem' }}>Bloquear</button>
                )}
                <button onClick={() => { setForm(EMPTY); setEditId(null); setCedulaBuscar(''); setPersonaEncontrada(null); setMostrarCamposNuevo(false); setEscenariosAsignados([e.id]); setShowForm(true) }}
                  style={{ background:'none', border:'1px solid #1a73e8', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#1a73e8', fontSize:'.8rem', fontWeight:'600' }}>
                  + Asignar encargado
                </button>
              </div>
              <a href={`/reservar/${e.id}`} target="_blank" rel="noreferrer"
                style={{ fontSize:'.75rem', color:'#1a73e8', textDecoration:'none', fontWeight:'600', whiteSpace:'nowrap' }}>
                Ver página pública ↗
              </a>
            </div>
            )
          })}
        </div>
      )}

      {modalActivarEsc && <ModalActivarEscenario escenario={modalActivarEsc} onClose={() => setModalActivarEsc(null)} onActivar={handleActivarEscenario}/>}

      {/* Form: editar encargado existente */}
      {showForm && editId && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'16px' }}>Editar encargado</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre del encargado"/></div>
            <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} onChange={e => setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp} placeholder="Número de cédula"/></div>
            <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
            <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Escenarios asignados</label>
              <SelectorEscenarios escenarios={escenarios} seleccionados={escenariosAsignados} onToggle={toggleEscenarioAsignado}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave} disabled={loading} style={{ padding:'8px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:loading?.7:1 }}>{loading?'Guardando...':'Actualizar'}</button>
            <button onClick={cerrarFormNuevo} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 1: cédula primero */}
      {showForm && !editId && !personaEncontrada && !mostrarCamposNuevo && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'6px' }}>Nuevo encargado</div>
          <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'14px' }}>Primero escribe su número de cédula — así revisamos si ya está registrado en Golmebol.</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <input value={cedulaBuscar} onChange={e => setCedulaBuscar(e.target.value)} onKeyDown={e => e.key==='Enter' && handleBuscarCedulaNueva()} style={{...inp, maxWidth:'260px'}} placeholder="Número de cédula" autoFocus/>
            <button onClick={handleBuscarCedulaNueva} disabled={buscandoCedula} style={{ padding:'8px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:buscandoCedula?.7:1 }}>{buscandoCedula?'Buscando...':'Buscar'}</button>
            <button onClick={cerrarFormNuevo} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 2a: ya existe una persona con esta cédula */}
      {showForm && !editId && personaEncontrada && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ background:'#e8f0fe', border:'1px solid #aecbfa', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#1a73e8', marginBottom:'10px', letterSpacing:'.05em' }}>YA ESTÁ REGISTRADO EN GOLMEBOL</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'48px', height:'48px', borderRadius:'50%', overflow:'hidden', background:'#d2e3fc', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {personaEncontrada.photo_face_url||personaEncontrada.photo_url ? <img src={personaEncontrada.photo_face_url||personaEncontrada.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.2rem' }}>👤</span>}
              </div>
              <div>
                <div style={{ fontWeight:'700', color:'#202124', fontSize:'1rem' }}>{personaEncontrada.name}</div>
                <div style={{ fontSize:'.8rem', color:'#5f6368', marginTop:'2px' }}>🪪 {personaEncontrada.numero_cedula}</div>
              </div>
            </div>
          </div>
          <div style={{ marginBottom:'16px' }}>
            <label style={lbl}>Asignar a escenario(s)</label>
            <SelectorEscenarios escenarios={escenarios} seleccionados={escenariosAsignados} onToggle={toggleEscenarioAsignado}/>
          </div>
          <div style={{ fontSize:'.85rem', color:'#202124', marginBottom:'16px' }}>
            {personaEncontrada.es_encargado_escenario
              ? <>Ya es encargado — marcá los escenarios que debe tener asignados (podés sumarle más sin quitarle los que ya tiene).</>
              : <>¿Es <strong>{personaEncontrada.name}</strong> la persona que estás registrando como encargado? Si confirmas, podrá entrar con la misma cuenta y contraseña a los dos portales.</>}
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleConfirmarPersonaEncontrada} disabled={loading} style={{ flex:1, padding:'11px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:loading?.7:1 }}>{loading?'Guardando...':`✓ Sí, registrar como encargado`}</button>
            <button onClick={() => { setPersonaEncontrada(null); setCedulaBuscar('') }} style={{ padding:'11px 16px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>No, buscar otra cédula</button>
          </div>
        </div>
      )}

      {/* Alta nueva — Paso 2b: no existe, se completan los datos */}
      {showForm && !editId && mostrarCamposNuevo && (
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', marginBottom:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:'600', color:'#202124', marginBottom:'4px' }}>Nuevo encargado</div>
          <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'14px' }}>⚠️ No hay nadie registrado con la cédula <strong>{form.numero_cedula}</strong>. Completa sus datos para crearlo.</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'14px', marginBottom:'14px' }}>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Nombre completo *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre del encargado"/></div>
            <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} disabled style={{...inp, background:'#f1f3f4', color:'#9aa0a6'}}/></div>
            <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
            <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
            <div style={{ gridColumn:'1/-1' }}><label style={lbl}>Escenarios asignados</label>
              <SelectorEscenarios escenarios={escenarios} seleccionados={escenariosAsignados} onToggle={toggleEscenarioAsignado}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave} disabled={loading} style={{ padding:'8px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:loading?.7:1 }}>{loading?'Guardando...':'Crear encargado'}</button>
            <button onClick={cerrarFormNuevo} style={{ padding:'8px 20px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.875rem' }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ marginBottom:'16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar encargado..."
          style={{...inp, maxWidth:'340px'}}/>
      </div>

      {/* Lista de encargados */}
      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#9aa0a6' }}>
            <Building2 size={36} style={{ opacity:.3, marginBottom:'8px' }}/>
            <div>No hay encargados registrados</div>
          </div>
        ) : filtrados.map((a, i) => {
          const dias = a.fecha_vencimiento ? Math.ceil((new Date(a.fecha_vencimiento) - new Date()) / 86400000) : null
          const activo = a.activo_membresia && (dias === null || dias > 0)
          return (
            <div key={a.id} style={{ padding:'14px 20px', borderBottom: i<filtrados.length-1?'1px solid #f1f3f4':'none', display:'flex', alignItems:'center', gap:'14px' }}>
              <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleFoto(a, e.target.files[0])}/>
                <div style={{ width:'46px', height:'46px', borderRadius:'50%', overflow:'hidden', background:'#f1f3f4', border:'2px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {uploading===a.id ? <div style={{ fontSize:'.6rem', color:'#9aa0a6' }}>...</div>
                    : a.photo_face_url||a.photo_url ? <img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <span style={{ fontSize:'.9rem' }}>👤</span>}
                </div>
                <div style={{ position:'absolute', bottom:0, right:0, width:'16px', height:'16px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Upload size={8} color="#fff"/>
                </div>
              </label>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                  <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>{a.name}</div>
                  {(a.escenarios||[]).map(e => (
                    <span key={e.id} style={{ fontSize:'.65rem', color:'#1e8e3e', background:'#e6f4ea', borderRadius:'20px', padding:'1px 8px', fontWeight:'600' }}>🏟️ {e.name}</span>
                  ))}
                  {(!a.escenarios || a.escenarios.length===0) && <span style={{ fontSize:'.65rem', color:'#e8710a', background:'#fce8d9', borderRadius:'20px', padding:'1px 8px', fontWeight:'600' }}>Sin escenario asignado</span>}
                </div>
                <div style={{ fontSize:'.75rem', color:'#9aa0a6', marginTop:'2px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {a.numero_cedula && <span>🪪 {a.numero_cedula}</span>}
                  {a.telefono      && <span>📞 {a.telefono}</span>}
                  {a.city          && <span>📍 {a.city}</span>}
                </div>
              </div>

              <div style={{ textAlign:'center', flexShrink:0 }}>
                {!a.user_id ? (
                  <span style={{ fontSize:'.72rem', color:'#9aa0a6', background:'#f1f3f4', borderRadius:'6px', padding:'2px 8px' }}>Sin acceso</span>
                ) : activo ? (
                  <div>
                    <div style={{ fontSize:'.72rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                    <div style={{ fontSize:'.65rem', color:'#9aa0a6' }}>gratis</div>
                  </div>
                ) : (
                  <span style={{ fontSize:'.72rem', color:'#d93025', background:'#fce8e6', borderRadius:'6px', padding:'2px 8px' }}>Vencido</span>
                )}
              </div>

              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => { setForm({ name:a.name, telefono:a.telefono||'', numero_cedula:a.numero_cedula||'', city:a.city||'', genero:a.genero||'' }); setEscenariosAsignados((a.escenarios||[]).map(e=>e.id)); setEditId(a.id); setShowForm(true) }}
                  style={{ background:'none', border:'1px solid #dadce0', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#5f6368', fontSize:'.8rem' }}>✏️</button>
                {!activo && (
                  <button onClick={() => a.user_id ? setModalMem(a) : handleActivarGratis(a)}
                    style={{ background:'#1a73e8', border:'none', borderRadius:'6px', padding:'5px 12px', cursor:'pointer', color:'#fff', fontSize:'.8rem', fontWeight:'600' }}>
                    {!a.user_id ? 'Activar gratis' : 'Reactivar'}
                  </button>
                )}
                {activo && (
                  <button onClick={() => handleDesactivar(a)}
                    style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#d93025', fontSize:'.8rem' }}>Desactivar</button>
                )}
                <button onClick={() => handleQuitarRol(a)}
                  style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color:'#d93025', fontSize:'.8rem' }}>Quitar rol</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
