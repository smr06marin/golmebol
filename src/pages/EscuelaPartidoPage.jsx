import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

const MAX_FIELD = 11

const FORMATIONS = {
  'Fútbol 11': {
    '4-4-2': [{pos:'POR',x:50,y:90},{pos:'LD',x:12,y:72},{pos:'DFC',x:33,y:72},{pos:'DFC',x:67,y:72},{pos:'LI',x:88,y:72},{pos:'MD',x:12,y:50},{pos:'MC',x:37,y:50},{pos:'MC',x:63,y:50},{pos:'MI',x:88,y:50},{pos:'DC',x:35,y:22},{pos:'DC',x:65,y:22}],
    '4-3-3': [{pos:'POR',x:50,y:90},{pos:'LD',x:12,y:72},{pos:'DFC',x:33,y:72},{pos:'DFC',x:67,y:72},{pos:'LI',x:88,y:72},{pos:'MC',x:25,y:50},{pos:'MC',x:50,y:50},{pos:'MC',x:75,y:50},{pos:'EX',x:12,y:22},{pos:'DC',x:50,y:18},{pos:'EX',x:88,y:22}],
    '4-2-3-1': [{pos:'POR',x:50,y:90},{pos:'LD',x:12,y:74},{pos:'DFC',x:33,y:74},{pos:'DFC',x:67,y:74},{pos:'LI',x:88,y:74},{pos:'MCD',x:33,y:55},{pos:'MCD',x:67,y:55},{pos:'EX',x:12,y:35},{pos:'CAM',x:50,y:35},{pos:'EX',x:88,y:35},{pos:'DC',x:50,y:14}],
    '3-5-2': [{pos:'POR',x:50,y:90},{pos:'DFC',x:22,y:74},{pos:'DFC',x:50,y:74},{pos:'DFC',x:78,y:74},{pos:'MI',x:8,y:52},{pos:'MC',x:28,y:52},{pos:'MC',x:50,y:52},{pos:'MC',x:72,y:52},{pos:'MD',x:92,y:52},{pos:'DC',x:33,y:20},{pos:'DC',x:67,y:20}],
  },
  'Fútbol 8': {
    '3-3-1': [{pos:'POR',x:50,y:90},{pos:'DFC',x:22,y:70},{pos:'DFC',x:50,y:70},{pos:'DFC',x:78,y:70},{pos:'MC',x:22,y:46},{pos:'MC',x:50,y:46},{pos:'MC',x:78,y:46},{pos:'DC',x:50,y:18}],
    '3-2-2': [{pos:'POR',x:50,y:90},{pos:'DFC',x:22,y:70},{pos:'DFC',x:50,y:70},{pos:'DFC',x:78,y:70},{pos:'MC',x:33,y:48},{pos:'MC',x:67,y:48},{pos:'DC',x:33,y:20},{pos:'DC',x:67,y:20}],
  },
  'Fútbol 7': {
    '2-3-1': [{pos:'POR',x:50,y:90},{pos:'DFC',x:28,y:70},{pos:'DFC',x:72,y:70},{pos:'MC',x:18,y:48},{pos:'MC',x:50,y:48},{pos:'MC',x:82,y:48},{pos:'DC',x:50,y:18}],
    '3-2-1': [{pos:'POR',x:50,y:90},{pos:'DFC',x:20,y:72},{pos:'DFC',x:50,y:72},{pos:'DFC',x:80,y:72},{pos:'MC',x:33,y:48},{pos:'MC',x:67,y:48},{pos:'DC',x:50,y:18}],
  },
  'Microfútbol': {
    '1-2-1': [{pos:'POR',x:50,y:90},{pos:'DFC',x:30,y:62},{pos:'DFC',x:70,y:62},{pos:'DC',x:50,y:22}],
    '2-1-1': [{pos:'POR',x:50,y:90},{pos:'DFC',x:28,y:68},{pos:'DFC',x:72,y:68},{pos:'MC',x:50,y:48},{pos:'DC',x:50,y:20}],
  },
}

const STYLES = {
  'Clásico': { bg:'#2a6030', lines:'rgba(255,255,255,.65)', alt:'#265528' },
  'UEFA': { bg:'#14401a', lines:'rgba(255,255,255,.75)', alt:'#103514' },
  'Futurista': { bg:'#070f20', lines:'rgba(0,200,255,.55)', alt:'#0a162c' },
  'Oscuro': { bg:'#111', lines:'rgba(255,255,255,.28)', alt:'#191919' },
  'Táctico': { bg:'#0a1a2e', lines:'rgba(80,140,255,.6)', alt:'#0d2040' },
}

const POS_COL = { POR:'#f59e0b', DFC:'#3b82f6', LD:'#3b82f6', LI:'#3b82f6', MC:'#10b981', MCD:'#10b981', CAM:'#10b981', MI:'#10b981', MD:'#10b981', DC:'#ef4444', EX:'#a855f7' }
const EV_ICONS = { goal:'⚽', assist:'🎯', yellow:'🟨', blue:'🟦', red:'🟥', sub:'🔄', highlight:'⭐', injury:'🩹', mvp:'👑', note:'📝', save:'🧤', goal_against:'🥅' }
const EV_ITEMS = [
  { t:'goal', l:'⚽ Gol' }, { t:'assist', l:'🎯 Asist.' }, { t:'yellow', l:'🟨 Amarilla' },
  { t:'blue', l:'🟦 Azul' }, { t:'red', l:'🟥 Roja' }, { t:'mvp', l:'👑 Destacado' },
  { t:'injury', l:'🩹 Lesión' }, { t:'highlight', l:'⭐ Buena jugada' }, { t:'note', l:'📝 Nota' },
]

