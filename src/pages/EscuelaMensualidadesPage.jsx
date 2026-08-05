import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EscuelaPageHeader from '../components/EscuelaPageHeader'
import EscuelaFeatureCard from '../components/EscuelaFeatureCard'
import EscuelaSheetModal from '../components/EscuelaSheetModal'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', warn: '#e8710a', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const DIAS_AVISO = 3 // avisa desde 3 días antes de vencer

// Mismas fotos tenues de fondo que se usan en el resto del portal de
// escuela — una por categoría, para que se vea igual sin subir imágenes nuevas.
const IMG_VENCIDAS   = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60'
const IMG_POR_VENCER = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60'
const IMG_SIN_ACTIVAR= 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'
const IMG_AL_DIA     = 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60'

function diasRestantes(fechaVenc) {
  if (!fechaVenc) return null
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const venc = new Date(fechaVenc); venc.setHours(0,0,0,0)
  return Math.round((venc - hoy) / (1000 * 60 * 60 * 24))
}

function formatoFecha(fechaVenc) {
  return new Date(fechaVenc).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })
}

// Arma el mensaje de WhatsApp para el acudiente — cambia el texto según si
// todavía faltan días para vencer, vence hoy, o ya está vencida.
function mensajeMensualidad(j, nombreEscuela) {
  const dias = diasRestantes(j.fecha_vencimiento)
  const fechaTxt = formatoFecha(j.fecha_vencimiento)
  const nombreAcud = (j.acudiente_nombre || '').trim().split(' ')[0] || 'acudiente'
  const nombreJug = j.name || ''

  if (dias > 0) {
    return `Hola ${nombreAcud} 👋, te escribimos de *${nombreEscuela}*.\n\nEste mensaje es solo para recordarte que la mensualidad de *${nombreJug}* está pronta a vencer — quedan *${dias} día${dias === 1 ? '' : 's'}* (vence el ${fechaTxt}).\n\nQuedamos atentos a tu respuesta para ponerte al día. ¡Gracias por tu atención! ⚽🙏`
  }
  if (dias === 0) {
    return `Hola ${nombreAcud} 👋, te escribimos de *${nombreEscuela}*.\n\nEste mensaje es para recordarte que la mensualidad de *${nombreJug}* vence *hoy* (${fechaTxt}).\n\nQuedamos atentos a tu respuesta para ponerte al día. ¡Gracias por tu atención! ⚽🙏`
  }
  const vencidoHace = Math.abs(dias)
  return `Hola ${nombreAcud} 👋, te escribimos de *${nombreEscuela}*.\n\nEste mensaje es para recordarte que la mensualidad de *${nombreJug}* venció hace *${vencidoHace} día${vencidoHace === 1 ? '' : 's'}* (el ${fechaTxt}).\n\nEsperamos tu respuesta para ponerte al día. ¡Gracias por tu atención! 🙏⚽`
}

