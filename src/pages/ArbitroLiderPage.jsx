import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronDown, ChevronUp, Shield, Plus, X, Upload, Check } from 'lucide-react'
import PlanillaPartido from '../components/PlanillaPartido'
import PlanillaRapida from '../components/planillaRapida/PlanillaRapida'

const inp = { width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#7a9ab5', display:'block', marginBottom:'4px' }

const TABS = [
  { id:'sin_asignar', label:'Sin árbitro',   icon:'⚠️' },
  { id:'asignados',   label:'Asignados',      icon:'✅' },
  { id:'jugados',     label:'Jugados',        icon:'📋' },
  { id:'arbitros',    label:'Árbitros',       icon:'🟡' },
]

function rolActualLabel(p) {
  const esArbitro = p.es_arbitro || p.rol === 'arbitro'
  const esJugador = p.rol === 'jugador' || !esArbitro
  if (esArbitro && esJugador) return p.es_arbitro_lider ? 'jugador y coordinador de árbitros' : 'jugador y árbitro'
  if (esArbitro) return p.es_arbitro_lider ? 'coordinador de árbitros' : 'árbitro'
  return 'jugador'
}

function ModalNuevoArbitro({ onClose, onCreado }) {
  const [form,     setForm]     = useState({ name:'', numero_cedula:'', telefono:'', city:'' })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [fotoFile, setFotoFile] = useState(null)

  // Flujo "cédula primero": lo primero que se pide es la cédula para
  // revisar si esa persona ya existe en Golmebol antes de pedir el resto.
  const [cedulaBuscar,       setCedulaBuscar]       = useState('')
  const [buscandoCedula,     setBuscandoCedula]     = useState(false)
  const [personaEncontrada,  setPersonaEncontrada]  = useState(null)
  const [mostrarCamposNuevo, setMostrarCamposNuevo] = useState(false)

  async function handleBuscarCedula() {
    if (!cedulaBuscar.trim()) return setError('Ingresa la cédula')
    setError('')
    setBuscandoCedula(true)
    const { data } = await supabase.from('players').select('*').eq('numero_cedula', cedulaBuscar.trim()).maybeSingle()
    if (data) setPersonaEncontrada(data)
    else { setMostrarCamposNuevo(true); setForm(f => ({ ...f, numero_cedula: cedulaBuscar.trim() })) }
    setBuscandoCedula(false)
  }

  async function handleConfirmarPersonaEncontrada() {
    const existente = personaEncontrada
    if (existente.es_arbitro || existente.rol === 'arbitro') {
      setError(`${existente.name} ya está registrado como árbitro con esta cédula`)
      return
    }
    setLoading(true)
    const { data: actualizado, error: errUpd } = await supabase.from('players').update({
      es_arbitro: true, activo_membresia: true, fecha_vencimiento: null,
    }).eq('id', existente.id).select().single()
    setLoading(false)
    if (errUpd) { setError('Error: ' + errUpd.message); return }
    onCreado(actualizado); onClose()
  }

  async function handleGuardar() {
    if (!form.name || !form.numero_cedula) return setError('Nombre y cédula son obligatorios')
    setLoading(true)
    // Gratis: queda activo de inmediato, sin membresía ni vencimiento. Solo le
    // falta entrar con su cédula en /jugador/login y crear su contraseña.
    const { data, error: err } = await supabase.from('players').insert({
      ...form, rol:'arbitro', es_arbitro:true,
      activo_membresia:true, fecha_vencimiento:null, primer_ingreso:false,
    }).select().single()
    if (err) { setError('Error: ' + err.message); setLoading(false); return }
    if (fotoFile && data?.id) {
      const path = `fotos/${data.id}.${fotoFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('players').upload(path, fotoFile, { upsert:true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
        await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', data.id)
      }
    }
    onCreado(data); onClose()
  }

  // Paso 1: solo se pide la cédula
  if (!personaEncontrada && !mostrarCamposNuevo) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
        <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'400px', border:'1px solid #1e2d3d' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <div style={{ fontWeight:'700', fontSize:'1rem', color:'#e8f4fd' }}>Nuevo árbitro</div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
          </div>
          <div style={{ fontSize:'.78rem', color:'#7a9ab5', marginBottom:'16px' }}>Primero escribe su número de cédula — así revisamos si ya está registrado en Golmebol.</div>
          <div><label style={lbl}>Cédula *</label><input value={cedulaBuscar} onChange={e=>setCedulaBuscar(e.target.value)} onKeyDown={e => e.key==='Enter' && handleBuscarCedula()} style={inp} placeholder="Número de cédula" autoFocus/></div>
          {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginTop:'10px' }}>{error}</div>}
          <div style={{ display:'flex', gap:'8px', marginTop:'16px' }}>
            <button onClick={handleBuscarCedula} disabled={buscandoCedula} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:buscandoCedula?.7:1 }}>
              {buscandoCedula?'Buscando...':'Buscar'}
            </button>
            <button onClick={onClose} style={{ padding:'10px 16px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
          </div>
        </div>
      </div>
    )
  }

  // Paso 2a: ya existe alguien con esa cédula
  if (personaEncontrada) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
        <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'420px', border:'1px solid #1e2d3d' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ fontWeight:'700', fontSize:'1rem', color:'#e8f4fd' }}>Ya está registrado en Golmebol</div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
          </div>
          <div style={{ background:'rgba(0,221,208,.06)', border:'1px solid rgba(0,221,208,.2)', borderRadius:'10px', padding:'14px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'46px', height:'46px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {personaEncontrada.photo_face_url||personaEncontrada.photo_url ? <img src={personaEncontrada.photo_face_url||personaEncontrada.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.2rem' }}>👤</span>}
            </div>
            <div>
              <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>{personaEncontrada.name}</div>
              <div style={{ fontSize:'.75rem', color:'#7a9ab5', marginTop:'2px' }}>🪪 {personaEncontrada.numero_cedula} · actualmente <strong style={{ color:'#00ddd0' }}>{rolActualLabel(personaEncontrada)}</strong></div>
            </div>
          </div>
          <div style={{ fontSize:'.82rem', color:'#e8f4fd', marginBottom:'16px' }}>
            ¿Es <strong>{personaEncontrada.name}</strong> la persona que estás registrando? Si confirmas, también quedará habilitado como <strong>árbitro</strong>, con los mismos datos y la misma cuenta/contraseña para entrar a los dos portales.
          </div>
          {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'10px' }}>{error}</div>}
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleConfirmarPersonaEncontrada} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
              {loading?'Guardando...':'✓ Sí, también como árbitro'}
            </button>
            <button onClick={() => { setPersonaEncontrada(null); setCedulaBuscar(''); setError('') }} style={{ padding:'10px 16px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>No, buscar otra</button>
          </div>
        </div>
      </div>
    )
  }

  // Paso 2b: no existe — se completa el resto del formulario
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'28px', width:'420px', border:'1px solid #1e2d3d', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
          <div style={{ fontWeight:'700', fontSize:'1rem', color:'#e8f4fd' }}>Nuevo árbitro</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>
        <div style={{ fontSize:'.78rem', color:'#7a9ab5', marginBottom:'16px' }}>⚠️ No hay nadie registrado con la cédula <strong style={{ color:'#e8f4fd' }}>{form.numero_cedula}</strong>. Completa sus datos para crearlo.</div>
        <div style={{ textAlign:'center', marginBottom:'16px' }}>
          <label style={{ cursor:'pointer' }}>
            <input type="file" accept="image/*" onChange={e=>setFotoFile(e.target.files[0])} style={{ display:'none' }}/>
            <div style={{ width:'70px', height:'70px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px dashed ${fotoFile?'#00ddd0':'#2a3a4a'}`, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {fotoFile ? <img src={URL.createObjectURL(fotoFile)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'1.5rem' }}>📷</span>}
            </div>
            <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'4px' }}>Foto del árbitro</div>
          </label>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
          <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Nombre completo"/></div>
          <div><label style={lbl}>Cédula *</label><input value={form.numero_cedula} disabled style={{...inp, background:'#131e2e', color:'#7a9ab5'}}/></div>
          <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="Teléfono"/></div>
          <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} style={inp} placeholder="Ciudad"/></div>
        </div>
        <div style={{ background:'rgba(0,221,208,.06)', border:'1px solid rgba(0,221,208,.15)', borderRadius:'8px', padding:'10px 12px', marginBottom:'14px', fontSize:'.75rem', color:'#7a9ab5' }}>
          📧 <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}@golmebol.com</b> · 🔑 <b style={{ color:'#00ddd0' }}>{form.numero_cedula||'cédula'}</b>
        </div>
        {error && <div style={{ color:'#d93025', fontSize:'.8rem', marginBottom:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Creando...':'Crear árbitro'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function CardPartido({ partido, arbitros, onGuardarAsignacion, modoVer, onEditarPlanilla, onToggleSinPlanillador }) {
  const [abierto, setAbierto] = useState(false)
  // Selector propio en vez de <select> nativo: en algunos celulares (Oppo/
  // ColorOS) abrir el select del sistema sobre esta página oscura dejaba la
  // pantalla en negro. campo actualmente desplegado: 'arbitro1_id' | ... | null
  const [pickerCampo, setPickerCampo] = useState(null)
  // Selección local: los árbitros elegidos NO se guardan de inmediato — solo
  // al presionar "Listo". Antes cada click guardaba en la BD al instante y el
  // partido se pasaba a "Asignados" con un solo árbitro elegido, sin dar
  // tiempo a completar los otros dos.
  const [seleccion, setSeleccion] = useState({ arbitro1_id: partido.arbitro1_id, arbitro2_id: partido.arbitro2_id, arbitro3_id: partido.arbitro3_id })
  const [guardando, setGuardando] = useState(false)
  const p = partido

  useEffect(() => {
    if (abierto) setSeleccion({ arbitro1_id: p.arbitro1_id, arbitro2_id: p.arbitro2_id, arbitro3_id: p.arbitro3_id })
  }, [abierto])
  const esJugado = p.status === 'finished'
  const arb1 = arbitros.find(a=>a.id===p.arbitro1_id)
  const arb2 = arbitros.find(a=>a.id===p.arbitro2_id)
  const arb3 = arbitros.find(a=>a.id===p.arbitro3_id)
  const tieneArbitro = !!(p.arbitro1_id || p.arbitro2_id || p.arbitro3_id)

  return (
    <div style={{
      background:'linear-gradient(180deg, #131e2e 0%, #101a28 100%)',
      border:`1px solid ${!tieneArbitro&&!esJugado?'rgba(232,113,10,.35)':'#1c2937'}`,
      borderRadius:'16px', marginBottom:'10px', overflow:'hidden',
      boxShadow: !tieneArbitro&&!esJugado ? '0 2px 10px rgba(232,113,10,.08)' : '0 2px 8px rgba(0,0,0,.18)',
    }}>
      {/* Encabezado: fecha + torneo/jornada */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'.62rem', fontWeight:'700', color:'#00ddd0', background:'rgba(0,221,208,.08)', borderRadius:'20px', padding:'2px 9px' }}>{p.tournaments?.name}</span>
          {p.matchday && <span style={{ fontSize:'.62rem', color:'#7a9ab5', fontWeight:'600' }}>Jornada {p.matchday}</span>}
          {p.fase && p.fase!=='grupo' && <span style={{ fontSize:'.62rem', color:'#f9a825', fontWeight:'700' }}>{p.fase.toUpperCase()}</span>}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          {p.played_at ? (
            <div style={{ fontSize:'.68rem', color:'#7a9ab5', fontWeight:'600' }}>
              {new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})} · {new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}
            </div>
          ) : <div style={{ fontSize:'.65rem', color:'#7a9ab5' }}>Sin fecha</div>}
        </div>
      </div>

      {/* Partido */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 14px' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'7px', justifyContent:'flex-end', minWidth:0 }}>
          {p.home?.logo_url && <img src={p.home.logo_url} style={{ width:'24px', height:'24px', objectFit:'contain', flexShrink:0 }}/>}
          <span style={{ fontSize:'.85rem', fontWeight:'700', color:'#e8f4fd', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.home?.name}</span>
        </div>
        <div style={{ fontWeight:'900', fontSize: esJugado?'.95rem':'.72rem', color: esJugado?'#e8f4fd':'#7a9ab5', background:'#1c2937', padding:'4px 10px', borderRadius:'8px', flexShrink:0, letterSpacing:'.03em' }}>
          {esJugado ? `${p.home_score}-${p.away_score}` : 'VS'}
        </div>
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'7px', minWidth:0 }}>
          <span style={{ fontSize:'.85rem', fontWeight:'700', color:'#e8f4fd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.away?.name}</span>
          {p.away?.logo_url && <img src={p.away.logo_url} style={{ width:'24px', height:'24px', objectFit:'contain', flexShrink:0 }}/>}
        </div>
      </div>

      {/* Pie: ubicación / árbitros asignados + acción */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', padding:'10px 14px', borderTop:'1px solid #1c2937', background:'rgba(0,0,0,.15)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', minWidth:0 }}>
          {p.location && <span style={{ fontSize:'.68rem', color:'#7a9ab5' }}>📍 {p.location}</span>}
          {tieneArbitro && !esJugado && (
            <span style={{ fontSize:'.68rem', color:'#1e8e3e', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✅ {[arb1?.name,arb2?.name,arb3?.name].filter(Boolean).join(' · ')}</span>
          )}
          {p.sin_planillador && !esJugado && (
            <span style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'700' }}>⚡ Sin planillador</span>
          )}
          {!tieneArbitro && !esJugado && <span style={{ fontSize:'.68rem', color:'#e8710a', fontWeight:'600' }}>⚠️ Sin árbitro asignado</span>}
        </div>

        {!esJugado && (
          <button onClick={()=>setAbierto(!abierto)}
            style={{
              background: abierto ? '#1a73e8' : (!tieneArbitro ? 'linear-gradient(135deg,#e8710a,#f9a825)' : 'rgba(30,142,62,.12)'),
              border: abierto ? 'none' : (!tieneArbitro ? 'none' : '1px solid #1e8e3e'),
              borderRadius:'10px', padding:'8px 14px', cursor:'pointer',
              color: abierto ? '#fff' : (!tieneArbitro ? '#0d1117' : '#1e8e3e'),
              fontSize:'.75rem', fontWeight:'800', flexShrink:0, display:'flex', alignItems:'center', gap:'5px',
              boxShadow: !tieneArbitro && !abierto ? '0 2px 8px rgba(232,113,10,.35)' : 'none',
              transition:'transform .1s',
            }}>
            {abierto ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {!tieneArbitro ? 'Asignar' : 'Cambiar'}
          </button>
        )}
        {esJugado && onEditarPlanilla && (
          <button onClick={()=>onEditarPlanilla(p)}
            style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'10px', padding:'8px 14px', cursor:'pointer', color:'#7a9ab5', fontSize:'.75rem', fontWeight:'700', flexShrink:0, display:'flex', alignItems:'center', gap:'5px' }}>
            ✏️ Editar planilla
          </button>
        )}
      </div>

      {/* Panel asignación */}
      {abierto && !esJugado && (
        <div style={{ borderTop:'1px solid #1c2937', padding:'14px', background:'#0d1117' }}>
          <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#7a9ab5', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.08em' }}>🟡 Asignar árbitros</div>

          {onToggleSinPlanillador && (
            <button onClick={()=>onToggleSinPlanillador(p.id, !p.sin_planillador)}
              style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', textAlign:'left', padding:'9px 10px', marginBottom:'12px',
                background: p.sin_planillador ? 'rgba(249,168,37,.12)' : '#1c2937', border:`1px solid ${p.sin_planillador?'#f9a825':'#2a3a4a'}`, borderRadius:'9px', cursor:'pointer' }}>
              <span style={{ fontSize:'1.1rem' }}>{p.sin_planillador ? '☑️' : '⬜'}</span>
              <span style={{ flex:1 }}>
                <div style={{ fontSize:'.75rem', fontWeight:'700', color: p.sin_planillador?'#f9a825':'#e8f4fd' }}>Sin planillador</div>
                <div style={{ fontSize:'.62rem', color:'#7a9ab5' }}>Los árbitros llevan la planilla rápida (sin un planillador dedicado)</div>
              </span>
            </button>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
            {[
              { campo:'arbitro1_id', label:'Principal' },
              { campo:'arbitro2_id', label:'Asistente 1' },
              { campo:'arbitro3_id', label:'Asistente 2' },
            ].map(({campo,label})=>{
              const val = seleccion[campo]
              const seleccionado = arbitros.find(a=>a.id===val)
              const desplegado   = pickerCampo === campo
              return (
              <div key={campo}>
                <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginBottom:'4px', fontWeight:'600' }}>{label}</div>
                <button type="button" onClick={()=>setPickerCampo(desplegado?null:campo)}
                  style={{ width:'100%', background: desplegado?'#1a73e8':'#1c2937', border:`1px solid ${desplegado?'#1a73e8':val?'#00ddd0':'#2a3a4a'}`, borderRadius:'8px', padding:'7px 8px', color: desplegado?'#fff':val?'#00ddd0':'#a9bccb', fontSize:'.72rem', cursor:'pointer', boxSizing:'border-box', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'left' }}>
                  {seleccionado ? seleccionado.name : 'Sin asignar'} {desplegado?'▲':'▼'}
                </button>
              </div>
              )
            })}
          </div>
          {/* Lista de árbitros del campo desplegado (reemplaza al select nativo).
              Sin scroll interno: en algunos celulares (Oppo) el scroll dentro de
              cajas no responde — se muestra completa y se usa el scroll normal
              de la página. */}
          {pickerCampo && (
            <div style={{ marginTop:'10px', background:'#131e2e', border:'1px solid #2a3a4a', borderRadius:'10px' }}>
              <button type="button" onClick={()=>{ setSeleccion(s=>({...s,[pickerCampo]:null})); setPickerCampo(null) }}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 12px', background:'none', border:'none', borderBottom:'1px solid #1c2937', cursor:'pointer', color:'#7a9ab5', fontSize:'.78rem' }}>
                — Sin asignar
              </button>
              {arbitros.map(a=>{
                const actual = seleccion[pickerCampo] === a.id
                return (
                <button key={a.id} type="button" onClick={()=>{ setSeleccion(s=>({...s,[pickerCampo]:a.id})); setPickerCampo(null) }}
                  style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', textAlign:'left', padding:'9px 12px', background: actual?'rgba(0,221,208,.08)':'none', border:'none', borderBottom:'1px solid #1c2937', cursor:'pointer', color: actual?'#00ddd0':'#e8f4fd', fontSize:'.78rem', fontWeight: actual?'700':'500' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', overflow:'hidden', background:'#1c2937', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.7rem' }}>
                    {(a.photo_face_url||a.photo_url) ? <img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : '🟡'}
                  </div>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</span>
                  {actual && <Check size={13}/>}
                </button>
                )
              })}
            </div>
          )}
          <button onClick={async()=>{ setGuardando(true); await onGuardarAsignacion(p.id, seleccion); setGuardando(false); setAbierto(false); setPickerCampo(null) }} disabled={guardando}
            style={{ marginTop:'12px', width:'100%', padding:'9px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', opacity:guardando?.7:1 }}>
            <Check size={13}/> {guardando ? 'Guardando...' : 'Listo'}
          </button>
        </div>
      )}
    </div>
  )
}

