import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Shield, Users, Trophy, Calendar, ArrowLeft, Award, Camera } from 'lucide-react'
import { responderPregunta } from '../../lib/motorPreguntas'

const POSICIONES = {
  'Fútbol 5':  ['Portero', 'Cierre', 'Ala derecha', 'Ala izquierda', 'Pivot'],
  'Fútbol 7':  ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista', 'Extremo derecho', 'Extremo izquierdo', 'Delantero'],
  'Fútbol 11': ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista defensivo', 'Mediocampista central', 'Mediocampista ofensivo', 'Extremo derecho', 'Extremo izquierdo', 'Delantero centro', 'Segunda punta'],
}

const EMPTY_NUEVO = {
  name: '', telefono: '', city: '', genero: '', fecha_nacimiento: '',
  posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
}

// ── Paleta "glassmorfismo": paneles de vidrio esmerilado (translúcidos + blur)
// sobre un fondo degradado vivo, con texto claro y acentos de color brillantes.
const GLASS_BG = 'linear-gradient(150deg, #0f1c3f 0%, #17296b 35%, #3a1f80 75%, #1a3a8a 100%)'
const GLASS = {
  background: 'rgba(255,255,255,.10)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,.18)',
  boxShadow: '0 8px 28px rgba(0,0,0,.28)',
}
const GLASS_SM = {
  background: 'rgba(255,255,255,.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,.15)',
  boxShadow: '0 4px 16px rgba(0,0,0,.22)',
}
const GLASS_INSET = {
  background: 'rgba(0,0,0,.18)',
  border: '1px solid rgba(255,255,255,.12)',
  boxShadow: 'inset 0 1px 4px rgba(0,0,0,.35)',
}
const TXT       = '#ffffff'
const TXT_SOFT  = 'rgba(255,255,255,.72)'
const TXT_MUTED = 'rgba(255,255,255,.5)'

function glassBtn(color, active = true) {
  return {
    background: active ? `linear-gradient(135deg, ${color}, ${color}bb)` : 'rgba(255,255,255,.08)',
    border: active ? `1px solid ${color}88` : '1px solid rgba(255,255,255,.16)',
    borderRadius: '14px', cursor: 'pointer',
    color: active ? '#fff' : TXT_SOFT, fontSize: '.875rem', fontWeight: '600',
    boxShadow: active ? `0 4px 16px ${color}55` : 'none',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    transition: 'all .15s',
  }
}

const inputStyle = {
  width: '100%', background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.16)',
  borderRadius: '12px', padding: '10px 14px', color: TXT,
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '600', color: TXT_SOFT,
  display: 'block', marginBottom: '6px',
}

function StatBox({ label, value, color = '#5b9dff' }) {
  return (
    <div style={{ ...GLASS_SM, borderRadius: '18px', padding: '18px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.6rem', fontWeight: '800', color }}>{value ?? '—'}</div>
      <div style={{ fontSize: '.72rem', color: TXT_MUTED, marginTop: '4px', fontWeight: '600' }}>{label}</div>
    </div>
  )
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', marginTop: '28px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '10px', ...GLASS_SM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontSize: '1rem', fontWeight: '700', color: TXT }}>{title}</span>
    </div>
  )
}

