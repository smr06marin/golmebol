import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import {
  ArrowLeft, Filter, ChevronDown, Shield, X, Calendar, MapPin, Trophy, Award,
  Flame, BarChart3, LayoutGrid, Clock, Image as ImageIcon, Home, User,
} from 'lucide-react'
import BuscadorJugador from '../components/BuscadorJugador'

const S = {
  navy:    '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border:  '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', goldDim: 'rgba(249,168,37,.1)',
  win: '#1e8e3e', winDim: 'rgba(30,142,62,.1)',
  loss: '#d93025', lossDim: 'rgba(217,48,37,.1)',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

const FILTROS = [
  { id: 'todos',     label: 'Todo' },
  { id: 'goles',     label: '⚽ Goles' },
  { id: 'amarillas', label: '🟨 Amarillas' },
  { id: 'azules',    label: '🟦 Azules' },
  { id: 'rojas',     label: '🟥 Rojas' },
  { id: 'victorias', label: '✅ Victorias' },
  { id: 'derrotas',  label: '❌ Derrotas' },
  { id: 'empates',   label: '➖ Empates' },
  { id: 'mvp',       label: '⭐ MVP' },
]

const TABS = [
  { id: 'resumen',      label: 'Resumen',      icon: LayoutGrid },
  { id: 'partidos',     label: 'Partidos',     icon: Calendar },
  { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { id: 'logros',       label: 'Logros',       icon: Trophy },
  { id: 'historial',    label: 'Historial',    icon: Clock },
  { id: 'galeria',      label: 'Galería',      icon: ImageIcon },
]

function calcularEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), nac = new Date(fecha)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function ModalDetallePartido({ stat, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'540px', maxHeight:'85vh', overflowY:'auto', paddingBottom:'32px', border:`0.5px solid ${S.border}` }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:S.surface, zIndex:1 }}>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:S.text }}>
              {stat.matches?.home?.name} vs {stat.matches?.away?.name}
            </div>
            <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>
              {stat.matches?.played_at && new Date(stat.matches.played_at).toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
              {stat.matches?.matchday && ` · J${stat.matches.matchday}`}
              {stat.tournament_name && ` · ${stat.tournament_name}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={20}/></button>
        </div>

        {/* Marcador */}
        <div style={{ padding:'18px 20px', background:S.card, borderBottom:`0.5px solid ${S.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:S.card2, border:`1px solid ${S.border}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {stat.matches?.home?.logo_url ? <img src={stat.matches.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={16} color={S.muted}/>}
              </div>
              <div style={{ flex:1, minWidth:0, background:S.card2, borderRadius:'9px', padding:'8px 10px' }}>
                <div style={{ fontSize:'.76rem', fontWeight:'800', color:S.text, textTransform:'uppercase', letterSpacing:'.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stat.matches?.home?.name}</div>
              </div>
            </div>
            <div style={{ fontWeight:'900', fontSize:'1.5rem', color:S.text, background:S.card2, border:`1.5px solid ${S.border}`, borderRadius:'12px', padding:'6px 16px', flexShrink:0 }}>
              {stat.matches?.home_score} — {stat.matches?.away_score}
            </div>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', minWidth:0, flexDirection:'row-reverse' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:S.card2, border:`1px solid ${S.border}`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {stat.matches?.away?.logo_url ? <img src={stat.matches.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={16} color={S.muted}/>}
              </div>
              <div style={{ flex:1, minWidth:0, background:S.card2, borderRadius:'9px', padding:'8px 10px', textAlign:'right' }}>
                <div style={{ fontSize:'.76rem', fontWeight:'800', color:S.text, textTransform:'uppercase', letterSpacing:'.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stat.matches?.away?.name}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mi resultado */}
        <div style={{ padding:'14px 20px', borderBottom:`0.5px solid ${S.border}` }}>
          <div style={{ fontSize:'.72rem', fontWeight:'600', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mi resultado</div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {(() => {
              const r = stat.team_result
              const color = r==='win'?S.win:r==='draw'?S.gold:S.loss
              const bg    = r==='win'?S.winDim:r==='draw'?S.goldDim:S.lossDim
              const label = r==='win'?'Victoria':r==='draw'?'Empate':'Derrota'
              return <span style={{ fontSize:'.85rem', fontWeight:'700', color, background:bg, borderRadius:'8px', padding:'4px 14px' }}>{label}</span>
            })()}
            <span style={{ fontSize:'.78rem', color:S.text2 }}>jugando con <b style={{ color:S.text }}>{stat.teams?.name}</b></span>
            {stat.es_mvp && <span style={{ fontSize:'.78rem', color:S.gold, background:S.goldDim, borderRadius:'8px', padding:'3px 10px', fontWeight:'700' }}>⭐ MVP del partido</span>}
          </div>
        </div>

        {/* Mis estadísticas del partido */}
        <div style={{ padding:'14px 20px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'600', color:S.muted, marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mis estadísticas</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { label:'Goles',      value: stat.goals_scored   || 0, color:S.cyan, bg:S.cyanDim, icon:'⚽' },
              { label:'Amarillas',  value: stat.yellow_cards   || 0, color:S.gold, bg:S.goldDim, icon:'🟨' },
              { label:'Azules',     value: stat.blue_cards     || 0, color:'#4a9eff', bg:'rgba(74,158,255,.1)', icon:'🟦' },
              { label:'Rojas',      value: stat.red_cards      || 0, color:S.loss, bg:S.lossDim, icon:'🟥' },
              { label:'Faltas',     value: stat.fouls          || 0, color:S.muted, bg:S.card2, icon:'✋' },
              { label:'Recibidos',  value: stat.goals_conceded || 0, color:S.muted, bg:S.card2, icon:'🧤' },
            ].map(s => (
              <div key={s.label} style={{ background: s.value > 0 ? s.bg : S.card, borderRadius:'10px', padding:'12px', textAlign:'center', border: s.value > 0 ? `1px solid ${s.color}40` : `1px solid ${S.border}` }}>
                <div style={{ fontSize:'1.1rem', marginBottom:'2px' }}>{s.icon}</div>
                <div style={{ fontSize:'1.4rem', fontWeight:'900', color: s.value > 0 ? s.color : S.muted, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'3px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlayerHistorialPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore() // ya validado por PlayerRoute — evita otra ida y vuelta al login
  const [loading,      setLoading]      = useState(true)
  const [player,       setPlayer]       = useState(null)
  const [historial,    setHistorial]    = useState([])
  const [torneos,      setTorneos]      = useState([])
  const [logrosAll,    setLogrosAll]    = useState([])
  const [filtroTipo,   setFiltroTipo]   = useState('todos')
  const [filtroTorneo, setFiltroTorneo] = useState('todos')
  const [detalle,      setDetalle]      = useState(null)
  const [showFiltros,  setShowFiltros]  = useState(false)
  const [tab,          setTab]          = useState('resumen')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)

    // PlayerRoute ya garantiza que hay usuario logueado antes de mostrar esta
    // página, así que usamos el user del store en vez de volver a pedirlo a
    // Supabase (evita una ida y vuelta extra en cada entrada).
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador'); return }
    setPlayer(p)

    // Historial y logros (MVP + campeonatos) salen juntos: son independientes entre sí.
    const [{ data: stats }, { data: logros }] = await Promise.all([
      supabase
        .from('player_match_stats')
        .select(`
          *,
          matches(
            id, played_at, home_score, away_score, matchday, grupo, fase,
            home:home_team_id(id, name, logo_url),
            away:away_team_id(id, name, logo_url)
          ),
          teams(id, name, logo_url),
          tournaments(id, name, modalidad, season)
        `)
        .eq('player_id', p.id)
        .order('created_at', { ascending: false }),
      supabase.from('tournament_logros').select('id, tipo, match_id, tournament_id, tournaments(name)').eq('player_id', p.id),
    ])

    setLogrosAll(logros || [])
    const mvpMatchIds = new Set((logros || []).filter(l => l.tipo === 'mvp').map(l => l.match_id))

    // Enriquecer con nombre de torneo y mvp
    const enriquecido = (stats || []).map(s => ({
      ...s,
      tournament_name: s.tournaments?.name || '',
      es_mvp: mvpMatchIds.has(s.match_id),
    }))

    setHistorial(enriquecido)

    // Lista de torneos únicos
    const torneosMap = {}
    enriquecido.forEach(s => {
      if (s.tournaments) torneosMap[s.tournaments.id] = s.tournaments
    })
    setTorneos(Object.values(torneosMap))

    setLoading(false)
  }

  // Filtrar historial
  const historialFiltrado = historial.filter(s => {
    if (filtroTorneo !== 'todos' && s.tournaments?.id !== filtroTorneo) return false
    if (filtroTipo === 'goles')     return s.goals_scored   > 0
    if (filtroTipo === 'amarillas') return s.yellow_cards   > 0
    if (filtroTipo === 'azules')    return s.blue_cards     > 0
    if (filtroTipo === 'rojas')     return s.red_cards      > 0
    if (filtroTipo === 'victorias') return s.team_result    === 'win'
    if (filtroTipo === 'derrotas')  return s.team_result    === 'loss'
    if (filtroTipo === 'empates')   return s.team_result    === 'draw'
    if (filtroTipo === 'mvp')       return s.es_mvp
    return true
  })

  // Conteos para mostrar cuántos partidos hay detrás de cada filtro (solo con
  // el filtro de torneo aplicado, para que se vea cuánto aporta cada "Mostrar").
  const historialPorTorneo = historial.filter(s => filtroTorneo === 'todos' || s.tournaments?.id === filtroTorneo)
  function contarTipo(id) {
    switch (id) {
      case 'todos':      return historialPorTorneo.length
      case 'goles':      return historialPorTorneo.filter(s => (s.goals_scored   || 0) > 0).length
      case 'amarillas':  return historialPorTorneo.filter(s => (s.yellow_cards   || 0) > 0).length
      case 'azules':     return historialPorTorneo.filter(s => (s.blue_cards     || 0) > 0).length
      case 'rojas':      return historialPorTorneo.filter(s => (s.red_cards      || 0) > 0).length
      case 'victorias':  return historialPorTorneo.filter(s => s.team_result === 'win').length
      case 'derrotas':   return historialPorTorneo.filter(s => s.team_result === 'loss').length
      case 'empates':    return historialPorTorneo.filter(s => s.team_result === 'draw').length
      case 'mvp':        return historialPorTorneo.filter(s => s.es_mvp).length
      default:           return 0
    }
  }
  const torneosConteo = torneos.map(t => ({ ...t, count: historial.filter(s => s.tournaments?.id === t.id).length }))

  // Partidos agrupados por mes (más reciente primero) para que la lista se
  // lea como una línea de tiempo, en vez de un bloque plano de tarjetas.
  const capitalizar = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const historialOrdenado = [...historialFiltrado].sort((a, b) => new Date(b.matches?.played_at || 0) - new Date(a.matches?.played_at || 0))
  const gruposPorMes = []
  historialOrdenado.forEach(s => {
    const fecha = s.matches?.played_at ? new Date(s.matches.played_at) : null
    const key   = fecha ? capitalizar(fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })) : 'Sin fecha'
    let grupo = gruposPorMes.find(g => g.key === key)
    if (!grupo) { grupo = { key, items: [] }; gruposPorMes.push(grupo) }
    grupo.items.push(s)
  })

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando historial...</div>
  )

  // ── Datos derivados para Resumen / Estadísticas / Logros ──
  const historialTodoOrdenado = [...historial].sort((a, b) => new Date(b.matches?.played_at || 0) - new Date(a.matches?.played_at || 0))
  const pj          = historial.length
  const goles       = historial.reduce((s, r) => s + (r.goals_scored   || 0), 0)
  const amarillas   = historial.reduce((s, r) => s + (r.yellow_cards   || 0), 0)
  const azules      = historial.reduce((s, r) => s + (r.blue_cards     || 0), 0)
  const rojas       = historial.reduce((s, r) => s + (r.red_cards      || 0), 0)
  const faltas      = historial.reduce((s, r) => s + (r.fouls          || 0), 0)
  const recibidos   = historial.reduce((s, r) => s + (r.goals_conceded || 0), 0)
  const victorias   = historial.filter(s => s.team_result === 'win').length
  const empates     = historial.filter(s => s.team_result === 'draw').length
  const derrotas    = historial.filter(s => s.team_result === 'loss').length
  const efectividad = pj > 0 ? Math.round((victorias / pj) * 100) : 0
  const promedioGoles = pj > 0 ? goles / pj : 0
  const mvpsCount    = historial.filter(s => s.es_mvp).length
  const tarjetasTotal = amarillas + azules + rojas
  const esArquero = player?.posicion_futbol5 === 'Portero' || player?.posicion_futbol7 === 'Portero' || player?.posicion_futbol11 === 'Portero'

  const ultimoStat   = historialTodoOrdenado.find(s => s.matches?.played_at)
  const equipoActual = ultimoStat?.teams || null
  const jerseyActual = ultimoStat?.numero_camiseta || null
  const posicion     = player?.posicion_futbol5 || player?.posicion_futbol7 || player?.posicion_futbol11 || null
  const edad         = calcularEdad(player?.fecha_nacimiento)

  const historialConPartido = historial.filter(s => s.matches)
  const mejorActuacion = historialConPartido.length > 0
    ? [...historialConPartido].sort((a, b) =>
        (b.goals_scored || 0) - (a.goals_scored || 0) ||
        (b.es_mvp ? 1 : 0) - (a.es_mvp ? 1 : 0) ||
        new Date(b.matches?.played_at || 0) - new Date(a.matches?.played_at || 0))[0]
    : null

  const chartData = [...historial].filter(s => s.matches?.played_at)
    .sort((a, b) => new Date(a.matches.played_at) - new Date(b.matches.played_at))
    .slice(-16)
  const maxGoles = Math.max(1, ...chartData.map(s => s.goals_scored || 0))

  // Desglose por torneo (para Estadísticas)
  const porTorneo = torneos.map(t => {
    const items = historial.filter(s => s.tournaments?.id === t.id)
    return {
      torneo: t,
      pj: items.length,
      goles: items.reduce((s, r) => s + (r.goals_scored || 0), 0),
      tarjetas: items.reduce((s, r) => s + (r.yellow_cards||0) + (r.blue_cards||0) + (r.red_cards||0), 0),
    }
  }).sort((a, b) => b.goles - a.goles)

  // Logros / hitos calculados a partir de datos reales (sin inventar nada)
  const campeonatos = (() => {
    const map = {}
    logrosAll.filter(l => l.tipo === 'campeon').forEach(l => { if (l.tournament_id) map[l.tournament_id] = l.tournaments?.name || 'Torneo' })
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  })()
  const mvpAwards = historialTodoOrdenado.filter(s => s.es_mvp)
  const hatTricks = historial.filter(s => (s.goals_scored || 0) >= 3).length
  const HITOS = [
    { id:'pj10',  label:'10 partidos jugados', logrado: pj >= 10,  meta: 10,  actual: pj,    icon:'📅' },
    { id:'pj25',  label:'25 partidos jugados', logrado: pj >= 25,  meta: 25,  actual: pj,    icon:'📅' },
    { id:'pj50',  label:'50 partidos jugados', logrado: pj >= 50,  meta: 50,  actual: pj,    icon:'📅' },
    { id:'g10',   label:'10 goles en su carrera', logrado: goles >= 10, meta: 10, actual: goles, icon:'⚽' },
    { id:'g25',   label:'25 goles en su carrera', logrado: goles >= 25, meta: 25, actual: goles, icon:'⚽' },
    { id:'g50',   label:'50 goles en su carrera', logrado: goles >= 50, meta: 50, actual: goles, icon:'⚽' },
    { id:'mvp5',  label:'5 veces MVP del partido', logrado: mvpsCount >= 5, meta: 5, actual: mvpsCount, icon:'⭐' },
    { id:'hat',   label:'Un hat-trick (3+ goles en un partido)', logrado: hatTricks > 0, meta: 1, actual: hatTricks, icon:'🎩' },
  ]

  const fotos = [player?.photo_face_url, player?.photo_url].filter((v, i, arr) => v && arr.indexOf(v) === i)

  function MatchCard({ s, compacto }) {
    const resultado = s.team_result
    const resColor  = resultado==='win'?S.win:resultado==='draw'?S.gold:S.loss
    const resBg     = resultado==='win'?S.winDim:resultado==='draw'?S.goldDim:S.lossDim
    const resLabel  = resultado==='win'?'G':resultado==='draw'?'E':'P'
    const match     = s.matches
    return (
      <div onClick={() => setDetalle(s)}
        style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', overflow:'hidden', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'10px 14px 0', flexWrap:'wrap' }}>
          <span style={{ fontSize:'.65rem', fontWeight:'700', color:resColor, background:resBg, borderRadius:'4px', padding:'2px 7px' }}>{resLabel}</span>
          {s.es_mvp && <span style={{ fontSize:'.62rem', color:S.gold, background:S.goldDim, borderRadius:'20px', padding:'2px 8px', fontWeight:'700' }}>⭐ MVP</span>}
          {match?.matchday && <span style={{ fontSize:'.62rem', color:S.cyan, background:S.cyanDim, borderRadius:'20px', padding:'2px 8px', fontWeight:'700' }}>Fecha {match.matchday}</span>}
          {match?.grupo && <span style={{ fontSize:'.6rem', color:'#c7a6ff', background:'rgba(153,85,255,.12)', borderRadius:'20px', padding:'2px 8px', fontWeight:'700' }}>{match.grupo}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:S.card2, border:`1px solid ${S.border}`, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {match?.home?.logo_url ? <img src={match.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={13} color={S.muted}/>}
            </div>
            <div style={{ flex:1, minWidth:0, background:S.card2, borderRadius:'9px', padding:'7px 9px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:'800', color:S.text, textTransform:'uppercase', letterSpacing:'.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{match?.home?.name}</div>
            </div>
          </div>
          <div style={{ fontWeight:'900', fontSize:'1rem', color:S.text, background:S.card2, border:`1.5px solid ${S.border}`, borderRadius:'10px', padding:'6px 11px', flexShrink:0, minWidth:'54px', textAlign:'center' }}>
            {match?.home_score} - {match?.away_score}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', minWidth:0, flexDirection:'row-reverse' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:S.card2, border:`1px solid ${S.border}`, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {match?.away?.logo_url ? <img src={match.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={13} color={S.muted}/>}
            </div>
            <div style={{ flex:1, minWidth:0, background:S.card2, borderRadius:'9px', padding:'7px 9px', textAlign:'right' }}>
              <div style={{ fontSize:'.72rem', fontWeight:'800', color:S.text, textTransform:'uppercase', letterSpacing:'.2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{match?.away?.name}</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign:'center', paddingBottom:'8px' }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'.64rem', fontWeight:'800', color:S.muted, letterSpacing:'.4px', textTransform:'uppercase', background:S.card2, padding:'4px 12px', borderRadius:'20px' }}>
            📅 {match?.played_at ? new Date(match.played_at).toLocaleDateString('es-CO', { day:'2-digit', month:'long' }) : 'Fecha por definir'}
          </span>
        </div>
        {!compacto && (
          <>
            <div style={{ fontSize:'.68rem', color:S.muted, textAlign:'center', paddingBottom:'8px' }}>
              🏆 {s.tournament_name} {s.teams?.name && `· ${s.teams.name}`}
            </div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'0 14px 12px', justifyContent:'center' }}>
              {(s.goals_scored   ||0)>0 && <span style={{ fontSize:'.72rem', color:S.cyan, background:S.cyanDim, borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>⚽ {s.goals_scored} gol{s.goals_scored>1?'es':''}</span>}
              {(s.yellow_cards   ||0)>0 && <span style={{ fontSize:'.72rem', color:S.gold, background:S.goldDim, borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟨 Amarilla</span>}
              {(s.blue_cards     ||0)>0 && <span style={{ fontSize:'.72rem', color:'#4a9eff', background:'rgba(74,158,255,.1)', borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟦 Azul</span>}
              {(s.red_cards      ||0)>0 && <span style={{ fontSize:'.72rem', color:S.loss, background:S.lossDim, borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟥 Roja</span>}
              {(s.fouls          ||0)>0 && <span style={{ fontSize:'.72rem', color:S.muted, background:S.card2, borderRadius:'20px', padding:'2px 9px' }}>✋ {s.fouls} falta{s.fouls>1?'s':''}</span>}
              {(s.goals_conceded ||0)>0 && <span style={{ fontSize:'.72rem', color:S.muted, background:S.card2, borderRadius:'20px', padding:'2px 9px' }}>🧤 {s.goals_conceded} recibido{s.goals_conceded>1?'s':''}</span>}
              {(s.goals_scored||0)===0 && (s.yellow_cards||0)===0 && (s.blue_cards||0)===0 && (s.red_cards||0)===0 && (s.fouls||0)===0 && (s.goals_conceded||0)===0 && (
                <span style={{ fontSize:'.72rem', color:S.muted }}>Sin incidencias</span>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'86px' }}>

      {detalle && <ModalDetallePartido stat={detalle} onClose={() => setDetalle(null)}/>}

      {/* Header */}
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
            <button onClick={() => navigate('/jugador')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'10px', padding:'8px', cursor:'pointer', color:S.text, display:'flex', alignItems:'center', flexShrink:0 }}>
              <ArrowLeft size={18}/>
            </button>
            <div>
              <div style={{ fontWeight:'900', fontSize:'1.3rem', color:S.text, lineHeight:1.15 }}>Mi historial</div>
              <div style={{ fontSize:'.76rem', color:S.muted, marginTop:'2px' }}>Toda la carrera de un jugador en un solo lugar</div>
            </div>
          </div>
          {tab === 'partidos' && (
            <button onClick={() => setShowFiltros(!showFiltros)}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', background: showFiltros ? S.cyan : 'rgba(0,221,208,.08)', border:`1px solid ${S.cyan}`, borderRadius:'20px', cursor:'pointer', color: showFiltros ? '#000' : S.cyan, fontSize:'.78rem', fontWeight:'700', flexShrink:0 }}>
              <Filter size={14}/> Filtros
              {(filtroTipo !== 'todos' || filtroTorneo !== 'todos') && (
                <span style={{ background:S.loss, color:'#fff', borderRadius:'50%', width:'16px', height:'16px', fontSize:'.6rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700' }}>
                  {(filtroTipo !== 'todos' ? 1 : 0) + (filtroTorneo !== 'todos' ? 1 : 0)}
                </span>
              )}
              <ChevronDown size={14} style={{ transition:'transform .15s', transform: showFiltros ? 'rotate(180deg)' : 'none' }}/>
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:'640px', margin:'0 auto', padding:'16px' }}>

        {/* Tarjeta de perfil */}
        <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'18px', padding:'18px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
          <div style={{ width:'70px', height:'70px', borderRadius:'50%', border:`2px solid ${S.cyan}`, overflow:'hidden', flexShrink:0, background:S.card2, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {player?.photo_face_url || player?.photo_url
              ? <img src={player.photo_face_url || player.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <User size={28} color={S.muted}/>}
          </div>
          <div style={{ flex:1, minWidth:'180px' }}>
            <div style={{ fontWeight:'900', fontSize:'1.2rem', color:S.text }}>{player?.name}</div>
            <div style={{ fontSize:'.78rem', color:S.muted, marginTop:'2px' }}>
              {[posicion, jerseyActual ? `#${jerseyActual}` : null].filter(Boolean).join(' · ') || 'Jugador'}
            </div>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginTop:'8px' }}>
              {edad != null && (
                <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'.74rem', color:S.text2 }}><Calendar size={12} color={S.muted}/> {edad} años</span>
              )}
              {player?.city && (
                <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'.74rem', color:S.text2 }}><MapPin size={12} color={S.muted}/> {player.city}</span>
              )}
              {equipoActual && (
                <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'.74rem', color:S.text2 }}>
                  <div style={{ width:'14px', height:'14px', borderRadius:'4px', overflow:'hidden', background:S.card2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {equipoActual.logo_url ? <img src={equipoActual.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={9} color={S.muted}/>}
                  </div>
                  {equipoActual.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Buscador */}
        {player && (
          <div style={{ marginBottom:'16px' }}>
            <BuscadorJugador playerId={player.id}/>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'12px', marginBottom:'4px', scrollbarWidth:'none' }}>
          {TABS.map(t => {
            const Icon = t.icon
            const activo = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'6px', padding:'9px 14px', borderRadius:'12px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', background: activo ? S.cyan : S.card, color: activo ? '#000' : S.muted }}>
                <Icon size={15}/> {t.label}
              </button>
            )
          })}
        </div>

        {/* ── TAB: Resumen ── */}
        {tab === 'resumen' && (
          <div>
            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, margin:'10px 0 10px' }}>Resumen general</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))', gap:'10px', marginBottom:'16px' }}>
              {[
                { label:'Partidos', valor: pj,          icon:'📅', color:S.cyan },
                { label:'Goles',    valor: goles,        icon:'⚽', color:S.win },
                { label:'MVP',      valor: mvpsCount,    icon:'⭐', color:S.gold },
                { label:'Tarjetas', valor: tarjetasTotal,icon:'🟨', color:'#e8a33d' },
              ].map(c => (
                <div key={c.label} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:'1.4rem', marginBottom:'6px' }}>{c.icon}</div>
                  <div style={{ fontSize:'1.5rem', fontWeight:'900', color:S.text, lineHeight:1 }}>{c.valor}</div>
                  <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'4px' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {pj > 0 && (
              <>
                <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>Rendimiento</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px' }}>
                  <div style={{ flex:'1 1 140px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'.68rem', color:S.muted }}>Promedio de goles</div>
                      <div style={{ fontSize:'1.6rem', fontWeight:'900', color:S.text }}>{promedioGoles.toFixed(2)}</div>
                      <div style={{ fontSize:'.66rem', color:S.muted }}>goles por partido</div>
                    </div>
                    <div style={{ position:'relative', width:'92px', height:'92px', borderRadius:'50%', background:`conic-gradient(${S.win} ${efectividad * 3.6}deg, ${S.card2} 0deg)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:'70px', height:'70px', borderRadius:'50%', background:S.card, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ fontSize:'1.05rem', fontWeight:'900', color:S.text }}>{efectividad}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize:'.66rem', color:S.muted, textAlign:'center' }}>Efectividad<br/>(partidos ganados)</div>
                  </div>

                  <div style={{ flex:'2 1 220px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:S.win, display:'inline-block' }}/>
                      <span style={{ fontSize:'.72rem', color:S.text2 }}>Goles por partido (últimos {chartData.length})</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'90px' }}>
                      {chartData.map((s, i) => (
                        <div key={i} title={`${s.goals_scored||0} gol(es)`} style={{ flex:1, height:`${((s.goals_scored||0)/maxGoles)*100}%`, minHeight:'3px', background: (s.goals_scored||0) > 0 ? S.win : S.card2, borderRadius:'3px 3px 0 0' }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:'.62rem', color:S.muted, marginTop:'8px', textAlign:'center' }}>* Un partido por barra, del más antiguo al más reciente</div>
                  </div>
                </div>
              </>
            )}

            {mejorActuacion && (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>Mejor actuación</div>
                  <button onClick={() => setTab('partidos')} style={{ background:'none', border:'none', color:S.cyan, fontSize:'.76rem', fontWeight:'700', cursor:'pointer' }}>Ver todos</button>
                </div>
                <div onClick={() => setDetalle(mejorActuacion)}
                  style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'20px', textAlign:'center', marginBottom:'16px', cursor:'pointer' }}>
                  <div style={{ width:'56px', height:'56px', borderRadius:'50%', border:`2px solid ${S.loss}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px' }}>
                    <Flame size={24} color={S.loss}/>
                  </div>
                  {(mejorActuacion.goals_scored || 0) > 0 && (
                    <span style={{ display:'inline-block', fontSize:'.68rem', fontWeight:'800', color:S.win, background:S.winDim, borderRadius:'20px', padding:'3px 12px', marginBottom:'10px' }}>
                      {mejorActuacion.goals_scored} GOL{mejorActuacion.goals_scored > 1 ? 'ES' : ''}
                    </span>
                  )}
                  <div style={{ fontWeight:'900', fontSize:'1.1rem', color:S.text }}>
                    vs {mejorActuacion.matches?.home?.id === mejorActuacion.team_id ? mejorActuacion.matches?.away?.name : mejorActuacion.matches?.home?.name}
                  </div>
                  <div style={{ fontSize:'.74rem', color:S.muted, marginTop:'4px' }}>
                    {mejorActuacion.tournament_name}
                    {mejorActuacion.matches?.played_at && ` · ${new Date(mejorActuacion.matches.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})}`}
                    {mejorActuacion.teams?.name && ` · con ${mejorActuacion.teams.name}`}
                  </div>
                  {mejorActuacion.es_mvp && <div style={{ marginTop:'8px', fontSize:'.74rem', color:S.gold, fontWeight:'700' }}>⭐ MVP del partido</div>}
                </div>
              </>
            )}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
              <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>Historial reciente</div>
              <button onClick={() => setTab('partidos')} style={{ background:'none', border:'none', color:S.cyan, fontSize:'.76rem', fontWeight:'700', cursor:'pointer' }}>Ver todos</button>
            </div>
            {historialTodoOrdenado.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'40px', textAlign:'center', color:S.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div style={{ fontSize:'.85rem' }}>Todavía no hay partidos registrados</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {historialTodoOrdenado.slice(0, 3).map((s, i) => <MatchCard key={i} s={s} compacto/>)}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Partidos ── */}
        {tab === 'partidos' && (
          <div>
            {showFiltros && (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px', marginBottom:'14px' }}>
                {torneos.length > 0 && (
                  <div style={{ marginBottom:'14px' }}>
                    <div style={{ fontSize:'.7rem', fontWeight:'700', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Torneo</div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      <button onClick={() => setFiltroTorneo('todos')}
                        style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 8px 6px 14px', borderRadius:'20px', border:`1px solid ${filtroTorneo==='todos'?S.cyan:S.border}`, background: filtroTorneo==='todos'?S.cyan:S.card2, color: filtroTorneo==='todos'?'#000':S.text2, fontSize:'.75rem', fontWeight: filtroTorneo==='todos'?'700':'500', cursor:'pointer' }}>
                        Todos
                        <span style={{ fontSize:'.64rem', fontWeight:'800', background: filtroTorneo==='todos'?'rgba(0,0,0,.2)':S.card, color: filtroTorneo==='todos'?'#000':S.muted, borderRadius:'10px', padding:'1px 6px', minWidth:'16px', textAlign:'center' }}>{historial.length}</span>
                      </button>
                      {torneosConteo.map(t => (
                        <button key={t.id} onClick={() => setFiltroTorneo(t.id)}
                          style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 8px 6px 14px', borderRadius:'20px', border:`1px solid ${filtroTorneo===t.id?S.cyan:S.border}`, background: filtroTorneo===t.id?S.cyan:S.card2, color: filtroTorneo===t.id?'#000':S.text2, fontSize:'.75rem', fontWeight: filtroTorneo===t.id?'700':'500', cursor:'pointer', maxWidth:'220px' }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
                          <span style={{ fontSize:'.64rem', fontWeight:'800', background: filtroTorneo===t.id?'rgba(0,0,0,.2)':S.card, color: filtroTorneo===t.id?'#000':S.muted, borderRadius:'10px', padding:'1px 6px', minWidth:'16px', textAlign:'center', flexShrink:0 }}>{t.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize:'.7rem', fontWeight:'700', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mostrar</div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {FILTROS.map(f => {
                      const count  = contarTipo(f.id)
                      const activo = filtroTipo === f.id
                      const vacio  = f.id !== 'todos' && count === 0
                      return (
                        <button key={f.id} onClick={() => !vacio && setFiltroTipo(f.id)}
                          style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 8px 6px 14px', borderRadius:'20px',
                            border:`1px solid ${activo?S.cyan:S.border}`, background: activo?S.cyan:S.card2,
                            color: activo?'#000':vacio?'#3a4658':S.text2, fontSize:'.75rem', fontWeight: activo?'700':'500',
                            cursor: vacio?'default':'pointer', opacity: vacio?.6:1 }}>
                          {f.label}
                          <span style={{ fontSize:'.64rem', fontWeight:'800', background: activo?'rgba(0,0,0,.2)':S.card, color: activo?'#000':S.muted, borderRadius:'10px', padding:'1px 6px', minWidth:'16px', textAlign:'center' }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                {(filtroTipo !== 'todos' || filtroTorneo !== 'todos') && (
                  <button onClick={() => { setFiltroTipo('todos'); setFiltroTorneo('todos') }}
                    style={{ marginTop:'12px', padding:'5px 14px', background:'none', border:`1px solid ${S.loss}55`, borderRadius:'20px', cursor:'pointer', color:S.loss, fontSize:'.75rem', fontWeight:'600' }}>
                    ✕ Limpiar filtros
                  </button>
                )}
              </div>
            )}

            <div style={{ fontSize:'.78rem', fontWeight:'600', color:S.text2, marginBottom:'10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>{historialFiltrado.length} partido{historialFiltrado.length !== 1 ? 's' : ''}</span>
              <span style={{ fontWeight:'400', color:S.muted, fontSize:'.7rem' }}>Toca para ver detalles</span>
            </div>

            {historialFiltrado.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🔍</div>
                <div style={{ fontSize:'.875rem' }}>Sin partidos con ese filtro</div>
              </div>
            ) : (
              <div className="gm-stagger" style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
                {gruposPorMes.map(grupo => (
                  <div key={grupo.key}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', padding:'0 2px' }}>
                      <Calendar size={12} color={S.muted}/>
                      <span style={{ fontSize:'.7rem', fontWeight:'700', color:S.text2, textTransform:'uppercase', letterSpacing:'.06em' }}>{grupo.key}</span>
                      <span style={{ fontSize:'.68rem', color:S.muted }}>· {grupo.items.length} partido{grupo.items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {grupo.items.map((s, i) => <MatchCard key={i} s={s}/>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Estadísticas ── */}
        {tab === 'estadisticas' && (
          <div>
            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>Totales de su carrera</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:'10px', marginBottom:'20px' }}>
              {[
                { label:'Partidos jugados', valor: pj, color:S.text },
                { label:'Goles',            valor: goles, color:S.win },
                { label:'Promedio goles',   valor: promedioGoles.toFixed(2), color:S.cyan },
                { label:'MVP',              valor: mvpsCount, color:S.gold },
                { label:'Victorias',        valor: victorias, color:S.win },
                { label:'Empates',          valor: empates, color:S.gold },
                { label:'Derrotas',         valor: derrotas, color:S.loss },
                { label:'Efectividad',      valor: `${efectividad}%`, color:S.cyan },
                { label:'Amarillas',        valor: amarillas, color:S.gold },
                { label:'Azules',           valor: azules, color:'#4a9eff' },
                { label:'Rojas',            valor: rojas, color:S.loss },
                { label:'Faltas',           valor: faltas, color:S.muted },
                ...(esArquero ? [{ label:'Goles recibidos', valor: recibidos, color:S.muted }] : []),
              ].map(c => (
                <div key={c.label} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'14px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:'1.25rem', fontWeight:'900', color:c.color }}>{c.valor}</div>
                  <div style={{ fontSize:'.64rem', color:S.muted, marginTop:'4px' }}>{c.label}</div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>Por torneo</div>
            {porTorneo.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'32px', textAlign:'center', color:S.muted, fontSize:'.85rem' }}>Sin datos todavía</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {porTorneo.map(row => (
                  <div key={row.torneo.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:'700', fontSize:'.85rem', color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.torneo.name}</div>
                      <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>{row.pj} PJ · {row.tarjetas} tarjeta{row.tarjetas!==1?'s':''}</div>
                    </div>
                    <div style={{ textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:'1.1rem', fontWeight:'900', color:S.win }}>{row.goles}</div>
                      <div style={{ fontSize:'.6rem', color:S.muted }}>goles</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Logros ── */}
        {tab === 'logros' && (
          <div>
            {campeonatos.length > 0 && (
              <>
                <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>🏆 Campeonatos</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                  {campeonatos.map(c => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'linear-gradient(135deg, rgba(249,168,37,.15), rgba(249,168,37,.03))', border:`1px solid ${S.gold}55`, borderRadius:'12px', padding:'12px 16px' }}>
                      <Trophy size={20} color={S.gold}/>
                      <span style={{ fontSize:'.85rem', fontWeight:'700', color:S.text }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>⭐ MVP del partido ({mvpAwards.length})</div>
            {mvpAwards.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'24px', textAlign:'center', color:S.muted, fontSize:'.82rem', marginBottom:'20px' }}>Todavía no ha sido MVP de un partido</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                {mvpAwards.slice(0, 10).map((s, i) => (
                  <div key={i} onClick={() => setDetalle(s)} style={{ display:'flex', alignItems:'center', gap:'10px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'10px 16px', cursor:'pointer' }}>
                    <Award size={18} color={S.gold}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'.8rem', fontWeight:'700', color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.matches?.home?.name} vs {s.matches?.away?.name}
                      </div>
                      <div style={{ fontSize:'.66rem', color:S.muted }}>
                        {s.tournament_name}{s.matches?.played_at && ` · ${new Date(s.matches.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>Hitos de su carrera</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px' }}>
              {HITOS.map(h => (
                <div key={h.id} style={{ background: h.logrado ? 'linear-gradient(135deg, rgba(0,221,208,.14), rgba(0,221,208,.02))' : S.card, border:`1px solid ${h.logrado?S.cyan+'55':S.border}`, borderRadius:'12px', padding:'14px', opacity: h.logrado ? 1 : .55 }}>
                  <div style={{ fontSize:'1.3rem', marginBottom:'6px' }}>{h.icon}</div>
                  <div style={{ fontSize:'.78rem', fontWeight:'700', color: h.logrado ? S.text : S.muted, lineHeight:1.3 }}>{h.label}</div>
                  <div style={{ fontSize:'.66rem', color:S.muted, marginTop:'4px' }}>
                    {h.logrado ? '✓ Logrado' : `${Math.min(h.actual, h.meta)}/${h.meta}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: Historial (línea de tiempo completa) ── */}
        {tab === 'historial' && (
          <div>
            <div style={{ fontSize:'.78rem', color:S.text2, marginBottom:'14px' }}>Toda su carrera, partido por partido, del más reciente al más antiguo.</div>
            {historialTodoOrdenado.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
                <div style={{ fontSize:'.875rem' }}>Todavía no hay partidos registrados</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {historialTodoOrdenado.map((s, i) => <MatchCard key={i} s={s}/>)}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Galería ── */}
        {tab === 'galeria' && (
          <div>
            <div style={{ fontSize:'.78rem', color:S.text2, marginBottom:'14px' }}>Fotos que tenemos guardadas de {player?.name}.</div>
            {fotos.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🖼️</div>
                <div style={{ fontSize:'.875rem' }}>Sin fotos guardadas todavía</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'10px' }}>
                {fotos.map((url, i) => (
                  <div key={i} style={{ borderRadius:'14px', overflow:'hidden', border:`1px solid ${S.border}`, aspectRatio:'1' }}>
                    <img src={url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position:'fixed', left:0, right:0, bottom:0, background:S.surface, borderTop:`0.5px solid ${S.border}`, padding:'8px 10px calc(8px + env(safe-area-inset-bottom))', zIndex:20 }}>
        <div style={{ maxWidth:'640px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-around' }}>
          <button onClick={() => navigate('/jugador')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', color:S.muted, padding:'4px 10px' }}>
            <Home size={20} strokeWidth={1.8}/><span style={{ fontSize:'.62rem', fontWeight:'600' }}>Inicio</span>
          </button>
          <button onClick={() => setTab('partidos')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', color: tab==='partidos'?S.cyan:S.muted, padding:'4px 10px' }}>
            <Calendar size={20} strokeWidth={tab==='partidos'?2.4:1.8}/><span style={{ fontSize:'.62rem', fontWeight: tab==='partidos'?'800':'600' }}>Partidos</span>
          </button>
          <button onClick={() => navigate('/jugador/apuestas')}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'50px', height:'50px', borderRadius:'50%', background:S.cyan, border:`4px solid ${S.surface}`, cursor:'pointer', marginTop:'-22px', boxShadow:'0 4px 14px rgba(0,221,208,.4)' }}>
            <span style={{ fontSize:'1.4rem', fontWeight:'900', color:'#000', lineHeight:1 }}>+</span>
          </button>
          <button onClick={() => setTab('resumen')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', color: tab==='resumen'?S.cyan:S.muted, padding:'4px 10px' }}>
            <User size={20} strokeWidth={tab==='resumen'?2.4:1.8}/><span style={{ fontSize:'.62rem', fontWeight: tab==='resumen'?'800':'600' }}>Perfil</span>
          </button>
        </div>
      </div>
    </div>
  )
}