const evBtn = { background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.15)', color:'#fff', borderRadius:6, padding:'7px 3px', fontSize:10, fontWeight:700, cursor:'pointer' }
const navBtn = (active) => ({ border:`1px solid ${active?S.cyan:S.border}`, background:active?S.cyanDim:'transparent', color:active?S.cyan:S.muted, borderRadius:8, padding:'6px 10px', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' })

function fmtTime(sec) {
  const m = String(Math.floor(sec/60)).padStart(2,'0'), s = String(sec%60).padStart(2,'0')
  return `${m}:${s}`
}

function PlayerCard({ p, size='sm', selected, dropTarget }) {
  const w = size==='sm' ? 58 : 76, h = size==='sm' ? 80 : 102
  const posColor = POS_COL[p.slotPos] || S.cyan
  const border = selected ? `2px solid ${S.cyan}` : dropTarget ? '2px solid #ff6b00' : '1px solid rgba(255,255,255,.25)'
  const shadow = selected ? '0 0 14px rgba(0,221,208,.55)' : dropTarget ? '0 0 18px rgba(255,107,0,.7)' : '0 2px 8px rgba(0,0,0,.5)'
  const nm = (p.name || '?').split(' ')[0].toUpperCase()
  const foto = p.photo_face_url || p.photo_url
  return (
    <div style={{ width:w, height:h, borderRadius:8, background:'linear-gradient(160deg,#1a2234,#0a0e18)', border, boxShadow:shadow, display:'flex', flexDirection:'column', alignItems:'center', overflow:'hidden', flexShrink:0, userSelect:'none', pointerEvents:'none' }}>
      <div style={{ width:'100%', height:5, background:posColor, flexShrink:0 }}/>
      <div style={{ flex:1, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size==='sm'?18:24, overflow:'hidden' }}>
        {foto ? <img src={foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : '👤'}
      </div>
      <div style={{ fontSize:size==='sm'?8.5:10, fontWeight:800, padding:'2px 3px 0', maxWidth:w-4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#fff' }}>{nm}</div>
      <div style={{ display:'flex', gap:2, fontSize:7.5, paddingBottom:2, minHeight:9 }}>
        {p._goals > 0 && <span>⚽{p._goals}</span>}
        {p._saves > 0 && <span>🧤{p._saves}</span>}
        {p._yellows > 0 && <span>🟨</span>}
        {p._reds > 0 && <span>🟥</span>}
      </div>
    </div>
  )
}

function PitchSVG({ style }) {
  const c = STYLES[style] || STYLES['Clásico']
  const strips = Array.from({ length:7 }, (_, i) => <rect key={i} x="0" y={i*86} width="600" height="43" fill={c.alt} opacity="0.35"/>)
  return (
    <svg viewBox="0 0 600 860" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
      <rect width="600" height="860" fill={c.bg}/>
      {strips}
      <rect x="14" y="14" width="572" height="832" fill="none" stroke={c.lines} strokeWidth="2.5" rx="6"/>
      <line x1="14" y1="430" x2="586" y2="430" stroke={c.lines} strokeWidth="2"/>
      <circle cx="300" cy="430" r="72" fill="none" stroke={c.lines} strokeWidth="2"/>
      <circle cx="300" cy="430" r="4" fill={c.lines}/>
      <rect x="175" y="14" width="250" height="80" fill="none" stroke={c.lines} strokeWidth="2"/>
      <rect x="230" y="14" width="140" height="40" fill="none" stroke={c.lines} strokeWidth="2"/>
      <circle cx="300" cy="100" r="4" fill={c.lines}/>
      <rect x="175" y="766" width="250" height="80" fill="none" stroke={c.lines} strokeWidth="2"/>
      <rect x="230" y="806" width="140" height="40" fill="none" stroke={c.lines} strokeWidth="2"/>
      <circle cx="300" cy="760" r="4" fill={c.lines}/>
      <rect x="230" y="14" width="140" height="7" fill={c.lines} opacity="0.7" rx="3"/>
      <rect x="230" y="839" width="140" height="7" fill={c.lines} opacity="0.7" rx="3"/>
    </svg>
  )
}

const todayISO = () => new Date().toISOString().split('T')[0]
const EMPTY_MATCHINFO = { rival:'', fecha: todayISO(), hora:'15:00', torneo:'Amistoso' }

export default function EscuelaPartidoPage() {
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [roster, setRoster] = useState([])
  const [torneosEscuela, setTorneosEscuela] = useState([])
  const [torneoId, setTorneoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [partidoId, setPartidoId] = useState(null)
  const [view, setView] = useState('setup')
  const [matchInfo, setMatchInfo] = useState(EMPTY_MATCHINFO)
  const [estado, setEstado] = useState('pendiente')
  const [pitchStyle, setPitchStyle] = useState('Clásico')
  const [formType, setFormType] = useState('Fútbol 11')
  const [formation, setFormation] = useState('4-3-3')
  const [convocados, setConvocados] = useState([])
  const [lineup, setLineup] = useState([])
  const [bench, setBench] = useState([])
  const [positions, setPositions] = useState({})
  const [events, setEvents] = useState([])
  const [score, setScore] = useState({ home:0, away:0 })
  const [activePlayer, setActivePlayer] = useState(null)
  const [timerSec, setTimerSec] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [mvp, setMvp] = useState({ first:'', second:'', third:'' })
  const [jugaron, setJugaron] = useState([]) // ids de todos los que estuvieron en cancha en algún momento
  const [titulares, setTitulares] = useState([]) // ids de quienes arrancaron de titular (se fija una sola vez al iniciar)
  const [statsExtra, setStatsExtra] = useState({}) // { [jugadorId]: { minutos, recuperaciones, pases_acertados, calificacion } } — se llena al finalizar
  const [matchObs, setMatchObs] = useState('')
  const [dragOverFieldId, setDragOverFieldId] = useState(null)
  const [touchDrag, setTouchDrag] = useState(null) // { id, fromBench, clientX, clientY } — drag activo por dedo
  const [toast, setToast] = useState(null)
  const [historial, setHistorial] = useState(null)
  const [verDetalle, setVerDetalle] = useState(null)
  const [borrarPartido, setBorrarPartido] = useState(null) // partido del historial que se va a confirmar borrar
  const [borrandoPartido, setBorrandoPartido] = useState(false)
  const [guardandoFinal, setGuardandoFinal] = useState(false)
  // Reloj flotante: se puede arrastrar con el dedo (o el mouse) por toda la pantalla
  const [cronoPos, setCronoPos] = useState(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 168) : 200,
    y: 150,
  }))
  // Menú de acciones del jugador: cambio de titular y nota/buena jugada hablada
  const [mostrarCambio, setMostrarCambio] = useState(false)
  const [descModal, setDescModal] = useState(null) // { type: 'highlight' | 'note' }
  const [descText, setDescText] = useState('')
  const [grabando, setGrabando] = useState(false)

  const dragRef = useRef({ id:null, fromBench:false })
  const pitchRef = useRef(null)
  const pendingRef = useRef({})
  const saveTimeoutRef = useRef(null)
  const toastTimeoutRef = useRef(null)
  const cronoDragRef = useRef(null) // { offX, offY } mientras se arrastra el reloj
  const recognitionRef = useRef(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
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
    setRoster(lista)

    const { data: torneos } = await supabase.from('escuela_torneos').select('*').eq('escuela_id', p.escuela_id).order('created_at', { ascending:false })
    setTorneosEscuela(torneos || [])

    const { data: activo } = await supabase.from('escuela_partidos').select('*')
      .eq('escuela_id', p.escuela_id).neq('estado', 'finalizado')
      .order('created_at', { ascending:false }).limit(1).maybeSingle()

    if (activo) {
      hidratar(activo)
    } else {
      const { data: nuevo } = await supabase.from('escuela_partidos')
        .insert({ escuela_id: p.escuela_id, ...EMPTY_MATCHINFO, creado_por: p.id })
        .select().single()
      if (nuevo) hidratar(nuevo)
    }
    setLoading(false)
  }

  function hidratar(row) {
    setPartidoId(row.id)
    setView(row.vista || 'setup')
    setMatchInfo({ rival: row.rival || '', fecha: row.fecha || todayISO(), hora: row.hora || '15:00', torneo: row.torneo || 'Amistoso' })
    setEstado(row.estado || 'pendiente')
    setPitchStyle(row.pitch_style || 'Clásico')
    setFormType(row.formacion_tipo || 'Fútbol 11')
    setFormation(row.formacion || '4-3-3')
    setConvocados(row.convocados || [])
    setLineup(row.lineup || [])
    setBench(row.bench || [])
    setPositions(row.positions || {})
    setEvents(row.eventos || [])
    setScore({ home: row.score_home || 0, away: row.score_away || 0 })
    setTimerSec(row.timer_sec || 0)
    setMvp(row.mvp || { first:'', second:'', third:'' })
    setMatchObs(row.observaciones || '')
    setJugaron(row.jugaron || [])
    setTitulares(row.titulares || [])
    setTorneoId(row.torneo_id || null)
  }

  // Cada vez que cambia la alineación, se van sumando (sin repetir) todos los
  // que estuvieron en cancha — así "partidos jugados" cuenta también a los
  // que salieron en un cambio, no solo a los que terminan el partido.
  useEffect(() => {
    if (lineup.length === 0) return
    setJugaron(prev => {
      const ids = lineup.map(p => p.id)
      const next = Array.from(new Set([...prev, ...ids]))
      if (next.length === prev.length) return prev
      persist({ jugaron: next })
      return next
    })
  }, [lineup])

  function persist(fields) {
    pendingRef.current = { ...pendingRef.current, ...fields }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const toSave = pendingRef.current
      pendingRef.current = {}
      if (partidoId) await supabase.from('escuela_partidos').update({ ...toSave, updated_at: new Date().toISOString() }).eq('id', partidoId)
    }, 600)
  }

  function showToast(msg, color) {
    setToast({ msg, color: color || '#ef4444' })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2200)
  }

  // ── Timer ──
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => setTimerSec(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  function startTimer() {
    setTimerRunning(true)
    if (estado !== 'en_curso') { setEstado('en_curso'); persist({ estado:'en_curso' }) }
  }
  function pauseTimer() {
    setTimerRunning(false)
    persist({ timer_sec: timerSec })
  }
  function endMatch() {
    setTimerRunning(false)
    setShowFinish(true)
    persist({ timer_sec: timerSec })
  }

  // ── Reloj flotante arrastrable (dedo o mouse, vía Pointer Events) ──
  const CRONO_W = 156, CRONO_H = 48
  function onCronoPointerDown(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    cronoDragRef.current = { offX: e.clientX - rect.left, offY: e.clientY - rect.top }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  function onCronoPointerMove(e) {
    if (!cronoDragRef.current) return
    const { offX, offY } = cronoDragRef.current
    const x = Math.max(6, Math.min(window.innerWidth - CRONO_W - 6, e.clientX - offX))
    const y = Math.max(6, Math.min(window.innerHeight - CRONO_H - 6, e.clientY - offY))
    setCronoPos({ x, y })
  }
  function onCronoPointerUp(e) {
    cronoDragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  // ── Navegación entre vistas ──
  function irA(v) {
    setView(v)
    if (v !== 'historial') persist({ vista: v })
    if (v === 'historial') cargarHistorial()
  }

  function guardarMatchInfo(campo, valor) {
    setMatchInfo(mi => ({ ...mi, [campo]: valor }))
    const dbField = { rival:'rival', fecha:'fecha', hora:'hora', torneo:'torneo' }[campo]
    persist({ [dbField]: valor })
  }

  function toggleConvocado(id) {
    setConvocados(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      persist({ convocados: next })
      return next
    })
  }

  function elegirFormType(ft) {
    const primeraFormacion = Object.keys(FORMATIONS[ft])[0]
    setFormType(ft); setFormation(primeraFormacion)
    persist({ formacion_tipo: ft, formacion: primeraFormacion })
  }
  function elegirFormation(f) {
    setFormation(f)
    persist({ formacion: f })
  }
  function elegirEstilo(s) {
    setPitchStyle(s)
    persist({ pitch_style: s })
  }

  function aplicarFormacion() {
    const fmt = FORMATIONS[formType]?.[formation]
    if (!fmt) return
    const convList = roster.filter(p => convocados.includes(p.id))
    const starters = convList.slice(0, fmt.length)
    const pos = {}
    starters.forEach((p, i) => { pos[p.id] = { x: fmt[i].x, y: fmt[i].y } })
    const nuevoLineup = starters.map((p, i) => ({ id:p.id, name:p.name, photo_face_url:p.photo_face_url, photo_url:p.photo_url, slotPos:fmt[i].pos, _goals:0, _yellows:0, _reds:0, _saves:0, _goalsAgainst:0 }))
    const nuevoBench = convList.slice(fmt.length).map(p => ({ id:p.id, name:p.name, photo_face_url:p.photo_face_url, photo_url:p.photo_url, _goals:0, _yellows:0, _reds:0, _saves:0, _goalsAgainst:0 }))
    // Quiénes arrancan de titular queda fijo desde este momento — se usa después
    // para calcular minutos jugados y para sumar "veces titular" a la ficha.
    // Si ya había titulares (se volvió a armar la formación a mitad de partido),
    // no se pisan para no perder el dato de quién arrancó realmente.
    const nuevosTitulares = titulares.length > 0 ? titulares : starters.map(p => p.id)
    setLineup(nuevoLineup); setBench(nuevoBench); setPositions(pos); setTitulares(nuevosTitulares)
    setView('match')
    persist({ lineup: nuevoLineup, bench: nuevoBench, positions: pos, vista:'match', formacion_tipo: formType, formacion: formation, titulares: nuevosTitulares })
  }

  // ── Eventos ──
  function addEvent(type, player, desc) {
    const ev = { id: Date.now(), type, player: player.name, playerId: player.id, min: Math.floor(timerSec/60), sec: timerSec%60, ...(desc ? { desc } : {}) }
    const nuevosEventos = [ev, ...events]
    let nuevoScore = score
    let nuevoLineup = lineup
    if (type === 'goal') { nuevoScore = { ...score, home: score.home + 1 }; setScore(nuevoScore) }
    if (type === 'yellow') { nuevoLineup = lineup.map(p => p.id === player.id ? { ...p, _yellows:(p._yellows||0)+1 } : p); setLineup(nuevoLineup) }
    if (type === 'red') { nuevoLineup = lineup.map(p => p.id === player.id ? { ...p, _reds:(p._reds||0)+1 } : p); setLineup(nuevoLineup) }
    if (type === 'goal') { nuevoLineup = lineup.map(p => p.id === player.id ? { ...p, _goals:(p._goals||0)+1 } : p); setLineup(nuevoLineup) }
    setEvents(nuevosEventos)
    setActivePlayer(null)
    setMostrarCambio(false)
    persist({ eventos: nuevosEventos, score_home: nuevoScore.home, score_away: nuevoScore.away, lineup: nuevoLineup })
  }

  // Botones rápidos exclusivos del arquero: atajadas y goles recibidos, para
  // poder anotar una tapada en el momento sin buscar entre todos los eventos.
  function registrarAtajada(player) {
    const nuevoLineup = lineup.map(p => p.id === player.id ? { ...p, _saves:(p._saves||0)+1 } : p)
    const ev = { id: Date.now(), type:'save', player: player.name, playerId: player.id, min: Math.floor(timerSec/60), sec: timerSec%60 }
    const nuevosEventos = [ev, ...events]
    setLineup(nuevoLineup)
    setEvents(nuevosEventos)
    setActivePlayer(null)
    persist({ lineup: nuevoLineup, eventos: nuevosEventos })
    showToast(`🧤 Atajada de ${player.name.split(' ')[0]}`, '#0ea5e9')
  }
  function registrarGolRecibido(player) {
    const nuevoLineup = lineup.map(p => p.id === player.id ? { ...p, _goalsAgainst:(p._goalsAgainst||0)+1 } : p)
    const nuevoScore = { ...score, away: score.away + 1 }
    const ev = { id: Date.now(), type:'goal_against', player: player.name, playerId: player.id, min: Math.floor(timerSec/60), sec: timerSec%60 }
    const nuevosEventos = [ev, ...events]
    setLineup(nuevoLineup)
    setScore(nuevoScore)
    setEvents(nuevosEventos)
    setActivePlayer(null)
    persist({ lineup: nuevoLineup, score_away: nuevoScore.away, eventos: nuevosEventos })
    showToast(`🥅 Gol recibido — ${player.name.split(' ')[0]}`, '#ef4444')
  }

  // Sustitución directa desde el menú del jugador (sin necesidad de arrastrar)
  function sustituirDesdeMenu(benchId) {
    const target = activePlayer
    if (!target) return
    const incoming = bench.find(p => p.id === benchId)
    if (!incoming) return
    const targetPos = positions[target.id]
    let nuevoLineup = lineup.filter(p => p.id !== target.id)
    nuevoLineup = [...nuevoLineup, { ...incoming, slotPos: target.slotPos || incoming.slotPos }]
    const nuevoBench = [...bench.filter(p => p.id !== benchId), { ...target, slotPos:undefined }]
    const nuevaPos = { ...positions, [incoming.id]: targetPos }
    delete nuevaPos[target.id]
    const ev = { id: Date.now(), type:'sub', player:`${incoming.name} ↔ ${target.name}`, playerId: incoming.id, outPlayerId: target.id, min: Math.floor(timerSec/60), sec: timerSec%60 }
    const nuevosEventos = [ev, ...events]
    setLineup(nuevoLineup); setBench(nuevoBench); setPositions(nuevaPos); setEvents(nuevosEventos)
    setActivePlayer(null); setMostrarCambio(false)
    persist({ lineup: nuevoLineup, bench: nuevoBench, positions: nuevaPos, eventos: nuevosEventos })
    showToast(`🔄 Cambio: ${incoming.name.split(' ')[0]} por ${target.name.split(' ')[0]}`, '#10b981')
  }

  // ── Nota / buena jugada dictada por voz (Web Speech API, con respaldo de texto) ──
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { showToast('🎤 Este navegador no permite dictado por voz. Escribe la nota.', '#ef4444'); return }
    if (grabando) {
      try { recognitionRef.current?.stop() } catch {}
      return
    }
    // Texto que ya había antes de darle a grabar — se conserva y se le va
    // pegando lo que se dicta EN VIVO (resultados parciales), sin esperar a
    // que la persona termine de hablar toda la frase.
    const base = descText.trim()
    const rec = new SR()
    rec.lang = 'es-CO'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let final = '', interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0].transcript
        else interim += r[0].transcript
      }
      const junto = [base, final.trim(), interim.trim()].filter(Boolean).join(' ')
      setDescText(junto)
    }
    rec.onend = () => setGrabando(false)
    rec.onerror = () => setGrabando(false)
    recognitionRef.current = rec
    try { rec.start(); setGrabando(true) } catch { setGrabando(false) }
  }
  function guardarDesc() {
    if (!descModal || !activePlayer || !descText.trim()) return
    addEvent(descModal.type, activePlayer, descText.trim())
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    setGrabando(false)
    setDescModal(null)
    setDescText('')
  }
  function cancelarDesc() {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    setGrabando(false)
    setDescModal(null)
    setDescText('')
  }

  // ── Drag & drop ──
  function findFieldPlayerUnder(clientX, clientY) {
    const pitch = pitchRef.current
    if (!pitch) return null
    const rect = pitch.getBoundingClientRect()
    const cx = clientX - rect.left, cy = clientY - rect.top
    const pw = rect.width, ph = rect.height
    let closest = null, minDist = Infinity
    const RADIUS = 40
    lineup.forEach(p => {
      const pos = positions[p.id]; if (!pos) return
      const px = (pos.x/100)*pw, py = (pos.y/100)*ph
      const dist = Math.sqrt((cx-px)**2 + (cy-py)**2)
      if (dist < RADIUS && dist < minDist) { minDist = dist; closest = p }
    })
    return closest
  }

  function onDragStartField(e, id) {
    dragRef.current = { id, fromBench:false }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text', String(id))
  }
  function onDragStartBench(e, id) {
    dragRef.current = { id, fromBench:true }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text', String(id))
  }
  function onDragOverPitch(e) {
    e.preventDefault()
    if (!dragRef.current.fromBench) return
    const under = findFieldPlayerUnder(e.clientX, e.clientY)
    const newId = under ? under.id : null
    if (newId !== dragOverFieldId) setDragOverFieldId(newId)
  }
  function onDragLeavePitch(e) {
    const pitch = pitchRef.current
    if (pitch && !pitch.contains(e.relatedTarget)) setDragOverFieldId(null)
  }
  // Lógica compartida de soltar (mouse HTML5 DnD y touch en celular llegan aquí)
  function performDrop(clientX, clientY) {
    const drag = dragRef.current
    if (!drag.id) return
    const pitch = pitchRef.current
    if (!pitch) { dragRef.current = { id:null, fromBench:false }; return }
    const rect = pitch.getBoundingClientRect()
    const x = Math.max(4, Math.min(96, ((clientX-rect.left)/rect.width)*100))
    const y = Math.max(4, Math.min(96, ((clientY-rect.top)/rect.height)*100))

    let nuevoLineup = lineup, nuevoBench = bench, nuevaPos = positions, nuevosEventos = events

    if (drag.fromBench) {
      const target = findFieldPlayerUnder(clientX, clientY)
      if (target) {
        const incoming = bench.find(p => p.id === drag.id)
        if (!incoming) { dragRef.current = { id:null, fromBench:false }; setDragOverFieldId(null); return }
        const targetPos = positions[target.id]
        nuevoLineup = lineup.filter(p => p.id !== target.id)
        nuevoBench = [...bench.filter(p => p.id !== drag.id), { ...target, slotPos:undefined }]
        nuevoLineup = [...nuevoLineup, { ...incoming, slotPos: target.slotPos || incoming.slotPos }]
        nuevaPos = { ...positions, [incoming.id]: targetPos }
        delete nuevaPos[target.id]
        const ev = { id: Date.now(), type:'sub', player:`${incoming.name} ↔ ${target.name}`, playerId: incoming.id, outPlayerId: target.id, min: Math.floor(timerSec/60), sec: timerSec%60 }
        nuevosEventos = [ev, ...events]
        showToast(`🔄 Cambio: ${incoming.name.split(' ')[0]} por ${target.name.split(' ')[0]}`, '#10b981')
      } else {
        if (lineup.length >= MAX_FIELD) {
          showToast(`⚠️ Máximo ${MAX_FIELD} jugadores en campo. Arrastra sobre un titular para hacer el cambio.`, '#ef4444')
          dragRef.current = { id:null, fromBench:false }; setDragOverFieldId(null); return
        }
        const incoming = bench.find(p => p.id === drag.id)
        if (incoming) {
          nuevoLineup = [...lineup, { ...incoming, slotPos: incoming.slotPos }]
          nuevoBench = bench.filter(p => p.id !== drag.id)
          nuevaPos = { ...positions, [incoming.id]: { x, y } }
          showToast(`✅ ${incoming.name.split(' ')[0]} entra al campo`, '#0f4c75')
        }
      }
    } else {
      nuevaPos = { ...positions, [drag.id]: { x, y } }
    }

    setLineup(nuevoLineup); setBench(nuevoBench); setPositions(nuevaPos); setEvents(nuevosEventos)
    dragRef.current = { id:null, fromBench:false }; setDragOverFieldId(null)
    persist({ lineup: nuevoLineup, bench: nuevoBench, positions: nuevaPos, eventos: nuevosEventos })
  }

  function onDropPitch(e) {
    e.preventDefault()
    performDrop(e.clientX, e.clientY)
  }

  function selectPlayer(id) {
    setMostrarCambio(false)
    setActivePlayer(ap => (ap && ap.id === id) ? null : (lineup.find(p => p.id === id) || null))
  }

  // ── Touch (celular): HTML5 drag-and-drop no funciona con el dedo, así que
  // se replica la misma lógica a mano con touchstart/touchmove/touchend. Un
  // toque corto (sin arrastrar) no dispara el drop — así el tap normal para
  // abrir el menú de eventos sigue funcionando igual que con mouse.
  function handleTouchStart(e, id, fromBench) {
    const t = e.touches[0]
    dragRef.current = { id, fromBench }
    const startX = t.clientX, startY = t.clientY
    let moved = false
    setTouchDrag({ id, fromBench, clientX: t.clientX, clientY: t.clientY })

    function onMove(ev) {
      const mt = ev.touches[0]
      if (!mt) return
      if (Math.hypot(mt.clientX - startX, mt.clientY - startY) > 8) moved = true
      if (moved) ev.preventDefault()
      setTouchDrag({ id, fromBench, clientX: mt.clientX, clientY: mt.clientY })
      if (fromBench) {
        const under = findFieldPlayerUnder(mt.clientX, mt.clientY)
        const newId = under ? under.id : null
        setDragOverFieldId(prev => prev === newId ? prev : newId)
      }
    }
    function onEnd(ev) {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
      const ct = ev.changedTouches[0]
      setTouchDrag(null)
      if (moved && ct) performDrop(ct.clientX, ct.clientY)
      else { dragRef.current = { id:null, fromBench:false }; setDragOverFieldId(null) }
    }
    function onCancel() {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
      setTouchDrag(null)
      dragRef.current = { id:null, fromBench:false }; setDragOverFieldId(null)
    }
    document.addEventListener('touchmove', onMove, { passive:false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onCancel)
  }

  // ── Finalizar ──
  // Reconstruye cuánto tiempo estuvo cada jugador en cancha: los titulares
  // arrancan en el segundo 0, y cada cambio (evento "sub") cierra el tiempo
  // del que sale y abre el del que entra. Al final, a quien seguía en cancha
  // se le cierra con el tiempo del cronómetro al terminar el partido.
  function calcularMinutosJugados() {
    const cronologicos = [...events].reverse() // se guardan del más nuevo al más viejo
    const entrada = {}
    titulares.forEach(id => { entrada[id] = 0 })
    const acumulado = {}
    cronologicos.forEach(ev => {
      if (ev.type !== 'sub') return
      const seg = (ev.min || 0) * 60 + (ev.sec || 0)
      if (ev.outPlayerId != null && entrada[ev.outPlayerId] !== undefined) {
        acumulado[ev.outPlayerId] = (acumulado[ev.outPlayerId] || 0) + Math.max(0, seg - entrada[ev.outPlayerId])
        delete entrada[ev.outPlayerId]
      }
      if (ev.playerId != null && entrada[ev.playerId] === undefined) {
        entrada[ev.playerId] = seg
      }
    })
    Object.keys(entrada).forEach(id => {
      acumulado[id] = (acumulado[id] || 0) + Math.max(0, timerSec - entrada[id])
    })
    const minutos = {}
    Object.entries(acumulado).forEach(([id, seg]) => { minutos[id] = Math.round(seg / 60) })
    return minutos
  }

  // Suma las estadísticas del partido (goles, asistencias, tarjetas, atajadas,
  // goles recibidos, MVP, partidos jugados, veces titular y minutos jugados)
  // a la ficha de cada jugador de la escuela — su "vida futbolística". El
  // coordinador puede después ajustarlas a mano desde el buscador de jugadores.
  async function actualizarStatsJugadores() {
    const golesPor = {}, asistPor = {}, amarillasPor = {}, rojasPor = {}, atajadasPor = {}, recibidosPor = {}
    events.forEach(ev => {
      if (ev.type === 'goal')         golesPor[ev.playerId]     = (golesPor[ev.playerId]||0) + 1
      if (ev.type === 'assist')       asistPor[ev.playerId]     = (asistPor[ev.playerId]||0) + 1
      if (ev.type === 'yellow')       amarillasPor[ev.playerId] = (amarillasPor[ev.playerId]||0) + 1
      if (ev.type === 'red')          rojasPor[ev.playerId]     = (rojasPor[ev.playerId]||0) + 1
      if (ev.type === 'save')         atajadasPor[ev.playerId]  = (atajadasPor[ev.playerId]||0) + 1
      if (ev.type === 'goal_against') recibidosPor[ev.playerId] = (recibidosPor[ev.playerId]||0) + 1
    })
    const mvpId = mvp.first || null
    const minutosPor = calcularMinutosJugados()

    const ids = Array.from(new Set([
      ...jugaron, ...Object.keys(golesPor), ...Object.keys(asistPor), ...Object.keys(amarillasPor), ...Object.keys(rojasPor),
      ...Object.keys(atajadasPor), ...Object.keys(recibidosPor), ...titulares,
      ...(mvpId ? [mvpId] : []),
    ].filter(Boolean)))
    if (ids.length === 0) return

    const { data: actuales } = await supabase.from('players')
      .select('id, goles_escuela, asistencias_escuela, amarillas_escuela, rojas_escuela, partidos_escuela, mvp_escuela, titular_escuela, minutos_escuela, atajadas_escuela, goles_recibidos_escuela')
      .in('id', ids)
    const porId = Object.fromEntries((actuales||[]).map(p => [p.id, p]))

    await Promise.all(ids.map(pid => {
      const a = porId[pid] || {}
      return supabase.from('players').update({
        goles_escuela:           (a.goles_escuela||0)           + (golesPor[pid]||0),
        asistencias_escuela:     (a.asistencias_escuela||0)     + (asistPor[pid]||0),
        amarillas_escuela:       (a.amarillas_escuela||0)       + (amarillasPor[pid]||0),
        rojas_escuela:           (a.rojas_escuela||0)           + (rojasPor[pid]||0),
        partidos_escuela:        (a.partidos_escuela||0)        + (jugaron.includes(pid) ? 1 : 0),
        mvp_escuela:             (a.mvp_escuela||0)              + (pid === mvpId ? 1 : 0),
        titular_escuela:         (a.titular_escuela||0)         + (titulares.includes(pid) ? 1 : 0),
        minutos_escuela:         (a.minutos_escuela||0)         + (minutosPor[pid]||0),
        atajadas_escuela:        (a.atajadas_escuela||0)        + (atajadasPor[pid]||0),
        goles_recibidos_escuela: (a.goles_recibidos_escuela||0) + (recibidosPor[pid]||0),
      }).eq('id', pid)
    }))
  }

  // Guarda minutos (calculados solos, o corregidos a mano)/recuperaciones/
  // pases/calificación/titular del resumen final, uno por jugador que estuvo
  // en cancha (tabla escuela_partido_stats) — queda el detalle de ESE partido.
  async function guardarStatsPartido() {
    const minutosPor = calcularMinutosJugados()
    const filas = jugaron.map(pid => ({
      jugador_id: pid,
      minutos: statsExtra[pid]?.minutos ?? minutosPor[pid] ?? null,
      recuperaciones: statsExtra[pid]?.recuperaciones ?? null,
      pases_acertados: statsExtra[pid]?.pases_acertados ?? null,
      calificacion: statsExtra[pid]?.calificacion ?? null,
      titular: titulares.includes(pid),
    }))
    if (filas.length === 0) return
    await Promise.all(filas.map(f => supabase.from('escuela_partido_stats')
      .upsert({ partido_id: partidoId, jugador_id: f.jugador_id, minutos: f.minutos, recuperaciones: f.recuperaciones, pases_acertados: f.pases_acertados, calificacion: f.calificacion, titular: f.titular }, { onConflict:'partido_id,jugador_id' })
    ))
  }

  async function guardarHistorial() {
    setGuardandoFinal(true)
    await supabase.from('escuela_partidos').update({
      estado:'finalizado', vista:'match', mvp, observaciones: matchObs, timer_sec: timerSec,
      eventos: events, score_home: score.home, score_away: score.away,
      lineup, bench, positions, jugaron, titulares, torneo_id: torneoId, updated_at: new Date().toISOString(),
    }).eq('id', partidoId)
    try { await actualizarStatsJugadores() } catch {}
    try { await guardarStatsPartido() } catch {}
    setGuardandoFinal(false)
    setShowFinish(false)
    alert('✅ Partido guardado en el historial de la escuela.')
    fetchTodo()
  }

  async function cargarHistorial() {
    if (!escuela) return
    setHistorial('cargando')
    const { data } = await supabase.from('escuela_partidos').select('*')
      .eq('escuela_id', escuela.id).eq('estado', 'finalizado')
      .order('fecha', { ascending:false }).order('created_at', { ascending:false })
    setHistorial(data || [])
  }

  async function eliminarPartido() {
    if (!borrarPartido) return
    setBorrandoPartido(true)
    await supabase.from('escuela_partidos').delete().eq('id', borrarPartido.id)
    setBorrandoPartido(false)
    setBorrarPartido(null)
    if (verDetalle?.id === borrarPartido.id) setVerDetalle(null)
    showToast('🗑️ Partido eliminado del historial', '#10b981')
    cargarHistorial()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (!profesor) return null

  const NAV = [
    { v:'setup', l:'Info' }, { v:'convocatoria', l:'Convocatoria' }, { v:'formacion', l:'Formación' },
    { v:'match', l:'Partido' }, { v:'historial', l:'Historial' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'30px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'12px 14px' }}>
        <div style={{ maxWidth:'620px', margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <button onClick={() => navigate('/escuela')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem' }}>← Escuela</button>
            <div style={{ fontSize:'.72rem', color:S.muted, fontWeight:600 }}>⚽ {escuela?.name}</div>
          </div>
          <div style={{ display:'flex', gap:'6px', overflowX:'auto' }}>
            {NAV.map(n => <button key={n.v} onClick={() => irA(n.v)} style={navBtn(view === n.v)}>{n.l}</button>)}
          </div>
        </div>
      </div>

      {/* Cancha a todo el ancho de la pantalla, con el marcador flotando encima */}
      {view === 'match' && (
        <div style={{ position:'relative', width:'100%' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, zIndex:60, background:'linear-gradient(180deg, rgba(0,0,0,.62), rgba(0,0,0,0))', padding:'10px 16px 34px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.7)' }}>Mi equipo</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>{score.home}</div>
            </div>
            <div style={{ fontSize:16, color:'rgba(255,255,255,.5)' }}>–</div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.7)' }}>{matchInfo.rival || 'Rival'}</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#fff' }}>{score.away}</div>
              <div style={{ fontSize:8.5, color:'rgba(255,255,255,.5)', marginTop:2 }}>Se suma desde 🥅 Recibido del portero</div>
            </div>
          </div>

          <div ref={pitchRef} onDragOver={onDragOverPitch} onDragLeave={onDragLeavePitch} onDrop={onDropPitch}
            style={{ position:'relative', width:'100%', aspectRatio:'600/860', overflow:'hidden' }}>
            <PitchSVG style={pitchStyle}/>
            <div style={{ position:'absolute', inset:0 }}>
              {lineup.map(p => {
                const isDraggingThis = touchDrag && touchDrag.id === p.id && !touchDrag.fromBench
                const pos = isDraggingThis && pitchRef.current
                  ? (() => {
                      const rect = pitchRef.current.getBoundingClientRect()
                      return {
                        x: Math.max(4, Math.min(96, ((touchDrag.clientX-rect.left)/rect.width)*100)),
                        y: Math.max(4, Math.min(96, ((touchDrag.clientY-rect.top)/rect.height)*100)),
                      }
                    })()
                  : (positions[p.id] || { x:50, y:50 })
                const isSel = activePlayer && activePlayer.id === p.id
                const isTarget = dragOverFieldId === p.id
                return (
                  <div key={p.id} draggable onDragStart={e => onDragStartField(e, p.id)} onTouchStart={e => handleTouchStart(e, p.id, false)} onClick={() => selectPlayer(p.id)}
                    style={{ position:'absolute', left:`${pos.x}%`, top:`${pos.y}%`, transform:'translate(-50%,-50%)', cursor:'grab', touchAction:'none', zIndex: isSel||isDraggingThis?20:10 }}>
                    <PlayerCard p={p} selected={isSel} dropTarget={isTarget}/>
                  </div>
                )
              })}
            </div>

            {/* Menú de acciones del jugador — siempre centrado en la cancha, sin importar
                en qué lateral esté parado el jugador, para que nunca quede cortado. */}
            {activePlayer && !mostrarCambio && (
              <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'rgba(7,11,22,.98)', border:`1px solid ${S.cyan}66`, borderRadius:12, padding:10, zIndex:50, width:'min(260px,84%)', maxHeight:'82%', overflowY:'auto' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', textAlign:'center', paddingBottom:6, borderBottom:'1px solid rgba(255,255,255,.1)', marginBottom:8, fontWeight:700 }}>
                  {activePlayer.name}{activePlayer.slotPos === 'POR' ? ' · 🧤 Portero' : ''}
                </div>
                <button onClick={() => setMostrarCambio(true)} style={{ width:'100%', background:'rgba(59,130,246,.2)', border:'1px solid rgba(59,130,246,.5)', color:'#60a5fa', borderRadius:8, padding:'8px 0', fontSize:11, fontWeight:800, cursor:'pointer', marginBottom:8 }}>🔄 Cambio</button>
                {activePlayer.slotPos === 'POR' && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:8 }}>
                    <button onClick={() => registrarAtajada(activePlayer)} style={{ background:'rgba(14,165,233,.22)', border:'1px solid rgba(14,165,233,.5)', color:'#38bdf8', borderRadius:8, padding:'9px 4px', fontSize:10.5, fontWeight:800, cursor:'pointer' }}>🧤 Atajada</button>
                    <button onClick={() => registrarGolRecibido(activePlayer)} style={{ background:'rgba(239,68,68,.22)', border:'1px solid rgba(239,68,68,.5)', color:'#f87171', borderRadius:8, padding:'9px 4px', fontSize:10.5, fontWeight:800, cursor:'pointer' }}>🥅 Recibido</button>
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4 }}>
                  {EV_ITEMS.map(({ t, l }) => (
                    <button key={t} onClick={() => (t === 'highlight' || t === 'note') ? setDescModal({ type:t }) : addEvent(t, activePlayer)} style={evBtn}>{l}</button>
                  ))}
                </div>
                <button onClick={() => { setActivePlayer(null); setMostrarCambio(false) }} style={{ width:'100%', marginTop:8, background:'rgba(239,68,68,.18)', border:'1px solid rgba(239,68,68,.4)', color:'#ef4444', borderRadius:6, padding:6, fontSize:10, fontWeight:700, cursor:'pointer' }}>✕ Cerrar</button>
              </div>
            )}

            {activePlayer && mostrarCambio && (
              <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'rgba(7,11,22,.98)', border:`1px solid ${S.cyan}66`, borderRadius:12, padding:10, zIndex:50, width:'min(260px,84%)', maxHeight:'82%', overflowY:'auto' }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', textAlign:'center', paddingBottom:6, borderBottom:'1px solid rgba(255,255,255,.1)', marginBottom:8, fontWeight:700 }}>
                  Cambiar a {activePlayer.name.split(' ')[0]}
                </div>
                {bench.length === 0 ? (
                  <div style={{ fontSize:11, color:S.muted, textAlign:'center', padding:'10px 0' }}>Sin suplentes disponibles</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {bench.map(p => (
                      <button key={p.id} onClick={() => sustituirDesdeMenu(p.id)} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.06)', border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 9px', color:'#fff', fontSize:11.5, fontWeight:700, cursor:'pointer', textAlign:'left' }}>
                        <span style={{ width:22, height:22, borderRadius:'50%', overflow:'hidden', flexShrink:0, background:S.card2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>
                          {(p.photo_face_url||p.photo_url) ? <img src={p.photo_face_url||p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : '👤'}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setMostrarCambio(false)} style={{ width:'100%', marginTop:8, background:'rgba(255,255,255,.07)', border:`1px solid ${S.border}`, color:S.muted, borderRadius:6, padding:6, fontSize:10, fontWeight:700, cursor:'pointer' }}>← Volver</button>
              </div>
            )}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px' }}>
            <div style={{ fontSize:11, color: lineup.length>=MAX_FIELD ? '#f59e0b' : S.muted }}>
              {lineup.length>=MAX_FIELD ? '⚠️' : '👥'} {lineup.length}/{MAX_FIELD} en campo
            </div>
            <button onClick={() => irA('formacion')} style={{ marginLeft:'auto', background:'rgba(255,255,255,.06)', border:`1px solid ${S.border}`, color:S.muted, borderRadius:8, padding:'4px 10px', fontSize:10, cursor:'pointer' }}>Cambiar formación</button>
          </div>
        </div>
      )}

      <div style={{ maxWidth:'620px', margin:'0 auto', padding:'16px 14px' }}>

        {view === 'setup' && (
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:S.cyan, marginBottom:'14px' }}>Información del partido</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:S.muted, display:'block', marginBottom:4, textTransform:'uppercase' }}>Rival</label>
                <input value={matchInfo.rival} onChange={e => guardarMatchInfo('rival', e.target.value)} placeholder="Nombre del equipo rival"
                  style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 12px', color:S.text, fontSize:'.85rem', boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:S.muted, display:'block', marginBottom:4, textTransform:'uppercase' }}>Fecha</label>
                <input type="date" value={matchInfo.fecha} onChange={e => guardarMatchInfo('fecha', e.target.value)}
                  style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 12px', color:S.text, fontSize:'.85rem', boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:S.muted, display:'block', marginBottom:4, textTransform:'uppercase' }}>Hora</label>
                <input type="time" value={matchInfo.hora} onChange={e => guardarMatchInfo('hora', e.target.value)}
                  style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 12px', color:S.text, fontSize:'.85rem', boxSizing:'border-box' }}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, color:S.muted, display:'block', marginBottom:4, textTransform:'uppercase' }}>Torneo / tipo</label>
                <input value={matchInfo.torneo} onChange={e => guardarMatchInfo('torneo', e.target.value)} placeholder="Ej: Amistoso, Liga infantil..."
                  style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 12px', color:S.text, fontSize:'.85rem', boxSizing:'border-box' }}/>
              </div>
              {torneosEscuela.length > 0 && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, color:S.muted, display:'block', marginBottom:4, textTransform:'uppercase' }}>¿Es parte de uno de los torneos de la escuela?</label>
                  <select value={torneoId || ''} onChange={e => {
                      const val = e.target.value || null
                      setTorneoId(val)
                      persist({ torneo_id: val })
                      const t = torneosEscuela.find(x => x.id === val)
                      if (t) guardarMatchInfo('torneo', t.nombre)
                    }}
                    style={{ width:'100%', background:S.card, border:`1px solid ${S.border}`, borderRadius:10, padding:'10px 12px', color:S.text, fontSize:'.85rem', boxSizing:'border-box' }}>
                    <option value="">No — es amistoso u otro</option>
                    {torneosEscuela.map(t => <option key={t.id} value={t.id}>{t.nombre}{t.temporada ? ` (${t.temporada})` : ''}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginBottom:'20px' }}>
              <div style={{ fontSize:11, color:S.muted, textTransform:'uppercase', marginBottom:8 }}>Estilo de cancha</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {Object.keys(STYLES).map(s => (
                  <button key={s} onClick={() => elegirEstilo(s)} style={navBtn(pitchStyle === s)}>{s}</button>
                ))}
              </div>
            </div>
            <button onClick={() => irA('convocatoria')} style={{ width:'100%', background:'linear-gradient(135deg,#0f4c75,#4a1b8c)', border:`1px solid ${S.cyan}55`, color:'#fff', borderRadius:12, padding:'13px 0', fontWeight:800, fontSize:'.9rem', cursor:'pointer' }}>Siguiente → Convocatoria</button>
          </div>
        )}

        {view === 'convocatoria' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem', color:S.cyan }}>Convocatoria</div>
              <div style={{ fontSize:11, color:S.muted }}>{convocados.length} seleccionados</div>
            </div>
            {roster.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted, fontSize:'.85rem' }}>Todavía no hay jugadores en la escuela.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {roster.map(p => {
                  const isIn = convocados.includes(p.id)
                  return (
                    <div key={p.id} onClick={() => toggleConvocado(p.id)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', borderRadius:12, cursor:'pointer', background:isIn?S.cyanDim:S.card, border:`1px solid ${isIn?S.cyan+'55':S.border}` }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {(p.photo_face_url||p.photo_url) ? <img src={p.photo_face_url||p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : '👤'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:'.85rem' }}>{p.name}</div>
                        <div style={{ fontSize:'.72rem', fontWeight:700, color:isIn?S.cyan:S.muted, marginTop:2 }}>{isIn ? '✅ Convocado' : '○ No convocado'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={() => irA('formacion')} disabled={convocados.length === 0} style={{ width:'100%', marginTop:'16px', background:'linear-gradient(135deg,#0f4c75,#4a1b8c)', border:`1px solid ${S.cyan}55`, color:'#fff', borderRadius:12, padding:'13px 0', fontWeight:800, fontSize:'.9rem', cursor:'pointer', opacity: convocados.length===0?.5:1 }}>Siguiente → Formación</button>
          </div>
        )}

        {view === 'formacion' && (
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:S.cyan, marginBottom:'12px' }}>Seleccionar formación</div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px' }}>
              {Object.keys(FORMATIONS).map(ft => <button key={ft} onClick={() => elegirFormType(ft)} style={navBtn(formType === ft)}>{ft}</button>)}
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'18px' }}>
              {Object.keys(FORMATIONS[formType] || {}).map(f => <button key={f} onClick={() => elegirFormation(f)} style={navBtn(formation === f)}>{f}</button>)}
            </div>
            <div style={{ position:'relative', width:'min(220px,60vw)', aspectRatio:'600/860', margin:'0 auto 16px', borderRadius:8, overflow:'hidden' }}>
              <PitchSVG style={pitchStyle}/>
              {(FORMATIONS[formType]?.[formation] || []).map((s, i) => (
                <div key={i} style={{ position:'absolute', left:`${s.x}%`, top:`${s.y}%`, transform:'translate(-50%,-50%)', background:POS_COL[s.pos]||'#666', borderRadius:4, padding:'2px 5px', fontSize:8, fontWeight:900, color:'#fff' }}>{s.pos}</div>
              ))}
            </div>
            <div style={{ textAlign:'center', fontSize:12, color:S.muted, marginBottom:'16px' }}>{(FORMATIONS[formType]?.[formation]||[]).length} posiciones · {convocados.length} convocados</div>
            <button onClick={aplicarFormacion} style={{ width:'100%', background:'linear-gradient(135deg,#10b981,#0f4c75)', border:'none', color:'#fff', borderRadius:12, padding:'14px 0', fontWeight:900, fontSize:'.95rem', cursor:'pointer' }}>⚽ INICIAR PARTIDO</button>
          </div>
        )}

        {view === 'match' && (
          <div>
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:10, color:S.muted, textTransform:'uppercase', marginBottom:6 }}>
                Banco de suplentes ({bench.length}) {bench.length>0 && <span style={{ opacity:.7 }}>· arrastra sobre un titular, o tócalo y elige "Cambio"</span>}
              </div>
              {bench.length > 0 ? (
                <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'2px 0 6px' }}>
                  {bench.map(p => (
                    <div key={p.id} draggable onDragStart={e => onDragStartBench(e, p.id)} onTouchStart={e => handleTouchStart(e, p.id, true)}
                      style={{ cursor:'grab', flexShrink:0, touchAction:'none', opacity: touchDrag?.id === p.id ? 0.35 : 1 }} title="Arrastra sobre un titular para hacer el cambio">
                      <PlayerCard p={p}/>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize:11, color:S.muted, padding:'10px 0' }}>Sin suplentes disponibles</div>}
            </div>

            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:12, padding:'12px', marginTop:14 }}>
              <div style={{ fontSize:10, color:S.muted, textTransform:'uppercase', marginBottom:6 }}>Resumen</div>
              {[
                ['⚽ Goles', events.filter(e=>e.type==='goal').length],
                ['🎯 Asistencias', events.filter(e=>e.type==='assist').length],
                ['🔄 Cambios', events.filter(e=>e.type==='sub').length],
                ['🟨 Amarillas', events.filter(e=>e.type==='yellow').length],
                ['🟥 Rojas', events.filter(e=>e.type==='red').length],
                ['🧤 Atajadas', events.filter(e=>e.type==='save').length],
                ['🥅 Recibidos', events.filter(e=>e.type==='goal_against').length],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}><span style={{ color:S.text2 }}>{l}</span><span style={{ fontWeight:700 }}>{v}</span></div>
              ))}
              {(() => {
                const at = events.filter(e=>e.type==='save').length
                const rc = events.filter(e=>e.type==='goal_against').length
                if (at + rc === 0) return null
                const efect = Math.round((at/(at+rc))*100)
                return (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'7px 0 0' }}>
                    <span style={{ color:S.cyan, fontWeight:700 }}>🧤 Efectividad del portero</span>
                    <span style={{ fontWeight:900, color:S.cyan }}>{efect}%</span>
                  </div>
                )
              })()}
            </div>

            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:10, color:S.muted, textTransform:'uppercase', marginBottom:6 }}>Línea de tiempo</div>
              {events.length === 0 ? (
                <div style={{ fontSize:11, color:S.muted, textAlign:'center', padding:'14px 0' }}>Sin eventos</div>
              ) : events.slice(0, 30).map(ev => (
                <div key={ev.id} style={{ padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:12 }}>
                    <span style={{ color:S.cyan, fontFamily:'monospace', minWidth:28 }}>{ev.min}'</span>
                    <span>{EV_ICONS[ev.type] || ''}</span>
                    <span style={{ color:S.text2 }}>{ev.player}</span>
                  </div>
                  {ev.desc && <div style={{ fontSize:11, color:S.muted, fontStyle:'italic', marginLeft:34, marginTop:2 }}>"{ev.desc}"</div>}
                </div>
              ))}
            </div>

            <button onClick={() => setShowFinish(true)} style={{ width:'100%', marginTop:16, background:'linear-gradient(135deg,#ef4444,#991b1b)', border:'none', color:'#fff', borderRadius:12, padding:'13px 0', fontWeight:900, fontSize:'.85rem', letterSpacing:1, cursor:'pointer' }}>FINALIZAR PARTIDO</button>
          </div>
        )}

        {view === 'historial' && (
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color:S.cyan, marginBottom:'14px' }}>Historial de partidos</div>
            {historial === 'cargando' || historial === null ? (
              <div style={{ textAlign:'center', padding:'30px', color:S.muted, fontSize:'.85rem' }}>Cargando...</div>
            ) : historial.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted, fontSize:'.85rem' }}>Todavía no hay partidos guardados.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {historial.map(h => (
                  <div key={h.id} onClick={() => setVerDetalle(verDetalle?.id === h.id ? null : h)} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:12, padding:'12px 14px', cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:'.85rem' }}>vs {h.rival || 'Rival'}</div>
                        <div style={{ fontSize:'.7rem', color:S.muted, marginTop:2 }}>{h.fecha} · {h.torneo}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontSize:'1.1rem', fontWeight:900, color:S.cyan }}>{h.score_home} – {h.score_away}</div>
                        <button onClick={e => { e.stopPropagation(); setBorrarPartido(h) }} title="Eliminar partido"
                          style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.35)', color:'#ef4444', borderRadius:8, width:30, height:30, fontSize:13, cursor:'pointer', flexShrink:0 }}>🗑️</button>
                      </div>
                    </div>
                    {verDetalle?.id === h.id && (
                      <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${S.border}` }}>
                        <div style={{ fontSize:11, color:S.muted, marginBottom:6 }}>Duración: {fmtTime(h.timer_sec||0)}</div>
                        {h.mvp?.first && (
                          <div style={{ fontSize:12, marginBottom:8 }}>
                            🥇 MVP: {(h.lineup||[]).find(p => String(p.id) === String(h.mvp.first))?.name || '—'}
                          </div>
                        )}
                        {h.observaciones && <div style={{ fontSize:11.5, color:S.text2, marginBottom:8, fontStyle:'italic' }}>"{h.observaciones}"</div>}
                        <div style={{ fontSize:10, color:S.muted, textTransform:'uppercase', marginBottom:4 }}>Eventos</div>
                        {(h.eventos||[]).slice(0,20).map(ev => (
                          <div key={ev.id} style={{ display:'flex', gap:6, fontSize:11.5, padding:'3px 0' }}>
                            <span style={{ color:S.cyan, fontFamily:'monospace', minWidth:26 }}>{ev.min}'</span>
                            <span>{EV_ICONS[ev.type]||''}</span>
                            <span style={{ color:S.text2 }}>{ev.player}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:toast.color, color:'#fff', padding:'10px 22px', borderRadius:10, fontWeight:700, fontSize:13, zIndex:999, boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>{toast.msg}</div>
      )}

      {/* Confirmación al eliminar un partido del historial — pide confirmar dos veces antes de borrar */}
      {borrarPartido && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'linear-gradient(135deg,#090f1e,#131f35)', border:'2px solid rgba(239,68,68,.5)', borderRadius:16, padding:20, width:'min(340px,100%)', textAlign:'center' }}>
            <div style={{ fontSize:30, marginBottom:8 }}>⚠️</div>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:6 }}>¿Eliminar este partido?</div>
            <div style={{ fontSize:12.5, color:S.muted, marginBottom:4 }}>vs {borrarPartido.rival || 'Rival'} · {borrarPartido.fecha}</div>
            <div style={{ fontSize:12, color:S.muted, marginBottom:18 }}>Esta acción no se puede deshacer. ¿Estás seguro de que quieres borrarlo del historial?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setBorrarPartido(null)} disabled={borrandoPartido} style={{ flex:1, background:'rgba(255,255,255,.07)', border:`1px solid ${S.border}`, color:'#fff', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancelar</button>
              <button onClick={eliminarPartido} disabled={borrandoPartido} style={{ flex:1, background:'linear-gradient(135deg,#ef4444,#991b1b)', border:'none', color:'#fff', borderRadius:8, padding:'10px 0', fontSize:12, fontWeight:900, cursor:'pointer', opacity:borrandoPartido?.7:1 }}>{borrandoPartido ? 'Borrando...' : 'Sí, borrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cronómetro flotante: siempre visible mientras se llenan los datos del partido, se arrastra con el dedo o el mouse */}
      {view === 'match' && (
        <div
          onPointerDown={onCronoPointerDown}
          onPointerMove={onCronoPointerMove}
          onPointerUp={onCronoPointerUp}
          onPointerCancel={onCronoPointerUp}
          style={{
            position:'fixed', left:cronoPos.x, top:cronoPos.y, zIndex:300,
            background:'rgba(9,13,24,.95)', border:`1.5px solid ${timerRunning?'#00ff8877':S.cyan+'55'}`,
            borderRadius:14, padding:'7px 9px', boxShadow:'0 8px 24px rgba(0,0,0,.55)',
            display:'flex', alignItems:'center', gap:7, touchAction:'none', cursor:'grab',
            userSelect:'none', backdropFilter:'blur(8px)', minWidth:CRONO_W,
          }}>
          <span style={{ fontSize:11, color:S.muted, lineHeight:1 }}>⠿⠿</span>
          <div style={{ fontSize:19, fontWeight:900, color: timerRunning?'#00ff88':S.text, fontFamily:'monospace', minWidth:54, textAlign:'center' }}>{fmtTime(timerSec)}</div>
          {!timerRunning && <button onClick={startTimer} style={{ background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'6px 8px', fontWeight:700, fontSize:13, cursor:'pointer', touchAction:'manipulation' }}>▶</button>}
          {timerRunning && <>
            <button onClick={pauseTimer} style={{ background:'#f59e0b', color:'#000', border:'none', borderRadius:8, padding:'6px 8px', fontWeight:700, fontSize:13, cursor:'pointer', touchAction:'manipulation' }}>⏸</button>
            <button onClick={endMatch} style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:8, padding:'6px 8px', fontWeight:700, fontSize:13, cursor:'pointer', touchAction:'manipulation' }}>⏹</button>
          </>}
        </div>
      )}

      {/* Nota / buena jugada — se puede escribir o dictar por voz */}
      {descModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'linear-gradient(135deg,#090f1e,#131f35)', border:`2px solid ${S.cyan}55`, borderRadius:16, padding:18, width:'min(360px,100%)' }}>
            <div style={{ fontSize:14, fontWeight:900, color:S.cyan, marginBottom:4 }}>{descModal.type === 'highlight' ? '⭐ Buena jugada' : '📝 Nota'}</div>
            <div style={{ fontSize:11, color:S.muted, marginBottom:10 }}>{activePlayer?.name} — cuenta cómo fue la jugada</div>
            <textarea value={descText} onChange={e => setDescText(e.target.value)} placeholder="Escribe o dicta por voz cómo fue la jugada..."
              style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:8, padding:10, color:S.text, fontSize:13, minHeight:90, resize:'vertical', boxSizing:'border-box', marginBottom:10 }}/>
            <button onClick={toggleMic} style={{ width:'100%', background: grabando ? 'rgba(239,68,68,.25)' : 'rgba(0,221,208,.15)', border:`1px solid ${grabando ? '#ef4444' : S.cyan}66`, color: grabando ? '#ef4444' : S.cyan, borderRadius:8, padding:'9px 0', fontSize:12, fontWeight:800, cursor:'pointer', marginBottom:10 }}>
              {grabando ? '⏺ Grabando... toca para parar' : '🎤 Hablar la jugada'}
            </button>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={cancelarDesc} style={{ flex:1, background:'rgba(255,255,255,.07)', border:`1px solid ${S.border}`, color:'#fff', borderRadius:8, padding:'10px 0', fontSize:12, cursor:'pointer' }}>Cancelar</button>
              <button onClick={guardarDesc} disabled={!descText.trim()} style={{ flex:2, background:'linear-gradient(135deg,#10b981,#0f4c75)', border:'none', color:'#fff', borderRadius:8, padding:'10px 0', fontWeight:900, fontSize:12, cursor:'pointer', opacity: descText.trim()?1:.6 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Fantasma que sigue al dedo mientras se arrastra un suplente en celular */}
      {touchDrag && touchDrag.fromBench && (() => {
        const p = bench.find(b => b.id === touchDrag.id)
        if (!p) return null
        return (
          <div style={{ position:'fixed', left:touchDrag.clientX, top:touchDrag.clientY, transform:'translate(-50%,-50%)', zIndex:999, pointerEvents:'none' }}>
            <PlayerCard p={p} selected/>
          </div>
        )
      })()}

      {showFinish && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.87)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:16 }}>
          <div style={{ background:'linear-gradient(135deg,#090f1e,#131f35)', border:`2px solid ${S.cyan}55`, borderRadius:16, padding:22, width:'min(440px,100%)', maxHeight:'88vh', overflowY:'auto' }}>
            <div style={{ fontSize:18, fontWeight:900, color:S.cyan, marginBottom:18, textAlign:'center' }}>🏆 RESUMEN DEL PARTIDO</div>
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:18, marginBottom:20, background:'rgba(0,0,0,.3)', borderRadius:12, padding:14 }}>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:S.muted }}>Mi equipo</div><div style={{ fontSize:44, fontWeight:900 }}>{score.home}</div></div>
              <div style={{ fontSize:18, color:S.muted }}>–</div>
              <div style={{ textAlign:'center' }}><div style={{ fontSize:10, color:S.muted }}>{matchInfo.rival||'Rival'}</div><div style={{ fontSize:44, fontWeight:900 }}>{score.away}</div></div>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:S.muted, marginBottom:8, textTransform:'uppercase' }}>Mejores jugadores</div>
              {[{ k:'first', l:'🥇 MVP' }, { k:'second', l:'🥈 Segundo' }, { k:'third', l:'🥉 Tercero' }].map(({ k, l }) => (
                <div key={k} style={{ marginBottom:6 }}>
                  <label style={{ fontSize:10, color:S.muted, display:'block', marginBottom:3 }}>{l}</label>
                  <select value={mvp[k]||''} onChange={e => setMvp(m => ({ ...m, [k]: e.target.value }))} style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:8, padding:'7px 9px', color:S.text, fontSize:12 }}>
                    <option value="">Seleccionar...</option>
                    {lineup.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(0,0,0,.26)', borderRadius:10, padding:12, marginBottom:16 }}>
              <div style={{ fontSize:9, color:S.muted, marginBottom:7, textTransform:'uppercase' }}>Estadísticas</div>
              {[['Duración', fmtTime(timerSec)], ['Goles marcados', events.filter(e=>e.type==='goal').length], ['Cambios', events.filter(e=>e.type==='sub').length], ['Amarillas', events.filter(e=>e.type==='yellow').length], ['Rojas', events.filter(e=>e.type==='red').length]].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,.07)' }}><span style={{ color:S.text2 }}>{l}</span><span style={{ fontWeight:700, color:S.cyan }}>{v}</span></div>
              ))}
            </div>
            {jugaron.length > 0 && (() => {
              const minutosCalc = calcularMinutosJugados()
              return (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:S.muted, marginBottom:4, textTransform:'uppercase' }}>Estadísticas detalladas por jugador</div>
                  <div style={{ fontSize:9.5, color:S.muted, marginBottom:8 }}>Los minutos se calculan solos desde que entró hasta que salió — corrígelos si hace falta.</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:260, overflowY:'auto' }}>
                    {jugaron.map(pid => {
                      const nombre = roster.find(r => r.id === pid)?.name || '—'
                      const esTitular = titulares.includes(pid)
                      const st = statsExtra[pid] || {}
                      const minutosDefault = minutosCalc[pid] ?? 0
                      const upd = (campo, val) => setStatsExtra(s => ({ ...s, [pid]: { ...s[pid], [campo]: val === '' ? null : Number(val) } }))
                      return (
                        <div key={pid} style={{ background:'rgba(0,0,0,.26)', borderRadius:8, padding:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                            <span style={{ fontSize:11.5, fontWeight:700, color:S.text }}>{nombre}</span>
                            <span style={{ fontSize:8.5, fontWeight:800, color: esTitular ? S.gold : S.muted, background: esTitular ? 'rgba(249,168,37,.15)' : 'rgba(255,255,255,.06)', borderRadius:6, padding:'1px 6px' }}>
                              {esTitular ? '★ Titular' : 'Suplente'}
                            </span>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:5 }}>
                            <input type="number" min="0" placeholder="Min" value={st.minutos ?? minutosDefault} onChange={e => upd('minutos', e.target.value)} style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:6, padding:'5px 4px', color:S.text, fontSize:11, textAlign:'center', boxSizing:'border-box' }} title="Minutos jugados (calculados automático, editable)"/>
                            <input type="number" min="0" placeholder="Rec" value={st.recuperaciones ?? ''} onChange={e => upd('recuperaciones', e.target.value)} style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:6, padding:'5px 4px', color:S.text, fontSize:11, textAlign:'center', boxSizing:'border-box' }} title="Recuperaciones"/>
                            <input type="number" min="0" placeholder="Pases" value={st.pases_acertados ?? ''} onChange={e => upd('pases_acertados', e.target.value)} style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:6, padding:'5px 4px', color:S.text, fontSize:11, textAlign:'center', boxSizing:'border-box' }} title="Pases acertados"/>
                            <input type="number" min="1" max="10" step="0.5" placeholder="Nota" value={st.calificacion ?? ''} onChange={e => upd('calificacion', e.target.value)} style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:6, padding:'5px 4px', color:S.text, fontSize:11, textAlign:'center', boxSizing:'border-box' }} title="Calificación del entrenador (1-10)"/>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-around', fontSize:8.5, color:S.muted, marginTop:3 }}>
                            <span>Minutos</span><span>Recup.</span><span>Pases</span><span>Nota</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:10, color:S.muted, display:'block', marginBottom:3, textTransform:'uppercase' }}>Observaciones</label>
              <textarea value={matchObs} onChange={e => setMatchObs(e.target.value)} placeholder="Incidentes, resumen, comentarios..."
                style={{ width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:8, padding:8, color:S.text, fontSize:12, minHeight:65, resize:'vertical', boxSizing:'border-box' }}/>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowFinish(false)} style={{ flex:1, background:'rgba(255,255,255,.07)', border:`1px solid ${S.border}`, color:'#fff', borderRadius:8, padding:'10px 0', fontSize:12, cursor:'pointer' }}>Volver</button>
              <button onClick={guardarHistorial} disabled={guardandoFinal} style={{ flex:2, background:'linear-gradient(135deg,#10b981,#0f4c75)', border:'none', color:'#fff', borderRadius:8, padding:'10px 0', fontWeight:900, fontSize:12, cursor:'pointer', opacity:guardandoFinal?.7:1 }}>{guardandoFinal ? 'Guardando...' : '💾 GUARDAR EN HISTORIAL'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
