import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
  win: '#1e8e3e', loss: '#d93025',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatoFecha(iso) {
  // Evita el corrimiento de un día al parsear "YYYY-MM-DD" como UTC.
  const [y,m,d] = iso.split('-').map(Number)
  return new Date(y, m-1, d).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
}

export default function EscuelaAsistenciaPage() {
  const navigate = useNavigate()
  const [profesor,  setProfesor]  = useState(null)
  const [escuela,   setEscuela]   = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [fecha,     setFecha]     = useState(hoyISO())
  const [asistencia, setAsistencia] = useState({}) // player_id -> true|false|undefined
  const [historial, setHistorial] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cargandoFecha, setCargandoFecha] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [msg,       setMsg]       = useState('')
  const [search,    setSearch]    = useState('')

  useEffect(() => { fetchInicial() }, [])
  useEffect(() => { if (escuela) fetchAsistenciaFecha(fecha) }, [fecha, escuela])

  async function fetchInicial() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: tp } = await supabase.from('team_players').select('*, players(*)').eq('team_id', p.escuela_id)
    const lista = (tp || []).map(t => t.players).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name))
    setJugadores(lista)

    await fetchHistorial(p.escuela_id)
    setLoading(false)
  }

  async function fetchAsistenciaFecha(f) {
    if (!escuela) return
    setCargandoFecha(true)
    const { data } = await supabase.from('escuela_asistencia').select('player_id, presente').eq('escuela_id', escuela.id).eq('fecha', f)
    const mapa = {}
    ;(data || []).forEach(r => { mapa[r.player_id] = r.presente })
    setAsistencia(mapa)
    setCargandoFecha(false)
  }

  async function fetchHistorial(escuelaId) {
    const { data } = await supabase.from('escuela_asistencia').select('fecha, presente').eq('escuela_id', escuelaId).order('fecha', { ascending: false }).limit(500)
    const porFecha = {}
    ;(data || []).forEach(r => {
      if (!porFecha[r.fecha]) porFecha[r.fecha] = { presentes: 0, total: 0 }
      porFecha[r.fecha].total++
      if (r.presente) porFecha[r.fecha].presentes++
    })
    const lista = Object.entries(porFecha).map(([fecha, v]) => ({ fecha, ...v })).sort((a,b) => b.fecha.localeCompare(a.fecha)).slice(0, 8)
    setHistorial(lista)
  }

  function toggle(playerId) {
    setAsistencia(prev => {
      const cur = prev[playerId]
      const next = cur === undefined ? true : cur === true ? false : undefined
      const copia = { ...prev }
      if (next === undefined) delete copia[playerId]
      else copia[playerId] = next
      return copia
    })
  }

  async function handleGuardar() {
    const entradas = Object.entries(asistencia)
    if (entradas.length === 0) { setMsg('Marca al menos un jugador antes de guardar'); setTimeout(() => setMsg(''), 3000); return }
    setGuardando(true)
    const rows = entradas.map(([player_id, presente]) => ({
      escuela_id: escuela.id, player_id, fecha, presente, profesor_id: profesor.id, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('escuela_asistencia').upsert(rows, { onConflict: 'escuela_id,player_id,fecha' })
    setGuardando(false)
    if (error) { setMsg('Error al guardar: ' + error.message); return }
    setMsg('✅ Asistencia guardada')
    setTimeout(() => setMsg(''), 3000)
    fetchHistorial(escuela.id)
  }

  const filtrados = jugadores.filter(j => j.name.toLowerCase().includes(search.toLowerCase()))
  const cPresentes = Object.values(asistencia).filter(v => v === true).length
  const cAusentes  = Object.values(asistencia).filter(v => v === false).length
  const esHoy = fecha === hoyISO()

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'640px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escuela</button>
          <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>📋 Asistencia</div>
          <div style={{ fontSize:'.72rem', color:S.muted }}>{escuela?.name}{escuela?.categoria ? ` · ${escuela.categoria}` : ''}</div>
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'18px 16px' }}>

        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:'160px' }}>
              <label style={{ fontSize:'.68rem', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }}>Fecha del entrenamiento</label>
              <input type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)} style={inp}/>
            </div>
            {!esHoy && (
              <button onClick={() => setFecha(hoyISO())} style={{ padding:'9px 14px', background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontSize:'.78rem', fontWeight:700, alignSelf:'flex-end' }}>
                Hoy
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'12px', fontSize:'.75rem' }}>
            <span style={{ color:S.win, fontWeight:700 }}>✓ {cPresentes} presentes</span>
            <span style={{ color:S.loss, fontWeight:700 }}>✕ {cAusentes} ausentes</span>
            <span style={{ color:S.muted }}>{jugadores.length - cPresentes - cAusentes} sin marcar</span>
          </div>
        </div>

        {msg && (
          <div style={{ background:S.cyanDim, color:S.cyan, borderRadius:8, padding:'8px 12px', fontSize:'.78rem', marginBottom:14, textAlign:'center' }}>{msg}</div>
        )}

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..." style={{ ...inp, marginBottom:'14px' }}/>

        <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'8px' }}>Toca a un jugador para marcar: sin marcar → presente → ausente.</div>

        <div style={{ opacity: cargandoFecha ? .5 : 1, transition:'opacity .15s' }}>
          {filtrados.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted, fontSize:'.85rem' }}>Sin jugadores en la plantilla</div>
          ) : filtrados.map(j => {
            const estado = asistencia[j.id]
            const color = estado === true ? S.win : estado === false ? S.loss : S.border
            const bg = estado === true ? 'rgba(30,142,62,.14)' : estado === false ? 'rgba(217,48,37,.14)' : S.card
            return (
              <button key={j.id} onClick={() => toggle(j.id)}
                style={{ display:'flex', alignItems:'center', gap:'12px', width:'100%', textAlign:'left', background:bg, border:`1.5px solid ${color}`, borderRadius:'12px', padding:'11px 14px', marginBottom:'8px', cursor:'pointer' }}>
                <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span>👤</span>}
                </div>
                <div style={{ flex:1, minWidth:0, fontWeight:700, fontSize:'.88rem' }}>{j.name}</div>
                <div style={{ fontSize:'.75rem', fontWeight:800, color }}>
                  {estado === true ? '✓ Presente' : estado === false ? '✕ Ausente' : 'Sin marcar'}
                </div>
              </button>
            )
          })}
        </div>

        <button onClick={handleGuardar} disabled={guardando}
          style={{ width:'100%', padding:'13px', background:S.cyan, border:'none', borderRadius:'12px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.88rem', opacity:guardando?.7:1, marginTop:'8px' }}>
          {guardando ? 'Guardando...' : 'Guardar asistencia'}
        </button>

        {historial.length > 0 && (
          <div style={{ marginTop:'26px' }}>
            <div style={{ fontSize:'.78rem', fontWeight:700, color:S.muted, marginBottom:'10px', textTransform:'uppercase', letterSpacing:'.05em' }}>Historial reciente</div>
            {historial.map(h => (
              <button key={h.fecha} onClick={() => setFecha(h.fecha)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:S.card, border:`1px solid ${h.fecha===fecha?S.cyan:S.border}`, borderRadius:'10px', padding:'10px 14px', marginBottom:'6px', cursor:'pointer' }}>
                <span style={{ fontSize:'.8rem', color:S.text }}>{formatoFecha(h.fecha)}</span>
                <span style={{ fontSize:'.72rem', color:S.muted }}>{h.presentes}/{h.total} presentes</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
