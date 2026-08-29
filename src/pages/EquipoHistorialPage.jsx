import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft, Shield, Users, Trophy, Calendar, Award, Search, X,
  LayoutGrid, BarChart3, Clock, MapPin,
} from 'lucide-react'
import { responderPregunta } from '../lib/motorPreguntas'
import { getPuntosTorneo } from '../lib/puntosTorneo'

const S = {
  navy:    '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border:  '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', goldDim: 'rgba(249,168,37,.1)',
  win: '#1e8e3e', winDim: 'rgba(30,142,62,.1)',
  loss: '#d93025', lossDim: 'rgba(217,48,37,.1)',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

const TABS = [
  { id: 'resumen',   label: 'Resumen',   icon: LayoutGrid },
  { id: 'torneos',   label: 'Torneos',   icon: Trophy },
  { id: 'partidos',  label: 'Partidos',  icon: Shield },
  { id: 'jugadores', label: 'Jugadores', icon: Users },
  { id: 'palmares',  label: 'Palmarés',  icon: Award },
  { id: 'historial', label: 'Historial', icon: Clock },
  { id: 'buscador',  label: 'Buscador',  icon: Search },
]

const normalizarTexto = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')

export default function EquipoHistorialPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [equipo,                setEquipo]                = useState(null)
  const [torneos,               setTorneos]               = useState([])
  const [jugadoresPorTorneo,    setJugadoresPorTorneo]    = useState({})
  const [posicionPorTorneo,     setPosicionPorTorneo]     = useState({})
  const [jugadoresEquipoGlobal, setJugadoresEquipoGlobal] = useState([])
  const [jugadoresActivos,      setJugadoresActivos]      = useState([])
  const [regsEquipo,            setRegsEquipo]            = useState([])
  const [filtroJugadores,       setFiltroJugadores]       = useState('activos')
  const [partidos,               setPartidos]              = useState([])
  const [logros,                 setLogros]                = useState([])
  const [stats,                  setStats]                 = useState(null)
  const [loading,                setLoading]               = useState(true)
  const [tab,                    setTab]                   = useState('resumen')
  const [busqueda,                setBusqueda]              = useState('')
  const [statsJugadores,          setStatsJugadores]        = useState(null)

  useEffect(() => { fetchTodo() }, [id])
  useEffect(() => {
    if (tab === 'buscador' && !statsJugadores) {
      supabase.from('player_match_stats')
        .select('player_id, goals_scored, goals_conceded, fue_arquero, yellow_cards, blue_cards, red_cards, fouls, team_result, players(name), matches(tournament_id, tournaments(name))')
        .eq('team_id', id)
        .then(({ data }) => setStatsJugadores(data || []))
    }
  }, [tab])

  async function fetchTodo() {
    setLoading(true)
    await Promise.all([fetchEquipo(), fetchTorneos(), fetchPartidos(), fetchLogros(), fetchJugadoresGlobal()])
    setLoading(false)
  }

  async function fetchEquipo() {
    const { data } = await supabase.from('teams').select('*').eq('id', id).single()
    setEquipo(data)
  }

  async function fetchJugadoresGlobal() {
    const { data } = await supabase.from('team_players').select('*, players(*)').eq('team_id', id)
    setJugadoresEquipoGlobal((data || []).map(r => r.players).filter(Boolean))
    const { data: activos } = await supabase.from('tournament_player_registrations').select('player_id').eq('team_id', id).eq('activo', true)
    setJugadoresActivos((activos || []).map(a => a.player_id))
    const { data: regsAll } = await supabase.from('tournament_player_registrations').select('player_id, tournament_id').eq('team_id', id)
    setRegsEquipo(regsAll || [])
  }

  async function fetchTorneos() {
    const { data: tt } = await supabase.from('tournament_teams').select('*, tournaments(*)').eq('team_id', id)
    setTorneos(tt || [])
    const jugMap = {}, posMap = {}

    // Un torneo no depende del otro — se piden todos en paralelo en vez de
    // uno por uno (eso era lo que hacía lenta la navegación a esta página).
    await Promise.all((tt || []).map(async t => {
      const [{ data: jug }, { data: equiposTorneo }, { data: partidosTorneo }] = await Promise.all([
        supabase.from('tournament_player_registrations').select('*, players(*)').eq('tournament_id', t.tournament_id).eq('team_id', id).eq('activo', true),
        supabase.from('tournament_teams').select('team_id').eq('tournament_id', t.tournament_id),
        supabase.from('matches').select('home_team_id, away_team_id, home_score, away_score, fase').eq('tournament_id', t.tournament_id).eq('status', 'finished'),
      ])
      jugMap[t.tournament_id] = jug || []

      // Posición en la tabla general del torneo (best-effort — solo fase de grupos)
      const Ppts = getPuntosTorneo(t.tournaments)
      const tabla = {}
      ;(equiposTorneo || []).forEach(e => { tabla[e.team_id] = { pts: 0, gf: 0, gc: 0 } })
      ;(partidosTorneo || []).filter(m => !m.fase || m.fase === 'grupo').forEach(m => {
        const h = tabla[m.home_team_id], a = tabla[m.away_team_id]
        if (h) { h.gf += m.home_score||0; h.gc += m.away_score||0; if (m.home_score>m.away_score) h.pts+=Ppts.victoria; else if (m.home_score===m.away_score) h.pts+=Ppts.empate; else h.pts+=Ppts.derrota }
        if (a) { a.gf += m.away_score||0; a.gc += m.home_score||0; if (m.away_score>m.home_score) a.pts+=Ppts.victoria; else if (m.away_score===m.home_score) a.pts+=Ppts.empate; else a.pts+=Ppts.derrota }
      })
      const orden = Object.entries(tabla).sort((x, y) => y[1].pts - x[1].pts || (y[1].gf-y[1].gc)-(x[1].gf-x[1].gc))
      const idx = orden.findIndex(([tid]) => tid === id)
      posMap[t.tournament_id] = idx >= 0 ? { pos: idx + 1, total: orden.length } : null
    }))

    setJugadoresPorTorneo(jugMap)
    setPosicionPorTorneo(posMap)
  }

  async function fetchPartidos() {
    const { data: local }     = await supabase.from('matches').select('*, tournaments(name), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('home_team_id', id).eq('status', 'finished').order('played_at', { ascending: false })
    const { data: visitante } = await supabase.from('matches').select('*, tournaments(name), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('away_team_id', id).eq('status', 'finished').order('played_at', { ascending: false })
    const todos = [...(local || []), ...(visitante || [])].sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    setPartidos(todos)

    let pj = 0, pg = 0, pe = 0, pp = 0, gf = 0, gc = 0

    todos.forEach(p => {
      pj++
      const esLocal = p.home_team_id === id
      const golesF  = esLocal ? p.home_score : p.away_score
      const golesC  = esLocal ? p.away_score : p.home_score
      gf += golesF || 0; gc += golesC || 0
      if (golesF > golesC) pg++
      else if (golesF === golesC) pe++
      else pp++
    })

    // Racha actual: cuántos partidos seguidos (desde el más reciente hacia atrás) tienen el mismo resultado
    let rachaTipo = null, rachaCantidad = 0
    if (todos.length > 0) {
      const letra = p => { const esLocal = p.home_team_id === id; const gF = esLocal?p.home_score:p.away_score; const gC = esLocal?p.away_score:p.home_score; return gF>gC?'G':gF===gC?'E':'P' }
      rachaTipo = letra(todos[0])
      for (const p of todos) { if (letra(p) === rachaTipo) rachaCantidad++; else break }
    }

    setStats({ pj, pg, pe, pp, gf, gc, pts: pg * 3 + pe, rachaTipo, rachaCantidad })
  }

  async function fetchLogros() {
    const { data } = await supabase.from('tournament_logros').select('*, tournaments(name), players(name)').eq('team_id', id).order('created_at', { ascending: false })
    const unicos = []
    ;(data || []).forEach(l => {
      if (!unicos.some(u => u.tournament_id === l.tournament_id && u.tipo === l.tipo)) unicos.push({ ...l, players: null })
    })
    setLogros(unicos)
  }

  function getResultado(partido) {
    const esLocal = partido.home_team_id === id
    const gf = esLocal ? partido.home_score : partido.away_score
    const gc = esLocal ? partido.away_score : partido.home_score
    if (gf > gc) return { texto: 'G', color: S.win, bg: S.winDim }
    if (gf === gc) return { texto: 'E', color: S.gold, bg: S.goldDim }
    return { texto: 'P', color: S.loss, bg: S.lossDim }
  }
  function getRival(partido) { return partido.home_team_id === id ? partido.away : partido.home }

  // ── Buscador del equipo (misma lógica que el admin, solo lectura) ──
  function construirRespuestas() {
    const R = []
    const finalizados = partidos.map(p => {
      const esLocal = p.home_team_id === id
      return {
        gf: (esLocal ? p.home_score : p.away_score) || 0,
        gc: (esLocal ? p.away_score : p.home_score) || 0,
        rival: esLocal ? p.away?.name : p.home?.name,
        torneo: p.tournaments?.name || '',
        fecha: p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        marcador: esLocal ? `${p.home_score}-${p.away_score}` : `${p.away_score}-${p.home_score}`,
      }
    })
    if (finalizados.length === 0) return R
    const nombresTorneos = [...new Set(finalizados.map(m => m.torneo).filter(Boolean))]

    const pg = finalizados.filter(m => m.gf > m.gc).length
    const pe = finalizados.filter(m => m.gf === m.gc).length
    const pp = finalizados.filter(m => m.gf < m.gc).length
    const gf = finalizados.reduce((s, m) => s + m.gf, 0)
    const gc = finalizados.reduce((s, m) => s + m.gc, 0)
    R.push({ icono: '📊', titulo: 'Historial completo del equipo',
      respuesta: `${finalizados.length} jugados · ${pg} ganados · ${pe} empatados · ${pp} perdidos`,
      detalle: `${gf} goles a favor · ${gc} en contra`,
      kw: 'resumen historial record estadisticas totales partidos jugados ganados perdidos empatados' })

    const contarRivales = (lista, cond) => {
      const c = {}
      lista.filter(cond).forEach(m => { if (m.rival) c[m.rival] = (c[m.rival] || 0) + 1 })
      return Object.entries(c).sort((a, b) => b[1] - a[1])
    }
    const nosGanan = contarRivales(finalizados, m => m.gc > m.gf)
    if (nosGanan.length > 0) R.push({ icono: '😤', titulo: 'Rival que más nos ha ganado',
      respuesta: `${nosGanan[0][0]} — ${nosGanan[0][1]} victoria${nosGanan[0][1] > 1 ? 's' : ''} sobre nosotros`,
      detalle: nosGanan.slice(1, 4).map(([n, v]) => `${n} (${v})`).join(' · ') || null,
      kw: 'quien rival equipo mas nos ha ganado vencido perdido contra verdugo' })
    const lesGanamos = contarRivales(finalizados, m => m.gf > m.gc)
    if (lesGanamos.length > 0) R.push({ icono: '💪', titulo: 'Rival al que más le hemos ganado',
      respuesta: `${lesGanamos[0][0]} — le ganamos ${lesGanamos[0][1]} vez${lesGanamos[0][1] > 1 ? 'es' : ''}`,
      detalle: lesGanamos.slice(1, 4).map(([n, v]) => `${n} (${v})`).join(' · ') || null,
      kw: 'quien rival equipo al que mas le hemos ganado victima favorito victorias' })

    const masGoles = [...finalizados].sort((a, b) => b.gf - a.gf)[0]
    R.push({ icono: '🔥', titulo: 'Partido donde más goles metimos',
      respuesta: `${masGoles.gf} goles — ${masGoles.marcador} vs ${masGoles.rival}`,
      detalle: `${masGoles.torneo} · ${masGoles.fecha}`,
      kw: 'partido mas goles metido anotado marcamos hicimos mayor cantidad' })
    const masRecibidos = [...finalizados].sort((a, b) => b.gc - a.gc)[0]
    R.push({ icono: '🥅', titulo: 'Partido donde más goles nos hicieron',
      respuesta: `${masRecibidos.gc} goles en contra — ${masRecibidos.marcador} vs ${masRecibidos.rival}`,
      detalle: `${masRecibidos.torneo} · ${masRecibidos.fecha}`,
      kw: 'partido mas goles recibidos en contra nos hicieron peor derrota goleada' })

    const arcosCero = finalizados.filter(m => m.gc === 0)
    R.push({ icono: '🧱', titulo: 'Partidos con el arco en cero',
      respuesta: `${arcosCero.length} de ${finalizados.length} partidos sin recibir gol`,
      detalle: arcosCero.slice(0, 3).map(m => `${m.marcador} vs ${m.rival}`).join(' · ') || null,
      kw: 'arco en cero valla invicta sin recibir menos goles en contra imbatida' })

    const ult5  = finalizados.slice(0, 5)
    const letra = m => m.gf > m.gc ? 'V' : m.gf === m.gc ? 'E' : 'D'
    R.push({ icono: '📈', titulo: 'Forma reciente (últimos 5)',
      respuesta: ult5.map(letra).join(' - '),
      detalle: ult5.map(m => `${m.marcador} vs ${m.rival}`).join(' · '),
      kw: 'forma reciente racha ultimos partidos como venimos actualidad momento' })

    if (statsJugadores && statsJugadores.length > 0) {
      const porJugador = {}
      statsJugadores.forEach(s => {
        const n = s.players?.name; if (!n) return
        if (!porJugador[n]) porJugador[n] = { goles: 0, pj: 0, gcArq: 0, pjArq: 0 }
        porJugador[n].goles += s.goals_scored || 0
        porJugador[n].pj++
        if (s.fue_arquero) { porJugador[n].gcArq += s.goals_conceded || 0; porJugador[n].pjArq++ }
      })
      const topGoles = Object.entries(porJugador).sort((a, b) => b[1].goles - a[1].goles)
      if (topGoles.length > 0 && topGoles[0][1].goles > 0) R.push({ icono: '⚽', titulo: 'Goleador histórico del equipo',
        respuesta: `${topGoles[0][0]} — ${topGoles[0][1].goles} goles`,
        detalle: topGoles.slice(1, 5).filter(([, d]) => d.goles > 0).map(([n, d]) => `${n} (${d.goles})`).join(' · ') || null,
        kw: 'jugador con mas goles goleador historico maximo anotador quien' })
      const arqueros = Object.entries(porJugador).filter(([, d]) => d.pjArq > 0).sort((a, b) => (a[1].gcArq / a[1].pjArq) - (b[1].gcArq / b[1].pjArq))
      if (arqueros.length > 0) R.push({ icono: '🧤', titulo: 'Mejor arquero del equipo (promedio)',
        respuesta: `${arqueros[0][0]} — ${(arqueros[0][1].gcArq / arqueros[0][1].pjArq).toFixed(2)} goles por partido`,
        detalle: arqueros.slice(1, 3).map(([n, d]) => `${n} (${(d.gcArq / d.pjArq).toFixed(2)})`).join(' · ') || null,
        kw: 'arquero portero valla menos goles recibidos mejor promedio' })
    }

    const titulos = logros.filter(l => l.tipo === 'campeon')
    if (titulos.length > 0) R.push({ icono: '🏆', titulo: 'Títulos del equipo',
      respuesta: `${titulos.length} campeonato${titulos.length > 1 ? 's' : ''}`,
      detalle: titulos.map(l => l.tournaments?.name).filter(Boolean).join(' · ') || null,
      kw: 'titulos campeon campeonatos ganados palmares copas' })

    nombresTorneos.forEach(t => {
      const lt = finalizados.filter(m => m.torneo === t)
      const vt = lt.filter(m => m.gf > m.gc).length, et = lt.filter(m => m.gf === m.gc).length, dt = lt.filter(m => m.gf < m.gc).length
      R.push({ icono: '🏟️', titulo: `Resumen en ${t}`,
        respuesta: `${lt.length} PJ · ${vt}V ${et}E ${dt}D`,
        detalle: `${lt.reduce((s, m) => s + m.gf, 0)} goles a favor · ${lt.reduce((s, m) => s + m.gc, 0)} en contra`,
        kw: `resumen record torneo campeonato como nos fue estadisticas ${normalizarTexto(t)}` })
    })

    return R
  }

  const respuestasEquipo = useMemo(() => {
    try { return construirRespuestas() } catch (e) { console.error('Buscador equipo:', e); return [] }
  }, [partidos, statsJugadores, logros])

  const datosMotor = useMemo(() => ({
    filas: (statsJugadores || []).map(s => ({
      jugador: s.players?.name, torneo: s.matches?.tournaments?.name || '',
      goles: s.goals_scored || 0, gc: s.goals_conceded || 0, fueArquero: !!s.fue_arquero,
      amarillas: s.yellow_cards || 0, azules: s.blue_cards || 0, rojas: s.red_cards || 0,
      faltas: s.fouls || 0, resultado: s.team_result,
    })).filter(f => f.jugador),
    partidosEquipo: partidos.map(p => {
      const esLocal = p.home_team_id === id
      return {
        gf: (esLocal ? p.home_score : p.away_score) || 0, gc: (esLocal ? p.away_score : p.home_score) || 0,
        rival: esLocal ? p.away?.name : p.home?.name, torneo: p.tournaments?.name || '',
        fecha: p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        marcador: esLocal ? `${p.home_score}-${p.away_score}` : `${p.away_score}-${p.home_score}`,
      }
    }),
    nombresTorneos: [...new Set(partidos.map(p => p.tournaments?.name).filter(Boolean))],
  }), [statsJugadores, partidos])

  const resultadosBusqueda = useMemo(() => {
    const q = normalizarTexto(busqueda).split(/\s+/).filter(t => t.length > 2)
    if (q.length === 0) return []
    const delMotor = responderPregunta(busqueda, { modo: 'equipo', ...datosMotor })
    const delCatalogo = respuestasEquipo
      .map(r => { const texto = normalizarTexto(`${r.kw} ${r.titulo} ${r.respuesta}`); return { ...r, score: q.filter(t => texto.includes(t) || (t.endsWith('s') && texto.includes(t.slice(0, -1)))).length } })
      .filter(r => r.score > 0).sort((a, b) => b.score - a.score)
    const titulosMotor = new Set(delMotor.map(r => r.titulo))
    return [...delMotor, ...delCatalogo.filter(r => !titulosMotor.has(r.titulo))].slice(0, 6)
  }, [respuestasEquipo, busqueda, datosMotor])

  if (loading) return <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando equipo...</div>
  if (!equipo) return <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:'.9rem' }}>Equipo no encontrado</div>

  const titulos = logros.filter(l => l.tipo === 'campeon').length
  const efectividad = stats?.pj > 0 ? Math.round((stats.pg / stats.pj) * 100) : 0
  const promGf = stats?.pj > 0 ? (stats.gf / stats.pj) : 0
  const promGc = stats?.pj > 0 ? (stats.gc / stats.pj) : 0
  const diferencia = (stats?.gf || 0) - (stats?.gc || 0)
  const totalGolesGauge = Math.max(1, (stats?.gf || 0) + (stats?.gc || 0))
  const pctGf = ((stats?.gf || 0) / totalGolesGauge) * 100
  const torneosActivos = torneos.filter(t => !logros.some(l => l.tipo === 'campeon' && l.tournament_id === t.tournament_id))

  const ult3 = partidos.slice(0, 3).map(getResultado).reverse() // izquierda = más antiguo, derecha = más reciente
  const rachaLabel = stats?.rachaTipo === 'G' ? 'Racha de victorias' : stats?.rachaTipo === 'P' ? 'Racha sin ganar' : stats?.rachaTipo === 'E' ? 'Racha de empates' : '—'

  const gruposPorMes = []
  ;[...partidos].forEach(p => {
    const fecha = p.played_at ? new Date(p.played_at) : null
    const key   = fecha ? (fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })).replace(/^./, c => c.toUpperCase()) : 'Sin fecha'
    let grupo = gruposPorMes.find(g => g.key === key)
    if (!grupo) { grupo = { key, items: [] }; gruposPorMes.push(grupo) }
    grupo.items.push(p)
  })

  function MatchRow({ p }) {
    const res     = getResultado(p)
    const rival   = getRival(p)
    const esLocal = p.home_team_id === id
    const gf      = esLocal ? p.home_score : p.away_score
    const gc      = esLocal ? p.away_score : p.home_score
    return (
      <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px' }}>
        <div style={{ textAlign:'center', flexShrink:0, minWidth:'34px' }}>
          <div style={{ fontSize:'.9rem', fontWeight:'900', color:S.text }}>{p.played_at ? new Date(p.played_at).getDate() : '—'}</div>
          <div style={{ fontSize:'.58rem', color:S.muted, textTransform:'uppercase' }}>{p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { month:'short' }) : ''}</div>
        </div>
        <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {equipo.logo_url ? <img src={equipo.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={12} color={S.muted}/>}
        </div>
        <div style={{ flex:1, minWidth:0, fontSize:'.82rem', fontWeight:'600', color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{equipo.name}</div>
        <div style={{ fontWeight:'900', fontSize:'.9rem', color:S.text, background:S.card2, border:`1px solid ${res.color}55`, borderRadius:'8px', padding:'4px 10px', flexShrink:0 }}>{gf} - {gc}</div>
        <div style={{ flex:1, minWidth:0, fontSize:'.82rem', fontWeight:'600', color:S.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rival?.name}</div>
        <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {rival?.logo_url ? <img src={rival.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={12} color={S.muted}/>}
        </div>
        <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:res.bg, border:`1px solid ${res.color}`, color:res.color, fontWeight:'800', fontSize:'.72rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{res.texto}</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>

      {/* Header */}
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'680px', margin:'0 auto' }}>
          <button onClick={() => navigate(-1)} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', color:S.text2, fontSize:'.85rem', fontWeight:'600', padding:0, marginBottom:'16px' }}>
            <ArrowLeft size={18}/> Volver
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
            <div style={{ width:'76px', height:'76px', borderRadius:'18px', background:S.card2, border:`1px solid ${S.border}`, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {equipo.logo_url ? <img src={equipo.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <Shield size={32} color={S.muted}/>}
            </div>
            <div style={{ flex:1, minWidth:'200px' }}>
              <div style={{ fontWeight:'900', fontSize:'1.5rem', color:S.text }}>{equipo.name}</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'8px' }}>
                {equipo.city      && <span style={{ fontSize:'.74rem', color:S.text2, background:S.card, border:`1px solid ${S.border}`, borderRadius:'20px', padding:'4px 12px', fontWeight:'600' }}>📍 {equipo.city}</span>}
                {equipo.modalidad && <span style={{ fontSize:'.74rem', color:S.cyan, background:S.cyanDim, borderRadius:'20px', padding:'4px 12px', fontWeight:'600' }}>{equipo.modalidad}</span>}
                {equipo.genero    && <span style={{ fontSize:'.74rem', color:'#c7a6ff', background:'rgba(153,85,255,.12)', borderRadius:'20px', padding:'4px 12px', fontWeight:'600' }}>{equipo.genero}</span>}
                <span style={{ fontSize:'.74rem', color:S.win, background:S.winDim, borderRadius:'20px', padding:'4px 12px', fontWeight:'600' }}>{torneos.length} torneo{torneos.length!==1?'s':''}</span>
              </div>
              {equipo.representante_nombre && (
                <div style={{ fontSize:'.74rem', color:S.muted, marginTop:'8px' }}>
                  👤 Representante: {equipo.representante_nombre}{equipo.representante_telefono && ` · 📞 ${equipo.representante_telefono}`}
                </div>
              )}
            </div>
            <div style={{ textAlign:'center', background:S.card, border:`1px solid ${S.gold}55`, borderRadius:'16px', padding:'14px 20px', flexShrink:0 }}>
              <Trophy size={22} color={S.gold} style={{ marginBottom:'4px' }}/>
              <div style={{ fontSize:'1.7rem', fontWeight:'900', color:S.text }}>{titulos}</div>
              <div style={{ fontSize:'.66rem', color:S.muted }}>Títulos</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'14px', scrollbarWidth:'none' }}>
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

        {/* ── RESUMEN ── */}
        {tab === 'resumen' && (
          <div>
            <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, margin:'6px 0 10px' }}>Rendimiento general</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))', gap:'10px', marginBottom:'16px' }}>
              {[
                { label:'Partidos jugados', valor: stats?.pj || 0, icon:'🔵', color:S.cyan },
                { label:'Ganados',          valor: stats?.pg || 0, icon:'🟢', color:S.win },
                { label:'Empatados',        valor: stats?.pe || 0, icon:'🟡', color:S.gold },
                { label:'Perdidos',         valor: stats?.pp || 0, icon:'🔴', color:S.loss },
                { label:'Puntos totales',   valor: stats?.pts || 0, icon:'⭐', color:'#c7a6ff' },
              ].map(c => (
                <div key={c.label} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:'1.3rem', marginBottom:'6px' }}>{c.icon}</div>
                  <div style={{ fontSize:'1.5rem', fontWeight:'900', color:c.color, lineHeight:1 }}>{c.valor}</div>
                  <div style={{ fontSize:'.64rem', color:S.muted, marginTop:'4px' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {stats?.pj > 0 && (
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px' }}>
                <div style={{ flex:'1 1 220px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px', display:'flex', alignItems:'center', gap:'16px' }}>
                  <div>
                    <div style={{ fontSize:'.68rem', color:S.muted }}>Goles</div>
                    <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.cyan }}>{stats.gf} <span style={{ fontSize:'.62rem', color:S.muted, fontWeight:'600' }}>a favor</span></div>
                    <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.loss }}>{stats.gc} <span style={{ fontSize:'.62rem', color:S.muted, fontWeight:'600' }}>en contra</span></div>
                  </div>
                  <div style={{ position:'relative', width:'90px', height:'90px', borderRadius:'50%', background:`conic-gradient(${S.cyan} ${pctGf*3.6}deg, ${S.loss} 0deg)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:'auto' }}>
                    <div style={{ width:'68px', height:'68px', borderRadius:'50%', background:S.card, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ fontSize:'1rem', fontWeight:'900', color: diferencia >= 0 ? S.win : S.loss }}>{diferencia >= 0 ? '+' : ''}{diferencia}</div>
                      <div style={{ fontSize:'.56rem', color:S.muted }}>Diferencia</div>
                    </div>
                  </div>
                </div>

                <div style={{ flex:'1 1 200px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px' }}>
                  <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'10px' }}>Racha actual</div>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
                    {ult3.map((r, i) => (
                      <div key={i} style={{ width:'30px', height:'30px', borderRadius:'50%', background:r.bg, border:`1px solid ${r.color}`, color:r.color, fontWeight:'800', fontSize:'.78rem', display:'flex', alignItems:'center', justifyContent:'center' }}>{r.texto}</div>
                    ))}
                  </div>
                  <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.text }}>{stats.rachaCantidad}</div>
                  <div style={{ fontSize:'.68rem', color:S.muted }}>{rachaLabel}</div>
                </div>
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
              <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text }}>Últimos partidos</div>
              <button onClick={() => setTab('partidos')} style={{ background:'none', border:'none', color:S.cyan, fontSize:'.76rem', fontWeight:'700', cursor:'pointer' }}>Ver todos</button>
            </div>
            {partidos.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'32px', textAlign:'center', color:S.muted, fontSize:'.85rem', marginBottom:'16px' }}>Sin partidos jugados todavía</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                {partidos.slice(0, 3).map(p => <MatchRow key={p.id} p={p}/>)}
              </div>
            )}

            {torneosActivos.length > 0 && (
              <>
                <div style={{ fontWeight:'800', fontSize:'1rem', color:S.text, marginBottom:'10px' }}>Torneos activos</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
                  {torneosActivos.map(t => {
                    const pos = posicionPorTorneo[t.tournament_id]
                    const partidosTorneo = partidos.filter(p => p.tournament_id === t.tournament_id)
                    const pjT = partidosTorneo.length
                    const pgT = partidosTorneo.filter(p => getResultado(p).texto==='G').length
                    const peT = partidosTorneo.filter(p => getResultado(p).texto==='E').length
                    const ppT = partidosTorneo.filter(p => getResultado(p).texto==='P').length
                    return (
                      <div key={t.id} onClick={() => navigate(`/jugador/torneo/${t.tournament_id}`)}
                        style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px', cursor:'pointer', flexWrap:'wrap' }}>
                        <Trophy size={20} color={S.gold} style={{ flexShrink:0 }}/>
                        <div style={{ flex:'1 1 140px', minWidth:0 }}>
                          <div style={{ fontWeight:'700', fontSize:'.85rem', color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.tournaments?.name}</div>
                          <div style={{ fontSize:'.66rem', color:S.muted, marginTop:'2px' }}>{[t.tournaments?.modalidad, t.tournaments?.genero].filter(Boolean).join(' · ')}</div>
                        </div>
                        {pos && (
                          <div style={{ textAlign:'center', flexShrink:0 }}>
                            <div style={{ fontSize:'.6rem', color:S.muted }}>Posición</div>
                            <div style={{ fontSize:'1rem', fontWeight:'900', color:S.cyan }}>{pos.pos} / {pos.total}</div>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:'10px', flexShrink:0 }}>
                          {[['PJ',pjT],['PG',pgT],['PE',peT],['PP',ppT]].map(([l,v]) => (
                            <div key={l} style={{ textAlign:'center' }}>
                              <div style={{ fontSize:'.85rem', fontWeight:'800', color:S.text }}>{v}</div>
                              <div style={{ fontSize:'.58rem', color:S.muted }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 200px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'.88rem', color:S.text, marginBottom:'10px' }}>Información del equipo</div>
                {[['Ciudad', equipo.city], ['Modalidad', equipo.modalidad], ['Categoría', [equipo.modalidad, equipo.genero].filter(Boolean).join(' ')]].filter(([,v]) => v).map(([l, v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', padding:'5px 0', borderBottom:`1px solid ${S.border}` }}>
                    <span style={{ color:S.muted }}>{l}</span><span style={{ color:S.text, fontWeight:'600' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex:'1 1 200px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'16px' }}>
                <div style={{ fontWeight:'800', fontSize:'.88rem', color:S.text, marginBottom:'10px' }}>Estadísticas destacadas</div>
                <div style={{ display:'flex', gap:'10px' }}>
                  {[
                    { v: promGf.toFixed(2), l:'Prom. goles a favor', c:S.cyan },
                    { v: promGc.toFixed(2), l:'Prom. goles en contra', c:S.loss },
                    { v: `${efectividad}%`, l:'Efectividad', c:S.win },
                  ].map(s => (
                    <div key={s.l} style={{ flex:1, textAlign:'center' }}>
                      <div style={{ fontSize:'1rem', fontWeight:'900', color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:'.6rem', color:S.muted, marginTop:'2px' }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TORNEOS ── */}
        {tab === 'torneos' && (
          <div>
            {torneos.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <Trophy size={32} style={{ opacity:.3, marginBottom:'8px' }}/><div>No ha participado en torneos aún</div>
              </div>
            ) : torneos.map(t => {
              const logroTorneo = logros.find(l => l.tournament_id === t.tournament_id)
              const jugs = jugadoresPorTorneo[t.tournament_id] || []
              return (
                <div key={t.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'16px', marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <div style={{ fontWeight:'700', color:S.text, fontSize:'.9rem' }}>{t.tournaments?.name}</div>
                      <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>{[t.tournaments?.modalidad, t.tournaments?.categoria, t.tournaments?.season].filter(Boolean).join(' · ')}</div>
                    </div>
                    {logroTorneo && (
                      <span style={{ fontSize:'.76rem', fontWeight:'700', color: logroTorneo.tipo==='campeon'?S.gold:'#c7a6ff', background: logroTorneo.tipo==='campeon'?S.goldDim:'rgba(153,85,255,.1)', borderRadius:'14px', padding:'5px 14px' }}>
                        {logroTorneo.tipo === 'campeon' ? '🏆 Campeón' : logroTorneo.tipo === 'subcampeon' ? '🥈 Subcampeón' : logroTorneo.tipo === 'tercer_puesto' ? '🥉 Tercer puesto' : logroTorneo.tipo === 'semifinal' ? '⚡ Semifinal' : logroTorneo.tipo === 'cuartos' ? '🔥 Cuartos' : logroTorneo.tipo === 'octavos' ? '⚔️ Octavos' : logroTorneo.tipo === 'fase_grupos' ? '🏟️ Fase de grupos' : logroTorneo.tipo}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:'.7rem', color:S.text2, marginBottom:'8px', fontWeight:'700' }}>JUGADORES INSCRITOS ({jugs.length})</div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {jugs.map(j => (
                      <span key={j.id} style={{ fontSize:'.74rem', color:S.text2, background:S.card2, borderRadius:'20px', padding:'4px 12px', display:'flex', alignItems:'center', gap:'5px', fontWeight:'500' }}>
                        {j.players?.photo_url && <img src={j.players.photo_url} style={{ width:'16px', height:'16px', borderRadius:'50%', objectFit:'cover' }}/>}
                        {j.players?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── PARTIDOS ── */}
        {tab === 'partidos' && (
          <div>
            {partidos.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <Calendar size={32} style={{ opacity:.3, marginBottom:'8px' }}/><div>No hay partidos jugados aún</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {partidos.map(p => <MatchRow key={p.id} p={p}/>)}
              </div>
            )}
          </div>
        )}

        {/* ── JUGADORES ── */}
        {tab === 'jugadores' && (
          <div>
            {jugadoresEquipoGlobal.length > 0 && (
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' }}>
                {[
                  { id:'todos',   label:`Todos (${jugadoresEquipoGlobal.length})` },
                  { id:'activos', label:`Activos (${jugadoresEquipoGlobal.filter(j => jugadoresActivos.includes(j.id)).length})` },
                  ...torneos.map(t => ({ id:t.tournament_id, label:t.tournaments?.name || 'Torneo' })),
                ].map(f => (
                  <button key={f.id} onClick={() => setFiltroJugadores(f.id)}
                    style={{ padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'.74rem', fontWeight:'700', background: filtroJugadores===f.id ? S.cyan : S.card, color: filtroJugadores===f.id ? '#000' : S.muted }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {(() => {
              const idsTorneo = filtroJugadores !== 'todos' && filtroJugadores !== 'activos'
                ? new Set(regsEquipo.filter(r => r.tournament_id === filtroJugadores).map(r => r.player_id))
                : null
              const jugadoresFiltrados = filtroJugadores === 'todos' ? jugadoresEquipoGlobal
                : filtroJugadores === 'activos' ? jugadoresEquipoGlobal.filter(j => jugadoresActivos.includes(j.id))
                : jugadoresEquipoGlobal.filter(j => idsTorneo.has(j.id))
              return jugadoresFiltrados.length === 0 ? (
                <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                  <Users size={32} style={{ opacity:.3, marginBottom:'8px' }}/><div>{jugadoresEquipoGlobal.length === 0 ? 'No hay jugadores en este equipo aún' : 'Ningún jugador con este filtro'}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {jugadoresFiltrados.map(j => (
                    <div key={j.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {j.photo_url ? <img src={j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <Users size={16} color={S.muted}/>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:'700', color:S.text, fontSize:'.84rem' }}>{j.name}</div>
                        <div style={{ display:'flex', gap:'6px', marginTop:'5px', flexWrap:'wrap' }}>
                          {j.es_elite       && <span style={{ fontSize:'.66rem', color:'#1a1305', background:'#f5c542', borderRadius:'10px', padding:'2px 8px', fontWeight:'800' }}>💎 Élite</span>}
                          {j.es_profesional && <span style={{ fontSize:'.66rem', color:'#fff', background:'#7b3ff2', borderRadius:'10px', padding:'2px 8px', fontWeight:'800' }}>🎓 Profesional</span>}
                          {j.es_mayor_35    && <span style={{ fontSize:'.66rem', color:S.text, background:S.card2, borderRadius:'10px', padding:'2px 8px', fontWeight:'700' }}>🕒 Mayor de 35</span>}
                          {j.etiqueta_personalizada && <span style={{ fontSize:'.66rem', color:'#0a1a3f', background:'#5b9dff', borderRadius:'10px', padding:'2px 8px', fontWeight:'800' }}>⭐ {j.etiqueta_personalizada}</span>}
                          {j.posicion_futbol5  && <span style={{ fontSize:'.66rem', color:S.cyan, background:S.cyanDim, borderRadius:'10px', padding:'2px 8px', fontWeight:'600' }}>F5: {j.posicion_futbol5}</span>}
                          {j.posicion_futbol7  && <span style={{ fontSize:'.66rem', color:S.win, background:S.winDim, borderRadius:'10px', padding:'2px 8px', fontWeight:'600' }}>F7: {j.posicion_futbol7}</span>}
                          {j.posicion_futbol11 && <span style={{ fontSize:'.66rem', color:S.gold, background:S.goldDim, borderRadius:'10px', padding:'2px 8px', fontWeight:'600' }}>F11: {j.posicion_futbol11}</span>}
                          <span style={{ fontSize:'.64rem', fontWeight:'700', color: jugadoresActivos.includes(j.id) ? S.win : S.muted, background:S.card2, borderRadius:'20px', padding:'2px 8px' }}>
                            {jugadoresActivos.includes(j.id) ? '● Activo' : '○ Inactivo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── PALMARÉS ── */}
        {tab === 'palmares' && (
          <div>
            {logros.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>
                <Award size={32} style={{ opacity:.3, marginBottom:'8px' }}/><div>No hay logros registrados aún</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {logros.map(l => (
                  <div key={l.id} style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px' }}>
                    <div style={{ fontSize:'1.6rem', width:'48px', height:'48px', borderRadius:'14px', background:S.card2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {l.tipo === 'campeon' ? '🏆' : l.tipo === 'subcampeon' ? '🥈' : l.tipo === 'tercer_puesto' ? '🥉' : l.tipo === 'goleador' ? '⚽' : l.tipo === 'mejor_jugador' ? '⭐' : '🎖️'}
                    </div>
                    <div>
                      <div style={{ fontWeight:'700', color:S.text, fontSize:'.85rem', textTransform:'capitalize' }}>{l.tipo?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>{l.tournaments?.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIAL (timeline por mes) ── */}
        {tab === 'historial' && (
          <div>
            {gruposPorMes.length === 0 ? (
              <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'48px', textAlign:'center', color:S.muted }}>Sin partidos registrados</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
                {gruposPorMes.map(grupo => (
                  <div key={grupo.key}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                      <Calendar size={12} color={S.muted}/>
                      <span style={{ fontSize:'.7rem', fontWeight:'700', color:S.text2, textTransform:'uppercase', letterSpacing:'.06em' }}>{grupo.key}</span>
                      <span style={{ fontSize:'.66rem', color:S.muted }}>· {grupo.items.length} partido{grupo.items.length!==1?'s':''}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {grupo.items.map(p => <MatchRow key={p.id} p={p}/>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BUSCADOR ── */}
        {tab === 'buscador' && (
          <div>
            <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px' }}>
              <div style={{ position:'relative' }}>
                <Search size={14} color={S.muted} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar en la historia del equipo..."
                  style={{ width:'100%', background:'transparent', border:`1px solid ${S.border}`, borderRadius:'10px', padding:'9px 34px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }}/>
                {busqueda && (
                  <button onClick={() => setBusqueda('')} style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:S.muted }}><X size={14}/></button>
                )}
              </div>
              {!busqueda && (
                <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'9px' }}>
                  {['¿Quién nos ha ganado más?', 'Partido con más goles', 'Goleador histórico', 'Mejor arquero', 'Títulos'].map(s => (
                    <button key={s} onClick={() => setBusqueda(s)} style={{ padding:'4px 10px', borderRadius:'20px', border:'none', background:S.card2, color:S.text2, fontSize:'.66rem', fontWeight:'600', cursor:'pointer' }}>{s}</button>
                  ))}
                </div>
              )}
              {partidos.length === 0 ? (
                <div style={{ textAlign:'center', color:S.muted, fontSize:'.78rem', padding:'16px 0 2px' }}>El equipo aún no tiene partidos jugados</div>
              ) : busqueda.trim() && resultadosBusqueda.length === 0 ? (
                <div style={{ textAlign:'center', color:S.muted, fontSize:'.78rem', padding:'16px 0 2px' }}>Sin resultados — probá con rival, goles, goleador o títulos</div>
              ) : busqueda.trim() ? (
                <div style={{ marginTop:'10px', display:'flex', flexDirection:'column' }}>
                  {resultadosBusqueda.map((r, i) => (
                    <div key={r.titulo} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 2px', borderTop: i > 0 ? `1px solid ${S.border}` : 'none' }}>
                      <div style={{ fontSize:'1.15rem', flexShrink:0 }}>{r.icono}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'.62rem', color:S.muted, fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em' }}>{r.titulo}</div>
                        <div style={{ fontSize:'.86rem', color:S.text, fontWeight:'800', marginTop:'2px', lineHeight:1.35 }}>{r.respuesta}</div>
                        {r.detalle && <div style={{ fontSize:'.7rem', color:S.text2, marginTop:'2px', lineHeight:1.4 }}>{r.detalle}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