export default function AdminEquipoDetallePage({ modoLectura = false }) {
  const { id }     = useParams()
  const navigate   = useNavigate()

  const [equipo,                setEquipo]                = useState(null)
  const [torneos,               setTorneos]               = useState([])
  const [jugadoresPorTorneo,    setJugadoresPorTorneo]    = useState({})
  const [jugadoresEquipoGlobal, setJugadoresEquipoGlobal] = useState([])
  const [regsEquipo,            setRegsEquipo]            = useState([]) // inscripciones por torneo (todas)
  const [filtroJugadores,       setFiltroJugadores]       = useState('todos') // 'todos' | 'activos' | tournament_id
  const [jugadoresActivos, setJugadoresActivos] = useState([])
  const [partidos,              setPartidos]              = useState([])
  const [logros,                setLogros]                = useState([])
  const [stats,                 setStats]                 = useState(null)
  const [loading,               setLoading]               = useState(true)
  const [tabActiva,             setTabActiva]             = useState('resumen')
  const [msg,                   setMsg]                   = useState(null)
  const [subiendoLogo,          setSubiendoLogo]          = useState(false)

  const [cedulaBuscar,      setCedulaBuscar]      = useState('')
  const [buscando,          setBuscando]          = useState(false)
  const [jugadorEncontrado, setJugadorEncontrado] = useState(null)
  const [mostrarFormNuevo,  setMostrarFormNuevo]  = useState(false)
  const [formNuevo,         setFormNuevo]         = useState(EMPTY_NUEVO)
  const [guardando,         setGuardando]         = useState(false)
  const [mostrarSelectorTorneo, setMostrarSelectorTorneo] = useState(false)
  const [mostrarInscribir, setMostrarInscribir] = useState(null) // tournament_id del torneo con el picker abierto

  useEffect(() => { fetchTodo() }, [id])
  useEffect(() => { if (tabActiva === 'jugadores') fetchJugadoresGlobal() }, [tabActiva])

  // ── BUSCADOR DE DATOS DEL EQUIPO ──────────────────────────────────────────
  const [busqueda,       setBusqueda]       = useState('')
  const [statsJugadores, setStatsJugadores] = useState(null) // stats individuales del equipo
  useEffect(() => {
    if (tabActiva === 'buscador' && !statsJugadores) {
      supabase.from('player_match_stats')
        .select('player_id, goals_scored, goals_conceded, fue_arquero, yellow_cards, blue_cards, red_cards, fouls, team_result, players(name), matches(tournament_id, tournaments(name))')
        .eq('team_id', id)
        .then(({ data }) => setStatsJugadores(data || []))
    }
  }, [tabActiva])

  const normalizarTexto = s => (s || '').toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')

  // Construye TODAS las respuestas posibles a partir de lo guardado
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

    // Resumen histórico
    const pg = finalizados.filter(m => m.gf > m.gc).length
    const pe = finalizados.filter(m => m.gf === m.gc).length
    const pp = finalizados.filter(m => m.gf < m.gc).length
    const gf = finalizados.reduce((s, m) => s + m.gf, 0)
    const gc = finalizados.reduce((s, m) => s + m.gc, 0)
    R.push({ icono: '📊', titulo: 'Historial completo del equipo',
      respuesta: `${finalizados.length} jugados · ${pg} ganados · ${pe} empatados · ${pp} perdidos`,
      detalle: `${gf} goles a favor · ${gc} en contra`,
      kw: 'resumen historial record estadisticas totales partidos jugados ganados perdidos empatados' })

    // Rivales: quién nos ha ganado más / a quién le ganamos más (global y por torneo)
    const contarRivales = (lista, cond) => {
      const c = {}
      lista.filter(cond).forEach(m => { if (m.rival) c[m.rival] = (c[m.rival] || 0) + 1 })
      return Object.entries(c).sort((a, b) => b[1] - a[1])
    }
    const agregarFactRival = (lista, sufijo, kwTorneo) => {
      const nosGanan = contarRivales(lista, m => m.gc > m.gf)
      if (nosGanan.length > 0) R.push({ icono: '😤', titulo: `Rival que más nos ha ganado${sufijo}`,
        respuesta: `${nosGanan[0][0]} — ${nosGanan[0][1]} victoria${nosGanan[0][1] > 1 ? 's' : ''} sobre nosotros`,
        detalle: nosGanan.slice(1, 4).map(([n, v]) => `${n} (${v})`).join(' · ') || null,
        kw: `quien rival equipo mas nos ha ganado vencido perdido contra verdugo ${kwTorneo}` })
      const lesGanamos = contarRivales(lista, m => m.gf > m.gc)
      if (lesGanamos.length > 0) R.push({ icono: '💪', titulo: `Rival al que más le hemos ganado${sufijo}`,
        respuesta: `${lesGanamos[0][0]} — le ganamos ${lesGanamos[0][1]} vez${lesGanamos[0][1] > 1 ? 'es' : ''}`,
        detalle: lesGanamos.slice(1, 4).map(([n, v]) => `${n} (${v})`).join(' · ') || null,
        kw: `quien rival equipo al que mas le hemos ganado victima favorito victorias ${kwTorneo}` })
    }
    agregarFactRival(finalizados, '', '')
    nombresTorneos.forEach(t => agregarFactRival(finalizados.filter(m => m.torneo === t), ` en ${t}`, normalizarTexto(t)))

    // Partidos récord
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
    const mejorDif = [...finalizados].sort((a, b) => (b.gf - b.gc) - (a.gf - a.gc))[0]
    if (mejorDif.gf > mejorDif.gc) R.push({ icono: '🏆', titulo: 'Mayor goleada a favor',
      respuesta: `${mejorDif.marcador} vs ${mejorDif.rival}`,
      detalle: `${mejorDif.torneo} · ${mejorDif.fecha}`,
      kw: 'mayor goleada paliza victoria mas amplia diferencia' })

    // Arcos en cero (valla invicta)
    const arcosCero = finalizados.filter(m => m.gc === 0)
    R.push({ icono: '🧱', titulo: 'Partidos con el arco en cero',
      respuesta: `${arcosCero.length} de ${finalizados.length} partidos sin recibir gol`,
      detalle: arcosCero.slice(0, 3).map(m => `${m.marcador} vs ${m.rival}`).join(' · ') || null,
      kw: 'arco en cero valla invicta sin recibir menos goles en contra imbatida' })

    // Forma reciente
    const ult5  = finalizados.slice(0, 5)
    const letra = m => m.gf > m.gc ? 'V' : m.gf === m.gc ? 'E' : 'D'
    R.push({ icono: '📈', titulo: 'Forma reciente (últimos 5)',
      respuesta: ult5.map(letra).join(' - '),
      detalle: ult5.map(m => `${m.marcador} vs ${m.rival}`).join(' · '),
      kw: 'forma reciente racha ultimos partidos como venimos actualidad momento' })

    // Promedios del equipo
    R.push({ icono: '🧮', titulo: 'Promedios del equipo',
      respuesta: `${(gf / finalizados.length).toFixed(2)} goles a favor y ${(gc / finalizados.length).toFixed(2)} en contra por partido`,
      detalle: null,
      kw: 'promedio goles por partido efectividad media anotacion' })

    // Resumen por cada torneo
    nombresTorneos.forEach(t => {
      const lt = finalizados.filter(m => m.torneo === t)
      const vt = lt.filter(m => m.gf > m.gc).length, et = lt.filter(m => m.gf === m.gc).length, dt = lt.filter(m => m.gf < m.gc).length
      R.push({ icono: '🏟️', titulo: `Resumen en ${t}`,
        respuesta: `${lt.length} PJ · ${vt}V ${et}E ${dt}D`,
        detalle: `${lt.reduce((s, m) => s + m.gf, 0)} goles a favor · ${lt.reduce((s, m) => s + m.gc, 0)} en contra`,
        kw: `resumen record torneo campeonato como nos fue estadisticas ${normalizarTexto(t)}` })
    })

    // Jugadores (si ya cargaron las stats individuales)
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
      const topPJ = Object.entries(porJugador).sort((a, b) => b[1].pj - a[1].pj)
      R.push({ icono: '🎽', titulo: 'Jugador con más partidos',
        respuesta: `${topPJ[0][0]} — ${topPJ[0][1].pj} partidos`,
        detalle: topPJ.slice(1, 4).map(([n, d]) => `${n} (${d.pj})`).join(' · ') || null,
        kw: 'jugador con mas partidos jugados presencias veterano' })

      // Jugador con MENOS goles (los que no han anotado, o el mínimo)
      const conPJ   = Object.entries(porJugador).filter(([, d]) => d.pj > 0)
      const sinGol  = conPJ.filter(([, d]) => d.goles === 0)
      const menosG  = [...conPJ].sort((a, b) => a[1].goles - b[1].goles || b[1].pj - a[1].pj)
      if (menosG.length > 0) R.push({ icono: '🥶', titulo: 'Jugador con menos goles',
        respuesta: sinGol.length > 0
          ? `${sinGol.length} jugador${sinGol.length > 1 ? 'es' : ''} sin anotar: ${sinGol.slice(0, 5).map(([n]) => n).join(', ')}${sinGol.length > 5 ? '…' : ''}`
          : `${menosG[0][0]} — ${menosG[0][1].goles} goles en ${menosG[0][1].pj} PJ`,
        detalle: sinGol.length > 0 ? 'Todos los demás ya anotaron al menos uno' : menosG.slice(1, 4).map(([n, d]) => `${n} (${d.goles})`).join(' · ') || null,
        kw: 'jugador con menos goles sin anotar no ha marcado cero quien' })

      // Jugador con MENOS partidos
      const menosPJ = [...conPJ].sort((a, b) => a[1].pj - b[1].pj)
      if (menosPJ.length > 0) R.push({ icono: '🪑', titulo: 'Jugador con menos partidos',
        respuesta: `${menosPJ[0][0]} — ${menosPJ[0][1].pj} partido${menosPJ[0][1].pj !== 1 ? 's' : ''}`,
        detalle: menosPJ.slice(1, 4).map(([n, d]) => `${n} (${d.pj})`).join(' · ') || null,
        kw: 'jugador con menos partidos jugados presencias suplente quien' })
      const arqueros = Object.entries(porJugador).filter(([, d]) => d.pjArq > 0)
        .sort((a, b) => (a[1].gcArq / a[1].pjArq) - (b[1].gcArq / b[1].pjArq))
      if (arqueros.length > 0) R.push({ icono: '🧤', titulo: 'Mejor arquero del equipo (promedio)',
        respuesta: `${arqueros[0][0]} — ${(arqueros[0][1].gcArq / arqueros[0][1].pjArq).toFixed(2)} goles por partido (${arqueros[0][1].gcArq} en ${arqueros[0][1].pjArq} PJ)`,
        detalle: arqueros.slice(1, 3).map(([n, d]) => `${n} (${(d.gcArq / d.pjArq).toFixed(2)})`).join(' · ') || null,
        kw: 'arquero portero valla menos goles recibidos mejor promedio' })
    }

    // Palmarés
    const titulos = logros.filter(l => l.tipo === 'campeon')
    if (titulos.length > 0) R.push({ icono: '🏆', titulo: 'Títulos del equipo',
      respuesta: `${titulos.length} campeonato${titulos.length > 1 ? 's' : ''}`,
      detalle: titulos.map(l => l.tournaments?.name).filter(Boolean).join(' · ') || null,
      kw: 'titulos campeon campeonatos ganados palmares copas' })

    return R
  }

  // Memorizado: las respuestas solo se recalculan cuando cambian los DATOS,
  // no en cada tecla (antes se recalculaba todo dos veces por letra escrita).
  // El try/catch evita que un dato inesperado tumbe la pestaña completa.
  const respuestasEquipo = useMemo(() => {
    try { return construirRespuestas() } catch (e) { console.error('Buscador equipo:', e); return [] }
  }, [partidos, statsJugadores, logros])

  // Datos crudos para el MOTOR de preguntas (responde cualquier combinación
  // de métrica + más/menos + torneo sin programar cada pregunta)
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
        gf: (esLocal ? p.home_score : p.away_score) || 0,
        gc: (esLocal ? p.away_score : p.home_score) || 0,
        rival: esLocal ? p.away?.name : p.home?.name,
        torneo: p.tournaments?.name || '',
        fecha: p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        marcador: esLocal ? `${p.home_score}-${p.away_score}` : `${p.away_score}-${p.home_score}`,
      }
    }),
    nombresTorneos: [...new Set(partidos.map(p => p.tournaments?.name).filter(Boolean))],
  }), [statsJugadores, partidos])

  const resultadosBusqueda = useMemo(() => {
    const q = normalizarTexto(busqueda).split(/\s+/).filter(t => t.length > 2)
    if (q.length === 0) return respuestasEquipo.slice(0, 4) // sin búsqueda: lo más general
    // 1) El motor calcula la respuesta exacta a la pregunta
    const delMotor = responderPregunta(busqueda, { modo: 'equipo', ...datosMotor })
    // 2) Se complementa con las respuestas del catálogo que coincidan
    const delCatalogo = respuestasEquipo
      .map(r => {
        const texto = normalizarTexto(`${r.kw} ${r.titulo} ${r.respuesta}`)
        // Coincide también en singular/plural ("goles" encuentra "gol" y viceversa)
        const score = q.filter(t => texto.includes(t) || (t.endsWith('s') && texto.includes(t.slice(0, -1)))).length
        return { ...r, score }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
    const titulosMotor = new Set(delMotor.map(r => r.titulo))
    return [...delMotor, ...delCatalogo.filter(r => !titulosMotor.has(r.titulo))].slice(0, 8)
  }, [respuestasEquipo, busqueda, datosMotor])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  function handleCopiarLinkRegistro(t) {
    const link = `${window.location.origin}/registro/equipo/${equipo.registro_token}/${t.tournament_id}`
    const mensaje = `📋 Registro de jugadores — ${equipo.name}\n\nEste link es para inscribir a los jugadores del equipo ${equipo.name} en el torneo ${t.tournaments?.name || ''}.\n\n⏰ Válido por 24 horas desde ahora.\n\nPodés inscribir vos mismo a todos los jugadores desde acá, o enviarle este mismo link a cada jugador para que se inscriba él mismo.\n\n👉 ${link}`
    navigator.clipboard.writeText(mensaje)
    // Reinicia el reloj de 24h del link cada vez que se comparte de nuevo
    supabase.from('teams').update({ registro_token_generado_en: new Date().toISOString() }).eq('id', equipo.id).then(() => {}, () => {})
    showMsg('Link copiado con la descripción ✓')
    setMostrarSelectorTorneo(false)
  }

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
    const { data: activos } = await supabase
      .from('tournament_player_registrations')
      .select('player_id')
      .eq('team_id', id)
      .eq('activo', true)
    setJugadoresActivos((activos || []).map(a => a.player_id))
    // TODAS las inscripciones del equipo (incluye inactivos) para poder
    // filtrar la lista de jugadores por torneo
    const { data: regsAll } = await supabase
      .from('tournament_player_registrations')
      .select('player_id, tournament_id')
      .eq('team_id', id)
    setRegsEquipo(regsAll || [])
  }

  async function fetchTorneos() {
    const { data: tt } = await supabase.from('tournament_teams').select('*, tournaments(*)').eq('team_id', id)
    setTorneos(tt || [])
    const jugMap = {}
    for (const t of (tt || [])) {
      const { data: jug } = await supabase.from('tournament_player_registrations').select('*, players(*)').eq('tournament_id', t.tournament_id).eq('team_id', id).eq('activo', true)
      jugMap[t.tournament_id] = jug || []
    }
    setJugadoresPorTorneo(jugMap)
  }

  async function fetchPartidos() {
    const { data: local }     = await supabase.from('matches').select('*, tournaments(name), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('home_team_id', id).eq('status', 'finished').order('played_at', { ascending: false })
    const { data: visitante } = await supabase.from('matches').select('*, tournaments(name), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)').eq('away_team_id', id).eq('status', 'finished').order('played_at', { ascending: false })
    const todos = [...(local || []), ...(visitante || [])].sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    setPartidos(todos)

    let pj = 0, pg = 0, pe = 0, pp = 0, gf = 0, gc = 0
    let tempSinPerder = 0, rachaSinPerder = 0, tempSinGanar = 0, rachaSinGanar = 0
    const rivales = {}, derrotas = {}, victorias = {}

    todos.forEach(p => {
      pj++
      const esLocal  = p.home_team_id === id
      const golesF   = esLocal ? p.home_score : p.away_score
      const golesC   = esLocal ? p.away_score : p.home_score
      const rival    = esLocal ? p.away_team_id : p.home_team_id
      const rivalNom = esLocal ? p.away?.name  : p.home?.name
      gf += golesF || 0; gc += golesC || 0
      if (golesF > golesC) {
        pg++; tempSinPerder++; rachaSinPerder = Math.max(rachaSinPerder, tempSinPerder); tempSinGanar = 0
      } else if (golesF === golesC) {
        pe++; tempSinPerder++; rachaSinPerder = Math.max(rachaSinPerder, tempSinPerder); tempSinGanar++; rachaSinGanar = Math.max(rachaSinGanar, tempSinGanar)
      } else {
        pp++; tempSinGanar++; rachaSinGanar = Math.max(rachaSinGanar, tempSinGanar); tempSinPerder = 0
      }
      if (rival) {
        rivales[rival]  = { count: (rivales[rival]?.count  || 0) + 1, nombre: rivalNom }
        if (golesF < golesC) derrotas[rival]  = { count: (derrotas[rival]?.count  || 0) + 1, nombre: rivalNom }
        if (golesF > golesC) victorias[rival] = { count: (victorias[rival]?.count || 0) + 1, nombre: rivalNom }
      }
    })

    const rivalFrecuente = Object.values(rivales).sort((a,b)   => b.count - a.count)[0]?.nombre || '—'
    const mayorRival     = Object.values(derrotas).sort((a,b)  => b.count - a.count)[0]?.nombre || '—'
    const rivalVictorias = Object.values(victorias).sort((a,b) => b.count - a.count)[0]?.nombre || '—'
    setStats({ pj, pg, pe, pp, gf, gc, pts: pg * 3 + pe, rachaSinPerder, rachaSinGanar, rivalFrecuente, mayorRival, rivalVictorias })
  }

  async function fetchLogros() {
    const { data } = await supabase.from('tournament_logros').select('*, tournaments(name), players(name)').eq('team_id', id).order('created_at', { ascending: false })
    // Los logros de torneo se guardan por cada jugador del equipo — dejar uno por torneo y tipo
    const unicos = []
    ;(data || []).forEach(l => {
      if (!unicos.some(u => u.tournament_id === l.tournament_id && u.tipo === l.tipo)) unicos.push({ ...l, players: null })
    })
    setLogros(unicos)
  }

  async function handleLogoUpload(file) {
    if (!file) return
    setSubiendoLogo(true)
    const ext  = file.name.split('.').pop()
    const path = `logos/${id}.${ext}`
    const { error } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (error) { showMsg('Error al subir logo', 'error'); setSubiendoLogo(false); return }
    const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
    await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', id)
    setEquipo(prev => ({ ...prev, logo_url: urlData.publicUrl }))
    showMsg('Logo actualizado ✓')
    setSubiendoLogo(false)
  }

  async function handleBuscarCedula() {
    if (!cedulaBuscar.trim()) return showMsg('Ingresa un número de cédula', 'error')
    setBuscando(true); setJugadorEncontrado(null); setMostrarFormNuevo(false)
    const { data } = await supabase.from('players').select('*').eq('numero_cedula', cedulaBuscar.trim()).single()
    if (data) setJugadorEncontrado(data)
    else { setMostrarFormNuevo(true); setFormNuevo({ ...EMPTY_NUEVO, numero_cedula: cedulaBuscar.trim() }) }
    setBuscando(false)
  }

  async function handleAgregarJugadorGlobal() {
    const { error } = await supabase.from('team_players').insert({ team_id: id, player_id: jugadorEncontrado.id })
    if (error && error.code === '23505') return showMsg('El jugador ya está en este equipo', 'error')
    if (error) return showMsg('Error al agregar jugador', 'error')

    // Agregar al equipo (team_players) NO lo inscribe automáticamente en un
    // torneo — eso es lo que hace que luego no aparezca en "jugadores
    // registrados" de la programación pública. Si el equipo está en un solo
    // torneo activo lo inscribimos de una vez ahí; si está en varios, queda
    // pendiente de inscribir manualmente en la pestaña "Torneos".
    if (torneos.length === 1) {
      await supabase.from('tournament_player_registrations').insert({ tournament_id: torneos[0].tournament_id, team_id: id, player_id: jugadorEncontrado.id, activo: true })
      showMsg(`Jugador agregado e inscrito en ${torneos[0].tournaments?.name || 'el torneo'} ✓`)
    } else if (torneos.length > 1) {
      showMsg('Jugador agregado al equipo — falta inscribirlo en el torneo correspondiente (pestaña Torneos)', 'ok')
    } else {
      showMsg('Jugador agregado ✓')
    }
    setJugadorEncontrado(null); setCedulaBuscar(''); fetchJugadoresGlobal()
  }

  async function handleInscribirEnTorneo(tournamentId, tournamentName, playerId) {
    // Revisa si ya existe una inscripción (activa o no) para no duplicar fila;
    // si existe pero estaba inactiva, la reactiva en vez de insertar de nuevo.
    const { data: existente } = await supabase.from('tournament_player_registrations')
      .select('id, activo').eq('tournament_id', tournamentId).eq('team_id', id).eq('player_id', playerId).maybeSingle()
    let error
    if (existente) {
      ;({ error } = await supabase.from('tournament_player_registrations').update({ activo: true }).eq('id', existente.id))
    } else {
      ;({ error } = await supabase.from('tournament_player_registrations').insert({ tournament_id: tournamentId, team_id: id, player_id: playerId, activo: true }))
    }
    if (error) { showMsg('Error al inscribir en el torneo', 'error'); return }
    showMsg(`Inscrito en ${tournamentName} ✓`)
    fetchTorneos()
  }

  async function handleCrearYAgregar() {
    if (!formNuevo.name)             return showMsg('El nombre es obligatorio', 'error')
    if (!formNuevo.telefono)         return showMsg('El teléfono es obligatorio', 'error')
    if (!formNuevo.city)             return showMsg('La ciudad es obligatoria', 'error')
    if (!formNuevo.genero)           return showMsg('El género es obligatorio', 'error')
    if (!formNuevo.fecha_nacimiento) return showMsg('La fecha de nacimiento es obligatoria', 'error')
    if (!formNuevo.posicion_futbol5 && !formNuevo.posicion_futbol7 && !formNuevo.posicion_futbol11)
      return showMsg('Selecciona al menos una posición', 'error')

    // Un mismo WhatsApp no puede quedar en dos jugadores distintos: por ahí
    // se verifica la identidad, así que un número repetido no sirve para
    // confirmar a ninguno de los dos.
    const digitos = formNuevo.telefono.replace(/\D/g, '').slice(-10)
    if (digitos.length === 10) {
      const { data: repetidos } = await supabase
        .from('players')
        .select('id, name, telefono, whatsapp')
        .or(`telefono.ilike.%${digitos}%,whatsapp.ilike.%${digitos}%`)
      const choque = (repetidos || []).find(p => {
        const t = (p.telefono || '').replace(/\D/g, '').slice(-10)
        const w = (p.whatsapp || '').replace(/\D/g, '').slice(-10)
        return t === digitos || w === digitos
      })
      if (choque) return showMsg(`⚠️ Ese número ya está registrado con otro jugador (${choque.name})`, 'error')
    }

    setGuardando(true)
    const { data: nuevo, error } = await supabase.from('players').insert({ ...formNuevo, numero_cedula: cedulaBuscar, activo_membresia: true, fecha_registro: new Date().toISOString() }).select().single()
    if (error) { showMsg('Error al crear jugador', 'error'); setGuardando(false); return }
    if (torneos.length === 0) { showMsg('Jugador creado pero el equipo no está en ningún torneo', 'error'); setGuardando(false); return }
    const torneo = torneos[0]
    await supabase.from('tournament_player_registrations').insert({ tournament_id: torneo.tournament_id, team_id: id, player_id: nuevo.id })
    showMsg('Jugador creado y agregado ✓'); setMostrarFormNuevo(false); setCedulaBuscar(''); setFormNuevo(EMPTY_NUEVO); setGuardando(false); fetchJugadoresGlobal()
  }

  function getResultado(partido) {
    const esLocal = partido.home_team_id === id
    const gf = esLocal ? partido.home_score : partido.away_score
    const gc = esLocal ? partido.away_score : partido.home_score
    if (gf > gc) return { texto: 'G', color: '#51cf66' }
    if (gf === gc) return { texto: 'E', color: '#ffa94d' }
    return { texto: 'P', color: '#ff6b6b' }
  }

  function getRival(partido) { return partido.home_team_id === id ? partido.away : partido.home }

  if (loading) return <div style={{ background: GLASS_BG, minHeight: '100vh', padding: '60px', textAlign: 'center', color: TXT_MUTED }}>Cargando...</div>
  if (!equipo) return <div style={{ background: GLASS_BG, minHeight: '100vh', padding: '40px', textAlign: 'center', color: TXT_MUTED }}>Equipo no encontrado</div>

  const TABS = [
    { id: 'resumen',   label: 'Resumen'   },
    { id: 'torneos',   label: 'Torneos'   },
    { id: 'partidos',  label: 'Partidos'  },
    { id: 'jugadores', label: 'Jugadores' },
    { id: 'palmares',  label: 'Palmarés'  },
    { id: 'buscador',  label: '🔎 Buscador' },
  ]

  return (
    <div style={{ background: GLASS_BG, minHeight: '100vh', padding: '16px', borderRadius: '24px' }}>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? 'linear-gradient(135deg,#ff8a80,#ff6b6b)' : 'linear-gradient(135deg,#69db7c,#51cf66)', color: '#0f1c3f', borderRadius: '16px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', fontWeight: '700', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
          {msg.text}
        </div>
      )}

      <button onClick={() => modoLectura ? navigate(-1) : navigate('/admin/equipos')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', ...GLASS_SM, borderRadius: '12px', padding: '8px 16px', cursor: 'pointer', color: TXT_SOFT, fontSize: '.875rem', fontWeight: '600', marginBottom: '20px' }}>
        <ArrowLeft size={16}/> Volver
      </button>

      {/* Header */}
      <div style={{ ...GLASS, borderRadius: '26px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '22px', ...GLASS_INSET, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {equipo.logo_url
                ? <img src={equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                : <Shield size={36} color="rgba(255,255,255,.5)"/>}
            </div>
            {!modoLectura && (
              <label style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #5b9dff, #1a73e8)', border: '3px solid #17296b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(91,157,255,.6)' }}>
                <Camera size={13} color="#fff"/>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogoUpload(e.target.files[0])} disabled={subiendoLogo}/>
              </label>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: TXT, margin: '0 0 8px' }}>{equipo.name}</h1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {equipo.city      && <span style={{ fontSize: '.78rem', color: TXT_SOFT, ...GLASS_SM, borderRadius: '20px', padding: '4px 12px', fontWeight: '600' }}>📍 {equipo.city}</span>}
              {equipo.modalidad && <span style={{ fontSize: '.78rem', color: '#8ec3ff', ...GLASS_SM, borderRadius: '20px', padding: '4px 12px', fontWeight: '600' }}>{equipo.modalidad}</span>}
              {equipo.genero    && <span style={{ fontSize: '.78rem', color: '#cbb2ff', ...GLASS_SM, borderRadius: '20px', padding: '4px 12px', fontWeight: '600' }}>{equipo.genero}</span>}
              <span style={{ fontSize: '.78rem', color: '#8ef0a8', ...GLASS_SM, borderRadius: '20px', padding: '4px 12px', fontWeight: '600' }}>{torneos.length} torneos</span>
            </div>
            <div style={{ fontSize: '.78rem', color: equipo.representante_nombre ? TXT_SOFT : '#ff9b9b', marginTop: '8px', fontWeight: '600' }}>
              {equipo.representante_nombre
                ? `👤 Representante: ${equipo.representante_nombre}${equipo.representante_telefono ? ` · 📞 ${equipo.representante_telefono}` : ''}`
                : '⚠️ Sin representante registrado'}
            </div>
            {!modoLectura && subiendoLogo && <div style={{ fontSize: '.75rem', color: '#8ec3ff', marginTop: '8px', fontWeight: '600' }}>Subiendo logo...</div>}
          </div>
          <div style={{ textAlign: 'center', ...GLASS_SM, borderRadius: '18px', padding: '12px 18px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffd43b' }}>{logros.filter(l => l.tipo === 'campeon').length}</div>
            <div style={{ fontSize: '.72rem', color: TXT_MUTED, fontWeight: '600' }}>🏆 Títulos</div>
          </div>
        </div>
      </div>

      {/* Tabs — todos los botones visibles siempre, sin deslizar (envuelve si hace falta) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', ...GLASS_INSET, borderRadius: '18px', padding: '8px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTabActiva(t.id)} style={{ ...glassBtn('#5b9dff', tabActiva === t.id), flex: '1 1 auto', minWidth: '90px', padding: '9px 12px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* RESUMEN */}
      {tabActiva === 'resumen' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <StatBox label="Partidos Jugados"  value={stats?.pj || 0}             color="#5b9dff"/>
            <StatBox label="Ganados"           value={stats?.pg || 0}             color="#51cf66"/>
            <StatBox label="Empatados"         value={stats?.pe || 0}             color="#ffa94d"/>
            <StatBox label="Perdidos"          value={stats?.pp || 0}             color="#ff6b6b"/>
            <StatBox label="Goles a Favor"     value={stats?.gf || 0}             color="#5b9dff"/>
            <StatBox label="Goles en Contra"   value={stats?.gc || 0}             color="#ff6b6b"/>
            <StatBox label="Puntos Totales"    value={stats?.pts || 0}            color="#cbb2ff"/>
            <StatBox label="Títulos"           value={logros.filter(l => l.tipo === 'campeon').length} color="#ffd43b"/>
            <StatBox label="Racha sin perder"  value={stats?.rachaSinPerder || 0} color="#51cf66"/>
            <StatBox label="Racha sin ganar"   value={stats?.rachaSinGanar || 0}  color="#ff6b6b"/>
            <StatBox label="Rival frecuente"   value={stats?.rivalFrecuente}      color={TXT_SOFT}/>
            <StatBox label="Más derrotas vs"   value={stats?.mayorRival}          color="#ff6b6b"/>
            <StatBox label="Más victorias vs"  value={stats?.rivalVictorias}      color="#51cf66"/>
          </div>
          {partidos.length > 0 && (
            <>
              <SectionTitle icon={<Calendar size={18} color="#8ec3ff"/>} title="Últimos partidos"/>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {partidos.slice(0, 5).map((p, i) => {
                  const res     = getResultado(p)
                  const rival   = getRival(p)
                  const esLocal = p.home_team_id === id
                  const gf      = esLocal ? p.home_score : p.away_score
                  const gc      = esLocal ? p.away_score : p.home_score
                  return (
                    <div key={p.id} style={{ ...GLASS_SM, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '.72rem', fontWeight: '800', color: '#0f1c3f', background: res.color, borderRadius: '10px', padding: '3px 9px' }}>{res.texto}</span>
                        <div>
                          <div style={{ fontSize: '.875rem', color: TXT, fontWeight: '600' }}>vs {rival?.name}</div>
                          <div style={{ fontSize: '.72rem', color: TXT_MUTED }}>{p.tournaments?.name}{p.played_at && ` · ${new Date(p.played_at).toLocaleDateString('es-CO')}`}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: '800', color: TXT, fontSize: '1rem' }}>{gf} - {gc}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TORNEOS */}
      {tabActiva === 'torneos' && (
        <div>
          {torneos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px' }}>
              <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No ha participado en torneos aún</div>
            </div>
          ) : torneos.map(t => {
            const logroTorneo = logros.find(l => l.tournament_id === t.tournament_id)
            const jugs        = jugadoresPorTorneo[t.tournament_id] || []
            return (
              <div key={t.id} style={{ ...GLASS_SM, borderRadius: '20px', padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '700', color: TXT, fontSize: '.9rem' }}>{t.tournaments?.name}</div>
                    <div style={{ fontSize: '.75rem', color: TXT_MUTED, marginTop: '2px' }}>{[t.tournaments?.modalidad, t.tournaments?.categoria, t.tournaments?.season].filter(Boolean).join(' · ')}</div>
                  </div>
                  {logroTorneo && (
                    <span style={{ fontSize: '.8rem', fontWeight: '700', color: logroTorneo.tipo === 'campeon' ? '#ffd43b' : '#cbb2ff', ...GLASS_INSET, borderRadius: '14px', padding: '5px 14px' }}>
                      {logroTorneo.tipo === 'campeon' ? '🏆 Campeón' : logroTorneo.tipo === 'subcampeon' ? '🥈 Subcampeón' : logroTorneo.tipo === 'tercer_puesto' ? '🥉 Tercer puesto' : logroTorneo.tipo === 'semifinal' ? '⚡ Semifinal' : logroTorneo.tipo === 'cuartos' ? '🔥 Cuartos' : logroTorneo.tipo === 'octavos' ? '⚔️ Octavos' : logroTorneo.tipo === 'fase_grupos' ? '🏟️ Fase de grupos' : logroTorneo.tipo}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '.75rem', color: TXT_SOFT, marginBottom: '8px', fontWeight: '600' }}>JUGADORES INSCRITOS ({jugs.length})</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {jugs.map(j => (
                    <span key={j.id} style={{ fontSize: '.75rem', color: TXT_SOFT, ...GLASS_INSET, borderRadius: '20px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}>
                      {j.players?.photo_url && <img src={j.players.photo_url} style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }}/>}
                      {j.players?.name}
                    </span>
                  ))}
                </div>

                {/* Jugadores que ya están en el equipo pero NO tienen inscripción
                    activa en ESTE torneo — pasa cuando se agregaron con "Agregar
                    al equipo" en vez del link de registro. Sin esto no aparecen
                    ni en la tabla de posiciones ni en la ficha pública del equipo. */}
                {!modoLectura && (() => {
                  const idsInscritos = new Set(jugs.map(j => j.player_id))
                  const pendientes = jugadoresEquipoGlobal.filter(jp => !idsInscritos.has(jp.id))
                  if (pendientes.length === 0) return null
                  return (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
                      <button onClick={() => setMostrarInscribir(v => v === t.tournament_id ? null : t.tournament_id)}
                        style={{ ...glassBtn('#5b9dff', false), padding: '7px 14px', fontSize: '.75rem', color: '#8ec3ff' }}>
                        {mostrarInscribir === t.tournament_id ? 'Cerrar' : `+ Inscribir jugador del equipo (${pendientes.length} sin inscribir)`}
                      </button>
                      {mostrarInscribir === t.tournament_id && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {pendientes.map(jp => (
                            <div key={jp.id} style={{ ...GLASS_INSET, borderRadius: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '.8rem', color: TXT }}>{jp.name} <span style={{ color: TXT_MUTED }}>· CC {jp.numero_cedula}</span></span>
                              <button onClick={() => handleInscribirEnTorneo(t.tournament_id, t.tournaments?.name, jp.id)}
                                style={{ ...glassBtn('#51cf66'), padding: '5px 12px', fontSize: '.72rem', flexShrink: 0 }}>
                                Inscribir
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* PARTIDOS */}
      {tabActiva === 'partidos' && (
        <div>
          {partidos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px' }}>
              <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay partidos jugados aún</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {partidos.map((p, i) => {
                const res     = getResultado(p)
                const rival   = getRival(p)
                const esLocal = p.home_team_id === id
                const gf      = esLocal ? p.home_score : p.away_score
                const gc      = esLocal ? p.away_score : p.home_score
                return (
                  <div key={p.id} style={{ ...GLASS_SM, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '.75rem', fontWeight: '800', color: '#0f1c3f', background: res.color, borderRadius: '10px', padding: '3px 9px', minWidth: '24px', textAlign: 'center' }}>{res.texto}</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', ...GLASS_INSET, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {rival?.logo_url ? <img src={rival.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={16} color="rgba(255,255,255,.5)"/>}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: TXT, fontSize: '.875rem' }}>
                          {esLocal ? 'vs' : 'en'} {rival?.name}
                          <span style={{ fontSize: '.72rem', color: TXT_MUTED, marginLeft: '6px' }}>{esLocal ? '(Local)' : '(Visitante)'}</span>
                        </div>
                        <div style={{ fontSize: '.72rem', color: TXT_MUTED, marginTop: '2px' }}>
                          {p.tournaments?.name}{p.played_at && ` · ${new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', color: TXT, fontSize: '1.1rem' }}>{gf} - {gc}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* JUGADORES */}
      {tabActiva === 'jugadores' && (
        <div>
          {!modoLectura && (
            <div style={{ ...GLASS, borderRadius: '22px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ fontWeight: '700', color: TXT, fontSize: '.9rem', marginBottom: '16px' }}>Agregar jugador al equipo</div>
              {!jugadorEncontrado && !mostrarFormNuevo && (
                <div>
                  <label style={labelStyle}>Número de cédula</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={cedulaBuscar} onChange={e => setCedulaBuscar(e.target.value)} placeholder="Ingresa el número de cédula..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleBuscarCedula()}/>
                    <button onClick={handleBuscarCedula} disabled={buscando} style={{ ...glassBtn('#5b9dff'), padding: '10px 18px', whiteSpace: 'nowrap', opacity: buscando ? .7 : 1 }}>
                      {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                </div>
              )}
              {jugadorEncontrado && (
                <div>
                  <div style={{ ...GLASS_INSET, borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#51cf66', marginBottom: '10px' }}>✓ JUGADOR ENCONTRADO</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', ...GLASS_SM, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {jugadorEncontrado.photo_url ? <img src={jugadorEncontrado.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Users size={20} color="#51cf66"/>}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', color: TXT, fontSize: '.9rem' }}>{jugadorEncontrado.name}</div>
                        <div style={{ fontSize: '.75rem', color: TXT_SOFT, marginTop: '2px' }}>🪪 {jugadorEncontrado.numero_cedula}{jugadorEncontrado.city && ` · 📍 ${jugadorEncontrado.city}`}</div>
                      </div>
                    </div>
                  </div>
                  {(jugadorEncontrado.es_arbitro || jugadorEncontrado.rol === 'arbitro') && (
                    <div style={{ ...GLASS_INSET, borderRadius: '16px', padding: '12px 16px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '.8rem', color: '#5b9dff', fontWeight: '700', marginBottom: '2px' }}>🟡 Esta persona ya está registrada como árbitro</div>
                      <div style={{ fontSize: '.78rem', color: TXT_SOFT }}>Al agregarla al equipo quedará también como jugador con los mismos datos — entra con la misma cuenta y contraseña a los dos portales.</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleAgregarJugadorGlobal} style={{ ...glassBtn('#51cf66'), padding: '10px 18px' }}>+ Agregar al equipo</button>
                    <button onClick={() => { setJugadorEncontrado(null); setCedulaBuscar('') }} style={{ ...glassBtn('#5b9dff', false), padding: '10px 18px' }}>Buscar otro</button>
                  </div>
                </div>
              )}
              {mostrarFormNuevo && (
                <div>
                  <div style={{ ...GLASS_INSET, borderRadius: '16px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '.8rem', color: '#ff9b9b', fontWeight: '600' }}>⚠️ No existe jugador con cédula <strong>{cedulaBuscar}</strong>. Completa los datos para crearlo.</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>Nombre completo *</label><input value={formNuevo.name} onChange={e => setFormNuevo(f=>({...f,name:e.target.value}))} style={inputStyle} placeholder="Nombre completo"/></div>
                      <div>
                        <label style={labelStyle}>Teléfono *</label>
                        <input value={formNuevo.telefono} onChange={e => setFormNuevo(f=>({...f,telefono:e.target.value}))} style={inputStyle} placeholder="300 000 0000"/>
                        <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>📲 Debe ser un WhatsApp real: por ahí se verifica al jugador.</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>Ciudad *</label><input value={formNuevo.city} onChange={e => setFormNuevo(f=>({...f,city:e.target.value}))} style={inputStyle} placeholder="Ciudad"/></div>
                      <div>
                        <label style={labelStyle}>Género *</label>
                        <select value={formNuevo.genero} onChange={e => setFormNuevo(f=>({...f,genero:e.target.value}))} style={inputStyle}>
                          <option value="">Seleccionar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                        </select>
                      </div>
                      <div><label style={labelStyle}>Fecha nacimiento *</label><input type="date" value={formNuevo.fecha_nacimiento} onChange={e => setFormNuevo(f=>({...f,fecha_nacimiento:e.target.value}))} style={inputStyle}/></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {Object.entries(POSICIONES).map(([mod, posiciones]) => (
                        <div key={mod}>
                          <label style={labelStyle}>{mod}</label>
                          <select value={formNuevo[`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]} onChange={e => setFormNuevo(f=>({...f,[`posicion_${mod.toLowerCase().replace('ú','u').replace(' ','')}`]:e.target.value}))} style={inputStyle}>
                            <option value="">No juega</option>
                            {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={handleCrearYAgregar} disabled={guardando} style={{ ...glassBtn('#5b9dff'), padding: '10px 18px', opacity: guardando ? .7 : 1 }}>
                      {guardando ? 'Creando...' : 'Crear y agregar al equipo'}
                    </button>
                    <button onClick={() => { setMostrarFormNuevo(false); setCedulaBuscar('') }} style={{ ...glassBtn('#5b9dff', false), padding: '10px 18px' }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
{!modoLectura && (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
    {torneos.length === 0 ? (
      <div style={{ fontSize: '.78rem', color: TXT_MUTED }}>Inscribí el equipo en un torneo para generar el link de registro</div>
    ) : torneos.length === 1 ? (
      <button onClick={() => handleCopiarLinkRegistro(torneos[0])}
        style={{ ...glassBtn('#5b9dff', false), display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', color: '#8ec3ff' }}>
        🔗 Copiar link de registro
      </button>
    ) : (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setMostrarSelectorTorneo(o => !o)}
          style={{ ...glassBtn('#5b9dff', false), display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', color: '#8ec3ff' }}>
          🔗 Copiar link de registro
        </button>
        {mostrarSelectorTorneo && (
          <div style={{ position: 'absolute', top: '46px', right: 0, ...GLASS, borderRadius: '14px', padding: '6px', zIndex: 300, minWidth: '220px' }}>
            <div style={{ fontSize: '.7rem', color: TXT_MUTED, padding: '6px 10px' }}>¿Para qué torneo?</div>
            {torneos.map(t => (
              <button key={t.id} onClick={() => handleCopiarLinkRegistro(t)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: TXT, fontSize: '.82rem', borderRadius: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}
                onMouseLeave={e => e.currentTarget.style.background='none'}>
                {t.tournaments?.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
)}
          <SectionTitle icon={<Users size={18} color="#8ec3ff"/>} title="Jugadores del equipo"/>

          {/* Filtros: todos los que han pasado por el equipo / activos / por torneo */}
          {jugadoresEquipoGlobal.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {[
                { id: 'todos',   label: `👥 Todos los que han pasado (${jugadoresEquipoGlobal.length})` },
                { id: 'activos', label: `● Activos (${jugadoresEquipoGlobal.filter(j => jugadoresActivos.includes(j.id)).length})` },
                ...torneos.map(t => ({ id: t.tournament_id, label: `🏆 ${t.tournaments?.name || 'Torneo'}` })),
              ].map(f => (
                <button key={f.id} onClick={() => setFiltroJugadores(f.id)}
                  style={{ ...glassBtn('#5b9dff', filtroJugadores === f.id), padding: '7px 14px', fontSize: '.75rem' }}>
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
            <div style={{ padding: '48px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px' }}>
              <Users size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
              <div>{jugadoresEquipoGlobal.length === 0 ? 'No hay jugadores en este equipo aún' : 'Ningún jugador con este filtro'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {jugadoresFiltrados.map((j, i) => (
                <div key={j.id} style={{ ...GLASS_SM, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', ...GLASS_INSET, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {j.photo_url ? <img src={j.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <Users size={18} color="rgba(255,255,255,.5)"/>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: TXT, fontSize: '.875rem' }}>{j.name}</div>
                    <div style={{ fontSize: '.72rem', color: TXT_MUTED, display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span>🪪 {j.numero_cedula}</span>
                      {j.city && <span>📍 {j.city}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {j.posicion_futbol5  && <span style={{ fontSize: '.7rem', color: '#8ec3ff', ...GLASS_INSET, borderRadius: '10px', padding: '2px 9px', fontWeight: '600' }}>F5: {j.posicion_futbol5}</span>}
                      {j.posicion_futbol7  && <span style={{ fontSize: '.7rem', color: '#8ef0a8', ...GLASS_INSET, borderRadius: '10px', padding: '2px 9px', fontWeight: '600' }}>F7: {j.posicion_futbol7}</span>}
                      {j.posicion_futbol11 && <span style={{ fontSize: '.7rem', color: '#ffc078', ...GLASS_INSET, borderRadius: '10px', padding: '2px 9px', fontWeight: '600' }}>F11: {j.posicion_futbol11}</span>}
                      <span style={{ fontSize: '.68rem', fontWeight: '700', color: jugadoresActivos.includes(j.id) ? '#8ef0a8' : TXT_MUTED, ...GLASS_INSET, borderRadius: '20px', padding: '2px 9px' }}>
  {jugadoresActivos.includes(j.id) ? '● Activo' : '○ Inactivo'}
</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )})()}
        </div>
      )}

      {/* PALMARÉS */}
      {tabActiva === 'palmares' && (
        <div>
          {logros.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px' }}>
              <Award size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay logros registrados aún</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logros.map(l => (
                <div key={l.id} style={{ ...GLASS_SM, borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontSize: '2rem', width: '54px', height: '54px', borderRadius: '16px', ...GLASS_INSET, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {l.tipo === 'campeon' ? '🏆' : l.tipo === 'subcampeon' ? '🥈' : l.tipo === 'tercer_puesto' ? '🥉' : l.tipo === 'goleador' ? '⚽' : l.tipo === 'mejor_jugador' ? '⭐' : '🎖️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', color: TXT, fontSize: '.9rem', textTransform: 'capitalize' }}>{l.tipo?.replace(/_/g, ' ')}</div>
                    <div style={{ fontSize: '.75rem', color: TXT_MUTED, marginTop: '2px' }}>{l.tournaments?.name}</div>
                    {l.descripcion   && <div style={{ fontSize: '.75rem', color: TXT_SOFT, marginTop: '2px' }}>{l.descripcion}</div>}
                    {l.players?.name && <div style={{ fontSize: '.75rem', color: '#8ec3ff', marginTop: '2px', fontWeight: '600' }}>👤 {l.players.name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUSCADOR DE DATOS DEL EQUIPO */}
      {tabActiva === 'buscador' && (
        <div>
          <div style={{ ...GLASS, borderRadius: '22px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', color: TXT, fontSize: '.95rem', marginBottom: '4px' }}>🔎 Pregúntale a la historia del equipo</div>
            <div style={{ fontSize: '.75rem', color: TXT_MUTED, marginBottom: '14px' }}>
              Busca cualquier dato guardado: rivales, goleadas, goleadores, arqueros, títulos... por torneo o histórico.
            </div>
            <div style={{ position: 'relative' }}>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Ej: quién nos ha ganado más · partido con más goles · goleador..."
                style={{ ...inputStyle, fontSize: '1rem', padding: '13px 44px 13px 16px' }}/>
              {busqueda && (
                <button onClick={() => setBusqueda('')}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: TXT_SOFT, fontSize: '.8rem', fontWeight: '700' }}>✕</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
              {['¿Quién nos ha ganado más?', 'Partido con más goles', 'Goleador histórico', 'Peor derrota', 'Mejor arquero', 'Títulos'].map(s => (
                <button key={s} onClick={() => setBusqueda(s)}
                  style={{ ...glassBtn('#5b9dff', normalizarTexto(busqueda) === normalizarTexto(s)), padding: '6px 12px', fontSize: '.72rem' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {partidos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px' }}>
              El equipo aún no tiene partidos jugados — cuando juegue, aquí podrás buscar todos sus datos.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '.7rem', color: TXT_MUTED, fontWeight: '600', padding: '0 4px' }}>
                {busqueda.trim()
                  ? `${resultadosBusqueda.length} resultado${resultadosBusqueda.length !== 1 ? 's' : ''} para "${busqueda.trim()}"`
                  : 'Datos generales — escribe o toca una pregunta para buscar algo puntual'}
              </div>
              {resultadosBusqueda.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: TXT_MUTED, ...GLASS_SM, borderRadius: '20px', fontSize: '.85rem' }}>
                  No encontré datos para esa búsqueda — prueba con otras palabras: rival, goles, goleador, arquero, derrota, títulos o el nombre de un torneo
                </div>
              )}
              {resultadosBusqueda.map(r => (
                <div key={r.titulo} className="gm-logro" style={{ ...GLASS_SM, borderRadius: '18px', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>{r.icono}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.72rem', color: TXT_MUTED, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em' }}>{r.titulo}</div>
                    <div style={{ fontSize: '.98rem', color: TXT, fontWeight: '800', marginTop: '3px', lineHeight: 1.35, overflowWrap: 'break-word' }}>{r.respuesta}</div>
                    {r.detalle && <div style={{ fontSize: '.75rem', color: TXT_SOFT, marginTop: '4px', lineHeight: 1.4, overflowWrap: 'break-word' }}>{r.detalle}</div>}
                  </div>
                </div>
              ))}
              {!statsJugadores && (
                <div style={{ textAlign: 'center', color: TXT_MUTED, fontSize: '.72rem', padding: '8px' }}>⏳ Cargando datos de jugadores (goleador, arquero)...</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
