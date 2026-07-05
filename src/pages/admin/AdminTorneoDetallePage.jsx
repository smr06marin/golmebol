import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PlanillaPartido from '../../components/PlanillaPartido'
import { ArrowLeft, Trophy, Calendar, BarChart2, Shield, Clock, MapPin, Check, X, Plus, Shuffle, GripVertical, Camera, Users, GitBranch } from 'lucide-react'

function ModalPartidoAdmin({ partido, onClose }) {
  const [stats,   setStats]   = useState([])
  const [mvp,     setMvp]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: statsData }, { data: mvpData }] = await Promise.all([
        supabase.from('player_match_stats')
          .select('*, players(id,name,photo_face_url,photo_url), teams(id,name,logo_url)')
          .eq('match_id', partido.id)
          .order('goals_scored', { ascending: false }),
        supabase.from('tournament_logros')
          .select('*, players(name,photo_face_url,photo_url)')
          .eq('match_id', partido.id).eq('tipo', 'mvp').maybeSingle(),
      ])
      setStats(statsData || [])
      if (mvpData?.players) setMvp(mvpData)
      setLoading(false)
    }
    load()
  }, [partido.id])

  const local     = stats.filter(s => s.team_id === partido.home_team_id)
  const visitante = stats.filter(s => s.team_id === partido.away_team_id)

  function TeamStats({ jugadores, equipo, logo }) {
    const goleadores = jugadores.filter(j => j.goals_scored > 0)
    const amarillas  = jugadores.filter(j => j.yellow_cards > 0)
    const azules     = jugadores.filter(j => j.blue_cards > 0)
    const rojas      = jugadores.filter(j => j.red_cards > 0)
    const faltas     = jugadores.filter(j => j.fouls > 0)
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#f1f3f4', border:'1px solid #e8eaed', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {logo ? <img src={logo} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={13} color="#9aa0a6"/>}
          </div>
          <span style={{ fontWeight:'700', fontSize:'.85rem', color:'#202124' }}>{equipo}</span>
        </div>
        {jugadores.length === 0 && <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>Sin datos</div>}
        {goleadores.length > 0 && (
          <div style={{ marginBottom:'10px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#5f6368', marginBottom:'4px', textTransform:'uppercase' }}>⚽ Goles</div>
            {goleadores.map(j => (
              <div key={j.player_id} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'#f1f3f4', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {j.players?.photo_face_url || j.players?.photo_url ? <img src={j.players.photo_face_url || j.players.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.65rem' }}>👤</span>}
                </div>
                <span style={{ fontSize:'.78rem', color:'#202124', flex:1 }}>{j.players?.name}</span>
                <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#1e8e3e' }}>×{j.goals_scored}</span>
              </div>
            ))}
          </div>
        )}
        {amarillas.length > 0 && (
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#5f6368', marginBottom:'4px', textTransform:'uppercase' }}>🟨 Amarillas</div>
            {amarillas.map(j => <div key={j.player_id} style={{ fontSize:'.75rem', color:'#e8710a', marginBottom:'2px' }}>• {j.players?.name}</div>)}
          </div>
        )}
        {azules.length > 0 && (
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#5f6368', marginBottom:'4px', textTransform:'uppercase' }}>🟦 Azules</div>
            {azules.map(j => <div key={j.player_id} style={{ fontSize:'.75rem', color:'#1a73e8', marginBottom:'2px' }}>• {j.players?.name}</div>)}
          </div>
        )}
        {rojas.length > 0 && (
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#5f6368', marginBottom:'4px', textTransform:'uppercase' }}>🟥 Rojas</div>
            {rojas.map(j => <div key={j.player_id} style={{ fontSize:'.75rem', color:'#d93025', marginBottom:'2px' }}>• {j.players?.name}</div>)}
          </div>
        )}
        {faltas.length > 0 && (
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontSize:'.65rem', fontWeight:'700', color:'#5f6368', marginBottom:'4px', textTransform:'uppercase' }}>✋ Faltas</div>
            {faltas.map(j => (
              <div key={j.player_id} style={{ display:'flex', justifyContent:'space-between', fontSize:'.75rem', color:'#5f6368', marginBottom:'2px' }}>
                <span>• {j.players?.name}</span><span style={{ fontWeight:'600' }}>{j.fouls}</span>
              </div>
            ))}
          </div>
        )}
        {goleadores.length===0 && amarillas.length===0 && azules.length===0 && rojas.length===0 && faltas.length===0 && jugadores.length>0 && (
          <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>Sin incidencias</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:2000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'700px', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 -8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>{partido.home?.name} vs {partido.away?.name}</div>
            <div style={{ fontSize:'.72rem', color:'#9aa0a6', marginTop:'2px' }}>
              {partido.played_at && new Date(partido.played_at).toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long' })}
              {partido.matchday && ` · J${partido.matchday}`}
              {partido.grupo && ` · ${partido.grupo}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6', display:'flex' }}><X size={20}/></button>
        </div>
        <div style={{ padding:'16px 20px', background:'#f8f9fa', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'center', gap:'16px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1, justifyContent:'flex-end' }}>
            <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#202124', textAlign:'right' }}>{partido.home?.name}</span>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#fff', border:'1px solid #e8eaed', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {partido.home?.logo_url ? <img src={partido.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={14} color="#9aa0a6"/>}
            </div>
          </div>
          <div style={{ fontWeight:'900', fontSize:'1.8rem', color:'#202124', background:'#fff', border:'1px solid #e8eaed', borderRadius:'10px', padding:'6px 18px', flexShrink:0 }}>
            {partido.home_score} — {partido.away_score}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#fff', border:'1px solid #e8eaed', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {partido.away?.logo_url ? <img src={partido.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={14} color="#9aa0a6"/>}
            </div>
            <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#202124' }}>{partido.away?.name}</span>
          </div>
        </div>
        {mvp && (
          <div style={{ padding:'10px 20px', background:'#fff8e1', borderBottom:'1px solid #ffe082', display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#f1f3f4', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {mvp.players?.photo_face_url || mvp.players?.photo_url ? <img src={mvp.players.photo_face_url || mvp.players.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.85rem' }}>👤</span>}
            </div>
            <div>
              <div style={{ fontSize:'.65rem', color:'#e8710a', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em' }}>⭐ MVP del partido</div>
              <div style={{ fontSize:'.88rem', fontWeight:'700', color:'#202124' }}>{mvp.players?.name}</div>
            </div>
          </div>
        )}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 32px' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#9aa0a6' }}>Cargando historial...</div>
          ) : stats.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#9aa0a6' }}>
              <div style={{ fontSize:'2rem', marginBottom:'8px' }}>📋</div>
              <div style={{ fontSize:'.875rem' }}>Sin datos de planilla para este partido</div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:'20px' }}>
              <TeamStats jugadores={local}     equipo={partido.home?.name} logo={partido.home?.logo_url}/>
              <div style={{ width:'1px', background:'#e8eaed', flexShrink:0 }}/>
              <TeamStats jugadores={visitante} equipo={partido.away?.name} logo={partido.away?.logo_url}/>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



const TABS = [
  { id: 'actividad',      label: 'Actividad',      icon: <Trophy size={16}/> },
  { id: 'grupos',         label: 'Grupos',          icon: <Users size={16}/> },
  { id: 'calendario',     label: 'Calendario',      icon: <Calendar size={16}/> },
  { id: 'equipos',        label: 'Equipos',         icon: <Shield size={16}/> },
  { id: 'estadisticas',   label: 'Estadísticas',    icon: <BarChart2 size={16}/> },
  { id: 'eliminatorias',  label: 'Eliminatorias',   icon: <GitBranch size={16}/> },
]

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

const FASES = [
  { value: 'grupo',     label: '🏟️ Grupo' },
  { value: 'octavos',   label: '⚔️ Octavos' },
  { value: 'cuartos',   label: '🔥 Cuartos de final' },
  { value: 'semifinal', label: '⚡ Semifinal' },
  { value: 'final',     label: '🏆 Final' },
]
const FASE_LABEL = { grupo:'🏟️ Grupo', octavos:'⚔️ Octavos', cuartos:'🔥 Cuartos', semifinal:'⚡ Semifinal', final:'🏆 Final' }

const COLORES_GRUPO = ['#1a73e8','#e8710a','#1e8e3e','#9955ff','#d93025','#00a896','#f9a825','#4488ff']

function getRondaNombre(total) {
  if (total >= 16) return 'Octavos de final'
  if (total >= 8)  return 'Cuartos de final'
  if (total >= 4)  return 'Semifinal'
  return 'Final'
}
function getFaseValue(total) {
  if (total >= 16) return 'octavos'
  if (total >= 8)  return 'cuartos'
  if (total >= 4)  return 'semifinal'
  return 'final'
}

function TeamLogo({ logo_url, name, size = 28 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (logo_url) return <img src={logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.32 + 'px', fontWeight: '800', color: '#fff', fontFamily: 'system-ui' }}>{iniciales}</span>
    </div>
  )
}

export default function AdminTorneoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [torneo,    setTorneo]    = useState(null)
  const [equipos,   setEquipos]   = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [jugadores, setJugadores] = useState([])
  const [canchas,   setCanchas]   = useState([])
  const [fechas,    setFechas]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('actividad')
  const [msg,       setMsg]       = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [modalPartidoAdmin, setModalPartidoAdmin] = useState(null)

  const [goleadores,   setGoleadores]   = useState([])
  const [vallas,        setVallas]        = useState({ opcion1: [], opcion2: [] })
  const [modoValla,     setModoValla]     = useState('opcion1')
  const [loadingStats, setLoadingStats] = useState(false)

  const [editandoPartido, setEditandoPartido] = useState(null)
  const [scoreHome,       setScoreHome]       = useState('')
  const [scoreAway,       setScoreAway]       = useState('')
  const [guardando,       setGuardando]       = useState(false)

  const [editandoTorneo,  setEditandoTorneo]  = useState(false)
  const [formTorneo,      setFormTorneo]      = useState({})

  const [editandoPartidoForm, setEditandoPartidoForm] = useState(null)
  const [formEditPartido,     setFormEditPartido]     = useState({})

  const [subTab,          setSubTab]          = useState('partidos')
  const [showFormPartido, setShowFormPartido] = useState(false)
  const [formPartido,     setFormPartido]     = useState({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '', fase: 'grupo' })
  const [nuevaCancha,     setNuevaCancha]     = useState('')

  const [configJornada,   setConfigJornada]   = useState({ fecha: '', hora_inicio: '', numero: '' })
  const [jornadaGenerada, setJornadaGenerada] = useState([])
  const [permitirIntergrupo, setPermitirIntergrupo] = useState(false)
  const [drag,            setDrag]            = useState(null)
  const [dragOver,        setDragOver]        = useState(null)
  const [loadingPartido,  setLoadingPartido]  = useState(false)

  const [showAgregarEquipo,  setShowAgregarEquipo]  = useState(false)
  const [busquedaEquipo,     setBusquedaEquipo]     = useState('')
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [loadingEquipos,     setLoadingEquipos]     = useState(false)

  // ── GRUPOS ──────────────────────────────────────────
  const [grupos,           setGrupos]           = useState([])
  const [grupoEquipos,     setGrupoEquipos]     = useState([]) // { grupo_id, team_id }
  const [numGrupos,        setNumGrupos]        = useState(2)
  const [clasificanPorGrupo, setClasificanPorGrupo] = useState(2)
  const [generandoGrupos,  setGenerandoGrupos]  = useState(false)
  const [fechaGrupos,      setFechaGrupos]      = useState('')
  const [horaGrupos,       setHoraGrupos]       = useState('08:00')

  // ── ELIMINATORIAS ───────────────────────────────────
  const [tipoSorteo,       setTipoSorteo]       = useState('tabla') // 'tabla' | 'sorteo'
  const [idaVuelta,        setIdaVuelta]        = useState(false)
  const [fechaElim,        setFechaElim]        = useState('')
  const [horaElim,         setHoraElim]         = useState('08:00')
  const [generandoElim,    setGenerandoElim]    = useState(false)
  const [bracket,          setBracket]          = useState([]) // partidos de eliminatorias

  useEffect(() => { if (id && id !== 'undefined') fetchTodo() }, [id])
  useEffect(() => { if (tab === 'estadisticas' || tab === 'grupos') fetchGoleadores() }, [tab])
  useEffect(() => { if (tab === 'eliminatorias') fetchBracket() }, [tab])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    await Promise.all([fetchTorneo(), fetchEquipos(), fetchPartidos(), fetchJugadores(), fetchCanchas(), fetchFechas(), fetchGrupos()])
    setLoading(false)
  }

  async function fetchTorneo() {
    const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTorneo(data)
    if (data?.num_grupos)           setNumGrupos(data.num_grupos)
    if (data?.equipos_clasifican)   setClasificanPorGrupo(data.equipos_clasifican)
  }

  async function fetchEquipos() {
    const { data } = await supabase.from('tournament_teams').select('*, teams(id, name, city, logo_url, modalidad, genero, registro_token)').eq('tournament_id', id)
    setEquipos((data || []).map(d => ({ ...d.teams, tournament_team_id: d.id })))
  }

  async function fetchPartidos() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', id)
      .order('played_at', { ascending: true })
    setPartidos(data || [])
  }

  async function fetchJugadores() {
    const { data } = await supabase.from('tournament_player_registrations').select('*, players(*), teams(name)').eq('tournament_id', id).eq('activo', true)
    setJugadores(data || [])
  }

  async function fetchCanchas() {
    const { data } = await supabase.from('canchas').select('*').eq('tournament_id', id)
    setCanchas(data || [])
  }

  async function fetchFechas() {
    const { data } = await supabase.from('fechas').select('*').eq('tournament_id', id).order('numero')
    setFechas(data || [])
  }

  async function fetchGoleadores() {
    setLoadingStats(true)
    const { data, error } = await supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', id).order('total_goals', { ascending: false })
    if (!error) setGoleadores(data || [])

    // Valla menos vencida: todos los partidos de arqueros
    const { data: statsPorteros } = await supabase
      .from('player_match_stats')
      .select('player_id, goals_conceded, team_id, players(name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11), teams(name, logo_url)')
      .eq('tournament_id', id)

    // Agrupar por jugador
    const mapPorteros = {}
    ;(statsPorteros || []).forEach(s => {
      const esPortero = s.players?.posicion_futbol5 === 'Portero' || s.players?.posicion_futbol7 === 'Portero' || s.players?.posicion_futbol11 === 'Portero'
      if (!esPortero) return
      if (!mapPorteros[s.player_id]) {
        mapPorteros[s.player_id] = {
          player_id: s.player_id,
          nombre: s.players?.name,
          foto: s.players?.photo_face_url || s.players?.photo_url,
          team_name: s.teams?.name,
          team_logo: s.teams?.logo_url,
          pj: 0,
          total_recibidos: 0,
        }
      }
      mapPorteros[s.player_id].pj++
      mapPorteros[s.player_id].total_recibidos += s.goals_conceded || 0
    })

    const listaPorteros = Object.values(mapPorteros)
    // Opción 1: promedio goles recibidos/PJ (menor es mejor)
    const op1 = listaPorteros
      .map(p => ({ ...p, promedio: p.pj > 0 ? parseFloat((p.total_recibidos / p.pj).toFixed(2)) : 99 }))
      .sort((a, b) => a.promedio - b.promedio)

    // Opción 2: menos goles recibidos total — solo arqueros (todos)
    const op2 = listaPorteros
      .sort((a, b) => a.total_recibidos - b.total_recibidos)

    setVallas({ opcion1: op1, opcion2: op2 })
    setLoadingStats(false)
  }

  async function fetchGrupos() {
    const { data: grps } = await supabase.from('tournament_grupos').select('*').eq('tournament_id', id).order('orden')
    setGrupos(grps || [])
    if (grps && grps.length > 0) {
      const { data: ge } = await supabase.from('grupo_equipos').select('*, teams(id,name,logo_url)').in('grupo_id', grps.map(g => g.id))
      setGrupoEquipos(ge || [])
    }
  }

  async function fetchBracket() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
      .eq('tournament_id', id)
      .neq('fase', 'grupo')
      .order('ronda').order('played_at', { ascending: true })
    setBracket(data || [])
  }

  // ── GRUPOS ──────────────────────────────────────────

  async function handleCrearGrupos() {
    if (equipos.length < numGrupos) return showMsg('Menos equipos que grupos', 'error')
    setGenerandoGrupos(true)

    // Eliminar grupos anteriores
    if (grupos.length > 0) {
      await supabase.from('tournament_grupos').delete().eq('tournament_id', id)
    }

    // Crear nuevos grupos
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const grpsInsert = Array.from({ length: numGrupos }, (_, i) => ({
      tournament_id: id,
      nombre: `Grupo ${letras[i]}`,
      orden: i,
    }))
    const { data: nuevosGrupos } = await supabase.from('tournament_grupos').insert(grpsInsert).select()

    // Distribuir equipos en grupos (serpentina)
    const equiposAleatorios = [...equipos].sort(() => Math.random() - 0.5)
    const geInsert = []
    equiposAleatorios.forEach((eq, i) => {
      const grupoIdx = i % numGrupos
      geInsert.push({ grupo_id: nuevosGrupos[grupoIdx].id, team_id: eq.id, tournament_id: id })
    })
    await supabase.from('grupo_equipos').insert(geInsert)

    // Guardar config en torneo
    await supabase.from('tournaments').update({ num_grupos: numGrupos, equipos_clasifican: clasificanPorGrupo, fase_actual: 'grupos' }).eq('id', id)

    showMsg(`${numGrupos} grupos creados ✓`)
    setGenerandoGrupos(false)
    fetchGrupos()
    fetchTorneo()
  }

  async function handleMoverEquipoGrupo(teamId, grupoIdDestino) {
    await supabase.from('grupo_equipos').update({ grupo_id: grupoIdDestino }).eq('team_id', teamId).eq('tournament_id', id)
    fetchGrupos()
  }

  async function handleGenerarPartidosGrupos() {
    if (!fechaGrupos) return showMsg('Selecciona una fecha', 'error')
    setGenerandoGrupos(true)

    // Eliminar partidos de grupos anteriores
    await supabase.from('matches').delete().eq('tournament_id', id).eq('fase', 'grupo')

    const inserts = []
    let jornada = 1

    for (const grupo of grupos) {
      const eqGrupo = grupoEquipos.filter(ge => ge.grupo_id === grupo.id).map(ge => ge.teams)
      // Todos contra todos dentro del grupo
      for (let i = 0; i < eqGrupo.length; i++) {
        for (let j = i + 1; j < eqGrupo.length; j++) {
          inserts.push({
            tournament_id: id,
            home_team_id:  eqGrupo[i].id,
            away_team_id:  eqGrupo[j].id,
            played_at:     `${fechaGrupos}T${horaGrupos}:00`,
            status:        'scheduled',
            fase:          'grupo',
            grupo:         grupo.nombre,
            matchday:      jornada,
          })
        }
      }
      jornada++
    }

    await supabase.from('matches').insert(inserts)
    showMsg(`${inserts.length} partidos de grupos generados ✓`)
    setGenerandoGrupos(false)
    fetchPartidos()
  }

  // Calcular tabla por grupo
  function getTablaGrupo(grupoId) {
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const partGrupo = partidos.filter(p => p.fase === 'grupo' && eqIds.includes(p.home_team_id) && eqIds.includes(p.away_team_id))
    const tabla = {}
    eqIds.forEach(eid => {
      const eq = equipos.find(e => e.id === eid)
      tabla[eid] = { equipo: eq, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 }
    })
    partGrupo.filter(p => p.status === 'finished').forEach(p => {
      if (tabla[p.home_team_id]) {
        tabla[p.home_team_id].pj++
        tabla[p.home_team_id].gf += p.home_score || 0
        tabla[p.home_team_id].gc += p.away_score || 0
        if (p.home_score > p.away_score)      { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
        else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += 1 }
        else tabla[p.home_team_id].pp++
      }
      if (tabla[p.away_team_id]) {
        tabla[p.away_team_id].pj++
        tabla[p.away_team_id].gf += p.away_score || 0
        tabla[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
        else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += 1 }
        else tabla[p.away_team_id].pp++
      }
    })
    return Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  function getGoleadoresGrupo(grupoId) {
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    const matchIds = partidos.filter(p => p.fase === 'grupo' && eqIds.includes(p.home_team_id) && eqIds.includes(p.away_team_id) && p.status === 'finished').map(p => p.id)
    const map = {}
    goleadores.forEach(g => {
      if (!eqIds.includes(g.team_id)) return
      if (!map[g.player_id]) map[g.player_id] = { ...g }
      else { map[g.player_id].total_goals += g.total_goals || 0 }
    })
    return Object.values(map).filter(g => g.total_goals > 0).sort((a,b) => b.total_goals - a.total_goals).slice(0, 5)
  }

  function getVallaGrupo(grupoId) {
    const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupoId).map(ge => ge.team_id)
    return (vallas.opcion1 || []).filter(p => eqIds.includes(p.team_id)).slice(0, 3)
  }

  // ── FINALIZAR GRUPOS ────────────────────────────────

  async function handleFinalizarGrupos() {
    if (!confirm(`¿Finalizar fase de grupos? Clasifican los ${clasificanPorGrupo} mejores de cada grupo.`)) return

    // Obtener clasificados
    const clasificados = []
    for (const grupo of grupos) {
      const tabla = getTablaGrupo(grupo.id)
      tabla.slice(0, clasificanPorGrupo).forEach((row, pos) => {
        if (row.equipo) clasificados.push({ ...row.equipo, posicion: pos + 1, grupo: grupo.nombre, pts: row.pts, dg: row.gf - row.gc })
      })
    }

    // Ordenar clasificados: primeros de cada grupo primero, luego segundos, etc.
    clasificados.sort((a, b) => a.posicion - b.posicion || b.pts - a.pts || b.dg - a.dg)

    await supabase.from('tournaments').update({ fase_actual: 'eliminatorias' }).eq('id', id)
    showMsg(`Fase de grupos finalizada. ${clasificados.length} equipos clasificados ✓`)
    setTab('eliminatorias')
    fetchTorneo()
  }

  // ── ELIMINATORIAS ───────────────────────────────────

  function getClasificados() {
    const clasificados = []
    for (const grupo of grupos) {
      const tabla = getTablaGrupo(grupo.id)
      tabla.slice(0, clasificanPorGrupo).forEach((row, pos) => {
        if (row.equipo) clasificados.push({ ...row.equipo, posicion: pos + 1, grupo: grupo.nombre, pts: row.pts, dg: row.gf - row.gc })
      })
    }
    return clasificados.sort((a, b) => a.posicion - b.posicion || b.pts - a.pts || b.dg - a.dg)
  }

  async function handleGenerarEliminatorias() {
    if (!fechaElim) return showMsg('Selecciona una fecha', 'error')
    setGenerandoElim(true)

    let clasificados = getClasificados()
    if (clasificados.length === 0) {
      // Si no hay grupos, usar todos los equipos ordenados por tabla general
      const tablaGen = calcTablaGeneral()
      clasificados = tablaGen.map(row => row.equipo).filter(Boolean)
    }

    if (clasificados.length < 2) { showMsg('Necesitas al menos 2 clasificados', 'error'); setGenerandoElim(false); return }

    // Sorteo o por tabla
    let emparejados = [...clasificados]
    if (tipoSorteo === 'sorteo') {
      emparejados = emparejados.sort(() => Math.random() - 0.5)
    }
    // Por tabla: 1 vs último, 2 vs penúltimo...
    // emparejados ya está ordenado por posición

    const total = emparejados.length
    const fase  = getFaseValue(total)
    const ronda = getRondaNombre(total)

    // Eliminar eliminatorias anteriores
    await supabase.from('matches').delete().eq('tournament_id', id).neq('fase', 'grupo')

    const inserts = []
    for (let i = 0; i < Math.floor(total / 2); i++) {
      const local     = emparejados[i]
      const visitante = emparejados[total - 1 - i]
      inserts.push({
        tournament_id: id,
        home_team_id:  local.id,
        away_team_id:  visitante.id,
        played_at:     `${fechaElim}T${horaElim}:00`,
        status:        'scheduled',
        fase,
        ronda,
        matchday:      null,
      })
      if (idaVuelta) {
        inserts.push({
          tournament_id: id,
          home_team_id:  visitante.id,
          away_team_id:  local.id,
          played_at:     `${fechaElim}T${horaElim}:00`,
          status:        'scheduled',
          fase,
          ronda:         `${ronda} (vuelta)`,
          matchday:      null,
        })
      }
    }

    await supabase.from('matches').insert(inserts)
    showMsg(`${inserts.length} partidos de eliminatorias generados ✓`)
    setGenerandoElim(false)
    fetchPartidos()
    fetchBracket()
  }

  // ── TABLA GENERAL ───────────────────────────────────

  function calcTablaGeneral() {
    const tabla = {}
    equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
    partidos.filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
      if (tabla[p.home_team_id]) {
        tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
        if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
        else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += 1 }
        else tabla[p.home_team_id].pp++
      }
      if (tabla[p.away_team_id]) {
        tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
        else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += 1 }
        else tabla[p.away_team_id].pp++
      }
    })
    return Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  // ── CALENDARIO ──────────────────────────────────────

  async function handleAgregarCancha() {
    if (!nuevaCancha.trim()) return
    const { data, error } = await supabase.from('canchas').insert({ tournament_id: id, nombre: nuevaCancha.trim() }).select().single()
    if (error) return showMsg('Error al agregar cancha', 'error')
    setCanchas(prev => [...prev, data]); setNuevaCancha(''); showMsg('Cancha agregada ✓')
  }

  async function handleEliminarCancha(cancha) {
    if (!confirm(`¿Eliminar cancha "${cancha.nombre}"?`)) return
    await supabase.from('canchas').delete().eq('id', cancha.id)
    setCanchas(prev => prev.filter(x => x.id !== cancha.id)); showMsg('Cancha eliminada')
  }

  async function handleCrearPartido() {
    if (!formPartido.home_team_id || !formPartido.away_team_id) return showMsg('Selecciona los dos equipos', 'error')
    if (formPartido.home_team_id === formPartido.away_team_id) return showMsg('Los equipos no pueden ser iguales', 'error')
    if (!formPartido.played_at) return showMsg('La fecha es obligatoria', 'error')
    setLoadingPartido(true)
    const { error } = await supabase.from('matches').insert({
      tournament_id: id, home_team_id: formPartido.home_team_id, away_team_id: formPartido.away_team_id,
      played_at: formPartido.played_at + (formPartido.hora ? 'T' + formPartido.hora : 'T00:00:00'),
      location: formPartido.location || null, matchday: formPartido.matchday ? parseInt(formPartido.matchday) : null,
      fase: formPartido.fase || 'grupo', status: 'scheduled',
    })
    if (error) showMsg('Error al crear partido', 'error')
    else { showMsg('Partido creado ✓'); setShowFormPartido(false); setFormPartido({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '', fase: 'grupo' }); fetchPartidos() }
    setLoadingPartido(false)
  }

  async function handleEliminarPartido(pid) {
    if (!confirm('¿Eliminar partido?')) return
    await supabase.from('matches').delete().eq('id', pid)
    fetchPartidos(); showMsg('Partido eliminado')
  }

  async function handleGuardarResultado() {
    if (scoreHome === '' || scoreAway === '') return showMsg('Ingresa el marcador', 'error')
    setGuardando(true)
    const local = parseInt(scoreHome), visitante = parseInt(scoreAway)
    const ganador = local > visitante ? 'home' : local < visitante ? 'away' : 'draw'
    const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', editandoPartido.id)
    if (error) { showMsg('Error al guardar', 'error'); setGuardando(false); return }
    const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', editandoPartido.id).eq('resuelta', false)
    if (preds && preds.length > 0) {
      for (const pred of preds) {
        let pts = 0
        if (pred.ganador === ganador)                                       pts += ganador === 'draw' ? 5 : 3
        if (pred.goles_home === local)                                      pts += 3
        if (pred.goles_away === visitante)                                  pts += 3
        if (pred.goles_home === local && pred.goles_away === visitante)     pts += 10
        await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
      }
    }
    showMsg('Resultado guardado ✓'); setEditandoPartido(null); setScoreHome(''); setScoreAway(''); fetchPartidos(); fetchBracket()
    setGuardando(false)
  }

  async function handleGuardarTorneo() {
    const { error } = await supabase.from('tournaments').update(formTorneo).eq('id', id)
    if (error) { showMsg('Error al actualizar torneo', 'error'); return }
    setTorneo(p => ({ ...p, ...formTorneo })); setEditandoTorneo(false); showMsg('Torneo actualizado ✓')
  }

  async function handleGuardarEditPartido() {
    if (!formEditPartido.played_at || !formEditPartido.hora) return showMsg('Fecha y hora son obligatorias', 'error')
    const { error } = await supabase.from('matches').update({
      played_at: new Date(formEditPartido.played_at + 'T' + formEditPartido.hora + ':00').toISOString(),
      location: formEditPartido.location || null, matchday: formEditPartido.matchday ? parseInt(formEditPartido.matchday) : null,
      fase: formEditPartido.fase || 'grupo',
    }).eq('id', editandoPartidoForm.id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Partido actualizado ✓'); setEditandoPartidoForm(null); fetchPartidos() }
  }

  function generarJornada() {
    if (!configJornada.fecha) return showMsg('Selecciona la fecha', 'error')
    if (!configJornada.hora_inicio) return showMsg('Ingresa la hora de inicio', 'error')
    if (canchas.length === 0) return showMsg('Agrega al menos una cancha', 'error')
    if (equipos.length < 2) return showMsg('Necesitas al menos 2 equipos', 'error')

    // Cruces que ya existen en el torneo (jugados o programados)
    const yaJugaron = new Set()
    partidos.forEach(p => {
      yaJugaron.add(`${p.home_team_id}|${p.away_team_id}`)
      yaJugaron.add(`${p.away_team_id}|${p.home_team_id}`)
    })

    // Grupo de cada equipo (si el torneo tiene grupos)
    const grupoDe = {}
    grupoEquipos.forEach(ge => { grupoDe[ge.team_id] = ge.grupo_id })
    const hayGrupos = grupos.length > 1

    const eq = [...equipos].sort(() => Math.random() - 0.5)
    const usados = new Set()
    const pares = []
    const descansan = []

    for (const a of eq) {
      if (usados.has(a.id)) continue
      usados.add(a.id)
      // 1) Rival del mismo grupo con el que no haya jugado
      let rival = eq.find(b => !usados.has(b.id) && !yaJugaron.has(`${a.id}|${b.id}`) && (!hayGrupos || grupoDe[a.id] === grupoDe[b.id]))
      // 2) Si no hay y está permitido, rival de otro grupo con el que no haya jugado
      if (!rival && hayGrupos && permitirIntergrupo) {
        rival = eq.find(b => !usados.has(b.id) && !yaJugaron.has(`${a.id}|${b.id}`))
      }
      if (rival) {
        usados.add(rival.id)
        pares.push({ local: a, visitante: rival, intergrupo: hayGrupos && grupoDe[a.id] !== grupoDe[rival.id] })
      } else {
        descansan.push(a)
      }
    }
    // 3) Ya sin rivales nuevos: descansan
    descansan.forEach(a => pares.push({ local: a, visitante: null, descanso: true }))

    const [hIni] = configJornada.hora_inicio.split(':').map(Number)
    let idx = 0
    setJornadaGenerada(pares.map(p => {
      if (p.descanso) return p
      const asignado = { ...p, cancha: canchas[idx % canchas.length], hora: `${String(hIni + Math.floor(idx / canchas.length)).padStart(2, '0')}:00` }
      idx++
      return asignado
    }))
  }

  function handleEliminarParejaJornada(i) {
    const p = jornadaGenerada[i]
    if (!p || p.descanso) return
    const nueva = jornadaGenerada.filter((_, idx) => idx !== i)
    nueva.push({ local: p.local, visitante: null, descanso: true })
    if (p.visitante) nueva.push({ local: p.visitante, visitante: null, descanso: true })
    setJornadaGenerada(nueva)
  }

  async function handleGuardarJornada() {
    if (jornadaGenerada.length === 0) return
    setLoadingPartido(true)
    const { data: fechaData, error: fechaErr } = await supabase.from('fechas').insert({
      tournament_id: id, numero: parseInt(configJornada.numero) || (fechas.length + 1),
      nombre: `Jornada ${configJornada.numero || fechas.length + 1}`, fecha_inicio: configJornada.fecha,
    }).select().single()
    if (fechaErr) { showMsg('Error al crear jornada', 'error'); setLoadingPartido(false); return }
    const inserts = jornadaGenerada.filter(p => !p.descanso && p.visitante).map(p => ({
      tournament_id: id, home_team_id: p.local.id, away_team_id: p.visitante.id,
      played_at: `${configJornada.fecha}T${p.hora}:00-05:00`, location: p.cancha?.nombre || null,
      matchday: parseInt(configJornada.numero) || (fechas.length + 1), fecha_id: fechaData.id,
      status: 'scheduled', fase: 'grupo',
    }))
    const { error } = await supabase.from('matches').insert(inserts)
    if (error) showMsg('Error al guardar partidos', 'error')
    else { showMsg(`Jornada creada con ${inserts.length} partidos ✓`); setJornadaGenerada([]); fetchPartidos(); fetchFechas() }
    setLoadingPartido(false)
  }

  function handleDragStart(pi, slot) { setDrag({ pi, slot, equipo: slot === 'local' ? jornadaGenerada[pi].local : jornadaGenerada[pi].visitante }) }
  function handleDragOver(e, pi, slot) { e.preventDefault(); setDragOver({ pi, slot }) }
  function handleDrop(e, tpi, tslot) {
    e.preventDefault()
    if (!drag) return
    if (drag.pi === tpi && drag.slot === tslot) { setDrag(null); setDragOver(null); return }
    const nueva = jornadaGenerada.map(p => ({ ...p }))

    // Dos equipos que descansan → crear un partido nuevo entre ellos
    if (drag.pi !== tpi && nueva[tpi].descanso && nueva[drag.pi].descanso) {
      const numPartidos = nueva.filter(p => !p.descanso).length
      const [hIni] = (configJornada.hora_inicio || '08:00').split(':').map(Number)
      const partidoNuevo = {
        local: nueva[tpi].local, visitante: nueva[drag.pi].local,
        cancha: canchas.length > 0 ? canchas[numPartidos % canchas.length] : null,
        hora: `${String(hIni + Math.floor(numPartidos / Math.max(canchas.length, 1))).padStart(2, '0')}:00`,
      }
      const sinFilas = nueva.filter((_, idx) => idx !== drag.pi && idx !== tpi)
      const idxPrimerDescanso = sinFilas.findIndex(p => p.descanso)
      if (idxPrimerDescanso === -1) sinFilas.push(partidoNuevo)
      else sinFilas.splice(idxPrimerDescanso, 0, partidoNuevo)
      setJornadaGenerada(sinFilas); setDrag(null); setDragOver(null)
      return
    }

    // Intercambio normal (también entre un partido y un equipo que descansa)
    const dest = tslot === 'local' ? nueva[tpi].local : nueva[tpi].visitante
    if (tslot === 'local') nueva[tpi].local = drag.equipo; else nueva[tpi].visitante = drag.equipo
    if (drag.slot === 'local') nueva[drag.pi].local = dest; else nueva[drag.pi].visitante = dest
    setJornadaGenerada(nueva); setDrag(null); setDragOver(null)
  }
  function handleDragEnd() { setDrag(null); setDragOver(null) }

  function vecesEnfrentados(idA, idB) {
    if (!idA || !idB) return 0
    return partidos.filter(p =>
      (p.home_team_id === idA && p.away_team_id === idB) ||
      (p.home_team_id === idB && p.away_team_id === idA)
    ).length
  }

  async function buscarEquipos(q) {
    setBusquedaEquipo(q)
    if (!q.trim()) { setEquiposDisponibles([]); return }
    setLoadingEquipos(true)
    const { data } = await supabase.from('teams').select('*').ilike('name', `%${q}%`).limit(10)
    const idsInscritos = equipos.map(e => e.id)
    setEquiposDisponibles((data || []).filter(e => !idsInscritos.includes(e.id)))
    setLoadingEquipos(false)
  }

  async function handleAgregarEquipo(equipo) {
    const { error } = await supabase.from('tournament_teams').insert({ tournament_id: id, team_id: equipo.id })
    if (error) return showMsg('Error al agregar equipo', 'error')
    showMsg(`${equipo.name} agregado al torneo ✓`); setShowAgregarEquipo(false); setBusquedaEquipo(''); setEquiposDisponibles([]); fetchEquipos()
  }

  async function handleQuitarEquipo(equipo) {
    if (!confirm(`¿Quitar a ${equipo.name} del torneo?`)) return
    await supabase.from('tournament_teams').delete().eq('tournament_id', id).eq('team_id', equipo.id)
    showMsg(`${equipo.name} quitado del torneo`); fetchEquipos()
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
  if (!id || id === 'undefined') return <Navigate to="/admin/torneos" replace/>
  if (!torneo)  return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Torneo no encontrado</div>

  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')
  const tablaOrdenada      = calcTablaGeneral()

  const faseActual         = torneo.fase_actual || 'grupos'
  const gruposFinalizados  = faseActual === 'eliminatorias'

  // Partidos de grupos vs eliminatorias
  const partidosGrupos = partidos.filter(p => !p.fase || p.fase === 'grupo')
  const partidosElim   = partidos.filter(p => p.fase && p.fase !== 'grupo')

  return (
    <div>
      {planillaPartido && (
        <PlanillaPartido
          partido={planillaPartido}
          onClose={() => setPlanillaPartido(null)}
          onGuardarResultado={async (local, visitante) => {
            const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', planillaPartido.id)
            if (!error) {
              const ganador = local > visitante ? 'home' : local < visitante ? 'away' : 'draw'
              const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', planillaPartido.id).eq('resuelta', false)
              if (preds && preds.length > 0) {
                for (const pred of preds) {
                  let pts = 0
                  if (pred.ganador === ganador) pts += ganador === 'draw' ? 5 : 3
                  if (pred.goles_home === local)     pts += 3
                  if (pred.goles_away === visitante) pts += 3
                  if (pred.goles_home === local && pred.goles_away === visitante) pts += 10
                  await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
                }
              }
              showMsg('Resultado guardado ✓'); setPlanillaPartido(null); fetchPartidos(); fetchBracket()
            }
          }}
        />
      )}

      {modalPartidoAdmin && (
        <ModalPartidoAdmin partido={modalPartidoAdmin} onClose={() => setModalPartidoAdmin(null)}/>
      )}

      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Modales resultado / editar torneo / editar partido / agregar equipo */}
      {editandoPartido && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px', textAlign: 'center' }}>Ingresar resultado</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '8px' }}>{editandoPartido.home?.name}</div>
                <input type="number" min="0" value={scoreHome} onChange={e => setScoreHome(e.target.value)} style={{ width: '80px', textAlign: 'center', fontSize: '2rem', fontWeight: '700', padding: '8px', border: '2px solid #1a73e8', borderRadius: '8px', outline: 'none', color: '#202124' }}/>
              </div>
              <div style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '1.2rem' }}>—</div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '8px' }}>{editandoPartido.away?.name}</div>
                <input type="number" min="0" value={scoreAway} onChange={e => setScoreAway(e.target.value)} style={{ width: '80px', textAlign: 'center', fontSize: '2rem', fontWeight: '700', padding: '8px', border: '2px solid #1a73e8', borderRadius: '8px', outline: 'none', color: '#202124' }}/>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleGuardarResultado} disabled={guardando} style={{ flex: 1, padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: guardando ? .7 : 1 }}>
                {guardando ? 'Guardando...' : 'Guardar resultado'}
              </button>
              <button onClick={() => { setEditandoPartido(null); setScoreHome(''); setScoreAway('') }} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {editandoTorneo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>Editar torneo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[{ label: 'Nombre', key: 'name' }, { label: 'Ciudad', key: 'city' }, { label: 'Temporada', key: 'season' }, { label: 'Categoría', key: 'categoria' }].map(f => (
                <div key={f.key}><label style={labelStyle}>{f.label}</label><input value={formTorneo[f.key] || ''} onChange={e => setFormTorneo(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}/></div>
              ))}
              <div><label style={labelStyle}>Modalidad</label><select value={formTorneo.modalidad || ''} onChange={e => setFormTorneo(p => ({ ...p, modalidad: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Fútbol 5</option><option>Fútbol 7</option><option>Fútbol 11</option></select></div>
              <div><label style={labelStyle}>Género</label><select value={formTorneo.genero || ''} onChange={e => setFormTorneo(p => ({ ...p, genero: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option><option>Mixto</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleGuardarTorneo} style={{ flex: 1, padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>Guardar</button>
              <button onClick={() => setEditandoTorneo(false)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {editandoPartidoForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '6px' }}>Editar partido</div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '20px' }}>{editandoPartidoForm.home?.name} vs {editandoPartidoForm.away?.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Fecha *</label><input type="date" value={formEditPartido.played_at || ''} onChange={e => setFormEditPartido(p => ({ ...p, played_at: e.target.value }))} style={inputStyle}/></div>
                <div><label style={labelStyle}>Hora *</label><input type="time" value={formEditPartido.hora || ''} onChange={e => setFormEditPartido(p => ({ ...p, hora: e.target.value }))} style={inputStyle}/></div>
              </div>
              <div><label style={labelStyle}>Cancha</label><select value={formEditPartido.location || ''} onChange={e => setFormEditPartido(p => ({ ...p, location: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option>{canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
              <div><label style={labelStyle}>Jornada #</label><input type="number" value={formEditPartido.matchday || ''} onChange={e => setFormEditPartido(p => ({ ...p, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
              <div><label style={labelStyle}>Fase</label><select value={formEditPartido.fase || 'grupo'} onChange={e => setFormEditPartido(p => ({ ...p, fase: e.target.value }))} style={inputStyle}>{FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleGuardarEditPartido} style={{ flex: 1, padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>Guardar cambios</button>
              <button onClick={() => setEditandoPartidoForm(null)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {showAgregarEquipo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '440px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Agregar equipo al torneo</div>
              <button onClick={() => { setShowAgregarEquipo(false); setBusquedaEquipo(''); setEquiposDisponibles([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
            </div>
            <input value={busquedaEquipo} onChange={e => buscarEquipos(e.target.value)} placeholder="Buscar equipo por nombre..." style={{ ...inputStyle, marginBottom: '12px' }} autoFocus/>
            {loadingEquipos && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem', padding: '12px' }}>Buscando...</div>}
            {!loadingEquipos && busquedaEquipo && equiposDisponibles.length === 0 && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem', padding: '12px' }}>No se encontraron equipos disponibles</div>}
            {equiposDisponibles.length > 0 && (
              <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'hidden' }}>
                {equiposDisponibles.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < equiposDisponibles.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={e.logo_url} name={e.name} size={36}/></div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{e.name}</div>{e.city && <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>📍 {e.city}</div>}</div>
                    <button onClick={() => handleAgregarEquipo(e)} style={{ padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>+ Agregar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button onClick={() => navigate('/admin/torneos')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', marginBottom: '20px' }}>
        <ArrowLeft size={16}/> Volver a torneos
      </button>

      {/* Header torneo */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {torneo.logo_url ? <img src={torneo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Trophy size={28} color="#1a73e8"/>}
            </div>
            <label style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '22px', height: '22px', borderRadius: '50%', background: '#1a73e8', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Camera size={11} color="#fff"/>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files[0]; if (!file) return
                const ext = file.name.split('.').pop(), path = `logos/${id}.${ext}`
                await supabase.storage.from('tournaments').upload(path, file, { upsert: true })
                const { data: urlData } = supabase.storage.from('tournaments').getPublicUrl(path)
                await supabase.from('tournaments').update({ logo_url: urlData.publicUrl }).eq('id', id)
                setTorneo(prev => ({ ...prev, logo_url: urlData.publicUrl }))
              }}/>
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: '0 0 6px' }}>{torneo.name}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {torneo.season    && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📅 {torneo.season}</span>}
              {torneo.city      && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📍 {torneo.city}</span>}
              {torneo.modalidad && <span style={{ fontSize: '.8rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 10px' }}>{torneo.modalidad}</span>}
              {torneo.genero    && <span style={{ fontSize: '.8rem', color: '#6c35de', background: '#f3e8fd', borderRadius: '10px', padding: '2px 10px' }}>{torneo.genero}</span>}
              {torneo.categoria && <span style={{ fontSize: '.8rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '10px', padding: '2px 10px' }}>{torneo.categoria}</span>}
              {gruposFinalizados && <span style={{ fontSize: '.8rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '2px 10px', fontWeight: '700' }}>⚡ Eliminatorias</span>}
            </div>
            <button onClick={() => { setFormTorneo({ name: torneo.name, city: torneo.city, season: torneo.season, categoria: torneo.categoria, modalidad: torneo.modalidad, genero: torneo.genero }); setEditandoTorneo(true) }}
              style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '4px 12px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem' }}>
              ✏️ Editar torneo
            </button>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
            {[
              { label: 'Equipos',  value: equipos.length,        color: '#1a73e8' },
              { label: 'Jugadores',value: jugadores.length,       color: '#6c35de' },
              { label: 'Partidos', value: partidos.length,        color: '#e8710a' },
              { label: 'Jugados',  value: partidosJugados.length, color: '#1e8e3e' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '.7rem', color: '#9aa0a6' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '4px', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,.06)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', transition: 'all .15s', background: tab === t.id ? '#1a73e8' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB ACTIVIDAD ── */}
      {tab === 'actividad' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', marginBottom: '16px', fontSize: '.9rem' }}>✅ Actividad del torneo</div>
            {[
              { label: 'Registrar Equipos',   done: equipos.length > 0 },
              { label: 'Crear Grupos',         done: grupos.length > 0 },
              { label: 'Agregar Canchas',      done: canchas.length > 0 },
              { label: 'Crear Partidos',       done: partidos.length > 0 },
              { label: 'Ingresar Resultados',  done: partidosJugados.length > 0 },
              { label: 'Fase Eliminatorias',   done: gruposFinalizados },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 5 ? '1px solid #f1f3f4' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: item.done ? '#e6f4ea' : '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.done ? <Check size={14} color="#1e8e3e"/> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dadce0' }}/>}
                  </div>
                  <span style={{ fontSize: '.875rem', color: item.done ? '#9aa0a6' : '#202124', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '.75rem', fontWeight: '500', color: item.done ? '#1e8e3e' : '#e8710a', background: item.done ? '#e6f4ea' : '#fce8d9', borderRadius: '10px', padding: '2px 10px' }}>
                  {item.done ? 'Completado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Equipos inscritos',   value: equipos.length,         color: '#1a73e8', bg: '#e8f0fe' },
              { label: 'Grupos creados',       value: grupos.length,          color: '#9955ff', bg: '#f3e8fd' },
              { label: 'Jugadores totales',    value: jugadores.length,       color: '#6c35de', bg: '#f3e8fd' },
              { label: 'Partidos creados',     value: partidos.length,        color: '#e8710a', bg: '#fce8d9' },
              { label: 'Partidos jugados',     value: partidosJugados.length, color: '#1e8e3e', bg: '#e6f4ea' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <span style={{ fontSize: '.875rem', color: '#5f6368', fontWeight: '500' }}>{s.label}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', color: s.color, background: s.bg, borderRadius: '8px', padding: '2px 14px' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB GRUPOS ── */}
      {tab === 'grupos' && (
        <div>
          {/* Configuración */}
          {!gruposFinalizados && (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>⚙️ Configurar grupos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Número de grupos</label>
                  <input type="number" min="1" max="8" value={numGrupos} onChange={e => setNumGrupos(parseInt(e.target.value))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Clasifican por grupo</label>
                  <input type="number" min="1" max="8" value={clasificanPorGrupo} onChange={e => setClasificanPorGrupo(parseInt(e.target.value))} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Fecha partidos grupos</label>
                  <input type="date" value={fechaGrupos} onChange={e => setFechaGrupos(e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>Hora inicio</label>
                  <input type="time" value={horaGrupos} onChange={e => setHoraGrupos(e.target.value)} style={inputStyle}/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleCrearGrupos} disabled={generandoGrupos}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: generandoGrupos ? .7 : 1 }}>
                  <Shuffle size={16}/> {generandoGrupos ? 'Creando...' : grupos.length > 0 ? 'Regenerar grupos' : 'Crear grupos y sortear equipos'}
                </button>
                {grupos.length > 0 && (
                  <button onClick={handleGenerarPartidosGrupos} disabled={generandoGrupos || !fechaGrupos}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: (!fechaGrupos || generandoGrupos) ? .6 : 1 }}>
                    <Calendar size={16}/> Generar partidos todos vs todos
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grupos con tablas */}
          {grupos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {grupos.map((grupo, gi) => {
                const color = COLORES_GRUPO[gi % COLORES_GRUPO.length]
                const tabla = getTablaGrupo(grupo.id)
                return (
                  <div key={grupo.id} style={{ background: '#fff', border: `1px solid ${color}33`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ background: `${color}22`, borderBottom: `2px solid ${color}`, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: '700', color, fontSize: '.9rem' }}>{grupo.nombre}</div>
                      <span style={{ fontSize: '.72rem', color, background: `${color}22`, borderRadius: '20px', padding: '2px 10px', fontWeight: '600' }}>
                        {grupoEquipos.filter(ge => ge.grupo_id === grupo.id).length} equipos
                      </span>
                    </div>
                    {/* Tabla */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa' }}>
                            <th style={{ padding: '6px 12px', textAlign: 'left', color: '#5f6368', fontWeight: '600' }}>EQUIPO</th>
                            {['PJ','PG','PE','PP','GF','GC','PTS'].map(h => (
                              <th key={h} style={{ padding: '6px 6px', textAlign: 'center', color: '#5f6368', fontWeight: '600', fontSize: '.68rem' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tabla.map((row, i) => {
                            const clasifica = i < clasificanPorGrupo
                            return (
                              <tr key={row.equipo?.id || i} style={{ borderTop: '1px solid #f1f3f4', background: clasifica ? `${color}08` : '#fff' }}>
                                <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '.65rem', fontWeight: '700', color: clasifica ? color : '#9aa0a6', minWidth: '14px' }}>{i + 1}</span>
                                  <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={row.equipo?.logo_url} name={row.equipo?.name} size={20}/></div>
                                  <span style={{ fontWeight: clasifica ? '700' : '500', color: '#202124', whiteSpace: 'nowrap', fontSize: '.78rem' }}>{row.equipo?.name}</span>
                                  {clasifica && <span style={{ fontSize: '.55rem', background: color, color: '#fff', borderRadius: '4px', padding: '1px 4px', fontWeight: '700' }}>✓</span>}
                                </td>
                                {[row.pj, row.pg, row.pe, row.pp, row.gf, row.gc].map((v, j) => (
                                  <td key={j} style={{ padding: '8px 6px', textAlign: 'center', color: '#5f6368' }}>{v}</td>
                                ))}
                                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: '700', color: color }}>{row.pts}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Partidos del grupo */}
                    {(() => {
                      const eqIds = grupoEquipos.filter(ge => ge.grupo_id === grupo.id).map(ge => ge.team_id)
                      const partGrupo = partidos.filter(p => eqIds.includes(p.home_team_id) && eqIds.includes(p.away_team_id) && p.fase === 'grupo')
                      if (partGrupo.length === 0) return null
                      return (
                        <div style={{ borderTop: '1px solid #f1f3f4', padding: '10px 12px' }}>
                          <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px', letterSpacing: '.06em' }}>PARTIDOS</div>
                          {partGrupo.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f8f9fa' }}>
                              <span style={{ fontSize: '.72rem', color: '#9aa0a6', minWidth: '60px' }}>
                                {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                              </span>
                              <span style={{ flex: 1, fontSize: '.75rem', color: '#202124', fontWeight: '500', textAlign: 'right' }}>{p.home?.name}</span>
                              <span style={{ fontWeight: '700', color: '#202124', background: p.status === 'finished' ? '#f1f3f4' : '#e8f0fe', borderRadius: '6px', padding: '2px 8px', fontSize: '.78rem', flexShrink: 0 }}>
                                {p.status === 'finished' ? `${p.home_score} - ${p.away_score}` : 'vs'}
                              </span>
                              <span style={{ flex: 1, fontSize: '.75rem', color: '#202124', fontWeight: '500' }}>{p.away?.name}</span>
                              {p.status !== 'finished' && (
                                <button onClick={() => setPlanillaPartido(p)}
                                  style={{ padding: '3px 8px', background: '#1a73e8', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.68rem' }}>
                                  ▶
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Goleadores del grupo */}
                    {(() => {
                      const gols = getGoleadoresGrupo(grupo.id)
                      if (gols.length === 0) return null
                      return (
                        <div style={{ borderTop: '1px solid #f1f3f4', padding: '10px 12px' }}>
                          <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px', letterSpacing: '.06em' }}>⚽ GOLEADORES</div>
                          {gols.map((g, i) => (
                            <div key={g.player_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid #f8f9fa' }}>
                              <span style={{ fontSize: '.65rem', fontWeight: '700', color: i===0?'#f9a825':'#9aa0a6', minWidth: '14px' }}>{i+1}</span>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {g.photo_url ? <img src={g.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize: '.6rem' }}>👤</span>}
                              </div>
                              <span style={{ flex: 1, fontSize: '.72rem', color: '#202124', fontWeight: '600' }}>{g.player_name}</span>
                              <span style={{ fontSize: '.72rem', color: '#1a73e8', fontWeight: '900' }}>{g.total_goals} ⚽</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Valla menos vencida del grupo */}
                    {(() => {
                      const valla = getVallaGrupo(grupo.id)
                      if (valla.length === 0) return null
                      return (
                        <div style={{ borderTop: '1px solid #f1f3f4', padding: '10px 12px' }}>
                          <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px', letterSpacing: '.06em' }}>🧤 VALLA MENOS VENCIDA</div>
                          {valla.map((p, i) => (
                            <div key={p.player_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid #f8f9fa' }}>
                              <span style={{ fontSize: '.65rem', fontWeight: '700', color: i===0?'#1e8e3e':'#9aa0a6', minWidth: '14px' }}>{i+1}</span>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {p.foto ? <img src={p.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize: '.6rem' }}>🧤</span>}
                              </div>
                              <span style={{ flex: 1, fontSize: '.72rem', color: '#202124', fontWeight: '600' }}>{p.nombre}</span>
                              <span style={{ fontSize: '.68rem', color: '#1e8e3e', fontWeight: '700' }}>{p.promedio} GC/PJ</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
              <Users size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
              <div>Configura y crea los grupos arriba</div>
            </div>
          )}

          {/* Botón finalizar fase de grupos */}
          {grupos.length > 0 && !gruposFinalizados && (
            <div style={{ marginTop: '20px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '600', color: '#795548', fontSize: '.9rem' }}>¿Terminaron todos los partidos de grupos?</div>
                <div style={{ fontSize: '.78rem', color: '#9aa0a6', marginTop: '2px' }}>
                  Clasifican {clasificanPorGrupo} equipo{clasificanPorGrupo > 1 ? 's' : ''} por grupo · {grupos.length * clasificanPorGrupo} clasificados en total
                </div>
              </div>
              <button onClick={handleFinalizarGrupos}
                style={{ padding: '10px 20px', background: '#e8710a', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', flexShrink: 0 }}>
                ⚡ Finalizar fase de grupos →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CALENDARIO ── */}
      {tab === 'calendario' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="#1a73e8"/> Canchas
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {canchas.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e8f0fe', borderRadius: '20px', padding: '3px 6px 3px 12px' }}>
                  <span style={{ fontSize: '.8rem', color: '#1a73e8' }}>{c.nombre}</span>
                  <button onClick={() => handleEliminarCancha(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.75rem', padding: '0 3px', lineHeight: 1 }}>✕</button>
                </div>
              ))}
              {canchas.length === 0 && <span style={{ fontSize: '.8rem', color: '#9aa0a6' }}>Sin canchas</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={nuevaCancha} onChange={e => setNuevaCancha(e.target.value)} placeholder="Nombre de la cancha..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAgregarCancha()}/>
              <button onClick={handleAgregarCancha} style={{ padding: '8px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem' }}>+ Agregar</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['partidos','jornada'].map(st => (
              <button key={st} onClick={() => setSubTab(st)}
                style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === st ? '#1a73e8' : '#fff', color: subTab === st ? '#fff' : '#5f6368', border: subTab === st ? 'none' : '1px solid #dadce0' }}>
                {st === 'partidos' ? 'Crear Partido' : 'Jornada Automática'}
              </button>
            ))}
          </div>

          {subTab === 'partidos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button onClick={() => setShowFormPartido(!showFormPartido)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
                  <Plus size={16}/> Crear partido
                </button>
              </div>
              {showFormPartido && (
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontWeight: '600', color: '#202124', marginBottom: '16px' }}>Nuevo partido</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'end' }}>
                      <div>
                        <label style={labelStyle}>Equipo local *</label>
                        <select value={formPartido.home_team_id} onChange={e => setFormPartido(f => ({ ...f, home_team_id: e.target.value }))} style={inputStyle}>
                          <option value="">Seleccionar...</option>{equipos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: '700', color: '#5f6368', paddingBottom: '8px' }}>VS</div>
                      <div>
                        <label style={labelStyle}>Equipo visitante *</label>
                        <select value={formPartido.away_team_id} onChange={e => setFormPartido(f => ({ ...f, away_team_id: e.target.value }))} style={inputStyle}>
                          <option value="">Seleccionar...</option>{equipos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      {formPartido.home_team_id && formPartido.away_team_id && formPartido.home_team_id !== formPartido.away_team_id && (() => {
                        const yaJugaron = partidos.some(p =>
                          (p.home_team_id === formPartido.home_team_id && p.away_team_id === formPartido.away_team_id) ||
                          (p.home_team_id === formPartido.away_team_id && p.away_team_id === formPartido.home_team_id)
                        )
                        if (!yaJugaron) return null
                        const veces = partidos.filter(p =>
                          (p.home_team_id === formPartido.home_team_id && p.away_team_id === formPartido.away_team_id) ||
                          (p.home_team_id === formPartido.away_team_id && p.away_team_id === formPartido.home_team_id)
                        ).length
                        return (
                          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '-4px' }}>
                            <span style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '600' }}>
                              ⚠️ Estos equipos ya se enfrentaron {veces} vez{veces > 1 ? 'ces' : ''} en este torneo — puedes continuar igual
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>Fecha *</label><input type="date" value={formPartido.played_at} onChange={e => setFormPartido(f => ({ ...f, played_at: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Hora</label><input type="time" value={formPartido.hora} onChange={e => setFormPartido(f => ({ ...f, hora: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Cancha</label><select value={formPartido.location} onChange={e => setFormPartido(f => ({ ...f, location: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option>{canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                      <div><label style={labelStyle}>Jornada #</label><input type="number" value={formPartido.matchday} onChange={e => setFormPartido(f => ({ ...f, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
                      <div><label style={labelStyle}>Fase</label><select value={formPartido.fase} onChange={e => setFormPartido(f => ({ ...f, fase: e.target.value }))} style={inputStyle}>{FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={handleCrearPartido} disabled={loadingPartido} style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}>{loadingPartido ? 'Guardando...' : 'Crear partido'}</button>
                    <button onClick={() => setShowFormPartido(false)} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Lista partidos */}
              {partidosPendientes.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={15} color="#e8710a"/> Pendientes ({partidosPendientes.length})</div>
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    {partidosPendientes.map((p, i) => (
                      <div key={p.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosPendientes.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={32}/></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                              {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>J{p.matchday}</span>}
                              {p.grupo    && <span style={{ fontSize: '.72rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '2px 8px' }}>{p.grupo}</span>}
                              {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                              <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.home?.name} vs {p.away?.name}</span>
                            </div>
                            <div style={{ fontSize: '.75rem', color: '#9aa0a6', display: 'flex', gap: '10px' }}>
                              {p.played_at && <span>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                              {p.location  && <span>📍 {p.location}</span>}
                            </div>
                          </div>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={32}/></div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                          <button onClick={() => { const fecha = p.played_at ? p.played_at.substring(0, 10) : ''; const hora = p.played_at ? p.played_at.substring(11, 16) : ''; setFormEditPartido({ played_at: fecha, hora, location: p.location || '', matchday: p.matchday || '', fase: p.fase || 'grupo' }); setEditandoPartidoForm(p) }} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>✏️</button>
                          <button onClick={() => setPlanillaPartido(p)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}><Check size={13}/> Resultado</button>
                          <button onClick={() => handleEliminarPartido(p.id)} style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}><X size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {partidosJugados.length > 0 && (
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={15} color="#1e8e3e"/> Resultados ({partidosJugados.length})</div>
                  <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    {partidosJugados.map((p, i) => (
                      <div key={p.id} onClick={() => setModalPartidoAdmin(p)} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                        <div style={{ flex: 1 }}>
                          {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px', marginRight: '6px' }}>J{p.matchday}</span>}
                          {p.grupo    && <span style={{ fontSize: '.72rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '2px 8px', marginRight: '6px' }}>{p.grupo}</span>}
                          {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px', marginRight: '6px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                          {p.played_at && <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 2, justifyContent: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.home?.name}</span>
                            <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={22}/></div>
                          </div>
                          <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#202124', background: '#f1f3f4', padding: '4px 16px', borderRadius: '8px' }}>{p.home_score} - {p.away_score}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={22}/></div>
                            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.away?.name}</span>
                          </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={() => setPlanillaPartido(p)} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem' }}>Editar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {partidos.length === 0 && !showFormPartido && (
                <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
                  <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay partidos programados</div>
                </div>
              )}
            </div>
          )}

          {subTab === 'jornada' && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Shuffle size={18} color="#1a73e8"/> Configurar jornada automática</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div><label style={labelStyle}>Número de jornada</label><input type="number" value={configJornada.numero} onChange={e => setConfigJornada(f => ({ ...f, numero: e.target.value }))} style={inputStyle} placeholder={fechas.length + 1}/></div>
                  <div><label style={labelStyle}>Fecha *</label><input type="date" value={configJornada.fecha} onChange={e => setConfigJornada(f => ({ ...f, fecha: e.target.value }))} style={inputStyle}/></div>
                  <div><label style={labelStyle}>Hora inicio *</label><input type="time" value={configJornada.hora_inicio} onChange={e => setConfigJornada(f => ({ ...f, hora_inicio: e.target.value }))} style={inputStyle}/></div>
                </div>
                {grupos.length > 1 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', cursor: 'pointer', fontSize: '.8rem', color: '#5f6368' }}>
                    <input type="checkbox" checked={permitirIntergrupo} onChange={e => setPermitirIntergrupo(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }}/>
                    Permitir partidos intergrupo cuando un equipo ya enfrentó a todos los de su grupo
                  </label>
                )}
                <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '10px' }}>
                  ℹ️ El sorteo evita repetir cruces ya jugados o programados. Si un equipo no tiene rival nuevo, queda descansando.
                </div>
                <button onClick={generarJornada} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
                  <Shuffle size={16}/> Generar jornada aleatoria
                </button>
              </div>
              {jornadaGenerada.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>Jornada {configJornada.numero || fechas.length + 1}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={generarJornada} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}><Shuffle size={14}/> Regenerar</button>
                      <button onClick={handleGuardarJornada} disabled={loadingPartido} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}><Check size={14}/> {loadingPartido ? 'Guardando...' : 'Guardar jornada'}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jornadaGenerada.map((p, i) => {
                      const veces = p.descanso ? 0 : vecesEnfrentados(p.local?.id, p.visitante?.id)
                      return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', borderRadius: '10px', border: veces > 0 ? '1px solid #f9ab00' : '1px solid #e8eaed', background: p.descanso ? '#f8f9fa' : veces > 0 ? '#fffbf0' : '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.descanso ? (
                          <div draggable onDragStart={() => handleDragStart(i, 'local')} onDragOver={e => handleDragOver(e, i, 'local')} onDrop={e => handleDrop(e, i, 'local')} onDragEnd={handleDragEnd}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'local' ? '2px dashed #1a73e8' : '2px solid transparent' }}>
                            <GripVertical size={13} color="#9aa0a6"/>
                            <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.local?.logo_url} name={p.local?.name} size={24}/></div>
                            <span style={{ color: '#9aa0a6', fontSize: '.875rem', fontStyle: 'italic' }}>{p.local?.name} — descansa</span>
                            <span style={{ fontSize: '.65rem', color: '#bdbdbd', marginLeft: 'auto' }}>arrástralo a un partido para ponerlo a jugar</span>
                          </div>
                        ) : (
                          <>
                            <div draggable onDragStart={() => handleDragStart(i, 'local')} onDragOver={e => handleDragOver(e, i, 'local')} onDrop={e => handleDrop(e, i, 'local')} onDragEnd={handleDragEnd}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'local' ? '2px dashed #1a73e8' : '2px solid transparent' }}>
                              <GripVertical size={13} color="#9aa0a6"/>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.local?.logo_url} name={p.local?.name} size={24}/></div>
                              <div><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.local?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Local</div></div>
                            </div>
                            <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.75rem', flexShrink: 0 }}>VS</span>
                            <div draggable onDragStart={() => handleDragStart(i, 'visitante')} onDragOver={e => handleDragOver(e, i, 'visitante')} onDrop={e => handleDrop(e, i, 'visitante')} onDragEnd={handleDragEnd}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '2px dashed #e8710a' : '2px solid transparent' }}>
                              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.visitante?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Visitante</div></div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.visitante?.logo_url} name={p.visitante?.name} size={24}/></div>
                              <GripVertical size={13} color="#9aa0a6"/>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              {p.intergrupo && <span style={{ fontSize: '.65rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>Intergrupo</span>}
                              <span style={{ fontSize: '.72rem', color: '#5f6368' }}>🕐 {p.hora}</span>
                              <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>📍 {p.cancha?.nombre}</span>
                              <button onClick={() => handleEliminarParejaJornada(i)} title="Eliminar partido — ambos equipos pasan a descansar"
                                style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                                <X size={13}/>
                              </button>
                            </div>
                          </>
                        )}
                        </div>
                        {veces > 0 && (
                          <div style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '600', paddingLeft: '10px' }}>
                            ⚠️ Estos equipos ya se enfrentaron {veces} {veces > 1 ? 'veces' : 'vez'} en este torneo — puedes dejarlo igual o arrastrar otro equipo
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB EQUIPOS ── */}
      {tab === 'equipos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={() => setShowAgregarEquipo(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
              <Plus size={16}/> Agregar equipo
            </button>
          </div>
          {equipos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
              <Shield size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay equipos inscritos</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              {equipos.map((e, i) => {
                const jugsEquipo = jugadores.filter(j => j.team_id === e.id)
                const grupoEq    = grupoEquipos.find(ge => ge.team_id === e.id)
                const grupo      = grupoEq ? grupos.find(g => g.id === grupoEq.grupo_id) : null
                return (
                  <div key={e.id} style={{ padding: '16px 20px', borderBottom: i < equipos.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={e.logo_url} name={e.name} size={44}/></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{e.name}</div>
                          {grupo && <span style={{ fontSize: '.7rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '1px 8px', fontWeight: '600' }}>{grupo.nombre}</span>}
                        </div>
                        <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>{jugsEquipo.length} jugadores{e.city && ` · 📍 ${e.city}`}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/admin/equipos/${e.id}`)} style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#1a73e8', fontSize: '.8rem', fontWeight: '500' }}>Ver ficha</button>
                        <button onClick={() => { const link = `${window.location.origin}/registro/equipo/${e.registro_token}/${id}`; navigator.clipboard.writeText(link); showMsg('Link copiado') }} style={{ background: 'none', border: '1px solid #1e8e3e', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#1e8e3e', fontSize: '.8rem' }}>🔗</button>
                        <button onClick={() => handleQuitarEquipo(e)} style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#d93025', fontSize: '.8rem' }}>Quitar</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB ESTADÍSTICAS ── */}
      {tab === 'estadisticas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Tabla general */}
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de posiciones — Fase de grupos</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>EQUIPO</div>{['PJ','PG','PE','PP','GF','GC','PTS'].map(h => <div key={h} style={{ textAlign: 'center' }}>{h}</div>)}
              </div>
              {tablaOrdenada.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>No hay resultados aún</div>
              ) : tablaOrdenada.map((row, i) => (
                <div key={row.equipo.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < tablaOrdenada.length - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '.75rem', fontWeight: '700', color: i < 3 ? '#1a73e8' : '#9aa0a6', width: '20px' }}>{i + 1}</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden' }}><TeamLogo logo_url={row.equipo.logo_url} name={row.equipo.name} size={28}/></div>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{row.equipo.name}</span>
                  </div>
                  {[row.pj, row.pg, row.pe, row.pp, row.gf, row.gc].map((val, j) => (
                    <div key={j} style={{ textAlign: 'center', fontSize: '.875rem', color: '#5f6368' }}>{val}</div>
                  ))}
                  <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '.9rem', color: '#1a73e8' }}>{row.pts}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Goleadores */}
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de goleadores</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 60px 60px 60px 60px 60px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>#</div><div>JUGADOR</div><div>EQUIPO</div>
                <div style={{ textAlign: 'center' }}>PJ</div><div style={{ textAlign: 'center', color: '#1a73e8' }}>⚽</div>
                <div style={{ textAlign: 'center', color: '#f9a825' }}>🟨</div><div style={{ textAlign: 'center', color: '#4488ff' }}>🟦</div><div style={{ textAlign: 'center', color: '#d93025' }}>🟥</div>
              </div>
              {loadingStats ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Cargando...</div>
              ) : goleadores.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>No hay estadísticas aún.</div>
              ) : goleadores.map((g, i) => (
                <div key={`${g.player_id}-${g.team_id}`} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 60px 60px 60px 60px 60px', padding: '11px 16px', borderBottom: i < goleadores.length - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: '700', color: i === 0 ? '#f9a825' : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : '#9aa0a6' }}>{i + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {g.photo_url ? <img src={g.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>👤</span>}
                    </div>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{g.player_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={g.team_logo} name={g.team_name} size={20}/></div>
                    <span style={{ fontSize: '.8rem', color: '#5f6368' }}>{g.team_name}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '.875rem', color: '#5f6368' }}>{g.partidos_jugados}</div>
                  <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '1rem', color: '#1a73e8' }}>{g.total_goals}</div>
                  <div style={{ textAlign: 'center', fontSize: '.875rem', color: g.total_yellow > 0 ? '#f9a825' : '#dadce0', fontWeight: g.total_yellow > 0 ? '700' : '400' }}>{g.total_yellow || '—'}</div>
                  <div style={{ textAlign: 'center', fontSize: '.875rem', color: g.total_blue > 0 ? '#4488ff' : '#dadce0', fontWeight: g.total_blue > 0 ? '700' : '400' }}>{g.total_blue || '—'}</div>
                  <div style={{ textAlign: 'center', fontSize: '.875rem', color: g.total_red > 0 ? '#d93025' : '#dadce0', fontWeight: g.total_red > 0 ? '700' : '400' }}>{g.total_red || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Valla menos vencida */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>🧤 Valla menos vencida</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setModoValla('opcion1')}
                  style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${modoValla==='opcion1'?'#1a73e8':'#dadce0'}`, background: modoValla==='opcion1'?'#1a73e8':'#fff', color: modoValla==='opcion1'?'#fff':'#5f6368', fontSize: '.72rem', fontWeight: '600', cursor: 'pointer' }}>
                  Promedio (PJ/GC)
                </button>
                <button onClick={() => setModoValla('opcion2')}
                  style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${modoValla==='opcion2'?'#1a73e8':'#dadce0'}`, background: modoValla==='opcion2'?'#1a73e8':'#fff', color: modoValla==='opcion2'?'#fff':'#5f6368', fontSize: '.72rem', fontWeight: '600', cursor: 'pointer' }}>
                  Menos recibidos
                </button>
              </div>
            </div>
            <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginBottom: '8px' }}>
              {modoValla === 'opcion1'
                ? '📊 Promedio de goles recibidos por partido — equipos clasificados a eliminatoria'
                : '🏆 Arqueros finalistas y tercer/cuarto puesto — total goles recibidos'}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 60px 60px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>#</div><div>ARQUERO</div><div>EQUIPO</div>
                <div style={{ textAlign: 'center' }}>PJ</div>
                <div style={{ textAlign: 'center', color: '#1e8e3e' }}>{modoValla==='opcion1'?'PROM':'GC'}</div>
              </div>
              {(modoValla === 'opcion1' ? vallas.opcion1 : vallas.opcion2).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Sin datos de arqueros aún</div>
              ) : (modoValla === 'opcion1' ? vallas.opcion1 : vallas.opcion2).map((p, i) => (
                <div key={p.player_id} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 60px 60px', padding: '11px 16px', borderBottom: i < (modoValla==='opcion1'?vallas.opcion1:vallas.opcion2).length-1?'1px solid #f1f3f4':'none', alignItems: 'center' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: '700', color: i===0?'#f9a825':i===1?'#9aa0a6':i===2?'#cd7f32':'#9aa0a6' }}>{i+1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f3f4', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {p.foto ? <img src={p.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>🧤</span>}
                    </div>
                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {p.team_logo && <div style={{ width:'20px', height:'20px', borderRadius:'4px', overflow:'hidden' }}><img src={p.team_logo} style={{ width:'100%', height:'100%', objectFit:'contain' }}/></div>}
                    <span style={{ fontSize: '.8rem', color: '#5f6368' }}>{p.team_name}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '.875rem', color: '#5f6368' }}>{p.pj}</div>
                  <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '1rem', color: '#1e8e3e' }}>
                    {modoValla==='opcion1' ? p.promedio : p.total_recibidos}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB ELIMINATORIAS ── */}
      {tab === 'eliminatorias' && (
        <div>
          {/* Configuración */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>⚡ Configurar eliminatorias</div>

            {/* Clasificados */}
            {grupos.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', marginBottom: '8px' }}>Clasificados de grupos</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {getClasificados().map((eq, i) => (
                    <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f3f4', borderRadius: '20px', padding: '4px 10px 4px 4px' }}>
                      <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#fff', background: '#1a73e8', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden' }}><TeamLogo logo_url={eq.logo_url} name={eq.name} size={18}/></div>
                      <span style={{ fontSize: '.75rem', color: '#202124', fontWeight: '500' }}>{eq.name}</span>
                      <span style={{ fontSize: '.65rem', color: '#9aa0a6' }}>{eq.grupo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Tipo de emparejamiento</label>
                <select value={tipoSorteo} onChange={e => setTipoSorteo(e.target.value)} style={inputStyle}>
                  <option value="tabla">Por tabla (1° vs último...)</option>
                  <option value="sorteo">Sorteo aleatorio</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Formato</label>
                <select value={idaVuelta ? 'ida_vuelta' : 'directa'} onChange={e => setIdaVuelta(e.target.value === 'ida_vuelta')} style={inputStyle}>
                  <option value="directa">Eliminación directa</option>
                  <option value="ida_vuelta">Ida y vuelta</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Fecha partidos</label>
                <input type="date" value={fechaElim} onChange={e => setFechaElim(e.target.value)} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Hora inicio</label>
                <input type="time" value={horaElim} onChange={e => setHoraElim(e.target.value)} style={inputStyle}/>
              </div>
            </div>

            <button onClick={handleGenerarEliminatorias} disabled={generandoElim || !fechaElim}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 20px', background: !fechaElim || generandoElim ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '8px', cursor: !fechaElim || generandoElim ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600' }}>
              <GitBranch size={16}/> {generandoElim ? 'Generando...' : 'Generar bracket de eliminatorias'}
            </button>
          </div>

          {/* Bracket */}
          {bracket.length > 0 && (
            <div>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>🏆 Bracket de eliminatorias</div>
              {(() => {
                const rondas = [...new Set(bracket.map(p => p.ronda))].filter(Boolean)
                return rondas.map(ronda => (
                  <div key={ronda} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ height: '2px', width: '20px', background: '#e8710a', borderRadius: '2px' }}/>
                      <span style={{ fontSize: '.72rem', fontWeight: '800', color: '#e8710a', letterSpacing: '2px' }}>{ronda.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '10px' }}>
                      {bracket.filter(p => p.ronda === ronda).map(p => {
                        const jugado = p.status === 'finished'
                        const ganadorLocal = jugado && p.home_score > p.away_score
                        const ganadorVis   = jugado && p.away_score > p.home_score
                        return (
                          <div key={p.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                            {/* Local */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: ganadorLocal ? '#e6f4ea' : '#fff', borderBottom: '1px solid #f1f3f4' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={28}/></div>
                              <span style={{ flex: 1, fontWeight: ganadorLocal ? '700' : '500', color: '#202124', fontSize: '.875rem' }}>{p.home?.name}</span>
                              {jugado && <span style={{ fontWeight: '900', fontSize: '1.2rem', color: ganadorLocal ? '#1e8e3e' : '#9aa0a6' }}>{p.home_score}</span>}
                              {ganadorLocal && <span style={{ fontSize: '.8rem' }}>✓</span>}
                            </div>
                            {/* Visitante */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: ganadorVis ? '#e6f4ea' : '#fff' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={28}/></div>
                              <span style={{ flex: 1, fontWeight: ganadorVis ? '700' : '500', color: '#202124', fontSize: '.875rem' }}>{p.away?.name}</span>
                              {jugado && <span style={{ fontWeight: '900', fontSize: '1.2rem', color: ganadorVis ? '#1e8e3e' : '#9aa0a6' }}>{p.away_score}</span>}
                              {ganadorVis && <span style={{ fontSize: '.8rem' }}>✓</span>}
                            </div>
                            {/* Footer */}
                            <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa' }}>
                              <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>
                                {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                                {p.location && ` · 📍 ${p.location}`}
                              </span>
                              {!jugado && (
                                <button onClick={() => setPlanillaPartido(p)}
                                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: '#1a73e8', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '600' }}>
                                  <Check size={12}/> Resultado
                                </button>
                              )}
                              {jugado && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>✓ Jugado</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          {bracket.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
              <GitBranch size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
              <div>Genera el bracket de eliminatorias arriba</div>
              <div style={{ fontSize: '.78rem', marginTop: '4px' }}>Primero finaliza la fase de grupos en el tab Grupos</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