function ModalMensualidad({ jugador, onClose, onGuardar }) {
  const [meses, setMeses] = useState(1)
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    await onGuardar(jugador, meses)
    setGuardando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'22px', width:'100%', maxWidth:'380px' }}>
        <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:'4px' }}>{jugador.fecha_vencimiento ? 'Renovar mensualidad' : 'Activar mensualidad'}</div>
        <div style={{ fontSize:'.8rem', color:S.muted, marginBottom:'16px' }}>{jugador.name}</div>
        <div style={{ marginBottom:'16px' }}>
          <label style={{ fontSize:'.7rem', color:S.muted, display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }}>Meses a pagar</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[1,2,3,6,12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                style={{ flex:1, padding:'8px 4px', border: meses===m ? `2px solid ${S.green}` : `1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', background: meses===m ? S.greenDim : 'transparent', color: meses===m ? S.green : S.muted, fontWeight: meses===m?700:400, fontSize:'.78rem' }}>
                {m === 12 ? '1 año' : `${m}m`}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={handleGuardar} disabled={guardando}
            style={{ flex:1, padding:'11px', background:S.green, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.85rem', opacity:guardando?.7:1 }}>
            {guardando ? 'Guardando...' : '✓ Registrar pago'}
          </button>
          <button onClick={onClose} style={{ padding:'11px 16px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontSize:'.85rem' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function FilaJugador({ j, escuelaNombre, urgencia, onAbrirModal }) {
  const dias = diasRestantes(j.fecha_vencimiento)
  const tieneTelefono = !!(j.acudiente_telefono || '').trim()
  const color = urgencia === 'vencido' ? S.loss : urgencia === 'porVencer' ? S.warn : S.muted
  const etiqueta = urgencia === 'vencido'
    ? `Vencida hace ${Math.abs(dias)} día${Math.abs(dias)===1?'':'s'}`
    : urgencia === 'porVencer'
      ? (dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias===1?'':'s'}`)
      : urgencia === 'alDia'
        ? (j.fecha_pago ? `Pagó el ${formatoFecha(j.fecha_pago)} · vence el ${formatoFecha(j.fecha_vencimiento)}` : `Al día · vence ${formatoFecha(j.fecha_vencimiento)}`)
        : 'Sin mensualidad activa'

  function enviarWhatsApp() {
    const numero = (j.acudiente_telefono || '').replace(/\D/g, '')
    const texto = mensajeMensualidad(j, escuelaNombre)
    window.open(`https://wa.me/57${numero}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div style={{ background:S.card, border:`1px solid ${color}`, borderRadius:'14px', padding:'13px 16px', marginBottom:'10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span>👤</span>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'.88rem' }}>{j.name}</div>
          <div style={{ fontSize:'.72rem', color, fontWeight:700, marginTop:'2px' }}>{etiqueta}</div>
          <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>
            {j.acudiente_nombre ? `👪 ${j.acudiente_nombre}` : 'Sin acudiente registrado'}{tieneTelefono ? ` · 📞 ${j.acudiente_telefono}` : ''}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
        {(urgencia === 'vencido' || urgencia === 'porVencer') && (
          <button onClick={enviarWhatsApp} disabled={!tieneTelefono}
            title={tieneTelefono ? '' : 'Este jugador no tiene teléfono de acudiente registrado'}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'9px', background: tieneTelefono ? '#25D366' : S.card2, border:'none', borderRadius:'9px', cursor: tieneTelefono ? 'pointer' : 'not-allowed', color: tieneTelefono ? '#000' : S.muted, fontWeight:800, fontSize:'.78rem' }}>
            📲 {tieneTelefono ? 'Enviar recordatorio' : 'Sin teléfono'}
          </button>
        )}
        <button onClick={() => onAbrirModal(j)}
          style={{ flex: urgencia === 'alDia' || urgencia === 'sinActivar' ? 1 : 'none', padding:'9px 14px', background:'none', border:`1px solid ${S.border}`, borderRadius:'9px', cursor:'pointer', color:S.text2, fontSize:'.78rem', fontWeight:700 }}>
          💰 {j.fecha_vencimiento ? 'Renovar' : 'Activar'}
        </button>
      </div>
    </div>
  )
}

export default function EscuelaMensualidadesPage() {
  const navigate = useNavigate()
  const [profesor,  setProfesor]  = useState(null)
  const [escuela,   setEscuela]   = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modalJugador, setModalJugador] = useState(null)
  const [msg, setMsg] = useState('')
  const [abierto, setAbierto] = useState(null) // 'vencidos' | 'porVencer' | 'sinActivar' | 'alDia' | null

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.es_profesor_coordinador) { navigate('/escuela'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: tp } = await supabase.from('team_players').select('*, players(*)').eq('team_id', p.escuela_id)
    const lista = (tp || []).map(t => t.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name))
    setJugadores(lista)
    setLoading(false)
  }

  async function handleGuardarMensualidad(jugador, meses) {
    // Si ya tenía una fecha de vencimiento (esté vencida o no) el nuevo
    // periodo se cuenta desde esa fecha, no desde hoy — así los días que
    // quedó vencido se descuentan del pago en vez de regalarle días extra.
    // Solo se usa la fecha de hoy cuando nunca ha tenido mensualidad activa.
    const base = jugador.fecha_vencimiento ? new Date(jugador.fecha_vencimiento) : new Date()
    base.setMonth(base.getMonth() + meses)
    const nuevaFecha = base.toISOString()
    const { error } = await supabase.from('players').update({
      fecha_vencimiento: nuevaFecha,
      meses_pagados: (jugador.meses_pagados || 0) + meses,
      activo_membresia: true,
      fecha_pago: new Date().toISOString(),
    }).eq('id', jugador.id)
    if (!error) {
      setJugadores(prev => prev.map(j => j.id === jugador.id ? { ...j, fecha_vencimiento: nuevaFecha, meses_pagados: (j.meses_pagados||0)+meses, activo_membresia: true } : j))
      setMsg('✅ Mensualidad actualizada')
      setTimeout(() => setMsg(''), 3000)
    }
    setModalJugador(null)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.green, fontSize:'.9rem' }}>Cargando...</div>
  )

  const vencidos   = jugadores.filter(j => j.fecha_vencimiento && diasRestantes(j.fecha_vencimiento) < 0).sort((a,b) => diasRestantes(a.fecha_vencimiento) - diasRestantes(b.fecha_vencimiento))
  const porVencer  = jugadores.filter(j => j.fecha_vencimiento && diasRestantes(j.fecha_vencimiento) >= 0 && diasRestantes(j.fecha_vencimiento) <= DIAS_AVISO).sort((a,b) => diasRestantes(a.fecha_vencimiento) - diasRestantes(b.fecha_vencimiento))
  const sinActivar = jugadores.filter(j => !j.fecha_vencimiento)
  const alDia      = jugadores.filter(j => j.fecha_vencimiento && diasRestantes(j.fecha_vencimiento) > DIAS_AVISO)

  const CATEGORIAS = [
    { key:'vencidos',   titulo:'Vencidas',     icon:'🔴', bg:IMG_VENCIDAS,    accent:S.loss,  lista:vencidos,   subtitulo:'Vencidas — enviar recordatorio', desc:'Toca para ver y avisar' },
    { key:'porVencer',  titulo:'Por vencer',   icon:'🟠', bg:IMG_POR_VENCER,  accent:S.warn,  lista:porVencer,  subtitulo:`Vencen en los próximos ${DIAS_AVISO} días`, desc:`Próximos ${DIAS_AVISO} días` },
    { key:'sinActivar', titulo:'Sin activar',  icon:'⚪', bg:IMG_SIN_ACTIVAR, accent:S.muted, lista:sinActivar, subtitulo:'Nunca han pagado mensualidad', desc:'Nunca han pagado' },
    { key:'alDia',      titulo:'Al día',       icon:'✅', bg:IMG_AL_DIA,      accent:S.green, lista:alDia,      subtitulo:'Pagos al día', desc:'Pagos al día' },
  ]
  const catAbierta = CATEGORIAS.find(c => c.key === abierto)

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      {modalJugador && (
        <ModalMensualidad jugador={modalJugador} onClose={() => setModalJugador(null)} onGuardar={handleGuardarMensualidad}/>
      )}

      <EscuelaPageHeader escuela={escuela} kicker={escuela?.name} titulo="MENSUALIDADES"
        subtitulo={escuela?.categoria || 'Libre'}/>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>

        {msg && (
          <div style={{ background:S.greenDim, color:S.green, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>
        )}

        {vencidos.length === 0 && porVencer.length === 0 && sinActivar.length === 0 && (
          <div style={{ textAlign:'center', padding:'14px 20px', color:S.win, fontSize:'.85rem', fontWeight:700, marginBottom:14 }}>✓ Todas las mensualidades están al día</div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
          {CATEGORIAS.map(c => (
            <EscuelaFeatureCard key={c.key} onClick={() => setAbierto(c.key)} bg={c.bg} accent={c.accent} badge={c.lista.length}
              icon={<span style={{ fontSize:'1.5rem' }}>{c.icon}</span>}
              title={c.titulo} desc={c.desc}/>
          ))}
        </div>
      </div>

      {catAbierta && (
        <EscuelaSheetModal titulo={`${catAbierta.icon} ${catAbierta.titulo} (${catAbierta.lista.length})`} subtitulo={catAbierta.subtitulo} onClose={() => setAbierto(null)}>
          {catAbierta.lista.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 10px', color:S.muted, fontSize:'.8rem' }}>No hay jugadores en esta categoría.</div>
          ) : (
            catAbierta.lista.map(j => (
              <FilaJugador key={j.id} j={j} escuelaNombre={escuela?.name || 'la escuela'}
                urgencia={{ vencidos:'vencido', porVencer:'porVencer', sinActivar:'sinActivar', alDia:'alDia' }[catAbierta.key]}
                onAbrirModal={(jug) => { setAbierto(null); setModalJugador(jug) }}/>
            ))
          )}
        </EscuelaSheetModal>
      )}
    </div>
  )
}