function ModalReclamoLider({ partido, arbitros, onClose, onGuardar }) {
  const [arbitroId, setArbitroId] = useState('')
  const [tipo,      setTipo]      = useState('tecnico')
  const [desc,      setDesc]      = useState('')
  const [loading,   setLoading]   = useState(false)

  const arbsPartido = [partido.arbitro1_id, partido.arbitro2_id, partido.arbitro3_id]
    .filter(Boolean).map(aid => arbitros.find(a=>a.id===aid)).filter(Boolean)

  async function handleGuardar() {
    if (!arbitroId || !desc.trim()) return
    setLoading(true)
    await onGuardar(partido, arbitroId, tipo, desc)
    setLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#0d1117', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'440px', border:'1px solid rgba(217,48,37,.4)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <div>
            <div style={{ fontWeight:'700', color:'#e8f4fd', fontSize:'.95rem' }}>⚠️ Registrar reclamo</div>
            <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginTop:'2px' }}>
              {partido.home?.name} vs {partido.away?.name}
              {partido.played_at && ` · ${new Date(partido.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#7a9ab5' }}><X size={18}/></button>
        </div>

        {/* Árbitros del partido */}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'6px' }}>Árbitro reclamado *</label>
          {arbsPartido.length > 0 ? (
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {arbsPartido.map(a=>(
                <button key={a.id} onClick={()=>setArbitroId(a.id)}
                  style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${arbitroId===a.id?'#d93025':'#1e2d3d'}`, background:arbitroId===a.id?'rgba(217,48,37,.15)':'transparent', color:arbitroId===a.id?'#d93025':'#7a9ab5', cursor:'pointer', fontSize:'.82rem', fontWeight:'600' }}>
                  {a.name}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize:'.75rem', color:'#e8710a', marginBottom:'8px' }}>⚠️ Este partido no tiene árbitros asignados — selecciona de la lista:</div>
              <select value={arbitroId} onChange={e=>setArbitroId(e.target.value)}
                style={{ width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none' }}>
                <option value="">Seleccionar árbitro...</option>
                {arbitros.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Tipo */}
        <div style={{ marginBottom:'12px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'6px' }}>Tipo de reclamo</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[{id:'tecnico',label:'Técnico'},{id:'disciplinario',label:'Disciplinario'},{id:'comportamiento',label:'Comportamiento'}].map(t=>(
              <button key={t.id} onClick={()=>setTipo(t.id)}
                style={{ flex:1, padding:'6px', borderRadius:'7px', border:`1px solid ${tipo===t.id?'#e8710a':'#1e2d3d'}`, background:tipo===t.id?'rgba(232,113,10,.15)':'transparent', color:tipo===t.id?'#e8710a':'#7a9ab5', cursor:'pointer', fontSize:'.68rem', fontWeight:'600' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div style={{ marginBottom:'16px' }}>
          <label style={{ fontSize:'.75rem', fontWeight:'600', color:'#7a9ab5', display:'block', marginBottom:'4px' }}>Descripción *</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
            style={{ width:'100%', background:'#0d1117', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'8px 12px', color:'#e8f4fd', fontSize:'.875rem', outline:'none', resize:'vertical', boxSizing:'border-box' }}
            placeholder="Describe el reclamo en detalle..."/>
        </div>

        <div style={{ fontSize:'.72rem', color:'#7a9ab5', marginBottom:'12px', background:'rgba(232,113,10,.06)', border:'1px solid rgba(232,113,10,.15)', borderRadius:'7px', padding:'8px 10px' }}>
          📱 El árbitro recibirá una notificación de este reclamo
        </div>

        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleGuardar} disabled={loading||!arbitroId||!desc.trim()}
            style={{ flex:1, padding:'10px', background:'#d93025', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading||!arbitroId||!desc.trim()?.5:1 }}>
            {loading?'Registrando...':'Registrar reclamo'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', cursor:'pointer', color:'#7a9ab5' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroLiderPage() {
  const navigate   = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lider,    setLider]    = useState(null)
  const [partidos, setPartidos] = useState([])
  const [arbitros, setArbitros] = useState([])
  const [tab,      setTab]      = useState('sin_asignar')
  const [loading,  setLoading]  = useState(true)
  const [showNuevo,setShowNuevo]= useState(false)
  const [msg,      setMsg]      = useState(null)
  const [uploading,setUploading]= useState(null)
  const [busqArb,      setBusqArb]      = useState('')
  const [torneoFiltro, setTorneoFiltro] = useState('')
  const [modalRec,     setModalRec]     = useState(null)
  const [reclamosMap,  setReclamosMap]  = useState({})
  const [planillaPartido, setPlanillaPartido] = useState(null)

  function abrirPlanilla(p) {
    setPlanillaPartido(p)
    // Copia liviana del partido para poder reabrir la planilla DE INMEDIATO
    // si el celular recarga la página, sin esperar la red — la planilla misma
    // ya trae su propio borrador guardado.
    try { localStorage.setItem(`planilla_partido_shell_${p.id}`, JSON.stringify(p)) } catch (e) {}
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); return n }, { replace: true })
  }
  function cerrarPlanilla() {
    if (planillaPartido) { try { localStorage.removeItem(`planilla_partido_shell_${planillaPartido.id}`) } catch (e) {} }
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace: true })
    fetchTodo()
  }

  useEffect(() => {
    const matchId = searchParams.get('planilla')
    if (matchId) {
      // Restauro instantáneo desde la copia local; la consulta de abajo solo
      // reconfirma en 2do plano.
      try {
        const cached = localStorage.getItem(`planilla_partido_shell_${matchId}`)
        if (cached) setPlanillaPartido(JSON.parse(cached))
      } catch (e) {}

      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('id', matchId).single()
        .then(({ data }) => {
          if (data) {
            setPlanillaPartido(data)
            try { localStorage.setItem(`planilla_partido_shell_${matchId}`, JSON.stringify(data)) } catch (e) {}
          }
        })
    }
    fetchTodo()
    function onPageShow(e) { if (e.persisted) fetchTodo() }
    function onVisibility() { if (document.visibilityState === 'visible') fetchTodo() }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data:p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p||!p.es_arbitro_lider) { navigate('/jugador/login'); return }
    setLider(p)
    await Promise.all([fetchPartidos(), fetchArbitros()])
    setLoading(false)
  }

  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('*, tournaments(id,name,modalidad), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
      .order('played_at', { ascending: true })
    setPartidos(data||[])
    // Cargar reclamos por partido
    const { data: recs } = await supabase.from('arbitro_reclamos').select('match_id, estado, arbitro_id')
    const rm = {}
    ;(recs||[]).forEach(r => { if (!rm[r.match_id]) rm[r.match_id] = []; rm[r.match_id].push(r) })
    setReclamosMap(rm)
  }

  async function fetchArbitros() {
    const { data } = await supabase.from('players').select('id,name,photo_url,photo_face_url,activo_membresia,fecha_vencimiento,numero_cedula,telefono')
      .or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
    // Contar partidos por árbitro
    const { data: stats } = await supabase.from('matches').select('arbitro1_id,arbitro2_id,arbitro3_id,status')
    const countMap = {}
    ;(stats||[]).forEach(m=>{
      [m.arbitro1_id,m.arbitro2_id,m.arbitro3_id].filter(Boolean).forEach(aid=>{
        if (!countMap[aid]) countMap[aid]={total:0,jugados:0}
        countMap[aid].total++
        if (m.status==='finished') countMap[aid].jugados++
      })
    })
    setArbitros((data||[]).map(a=>({...a, stats:countMap[a.id]||{total:0,jugados:0}})))
  }

  async function handleGuardarAsignacion(matchId, seleccion) {
    await supabase.from('matches').update(seleccion).eq('id',matchId)
    fetchPartidos()
  }

  async function handleToggleSinPlanillador(matchId, valor) {
    await supabase.from('matches').update({ sin_planillador: valor }).eq('id', matchId)
    fetchPartidos()
  }

  async function handleActivar(arb) {
    // Los árbitros son gratis: sin membresía ni fecha de vencimiento. Si ya
    // tiene cuenta creada, basta con marcarlo activo; si no, se le crea con
    // una contraseña inicial (puede cambiarla luego con su cédula).
    try {
      if (arb.user_id) {
        await supabase.from('players').update({ activo_membresia:true, fecha_vencimiento:null }).eq('id',arb.id)
      } else {
        const email = `${arb.numero_cedula}@golmebol.com`
        const { data:authData, error:authErr } = await supabase.auth.signUp({ email, password:String(arb.numero_cedula), options:{ data:{player_id:arb.id,rol:'arbitro'} } })
        if (authErr) throw authErr
        await supabase.from('players').update({ user_id:authData.user?.id, activo_membresia:true, fecha_vencimiento:null, primer_ingreso:true }).eq('id',arb.id)
      }
      showMsgFn('✅ Acceso activado (gratis)'); fetchArbitros()
    } catch(e) { showMsgFn('Error: '+e.message,'error') }
  }

  async function handleFoto(arb, file) {
    if (!file) return
    setUploading(arb.id)
    const path = `fotos/${arb.id}.${file.name.split('.').pop()}`
    const {error} = await supabase.storage.from('players').upload(path,file,{upsert:true})
    if (!error) {
      const {data:u} = supabase.storage.from('players').getPublicUrl(path)
      await supabase.from('players').update({photo_url:u.publicUrl}).eq('id',arb.id)
      fetchArbitros()
    }
    setUploading(null)
  }

  function showMsgFn(text,type='ok') { setMsg({text,type}); setTimeout(()=>setMsg(null),3000) }

  async function registrarReclamo(partido, arbitroId, tipo, desc) {
    if (!arbitroId || !desc.trim()) return
    // Insertar reclamo
    const { data: rec } = await supabase.from('arbitro_reclamos').insert({
      match_id: partido.id, arbitro_id: arbitroId, descripcion: desc,
      tipo, estado: 'abierto', registrado_por: lider?.id,
    }).select().single()
    // Notificar al árbitro
    const arb = arbitros.find(a=>a.id===arbitroId)
    if (arb) {
      await supabase.from('notificaciones').insert({
        player_id: arbitroId,
        titulo: '⚠️ Reclamo registrado',
        mensaje: `Se registró un reclamo en el partido ${partido.home?.name} vs ${partido.away?.name}. Tipo: ${tipo}. "${desc}"`,
        tipo: 'reclamo',
        referencia_id: rec?.id,
      })
    }
    showMsgFn('Reclamo registrado — árbitro notificado ✓')
    setModalRec(null)
    fetchPartidos()
  }

  if (loading) return <div style={{ minHeight:'100vh',background:'#07070e',display:'flex',alignItems:'center',justifyContent:'center',color:'#00ddd0' }}>Cargando...</div>

  // Filtrar por torneo
  const partsFiltrados = torneoFiltro ? partidos.filter(p=>p.tournament_id===torneoFiltro) : partidos

  const sinAsignar = partsFiltrados.filter(p=>p.status!=='finished'&&!p.arbitro1_id&&!p.arbitro2_id&&!p.arbitro3_id)
  const asignados  = partsFiltrados.filter(p=>p.status!=='finished'&&(p.arbitro1_id||p.arbitro2_id||p.arbitro3_id))
  const jugados    = partsFiltrados.filter(p=>p.status==='finished')
  const pendTodos  = partsFiltrados.filter(p=>p.status!=='finished')

  const torneos = [...new Map(partidos.map(p=>[p.tournament_id,p.tournaments])).values()]

  const tabData = {
    sin_asignar: { lista:sinAsignar, color:'#e8710a', empty:'Todos los partidos tienen árbitro asignado ✓' },
    asignados:   { lista:asignados,  color:'#1e8e3e', empty:'Sin partidos asignados pendientes' },
    jugados:     { lista:jugados,    color:'#1a73e8', empty:'Sin partidos jugados' },
    arbitros:    { lista:null,       color:'#f9a825', empty:'' },
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07070e', fontFamily:'system-ui,sans-serif', color:'#e8f4fd', paddingBottom:'40px' }}>
      {msg && <div style={{ position:'fixed', top:'20px', right:'20px', zIndex:600, padding:'12px 20px', background:msg.type==='ok'?'#e6f4ea':'#fce8e6', color:msg.type==='ok'?'#1e8e3e':'#d93025', borderRadius:'10px', fontWeight:'600', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.3)' }}>{msg.text}</div>}
      {/* Modal reclamo */}
      {modalRec && (
        <ModalReclamoLider
          partido={modalRec}
          arbitros={arbitros}
          onClose={()=>setModalRec(null)}
          onGuardar={registrarReclamo}
        />
      )}

      {showNuevo && <ModalNuevoArbitro onClose={()=>setShowNuevo(false)} onCreado={()=>{ showMsgFn('Árbitro creado ✓'); fetchArbitros() }}/>}

      {planillaPartido && (
        planillaPartido.sin_planillador ? (
          <PlanillaRapida
            partido={planillaPartido}
            onClose={cerrarPlanilla}
            onGuardarResultado={() => {}}
          />
        ) : (
          <PlanillaPartido
            partido={planillaPartido}
            onClose={cerrarPlanilla}
            onGuardarResultado={() => {}}
          />
        )
      )}

      {/* Header */}
      <div style={{ background:'#0d1117', borderBottom:'0.5px solid #1e2d3d', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(249,168,37,.2)', border:'2px solid #f9a825', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:'.9rem' }}>👑</span>
          </div>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#e8f4fd' }}>{lider?.name?.split(' ')[0]}</div>
            <div style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'600' }}>{lider?.genero === 'Femenino' ? 'Coordinadora' : 'Coordinador'}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {lider?.rol!=='arbitro' && <button onClick={()=>navigate('/jugador')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#00ddd0', fontSize:'.72rem' }}>👤 Jugador</button>}
          {(lider?.es_arbitro||lider?.rol==='arbitro') && <button onClick={()=>navigate('/arbitro')} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', color:'#f9a825', fontSize:'.72rem' }}>🟡 Árbitro</button>}
          <button onClick={async()=>{ await supabase.auth.signOut(); navigate('/jugador/login') }} style={{ background:'none', border:'1px solid #1e2d3d', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#7a9ab5', display:'flex', alignItems:'center' }}><LogOut size={14}/></button>
        </div>
      </div>

      <div style={{ maxWidth:'700px', margin:'0 auto', padding:'16px' }}>

        {/* Resumen en 4 tarjetas */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
          {[
            { label:'Sin árbitro', value:sinAsignar.length, color:'#e8710a', bg:'rgba(232,113,10,.1)', border:'rgba(232,113,10,.3)', icon:'⚠️', tab:'sin_asignar' },
            { label:'Asignados',   value:asignados.length,  color:'#1e8e3e', bg:'rgba(30,142,62,.1)',  border:'rgba(30,142,62,.3)',  icon:'✅', tab:'asignados' },
            { label:'Jugados',     value:jugados.length,    color:'#1a73e8', bg:'rgba(26,115,232,.1)', border:'rgba(26,115,232,.3)', icon:'📋', tab:'jugados' },
            { label:'Árbitros',    value:arbitros.length,   color:'#f9a825', bg:'rgba(249,168,37,.1)', border:'rgba(249,168,37,.3)', icon:'🟡', tab:'arbitros' },
          ].map(s=>(
            <div key={s.tab} onClick={()=>setTab(s.tab)}
              style={{ background:tab===s.tab?s.bg:'#111827', border:`1px solid ${tab===s.tab?s.border:'#1e2d3d'}`, borderRadius:'12px', padding:'12px', textAlign:'center', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ fontSize:'1.1rem', marginBottom:'2px' }}>{s.icon}</div>
              <div style={{ fontSize:'1.5rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'.6rem', color:'#7a9ab5', marginTop:'2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtro torneo (solo para tabs de partidos) */}
        {tab !== 'arbitros' && torneos.length > 1 && (
          /* flexWrap en vez de scroll lateral: en algunos celulares el scroll
             horizontal no responde y los torneos de más quedaban invisibles */
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
            <button onClick={()=>setTorneoFiltro('')}
              style={{ flexShrink:0, padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'.72rem', whiteSpace:'nowrap', background:!torneoFiltro?'#1a73e8':'#111827', color:!torneoFiltro?'#fff':'#7a9ab5' }}>
              Todos ({partidos.filter(p=> tab==='sin_asignar'?p.status!=='finished'&&!p.arbitro1_id : tab==='asignados'?p.status!=='finished'&&(p.arbitro1_id||p.arbitro2_id) : p.status==='finished').length})
            </button>
            {torneos.map(t=>(
              <button key={t.id} onClick={()=>setTorneoFiltro(t.id)}
                style={{ flexShrink:0, padding:'5px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'.72rem', whiteSpace:'nowrap', background:torneoFiltro===t.id?'#1a73e8':'#111827', color:torneoFiltro===t.id?'#fff':'#7a9ab5' }}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Tab Sin árbitro */}
        {tab==='sin_asignar' && (
          <div>
            {sinAsignar.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#1e8e3e' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🎉</div>
                <div style={{ fontWeight:'700' }}>Todos los partidos tienen árbitro</div>
              </div>
            ) : sinAsignar.map(p=><CardPartido key={p.id} partido={p} arbitros={arbitros} onGuardarAsignacion={handleGuardarAsignacion} onToggleSinPlanillador={handleToggleSinPlanillador}/>)}
          </div>
        )}

        {/* Tab Asignados */}
        {tab==='asignados' && (
          <div>
            {asignados.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#7a9ab5' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div>Sin partidos asignados</div>
              </div>
            ) : asignados.map(p=><CardPartido key={p.id} partido={p} arbitros={arbitros} onGuardarAsignacion={handleGuardarAsignacion} onToggleSinPlanillador={handleToggleSinPlanillador}/>)}
          </div>
        )}

        {/* Tab Jugados */}
        {tab==='jugados' && (
          <div>
            {jugados.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px', background:'#111827', borderRadius:'12px', border:'1px solid #1e2d3d', color:'#7a9ab5' }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div>Sin partidos jugados</div>
              </div>
            ) : [...jugados].reverse().map(p => {
              const tieneReclamo = reclamosMap[p.id]?.length > 0
              const recAbierto   = reclamosMap[p.id]?.some(r=>r.estado==='abierto')
              const tieneArbitro = p.arbitro1_id||p.arbitro2_id||p.arbitro3_id
              return (
                <div key={p.id} style={{ marginBottom:'8px', borderRadius:'12px', overflow:'hidden', border:`1px solid ${recAbierto?'rgba(217,48,37,.5)':tieneReclamo?'rgba(217,48,37,.2)':'#1e2d3d'}`, background:recAbierto?'rgba(217,48,37,.05)':'transparent' }}>
                  <CardPartido partido={p} arbitros={arbitros} onGuardarAsignacion={handleGuardarAsignacion} onEditarPlanilla={abrirPlanilla}/>
                  <div style={{ padding:'6px 14px 10px', borderTop:'0.5px solid #1e2d3d', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', flex:1 }}>
                        {(reclamosMap[p.id]||[]).map((r,i)=>{
                          const arb = arbitros.find(a=>a.id===r.arbitro_id)
                          return <span key={i} style={{ fontSize:'.62rem', color:r.estado==='abierto'?'#d93025':r.estado==='resuelto'?'#1e8e3e':'#7a9ab5', background:r.estado==='abierto'?'rgba(217,48,37,.1)':'rgba(122,154,181,.08)', borderRadius:'5px', padding:'2px 7px' }}>⚠️ {arb?.name?.split(' ')[0]||'Árb.'} · {r.estado}</span>
                        })}
                      </div>
                      <button onClick={()=>setModalRec(p)} style={{ padding:'4px 10px', background:'none', border:'1px solid #d93025', borderRadius:'7px', cursor:'pointer', color:'#d93025', fontSize:'.72rem', fontWeight:'700', flexShrink:0 }}>⚠️ Reclamo</button>
                    </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab Árbitros */}
        {tab==='arbitros' && (
          <div>
            {/* flexWrap: antes esta fila era más ancha que la pantalla del celular
                y los botones de la derecha quedaban cortados e inalcanzables */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
              <input value={busqArb} onChange={e=>setBusqArb(e.target.value)} placeholder="Buscar árbitro..."
                style={{...inp, maxWidth:'220px'}}/>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                <button onClick={()=>navigate('/arbitro/ranking')}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(249,168,37,.1)', border:'1px solid rgba(249,168,37,.3)', borderRadius:'8px', padding:'7px 12px', cursor:'pointer', color:'#f9a825', fontSize:'.78rem', fontWeight:'700' }}>
                  🏆 Ranking
                </button>
                <button onClick={()=>navigate('/arbitro/encuestas')}
                  style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(26,115,232,.1)', border:'1px solid rgba(26,115,232,.3)', borderRadius:'8px', padding:'7px 12px', cursor:'pointer', color:'#1a73e8', fontSize:'.78rem', fontWeight:'700' }}>
                  📝 Encuestas
                </button>
                <button onClick={()=>setShowNuevo(true)}
                  style={{ display:'flex', alignItems:'center', gap:'6px', background:'#1a73e8', border:'none', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', color:'#fff', fontSize:'.82rem', fontWeight:'700' }}>
                  <Plus size={14}/> Nuevo
                </button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {arbitros.filter(a=>a.name.toLowerCase().includes(busqArb.toLowerCase())).map(a=>{
                const dias = a.fecha_vencimiento ? Math.ceil((new Date(a.fecha_vencimiento)-new Date())/86400000) : null
                const activo = a.activo_membresia && (dias===null || dias>0) // sin vencimiento = gratis, siempre activo
                return (
                  <div key={a.id} style={{ background:'#111827', border:'1px solid #1e2d3d', borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <label style={{ cursor:'pointer', flexShrink:0, position:'relative' }}>
                      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleFoto(a,e.target.files[0])}/>
                      <div style={{ width:'42px', height:'42px', borderRadius:'50%', overflow:'hidden', background:'#1e2d3d', border:`2px solid ${activo?'#00ddd0':'#2a3a4a'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {uploading===a.id?<span style={{ fontSize:'.6rem' }}>...</span>
                          :a.photo_face_url||a.photo_url?<img src={a.photo_face_url||a.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          :<span>👤</span>}
                      </div>
                      <div style={{ position:'absolute', bottom:0, right:0, width:'14px', height:'14px', background:'#1a73e8', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Upload size={7} color="#fff"/>
                      </div>
                    </label>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div onClick={()=>navigate(`/arbitro/perfil/${a.id}`)}
                        style={{ fontWeight:'700', fontSize:'.88rem', color:'#00ddd0', cursor:'pointer', textDecoration:'underline', textDecorationColor:'rgba(0,221,208,.3)' }}>{a.name}</div>
                      <div style={{ fontSize:'.68rem', color:'#7a9ab5', marginTop:'2px', display:'flex', gap:'8px' }}>
                        <span>📋 {a.stats.total} asig.</span>
                        <span style={{ color:'#1e8e3e' }}>✅ {a.stats.jugados} pitados</span>
                        {a.numero_cedula && <span>🪪 {a.numero_cedula}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      {!a.user_id?(
                        <button onClick={()=>handleActivar(a)} style={{ padding:'5px 10px', background:'#1a73e8', border:'none', borderRadius:'7px', cursor:'pointer', color:'#fff', fontSize:'.72rem', fontWeight:'700' }}>Activar</button>
                      ):activo?(
                        <div>
                          <div style={{ fontSize:'.7rem', color:'#1e8e3e', fontWeight:'700' }}>✅ Activo</div>
                          <div style={{ fontSize:'.6rem', color:'#7a9ab5' }}>{dias}d</div>
                        </div>
                      ):(
                        <button onClick={()=>handleActivar(a)} style={{ padding:'5px 10px', background:'none', border:'1px solid #e8710a', borderRadius:'7px', cursor:'pointer', color:'#e8710a', fontSize:'.72rem' }}>Renovar</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
