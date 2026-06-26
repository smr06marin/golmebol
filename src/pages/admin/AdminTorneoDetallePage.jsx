import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PlanillaPartido from '../../components/PlanillaPartido'
import { ArrowLeft, Trophy, Calendar, BarChart2, Shield, Clock, MapPin, Check, X, Plus, Shuffle, GripVertical, Camera } from 'lucide-react'

const TABS = [
  { id: 'actividad',    label: 'Actividad',    icon: <Trophy size={16}/> },
  { id: 'calendario',   label: 'Calendario',   icon: <Calendar size={16}/> },
  { id: 'equipos',      label: 'Equipos',      icon: <Shield size={16}/> },
  { id: 'estadisticas', label: 'Estadísticas', icon: <BarChart2 size={16}/> },
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

  const [goleadores,   setGoleadores]   = useState([])
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
  const [drag,            setDrag]            = useState(null)
  const [dragOver,        setDragOver]        = useState(null)
  const [loadingPartido,  setLoadingPartido]  = useState(false)

  // Agregar equipo al torneo
  const [showAgregarEquipo,  setShowAgregarEquipo]  = useState(false)
  const [busquedaEquipo,     setBusquedaEquipo]     = useState('')
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [loadingEquipos,     setLoadingEquipos]     = useState(false)

  useEffect(() => { fetchTodo() }, [id])
  useEffect(() => { if (tab === 'estadisticas') fetchGoleadores() }, [tab])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    await Promise.all([fetchTorneo(), fetchEquipos(), fetchPartidos(), fetchJugadores(), fetchCanchas(), fetchFechas()])
    setLoading(false)
  }

  async function fetchTorneo() {
    const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTorneo(data)
  }

  async function fetchEquipos() {
    const { data } = await supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', id)
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
    setLoadingStats(false)
  }

  async function handleAgregarCancha() {
    if (!nuevaCancha.trim()) return
    const { data, error } = await supabase.from('canchas').insert({ tournament_id: id, nombre: nuevaCancha.trim() }).select().single()
    if (error) return showMsg('Error al agregar cancha', 'error')
    setCanchas(prev => [...prev, data])
    setNuevaCancha('')
    showMsg('Cancha agregada ✓')
  }

  async function handleEliminarCancha(cancha) {
    if (!confirm(`¿Eliminar cancha "${cancha.nombre}"?`)) return
    await supabase.from('canchas').delete().eq('id', cancha.id)
    setCanchas(prev => prev.filter(x => x.id !== cancha.id))
    showMsg('Cancha eliminada')
  }

  async function handleCrearPartido() {
    if (!formPartido.home_team_id || !formPartido.away_team_id) return showMsg('Selecciona los dos equipos', 'error')
    if (formPartido.home_team_id === formPartido.away_team_id) return showMsg('Los equipos no pueden ser iguales', 'error')
    if (!formPartido.played_at) return showMsg('La fecha es obligatoria', 'error')
    const yaJugaron = partidos.some(p =>
      (p.home_team_id === formPartido.home_team_id && p.away_team_id === formPartido.away_team_id) ||
      (p.home_team_id === formPartido.away_team_id && p.away_team_id === formPartido.home_team_id)
    )
    if (yaJugaron) {
      const equipoLocal     = equipos.find(e => e.id === formPartido.home_team_id)?.name || ''
      const equipoVisitante = equipos.find(e => e.id === formPartido.away_team_id)?.name || ''
      const confirmar = window.confirm(`⚠️ ${equipoLocal} y ${equipoVisitante} ya se enfrentaron en este torneo.\n\n¿Deseas programar otro partido entre ellos?`)
      if (!confirmar) return
    }
    setLoadingPartido(true)
    const { error } = await supabase.from('matches').insert({
      tournament_id: id,
      home_team_id:  formPartido.home_team_id,
      away_team_id:  formPartido.away_team_id,
      played_at:     formPartido.played_at + (formPartido.hora ? 'T' + formPartido.hora : 'T00:00:00'),
      location:      formPartido.location || null,
      matchday:      formPartido.matchday ? parseInt(formPartido.matchday) : null,
      fase:          formPartido.fase || 'grupo',
      status:        'scheduled',
    })
    if (error) showMsg('Error al crear partido', 'error')
    else {
      showMsg('Partido creado ✓')
      setShowFormPartido(false)
      setFormPartido({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '', fase: 'grupo' })
      fetchPartidos()
    }
    setLoadingPartido(false)
  }

  async function handleEliminarPartido(pid) {
    if (!confirm('¿Eliminar partido?')) return
    await supabase.from('matches').delete().eq('id', pid)
    fetchPartidos()
    showMsg('Partido eliminado')
  }

  async function handleGuardarResultado() {
    if (scoreHome === '' || scoreAway === '') return showMsg('Ingresa el marcador', 'error')
    setGuardando(true)
    const local     = parseInt(scoreHome)
    const visitante = parseInt(scoreAway)
    const ganador   = local > visitante ? 'home' : local < visitante ? 'away' : 'draw'
    const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', editandoPartido.id)
    if (error) { showMsg('Error al guardar', 'error'); setGuardando(false); return }
    const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', editandoPartido.id).eq('resuelta', false)
    if (preds && preds.length > 0) {
      for (const pred of preds) {
        let pts = 0
        if (pred.ganador === ganador)                               pts += ganador === 'draw' ? 5 : 3
        if (pred.goles_home === local)                              pts += 3
        if (pred.goles_away === visitante)                          pts += 3
        if (pred.goles_home === local && pred.goles_away === visitante) pts += 10
        await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
      }
    }
    showMsg('Resultado guardado y predicciones resueltas ✓')
    setEditandoPartido(null); setScoreHome(''); setScoreAway(''); fetchPartidos()
    setGuardando(false)
  }

  async function handleGuardarTorneo() {
    const { error } = await supabase.from('tournaments').update(formTorneo).eq('id', id)
    if (error) { showMsg('Error al actualizar torneo', 'error'); return }
    setTorneo(p => ({ ...p, ...formTorneo }))
    setEditandoTorneo(false)
    showMsg('Torneo actualizado ✓')
  }

  async function handleGuardarEditPartido() {
    if (!formEditPartido.played_at || !formEditPartido.hora) return showMsg('Fecha y hora son obligatorias', 'error')
    const { error } = await supabase.from('matches').update({
      played_at: new Date(formEditPartido.played_at + 'T' + formEditPartido.hora + ':00').toISOString(),
      location:  formEditPartido.location || null,
      matchday:  formEditPartido.matchday ? parseInt(formEditPartido.matchday) : null,
      fase:      formEditPartido.fase || 'grupo',
    }).eq('id', editandoPartidoForm.id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Partido actualizado ✓'); setEditandoPartidoForm(null); fetchPartidos() }
  }

  function generarJornada() {
    if (!configJornada.fecha) return showMsg('Selecciona la fecha', 'error')
    if (!configJornada.hora_inicio) return showMsg('Ingresa la hora de inicio', 'error')
    if (canchas.length === 0) return showMsg('Agrega al menos una cancha', 'error')
    if (equipos.length < 2) return showMsg('Necesitas al menos 2 equipos', 'error')
    const eq = [...equipos].sort(() => Math.random() - 0.5)
    const pares = []
    for (let i = 0; i < eq.length - 1; i += 2) pares.push({ local: eq[i], visitante: eq[i + 1] })
    if (eq.length % 2 !== 0) pares.push({ local: eq[eq.length - 1], visitante: null, descanso: true })
    const [hIni] = configJornada.hora_inicio.split(':').map(Number)
    setJornadaGenerada(pares.map((p, i) => ({ ...p, cancha: canchas[i % canchas.length], hora: `${String(hIni + Math.floor(i / canchas.length)).padStart(2, '0')}:00` })))
  }

  async function handleGuardarJornada() {
    if (jornadaGenerada.length === 0) return
    setLoadingPartido(true)
    const { data: fechaData, error: fechaErr } = await supabase.from('fechas').insert({
      tournament_id: id,
      numero: parseInt(configJornada.numero) || (fechas.length + 1),
      nombre: `Jornada ${configJornada.numero || fechas.length + 1}`,
      fecha_inicio: configJornada.fecha,
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
    const dest = tslot === 'local' ? nueva[tpi].local : nueva[tpi].visitante
    if (tslot === 'local') nueva[tpi].local = drag.equipo; else nueva[tpi].visitante = drag.equipo
    if (drag.slot === 'local') nueva[drag.pi].local = dest; else nueva[drag.pi].visitante = dest
    setJornadaGenerada(nueva); setDrag(null); setDragOver(null)
  }
  function handleDragEnd() { setDrag(null); setDragOver(null) }

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
    showMsg(`${equipo.name} agregado al torneo ✓`)
    setShowAgregarEquipo(false)
    setBusquedaEquipo('')
    setEquiposDisponibles([])
    fetchEquipos()
  }

  async function handleQuitarEquipo(equipo) {
    if (!confirm(`¿Quitar a ${equipo.name} del torneo?`)) return
    await supabase.from('tournament_teams').delete().eq('tournament_id', id).eq('team_id', equipo.id)
    showMsg(`${equipo.name} quitado del torneo`)
    fetchEquipos()
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
  if (!torneo)  return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Torneo no encontrado</div>

  const partidosJugados    = partidos.filter(p => p.status === 'finished')
  const partidosPendientes = partidos.filter(p => p.status !== 'finished')

  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidosJugados.filter(p => !p.fase || p.fase === 'grupo').forEach(p => {
    if (tabla[p.home_team_id]) {
      tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
      if (p.home_score > p.away_score) { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3 }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += 1 }
      else tabla[p.home_team_id].pp++
    }
    if (tabla[p.away_team_id]) {
      tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
      if (p.away_score > p.home_score) { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3 }
      else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += 1 }
      else tabla[p.away_team_id].pp++
    }
  })
  const tablaOrdenada = Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))

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
              showMsg('Resultado guardado y predicciones resueltas ✓')
              setPlanillaPartido(null)
              fetchPartidos()
            }
          }}
        />
      )}

      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Modal resultado manual */}
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
              <button onClick={() => { setEditandoPartido(null); setScoreHome(''); setScoreAway('') }} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}>
                <X size={16}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar torneo */}
      {editandoTorneo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>Editar torneo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[{ label: 'Nombre', key: 'name' }, { label: 'Ciudad', key: 'city' }, { label: 'Temporada', key: 'season' }, { label: 'Categoría', key: 'categoria' }].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={formTorneo[f.key] || ''} onChange={e => setFormTorneo(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}/>
                </div>
              ))}
              <div>
                <label style={labelStyle}>Modalidad</label>
                <select value={formTorneo.modalidad || ''} onChange={e => setFormTorneo(p => ({ ...p, modalidad: e.target.value }))} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  <option>Fútbol 5</option><option>Fútbol 7</option><option>Fútbol 11</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Género</label>
                <select value={formTorneo.genero || ''} onChange={e => setFormTorneo(p => ({ ...p, genero: e.target.value }))} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  <option>Masculino</option><option>Femenino</option><option>Mixto</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleGuardarTorneo} style={{ flex: 1, padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>Guardar</button>
              <button onClick={() => setEditandoTorneo(false)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar partido */}
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
              <div>
                <label style={labelStyle}>Cancha</label>
                <select value={formEditPartido.location || ''} onChange={e => setFormEditPartido(p => ({ ...p, location: e.target.value }))} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Jornada #</label><input type="number" value={formEditPartido.matchday || ''} onChange={e => setFormEditPartido(p => ({ ...p, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
              <div>
                <label style={labelStyle}>Fase</label>
                <select value={formEditPartido.fase || 'grupo'} onChange={e => setFormEditPartido(p => ({ ...p, fase: e.target.value }))} style={inputStyle}>
                  {FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleGuardarEditPartido} style={{ flex: 1, padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>Guardar cambios</button>
              <button onClick={() => setEditandoPartidoForm(null)} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}><X size={16}/></button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar equipo */}
      {showAgregarEquipo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '440px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Agregar equipo al torneo</div>
              <button onClick={() => { setShowAgregarEquipo(false); setBusquedaEquipo(''); setEquiposDisponibles([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
            </div>
            <input value={busquedaEquipo} onChange={e => buscarEquipos(e.target.value)} placeholder="Buscar equipo por nombre..." style={{ ...inputStyle, marginBottom: '12px' }} autoFocus/>
            {loadingEquipos && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem', padding: '12px' }}>Buscando...</div>}
            {!loadingEquipos && busquedaEquipo && equiposDisponibles.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem', padding: '12px' }}>No se encontraron equipos disponibles</div>
            )}
            {equiposDisponibles.length > 0 && (
              <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'hidden' }}>
                {equiposDisponibles.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < equiposDisponibles.length - 1 ? '1px solid #f1f3f4' : 'none', background: '#fff' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={e.logo_url} name={e.name} size={36}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{e.name}</div>
                      {e.city && <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>📍 {e.city}</div>}
                    </div>
                    <button onClick={() => handleAgregarEquipo(e)} style={{ padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                      + Agregar
                    </button>
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

      {/* Header */}
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
                const ext = file.name.split('.').pop()
                const path = `logos/${id}.${ext}`
                await supabase.storage.from('tournaments').upload(path, file, { upsert: true })
                const { data: urlData } = supabase.storage.from('tournaments').getPublicUrl(path)
                await supabase.from('tournaments').update({ logo_url: urlData.publicUrl }).eq('id', id)
                setTorneo(prev => ({ ...prev, logo_url: urlData.publicUrl }))
              }}/>
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: '0 0 6px' }}>{torneo.name}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {torneo.season    && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📅 {torneo.season}</span>}
              {torneo.city      && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📍 {torneo.city}</span>}
              {torneo.modalidad && <span style={{ fontSize: '.8rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 10px' }}>{torneo.modalidad}</span>}
              {torneo.genero    && <span style={{ fontSize: '.8rem', color: '#6c35de', background: '#f3e8fd', borderRadius: '10px', padding: '2px 10px' }}>{torneo.genero}</span>}
              {torneo.categoria && <span style={{ fontSize: '.8rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '10px', padding: '2px 10px' }}>{torneo.categoria}</span>}
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
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '4px', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', transition: 'all .15s', background: tab === t.id ? '#1a73e8' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ACTIVIDAD */}
      {tab === 'actividad' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', marginBottom: '16px', fontSize: '.9rem' }}>✅ Actividad del torneo</div>
            {[
              { label: 'Registrar Equipos',  done: equipos.length > 0 },
              { label: 'Agregar Canchas',     done: canchas.length > 0 },
              { label: 'Crear Partidos',      done: partidos.length > 0 },
              { label: 'Ingresar Resultados', done: partidosJugados.length > 0 },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < 3 ? '1px solid #f1f3f4' : 'none' }}>
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
              { label: 'Equipos inscritos', value: equipos.length,        color: '#1a73e8', bg: '#e8f0fe' },
              { label: 'Jugadores totales', value: jugadores.length,       color: '#6c35de', bg: '#f3e8fd' },
              { label: 'Partidos creados',  value: partidos.length,        color: '#e8710a', bg: '#fce8d9' },
              { label: 'Partidos jugados',  value: partidosJugados.length, color: '#1e8e3e', bg: '#e6f4ea' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <span style={{ fontSize: '.875rem', color: '#5f6368', fontWeight: '500' }}>{s.label}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: '700', color: s.color, background: s.bg, borderRadius: '8px', padding: '2px 14px' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CALENDARIO */}
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
            <button onClick={() => setSubTab('partidos')} style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === 'partidos' ? '#1a73e8' : '#fff', color: subTab === 'partidos' ? '#fff' : '#5f6368', border: subTab === 'partidos' ? 'none' : '1px solid #dadce0' }}>
              Crear Partido
            </button>
            <button onClick={() => setSubTab('jornada')} style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === 'jornada' ? '#1a73e8' : '#fff', color: subTab === 'jornada' ? '#fff' : '#5f6368', border: subTab === 'jornada' ? 'none' : '1px solid #dadce0' }}>
              Jornada Automática
            </button>
          </div>

          {subTab === 'partidos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button onClick={() => setShowFormPartido(!showFormPartido)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
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
                          <option value="">Seleccionar...</option>
                          {equipos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: '700', color: '#5f6368', paddingBottom: '8px' }}>VS</div>
                      <div>
                        <label style={labelStyle}>Equipo visitante *</label>
                        <select value={formPartido.away_team_id} onChange={e => setFormPartido(f => ({ ...f, away_team_id: e.target.value }))} style={inputStyle}>
                          <option value="">Seleccionar...</option>
                          {equipos.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>Fecha *</label><input type="date" value={formPartido.played_at} onChange={e => setFormPartido(f => ({ ...f, played_at: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Hora</label><input type="time" value={formPartido.hora} onChange={e => setFormPartido(f => ({ ...f, hora: e.target.value }))} style={inputStyle}/></div>
                      <div>
                        <label style={labelStyle}>Cancha</label>
                        <select value={formPartido.location} onChange={e => setFormPartido(f => ({ ...f, location: e.target.value }))} style={inputStyle}>
                          <option value="">Seleccionar...</option>
                          {canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div><label style={labelStyle}>Jornada #</label><input type="number" value={formPartido.matchday} onChange={e => setFormPartido(f => ({ ...f, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
                      <div>
                        <label style={labelStyle}>Fase</label>
                        <select value={formPartido.fase} onChange={e => setFormPartido(f => ({ ...f, fase: e.target.value }))} style={inputStyle}>
                          {FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={handleCrearPartido} disabled={loadingPartido} style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}>
                      {loadingPartido ? 'Guardando...' : 'Crear partido'}
                    </button>
                    <button onClick={() => setShowFormPartido(false)} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>Cancelar</button>
                  </div>
                </div>
              )}

              <div>
                {partidosPendientes.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} color="#e8710a"/> Pendientes ({partidosPendientes.length})
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      {partidosPendientes.map((p, i) => (
                        <div key={p.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosPendientes.length - 1 ? '1px solid #f1f3f4' : 'none', background: p.fase && p.fase !== 'grupo' ? '#fff8f0' : '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                              <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={32}/>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>J{p.matchday}</span>}
                                {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                                <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.home?.name} vs {p.away?.name}</span>
                              </div>
                              <div style={{ fontSize: '.75rem', color: '#9aa0a6', display: 'flex', gap: '10px' }}>
                                {p.played_at && <span>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                                {p.location && <span>📍 {p.location}</span>}
                              </div>
                            </div>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                              <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={32}/>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                            <button onClick={() => {
                              const fecha = p.played_at ? p.played_at.substring(0, 10) : ''
                              const hora  = p.played_at ? p.played_at.substring(11, 16) : ''
                              setFormEditPartido({ played_at: fecha, hora, location: p.location || '', matchday: p.matchday || '', fase: p.fase || 'grupo' })
                              setEditandoPartidoForm(p)
                            }} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>✏️</button>
                            <button onClick={() => setPlanillaPartido(p)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                              <Check size={13}/> Resultado
                            </button>
                            <button onClick={() => handleEliminarPartido(p.id)} style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                              <X size={14}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {partidosJugados.length > 0 && (
                  <div>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Check size={15} color="#1e8e3e"/> Resultados ({partidosJugados.length})
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      {partidosJugados.map((p, i) => (
                        <div key={p.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none', background: p.fase && p.fase !== 'grupo' ? '#fff8f0' : '#fff' }}>
                          <div style={{ flex: 1 }}>
                            {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px', marginRight: '6px' }}>J{p.matchday}</span>}
                            {p.fase && p.fase !== 'grupo' && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px', marginRight: '6px', fontWeight: '700' }}>{FASE_LABEL[p.fase]}</span>}
                            {p.played_at && <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 2, justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                              <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.home?.name}</span>
                              <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                                <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={22}/>
                              </div>
                            </div>
                            <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#202124', background: '#f1f3f4', padding: '4px 16px', borderRadius: '8px' }}>{p.home_score} - {p.away_score}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                                <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={22}/>
                              </div>
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
                    <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
                    <div>No hay partidos programados</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'jornada' && (
            <div>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shuffle size={18} color="#1a73e8"/> Configurar jornada automática
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                  <div><label style={labelStyle}>Número de jornada</label><input type="number" value={configJornada.numero} onChange={e => setConfigJornada(f => ({ ...f, numero: e.target.value }))} style={inputStyle} placeholder={fechas.length + 1}/></div>
                  <div><label style={labelStyle}>Fecha *</label><input type="date" value={configJornada.fecha} onChange={e => setConfigJornada(f => ({ ...f, fecha: e.target.value }))} style={inputStyle}/></div>
                  <div><label style={labelStyle}>Hora inicio *</label><input type="time" value={configJornada.hora_inicio} onChange={e => setConfigJornada(f => ({ ...f, hora_inicio: e.target.value }))} style={inputStyle}/></div>
                </div>
                <button onClick={generarJornada} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
                  <Shuffle size={16}/> Generar jornada aleatoria
                </button>
              </div>

              {jornadaGenerada.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>
                      Jornada {configJornada.numero || fechas.length + 1} — {configJornada.fecha && new Date(configJornada.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={generarJornada} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
                        <Shuffle size={14}/> Regenerar
                      </button>
                      <button onClick={handleGuardarJornada} disabled={loadingPartido} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}>
                        <Check size={14}/> {loadingPartido ? 'Guardando...' : 'Guardar jornada'}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginBottom: '12px', background: '#f8f9fa', padding: '8px 12px', borderRadius: '8px' }}>
                    💡 Arrastra cualquier equipo a otro slot para intercambiarlos
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jornadaGenerada.map((p, i) => (
                      <div key={i} onDragOver={e => e.preventDefault()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8eaed', background: p.descanso ? '#f8f9fa' : '#fff' }}>
                        {p.descanso ? (
                          <div style={{ flex: 1, color: '#9aa0a6', fontSize: '.875rem', fontStyle: 'italic' }}>{p.local?.name} — descansa</div>
                        ) : (
                          <>
                            <div draggable onDragStart={() => handleDragStart(i, 'local')} onDragOver={e => handleDragOver(e, i, 'local')} onDrop={e => handleDrop(e, i, 'local')} onDragEnd={handleDragEnd}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'local' ? '2px dashed #1a73e8' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'local' ? '#e8f0fe' : drag?.pi === i && drag?.slot === 'local' ? '#f1f3f4' : 'transparent', opacity: drag?.pi === i && drag?.slot === 'local' ? .5 : 1, transition: 'all .15s' }}>
                              <GripVertical size={13} color="#9aa0a6"/>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                                <TeamLogo logo_url={p.local?.logo_url} name={p.local?.name} size={24}/>
                              </div>
                              <div><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.local?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Local</div></div>
                            </div>
                            <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.75rem', flexShrink: 0 }}>VS</span>
                            <div draggable onDragStart={() => handleDragStart(i, 'visitante')} onDragOver={e => handleDragOver(e, i, 'visitante')} onDrop={e => handleDrop(e, i, 'visitante')} onDragEnd={handleDragEnd}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '2px dashed #e8710a' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '#fce8d9' : drag?.pi === i && drag?.slot === 'visitante' ? '#f1f3f4' : 'transparent', opacity: drag?.pi === i && drag?.slot === 'visitante' ? .5 : 1, transition: 'all .15s' }}>
                              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.visitante?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Visitante</div></div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}>
                                <TeamLogo logo_url={p.visitante?.logo_url} name={p.visitante?.name} size={24}/>
                              </div>
                              <GripVertical size={13} color="#9aa0a6"/>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '.72rem', color: '#5f6368' }}>🕐 {p.hora}</span>
                              <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>📍 {p.cancha?.nombre}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EQUIPOS */}
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
                return (
                  <div key={e.id} style={{ padding: '16px 20px', borderBottom: i < equipos.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
                        <TeamLogo logo_url={e.logo_url} name={e.name} size={44}/>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{e.name}</div>
                        <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>{jugsEquipo.length} jugadores inscritos{e.city && ` · 📍 ${e.city}`}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {jugsEquipo.map(j => (
                            <span key={j.id} style={{ fontSize: '.72rem', color: '#202124', background: '#f1f3f4', borderRadius: '20px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {j.players?.photo_url && <img src={j.players.photo_url} style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }}/>}
                              {j.players?.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => navigate(`/admin/equipos/${e.id}`)} style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#1a73e8', fontSize: '.8rem', fontWeight: '500' }}>
                          Ver ficha
                        </button>
                        <button onClick={() => handleQuitarEquipo(e)} style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#d93025', fontSize: '.8rem' }}>
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ESTADÍSTICAS */}
      {tab === 'estadisticas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de posiciones — Fase de grupos</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>EQUIPO</div>
                {['PJ','PG','PE','PP','GF','GC','PTS'].map(h => <div key={h} style={{ textAlign: 'center' }}>{h}</div>)}
              </div>
              {tablaOrdenada.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>No hay resultados aún</div>
              ) : tablaOrdenada.map((row, i) => (
                <div key={row.equipo.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < tablaOrdenada.length - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '.75rem', fontWeight: '700', color: i < 3 ? '#1a73e8' : '#9aa0a6', width: '20px' }}>{i + 1}</span>
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden' }}>
                      <TeamLogo logo_url={row.equipo.logo_url} name={row.equipo.name} size={28}/>
                    </div>
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

          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de goleadores</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 60px 60px 60px 60px 60px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>#</div><div>JUGADOR</div><div>EQUIPO</div>
                <div style={{ textAlign: 'center' }}>PJ</div>
                <div style={{ textAlign: 'center', color: '#1a73e8' }}>⚽</div>
                <div style={{ textAlign: 'center', color: '#f9a825' }}>🟨</div>
                <div style={{ textAlign: 'center', color: '#4488ff' }}>🟦</div>
                <div style={{ textAlign: 'center', color: '#d93025' }}>🟥</div>
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
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={g.team_logo} name={g.team_name} size={20}/>
                    </div>
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

          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Valla menos vencida</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 80px 80px 100px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
                <div>#</div><div>EQUIPO</div>
                <div style={{ textAlign: 'center' }}>PJ</div>
                <div style={{ textAlign: 'center' }}>GC</div>
                <div style={{ textAlign: 'center', color: '#1e8e3e' }}>PROMEDIO</div>
              </div>
              {tablaOrdenada.filter(r => r.pj > 0).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>No hay resultados aún</div>
              ) : (() => {
                const colPos = torneo?.modalidad === 'Fútbol 5' ? 'posicion_futbol5' : torneo?.modalidad === 'Fútbol 7' ? 'posicion_futbol7' : 'posicion_futbol11'
                return [...tablaOrdenada].filter(r => r.pj > 0).sort((a, b) => (a.gc / a.pj) - (b.gc / b.pj)).map((row, i) => {
                  const promedio = (row.gc / row.pj).toFixed(2)
                  const esMejor = i === 0
                  const total   = tablaOrdenada.filter(r => r.pj > 0).length
                  const arqueros = jugadores.filter(j => j.team_id === row.equipo.id && j.players?.[colPos] === 'Portero').map(j => j.players)
                  return (
                    <div key={row.equipo.id} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 80px 80px 100px', padding: '12px 16px', borderBottom: i < total - 1 ? '1px solid #f1f3f4' : 'none', alignItems: 'center', background: esMejor ? '#f0faf4' : '#fff' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: i === 0 ? '#1e8e3e' : i === 1 ? '#9aa0a6' : i === 2 ? '#cd7f32' : '#9aa0a6' }}>{i + 1}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                            <TeamLogo logo_url={row.equipo.logo_url} name={row.equipo.name} size={28}/>
                          </div>
                          <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{row.equipo.name}</span>
                          {esMejor && <span style={{ fontSize: '.7rem', background: '#e6f4ea', color: '#1e8e3e', borderRadius: '10px', padding: '1px 8px', fontWeight: '600' }}>🧤 Mejor valla</span>}
                        </div>
                        {arqueros.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '38px' }}>
                            {arqueros.map(a => (
                              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f1f3f4', borderRadius: '20px', padding: '2px 8px 2px 2px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e8eaed', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {a.photo_url ? <img src={a.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '8px', color: '#9aa0a6' }}>🧤</span>}
                                </div>
                                <span style={{ fontSize: '.72rem', color: '#5f6368', fontWeight: '500' }}>{a.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '.875rem', color: '#5f6368' }}>{row.pj}</div>
                      <div style={{ textAlign: 'center', fontSize: '.875rem', color: '#5f6368' }}>{row.gc}</div>
                      <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '.95rem', color: esMejor ? '#1e8e3e' : '#202124' }}>
                        {promedio}<span style={{ fontSize: '.7rem', fontWeight: '400', color: '#9aa0a6', marginLeft: '3px' }}>gc/pj</span>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
