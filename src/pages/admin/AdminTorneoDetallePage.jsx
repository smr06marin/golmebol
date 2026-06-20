import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Trophy, Calendar, BarChart2, Shield, Clock, MapPin, Check, X, Plus, Shuffle, GripVertical } from 'lucide-react'
import PlanillaPartido from '../../components/PlanillaPartido'

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

export default function AdminTorneoDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [torneo, setTorneo] = useState(null)
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [canchas, setCanchas] = useState([])
  const [fechas, setFechas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('actividad')
  const [msg, setMsg] = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)

  // Resultado
  const [editandoPartido, setEditandoPartido] = useState(null)
  const [scoreHome, setScoreHome] = useState('')
  const [scoreAway, setScoreAway] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Partido manual
  const [subTab, setSubTab] = useState('partidos')
  const [showFormPartido, setShowFormPartido] = useState(false)
  const [formPartido, setFormPartido] = useState({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '' })
  const [nuevaCancha, setNuevaCancha] = useState('')

  // Jornada automática
  const [configJornada, setConfigJornada] = useState({ fecha: '', hora_inicio: '', numero: '' })
  const [jornadaGenerada, setJornadaGenerada] = useState([])
  const [drag, setDrag] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [loadingPartido, setLoadingPartido] = useState(false)

  useEffect(() => { fetchTodo() }, [id])

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

  async function handleAgregarCancha() {
    if (!nuevaCancha.trim()) return
    const { data, error } = await supabase.from('canchas').insert({ tournament_id: id, nombre: nuevaCancha.trim() }).select().single()
    if (error) return showMsg('Error al agregar cancha', 'error')
    setCanchas(prev => [...prev, data])
    setNuevaCancha('')
    showMsg('Cancha agregada ✓')
  }

  async function handleCrearPartido() {
    if (!formPartido.home_team_id || !formPartido.away_team_id) return showMsg('Selecciona los dos equipos', 'error')
    if (formPartido.home_team_id === formPartido.away_team_id) return showMsg('Los equipos no pueden ser iguales', 'error')
    if (!formPartido.played_at) return showMsg('La fecha es obligatoria', 'error')
    setLoadingPartido(true)
    const { error } = await supabase.from('matches').insert({
      tournament_id: id,
      home_team_id: formPartido.home_team_id,
      away_team_id: formPartido.away_team_id,
      played_at: formPartido.played_at + (formPartido.hora ? 'T' + formPartido.hora : 'T00:00:00'),
      location: formPartido.location || null,
      matchday: formPartido.matchday ? parseInt(formPartido.matchday) : null,
      status: 'scheduled',
    })
    if (error) showMsg('Error al crear partido', 'error')
    else { showMsg('Partido creado ✓'); setShowFormPartido(false); setFormPartido({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '' }); fetchPartidos() }
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
    const { error } = await supabase.from('matches').update({ home_score: parseInt(scoreHome), away_score: parseInt(scoreAway), status: 'played' }).eq('id', editandoPartido.id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Resultado guardado ✓'); setEditandoPartido(null); setScoreHome(''); setScoreAway(''); fetchPartidos() }
    setGuardando(false)
  }

  // Jornada automática
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
      played_at: `${configJornada.fecha}T${p.hora}:00`, location: p.cancha?.nombre || null,
      matchday: parseInt(configJornada.numero) || (fechas.length + 1), fecha_id: fechaData.id, status: 'scheduled',
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
 <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
  if (!torneo) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Torneo no encontrado</div>

  const partidosJugados = partidos.filter(p => p.status === 'played')
  const partidosPendientes = partidos.filter(p => p.status !== 'played')

  // Tabla posiciones
  const tabla = {}
  equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
  partidosJugados.forEach(p => {
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
            await supabase.from('matches').update({
              home_score: local, away_score: visitante, status: 'played'
            }).eq('id', planillaPartido.id)
            showMsg('Resultado guardado ✓')
            setPlanillaPartido(null)
            fetchPartidos()
          }}
        />
      )}
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

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

      <button onClick={() => navigate('/admin/torneos')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', marginBottom: '20px' }}>
        <ArrowLeft size={16}/> Volver a torneos
      </button>

      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={28} color="#1a73e8"/>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: '0 0 6px' }}>{torneo.name}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {torneo.season && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📅 {torneo.season}</span>}
              {torneo.city && <span style={{ fontSize: '.8rem', color: '#5f6368' }}>📍 {torneo.city}</span>}
              {torneo.modalidad && <span style={{ fontSize: '.8rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 10px' }}>{torneo.modalidad}</span>}
              {torneo.genero && <span style={{ fontSize: '.8rem', color: '#6c35de', background: '#f3e8fd', borderRadius: '10px', padding: '2px 10px' }}>{torneo.genero}</span>}
              {torneo.categoria && <span style={{ fontSize: '.8rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '10px', padding: '2px 10px' }}>{torneo.categoria}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
            {[{ label: 'Equipos', value: equipos.length, color: '#1a73e8' }, { label: 'Jugadores', value: jugadores.length, color: '#6c35de' }, { label: 'Partidos', value: partidos.length, color: '#e8710a' }, { label: 'Jugados', value: partidosJugados.length, color: '#1e8e3e' }].map(s => (
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
              { label: 'Registrar Equipos', done: equipos.length > 0 },
              { label: 'Agregar Canchas', done: canchas.length > 0 },
              { label: 'Crear Partidos', done: partidos.length > 0 },
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
              { label: 'Equipos inscritos', value: equipos.length, color: '#1a73e8', bg: '#e8f0fe' },
              { label: 'Jugadores totales', value: jugadores.length, color: '#6c35de', bg: '#f3e8fd' },
              { label: 'Partidos creados', value: partidos.length, color: '#e8710a', bg: '#fce8d9' },
              { label: 'Partidos jugados', value: partidosJugados.length, color: '#1e8e3e', bg: '#e6f4ea' },
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
          {/* Canchas */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="#1a73e8"/> Canchas
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {canchas.map(c => <span key={c.id} style={{ fontSize: '.8rem', background: '#e8f0fe', color: '#1a73e8', borderRadius: '20px', padding: '3px 12px' }}>{c.nombre}</span>)}
              {canchas.length === 0 && <span style={{ fontSize: '.8rem', color: '#9aa0a6' }}>Sin canchas</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={nuevaCancha} onChange={e => setNuevaCancha(e.target.value)} placeholder="Nombre de la cancha..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAgregarCancha()}/>
              <button onClick={handleAgregarCancha} style={{ padding: '8px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem' }}>+ Agregar</button>
            </div>
          </div>

          {/* SubTabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={() => setSubTab('partidos')} style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === 'partidos' ? '#1a73e8' : '#fff', color: subTab === 'partidos' ? '#fff' : '#5f6368', border: subTab === 'partidos' ? 'none' : '1px solid #dadce0' }}>
              Crear Partido
            </button>
            <button onClick={() => setSubTab('jornada')} style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === 'jornada' ? '#1a73e8' : '#fff', color: subTab === 'jornada' ? '#fff' : '#5f6368', border: subTab === 'jornada' ? 'none' : '1px solid #dadce0' }}>
              Jornada Automática
            </button>
          </div>

          {/* Crear partido manual */}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                      <div><label style={labelStyle}>Fecha *</label><input type="date" value={formPartido.played_at} onChange={e => setFormPartido(f => ({ ...f, played_at: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Hora</label><input type="time" value={formPartido.hora} onChange={e => setFormPartido(f => ({ ...f, hora: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Cancha</label>
                        <select value={formPartido.location} onChange={e => setFormPartido(f => ({ ...f, location: e.target.value }))} style={inputStyle}>
                          <option value="">Seleccionar...</option>
                          {canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div><label style={labelStyle}>Jornada #</label><input type="number" value={formPartido.matchday} onChange={e => setFormPartido(f => ({ ...f, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
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

              {/* Lista partidos */}
              <div>
                {partidosPendientes.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} color="#e8710a"/> Pendientes ({partidosPendientes.length})
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      {partidosPendientes.map((p, i) => (
                        <div key={p.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosPendientes.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>J{p.matchday}</span>}
                              <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{p.home?.name} vs {p.away?.name}</span>
                            </div>
                            <div style={{ fontSize: '.75rem', color: '#9aa0a6', display: 'flex', gap: '10px' }}>
                              {p.played_at && <span>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                              {p.location && <span>📍 {p.location}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
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
                        <div key={p.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < partidosJugados.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                          <div style={{ flex: 1 }}>
                            {p.matchday && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px', marginRight: '8px' }}>J{p.matchday}</span>}
                            {p.played_at && <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 2, justifyContent: 'center' }}>
                            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', textAlign: 'right', flex: 1 }}>{p.home?.name}</span>
                            <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#202124', background: '#f1f3f4', padding: '4px 16px', borderRadius: '8px' }}>{p.home_score} - {p.away_score}</span>
                            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', flex: 1 }}>{p.away?.name}</span>
                          </div>
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setEditandoPartido(p); setScoreHome(p.home_score); setScoreAway(p.away_score) }} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem' }}>
                              Editar
                            </button>
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

          {/* Jornada automática */}
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
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {p.local?.logo_url ? <img src={p.local.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span style={{ fontSize: '.55rem' }}>⚽</span>}
                              </div>
                              <div><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.local?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Local</div></div>
                            </div>
                            <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.75rem', flexShrink: 0 }}>VS</span>
                            <div draggable onDragStart={() => handleDragStart(i, 'visitante')} onDragOver={e => handleDragOver(e, i, 'visitante')} onDrop={e => handleDrop(e, i, 'visitante')} onDragEnd={handleDragEnd}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', border: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '2px dashed #e8710a' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '#fce8d9' : drag?.pi === i && drag?.slot === 'visitante' ? '#f1f3f4' : 'transparent', opacity: drag?.pi === i && drag?.slot === 'visitante' ? .5 : 1, transition: 'all .15s' }}>
                              <div style={{ textAlign: 'right' }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem' }}>{p.visitante?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Visitante</div></div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {p.visitante?.logo_url ? <img src={p.visitante.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span style={{ fontSize: '.55rem' }}>⚽</span>}
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
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {e.logo_url ? <img src={e.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={20} color="#9aa0a6"/>}
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
                      <button onClick={() => navigate(`/admin/equipos/${e.id}`)} style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#1a73e8', fontSize: '.8rem', fontWeight: '500' }}>
                        Ver ficha
                      </button>
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
        <div>
          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de posiciones</div>
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
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {row.equipo.logo_url ? <img src={row.equipo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={14} color="#9aa0a6"/>}
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
      )}
    </div>
  )
}
