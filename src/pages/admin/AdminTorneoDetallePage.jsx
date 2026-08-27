import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { resolverPrediccionesPartido } from '../../lib/predix'
import { getPuntosTorneo } from '../../lib/puntosTorneo'
import PlanillaPartido from '../../components/PlanillaPartido'
import RankingPoster from '../../components/RankingPoster'
import TablaPosiciones from '../../components/TablaPosiciones'
import VallaEquipos from '../../components/VallaEquipos'
import FlyerTorneo from '../../components/FlyerTorneo'
import FlyerProgramacion from '../../components/FlyerProgramacion'
import { buscarEquiposParecidos } from '../../lib/equiposParecidos'
import { recuperarPlanillaAbierta } from '../../lib/planillaRecovery'
import { fmtHora12, fmtHoraDate } from '../../lib/horaHelpers'
import { ArrowLeft, Trophy, Calendar, BarChart2, Shield, Clock, MapPin, Check, X, Plus, Shuffle, GripVertical, Camera, Users, GitBranch, ChevronDown, ChevronUp, DollarSign, Pencil, Image as ImageIcon, Palette, Upload, ExternalLink } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useFormDraft, limpiarBorrador } from '../../hooks/useFormDraft'

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
  { id: 'actividad',       label: 'Actividad',       icon: <Trophy size={16}/> },
  { id: 'grupos',          label: 'Grupos',          icon: <Users size={16}/> },
  { id: 'calendario',      label: 'Calendario',      icon: <Calendar size={16}/> },
  { id: 'equipos',         label: 'Equipos',         icon: <Shield size={16}/> },
  { id: 'estadisticas',    label: 'Estadísticas',    icon: <BarChart2 size={16}/> },
  { id: 'eliminatorias',   label: 'Eliminatorias',   icon: <GitBranch size={16}/> },
  { id: 'finanzas',        label: 'Finanzas',        icon: <DollarSign size={16}/> },
  { id: 'personalizacion', label: 'Personalización', icon: <Palette size={16}/> },
]

function hexValido(v, fallback = '#1a73e8') {
  const t = (v || '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`
  return fallback
}

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

const FASE_ORDEN = ['octavos', 'cuartos', 'semifinal', 'final']

// Días de la semana en el mismo orden que Date.getDay() (0=domingo), para
// cruzar la fecha real de un partido con las preferencias de días guardadas
// por equipo (tournament_teams.dias_preferidos).
const DIAS_SEMANA = [
  { key: 'domingo',   corta: 'D', label: 'Domingo' },
  { key: 'lunes',     corta: 'L', label: 'Lunes' },
  { key: 'martes',    corta: 'M', label: 'Martes' },
  { key: 'miercoles', corta: 'X', label: 'Miércoles' },
  { key: 'jueves',    corta: 'J', label: 'Jueves' },
  { key: 'viernes',   corta: 'V', label: 'Viernes' },
  { key: 'sabado',    corta: 'S', label: 'Sábado' },
]
// Se muestran en el orden habitual lunes→domingo (distinto al índice de getDay)
const DIAS_SEMANA_UI = [1, 2, 3, 4, 5, 6, 0].map(i => DIAS_SEMANA[i])
// Horas que se pueden marcar como horario específico de un día (5am–11pm,
// suficiente para torneos amateur de fútbol 5/7/11).
const HORAS_CHIP = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, '0')}:00`)

function getRondaNombre(total) {
  if (total === 16) return 'Octavos de final'
  if (total === 8)  return 'Cuartos de final'
  if (total === 4 || total === 3) return 'Semifinal'
  if (total === 2)  return 'Final'
  return `Ronda de ${total}`
}
function getFaseValue(total) {
  if (total > 8) return 'octavos'
  if (total > 4) return 'cuartos'
  if (total > 2) return 'semifinal'
  return 'final'
}

// played_at llega de Supabase en UTC (ej: "2026-07-25T01:00:00+00:00").
// Colombia es UTC-5 todo el año — se resta ese offset para sacar la fecha/hora
// que realmente se ve en el reloj acá, y no la que sale de cortar el string tal cual.
function playedAtToLocal(playedAt) {
  if (!playedAt) return { fecha: '', hora: '' }
  const d = new Date(playedAt)
  if (isNaN(d.getTime())) return { fecha: '', hora: '' }
  const local = new Date(d.getTime() - 5 * 60 * 60 * 1000)
  return { fecha: local.toISOString().slice(0, 10), hora: local.toISOString().slice(11, 16) }
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

// Sorteo físico: arrastrar un equipo y soltarlo encima de otro arma el
// cruce. Funciona con mouse y con el dedo (pointer/touch events, sin
// depender del drag-and-drop nativo de HTML5 que no anda bien en celular).
function SorteoManualDrag({ pendientes, llaves, onFormarLlave, onDeshacerLlave }) {
  const [drag, setDrag]     = useState(null) // { team, x, y }
  const [sobreId, setSobreId] = useState(null)

  useEffect(() => {
    if (!drag) return
    function pos(e) {
      if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
      if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
      return { x: e.clientX, y: e.clientY }
    }
    function onMove(e) {
      if (e.cancelable) e.preventDefault()
      const { x, y } = pos(e)
      setDrag(d => d ? { ...d, x, y } : d)
      const el = document.elementFromPoint(x, y)
      const chip = el && el.closest ? el.closest('[data-chip-id]') : null
      const chipId = chip ? chip.getAttribute('data-chip-id') : null
      setSobreId(chipId && chipId !== String(drag.team.id) ? chipId : null)
    }
    function onUp(e) {
      const { x, y } = pos(e)
      const el = document.elementFromPoint(x, y)
      const chip = el && el.closest ? el.closest('[data-chip-id]') : null
      const chipId = chip ? chip.getAttribute('data-chip-id') : null
      if (chipId && chipId !== String(drag.team.id)) {
        const destino = pendientes.find(p => String(p.id) === chipId)
        if (destino) onFormarLlave(drag.team, destino)
      }
      setDrag(null); setSobreId(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [drag, pendientes, onFormarLlave])

  function startDrag(e, team) {
    e.preventDefault()
    const p = e.touches ? e.touches[0] : e
    setDrag({ team, x: p.clientX, y: p.clientY })
  }

  return (
    <div>
      <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px' }}>
        SIN ASIGNAR — arrastrá un equipo y soltalo encima de otro para armar el cruce
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '44px', padding: '10px', background: '#fafbfc', border: '1px dashed #dadce0', borderRadius: '10px' }}>
        {pendientes.map(eq => (
          <div key={eq.id} data-chip-id={eq.id}
            onMouseDown={e => startDrag(e, eq)} onTouchStart={e => startDrag(e, eq)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '20px',
              background: sobreId === String(eq.id) ? '#fff4e5' : '#fff',
              border: sobreId === String(eq.id) ? '2px solid #e8710a' : '1px solid #dadce0',
              cursor: 'grab', userSelect: 'none', touchAction: 'none',
              opacity: drag?.team.id === eq.id ? .25 : 1,
            }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={eq.logo_url} name={eq.name} size={18}/></div>
            <span style={{ fontSize: '.76rem', fontWeight: '600', color: '#202124' }}>{eq.name}</span>
          </div>
        ))}
        {pendientes.length === 0 && <div style={{ fontSize: '.75rem', color: '#9aa0a6', padding: '4px' }}>Todos los equipos ya están emparejados ✓</div>}
      </div>

      {llaves.length > 0 && (
        <>
          <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px' }}>LLAVES ARMADAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            {llaves.map(([a, b], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '7px 10px' }}>
                <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', flexShrink: 0 }}>Llave {i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 }}><TeamLogo logo_url={a.logo_url} name={a.name} size={16}/><span style={{ fontSize: '.75rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span></div>
                <span style={{ fontSize: '.65rem', color: '#e8710a', fontWeight: '700', flexShrink: 0 }}>vs</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 }}><TeamLogo logo_url={b.logo_url} name={b.name} size={16}/><span style={{ fontSize: '.75rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span></div>
                <button onClick={() => onDeshacerLlave(i)} title="Deshacer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025', fontSize: '.8rem', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {drag && (
        <div style={{ position: 'fixed', left: drag.x - 60, top: drag.y - 18, zIndex: 3000, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '20px', background: '#fff', border: '2px solid #e8710a', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden' }}><TeamLogo logo_url={drag.team.logo_url} name={drag.team.name} size={18}/></div>
          <span style={{ fontSize: '.76rem', fontWeight: '700', color: '#202124' }}>{drag.team.name}</span>
        </div>
      )}
    </div>
  )
}

function ModalPosterEquipo({ equipo, onClose }) {
  const [generando, setGenerando] = useState(false)
  const [posterHtml, setPosterHtml] = useState(null)

  async function generarPoster() {
    setGenerando(true)
    try {
      // Generar poster localmente sin API
      const logoHtml = equipo.logo_url
        ? `<div style="width:120px;height:120px;border-radius:50%;overflow:hidden;border:3px solid #f9a825;margin:0 auto 16px;background:#1e2d3d;display:flex;align-items:center;justify-content:center"><img src="${equipo.logo_url}" style="width:100%;height:100%;object-fit:contain;padding:8px"/></div>`
        : `<div style="width:120px;height:120px;border-radius:50%;background:#1e2d3d;border:3px solid #f9a825;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:3rem">⚽</div>`
      const logrosHtml = (equipo.logros || 'Participante Liga Golmebol Armenia 2026').split(',').map(l => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1)"><span style="color:#f9a825;font-size:1.1rem">🏆</span><span style="color:#e8f4fd;font-size:.85rem">${l.trim()}</span></div>`).join('')
      const html = `<div style="width:600px;min-height:800px;background:linear-gradient(160deg,#07070e 0%,#0d1117 40%,#07224a 100%);padding:48px 40px;box-sizing:border-box;font-family:system-ui,sans-serif;position:relative;overflow:hidden">
        <div style="position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:rgba(26,115,232,.08);border:1px solid rgba(26,115,232,.15)"></div>
        <div style="position:absolute;bottom:-40px;left:-40px;width:180px;height:180px;border-radius:50%;background:rgba(249,168,37,.05);border:1px solid rgba(249,168,37,.1)"></div>
        <div style="text-align:center;position:relative;z-index:1">
          <div style="font-size:.7rem;letter-spacing:.3em;color:#7a9ab5;text-transform:uppercase;margin-bottom:24px">GOLMEBOL · ARMENIA, QUINDÍO</div>
          ${logoHtml}
          <div style="font-size:2.2rem;font-weight:900;color:#fff;letter-spacing:.05em;margin-bottom:6px;text-transform:uppercase">${equipo.name}</div>
          <div style="font-size:.85rem;color:#7a9ab5;margin-bottom:4px">${equipo.modalidad||'Fútbol'} · ${equipo.genero||''} · ${equipo.city||'Armenia'}</div>
          <div style="width:60px;height:2px;background:linear-gradient(90deg,transparent,#f9a825,transparent);margin:20px auto"></div>
          ${equipo.descripcion ? `<div style="font-size:.875rem;color:#b8d4e8;line-height:1.7;margin-bottom:24px;padding:0 8px">${equipo.descripcion}</div>` : ''}
          <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;margin-bottom:24px;text-align:left">
            <div style="font-size:.7rem;letter-spacing:.2em;color:#f9a825;text-transform:uppercase;margin-bottom:10px;font-weight:700">Palmarés</div>
            ${logrosHtml}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">
            <div style="height:1px;background:rgba(255,255,255,.1);flex:1"></div>
            <span style="font-size:.7rem;color:#7a9ab5;letter-spacing:.15em">BIENVENIDOS</span>
            <div style="height:1px;background:rgba(255,255,255,.1);flex:1"></div>
          </div>
        </div>
      </div>`
      setPosterHtml(html)
    } catch(e) { console.error(e) }
    setGenerando(false)
  }

  useEffect(() => { generarPoster() }, [])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflow:'auto' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'680px', maxHeight:'95vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div><div style={{ fontWeight:'700', fontSize:'.9rem', color:'#202124' }}>Poster — {equipo.name}</div><div style={{ fontSize:'.7rem', color:'#9aa0a6' }}>Generado con IA</div></div>
          <div style={{ display:'flex', gap:'8px' }}>
            {posterHtml && <button onClick={generarPoster} style={{ padding:'5px 12px', background:'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.78rem' }}>🔄 Regenerar</button>}
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={18}/></button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'20px', display:'flex', justifyContent:'center', alignItems: generando?'center':'flex-start' }}>
          {generando ? (
            <div style={{ textAlign:'center', color:'#5f6368' }}>
              <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🎨</div>
              <div style={{ fontWeight:'600' }}>Generando poster con IA...</div>
            </div>
          ) : posterHtml ? (
            <div dangerouslySetInnerHTML={{ __html: posterHtml }} style={{ width:'100%', maxWidth:'600px' }}/>
          ) : <div style={{ color:'#9aa0a6' }}>Error generando poster</div>}
        </div>
      </div>
    </div>
  )
}

function ModalUniformeEquipo({ equipo, onClose }) {
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState(equipo.uniforme_url || null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    const path = `uniformes/${equipo.id}_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
      await supabase.from('teams').update({ uniforme_url: urlData.publicUrl }).eq('id', equipo.id)
      setPreview(urlData.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:'700', fontSize:'.9rem', color:'#202124' }}>Uniforme — {equipo.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={18}/></button>
        </div>
        <div style={{ padding:'20px' }}>
          <label style={{ display:'block', border:'2px dashed #dadce0', borderRadius:'12px', padding:'28px', textAlign:'center', cursor:'pointer', background:'#f8f9fa', marginBottom:'14px' }}>
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display:'none' }}/>
            {preview
              ? <img src={preview} style={{ maxHeight:'180px', maxWidth:'100%', objectFit:'contain', borderRadius:'8px' }}/>
              : <div><div style={{ fontSize:'2rem', marginBottom:'6px' }}>👕</div><div style={{ fontSize:'.875rem', color:'#5f6368' }}>Click para subir foto del uniforme</div></div>}
          </label>
          {uploading && <div style={{ textAlign:'center', fontSize:'.8rem', color:'#9aa0a6', marginBottom:'10px' }}>Subiendo...</div>}
          <button onClick={onClose} style={{ width:'100%', padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'600', fontSize:'.875rem' }}>Listo</button>
        </div>
      </div>
    </div>
  )
}

function EquiposDesactivadosTorneo({ torneoId, onReactivar, showMsg }) {
  const [lista, setLista] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('tournament_teams')
        .select('*, teams(id,name,logo_url,city)')
        .eq('tournament_id', torneoId)
        .eq('activo', false)
      setLista(data || [])
    }
    load()
  }, [torneoId])

  if (lista.length === 0) return <div style={{ fontSize:'.8rem', color:'#9aa0a6', padding:'12px 0' }}>No hay equipos desactivados</div>

  return (
    <div style={{ background:'#fff', border:'1px solid #fad2cf', borderRadius:'12px', overflow:'hidden' }}>
      {lista.map((tt, i) => (
        <div key={tt.id} style={{ padding:'12px 16px', borderBottom: i<lista.length-1?'1px solid #f1f3f4':'none', display:'flex', alignItems:'center', gap:'12px', opacity:.7 }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'8px', overflow:'hidden', flexShrink:0, background:'#f1f3f4', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {tt.teams?.logo_url ? <img src={tt.teams.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={16} color="#9aa0a6"/>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:'600', fontSize:'.875rem', color:'#5f6368' }}>{tt.teams?.name}</div>
            <div style={{ fontSize:'.7rem', color:'#9aa0a6' }}>Desactivado de este torneo</div>
          </div>
          <button onClick={async () => {
            await supabase.from('tournament_teams').update({ activo: true }).eq('id', tt.id)
            showMsg(`${tt.teams?.name} reactivado ✓`)
            onReactivar()
            setLista(prev => prev.filter(x => x.id !== tt.id))
          }} style={{ padding:'5px 12px', background:'#e6f4ea', border:'1px solid #ceead6', borderRadius:'8px', cursor:'pointer', color:'#1e8e3e', fontSize:'.8rem', fontWeight:'600' }}>
            Reactivar
          </button>
        </div>
      ))}
    </div>
  )
}

export default function AdminTorneoDetallePage() {
  const { id } = useParams()
  const { rol } = useAuthStore()
  const esAdminRol = rol?.rol ? rol.rol === 'admin' : true // sin sistema de roles cargado, el admin ve todo
  const esOrganizador = rol?.rol === 'organizador'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Borrador de la jornada aleatoria: se guarda en localStorage para que si
  // el navegador recarga o el admin cambia de pestaña y vuelve, siga exactamente
  // donde iba. Solo "Guardar jornada" o "Salir" lo eliminan.
  const draftJornadaKey = `jornada_draft_${id}`
  const draftJornadaRef = useRef(undefined)
  if (draftJornadaRef.current === undefined) {
    try { draftJornadaRef.current = JSON.parse(localStorage.getItem(`jornada_draft_${id}`)) || null } catch { draftJornadaRef.current = null }
  }
  const draftJornada = draftJornadaRef.current

  const [torneo,    setTorneo]    = useState(null)
  const [equipos,   setEquipos]   = useState([])
  const [partidos,  setPartidos]  = useState([])
  const [jugadores, setJugadores] = useState([])
  const [sanciones,        setSanciones]        = useState([]) // sanciones activas de este torneo (o globales) sobre jugadores del torneo
  const [modalSuspender,   setModalSuspender]    = useState(null) // registro (j) del jugador a suspender
  const [formSancion,      setFormSancion]       = useState({ motivo: '', meses: '1' })
  const [suspendiendo,     setSuspendiendo]      = useState(false)
  const [canchas,   setCanchas]   = useState([])
  const [fechas,    setFechas]    = useState([])
  const [loading,   setLoading]   = useState(true)
  // La pestaña activa se refleja en la URL (?tab=) para que si el celular
  // recarga la página al volver de otra app (WhatsApp, etc.) — algo normal en
  // iOS/Android cuando la pestaña se queda mucho tiempo en segundo plano —
  // el admin/organizador vuelva exactamente donde estaba (p.ej. Equipos) en
  // vez de caer siempre en "Actividad".
  const [tab, setTabState] = useState(() => searchParams.get('tab') || (draftJornada ? 'partidos' : 'actividad'))
  function setTab(id) {
    setTabState(id)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', id); return n }, { replace: true })
  }
  const [msg,       setMsg]       = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [modalPartidoAdmin, setModalPartidoAdmin] = useState(null)
  const [partidoAEliminar, setPartidoAEliminar] = useState(null)
  const [eliminandoPartido, setEliminandoPartido] = useState(false)
  // Torneo finalizado = ya tiene campeón definido (tournament_logros tipo='campeon').
  // El organizador deja de ver equipos/jugadores de un torneo una vez finalizado.
  const [torneoFinalizado, setTorneoFinalizado] = useState(false)

  const [goleadores,   setGoleadores]   = useState([])
  const [vallas,        setVallas]        = useState({ opcion1: [], opcion2: [] })
  const [modoValla,     setModoValla]     = useState('opcion1')
  const [arquerosEquipos, setArquerosEquipos] = useState([]) // arqueros registrados por equipo
  const [loadingStats, setLoadingStats] = useState(false)

  const [editandoPartido, setEditandoPartido] = useState(null)
  const [scoreHome,       setScoreHome]       = useState('')
  const [scoreAway,       setScoreAway]       = useState('')
  const [guardando,       setGuardando]       = useState(false)

  const [editandoTorneo,  setEditandoTorneo]  = useState(false)
  const [formTorneo,      setFormTorneo]      = useState({})

  const [editandoPartidoForm, setEditandoPartidoForm] = useState(null)
  const [formEditPartido,     setFormEditPartido]     = useState({})

  const [subTab,          setSubTab]          = useState(draftJornada ? 'jornada' : 'partidos')
  const [showFormPartido, setShowFormPartido] = useState(false)
  const [formPartido,     setFormPartido]     = useState({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '', fase: 'grupo', arbitro1_id: '', arbitro2_id: '', arbitro3_id: '' })
  const [arbitrosAdmin,   setArbitrosAdmin]   = useState([])
  const [nuevaCancha,     setNuevaCancha]     = useState('')
  const [nuevaCanchaEscenario, setNuevaCanchaEscenario] = useState('')

  const [configJornada,   setConfigJornada]   = useState(draftJornada?.config || { fecha: '', fecha_fin: '', hora_inicio: '', hora_fin: '', numero: '', dias_semana: null, cancha_ids: null, horarios_por_dia: {}, dias_por_escenario: {} })
  const [guardandoPref,   setGuardandoPref]   = useState(null) // tournament_team_id que se está guardando
  const [jornadaGenerada, setJornadaGenerada] = useState(draftJornada?.jornada || [])
  const [permitirIntergrupo, setPermitirIntergrupo] = useState(draftJornada?.intergrupo || false)
  const [editJornadaIdx,  setEditJornadaIdx]  = useState(null) // índice del partido generado en edición (hora/cancha)
  const [drag,            setDrag]            = useState(null)
  const [dragOver,        setDragOver]        = useState(null)
  const [loadingPartido,  setLoadingPartido]  = useState(false)

  const [showAgregarEquipo,  setShowAgregarEquipo]  = useState(false)
  const [busquedaEquipo,     setBusquedaEquipo]     = useState('')
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [loadingEquipos,     setLoadingEquipos]     = useState(false)
  const [mostrarCrearEquipo, setMostrarCrearEquipo] = useState(false)
  const [parecidosCrear,     setParecidosCrear]     = useState([]) // equipos ya existentes con nombre parecido
  const [nuevoEquipoForm,    setNuevoEquipoForm]    = useState({ name: '', city: '', representante_nombre: '', representante_cedula: '', representante_telefono: '' })
  // Si el celular mata la pestaña al salir a otra app mientras se llena este
  // formulario, se recupera solo al volver.
  useFormDraft('draft_crear_equipo_torneo', nuevoEquipoForm, setNuevoEquipoForm)
  // Y no solo se recupera el texto: si había un borrador con nombre puesto,
  // reabrimos el panel de "Agregar equipo" automáticamente para que el admin
  // lo vea ahí mismo en vez de tener que adivinar que sus datos siguen guardados.
  useEffect(() => {
    if (nuevoEquipoForm.name?.trim()) { setShowAgregarEquipo(true); setMostrarCrearEquipo(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nuevoEquipoForm.name])
  const [creandoEquipo,      setCreandoEquipo]      = useState(false)
  const [nuevoEquipoLogo,        setNuevoEquipoLogo]        = useState(null)
  const [nuevoEquipoLogoPreview, setNuevoEquipoLogoPreview] = useState(null)

  // ── GRUPOS ──────────────────────────────────────────
  const [grupos,           setGrupos]           = useState([])
  const [grupoEquipos,     setGrupoEquipos]     = useState([]) // { grupo_id, team_id }
  const [numGrupos,        setNumGrupos]        = useState(2)
  const [clasificanPorGrupo, setClasificanPorGrupo] = useState(2)
  const [generandoGrupos,  setGenerandoGrupos]  = useState(false)
  const [fechaGrupos,      setFechaGrupos]      = useState('')
  const [moviendoEquipoId, setMoviendoEquipoId] = useState(null) // team_id con el menú de "mover a otro grupo" abierto
  const [horaGrupos,       setHoraGrupos]       = useState('08:00')

  // ── ELIMINATORIAS ───────────────────────────────────
  const [idaVuelta,        setIdaVuelta]        = useState(false)
  const [fechaElim,        setFechaElim]        = useState('')
  const [horaElim,         setHoraElim]         = useState('08:00')
  const [generandoElim,    setGenerandoElim]    = useState(false)
  const [bracket,          setBracket]          = useState([]) // partidos de eliminatorias
  const [showWizardElim,   setShowWizardElim]   = useState(false)
  const [numClasifElim,    setNumClasifElim]    = useState(8)   // 2 | 4 | 8 | 16
  const [estiloLlaves,     setEstiloLlaves]     = useState('consecutivo') // 'consecutivo' | 'cruzado' | 'manual'
  const [ordenManual,      setOrdenManual]      = useState([]) // participantes del sorteo físico (todavía por emparejar + ya emparejados)
  const [llavesManuales,   setLlavesManuales]   = useState([]) // [[equipoA, equipoB], ...] armadas arrastrando
  // Arranca en HOY por defecto (en vez de vacío) para que el avance automático
  // de rondas siempre tenga una fecha de respaldo válida aunque el admin no
  // haya tocado nada — se puede editar libremente antes o después.
  const [fechaRonda,       setFechaRonda]       = useState(() => new Date().toISOString().slice(0, 10))
  const [horaRonda,        setHoraRonda]        = useState('08:00')
  const [generandoRonda,   setGenerandoRonda]   = useState(false)
  // Traba síncrona (además del estado de arriba) para que el avance
  // automático de rondas nunca dispare dos generaciones al mismo tiempo por
  // una re-ejecución rápida del efecto antes de que el estado se actualice.
  const generandoRondaRef = useRef(false)
  // Traba equivalente para el avance por casilla fija (ver intentarAvanzarSlots).
  const avanzandoSlotsRef = useRef(false)
  const [modoImpar,        setModoImpar]        = useState('mejor_perdedor') // 'mejor_perdedor' | 'bye'
  const [equipoByeId,      setEquipoByeId]      = useState(null) // a quién se le da el pase directo cuando modoImpar==='bye' (null = el último de la reclasificación)
  const [crearTercerPuesto, setCrearTercerPuesto] = useState(false)
  // Fecha/hora planeada por ronda para la vista previa en vivo (ej. "la final
  // es el 5 de abril") — se guarda en la BD para que el jugador vea lo mismo.
  const [previewCalendario, setPreviewCalendario] = useState({})
  // Se pone en true recién cuando ya se cargó la config guardada en la BD —
  // hasta entonces no hay que guardar nada, para no pisar lo guardado con los
  // valores por defecto de arranque.
  const [previewConfigCargado, setPreviewConfigCargado] = useState(false)

  // Cupos sugeridos para la vista previa en vivo del árbol: si hay grupos,
  // "clasifican X por grupo" × cantidad de grupos; si aún no se creó el
  // bracket real, se recalcula solo cuando cambia la config de grupos.
  useEffect(() => {
    if (bracket.length > 0) return
    if (grupos.length > 0) {
      // Si el total natural (clasifican X por grupo × cantidad de grupos)
      // queda impar, ya no se infla a mano: se deja tal cual y el admin
      // elige en el wizard si entra un mejor perdedor más o si alguien
      // pasa directo (modoImpar).
      // Usa el valor REAL guardado (equipos_clasifican) en vez del input
      // editable en pantalla, para que no se desincronice con lo que ve
      // el jugador si ese campo se toca sin querer después de crear los grupos.
      const porGrupo = torneo?.equipos_clasifican || clasificanPorGrupo
      const sugerido = porGrupo * grupos.length
      if (sugerido >= 2) setNumClasifElim(sugerido)
    }
  }, [grupos.length, clasificanPorGrupo, bracket.length, torneo?.equipos_clasifican])

  // Vista previa en vivo: arrastrar un equipo encima de otro intercambia
  // sus puestos en el orden de siembra (el 5° se va al puesto del 2° y el
  // 2° pasa al puesto del 5°), y las llaves se arman de nuevo con ese
  // orden. Si cambia quién clasifica (nuevo resultado, cambian cupos), el
  // orden a mano se descarta y vuelve al automático. Se guarda en
  // localStorage para que sobreviva a un refresh de página.
  const previewOrdenKey = `preview_orden_${id}`
  const [previewOrden,     setPreviewOrden]      = useState(() => { // eslint-disable-line react-hooks/rules-of-hooks
    try { return JSON.parse(localStorage.getItem(previewOrdenKey)) || null } catch { return null }
  })
  const [dragPreview,      setDragPreview]      = useState(null) // { team, x, y }
  const [sobrePreviewId,   setSobrePreviewId]   = useState(null)
  // Se pone en true recién cuando terminó de cargar TODO lo que afecta la
  // clasificación (equipos, partidos, grupos) — hasta entonces no se debe
  // tocar previewOrden, porque con datos a medias parece que "cambiaron
  // los clasificados" y se borraría el orden guardado sin haber cambiado nada.
  const [datosPreviewListos, setDatosPreviewListos] = useState(false)
  // Si el número de clasificados queda impar, getParticipantesConImpar ya
  // resuelve qué pasa con el que sobra (mejor perdedor extra o bye) según
  // modoImpar/equipoByeId — así la vista previa nunca "pierde" en silencio
  // al equipo que no entra en una pareja par.
  const impareableLive = (bracket.length === 0 && (grupos.length > 0 || equipos.length >= 2) && estiloLlaves !== 'manual') ? getParticipantesConImpar() : null
  const participantesPreviewLive = impareableLive ? impareableLive.participantes : []
  const byeInicialPreviewLive = impareableLive ? impareableLive.byeTeam : null

  useEffect(() => {
    if (previewOrden) localStorage.setItem(previewOrdenKey, JSON.stringify(previewOrden))
    else localStorage.removeItem(previewOrdenKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOrden])

  // Guarda en la BD (no solo en este navegador) cómo quedó armada la vista
  // previa en vivo: cupos, estilo de llaves, qué pasa con el impar, y el
  // orden movido a mano — así el jugador ve EXACTAMENTE lo mismo que vos.
  // Debounce corto para no escribir en cada tecla/arrastre.
  const previewConfigTimer = useRef(null)
  useEffect(() => {
    if (!previewConfigCargado) return
    if (bracket.length > 0) return // ya hay árbol real, la config de preview no aplica
    clearTimeout(previewConfigTimer.current)
    previewConfigTimer.current = setTimeout(() => {
      supabase.from('tournaments').update({
        preview_config: { numClasifElim, estiloLlaves, modoImpar, equipoByeId, previewOrden, crearTercerPuesto },
      }).eq('id', id).then(() => {})
    }, 700)
    return () => clearTimeout(previewConfigTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewConfigCargado, bracket.length, numClasifElim, estiloLlaves, modoImpar, equipoByeId, previewOrden, crearTercerPuesto])

  // Calendario planeado por ronda (fecha/hora) — también en la BD.
  const previewCalendarioTimer = useRef(null)
  useEffect(() => {
    if (!previewConfigCargado) return
    clearTimeout(previewCalendarioTimer.current)
    previewCalendarioTimer.current = setTimeout(() => {
      supabase.from('tournaments').update({ preview_calendario: previewCalendario }).eq('id', id).then(() => {})
    }, 700)
    return () => clearTimeout(previewCalendarioTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewConfigCargado, previewCalendario])

  useEffect(() => {
    // No reconciliar hasta que los datos reales (grupos incluidos) hayan
    // terminado de cargar — si no, con datos a medias se borraría el orden
    // guardado creyendo que cambiaron los clasificados.
    if (!datosPreviewListos) return
    if (participantesPreviewLive.length === 0) return
    setPreviewOrden(prev => {
      if (!prev) return prev
      const idsLive = participantesPreviewLive.map(p => String(p.id))
      const idsPrev = prev.map(String)
      const mismos = idsLive.length === idsPrev.length && idsLive.every(id => idsPrev.includes(id))
      if (mismos) return prev
      // Antes, si cambiaba UN solo cupo (típicamente el "mejor perdedor" al
      // entrar otro resultado en otro grupo) se borraba TODO el orden armado
      // a mano, aunque el resto de los equipos no se hubiera movido. Ahora
      // solo se reemplaza, en su mismo puesto, al equipo que salió por el
      // que entró — el resto del orden que armaste queda intacto.
      if (idsLive.length !== idsPrev.length) return null // cambió la cantidad total: ya no aplica
      const salieron = idsPrev.filter(idp => !idsLive.includes(idp))
      const entraron = idsLive.filter(idl => !idsPrev.includes(idl))
      if (salieron.length === 0 || salieron.length !== entraron.length) return null // caso raro, mejor reiniciar limpio
      const nuevo = [...idsPrev]
      salieron.forEach((idSale, i) => {
        const idx = nuevo.indexOf(idSale)
        if (idx !== -1) nuevo[idx] = entraron[i]
      })
      return nuevo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosPreviewListos, participantesPreviewLive.map(p => p.id).join(',')])

  useEffect(() => {
    if (!dragPreview) return
    function pos(e) {
      if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
      if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
      return { x: e.clientX, y: e.clientY }
    }
    function chipEnPunto(x, y) {
      const el = document.elementFromPoint(x, y)
      const chip = el && el.closest ? el.closest('[data-prevteam-id]') : null
      return chip ? chip.getAttribute('data-prevteam-id') : null
    }
    function onMove(e) {
      if (e.cancelable) e.preventDefault()
      const { x, y } = pos(e)
      setDragPreview(d => d ? { ...d, x, y } : d)
      const chipId = chipEnPunto(x, y)
      setSobrePreviewId(chipId && chipId !== String(dragPreview.team.id) ? chipId : null)
    }
    function onUp(e) {
      const { x, y } = pos(e)
      const chipId = chipEnPunto(x, y)
      if (chipId && chipId !== String(dragPreview.team.id)) {
        setPreviewOrden(prev => {
          const base = (prev && prev.length === participantesPreviewLive.length ? prev : participantesPreviewLive.map(p => p.id)).map(String)
          const idxA = base.indexOf(String(dragPreview.team.id))
          const idxB = base.indexOf(chipId)
          if (idxA === -1 || idxB === -1) return prev
          const nuevo = [...base]
          ;[nuevo[idxA], nuevo[idxB]] = [nuevo[idxB], nuevo[idxA]]
          return nuevo
        })
      }
      setDragPreview(null); setSobrePreviewId(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragPreview, participantesPreviewLive])

  function startDragPreview(e, team) {
    e.preventDefault()
    const p = e.touches ? e.touches[0] : e
    setDragPreview({ team, x: p.clientX, y: p.clientY })
  }

  const [partidoPenales,   setPartidoPenales]   = useState(null) // partido empatado al que se le registran penales
  const [penalesForm,      setPenalesForm]      = useState({ local: '', visitante: '' })
  const [guardandoPenales, setGuardandoPenales] = useState(false)
  const [reemplazoLlave,   setReemplazoLlave]   = useState(null) // llave donde se reemplaza un equipo
  const [equipoSale,       setEquipoSale]       = useState('')
  const [equipoEntra,      setEquipoEntra]      = useState('')
  const [guardandoReemplazo, setGuardandoReemplazo] = useState(false)
  const [guardandoLogros,  setGuardandoLogros]  = useState(false)

  // ── FINANZAS ────────────────────────────────────────
  const [movimientos,      setMovimientos]      = useState([])
  const [statsTarjetas,    setStatsTarjetas]    = useState([])
  const [pendientesTarjetas, setPendientesTarjetas] = useState({}) // { player_id: { am, az, rj } } tarjetas sin pagar
  const [showConfigFin,    setShowConfigFin]    = useState(false)
  const [formFin,          setFormFin]          = useState({})
  const [guardandoFin,     setGuardandoFin]     = useState(false)
  const [pagoModal,        setPagoModal]        = useState(null) // equipo al que se registra pago
  const [pagoForm,         setPagoForm]         = useState({ tipo: 'pago_tarjetas', monto: '', concepto: '' })
  const [tarjetasAPagar,   setTarjetasAPagar]   = useState([]) // [{player_id, color, nombre}] a marcar pagadas junto con este pago
  const [guardandoPago,    setGuardandoPago]    = useState(false)
  const [equipoFinAbierto, setEquipoFinAbierto] = useState(null)

  // ── PERSONALIZACIÓN (marca + patrocinadores del torneo) ──
  const [formMarca,          setFormMarca]          = useState({ custom_domain: '', color_primario: '#1a73e8', color_secundario: '#202124', favicon_url: '', logo_url: '' })
  const [guardandoMarca,     setGuardandoMarca]     = useState(false)
  const [uploadingFavicon,   setUploadingFavicon]   = useState(false)
  const [uploadingLogoMarca, setUploadingLogoMarca] = useState(false)
  const [torneoSponsors,     setTorneoSponsors]     = useState([])
  const [loadingSponsors,    setLoadingSponsors]    = useState(false)
  const [uploadingSponsorId, setUploadingSponsorId] = useState(null)
  const [savingSponsorId,    setSavingSponsorId]    = useState(null)

  useEffect(() => { if (id && id !== 'undefined') fetchTodo() }, [id])
  const [menuEquipoId,     setMenuEquipoId]     = useState(null)
  const [posterEquipo,     setPosterEquipo]      = useState(null)
  const [uniformeEquipo,   setUniformeEquipo]   = useState(null)
  const [showFlyerTorneo,  setShowFlyerTorneo]  = useState(false)
  const [showFlyerProgramacion, setShowFlyerProgramacion] = useState(false)
  const [jugadoresEquipoId,setJugadoresEquipoId]= useState(null)
  const [verDesact,        setVerDesact]        = useState(false)
  const [abiertosJornada,  setAbiertosJornada]  = useState({})

  useEffect(() => { if (id && id !== 'undefined') fetchTodo() }, [id])
  // La planilla abierta queda marcada en la URL (?planilla=<id>). Así, sin
  // importar qué pase — el celular recarga la pestaña al volver de otra app,
  // el usuario refresca a mano, se cae el internet — al volver a cargar esta
  // página se reabre exactamente la misma planilla. La ÚNICA forma de salir
  // de la planilla es el botón "Salir" (que llama a cerrarPlanilla()).
  useEffect(() => {
    const matchId = searchParams.get('planilla')
    if (matchId) {
      supabase.from('matches')
        .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .eq('id', matchId).single()
        .then(({ data }) => { if (data) setPlanillaPartido(data) })
    } else {
      // Respaldo por si la URL no la trae (ej. entrada vieja ya guardada)
      recuperarPlanillaAbierta().then(p => { if (p) abrirPlanilla(p) })
    }
  }, [])

  function abrirPlanilla(p) {
    setPlanillaPartido(p)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); return n }, { replace: true })
  }
  function cerrarPlanilla() {
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace: true })
  }
  useEffect(() => { if (tab === 'estadisticas' || tab === 'grupos') fetchGoleadores() }, [tab])
  useEffect(() => { if (tab === 'eliminatorias') fetchBracket() }, [tab])
  useEffect(() => { if (tab === 'finanzas') fetchFinanzas() }, [tab])
  useEffect(() => {
    if (tab !== 'personalizacion' || !torneo) return
    setFormMarca({
      custom_domain:    torneo.custom_domain || '',
      color_primario:   torneo.color_primario || '#1a73e8',
      color_secundario: torneo.color_secundario || '#202124',
      favicon_url:      torneo.favicon_url || '',
      logo_url:         torneo.logo_url || '',
    })
    fetchTorneoSponsors()
  }, [tab, torneo?.id])

  // Guardar el borrador de la jornada aleatoria en cada cambio. Así, sin
  // importar qué pase (recarga, cambio de pestaña, se cae el internet), al
  // volver se retoma exactamente igual. Solo Guardar o Salir lo eliminan.
  useEffect(() => {
    const hayBorrador = jornadaGenerada.length > 0 || configJornada.fecha || configJornada.hora_inicio || configJornada.numero
    if (hayBorrador) {
      localStorage.setItem(draftJornadaKey, JSON.stringify({ config: configJornada, jornada: jornadaGenerada, intergrupo: permitirIntergrupo }))
    }
  }, [jornadaGenerada, configJornada, permitirIntergrupo])

  function salirJornada() {
    localStorage.removeItem(draftJornadaKey)
    setJornadaGenerada([])
    setConfigJornada({ fecha: '', fecha_fin: '', hora_inicio: '', hora_fin: '', numero: '', dias_semana: null, cancha_ids: null, horarios_por_dia: {}, dias_por_escenario: {} })
    setEditJornadaIdx(null)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), type === 'error' ? 8000 : 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    // Pintar la página apenas llega el torneo; equipos y partidos llegan
    // en paralelo y van llenando las secciones (clave en celular).
    // fetchBracket() va acá también (antes solo se cargaba al entrar a la
    // pestaña "Eliminatorias") — si no, el avance automático de rondas nunca
    // se enteraba de que había una ronda completa cuando el admin entraba
    // directo a otra pestaña (Actividad, Partidos, etc.) y cerraba un partido
    // desde ahí, sin haber visitado Eliminatorias en esa sesión.
    const pResto = Promise.all([fetchEquipos(), fetchPartidos(), fetchFinalizado(), fetchBracket()])
    await fetchTorneo()
    setLoading(false)
    await pResto

    Promise.all([fetchJugadores(), fetchCanchas(), fetchFechas(), fetchGrupos(), fetchSanciones()])
      .catch(() => {})
      .finally(() => setDatosPreviewListos(true))

    ;(async () => {
      try {
        const { data: arbs } = await supabase.from('players').select('id,name').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
        setArbitrosAdmin(arbs || [])
      } catch (e) { console.error('carga secundaria:', e) }
    })()
  }

  // El botón derecho / mantener presionado sobre el <img> del escudo no
  // siempre deja "Guardar imagen" (depende del navegador/celular). En
  // celular, un <a download> normal casi nunca guarda en la galería de
  // fotos (sobre todo en iPhone: abre la imagen o la manda a Archivos) —
  // por eso primero se intenta con el share nativo (navigator.share), que
  // sí ofrece la opción "Guardar en Fotos"/"Guardar imagen" y ahí queda en
  // la galería de verdad. En computador (donde no existe galería) se cae
  // al download normal de toda la vida.
  async function descargarEscudo(equipo) {
    if (!equipo.logo_url) { showMsg('Este equipo todavía no tiene escudo'); return }
    try {
      const resp = await fetch(equipo.logo_url)
      const blob = await resp.blob()
      const ext = (equipo.logo_url.split('.').pop() || 'png').split('?')[0].slice(0, 4)
      const nombreArchivo = `escudo-${equipo.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${ext}`
      const file = new File([blob], nombreArchivo, { type: blob.type || 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: nombreArchivo })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreArchivo
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err?.name === 'AbortError') return // el usuario cerró el cuadro de compartir sin elegir nada
      showMsg('No se pudo descargar el escudo: ' + err.message)
    }
  }

  // Desactiva al equipo en este torneo: sus jugadores quedan inactivos y el equipo sale del torneo
  async function handleDesactivarEquipo(equipo) {
    if (!confirm(`¿Desactivar a "${equipo.name}" de este torneo? Sus jugadores quedarán inactivos y el equipo saldrá del torneo. Sus partidos y estadísticas se conservan.`)) return
    await supabase.from('tournament_player_registrations').update({ activo: false }).eq('tournament_id', id).eq('team_id', equipo.id)
    await supabase.from('tournament_teams').delete().eq('tournament_id', id).eq('team_id', equipo.id)
    showMsg(`${equipo.name} desactivado del torneo`)
    fetchEquipos(); fetchJugadores()
  }

  async function fetchTorneo() {
    const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTorneo(data)
    if (data?.num_grupos)           setNumGrupos(data.num_grupos)
    if (data?.equipos_clasifican)   setClasificanPorGrupo(data.equipos_clasifican)
    // Config de la vista previa en vivo guardada en la BD (para que el
    // jugador vea exactamente lo mismo) — se carga UNA vez al entrar.
    if (data?.preview_config) {
      const pc = data.preview_config
      if (pc.numClasifElim)          setNumClasifElim(pc.numClasifElim)
      if (pc.estiloLlaves)           setEstiloLlaves(pc.estiloLlaves)
      if (pc.modoImpar)              setModoImpar(pc.modoImpar)
      if (pc.equipoByeId !== undefined) setEquipoByeId(pc.equipoByeId)
      if (pc.previewOrden)           setPreviewOrden(pc.previewOrden)
      if (pc.crearTercerPuesto)      setCrearTercerPuesto(true)
    }
    if (data?.preview_calendario) setPreviewCalendario(data.preview_calendario)
    setPreviewConfigCargado(true)
  }

  async function fetchEquipos() {
    const { data } = await supabase.from('tournament_teams').select('*, teams(id, name, city, logo_url, modalidad, genero, registro_token)').eq('tournament_id', id)
    setEquipos((data || []).map(d => ({ ...d.teams, tournament_team_id: d.id, dias_preferidos: d.dias_preferidos || [], hora_preferida: d.hora_preferida ? d.hora_preferida.slice(0, 5) : '' })))
  }

  // Preferencia de días/hora de un equipo PARA ESTE TORNEO — se usa al
  // generar la jornada automática, para que el sorteo intente programar los
  // partidos de ese equipo en los días/hora que indicó (si no hay
  // coincidencia entre los dos rivales, se usa cualquier día del rango).
  function toggleDiaPreferido(equipo, diaKey) {
    const actuales = equipo.dias_preferidos || []
    const nuevos = actuales.includes(diaKey) ? actuales.filter(d => d !== diaKey) : [...actuales, diaKey]
    guardarPreferenciaEquipo(equipo, { dias_preferidos: nuevos })
  }

  // Días de la semana y canchas/escenarios habilitados para ESTA jornada
  // (distinto de la preferencia por equipo) — si no se toca nada, se
  // comportan como "todos" (mismo resultado que antes de este selector).
  function toggleDiaSemanaJornada(key) {
    setConfigJornada(f => {
      const actuales = f.dias_semana || DIAS_SEMANA.map(d => d.key)
      const nuevos = actuales.includes(key) ? actuales.filter(d => d !== key) : [...actuales, key]
      return { ...f, dias_semana: nuevos }
    })
  }

  // Horarios específicos por día (ej: sábado 8 y 9, domingo 5-6-7-8, lunes
  // 9-10) — si un día no tiene horas marcadas acá, usa "Hora desde/hasta"
  // como antes.
  function toggleHorarioDia(diaKey, horaStr) {
    setConfigJornada(f => {
      const actual = (f.horarios_por_dia || {})[diaKey] || []
      const nuevo = actual.includes(horaStr) ? actual.filter(h => h !== horaStr) : [...actual, horaStr].sort()
      return { ...f, horarios_por_dia: { ...(f.horarios_por_dia || {}), [diaKey]: nuevo } }
    })
  }

  function toggleCanchaJornada(canchaId) {
    setConfigJornada(f => {
      const actuales = f.cancha_ids || canchas.map(c => c.id)
      const nuevos = actuales.includes(canchaId) ? actuales.filter(x => x !== canchaId) : [...actuales, canchaId]
      return { ...f, cancha_ids: nuevos }
    })
  }

  function toggleEscenarioJornada(canchasDelEscenario) {
    setConfigJornada(f => {
      const actuales = f.cancha_ids || canchas.map(c => c.id)
      const idsEsc = canchasDelEscenario.map(c => c.id)
      const todasMarcadas = idsEsc.every(id => actuales.includes(id))
      const nuevos = todasMarcadas ? actuales.filter(id => !idsEsc.includes(id)) : Array.from(new Set([...actuales, ...idsEsc]))
      return { ...f, cancha_ids: nuevos }
    })
  }

  // Qué días de la semana se puede usar cada escenario (ej: Old Trafford
  // solo sábados, Gol solo domingo y lunes) — si un escenario no tiene
  // días marcados acá, se puede usar cualquiera de los días generales de
  // la jornada (comportamiento de antes).
  function toggleDiaEscenario(escenarioKey, diaKey) {
    setConfigJornada(f => {
      const actual = (f.dias_por_escenario || {})[escenarioKey] || []
      const nuevo = actual.includes(diaKey) ? actual.filter(d => d !== diaKey) : [...actual, diaKey]
      return { ...f, dias_por_escenario: { ...(f.dias_por_escenario || {}), [escenarioKey]: nuevo } }
    })
  }

  async function guardarPreferenciaEquipo(equipo, cambios) {
    setGuardandoPref(equipo.tournament_team_id)
    setEquipos(prev => prev.map(e => e.tournament_team_id === equipo.tournament_team_id ? { ...e, ...cambios } : e))
    const payload = {}
    if ('dias_preferidos' in cambios) payload.dias_preferidos = cambios.dias_preferidos.length > 0 ? cambios.dias_preferidos : null
    if ('hora_preferida' in cambios) payload.hora_preferida = cambios.hora_preferida || null
    await supabase.from('tournament_teams').update(payload).eq('id', equipo.tournament_team_id)
    setGuardandoPref(null)
  }

  async function fetchFinalizado() {
    const { data } = await supabase.from('tournament_logros').select('id').eq('tournament_id', id).eq('tipo', 'campeon').limit(1)
    setTorneoFinalizado((data || []).length > 0)
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
    const { data } = await supabase.from('tournament_player_registrations').select('*, players(*), teams(name)').eq('tournament_id', id)
    setJugadores(data || [])
  }

  // Sanciones vigentes que aplican a este torneo: las creadas específicamente
  // para este torneo, o globales (tournament_id null, las pone solo el admin
  // principal desde la ficha del jugador).
  async function fetchSanciones() {
    const { data } = await supabase.from('sanciones').select('*').eq('activa', true).or(`tournament_id.eq.${id},tournament_id.is.null`)
    const hoy = new Date().toISOString()
    setSanciones((data || []).filter(s => !s.fecha_fin || s.fecha_fin > hoy))
  }

  function sancionDeJugador(playerId) {
    return sanciones.find(s => s.player_id === playerId) || null
  }

  async function handleSuspenderJugador() {
    if (!modalSuspender) return
    if (!formSancion.motivo.trim()) return showMsg('Escribe el motivo de la sanción', 'error')
    const meses = parseInt(formSancion.meses) || 0
    setSuspendiendo(true)
    const fecha_fin = meses > 0 ? new Date(Date.now() + meses * 30 * 24 * 60 * 60 * 1000).toISOString() : null
    const { error } = await supabase.from('sanciones').insert({
      player_id: modalSuspender.player_id,
      tournament_id: id,
      motivo: formSancion.motivo.trim(),
      fecha_fin,
      activa: true,
    })
    setSuspendiendo(false)
    if (error) return showMsg('Error al suspender', 'error')
    showMsg(`${modalSuspender.players?.name || 'Jugador'} suspendido de este torneo ✓`)
    setModalSuspender(null); setFormSancion({ motivo: '', meses: '1' })
    fetchSanciones()
  }

  async function handleLevantarSancion(sancionId) {
    if (!confirm('¿Levantar esta sanción?')) return
    await supabase.from('sanciones').update({ activa: false }).eq('id', sancionId)
    showMsg('Sanción levantada ✓')
    fetchSanciones()
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

    // Arqueros REGISTRADOS de cada equipo del torneo (para la valla por equipo)
    const { data: tt } = await supabase.from('tournament_teams').select('team_id').eq('tournament_id', id)
    const teamIds = (tt || []).map(t => t.team_id).filter(Boolean)
    if (teamIds.length > 0) {
      const { data: tp } = await supabase.from('team_players')
        .select('team_id, players(name, photo_face_url, photo_url, posicion_futbol5, posicion_futbol7, posicion_futbol11)')
        .in('team_id', teamIds)
      setArquerosEquipos((tp || [])
        .filter(x => x.players && (x.players.posicion_futbol5 === 'Portero' || x.players.posicion_futbol7 === 'Portero' || x.players.posicion_futbol11 === 'Portero'))
        .map(x => ({ team_id: x.team_id, name: x.players.name, foto: x.players.photo_face_url || x.players.photo_url })))
    }
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
    try {
      // Eliminar grupos anteriores
      if (grupos.length > 0) {
        const { error: errDelGE } = await supabase.from('grupo_equipos').delete().eq('tournament_id', id)
        if (errDelGE) { showMsg(`No se pudieron borrar los grupos anteriores: ${errDelGE.message}`, 'error'); return }
        const { error: errDelG } = await supabase.from('tournament_grupos').delete().eq('tournament_id', id)
        if (errDelG) { showMsg(`No se pudieron borrar los grupos anteriores: ${errDelG.message}`, 'error'); return }
      }

      // Crear nuevos grupos
      const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const grpsInsert = Array.from({ length: numGrupos }, (_, i) => ({
        tournament_id: id,
        nombre: `Grupo ${letras[i]}`,
        orden: i,
      }))
      const { data: nuevosGrupos, error: errIns } = await supabase.from('tournament_grupos').insert(grpsInsert).select()
      if (errIns) { showMsg(`Error al crear los grupos: ${errIns.message}`, 'error'); return }
      if (!nuevosGrupos || nuevosGrupos.length === 0) { showMsg('No se pudieron crear los grupos (revisa permisos)', 'error'); return }

      // Distribuir equipos en grupos (serpentina)
      const equiposAleatorios = [...equipos].sort(() => Math.random() - 0.5)
      const geInsert = []
      equiposAleatorios.forEach((eq, i) => {
        const grupoIdx = i % numGrupos
        geInsert.push({ grupo_id: nuevosGrupos[grupoIdx].id, team_id: eq.id, tournament_id: id })
      })
      const { error: errGE } = await supabase.from('grupo_equipos').insert(geInsert)
      if (errGE) { showMsg(`Error al repartir los equipos: ${errGE.message}`, 'error'); return }

      // Guardar config en torneo
      await supabase.from('tournaments').update({ num_grupos: numGrupos, equipos_clasifican: clasificanPorGrupo, fase_actual: 'grupos' }).eq('id', id)

      showMsg(`${numGrupos} grupos creados ✓`)
      fetchGrupos()
      fetchTorneo()
    } catch (e) {
      console.error('Error al crear grupos:', e)
      showMsg(`Error inesperado: ${e?.message || e}`, 'error')
    } finally {
      setGenerandoGrupos(false)
    }
  }

  async function handleMoverEquipoGrupo(teamId, grupoIdDestino) {
    const { data, error } = await supabase.from('grupo_equipos').update({ grupo_id: grupoIdDestino }).eq('team_id', teamId).eq('tournament_id', id).select('team_id')
    if (error) { showMsg(`No se pudo mover el equipo: ${error.message}`, 'error'); return }
    if (!data || data.length === 0) { showMsg('No se pudo mover el equipo (sin permisos)', 'error'); return }
    showMsg('Equipo movido ✓')
    fetchGrupos()
  }

  async function handleGenerarPartidosGrupos() {
    if (!fechaGrupos) return showMsg('Selecciona una fecha', 'error')
    setGenerandoGrupos(true)
    try {
      // Eliminar partidos de grupos anteriores
      const { error: errDel } = await supabase.from('matches').delete().eq('tournament_id', id).eq('fase', 'grupo')
      if (errDel) { showMsg(`No se pudieron borrar los partidos anteriores: ${errDel.message}`, 'error'); return }

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
              played_at:     `${fechaGrupos}T${horaGrupos}:00-05:00`,
              status:        'scheduled',
              fase:          'grupo',
              grupo:         grupo.nombre,
              matchday:      jornada,
            })
          }
        }
        jornada++
      }

      const { error: errIns } = await supabase.from('matches').insert(inserts)
      if (errIns) { showMsg(`Error al generar los partidos: ${errIns.message}`, 'error'); return }
      showMsg(`${inserts.length} partidos de grupos generados ✓`)
      fetchPartidos()
    } catch (e) {
      console.error('Error al generar partidos de grupos:', e)
      showMsg(`Error inesperado: ${e?.message || e}`, 'error')
    } finally {
      setGenerandoGrupos(false)
    }
  }

  // Calcular tabla por grupo
  function getTablaGrupo(grupoId) {
    const P = getPuntosTorneo(torneo)
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
        if (p.home_score > p.away_score)      { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += P.victoria }
        else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += P.empate }
        else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += P.derrota }
      }
      if (tabla[p.away_team_id]) {
        tabla[p.away_team_id].pj++
        tabla[p.away_team_id].gf += p.away_score || 0
        tabla[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += P.victoria }
        else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += P.empate }
        else { tabla[p.away_team_id].pp++; tabla[p.away_team_id].pts += P.derrota }
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

  // Una vez que ya existen los grupos, el número real de clasificados por
  // grupo es el que quedó guardado en tournaments.equipos_clasifican (la
  // misma fuente que usa el jugador para su propia vista previa). El input
  // "Clasifican por grupo" de la configuración sigue editable en pantalla
  // mientras no se finalice la fase de grupos, pero cambiarlo ahí NO
  // re-guarda nada — si se usara ese valor local suelto acá, un cambio sin
  // querer en ese campo desincronizaba la vista previa en vivo del admin
  // respecto a la que ve el jugador (el jugador siempre lee el valor real
  // de la base de datos). Por eso, con grupos ya creados, se prioriza el
  // valor guardado.
  function getClasificados() {
    const porGrupo = grupos.length > 0 ? (torneo?.equipos_clasifican || clasificanPorGrupo) : clasificanPorGrupo
    const clasificados = []
    for (const grupo of grupos) {
      const tabla = getTablaGrupo(grupo.id)
      tabla.slice(0, porGrupo).forEach((row, pos) => {
        if (row.equipo) clasificados.push({ ...row.equipo, posicion: pos + 1, grupo: grupo.nombre, pts: row.pts, dg: row.gf - row.gc })
      })
    }
    return clasificados.sort((a, b) => a.posicion - b.posicion || b.pts - a.pts || b.dg - a.dg)
  }

  // Participantes de eliminatorias: clasificados directos + mejores de la
  // reclasificación (mejor perdedor) hasta completar n cupos
  function getParticipantesElim(n) {
    const directos = grupos.length > 0 ? getClasificados() : []
    let lista = [...directos]
    if (lista.length > n) lista = lista.slice(0, n)
    if (lista.length < n) {
      const idsYa = new Set(lista.map(e => e.id))
      calcTablaGeneral().forEach(row => {
        if (lista.length >= n || !row.equipo || idsYa.has(row.equipo.id)) return
        lista.push({ ...row.equipo, posicion: 99, grupo: directos.length > 0 ? 'Mejor perdedor' : null, pts: row.pts, dg: row.gf - row.gc, mejorPerdedor: directos.length > 0 })
        idsYa.add(row.equipo.id)
      })
    }
    return lista
  }

  function abrirWizardElim() {
    setOrdenManual(getParticipantesElim(numClasifElim))
    setLlavesManuales([])
    setShowWizardElim(true)
  }

  function cambiarCuposElim(n) {
    setNumClasifElim(n)
    setOrdenManual(getParticipantesElim(n))
    setLlavesManuales([])
    setEquipoByeId(null) // vuelve a elegir por defecto al último de la reclasificación
  }

  // Sorteo físico: arrastrar un equipo encima de otro arma esa llave.
  function handleFormarLlaveManual(a, b) {
    setLlavesManuales(prev => [...prev, [a, b]])
  }
  function handleDeshacerLlaveManual(i) {
    setLlavesManuales(prev => prev.filter((_, idx) => idx !== i))
  }


  // Si la cantidad de clasificados es impar, hay que decidir qué pasa con el
  // que sobra: (a) 🎟️ entra un mejor perdedor más de la reclasificación para
  // completar número par, o (b) ese equipo pasa directo a la siguiente ronda
  // sin jugar esta ("bye"), y el admin elige cuál con equipoByeId.
  function getParticipantesConImpar() {
    const base = getParticipantesElim(numClasifElim)
    if (base.length < 2 || base.length % 2 === 0) return { participantes: base, byeTeam: null }
    if (modoImpar === 'mejor_perdedor') {
      return { participantes: getParticipantesElim(numClasifElim + 1), byeTeam: null }
    }
    const idBye = equipoByeId && base.some(t => String(t.id) === String(equipoByeId)) ? equipoByeId : base[base.length - 1].id
    const byeTeam = base.find(t => String(t.id) === String(idBye))
    return { participantes: base.filter(t => String(t.id) !== String(idBye)), byeTeam }
  }

  // El equipo que pasa directo a la siguiente ronda sin jugar (o null si no aplica)
  function getByeInicial() {
    if (estiloLlaves === 'manual') return null // en sorteo físico el bye se maneja aparte (ver handleGenerarEliminatorias)
    return getParticipantesConImpar().byeTeam
  }

  // Parejas según el estilo elegido (para vista previa y generación).
  // Si en la vista previa en vivo se arrastraron equipos a mano (previewOrden),
  // se respeta ese mismo orden acá para que el árbol real que se cree quede
  // exactamente como se armó en la vista previa.
  function getParejasElim() {
    if (estiloLlaves === 'manual') return llavesManuales
    let { participantes } = getParticipantesConImpar()
    if (previewOrden && previewOrden.length === participantes.length) {
      const mapa = new Map(participantes.map(p => [String(p.id), p]))
      const idsOrden = previewOrden.map(String)
      if (idsOrden.every(idOrden => mapa.has(idOrden))) {
        participantes = idsOrden.map(idOrden => mapa.get(idOrden))
      }
    }
    const total = participantes.length
    const parejas = []
    if (estiloLlaves === 'cruzado') {
      for (let i = 0; i < Math.floor(total / 2); i++) parejas.push([participantes[i], participantes[total - 1 - i]])
    } else {
      for (let i = 0; i < total - 1; i += 2) parejas.push([participantes[i], participantes[i + 1]])
    }
    return parejas
  }

  async function handleGenerarEliminatorias() {
    try {
      let byeManual = null
      if (estiloLlaves === 'manual') {
        const idsEnLlaves = new Set(llavesManuales.flatMap(([a, b]) => [a.id, b.id]))
        const sinAsignar = ordenManual.filter(t => !idsEnLlaves.has(t.id))
        if (sinAsignar.length === 1) {
          byeManual = sinAsignar[0] // el único que sobra pasa directo automáticamente
        } else if (sinAsignar.length > 1) {
          return showMsg(`Faltan por emparejar: ${sinAsignar.map(t => t.name).join(', ')} — arrastralos encima de otro equipo`, 'error')
        }
      }
      const parejas = getParejasElim()
      const byeTeam = byeManual || getByeInicial()
      if (parejas.length < 1 && !byeTeam) return showMsg('Necesitas al menos 2 clasificados', 'error')

      const total = parejas.length * 2 + (byeTeam ? 1 : 0)
      const fase  = getFaseValue(total)
      const ronda = getRondaNombre(total)

      // Cada llave usa la fecha/hora que le pusiste en la vista previa en vivo
      // (previewCalendario) — si a alguna no le pusiste una puntual, se usa
      // la fecha general de respaldo (la del asistente, si la llenaste).
      const fechaHoraLlave = (i) => {
        const c = previewCalendario?.[fase]?.[i]
        return { fecha: c?.fecha || fechaElim, hora: c?.hora || horaElim || '08:00' }
      }
      const faltaFecha = parejas.some((_, i) => !fechaHoraLlave(i).fecha)
      if (faltaFecha) return showMsg('Faltan fechas — completalas en la vista previa en vivo (o poné una fecha general en "Ajustar cupos/formato" como respaldo)', 'error')

      const avisoBye = byeTeam ? ` — ${byeTeam.name} pasa directo a la siguiente ronda sin jugar` : ''
      if (!window.confirm(`Esto va a crear ${parejas.length} partido${parejas.length !== 1 ? 's' : ''} programado${parejas.length !== 1 ? 's' : ''} de verdad (no es la vista previa), con las fechas que armaste en la vista previa${avisoBye}. ¿Seguro que ya terminó la fase de grupos y querés crearlos?`)) return
      setGenerandoElim(true)

      // Aviso de tarjetas sin pagar — ya no bloquea, solo recuerda que hay
      // que cobrarlas (el admin decide si igual arma los partidos).
      const idsParticipantes = [...new Set([...parejas.flatMap(([a, b]) => [a?.id, b?.id]), byeTeam?.id].filter(Boolean))]
      const deudores = await getDeudoresTarjetas(idsParticipantes)
      if (deudores.length > 0) {
        showMsg(`⚠️ Recordatorio: tienen tarjetas sin pagar: ${deudores.map(d => `${d.name} (${fmt(d.deuda)})`).join(', ')} — registra los pagos en la pestaña Finanzas`, 'error')
      }

      // Eliminar eliminatorias anteriores
      const { error: errDel } = await supabase.from('matches').delete().eq('tournament_id', id).neq('fase', 'grupo')
      if (errDel) { showMsg(`No se pudo borrar el bracket anterior: ${errDel.message}`, 'error'); return }

      const inserts = []
      parejas.forEach(([local, visitante], i) => {
        const { fecha, hora } = fechaHoraLlave(i)
        inserts.push({
          tournament_id: id, home_team_id: local.id, away_team_id: visitante.id,
          played_at: `${fecha}T${hora}:00-05:00`, status: 'scheduled', fase, ronda, matchday: null, slot_index: i,
        })
        if (idaVuelta) {
          inserts.push({
            tournament_id: id, home_team_id: visitante.id, away_team_id: local.id,
            played_at: `${fecha}T${hora}:00-05:00`, status: 'scheduled', fase, ronda: `${ronda} (vuelta)`, matchday: null, slot_index: i,
          })
        }
      })

      const { error } = await supabase.from('matches').insert(inserts)
      if (error) { showMsg(`Error al crear el bracket: ${error.message}`, 'error'); return }
      await supabase.from('tournaments').update({ fase_actual: 'eliminatorias', bye_inicial_team_id: byeTeam?.id || null }).eq('id', id)
      showMsg(`${ronda} creada con ${parejas.length} llave${parejas.length !== 1 ? 's' : ''}${byeTeam ? ` — 🎟️ ${byeTeam.name} pasa directo` : ''} ✓`)
      setShowWizardElim(false)
      fetchPartidos(); fetchBracket(); fetchTorneo()
    } catch (e) {
      console.error('Error al generar eliminatorias:', e)
      showMsg(`Error inesperado: ${e?.message || e}`, 'error')
    } finally {
      setGenerandoElim(false)
    }
  }

  // Deshace el árbol de eliminatorias creado: borra los partidos reales de
  // eliminatorias (no toca los de grupos) y vuelve a dejar solo la vista
  // previa en vivo, por si se creó por error.
  async function handleQuitarBracket() {
    if (!window.confirm('¿Quitar el árbol de eliminatorias? Se borran todos los partidos de eliminatorias que ya se crearon (los de grupos quedan intactos) y volvés a ver solo la vista previa en vivo.')) return
    setGenerandoElim(true)
    try {
      const { error } = await supabase.from('matches').delete().eq('tournament_id', id).neq('fase', 'grupo')
      if (error) { showMsg(`No se pudo quitar: ${error.message}`, 'error'); return }
      await supabase.from('tournaments').update({ fase_actual: 'grupos', bye_inicial_team_id: null }).eq('id', id)
      showMsg('Árbol de eliminatorias quitado — volviste a la vista previa ✓')
      fetchPartidos(); fetchBracket(); fetchTorneo()
    } catch (e) {
      console.error('Error al quitar el bracket:', e)
      showMsg(`Error inesperado: ${e?.message || e}`, 'error')
    } finally {
      setGenerandoElim(false)
    }
  }

  // Agrupa los partidos del bracket en llaves por fase, con marcador global y ganador
  function getLlavesPorFase() {
    const porFase = {}
    FASE_ORDEN.forEach(f => {
      const ms = bracket.filter(p => p.fase === f)
      if (ms.length === 0) return
      const map = {}
      ms.forEach(m => {
        const key = [m.home_team_id, m.away_team_id].sort().join('|')
        if (!map[key]) map[key] = []
        map[key].push(m)
      })
      porFase[f] = Object.values(map).map(matches => {
        const primero = matches[0]
        const teamA = { id: primero.home_team_id, name: primero.home?.name, logo_url: primero.home?.logo_url }
        const teamB = { id: primero.away_team_id, name: primero.away?.name, logo_url: primero.away?.logo_url }
        const terminada = matches.every(m => m.status === 'finished')
        let golesA = 0, golesB = 0
        matches.forEach(m => {
          if (m.status !== 'finished') return
          if (m.home_team_id === teamA.id) { golesA += m.home_score || 0; golesB += m.away_score || 0 }
          else                             { golesA += m.away_score || 0; golesB += m.home_score || 0 }
        })
        let ganador = null, porPenales = false
        if (terminada) {
          if (golesA > golesB) ganador = teamA
          else if (golesB > golesA) ganador = teamB
          else {
            const conPenales = [...matches].reverse().find(m => m.penales_ganador || (m.penales_local != null && m.penales_visitante != null && m.penales_local !== m.penales_visitante))
            if (conPenales) {
              porPenales = true
              const ganaHome = conPenales.penales_ganador ? conPenales.penales_ganador === 'home' : conPenales.penales_local > conPenales.penales_visitante
              const idGanador = ganaHome ? conPenales.home_team_id : conPenales.away_team_id
              ganador = idGanador === teamA.id ? teamA : teamB
            }
          }
        }
        return { matches, teamA, teamB, golesA, golesB, terminada, ganador, porPenales, slotIndex: primero.slot_index }
      })
      // Orden estable por casilla (slot_index) — así "llave 0" siempre es la
      // misma casilla del árbol, sin importar en qué orden hayan quedado los
      // resultados o si se editó una fecha después. Las llaves viejas de
      // antes de este cambio (sin slot_index) quedan al final, en el orden
      // que ya traía la consulta.
      porFase[f].sort((a, b) => {
        if (a.slotIndex == null && b.slotIndex == null) return 0
        if (a.slotIndex == null) return 1
        if (b.slotIndex == null) return -1
        return a.slotIndex - b.slotIndex
      })
    })
    return porFase
  }

  // Ordena una lista de equipos según la tabla de reclasificación (fase de grupos)
  function rankPorReclasificacion(lista) {
    const pos = {}
    calcTablaGeneral().forEach((row, i) => { if (row.equipo) pos[row.equipo.id] = i })
    return [...lista].sort((a, b) => (pos[a.id] ?? 999) - (pos[b.id] ?? 999))
  }

  // Estado actual de las eliminatorias: vivos (incluye byes), perdedores, empates, repechaje
  function getEstadoEliminatorias() {
    const porFase = getLlavesPorFase()
    const fasesExist = FASE_ORDEN.filter(f => porFase[f])
    if (fasesExist.length === 0) return null
    // Si el torneo arrancó las eliminatorias con número impar de clasificados
    // y a un equipo le tocó pasar directo (bye_inicial_team_id), ese equipo
    // nunca jugó un partido en la primera fase — hay que sumarlo a mano como
    // "vivo" desde esa primera fase para que cuente igual que los demás byes.
    const byeInicial = torneo?.bye_inicial_team_id ? equipos.find(e => e.id === torneo.bye_inicial_team_id) : null
    let vivos = null
    fasesExist.forEach((f, idx) => {
      const llavesF = porFase[f]
      const enFase = new Set(llavesF.flatMap(l => [l.teamA.id, l.teamB.id]))
      const ganadoresF = llavesF.map(l => l.ganador).filter(Boolean)
      let byes = vivos ? vivos.filter(v => !enFase.has(v.id)) : []
      if (idx === 0 && byeInicial && !enFase.has(byeInicial.id) && !byes.some(v => v.id === byeInicial.id)) {
        byes = [...byes, byeInicial]
      }
      vivos = [...ganadoresF, ...byes]
    })
    const actual = fasesExist[fasesExist.length - 1]
    const llaves = porFase[actual]
    const enFaseActual = new Set(llaves.flatMap(l => [l.teamA.id, l.teamB.id]))
    const perdedores = llaves.map(l => l.ganador ? (l.ganador.id === l.teamA.id ? l.teamB : l.teamA) : null).filter(Boolean)
    const vivosIds = new Set(vivos.map(v => v.id))
    const perdedoresElegibles = []
    perdedores.forEach(p => { if (!vivosIds.has(p.id) && !perdedoresElegibles.some(x => x.id === p.id)) perdedoresElegibles.push(p) })
    const byesActuales = vivos.filter(v => !enFaseActual.has(v.id))
    const completa = llaves.every(l => l.terminada)
    const hayEmpates = completa && llaves.some(l => !l.ganador)
    // Semifinal de 3: ya se jugó el 1° vs 2° y el 3° espera al perdedor
    const repechajePendiente = actual === 'semifinal' && llaves.length === 1 && completa && !hayEmpates && byesActuales.length === 1
    return { porFase, fasesExist, actual, llaves, vivos, perdedores, perdedoresElegibles, byesActuales, completa, hayEmpates, repechajePendiente }
  }

  async function handleGuardarPenales() {
    const pl = parseInt(penalesForm.local), pv = parseInt(penalesForm.visitante)
    if (isNaN(pl) || isNaN(pv)) return showMsg('Ingresa los penales de ambos equipos', 'error')
    if (pl === pv) return showMsg('Los penales no pueden quedar empatados', 'error')
    setGuardandoPenales(true)
    const { error } = await supabase.from('matches')
      .update({ penales_local: pl, penales_visitante: pv, penales_ganador: pl > pv ? 'home' : 'away' })
      .eq('id', partidoPenales.id)
    setGuardandoPenales(false)
    if (error) return showMsg('Error al guardar los penales', 'error')
    showMsg('Penales registrados ✓ — ganador definido')
    setPartidoPenales(null)
    setPenalesForm({ local: '', visitante: '' })
    fetchBracket(); fetchPartidos()
  }

  // Equipos disponibles para entrar en una llave (eliminados o que no clasificaron)
  function getEquiposParaReemplazo() {
    const est = getEstadoEliminatorias()
    const ocupados = new Set()
    bracket.forEach(m => { if (m.status !== 'finished') { ocupados.add(m.home_team_id); ocupados.add(m.away_team_id) } })
    ;(est?.vivos || []).forEach(v => ocupados.add(v.id))
    return equipos.filter(e => !ocupados.has(e.id))
  }

  async function handleReemplazarEquipo() {
    if (!equipoSale || !equipoEntra) return showMsg('Selecciona el equipo que sale y el que entra', 'error')
    if (reemplazoLlave.matches.some(m => m.status === 'finished')) return showMsg('No se puede reemplazar: esta llave ya tiene partidos jugados', 'error')
    setGuardandoReemplazo(true)
    for (const m of reemplazoLlave.matches) {
      const upd = {}
      if (m.home_team_id === equipoSale) upd.home_team_id = equipoEntra
      if (m.away_team_id === equipoSale) upd.away_team_id = equipoEntra
      if (Object.keys(upd).length > 0) await supabase.from('matches').update(upd).eq('id', m.id)
    }
    setGuardandoReemplazo(false)
    const entra = equipos.find(e => e.id === equipoEntra)
    showMsg(`Equipo reemplazado ✓ — entra ${entra?.name || ''}`)
    setReemplazoLlave(null); setEquipoSale(''); setEquipoEntra('')
    fetchBracket(); fetchPartidos()
  }

  // ── FINANZAS ────────────────────────────────────────

  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')

  async function fetchFinanzas() {
    const [{ data: movs }, { data: evs }, { data: st }] = await Promise.all([
      supabase.from('torneo_finanzas').select('*, teams(name), players(name)').eq('tournament_id', id).order('created_at', { ascending: false }),
      // Tarjetas de DOS fuentes combinadas:
      // 1. Eventos del partido: incluyen jugadores sin registro (con su nombre)
      // 2. Estadísticas: respaldo para partidos viejos guardados sin eventos
      // players!player_id (no players(...) a secas): match_events tiene más
      // de una relación hacia players, así que hay que decirle a PostgREST
      // cuál columna usar para el embed, si no tira "more than one
      // relationship was found".
      supabase.from('match_events').select('match_id, player_id, team_id, event_type, player_nombre, players!player_id(name)')
        .eq('tournament_id', id).in('event_type', ['yellow_card', 'blue_card', 'red_card']),
      supabase.from('player_match_stats').select('match_id, player_id, team_id, yellow_cards, yellow_paid, blue_cards, blue_paid, red_cards, red_paid, players(name)')
        .eq('tournament_id', id),
    ])
    setMovimientos(movs || [])

    // Tarjetas de este jugador que todavía no se han marcado como pagadas
    // (independiente del saldo del equipo) — para el botón "Pagar" y para
    // que deje de salirle la advertencia en la planilla del próximo partido.
    const pendientes = {}
    ;(st || []).forEach(s => {
      if (!s.player_id) return
      if (!pendientes[s.player_id]) pendientes[s.player_id] = { am: 0, az: 0, rj: 0 }
      if ((s.yellow_cards || 0) > 0 && !s.yellow_paid) pendientes[s.player_id].am += 1
      if ((s.blue_cards   || 0) > 0 && !s.blue_paid)   pendientes[s.player_id].az += 1
      if ((s.red_cards    || 0) > 0 && !s.red_paid)    pendientes[s.player_id].rj += 1
    })
    setPendientesTarjetas(pendientes)

    let eventos = evs
    if (!eventos) {
      // Respaldo si la columna player_nombre aún no existe (falta migración)
      const { data: evs2 } = await supabase.from('match_events').select('match_id, player_id, team_id, event_type, players!player_id(name)')
        .eq('tournament_id', id).in('event_type', ['yellow_card', 'blue_card', 'red_card'])
      eventos = evs2 || []
    }

    // Normalizar: filas { team_id, player_id, match_id, nombre, am, az, rj }
    // Si un partido tiene eventos de tarjeta, manda el evento; si no tiene
    // ninguno (planilla vieja), se usan sus estadísticas. match_id se guarda
    // para poder agrupar por partido más abajo (regla: si un jugador tiene
    // varias tarjetas en el MISMO partido, solo se cobra la de mayor valor).
    const partidosConEventos = new Set(eventos.map(e => e.match_id))
    const filasTarjetas = []
    eventos.forEach(e => filasTarjetas.push({
      team_id: e.team_id, player_id: e.player_id, match_id: e.match_id,
      nombre: e.players?.name || (e.player_nombre ? `${e.player_nombre} (sin registro)` : 'Jugador sin registro'),
      am: e.event_type === 'yellow_card' ? 1 : 0,
      az: e.event_type === 'blue_card'   ? 1 : 0,
      rj: e.event_type === 'red_card'    ? 1 : 0,
    }))
    ;(st || []).forEach(s => {
      if (partidosConEventos.has(s.match_id)) return
      const am = s.yellow_cards || 0, az = s.blue_cards || 0, rj = s.red_cards || 0
      if (am + az + rj === 0) return
      filasTarjetas.push({ team_id: s.team_id, player_id: s.player_id, match_id: s.match_id, nombre: s.players?.name, am, az, rj })
    })
    setStatsTarjetas(filasTarjetas)
  }

  // Cuentas calculadas automáticamente desde los partidos y planillas
  function calcFinanzas() {
    const fc = torneo?.finanzas_config || {}
    const pA = fc.precio_amarilla || 0, pZ = fc.precio_azul || 0, pR = fc.precio_roja || 0
    const jugados = partidos.filter(p => p.status === 'finished' && p.tipo_resultado !== 'w')
    const partidosW = partidos.filter(p => p.status === 'finished' && p.tipo_resultado === 'w')

    const porEquipo = {}
    equipos.forEach(e => {
      porEquipo[e.id] = { equipo: e, inscripcion: fc.inscripcion || 0, arbitrajes: 0, w: 0, multas: 0, deudas: 0, tarjetas: 0, tarjetasDetalle: [], pagosTarjetas: 0, pagosOtros: 0 }
    })

    jugados.forEach(m => {
      if (porEquipo[m.home_team_id]) porEquipo[m.home_team_id].arbitrajes += fc.arbitraje_equipo || 0
      if (porEquipo[m.away_team_id]) porEquipo[m.away_team_id].arbitrajes += fc.arbitraje_equipo || 0
    })
    partidosW.forEach(m => {
      const presentaId = (m.home_score || 0) > (m.away_score || 0) ? m.home_team_id : m.away_team_id
      const ausenteId  = presentaId === m.home_team_id ? m.away_team_id : m.home_team_id
      if (porEquipo[presentaId]) porEquipo[presentaId].w     += fc.valor_w_presenta || 0
      if (porEquipo[ausenteId])  porEquipo[ausenteId].multas += fc.multa_no_presenta || 0
    })

    // Tarjetas por jugador (filas ya normalizadas en fetchFinanzas). No se
    // omite a nadie aunque el precio esté en $0: la tarjeta se ve igual.
    // Los sin registro se identifican por su nombre (no se fusionan entre sí).
    //
    // REGLA: si a un jugador le sacan varias tarjetas en el MISMO partido, solo
    // se le cobra la de mayor valor de ese partido (no la suma de todas). Por
    // eso primero se agrupa por partido y se calcula el máximo ahí, y recién
    // después se suma entre partidos distintos. am/az/rj siguen sumando TODAS
    // las tarjetas (para mostrar el detalle completo), solo "valor" cambia.
    const porJugadorPartido = {}
    statsTarjetas.forEach(s => {
      if ((s.am || 0) + (s.az || 0) + (s.rj || 0) === 0) return
      const keyJugador = `${s.team_id}|${s.player_id || 'nr:' + (s.nombre || 'sin nombre')}`
      const keyPartido = `${keyJugador}|${s.match_id || 'sp:' + Math.random()}`
      if (!porJugadorPartido[keyPartido]) porJugadorPartido[keyPartido] = { keyJugador, team_id: s.team_id, player_id: s.player_id, nombre: s.nombre || 'Jugador sin registro', am: 0, az: 0, rj: 0 }
      porJugadorPartido[keyPartido].am += s.am || 0
      porJugadorPartido[keyPartido].az += s.az || 0
      porJugadorPartido[keyPartido].rj += s.rj || 0
    })
    const porJugador = {}
    Object.values(porJugadorPartido).forEach(p => {
      if (!porJugador[p.keyJugador]) porJugador[p.keyJugador] = { team_id: p.team_id, player_id: p.player_id, nombre: p.nombre, am: 0, az: 0, rj: 0, valor: 0 }
      porJugador[p.keyJugador].am += p.am
      porJugador[p.keyJugador].az += p.az
      porJugador[p.keyJugador].rj += p.rj
      porJugador[p.keyJugador].valor += Math.max(p.am > 0 ? pA : 0, p.az > 0 ? pZ : 0, p.rj > 0 ? pR : 0)
    })
    Object.values(porJugador).forEach(j => {
      if (porEquipo[j.team_id]) {
        porEquipo[j.team_id].tarjetas += j.valor
        porEquipo[j.team_id].tarjetasDetalle.push(j)
      }
    })

    movimientos.forEach(mv => {
      if (!porEquipo[mv.team_id]) return
      if (mv.tipo === 'pago_tarjetas') porEquipo[mv.team_id].pagosTarjetas += mv.monto || 0
      if (mv.tipo === 'pago_cargos')   porEquipo[mv.team_id].pagosOtros   += mv.monto || 0
      if (mv.tipo === 'cargo_manual')  porEquipo[mv.team_id].deudas       += mv.monto || 0 // deuda anotada a mano
    })

    const filas = Object.values(porEquipo).map(r => {
      const cargos = r.inscripcion + r.arbitrajes + r.w + r.multas + r.deudas + r.tarjetas
      // El arbitraje se paga en efectivo directo en la cancha el día del partido:
      // en cuanto el partido queda "jugado" se da por pagado automáticamente, no
      // hace falta registrar ese pago a mano. Lo único manual sigue siendo
      // inscripción (abonos), multas/W y tarjetas.
      const pagado = r.pagosTarjetas + r.pagosOtros + r.arbitrajes
      return { ...r, cargos, pagado, saldo: cargos - pagado, saldoTarjetas: r.tarjetas - r.pagosTarjetas }
    }).sort((a, b) => b.saldo - a.saldo)

    const gastoCanchas  = jugados.length * (fc.pago_cancha_partido || 0) + partidosW.length * (fc.pago_cancha_w || 0)
    const gastoArbitros = jugados.length * (fc.pago_arbitro_partido || 0) + partidosW.length * (fc.pago_arbitro_w || 0)
    const gastos = gastoCanchas + gastoArbitros
    const ingresosEsperados = filas.reduce((a, r) => a + r.cargos, 0)
    const recaudado = filas.reduce((a, r) => a + r.pagado, 0)

    return { fc, filas, jugados: jugados.length, ws: partidosW.length, gastoCanchas, gastoArbitros, gastos, ingresosEsperados, recaudado, gananciaEsperada: ingresosEsperados - gastos, gananciaActual: recaudado - gastos }
  }

  // yellow_paid/blue_paid/red_paid es lo único que revisa la planilla para
  // saber si un jugador "debe tarjeta" — columnasTarjeta() centraliza el
  // mapeo color → columnas para no repetirlo en cada función que las toca.
  function columnasTarjeta(color) {
    return color === 'am' ? { pagado: 'yellow_paid', cantidad: 'yellow_cards' }
      : color === 'az' ? { pagado: 'blue_paid', cantidad: 'blue_cards' }
      : { pagado: 'red_paid', cantidad: 'red_cards' }
  }

  async function marcarTarjetaPagada(playerId, color) {
    const { pagado, cantidad } = columnasTarjeta(color)
    return supabase.from('player_match_stats').update({ [pagado]: true })
      .eq('tournament_id', id).eq('player_id', playerId).gt(cantidad, 0)
  }

  function toggleTarjetaAPagar(playerId, color, nombre) {
    setTarjetasAPagar(prev => prev.some(t => t.player_id === playerId && t.color === color)
      ? prev.filter(t => !(t.player_id === playerId && t.color === color))
      : [...prev, { player_id: playerId, color, nombre }])
  }

  async function handleRegistrarPago() {
    const monto = parseFloat(pagoForm.monto)
    const esDeuda = pagoForm.tipo === 'cargo_manual'
    if (!monto || monto <= 0) return showMsg(esDeuda ? 'Ingresa el monto de la deuda' : 'Ingresa el monto del pago', 'error')
    setGuardandoPago(true)
    const { error } = await supabase.from('torneo_finanzas').insert({
      tournament_id: id, team_id: pagoModal.id, tipo: pagoForm.tipo, monto,
      concepto: pagoForm.concepto || (esDeuda ? 'Deuda anotada' : pagoForm.tipo === 'pago_tarjetas' ? 'Pago de tarjetas' : 'Pago de cargos'),
    })
    if (error) { setGuardandoPago(false); return showMsg('Error al registrar (¿ejecutaste migracion_finanzas.sql?)', 'error') }

    // Si al registrar el pago se marcaron tarjetas puntuales como pagadas
    // (checklist del modal), eso es lo que de verdad desbloquea al jugador
    // en la planilla — el pago de arriba solo mueve el saldo del equipo.
    if (!esDeuda && tarjetasAPagar.length > 0) {
      await Promise.all(tarjetasAPagar.map(t => marcarTarjetaPagada(t.player_id, t.color)))
    }
    setGuardandoPago(false)
    showMsg(esDeuda ? 'Deuda anotada ✓ — sumada al saldo del equipo'
      : tarjetasAPagar.length > 0 ? `Pago registrado ✓ — ${tarjetasAPagar.length} tarjeta(s) desbloqueada(s) en la planilla` : 'Pago registrado ✓')
    setPagoModal(null); setPagoForm({ tipo: 'pago_tarjetas', monto: '', concepto: '' }); setTarjetasAPagar([])
    fetchFinanzas()
  }

  async function handleEliminarPago(mv) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('torneo_finanzas').delete().eq('id', mv.id)
    fetchFinanzas()
  }

  // Deuda personal (inscripción sin pagar x2, repartida entre jugadores) —
  // es lo único que sigue a un jugador a los próximos torneos del MISMO
  // organizador. Se marca pagada acá cuando el jugador se pone al día.
  async function handleMarcarDeudaPersonalPagada(mv) {
    if (!confirm(`¿Marcar como pagada la deuda de ${mv.players?.name || 'este jugador'} (${fmt(mv.monto)})?`)) return
    const { error } = await supabase.from('torneo_finanzas').update({ pagado: true }).eq('id', mv.id)
    if (error) return showMsg('Error al marcar como pagada', 'error')
    showMsg('Deuda personal marcada como pagada ✓ — ya puede inscribirse en próximos torneos de este organizador')
    fetchFinanzas()
  }

  // Marca como pagadas TODAS las tarjetas pendientes de un color de un
  // jugador en este torneo — así deja de salirle la advertencia "debe
  // tarjeta" en la planilla del próximo partido. No toca el saldo del
  // equipo (eso lo sigue manejando el botón "💵 Pago" de arriba).
  // Abre el modal de pago con el monto YA calculado para ese jugador (la
  // regla de "solo se cobra la tarjeta más cara del partido" ya está
  // aplicada en j.valor, que viene de calcFinanzas) y con sus tarjetas
  // pendientes pre-marcadas, para no tener que escribir el monto a mano.
  function abrirPagoJugador(equipo, j) {
    const pend = (j.player_id && pendientesTarjetas[j.player_id]) || { am: 0, az: 0, rj: 0 }
    const marcar = []
    if (pend.am > 0) marcar.push({ player_id: j.player_id, color: 'am', nombre: j.nombre })
    if (pend.az > 0) marcar.push({ player_id: j.player_id, color: 'az', nombre: j.nombre })
    if (pend.rj > 0) marcar.push({ player_id: j.player_id, color: 'rj', nombre: j.nombre })
    setPagoForm({ tipo: 'pago_tarjetas', monto: String(Math.round(j.valor || 0)), concepto: `Tarjeta(s) de ${j.nombre}` })
    setTarjetasAPagar(marcar)
    setPagoModal({ ...equipo, tarjetasDetalle: [j] })
  }

  async function handlePagarTarjetaJugador(playerId, color, nombre) {
    const { error } = await marcarTarjetaPagada(playerId, color)
    if (error) return showMsg('Error al marcar como pagada', 'error')
    showMsg(`Tarjeta de ${nombre || 'jugador'} marcada como pagada ✓`)
    fetchFinanzas()
  }

  // ── Configurar precios de finanzas (editables en cualquier momento) ──────
  function abrirConfigFin() {
    const fc = torneo?.finanzas_config || {}
    setFormFin({
      inscripcion: fc.inscripcion || 0, arbitraje_equipo: fc.arbitraje_equipo || 0,
      valor_w_presenta: fc.valor_w_presenta || 0, multa_no_presenta: fc.multa_no_presenta || 0,
      precio_amarilla: fc.precio_amarilla || 0, precio_azul: fc.precio_azul || 0, precio_roja: fc.precio_roja || 0,
      pago_cancha_partido: fc.pago_cancha_partido || 0, pago_cancha_w: fc.pago_cancha_w || 0,
      pago_arbitro_partido: fc.pago_arbitro_partido || 0, pago_arbitro_w: fc.pago_arbitro_w || 0,
    })
    setShowConfigFin(true)
  }

  async function handleGuardarConfigFin() {
    setGuardandoFin(true)
    const fc = { ...(torneo?.finanzas_config || {}), llevar_cuentas: true }
    Object.keys(formFin).forEach(k => { fc[k] = parseFloat(formFin[k]) || 0 })
    const { error } = await supabase.from('tournaments').update({ finanzas_config: fc }).eq('id', id)
    setGuardandoFin(false)
    if (error) return showMsg('Error al guardar precios: ' + error.message, 'error')
    setTorneo(p => ({ ...p, finanzas_config: fc }))
    setShowConfigFin(false)
    showMsg('Precios actualizados ✓ — todas las cuentas se recalcularon')
  }

  // ── PERSONALIZACIÓN ─────────────────────────────────
  async function fetchTorneoSponsors() {
    setLoadingSponsors(true)
    const { data, error } = await supabase
      .from('tournament_sponsors')
      .select('*')
      .eq('tournament_id', id)
      .order('orden', { ascending: true })
    setLoadingSponsors(false)
    if (error) return showMsg('Error cargando patrocinadores (¿ejecutaste migracion_tournament_sponsors.sql?)', 'error')
    setTorneoSponsors(data || [])
  }

  async function handleGuardarMarca() {
    setGuardandoMarca(true)
    const payload = {
      custom_domain:    formMarca.custom_domain?.trim().toLowerCase() || null, // en minúsculas — el navegador compara el hostname en minúsculas
      color_primario:   formMarca.color_primario?.trim() || null,
      color_secundario: formMarca.color_secundario?.trim() || null,
      favicon_url:      formMarca.favicon_url || null,
      logo_url:         formMarca.logo_url || torneo.logo_url || null,
    }
    const { error } = await supabase.from('tournaments').update(payload).eq('id', id)
    setGuardandoMarca(false)
    if (error) return showMsg('Error al guardar marca: ' + error.message, 'error')
    setTorneo(p => ({ ...p, ...payload }))
    showMsg('Marca guardada ✓')
  }

  async function handleUploadFavicon(file) {
    if (!file) return
    setUploadingFavicon(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/favicon.${ext}`
    const { error: uploadError } = await supabase.storage.from('torneo-branding').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingFavicon(false); return showMsg('Error al subir favicon: ' + uploadError.message, 'error') }
    const { data: urlData } = supabase.storage.from('torneo-branding').getPublicUrl(path)
    const url = urlData.publicUrl
    const { error } = await supabase.from('tournaments').update({ favicon_url: url }).eq('id', id)
    setUploadingFavicon(false)
    if (error) return showMsg('Error al guardar favicon', 'error')
    setFormMarca(f => ({ ...f, favicon_url: url }))
    setTorneo(p => ({ ...p, favicon_url: url }))
    showMsg('Favicon subido ✓')
  }

  async function handleUploadLogoMarca(file) {
    if (!file) return
    setUploadingLogoMarca(true)
    // Mismo bucket/path que el botón cámara del encabezado — no duplicar storage
    const ext = file.name.split('.').pop()
    const path = `logos/${id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('tournaments').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingLogoMarca(false); return showMsg('Error al subir logo: ' + uploadError.message, 'error') }
    const { data: urlData } = supabase.storage.from('tournaments').getPublicUrl(path)
    const url = urlData.publicUrl
    const { error } = await supabase.from('tournaments').update({ logo_url: url }).eq('id', id)
    setUploadingLogoMarca(false)
    if (error) return showMsg('Error al guardar logo', 'error')
    setFormMarca(f => ({ ...f, logo_url: url }))
    setTorneo(p => ({ ...p, logo_url: url }))
    showMsg('Logo subido ✓')
  }

  function updateSponsorLocal(sponsorId, field, value) {
    setTorneoSponsors(prev => prev.map(s => s.id === sponsorId ? { ...s, [field]: value } : s))
  }

  async function saveSponsorField(sponsor, field, value) {
    setSavingSponsorId(sponsor.id)
    const { error } = await supabase.from('tournament_sponsors').update({ [field]: value }).eq('id', sponsor.id)
    setSavingSponsorId(null)
    if (error) showMsg('Error al guardar patrocinador', 'error')
  }

  async function handleAgregarSponsor() {
    const orden = torneoSponsors.length > 0 ? Math.max(...torneoSponsors.map(s => s.orden || 0)) + 1 : 0
    const { data, error } = await supabase.from('tournament_sponsors').insert({
      tournament_id: id,
      nombre: '',
      logo_url: null,
      link: null,
      orden,
    }).select().single()
    if (error) return showMsg('Error al agregar patrocinador: ' + error.message, 'error')
    setTorneoSponsors(prev => [...prev, data])
  }

  async function handleSponsorLogo(sponsor, file) {
    if (!file) return
    setUploadingSponsorId(sponsor.id)
    const ext = file.name.split('.').pop()
    const path = `${id}/sponsors/${sponsor.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('torneo-branding').upload(path, file, { upsert: true })
    if (uploadError) { setUploadingSponsorId(null); return showMsg('Error al subir logo', 'error') }
    const { data: urlData } = supabase.storage.from('torneo-branding').getPublicUrl(path)
    const { error } = await supabase.from('tournament_sponsors').update({ logo_url: urlData.publicUrl }).eq('id', sponsor.id)
    setUploadingSponsorId(null)
    if (error) return showMsg('Error al guardar logo del patrocinador', 'error')
    setTorneoSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, logo_url: urlData.publicUrl } : s))
    showMsg('Logo del patrocinador subido ✓')
  }

  async function handleEliminarSponsor(sponsor) {
    if (!confirm(`¿Eliminar patrocinador${sponsor.nombre ? ` "${sponsor.nombre}"` : ''}?`)) return
    const { error } = await supabase.from('tournament_sponsors').delete().eq('id', sponsor.id)
    if (error) return showMsg('Error al eliminar', 'error')
    setTorneoSponsors(prev => prev.filter(s => s.id !== sponsor.id))
    showMsg('Patrocinador eliminado')
  }

  // Equipos con tarjetas sin pagar (para bloquear eliminatorias)
  async function getDeudoresTarjetas(teamIds) {
    const fc = torneo?.finanzas_config || {}
    const pA = fc.precio_amarilla || 0, pZ = fc.precio_azul || 0, pR = fc.precio_roja || 0
    if (pA + pZ + pR === 0) return []
    const { data: st } = await supabase.from('player_match_stats').select('team_id, yellow_cards, blue_cards, red_cards').eq('tournament_id', id)
    const { data: pagos } = await supabase.from('torneo_finanzas').select('team_id, monto').eq('tournament_id', id).eq('tipo', 'pago_tarjetas')
    const saldo = {}
    // Cada fila ya es un jugador en UN partido: si tiene varias tarjetas ese
    // partido, solo se cobra la de mayor valor (no la suma de todas).
    ;(st || []).forEach(s => { saldo[s.team_id] = (saldo[s.team_id] || 0) + Math.max(s.yellow_cards > 0 ? pA : 0, s.blue_cards > 0 ? pZ : 0, s.red_cards > 0 ? pR : 0) })
    ;(pagos || []).forEach(p => { saldo[p.team_id] = (saldo[p.team_id] || 0) - (p.monto || 0) })
    return teamIds
      .filter(tid => (saldo[tid] || 0) > 0)
      .map(tid => ({ id: tid, deuda: saldo[tid], name: equipos.find(e => e.id === tid)?.name || 'Equipo' }))
  }

  // Guarda en tournament_logros la fase alcanzada por cada equipo y sus jugadores,
  // más campeón, subcampeón y tercer puesto (hoja de vida de equipos y jugadores)
  async function handleGuardarLogrosTorneo() {
    const porFase = getLlavesPorFase()
    const llaveFinal = porFase['final']?.find(l => !(l.matches[0].ronda || '').toLowerCase().includes('tercer'))
    if (!llaveFinal?.ganador) return showMsg('La final aún no tiene ganador', 'error')
    if (!confirm('¿Guardar los logros del torneo en la hoja de vida de los equipos y sus jugadores?')) return
    setGuardandoLogros(true)

    const campeonEq    = llaveFinal.ganador
    const subcampeonEq = llaveFinal.ganador.id === llaveFinal.teamA.id ? llaveFinal.teamB : llaveFinal.teamA
    const llaveTercer  = porFase['final']?.find(l => (l.matches[0].ronda || '').toLowerCase().includes('tercer'))
    const tercerEq     = llaveTercer?.ganador || null

    // Fase máxima que jugó cada equipo (sin contar el partido de tercer puesto)
    const peso = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }
    const faseMax = {}
    bracket.forEach(m => {
      if ((m.ronda || '').toLowerCase().includes('tercer')) return
      ;[m.home_team_id, m.away_team_id].forEach(tid => {
        if (!faseMax[tid] || peso[m.fase] > peso[faseMax[tid]]) faseMax[tid] = m.fase
      })
    })

    const tipoEquipo = {}
    equipos.forEach(e => {
      if (e.id === campeonEq.id)                tipoEquipo[e.id] = 'campeon'
      else if (e.id === subcampeonEq.id)        tipoEquipo[e.id] = 'subcampeon'
      else if (tercerEq && e.id === tercerEq.id) tipoEquipo[e.id] = 'tercer_puesto'
      else                                      tipoEquipo[e.id] = faseMax[e.id] || 'fase_grupos'
    })

    // Reemplazar logros de fase anteriores de este torneo (los MVP no se tocan)
    const TIPOS_FASE = ['campeon', 'subcampeon', 'tercer_puesto', 'final', 'semifinal', 'cuartos', 'octavos', 'fase_grupos']
    await supabase.from('tournament_logros').delete().eq('tournament_id', id).in('tipo', TIPOS_FASE)

    // Cada logro se guarda por jugador (con el team_id del equipo): así queda en la
    // hoja de vida del jugador y del equipo a la vez. (La BD no acepta filas sin jugador.)
    const inserts = []
    jugadores.forEach(j => {
      if (!j.player_id || !j.team_id || !tipoEquipo[j.team_id]) return
      inserts.push({ tournament_id: id, team_id: j.team_id, player_id: j.player_id, tipo: tipoEquipo[j.team_id] })
    })
    if (inserts.length === 0) { setGuardandoLogros(false); return showMsg('No hay jugadores inscritos para guardar logros', 'error') }
    const { error } = await supabase.from('tournament_logros').insert(inserts)
    setGuardandoLogros(false)
    if (error) return showMsg(`Error al guardar los logros: ${error.message}`, 'error')

    // Al cerrar el torneo: las tarjetas sin pagar quedan así (ya NO generan
    // deuda personal ni se cobran en otros torneos). Lo ÚNICO que sigue al
    // jugador a futuros torneos es la inscripción que su equipo dejó sin
    // pagar: se DUPLICA y se reparte entre los jugadores inscritos de ese
    // equipo, como deuda personal. Esa deuda solo bloquea inscripciones en
    // torneos del MISMO organizador (ver jugador_tiene_deuda en la BD) — si
    // quedó debiendo en un torneo de Golmebol, solo le sale ese cobro en
    // otros torneos de Golmebol, no en los de otro organizador.
    let deudoresPersonales = 0
    try {
      const fc = torneo?.finanzas_config || {}
      const inscripcionFee = fc.inscripcion || 0
      // Se limpian las deudas personales de este torneo en cualquier caso
      // (por si se corrige un pago y se vuelve a guardar logros).
      await supabase.from('torneo_finanzas').delete().eq('tournament_id', id).eq('tipo', 'deuda_personal')

      if (fc.llevar_cuentas && inscripcionFee > 0) {
        const { data: pagosCargos } = await supabase.from('torneo_finanzas').select('team_id, monto').eq('tournament_id', id).eq('tipo', 'pago_cargos')
        const pagadoPorEquipo = {}
        ;(pagosCargos || []).forEach(p => { pagadoPorEquipo[p.team_id] = (pagadoPorEquipo[p.team_id] || 0) + (p.monto || 0) })

        const deudas = []
        equipos.forEach(eq => {
          const pagado = pagadoPorEquipo[eq.id] || 0
          const deudaInscripcion = Math.max(0, inscripcionFee - pagado)
          if (deudaInscripcion <= 0) return
          const montoDoble = deudaInscripcion * 2
          const jugadoresEquipo = jugadores.filter(j => j.team_id === eq.id && j.player_id)
          if (jugadoresEquipo.length === 0) return
          const montoPorJugador = Math.round(montoDoble / jugadoresEquipo.length)
          if (montoPorJugador <= 0) return
          jugadoresEquipo.forEach(j => deudas.push({
            tournament_id: id, team_id: eq.id, player_id: j.player_id, tipo: 'deuda_personal', monto: montoPorJugador,
            concepto: `Inscripción sin pagar (x2) de ${eq.name} en ${torneo?.name || 'el torneo'}`.trim(), pagado: false,
          }))
        })

        if (deudas.length > 0) await supabase.from('torneo_finanzas').insert(deudas)
        deudoresPersonales = deudas.length
      }
    } catch (e) { console.error('deuda personal:', e) }

    const equiposSinJugadores = equipos.filter(e => !jugadores.some(j => j.team_id === e.id))
    showMsg(`Logros guardados ✓ 🏆 ${campeonEq.name} · 🥈 ${subcampeonEq.name}${tercerEq ? ` · 🥉 ${tercerEq.name}` : ''}${deudoresPersonales > 0 ? ` · 💳 ${deudoresPersonales} jugadores quedaron con deuda personal por inscripción sin pagar` : ''}${equiposSinJugadores.length > 0 ? ` (${equiposSinJugadores.length} equipos sin jugadores inscritos quedaron sin logro)` : ''}`)
  }

  // Nueva edición del mismo torneo: conserva la identidad e historial, arranca sin equipos
  async function handleCrearSiguienteEdicion() {
    const nombreBase = (torneo.name || '').replace(/\s*\(Edición \d+\)\s*$/i, '')
    const n = (torneo.edicion || 1) + 1
    const nombre = prompt('Nombre de la nueva edición:', `${nombreBase} (Edición ${n})`)
    if (!nombre) return
    const { data, error } = await supabase.from('tournaments').insert({
      name: nombre, season: torneo.season, city: torneo.city, modalidad: torneo.modalidad,
      categoria: torneo.categoria, genero: torneo.genero, formato: torneo.formato,
      status: 'active', organizador_id: torneo.organizador_id || null,
      premium: false, torneo_padre_id: torneo.torneo_padre_id || torneo.id,
      edicion: n, finanzas_config: torneo.finanzas_config || null,
    }).select().single()
    if (error) return showMsg(`Error al crear la edición: ${error.message}`, 'error')
    showMsg(`${nombre} creada ✓ — este torneo queda guardado con todo su historial; agrega los equipos de la nueva edición`)
    navigate(`/admin/torneos/${data.id}`)
    setTab('actividad')
  }

  // Fecha/hora planeada por llave (posición dentro de la ronda) — se puede ir
  // editando en cualquier momento, incluso ANTES de que se sepa qué equipos
  // juegan ahí (columnas "Por definir" del árbol). Así, cuando los equipos
  // avanzan a esa fase, la fecha/hora ya está lista y visible para todos.
  // Se reusa tanto en la vista previa antes de crear el bracket como en las
  // columnas futuras del árbol ya creado.
  function actualizarCalendarioLlave(fase, idx, campo, valor) {
    setPreviewCalendario(prev => {
      const arr = Array.isArray(prev?.[fase]) ? [...prev[fase]] : []
      arr[idx] = { ...(arr[idx] || {}), [campo]: valor }
      return { ...prev, [fase]: arr }
    })
  }

  async function handleGenerarSiguienteRonda() {
    if (generandoRondaRef.current) return
    generandoRondaRef.current = true
    try {
      await handleGenerarSiguienteRondaInterna()
    } finally {
      generandoRondaRef.current = false
    }
  }

  async function handleGenerarSiguienteRondaInterna() {
    const est = getEstadoEliminatorias()
    if (!est) return
    if (est.actual === 'final') return showMsg('El torneo ya está en la final', 'error')
    if (!est.completa) return showMsg('Faltan partidos por jugar en esta ronda', 'error')
    if (est.hayEmpates) return showMsg('Hay llaves empatadas — registra los penales en la planilla', 'error')
    if (!fechaRonda) return showMsg('Selecciona la fecha de la siguiente ronda', 'error')
    setGenerandoRonda(true)

    // Aviso de tarjetas sin pagar — ya no bloquea, solo recuerda que hay
    // que cobrarlas (el admin decide si igual arma la siguiente ronda).
    const deudoresRonda = await getDeudoresTarjetas(est.vivos.map(v => v.id))
    if (deudoresRonda.length > 0) {
      showMsg(`⚠️ Recordatorio: tienen tarjetas sin pagar: ${deudoresRonda.map(d => `${d.name} (${fmt(d.deuda)})`).join(', ')} — registra los pagos en la pestaña Finanzas`, 'error')
    }

    const conVuelta = est.llaves.some(l => l.matches.length > 1)
    const baseSinFecha = { tournament_id: id, status: 'scheduled', matchday: null }
    const base = { ...baseSinFecha, played_at: `${fechaRonda}T${horaRonda}:00-05:00` }
    // Si a alguna llave del árbol ya le pusiste fecha/hora puntual (en las
    // columnas "Por definir"), se usa esa — si no, la fecha general de acá arriba.
    const fechaHoraLlave = (fase, idx) => {
      const c = previewCalendario?.[fase]?.[idx]
      return { fecha: c?.fecha || fechaRonda, hora: c?.hora || horaRonda || '08:00' }
    }
    const inserts = []

    // Repechaje de la semifinal de 3: perdedor del 1v2 contra el 3°
    if (est.repechajePendiente) {
      const perdedorSemi = est.perdedores[0]
      const tercero = est.byesActuales[0]
      inserts.push({ ...base, home_team_id: perdedorSemi.id, away_team_id: tercero.id, fase: 'semifinal', ronda: 'Semifinal (repechaje)' })
      const { error } = await supabase.from('matches').insert(inserts)
      if (error) showMsg('Error al generar el repechaje', 'error')
      else showMsg(`Repechaje generado: ${perdedorSemi.name} vs ${tercero.name} — el ganador va a la final ✓`)
      setGenerandoRonda(false); fetchPartidos(); fetchBracket()
      return
    }

    let equiposRonda = [...est.vivos]

    // Semifinal de 3 equipos: 1° vs 2° de la reclasificación, el 3° espera al perdedor
    if (equiposRonda.length === 3) {
      const ordenados = rankPorReclasificacion(equiposRonda)
      inserts.push({ ...base, home_team_id: ordenados[0].id, away_team_id: ordenados[1].id, fase: 'semifinal', ronda: 'Semifinal' })
      if (conVuelta) inserts.push({ ...base, home_team_id: ordenados[1].id, away_team_id: ordenados[0].id, fase: 'semifinal', ronda: 'Semifinal (vuelta)' })
      const { error } = await supabase.from('matches').insert(inserts)
      if (error) showMsg('Error al generar la semifinal', 'error')
      else showMsg(`Semifinal de 3: ${ordenados[0].name} vs ${ordenados[1].name} — el perdedor jugará repechaje contra ${ordenados[2].name} ✓`)
      setGenerandoRonda(false); fetchPartidos(); fetchBracket()
      return
    }

    // Cantidad impar (mayor a 3): entra un mejor perdedor o el 1° pasa directo
    let agregoMejorPerdedor = false
    if (equiposRonda.length % 2 !== 0) {
      if (modoImpar === 'mejor_perdedor') {
        const mejorPerdedor = rankPorReclasificacion(est.perdedoresElegibles)[0]
        if (!mejorPerdedor) { showMsg('No hay perdedores disponibles para completar el cupo', 'error'); setGenerandoRonda(false); return }
        equiposRonda = rankPorReclasificacion([...equiposRonda, mejorPerdedor])
        agregoMejorPerdedor = true
      } else {
        equiposRonda = rankPorReclasificacion(equiposRonda).slice(1) // el 1° pasa directo
      }
    } else if (est.byesActuales.length > 0) {
      equiposRonda = rankPorReclasificacion(equiposRonda)
    }

    const totalVivos = est.vivos.length + (agregoMejorPerdedor ? 1 : 0)
    const fase  = getFaseValue(totalVivos)
    const ronda = getRondaNombre(totalVivos)

    let llaveIdx = 0
    for (let i = 0; i + 1 < equiposRonda.length; i += 2) {
      const local = equiposRonda[i], visitante = equiposRonda[i + 1]
      const { fecha, hora } = fechaHoraLlave(fase, llaveIdx)
      const playedAt = `${fecha}T${hora}:00-05:00`
      inserts.push({ ...baseSinFecha, played_at: playedAt, home_team_id: local.id, away_team_id: visitante.id, fase, ronda })
      if (conVuelta) inserts.push({ ...baseSinFecha, played_at: playedAt, home_team_id: visitante.id, away_team_id: local.id, fase, ronda: `${ronda} (vuelta)` })
      llaveIdx++
    }

    // Partido por el tercer puesto (junto con la final)
    if (totalVivos === 2 && crearTercerPuesto && est.perdedoresElegibles.length >= 2) {
      const [t1, t2] = rankPorReclasificacion(est.perdedoresElegibles)
      inserts.push({ ...base, home_team_id: t1.id, away_team_id: t2.id, fase: 'final', ronda: 'Tercer puesto' })
    }

    const { error } = await supabase.from('matches').insert(inserts)
    if (error) showMsg('Error al generar la siguiente ronda', 'error')
    else showMsg(`${ronda} generada ✓ — los ganadores avanzan`)
    setGenerandoRonda(false)
    fetchPartidos(); fetchBracket()
  }

  // Crea el partido de 3°/4° puesto DESPUÉS de que la Final ya existe — cubre
  // el caso en que la Final se creó sola (avance por casilla) sin que el
  // admin hubiera activado "3°/4° puesto" a tiempo en la vista previa. Usa
  // los dos perdedores de semifinal, con casilla 1 (la 0 es la Final) para
  // no chocar con ella.
  async function handleCrearTercerPuestoRetroactivo(perdedorA, perdedorB) {
    if (!fechaRonda) return showMsg('Selecciona una fecha arriba en "Generar siguiente ronda" o pon la fecha de hoy', 'error')
    setGenerandoRonda(true)
    const playedAt = `${fechaRonda}T${horaRonda || '08:00'}:00-05:00`
    const { error } = await supabase.from('matches').insert({
      tournament_id: id, home_team_id: perdedorA.id, away_team_id: perdedorB.id,
      played_at: playedAt, status: 'scheduled', fase: 'final', ronda: 'Tercer puesto', matchday: null, slot_index: 1,
    })
    if (error) showMsg('Error al crear el partido de tercer puesto', 'error')
    else showMsg(`Partido por el 3° y 4° puesto creado ✓: ${perdedorA.name} vs ${perdedorB.name}`)
    setGenerandoRonda(false)
    fetchPartidos(); fetchBracket()
  }

  // Avance por CASILLA FIJA: el ganador de la casilla 0 y el de la casilla 1
  // arman la casilla 0 de la ronda siguiente, el de la 2 y la 3 arman la
  // casilla 1, etc. — apenas se conocen los DOS ganadores de esa pareja de
  // casillas, se crea el partido siguiente ya mismo, sin esperar a que
  // termine el resto de la ronda (así se ve avanzar de una, en vivo).
  //
  // Solo actúa en el caso "limpio": cantidad PAR de llaves en la ronda
  // actual y nadie con pase directo (bye) pendiente de una ronda anterior
  // sin haber entrado todavía. Si hay algo raro (bye, cantidad impar) no
  // toca nada — eso lo sigue resolviendo el flujo manual de siempre (ver el
  // otro efecto más abajo), que usa reclasificación por tabla de grupos.
  async function intentarAvanzarSlots() {
    if (avanzandoSlotsRef.current) return
    avanzandoSlotsRef.current = true
    try {
      const porFase = getLlavesPorFase()
      const fasesExist = FASE_ORDEN.filter(f => porFase[f])
      if (fasesExist.length === 0) return

      const inserts = []
      const resumen = []

      // Antes esto solo miraba la ÚLTIMA fase que ya existiera — si esa fase
      // (ej. semifinal) ya tenía una sola llave creada por otra pareja de
      // cuartos, se dejaba de revisar cuartos por completo y una llave que
      // terminaba después nunca generaba su casilla siguiente. Ahora se
      // revisan TODAS las fases existentes en cada pasada.
      for (const actual of fasesExist) {
        if (actual === 'final') continue
        const llaves = porFase[actual]
        if (llaves.length < 2 || llaves.length % 2 !== 0) continue // impar/bye — a mano

        // Si en la primera fase de eliminatorias falta por entrar el equipo
        // que tenía pase directo (bye inicial), no es el caso limpio todavía.
        if (actual === fasesExist[0] && torneo?.bye_inicial_team_id) {
          const enFase = new Set(llaves.flatMap(l => [l.teamA.id, l.teamB.id]))
          if (!enFase.has(torneo.bye_inicial_team_id)) continue
        }

        const proximaFase = getFaseValue(llaves.length)
        // La Final también se crea sola por casilla, igual que el resto de
        // rondas — antes se dejaba siempre para el flujo manual para que el
        // admin decidiera si se jugaba el 3°/4° puesto, pero esa decisión
        // ahora se toma de antemano en la vista previa en vivo (botón "Abrir
        // espacio para el 3° y 4° puesto", guardado en crearTercerPuesto) y
        // ya no hace falta esperar a que el admin la tome acá.
        const rondaNombre = getRondaNombre(llaves.length)
        const conVuelta = llaves.some(l => l.matches.length > 1)

        for (let i = 0; i * 2 + 1 < llaves.length; i++) {
          const A = llaves[i * 2], B = llaves[i * 2 + 1]
          if (!A.terminada || !B.terminada) continue
          if (!A.ganador || !B.ganador) continue // empate sin penales resueltos todavía
          const yaExiste = bracket.some(m => m.fase === proximaFase && m.slot_index === i)
          if (!yaExiste) {
            const c = previewCalendario?.[proximaFase]?.[i]
            const fecha = c?.fecha || fechaRonda
            const hora  = c?.hora  || horaRonda || '08:00'
            if (fecha) {
              const playedAt = `${fecha}T${hora}:00-05:00`
              inserts.push({ tournament_id: id, home_team_id: A.ganador.id, away_team_id: B.ganador.id, played_at: playedAt, status: 'scheduled', fase: proximaFase, ronda: rondaNombre, matchday: null, slot_index: i })
              if (conVuelta) inserts.push({ tournament_id: id, home_team_id: B.ganador.id, away_team_id: A.ganador.id, played_at: playedAt, status: 'scheduled', fase: proximaFase, ronda: `${rondaNombre} (vuelta)`, matchday: null, slot_index: i })
              resumen.push(`${A.ganador.name} vs ${B.ganador.name}`)
            }
          }

          // Junto con la Final, si se activó "3°/4° puesto" en la vista
          // previa, se arma también ese partido con los dos perdedores de
          // semifinal — usa la casilla 1 de la fase 'final' (la 0 es la
          // final) para no chocar con ella.
          if (proximaFase === 'final' && crearTercerPuesto) {
            const perdedorA = A.ganador.id === A.teamA.id ? A.teamB : A.teamA
            const perdedorB = B.ganador.id === B.teamA.id ? B.teamB : B.teamA
            const yaExisteTercer = bracket.some(m => m.fase === 'final' && m.slot_index === 1)
            if (!yaExisteTercer) {
              const cTercer = previewCalendario?.final?.[1]
              const fechaTercer = cTercer?.fecha || fechaRonda
              const horaTercer  = cTercer?.hora  || horaRonda || '08:00'
              if (fechaTercer) {
                const playedAtTercer = `${fechaTercer}T${horaTercer}:00-05:00`
                inserts.push({ tournament_id: id, home_team_id: perdedorA.id, away_team_id: perdedorB.id, played_at: playedAtTercer, status: 'scheduled', fase: 'final', ronda: 'Tercer puesto', matchday: null, slot_index: 1 })
                resumen.push(`🥉 ${perdedorA.name} vs ${perdedorB.name}`)
              }
            }
          }
        }
      }

      if (inserts.length === 0) return

      // Antes de insertar, se vuelve a preguntar a la base (no solo el estado
      // local, que puede estar un poco desactualizado) si esas casillas ya
      // existen — así, si esta función corre dos veces casi al mismo tiempo
      // (ej. el árbol se refresca desde dos lados justo cuando termina el
      // último partido de la ronda), no se crea el mismo partido dos veces.
      const fasesAInsertar = [...new Set(inserts.map(m => m.fase))]
      const { data: yaEnBase } = await supabase
        .from('matches')
        .select('fase, slot_index')
        .eq('tournament_id', id)
        .in('fase', fasesAInsertar)
      const existentes = new Set((yaEnBase || []).map(m => `${m.fase}|${m.slot_index}`))
      const insertsFiltrados = inserts.filter(m => !existentes.has(`${m.fase}|${m.slot_index}`))
      if (insertsFiltrados.length === 0) return

      const { error } = await supabase.from('matches').insert(insertsFiltrados)
      if (error) { console.error('Avance automático de casillas:', error); return }
      showMsg(`⚡ Avanzan: ${resumen.join(', ')} ✓`)
      await Promise.all([fetchPartidos(), fetchBracket()])
    } finally {
      avanzandoSlotsRef.current = false
    }
  }

  useEffect(() => {
    if (bracket.length === 0) return
    intentarAvanzarSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracket])

  // Casos especiales que el avance por casilla fija de arriba NO resuelve
  // (porque no son una ronda con cantidad par de llaves): el repechaje de la
  // semifinal-de-3 y la semifinal-de-3 misma se resuelven solos (son
  // deterministas, no hay ninguna decisión real que tomar ahí) usando el
  // flujo de reclasificación de siempre. El resto de casos con número IMPAR
  // de equipos, o la final con candidatos a tercer puesto, se dejan con el
  // aviso de siempre para que el admin decida.
  useEffect(() => {
    if (bracket.length === 0) return
    if (!datosPreviewListos) return
    if (generandoRonda || generandoRondaRef.current) return
    const est = getEstadoEliminatorias()
    if (!est) return
    if (est.actual === 'final') return
    if (!est.completa || est.hayEmpates) return
    if (est.repechajePendiente) { handleGenerarSiguienteRonda(); return }
    if (est.vivos.length === 3) { handleGenerarSiguienteRonda(); return }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bracket, generandoRonda, datosPreviewListos])
  // ── TABLA GENERAL ───────────────────────────────────

  function calcTablaGeneral() {
    const P = getPuntosTorneo(torneo)
    const tabla = {}
    equipos.forEach(e => { tabla[e.id] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 } })
    partidos.filter(p => p.status === 'finished' && (!p.fase || p.fase === 'grupo')).forEach(p => {
      if (tabla[p.home_team_id]) {
        tabla[p.home_team_id].pj++; tabla[p.home_team_id].gf += p.home_score || 0; tabla[p.home_team_id].gc += p.away_score || 0
        if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += P.victoria }
        else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts += P.empate }
        else { tabla[p.home_team_id].pp++; tabla[p.home_team_id].pts += P.derrota }
      }
      if (tabla[p.away_team_id]) {
        tabla[p.away_team_id].pj++; tabla[p.away_team_id].gf += p.away_score || 0; tabla[p.away_team_id].gc += p.home_score || 0
        if (p.away_score > p.home_score)       { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += P.victoria }
        else if (p.away_score === p.home_score) { tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts += P.empate }
        else { tabla[p.away_team_id].pp++; tabla[p.away_team_id].pts += P.derrota }
      }
    })
    return Object.values(tabla).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc))
  }

  // ── CALENDARIO ──────────────────────────────────────

  async function handleAgregarCancha() {
    if (!nuevaCancha.trim()) return
    const { data, error } = await supabase.from('canchas').insert({ tournament_id: id, nombre: nuevaCancha.trim(), escenario: nuevaCanchaEscenario.trim() || null }).select().single()
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
      played_at: formPartido.played_at + (formPartido.hora ? 'T' + formPartido.hora : 'T00:00') + ':00-05:00',
      location: formPartido.location || null, matchday: formPartido.matchday ? parseInt(formPartido.matchday) : null,
      fase: formPartido.fase || 'grupo', status: 'scheduled',
      arbitro1_id: formPartido.arbitro1_id || null, arbitro2_id: formPartido.arbitro2_id || null, arbitro3_id: formPartido.arbitro3_id || null,
    })
    if (error) showMsg('Error al crear partido', 'error')
    else { showMsg('Partido creado ✓'); setShowFormPartido(false); setFormPartido({ home_team_id: '', away_team_id: '', played_at: '', hora: '', location: '', matchday: '', fase: 'grupo' }); fetchPartidos() }
    setLoadingPartido(false)
  }

  // Borra el partido y todo lo que quedó enganchado a él (estadísticas,
  // MVP, apuestas de Predix, predicciones, historial de ediciones). Cada
  // tabla se intenta por separado y en orden: si alguna no existe en este
  // proyecto o falla, no frena la limpieza de las demás ni el borrado final.
  async function handleEliminarPartidoConfirmado(pid) {
    setEliminandoPartido(true)
    const dependientes = ['player_match_stats', 'predicciones', 'tournament_logros', 'predix_apuestas', 'predix_cruces', 'match_edit_log']
    for (const tabla of dependientes) {
      try { await supabase.from(tabla).delete().eq('match_id', pid) } catch (e) { /* la tabla puede no existir */ }
    }
    const { error } = await supabase.from('matches').delete().eq('id', pid)
    setEliminandoPartido(false)
    setPartidoAEliminar(null)
    if (error) { showMsg('Error al eliminar el partido', 'error'); return }
    fetchPartidos(); fetchBracket(); showMsg('Partido eliminado ✓')
  }

  async function handleGuardarResultado() {
    if (scoreHome === '' || scoreAway === '') return showMsg('Ingresa el marcador', 'error')
    setGuardando(true)
    const local = parseInt(scoreHome), visitante = parseInt(scoreAway)
    const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', editandoPartido.id)
    if (error) { showMsg('Error al guardar', 'error'); setGuardando(false); return }
    await resolverPrediccionesPartido(editandoPartido.id, local, visitante)
    showMsg('Resultado guardado ✓'); setEditandoPartido(null); setScoreHome(''); setScoreAway(''); fetchPartidos(); fetchBracket()
    setGuardando(false)
  }

  async function handleGuardarTorneo() {
    const numDef = (v, def) => (v === '' || v === null || v === undefined || isNaN(parseInt(v, 10))) ? def : parseInt(v, 10)
    const numOrNull = v => (v === '' || v === null || v === undefined || isNaN(parseInt(v, 10))) ? null : parseInt(v, 10)
    let payload = { ...formTorneo, pts_victoria: numDef(formTorneo.pts_victoria, 3), pts_empate: numDef(formTorneo.pts_empate, 1), pts_derrota: numDef(formTorneo.pts_derrota, 0), limite_jugadores_equipo: numOrNull(formTorneo.limite_jugadores_equipo) }
    let avisoDegradado = null
    let { data, error } = await supabase.from('tournaments').update(payload).eq('id', id).select('id')
    if (error && (error.message?.includes('pts_victoria') || error.message?.includes('pts_empate') || error.message?.includes('pts_derrota'))) {
      // Falta correr migracion_sistema_puntos.sql en Supabase: se reintenta sin esos 3 campos
      const { pts_victoria, pts_empate, pts_derrota, ...resto } = payload
      payload = resto
      avisoDegradado = 'Torneo actualizado, pero el sistema de puntos NO se guardó: ejecuta migracion_sistema_puntos.sql en Supabase'
      ;({ data, error } = await supabase.from('tournaments').update(payload).eq('id', id).select('id'))
    }
    if (error && error.message?.includes('limite_jugadores_equipo')) {
      // Falta correr migracion_limite_jugadores_equipo.sql en Supabase: se reintenta sin ese campo
      const { limite_jugadores_equipo, ...resto } = payload
      payload = resto
      avisoDegradado = 'Torneo actualizado, pero el límite de jugadores por equipo NO se guardó: ejecuta migracion_limite_jugadores_equipo.sql en Supabase'
      ;({ data, error } = await supabase.from('tournaments').update(payload).eq('id', id).select('id'))
    }
    if (error) { console.log('ERROR DETALLE (editar torneo):', error); showMsg(`Error al actualizar torneo: ${error.message || error.code || error.details || 'desconocido'}`, 'error'); return }
    // Si no hay error pero tampoco vino ninguna fila de vuelta, el update no
    // afectó ninguna fila (típicamente permisos/RLS en Supabase) — evita el
    // falso "guardado ✓" que hacía creer que quedó bien cuando en realidad
    // nunca se escribió en la base de datos.
    if (!data || data.length === 0) {
      showMsg('El torneo no se actualizó: no tenés permiso para editarlo (revisa las políticas RLS de "tournaments" en Supabase)', 'error')
      return
    }
    setTorneo(p => ({ ...p, ...payload })); setEditandoTorneo(false)
    showMsg(avisoDegradado || 'Torneo actualizado ✓', avisoDegradado ? 'error' : 'ok')
  }

  async function handleGuardarEditPartido() {
    if (!formEditPartido.played_at || !formEditPartido.hora) return showMsg('Fecha y hora son obligatorias', 'error')
    const { error } = await supabase.from('matches').update({
      played_at: `${formEditPartido.played_at}T${formEditPartido.hora}:00-05:00`,
      location: formEditPartido.location || null, matchday: formEditPartido.matchday ? parseInt(formEditPartido.matchday) : null,
      fase: formEditPartido.fase || 'grupo',
    }).eq('id', editandoPartidoForm.id)
    if (error) { showMsg(`Error al guardar: ${error.message}`, 'error'); return }
    showMsg('Partido actualizado ✓'); setEditandoPartidoForm(null); fetchPartidos(); fetchBracket()
  }

  function generarJornada() {
    setEditJornadaIdx(null)
    if (!configJornada.fecha) return showMsg('Selecciona la fecha de inicio', 'error')
    // "Hora desde" solo es obligatoria si falta marcar horarios específicos
    // para alguno de los días que se van a jugar — si YA marcaste horas
    // para todos esos días (ej: sábado 8 y 9, domingo 5-6-7-8), no hace
    // falta llenarla.
    const diasCheck = configJornada.dias_semana || DIAS_SEMANA.map(d => d.key)
    const faltaHorarioEnAlgunDia = diasCheck.some(k => !(((configJornada.horarios_por_dia || {})[k] || []).length > 0))
    if (!configJornada.hora_inicio && faltaHorarioEnAlgunDia) return showMsg('Ingresa la hora de inicio, o marca horarios específicos para todos los días que vas a jugar', 'error')
    if (canchas.length === 0) return showMsg('Agrega al menos una cancha', 'error')
    if (equipos.length < 2) return showMsg('Necesitas al menos 2 equipos', 'error')

    // Canchas a usar en ESTA jornada (checkboxes de arriba) — si no se tocó
    // nada, se usan todas como antes.
    const canchasUsadas = canchas.filter(c => (configJornada.cancha_ids || canchas.map(x => x.id)).includes(c.id))
    if (canchasUsadas.length === 0) return showMsg('Selecciona al menos una cancha/escenario para esta jornada', 'error')

    // Qué canchas (de las seleccionadas) se pueden usar en una fecha dada,
    // según el día de la semana que sea Y las restricciones por escenario
    // (ej: Old Traffod solo sábados, Gol solo domingo y lunes). Un
    // escenario sin días marcados se puede usar cualquier día permitido.
    function canchasDisponiblesEnFecha(fechaIso) {
      const diaKey = DIAS_SEMANA[new Date(fechaIso + 'T00:00:00').getDay()].key
      return canchasUsadas.filter(c => {
        const esc = c.escenario || 'Sin sede'
        const dias = (configJornada.dias_por_escenario || {})[esc]
        return !dias || dias.length === 0 || dias.includes(diaKey)
      })
    }

    // Rango de fechas disponible para programar esta jornada. Si no se puso
    // "Fecha fin" queda como antes: un solo día. Se filtra además por los
    // días de la semana marcados arriba (si se tocó ese selector) y por si
    // hay al menos una cancha disponible ese día según los escenarios.
    const fechaIni = configJornada.fecha
    const fechaFin = configJornada.fecha_fin || configJornada.fecha
    const diasPermitidos = configJornada.dias_semana || DIAS_SEMANA.map(d => d.key)
    let fechasDisponibles = []
    const d0 = new Date(fechaIni + 'T00:00:00')
    const d1 = new Date(fechaFin + 'T00:00:00')
    if (d1 >= d0) {
      for (let d = new Date(d0); d <= d1 && fechasDisponibles.length < 60; d.setDate(d.getDate() + 1)) {
        fechasDisponibles.push({ iso: d.toISOString().slice(0, 10), dow: d.getDay() })
      }
    } else {
      fechasDisponibles.push({ iso: fechaIni, dow: d0.getDay() })
    }
    fechasDisponibles = fechasDisponibles.filter(f => diasPermitidos.includes(DIAS_SEMANA[f.dow].key) && canchasDisponiblesEnFecha(f.iso).length > 0)
    if (fechasDisponibles.length === 0) return showMsg('Ningún día del rango de fechas tiene canchas disponibles (revisa los días marcados por escenario)', 'error')

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

    // Dos equipos son "compatibles" en día si al menos uno de los dos no
    // marcó preferencia, o si sus días preferidos se cruzan en algo. Se
    // intenta emparejar primero equipos compatibles entre sí — así un
    // equipo que "solo juega sábado" no termina cruzado con uno que "solo
    // juega domingo" (cruce que después no tiene ninguna fecha que le
    // sirva a los dos).
    function diasCompatibles(a, b) {
      const da = a.dias_preferidos || []
      const db = b.dias_preferidos || []
      if (da.length === 0 || db.length === 0) return true
      return da.some(d => db.includes(d))
    }

    const eq = [...equipos].sort(() => Math.random() - 0.5)
    const usados = new Set()
    const pares = []
    const descansan = []

    for (const a of eq) {
      if (usados.has(a.id)) continue
      usados.add(a.id)
      // 1) Rival del mismo grupo, compatible en día, con el que no haya jugado
      let rival = eq.find(b => !usados.has(b.id) && !yaJugaron.has(`${a.id}|${b.id}`) && (!hayGrupos || grupoDe[a.id] === grupoDe[b.id]) && diasCompatibles(a, b))
      // 2) Si no hay, mismo grupo pero sin exigir compatibilidad de día
      if (!rival) {
        rival = eq.find(b => !usados.has(b.id) && !yaJugaron.has(`${a.id}|${b.id}`) && (!hayGrupos || grupoDe[a.id] === grupoDe[b.id]))
      }
      // 3) Si no hay y está permitido, rival de otro grupo compatible en día
      if (!rival && hayGrupos && permitirIntergrupo) {
        rival = eq.find(b => !usados.has(b.id) && !yaJugaron.has(`${a.id}|${b.id}`) && diasCompatibles(a, b))
      }
      // 4) Último recurso: rival de otro grupo sin exigir nada más
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

    // Fecha (dentro del rango) según lo que hayan marcado los dos equipos —
    // se cruzan sus días preferidos; si ninguno coincide (o ninguno marcó
    // nada) se usa cualquier fecha del rango, y se avisa con
    // "sinCoincidencia" para que el admin lo revise si quiere.
    //
    // Además, para no amontonar todos los cruces en un solo día (dejando
    // otros días/escenarios vacíos), se calcula la capacidad de cada fecha
    // (horas marcadas para ese día de la semana × canchas disponibles ese
    // día) y se reparte primero entre las fechas que todavía tienen cupo,
    // la que menos partidos lleve — solo cuando NINGUNA fecha candidata
    // tiene cupo libre se empieza a sobrecargar alguna (ahí es cuando
    // aparecen horas extra fuera de lo marcado).
    const capacidadFecha = {}
    fechasDisponibles.forEach(f => {
      const diaKey = DIAS_SEMANA[f.dow].key
      const horariosDia = (configJornada.horarios_por_dia || {})[diaKey]
      const canchasDia = canchasDisponiblesEnFecha(f.iso)
      capacidadFecha[f.iso] = (horariosDia && horariosDia.length > 0) ? horariosDia.length * canchasDia.length : null
    })
    const usoFecha = {}
    fechasDisponibles.forEach(f => { usoFecha[f.iso] = 0 })

    const conFecha = pares.map(p => {
      if (p.descanso) return p
      const diasA = p.local.dias_preferidos || []
      const diasB = p.visitante.dias_preferidos || []
      let candidatas = fechasDisponibles
      let sinCoincidencia = false
      if (diasA.length > 0 || diasB.length > 0) {
        const validos = diasA.length > 0 && diasB.length > 0 ? diasA.filter(d => diasB.includes(d)) : (diasA.length > 0 ? diasA : diasB)
        const filtradas = fechasDisponibles.filter(f => validos.includes(DIAS_SEMANA[f.dow].key))
        if (filtradas.length > 0) candidatas = filtradas
        else sinCoincidencia = true
      }
      const conCupo = candidatas.filter(f => capacidadFecha[f.iso] == null || usoFecha[f.iso] < capacidadFecha[f.iso])
      const pool = conCupo.length > 0 ? conCupo : candidatas
      const minUso = Math.min(...pool.map(f => usoFecha[f.iso]))
      const empatadas = pool.filter(f => usoFecha[f.iso] === minUso)
      // Entre las que empatan en uso, se prefiere la fecha más próxima —
      // así se llena primero el fin de semana más cercano en vez de
      // esparcir partidos a semanas futuras que también tenían cupo.
      const elegida = [...empatadas].sort((a, b) => a.iso.localeCompare(b.iso))[0]
      usoFecha[elegida.iso] = (usoFecha[elegida.iso] || 0) + 1
      return { ...p, fecha: elegida.iso, sinCoincidencia }
    })

    // Historial de a qué hora ha jugado cada equipo hasta ahora en este
    // torneo (partidos ya jugados o programados) — para repartir bien los
    // horarios entre jornadas: que no le toque siempre el mismo horario al
    // mismo equipo, sobre todo el que menos les guste.
    const historialHora = {}
    function sumarHistorial(teamId, horaStr) {
      if (!teamId || !horaStr) return
      historialHora[teamId] = historialHora[teamId] || {}
      historialHora[teamId][horaStr] = (historialHora[teamId][horaStr] || 0) + 1
    }
    partidos.forEach(m => {
      if (!m.played_at) return
      const horaStr = `${String(new Date(m.played_at).getHours()).padStart(2, '0')}:00`
      sumarHistorial(m.home_team_id, horaStr)
      sumarHistorial(m.away_team_id, horaStr)
    })

    // Cancha + hora, por cada fecha por separado. Se arman los horarios
    // posibles de ese día (uno por "ronda" de canchas, empezando en la hora
    // por defecto) y se reparten así:
    //  1) primero los cruces con hora mínima ("no antes de") de alguno de
    //     los dos equipos, para asegurarles un cupo que sí les sirva;
    //  2) el resto, en orden al azar;
    //  3) a cada cruce se le da, entre los horarios que le sirven y todavía
    //     tienen cupo, el que MENOS veces hayan jugado esos dos equipos
    //     combinados (así no se repite siempre el mismo horario para el
    //     mismo equipo semana a semana).
    const porFecha = {}
    conFecha.forEach(p => { if (!p.descanso) (porFecha[p.fecha] = porFecha[p.fecha] || []).push(p) })
    const [hIniDefault] = configJornada.hora_inicio.split(':').map(Number)
    const hFinLimite = configJornada.hora_fin ? parseInt(configJornada.hora_fin.split(':')[0], 10) : null
    Object.entries(porFecha).forEach(([fechaIso, lista]) => {
      // Canchas que sí se pueden usar ESE día (según restricción por
      // escenario, ej: Old Traffod solo sábados).
      const canchasDia = canchasDisponiblesEnFecha(fechaIso)
      // Horarios específicos de ESE día de la semana (ej: domingo 5,6,7,8) —
      // si no se marcó ninguno, se cae al comportamiento de antes (Hora
      // desde + una ronda por cada tanda de canchas, tope en Hora hasta).
      const diaKey = DIAS_SEMANA[new Date(fechaIso + 'T00:00:00').getDay()].key
      const horariosDia = (configJornada.horarios_por_dia || {})[diaKey]
      const usaHorarioEspecifico = !!(horariosDia && horariosDia.length > 0)
      let slots = usaHorarioEspecifico ? [...horariosDia].sort() : []
      if (slots.length === 0) {
        const rondas = Math.max(1, Math.ceil(lista.length / canchasDia.length))
        slots = Array.from({ length: rondas }, (_, r) => `${String(hIniDefault + r).padStart(2, '0')}:00`)
      }
      // Si los horarios marcados para ese día no alcanzan (más partidos que
      // horarios × canchas disponibles), NO se inventan horas nuevas fuera
      // de lo que marcaste — esos partidos quedan sin hora/cancha y
      // avisados con "sinCupo" para que los ubiques vos a mano (otra
      // fecha, otra cancha u otra hora).
      const cupo = {}
      slots.forEach(s => { cupo[s] = canchasDia.length })

      lista.forEach(p => {
        const minA = p.local.hora_preferida ? parseInt(p.local.hora_preferida.split(':')[0], 10) : -1
        const minB = p.visitante.hora_preferida ? parseInt(p.visitante.hora_preferida.split(':')[0], 10) : -1
        p._minHora = Math.max(minA, minB)
      })
      const conRestriccion = lista.filter(p => p._minHora > -1)
      const sinRestriccion = lista.filter(p => p._minHora === -1).sort(() => Math.random() - 0.5)

      ;[...conRestriccion, ...sinRestriccion].forEach(p => {
        // 1) ideal: dentro del "no antes de" del equipo Y del "hasta" de la
        //    jornada. 2) si no hay, se relaja el "hasta". 3) si tampoco, se
        //    relaja todo (cualquier slot con cupo) — siempre se avisa con
        //    sinHorarioDisponible para que se revise a mano.
        let candidatos = slots.filter(s => cupo[s] > 0 && (p._minHora < 0 || parseInt(s, 10) >= p._minHora) && (usaHorarioEspecifico || hFinLimite == null || parseInt(s, 10) <= hFinLimite))
        let sinHorarioDisponible = false
        if (candidatos.length === 0) {
          candidatos = slots.filter(s => cupo[s] > 0 && (p._minHora < 0 || parseInt(s, 10) >= p._minHora))
          sinHorarioDisponible = true
        }
        if (candidatos.length === 0) {
          candidatos = slots.filter(s => cupo[s] > 0)
        }
        if (candidatos.length === 0) {
          // Ya no queda ningún horario/cancha libre ese día con lo que
          // marcaste — no se inventa una hora nueva, queda sin programar
          // para ubicarlo a mano.
          p.hora = null
          p.cancha = null
          p.sinCupo = true
          delete p._minHora
          return
        }
        const elegido = candidatos
          .map(s => ({ s, peso: (historialHora[p.local.id]?.[s] || 0) + (historialHora[p.visitante.id]?.[s] || 0) + Math.random() * 0.001 }))
          .sort((a, b) => a.peso - b.peso)[0].s
        cupo[elegido] = Math.max(0, (cupo[elegido] || 0) - 1)
        p.hora = elegido
        p.sinHorarioDisponible = sinHorarioDisponible
        p.usoHoraDefault = !usaHorarioEspecifico
        delete p._minHora
        sumarHistorial(p.local.id, elegido)
        sumarHistorial(p.visitante.id, elegido)
      })

      const porHora = {}
      lista.forEach(p => { if (p.hora) (porHora[p.hora] = porHora[p.hora] || []).push(p) })
      Object.values(porHora).forEach(grupo => { grupo.forEach((p, idx) => { p.cancha = canchasDia[idx % canchasDia.length] }) })
    })

    setJornadaGenerada(conFecha)
  }

  function actualizarPartidoJornada(i, cambios) {
    setJornadaGenerada(prev => prev.map((p, idx) => idx === i ? { ...p, ...cambios } : p))
  }

  function handleEliminarParejaJornada(i) {
    const p = jornadaGenerada[i]
    if (!p || p.descanso) return
    setEditJornadaIdx(null)
    const nueva = jornadaGenerada.filter((_, idx) => idx !== i)
    nueva.push({ local: p.local, visitante: null, descanso: true })
    if (p.visitante) nueva.push({ local: p.visitante, visitante: null, descanso: true })
    setJornadaGenerada(nueva)
  }

  async function handleGuardarJornada() {
    if (jornadaGenerada.length === 0) return
    const sinHora = jornadaGenerada.filter(p => !p.descanso && p.visitante && !p.hora)
    if (sinHora.length > 0) return showMsg(`${sinHora.length} partido(s) quedaron sin hora/cancha por falta de cupo ese día — edítalos a mano (✏️ Editar) antes de guardar`, 'error')
    setLoadingPartido(true)
    // fecha_inicio de la jornada = la más temprana entre todos los partidos
    // generados (pueden quedar repartidos en varios días si se puso un
    // rango de fechas).
    const fechasPartidos = jornadaGenerada.filter(p => !p.descanso && p.visitante).map(p => p.fecha || configJornada.fecha)
    const fechaInicioJornada = fechasPartidos.length > 0 ? fechasPartidos.reduce((a, b) => a < b ? a : b) : configJornada.fecha
    const { data: fechaData, error: fechaErr } = await supabase.from('fechas').insert({
      tournament_id: id, numero: parseInt(configJornada.numero) || (fechas.length + 1),
      nombre: `Jornada ${configJornada.numero || fechas.length + 1}`, fecha_inicio: fechaInicioJornada,
    }).select().single()
    if (fechaErr) { showMsg('Error al crear jornada', 'error'); setLoadingPartido(false); return }
    const inserts = jornadaGenerada.filter(p => !p.descanso && p.visitante).map(p => ({
      tournament_id: id, home_team_id: p.local.id, away_team_id: p.visitante.id,
      played_at: `${p.fecha || configJornada.fecha}T${p.hora || configJornada.hora_inicio}:00-05:00`, location: p.cancha?.nombre || null,
      matchday: parseInt(configJornada.numero) || (fechas.length + 1), fecha_id: fechaData.id,
      status: 'scheduled', fase: 'grupo',
    }))
    const { error } = await supabase.from('matches').insert(inserts)
    if (error) showMsg('Error al guardar partidos', 'error')
    else { showMsg(`Jornada creada con ${inserts.length} partidos ✓`); salirJornada(); fetchPartidos(); fetchFechas() }
    setLoadingPartido(false)
  }

  // Arrastrar equipos para intercambiarlos: usa Pointer Events (funciona con
  // mouse Y con dedo en celular) en vez del drag-and-drop nativo HTML5 que
  // no responde al tacto. dragEquipoRef guarda el origen de forma síncrona
  // (no depende del re-render de React) para que el seguimiento del dedo
  // nunca se pierda un frame.
  const dragEquipoRef = useRef(null)

  function iniciarDragEquipo(pi, slot) {
    const equipo = slot === 'local' ? jornadaGenerada[pi].local : jornadaGenerada[pi].visitante
    if (!equipo) return
    dragEquipoRef.current = { pi, slot, equipo }
    setDrag({ pi, slot, equipo })
    setDragOver(null)
  }
  function moverDragEquipo(clientX, clientY) {
    if (!dragEquipoRef.current) return
    const el = document.elementFromPoint(clientX, clientY)
    const slotEl = el?.closest('[data-drop-pi]')
    if (slotEl) setDragOver({ pi: parseInt(slotEl.dataset.dropPi, 10), slot: slotEl.dataset.dropSlot })
    else setDragOver(null)
  }
  function soltarDragEquipo(clientX, clientY) {
    if (!dragEquipoRef.current) return
    const drag = dragEquipoRef.current
    dragEquipoRef.current = null
    const el = document.elementFromPoint(clientX, clientY)
    const slotEl = el?.closest('[data-drop-pi]')
    if (!slotEl) { setDrag(null); setDragOver(null); return }
    ejecutarSwapEquipo(drag, parseInt(slotEl.dataset.dropPi, 10), slotEl.dataset.dropSlot)
  }
  function cancelarDragEquipo() { dragEquipoRef.current = null; setDrag(null); setDragOver(null) }

  function ejecutarSwapEquipo(drag, tpi, tslot) {
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

  function vecesEnfrentados(idA, idB) {
    if (!idA || !idB) return 0
    return partidos.filter(p =>
      (p.home_team_id === idA && p.away_team_id === idB) ||
      (p.home_team_id === idB && p.away_team_id === idA)
    ).length
  }


  async function buscarEquipos(q) {
    setBusquedaEquipo(q)
    setMostrarCrearEquipo(false)
    if (!q.trim()) { setEquiposDisponibles([]); return }
    setLoadingEquipos(true)
    const { data } = await supabase.from('teams').select('*').ilike('name', `%${q}%`).limit(10)
    const idsInscritos = equipos.map(e => e.id)
    setEquiposDisponibles((data || []).filter(e => !idsInscritos.includes(e.id)))
    setLoadingEquipos(false)
  }

  // El organizador necesita que Golmebol le habilite cupo de equipos por
  // WhatsApp para este torneo específico (el admin lo sube desde "Editar
  // torneo"). El admin principal nunca tiene este límite.
  function cupoEquiposAlcanzado() {
    if (!esOrganizador) return false
    return equipos.length >= (torneo?.equipos_permitidos || 0)
  }
  function avisarCupoEquipos() {
    showMsg(`Alcanzaste el cupo de equipos habilitado para este torneo (${torneo?.equipos_permitidos || 0}). Escríbenos por WhatsApp para que Golmebol te habilite más.`, 'error')
  }

  async function handleAgregarEquipo(equipo) {
    if (cupoEquiposAlcanzado()) return avisarCupoEquipos()
    const { error } = await supabase.from('tournament_teams').insert({ tournament_id: id, team_id: equipo.id })
    if (error) return showMsg('Error al agregar equipo', 'error')
    showMsg(`${equipo.name} agregado al torneo ✓`); cerrarModalEquipo(); fetchEquipos()
  }

  function abrirCrearEquipo() {
    setNuevoEquipoForm({ name: busquedaEquipo, city: '', representante_nombre: '', representante_telefono: '' })
    setNuevoEquipoLogo(null); setNuevoEquipoLogoPreview(null)
    setMostrarCrearEquipo(true)
  }

  function handleNuevoEquipoLogo(file) {
    if (!file) return
    setNuevoEquipoLogo(file)
    setNuevoEquipoLogoPreview(URL.createObjectURL(file))
  }

  function cerrarModalEquipo() {
    setShowAgregarEquipo(false); setBusquedaEquipo(''); setEquiposDisponibles([])
    setMostrarCrearEquipo(false); setNuevoEquipoForm({ name: '', city: '', representante_nombre: '', representante_telefono: '' })
    setNuevoEquipoLogo(null); setNuevoEquipoLogoPreview(null)
  }

  // Crea el equipo (con su representante y escudo) y lo inscribe en el torneo en el mismo paso
  // Inscribir al torneo un equipo que YA existe (evita duplicarlo y conserva su historia)
  async function usarEquipoExistente(e) {
    if (cupoEquiposAlcanzado()) return avisarCupoEquipos()
    const { error } = await supabase.from('tournament_teams').insert({ tournament_id: id, team_id: e.id })
    if (error) return showMsg('No se pudo inscribir (¿ya está en el torneo?)', 'error')
    showMsg(`${e.name} inscrito en el torneo ✓ — se conserva toda su historia`)
    setParecidosCrear([]); cerrarModalEquipo(); fetchEquipos()
  }

  async function handleCrearEquipoYAgregar(forzar = false) {
    if (cupoEquiposAlcanzado()) return avisarCupoEquipos()
    if (!nuevoEquipoForm.name.trim())                   return showMsg('El nombre del equipo es obligatorio', 'error')
    if (!nuevoEquipoForm.representante_nombre.trim())   return showMsg('El dueño/representante del equipo es obligatorio', 'error')
    if (!nuevoEquipoForm.representante_cedula.trim())   return showMsg('La cédula del dueño es obligatoria', 'error')
    if (!nuevoEquipoForm.representante_telefono.trim()) return showMsg('El teléfono del dueño es obligatorio', 'error')
    // Antes de crear: ¿ya existe un equipo con nombre igual o parecido?
    // Crear un duplicado hace que la historia anterior (partidos, palmarés,
    // jugadores) quede huérfana en el equipo viejo.
    if (!forzar) {
      const parecidos = await buscarEquiposParecidos(nuevoEquipoForm.name)
      if (parecidos.length > 0) { setParecidosCrear(parecidos); return }
    }
    setParecidosCrear([])
    setCreandoEquipo(true)
    let { data: nuevo, error } = await supabase.from('teams').insert({
      name: nuevoEquipoForm.name.trim(),
      city: nuevoEquipoForm.city.trim() || null,
      representante_nombre: nuevoEquipoForm.representante_nombre.trim(),
      representante_cedula: nuevoEquipoForm.representante_cedula.trim(),
      representante_telefono: nuevoEquipoForm.representante_telefono.trim() || null,
    }).select().single()
    if (error && (error.message || '').includes('representante_cedula')) {
      // BD sin la migración de la cédula: crear sin ella para no bloquear
      ;({ data: nuevo, error } = await supabase.from('teams').insert({
        name: nuevoEquipoForm.name.trim(), city: nuevoEquipoForm.city.trim() || null,
        representante_nombre: nuevoEquipoForm.representante_nombre.trim(),
        representante_telefono: nuevoEquipoForm.representante_telefono.trim() || null,
      }).select().single())
    }
    if (error) { showMsg('Error al crear el equipo', 'error'); setCreandoEquipo(false); return }
    if (nuevoEquipoLogo) {
      const path = `logos/${nuevo.id}.${nuevoEquipoLogo.name.split('.').pop()}`
      const { error: errorLogo } = await supabase.storage.from('teams').upload(path, nuevoEquipoLogo, { upsert: true })
      if (!errorLogo) {
        const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
        await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', nuevo.id)
      }
    }
    const { error: errorLink } = await supabase.from('tournament_teams').insert({ tournament_id: id, team_id: nuevo.id })
    if (errorLink) { showMsg('Equipo creado pero no se pudo inscribir en el torneo', 'error'); setCreandoEquipo(false); return }
    showMsg(`${nuevo.name} creado e inscrito en el torneo ✓`)
    limpiarBorrador('draft_crear_equipo_torneo')
    setCreandoEquipo(false); cerrarModalEquipo(); fetchEquipos()
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

  const fcTorneo           = torneo.finanzas_config || {}
  // La pestaña de cuentas es del admin principal o de torneos Premium
  // El admin SIEMPRE ve la pestaña de finanzas (para poder configurar los
  // precios por primera vez o cambiarlos cuando quiera). El organizador la ve
  // solo si está configurada y su torneo es premium (igual que antes).
  const finanzasActivas    = esAdminRol || ((!!fcTorneo.llevar_cuentas || ((fcTorneo.precio_amarilla || 0) + (fcTorneo.precio_azul || 0) + (fcTorneo.precio_roja || 0)) > 0) && !!torneo.premium)
  function toggleJornada(key) { setAbiertosJornada(prev => ({ ...prev, [key]: !prev[key] })) }

  function agruparPartidosPorJornada(lista) {
    const FASE_L = { grupo:'Fase de Grupos', octavos:'Octavos de Final', cuartos:'Cuartos de Final', semifinal:'Semifinales', tercero:'Tercer Puesto', final:'Final' }
    const FASE_ORDEN = { octavos:1, cuartos:2, semifinal:3, tercero:4, final:5 }
    const grupos = {}
    lista.forEach(p => {
      let key, label, esFase = false, faseOrden = 0
      if (p.fase && p.fase !== 'grupo') {
        key = `fase_${p.fase}`; label = FASE_L[p.fase]||p.fase
        esFase = true; faseOrden = FASE_ORDEN[p.fase] || 0
      } else if (p.matchday) {
        key = `jornada_${p.matchday}`; label = `Jornada ${p.matchday}`
      } else {
        const f = p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'}) : 'Sin fecha'
        key = `fecha_${f}`; label = f
      }
      if (!grupos[key]) grupos[key] = { key, label, esFase, faseOrden, partidos:[], fechas:[], minTime: Infinity }
      grupos[key].partidos.push(p)
      if (p.played_at) {
        const t = new Date(p.played_at).getTime()
        if (t < grupos[key].minTime) grupos[key].minTime = t
        const fd = new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})
        if (!grupos[key].fechas.includes(fd)) grupos[key].fechas.push(fd)
      }
    })
    // Las jornadas se acomodan por fecha y hora real del partido más
    // temprano de cada una (no por el número de jornada) — así si una
    // jornada se reprograma antes que otra, el orden que se ve refleja
    // cuándo se juega de verdad. Las eliminatorias siempre van al final.
    return Object.values(grupos).sort((a,b) => {
      if (a.esFase !== b.esFase) return a.esFase ? 1 : -1
      if (a.esFase && b.esFase) return a.faseOrden - b.faseOrden
      return a.minTime - b.minTime
    })
  }
  const tablaOrdenada      = calcTablaGeneral()

  // Valla menos vencida GLOBAL por equipo: a diferencia de la tabla general
  // (que en fase de grupos ya no cuenta partidos de eliminación directa),
  // los goles en contra acá deben seguir sumando aunque el torneo ya esté
  // en eliminatorias.
  function calcVallaEquipos() {
    const gc = {}, pj = {}
    partidos.filter(p => p.status === 'finished').forEach(p => {
      gc[p.home_team_id] = (gc[p.home_team_id] || 0) + (p.away_score || 0); pj[p.home_team_id] = (pj[p.home_team_id] || 0) + 1
      gc[p.away_team_id] = (gc[p.away_team_id] || 0) + (p.home_score || 0); pj[p.away_team_id] = (pj[p.away_team_id] || 0) + 1
    })
    return equipos.filter(e => pj[e.id] > 0)
      .map(e => ({
        equipo: e, gc: gc[e.id] || 0, pj: pj[e.id] || 0,
        arqueros: arquerosEquipos.filter(a => a.team_id === e.id),
      }))
      .sort((a, b) => a.gc - b.gc || b.pj - a.pj)
  }

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
          onClose={cerrarPlanilla}
          onGuardarResultado={async (local, visitante) => {
            const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', planillaPartido.id)
            if (!error) {
              await resolverPrediccionesPartido(planillaPartido.id, local, visitante)
              showMsg('Resultado guardado ✓'); cerrarPlanilla(); fetchPartidos(); fetchBracket()
            }
          }}
        />
      )}

      {modalPartidoAdmin && (
        <ModalPartidoAdmin partido={modalPartidoAdmin} onClose={() => setModalPartidoAdmin(null)}/>
      )}

      {showFlyerProgramacion && <FlyerProgramacion torneo={torneo} equipos={equipos} partidos={partidos} onClose={() => setShowFlyerProgramacion(false)}/>}

      {/* Confirmación al eliminar un partido — avisa qué más se borra */}
      {partidoAEliminar && (() => {
        const p = partidoAEliminar
        const esJugadoEliminar = p.status === 'finished'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={e => e.target === e.currentTarget && !eliminandoPartido && setPartidoAEliminar(null)}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '.95rem' }}>🗑️ Eliminar partido</div>
                <button onClick={() => !eliminandoPartido && setPartidoAEliminar(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={19}/></button>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>{p.home?.name} vs {p.away?.name}</div>
                {p.played_at && <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginBottom: '16px' }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'long',day:'2-digit',month:'long'})}</div>}

                <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: '800', color: '#d93025', marginBottom: '8px' }}>Esto es definitivo. Además del partido, también se borra:</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '.78rem', color: '#5f6368', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {esJugadoEliminar ? (
                      <>
                        <li>El resultado y la planilla (goles, tarjetas, faltas de cada jugador)</li>
                        <li>El MVP del partido, si se marcó alguno</li>
                        <li>Deja de contar en las estadísticas del torneo y ya no se le cobrará arbitraje a los equipos por este partido</li>
                        <li>Las predicciones y apuestas Predix 1x1 que otros jugadores hicieron sobre este partido</li>
                      </>
                    ) : (
                      <>
                        <li>Los árbitros asignados a este partido</li>
                        <li>Las predicciones y apuestas Predix 1x1 que ya se hayan hecho sobre este partido</li>
                      </>
                    )}
                  </ul>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setPartidoAEliminar(null)} disabled={eliminandoPartido}
                    style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', fontWeight: '600' }}>
                    Cancelar
                  </button>
                  <button onClick={() => handleEliminarPartidoConfirmado(p.id)} disabled={eliminandoPartido}
                    style={{ flex: 1, padding: '11px', background: '#d93025', border: 'none', borderRadius: '10px', cursor: eliminandoPartido ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '700', opacity: eliminandoPartido ? .7 : 1 }}>
                    {eliminandoPartido ? 'Eliminando...' : 'Sí, eliminar todo'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {/* Modal reemplazar equipo en una llave */}
      {reemplazoLlave && (() => {
        const disponibles = getEquiposParaReemplazo()
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={e => e.target === e.currentTarget && setReemplazoLlave(null)}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>🔄 Reemplazar equipo en la llave</div>
                <button onClick={() => setReemplazoLlave(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={19}/></button>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '14px' }}>
                  Si un equipo clasificado no puede jugar, elige quién sale y qué equipo eliminado entra en su lugar.
                </div>
                <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>¿Quién no puede jugar?</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {[reemplazoLlave.teamA, reemplazoLlave.teamB].map(t => (
                    <button key={t.id} onClick={() => setEquipoSale(t.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', cursor: 'pointer', border: equipoSale === t.id ? '2px solid #d93025' : '1px solid #dadce0', background: equipoSale === t.id ? '#fce8e6' : '#fff' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={t.logo_url} name={t.name} size={24}/></div>
                      <span style={{ fontSize: '.8rem', fontWeight: '600', color: equipoSale === t.id ? '#d93025' : '#202124' }}>{t.name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>¿Quién entra en su lugar?</div>
                {disponibles.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem', border: '1px dashed #dadce0', borderRadius: '10px', marginBottom: '16px' }}>No hay equipos eliminados disponibles</div>
                ) : (
                  <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'auto', maxHeight: '220px', marginBottom: '16px' }}>
                    {disponibles.map((eq, i) => (
                      <div key={eq.id} onClick={() => setEquipoEntra(eq.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', borderBottom: i < disponibles.length - 1 ? '1px solid #f1f3f4' : 'none', background: equipoEntra === eq.id ? '#e6f4ea' : '#fff' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={eq.logo_url} name={eq.name} size={26}/></div>
                        <span style={{ flex: 1, fontSize: '.8rem', fontWeight: equipoEntra === eq.id ? '700' : '500', color: '#202124' }}>{eq.name}</span>
                        {equipoEntra === eq.id && <span style={{ color: '#1e8e3e', fontWeight: '700' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setReemplazoLlave(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>Cancelar</button>
                  <button onClick={handleReemplazarEquipo} disabled={guardandoReemplazo || !equipoSale || !equipoEntra}
                    style={{ flex: 1, padding: '10px', background: guardandoReemplazo || !equipoSale || !equipoEntra ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '8px', cursor: guardandoReemplazo || !equipoSale || !equipoEntra ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                    {guardandoReemplazo ? 'Guardando...' : 'Reemplazar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal registrar penales (llave empatada) */}
      {partidoPenales && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setPartidoPenales(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>🎯 Definir ganador por penales</div>
              <button onClick={() => setPartidoPenales(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={19}/></button>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '14px', textAlign: 'center' }}>
                {partidoPenales.home?.name} {partidoPenales.home_score} — {partidoPenales.away_score} {partidoPenales.away?.name}
                <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '2px' }}>El partido quedó empatado — ingresa el resultado de la tanda de penales</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Penales {partidoPenales.home?.name} *</label>
                  <input type="number" min="0" value={penalesForm.local} onChange={e => setPenalesForm(f => ({ ...f, local: e.target.value }))} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', fontSize: '1.1rem' }} placeholder="0"/>
                </div>
                <div>
                  <label style={labelStyle}>Penales {partidoPenales.away?.name} *</label>
                  <input type="number" min="0" value={penalesForm.visitante} onChange={e => setPenalesForm(f => ({ ...f, visitante: e.target.value }))} style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', fontSize: '1.1rem' }} placeholder="0"/>
                </div>
              </div>
              {penalesForm.local !== '' && penalesForm.visitante !== '' && penalesForm.local !== penalesForm.visitante && (
                <div style={{ fontSize: '.78rem', color: '#1e8e3e', fontWeight: '700', textAlign: 'center', marginBottom: '12px' }}>
                  🏆 Ganador: {parseInt(penalesForm.local) > parseInt(penalesForm.visitante) ? partidoPenales.home?.name : partidoPenales.away?.name}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPartidoPenales(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>Cancelar</button>
                <button onClick={handleGuardarPenales} disabled={guardandoPenales}
                  style={{ flex: 1, padding: '10px', background: guardandoPenales ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoPenales ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                  {guardandoPenales ? 'Guardando...' : 'Guardar penales'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>Editar torneo</div>
            <div className="gm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[{ label: 'Nombre', key: 'name' }, { label: 'Ciudad', key: 'city' }, { label: 'Temporada', key: 'season' }, { label: 'Categoría', key: 'categoria' }].map(f => (
                <div key={f.key}><label style={labelStyle}>{f.label}</label><input value={formTorneo[f.key] || ''} onChange={e => setFormTorneo(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}/></div>
              ))}
              <div><label style={labelStyle}>Modalidad</label><select value={formTorneo.modalidad || ''} onChange={e => setFormTorneo(p => ({ ...p, modalidad: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Fútbol 5</option><option>Fútbol 7</option><option>Fútbol 11</option></select></div>
              <div><label style={labelStyle}>Género</label><select value={formTorneo.genero || ''} onChange={e => setFormTorneo(p => ({ ...p, genero: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option><option>Mixto</option></select></div>
              <div>
                <label style={labelStyle}>Sistema de puntos (victoria / empate / derrota)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="0" value={formTorneo.pts_victoria ?? 3} onChange={e => setFormTorneo(p => ({ ...p, pts_victoria: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} style={{ ...inputStyle, textAlign: 'center' }} placeholder="Victoria"/>
                  <input type="number" min="0" value={formTorneo.pts_empate ?? 1} onChange={e => setFormTorneo(p => ({ ...p, pts_empate: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} style={{ ...inputStyle, textAlign: 'center' }} placeholder="Empate"/>
                  <input type="number" min="0" value={formTorneo.pts_derrota ?? 0} onChange={e => setFormTorneo(p => ({ ...p, pts_derrota: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} style={{ ...inputStyle, textAlign: 'center' }} placeholder="Derrota"/>
                </div>
                <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Cuánto suma cada equipo en la tabla de posiciones según el resultado (ej: 3-1-0 o 2-1-0)</div>
              </div>
              {(esOrganizador || esAdminRol) && (
                <div>
                  <label style={labelStyle}>Límite de jugadores por equipo</label>
                  <input type="number" min="1" value={formTorneo.limite_jugadores_equipo ?? ''} onChange={e => setFormTorneo(p => ({ ...p, limite_jugadores_equipo: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))} style={inputStyle} placeholder="Sin límite"/>
                  <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Máximo de jugadores por equipo en este torneo. Vacío = sin límite. Aplica igual para todos los equipos inscritos.</div>
                </div>
              )}
              {esAdminRol && torneo.organizador_id && (
                <div>
                  <label style={labelStyle}>Cupo de equipos habilitados (organizador)</label>
                  <input type="number" min="0" value={formTorneo.equipos_permitidos ?? 0} onChange={e => setFormTorneo(p => ({ ...p, equipos_permitidos: parseInt(e.target.value) || 0 }))} style={inputStyle}/>
                  <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Cuántos equipos puede crear/agregar el organizador en este torneo. Sube este número cuando pida más por WhatsApp.</div>
                </div>
              )}
              {(esOrganizador || esAdminRol) && (
                <div>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formTorneo.requiere_cedula !== false} onChange={e => setFormTorneo(p => ({ ...p, requiere_cedula: e.target.checked }))} style={{ width: '15px', height: '15px', cursor: 'pointer' }}/>
                    Exigir foto de cédula al registrar jugadores
                  </label>
                  <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Si lo desactivas, los jugadores nuevos podrán registrarse en el link público sin subir la foto de la cédula (frontal y trasera).</div>
                </div>
              )}
              {(esOrganizador || esAdminRol) && (
                <div>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formTorneo.registro_simple === true} onChange={e => setFormTorneo(p => ({ ...p, registro_simple: e.target.checked }))} style={{ width: '15px', height: '15px', cursor: 'pointer' }}/>
                    Registro simple (solo nombre y cédula, sin confirmación)
                  </label>
                  <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>Para torneos internacionales o de paso: en el link público, los jugadores nuevos solo llenan nombre y cédula — sin teléfono, ciudad, género, fecha de nacimiento, posición, fotos de cédula ni el código de confirmación por WhatsApp.</div>
                </div>
              )}
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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '6px' }}>Editar partido</div>
            <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '20px' }}>{editandoPartidoForm.home?.name} vs {editandoPartidoForm.away?.name}</div>
            <div className="gm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Fecha *</label><input type="date" value={formEditPartido.played_at || ''} onChange={e => setFormEditPartido(p => ({ ...p, played_at: e.target.value }))} style={inputStyle}/></div>
                <div><label style={labelStyle}>Hora *</label><input type="time" value={formEditPartido.hora || ''} onChange={e => setFormEditPartido(p => ({ ...p, hora: e.target.value }))} style={inputStyle}/></div>
              </div>
              <div><label style={labelStyle}>Cancha</label><select value={formEditPartido.location || ''} onChange={e => setFormEditPartido(p => ({ ...p, location: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option>{canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
              <div><label style={labelStyle}>Jornada #</label><input type="number" value={formEditPartido.matchday || ''} onChange={e => setFormEditPartido(p => ({ ...p, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
              <div><label style={labelStyle}>Fase</label><select value={formEditPartido.fase || 'grupo'} onChange={e => setFormEditPartido(p => ({ ...p, fase: e.target.value }))} style={inputStyle}>{FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
              {arbitrosAdmin.length > 0 && <>
                <div><label style={labelStyle}>🟡 Árbitro principal</label><select value={formEditPartido.arbitro1_id||''} onChange={e => setFormEditPartido(p=>({...p,arbitro1_id:e.target.value}))} style={inputStyle}><option value="">Sin asignar</option>{arbitrosAdmin.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label style={labelStyle}>🟡 Árbitro asistente 1</label><select value={formEditPartido.arbitro2_id||''} onChange={e => setFormEditPartido(p=>({...p,arbitro2_id:e.target.value}))} style={inputStyle}><option value="">Sin asignar</option>{arbitrosAdmin.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label style={labelStyle}>🟡 Árbitro asistente 2</label><select value={formEditPartido.arbitro3_id||''} onChange={e => setFormEditPartido(p=>({...p,arbitro3_id:e.target.value}))} style={inputStyle}><option value="">Sin asignar</option>{arbitrosAdmin.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              </>}
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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '440px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem' }}>Agregar equipo al torneo</div>
              <button onClick={cerrarModalEquipo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
            </div>

            {!mostrarCrearEquipo && (
              <>
                <input value={busquedaEquipo} onChange={e => buscarEquipos(e.target.value)} placeholder="Buscar equipo por nombre..." style={{ ...inputStyle, marginBottom: '12px' }} autoFocus/>
                {loadingEquipos && <div style={{ textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem', padding: '12px' }}>Buscando...</div>}
                {!loadingEquipos && busquedaEquipo && equiposDisponibles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 4px' }}>
                    <div style={{ color: '#9aa0a6', fontSize: '.875rem', marginBottom: '12px' }}>No se encontró ningún equipo con ese nombre</div>
                    <button onClick={abrirCrearEquipo} style={{ padding: '8px 18px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600' }}>+ Crear equipo nuevo</button>
                  </div>
                )}
                {equiposDisponibles.length > 0 && (
                  <>
                    <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginBottom: '8px' }}>Revisá el escudo y el representante antes de agregar — puede haber equipos con nombres parecidos.</div>
                    <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                      {equiposDisponibles.map((e, i) => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < equiposDisponibles.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={e.logo_url} name={e.name} size={36}/></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{e.name}</div>
                            {e.city && <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>📍 {e.city}</div>}
                            <div style={{ fontSize: '.72rem', color: e.representante_nombre ? '#1a73e8' : '#d93025', marginTop: '1px' }}>
                              {e.representante_nombre ? `👤 ${e.representante_nombre}` : '⚠️ Sin representante registrado'}
                            </div>
                          </div>
                          <button onClick={() => handleAgregarEquipo(e)} style={{ padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500', flexShrink: 0 }}>+ Agregar</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={abrirCrearEquipo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', fontSize: '.78rem', textDecoration: 'underline' }}>¿No es ninguno de estos? Crear equipo nuevo</button>
                  </>
                )}
              </>
            )}

            {mostrarCrearEquipo && (
              <div>
                <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: '14px' }}>
                  Se crea el equipo y queda inscrito en este torneo de una vez.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ width: '56px', height: '56px', borderRadius: '10px', border: '2px dashed #dadce0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', background: '#f8f9fa' }}>
                      {nuevoEquipoLogoPreview
                        ? <img src={nuevoEquipoLogoPreview} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                        : <Shield size={22} color="#9aa0a6"/>
                      }
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleNuevoEquipoLogo(e.target.files[0])}/>
                    </label>
                    <div>
                      <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>Escudo del equipo</div>
                      <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>{nuevoEquipoLogoPreview ? 'Imagen seleccionada' : 'Opcional — podés subirlo después'}</div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Nombre del equipo *</label>
                    <input value={nuevoEquipoForm.name} onChange={e => setNuevoEquipoForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del equipo" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Ciudad</label>
                    <input value={nuevoEquipoForm.city} onChange={e => setNuevoEquipoForm(f => ({ ...f, city: e.target.value }))} placeholder="Ciudad" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Dueño / representante del equipo *</label>
                    <input value={nuevoEquipoForm.representante_nombre} onChange={e => setNuevoEquipoForm(f => ({ ...f, representante_nombre: e.target.value }))} placeholder="Nombre completo" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Cédula del dueño *</label>
                    <input value={nuevoEquipoForm.representante_cedula} onChange={e => setNuevoEquipoForm(f => ({ ...f, representante_cedula: e.target.value }))} placeholder="Número de cédula" type="number" style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ fontSize: '.75rem', color: '#5f6368', display: 'block', marginBottom: '4px' }}>Teléfono del dueño *</label>
                    <input value={nuevoEquipoForm.representante_telefono} onChange={e => setNuevoEquipoForm(f => ({ ...f, representante_telefono: e.target.value }))} placeholder="300 000 0000" type="tel" style={inputStyle}/>
                  </div>
                </div>
                {/* Aviso: ya existen equipos con nombre parecido — no duplicar */}
                {parecidosCrear.length > 0 && (
                  <div style={{ marginTop: '14px', background: '#fff8e1', border: '2px solid #f9a825', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ fontWeight: '800', color: '#e8710a', fontSize: '.85rem', marginBottom: '4px' }}>⚠️ ¡Ojo! Ya existe un equipo con nombre parecido</div>
                    <div style={{ fontSize: '.72rem', color: '#8a5a00', marginBottom: '12px', lineHeight: 1.5 }}>
                      Si es el <b>mismo equipo</b>, úsalo — así conserva toda su historia (partidos, palmarés, jugadores). Si creas uno nuevo, la información anterior queda en el equipo viejo.
                    </div>
                    {parecidosCrear.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #f1e3b0', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {e.logo_url ? <img src={e.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Shield size={16} color="#9aa0a6"/>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', color: '#202124', fontSize: '.85rem' }}>{e.name}</div>
                          {e.city && <div style={{ fontSize: '.68rem', color: '#9aa0a6' }}>📍 {e.city}</div>}
                          <div style={{ fontSize: '.7rem', color: '#1a73e8', fontWeight: '700', marginTop: '2px' }}>
                            👤 El dueño de este equipo es {e.representante_nombre || 'sin registrar'}
                          </div>
                        </div>
                        <button onClick={() => usarEquipoExistente(e)}
                          style={{ padding: '7px 12px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '700', flexShrink: 0 }}>
                          ✓ Usar este equipo
                        </button>
                      </div>
                    ))}
                    <button onClick={() => handleCrearEquipoYAgregar(true)}
                      style={{ width: '100%', padding: '9px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.75rem' }}>
                      Es otro equipo distinto — crear nuevo de todas formas
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
                  <button onClick={() => handleCrearEquipoYAgregar()} disabled={creandoEquipo} style={{ flex: 1, padding: '10px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '600', opacity: creandoEquipo ? .7 : 1 }}>
                    {creandoEquipo ? 'Creando...' : '+ Crear e inscribir en el torneo'}
                  </button>
                  <button onClick={() => { setMostrarCrearEquipo(false); setParecidosCrear([]) }} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}>Volver</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <button onClick={() => navigate('/admin/torneos')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', marginBottom: '20px' }}>
        <ArrowLeft size={16}/> Volver a torneos
      </button>

      {/* Header torneo — compacto: los conteos (equipos/jugadores/partidos) ya se
          repiten más abajo en la pestaña Actividad y en cada pestaña específica,
          así que aquí solo queda la identidad del torneo (logo, nombre, datos clave). */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {torneo.logo_url ? <img src={torneo.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <Trophy size={18} color="#1a73e8"/>}
            </div>
            <label style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', background: '#1a73e8', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Camera size={8} color="#fff"/>
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
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '1rem', fontWeight: '700', color: '#202124', lineHeight: 1.2, marginBottom: '3px' }}>{torneo.name}</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', fontSize: '.68rem' }}>
              {torneo.season    && <span style={{ color: '#9aa0a6' }}>📅 {torneo.season}</span>}
              {torneo.city      && <span style={{ color: '#9aa0a6' }}>📍 {torneo.city}</span>}
              {torneo.modalidad && <span style={{ color: '#1a73e8', background: '#e8f0fe', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>{torneo.modalidad}</span>}
              {torneo.genero    && <span style={{ color: '#6c35de', background: '#f3e8fd', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>{torneo.genero}</span>}
              {torneo.categoria && <span style={{ color: '#5f6368', background: '#f1f3f4', borderRadius: '8px', padding: '1px 7px', fontWeight: '600' }}>{torneo.categoria}</span>}
              {gruposFinalizados && <span style={{ color: '#1e8e3e', background: '#e6f4ea', borderRadius: '8px', padding: '1px 7px', fontWeight: '700' }}>⚡ Eliminatorias</span>}
            </div>
          </div>
          <button onClick={() => { setFormTorneo({ name: torneo.name, city: torneo.city, season: torneo.season, categoria: torneo.categoria, modalidad: torneo.modalidad, genero: torneo.genero, equipos_permitidos: torneo.equipos_permitidos ?? 0, requiere_cedula: torneo.requiere_cedula !== false, registro_simple: torneo.registro_simple === true, pts_victoria: torneo.pts_victoria ?? 3, pts_empate: torneo.pts_empate ?? 1, pts_derrota: torneo.pts_derrota ?? 0, limite_jugadores_equipo: torneo.limite_jugadores_equipo ?? '' }); setEditandoTorneo(true) }}
            title="Editar torneo"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368' }}>
            <Pencil size={13}/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '4px', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,.06)', flexWrap: 'wrap' }}>
        {TABS.filter(t => (t.id !== 'finanzas' || finanzasActivas) && !(t.id === 'equipos' && esOrganizador && torneoFinalizado)).map(t => (
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
                  <input type="number" min="1" max="8" value={grupos.length > 0 ? (torneo?.equipos_clasifican || clasificanPorGrupo) : clasificanPorGrupo}
                    disabled={grupos.length > 0} title={grupos.length > 0 ? 'Ya se crearon los grupos con este valor — no se puede cambiar acá' : ''}
                    onChange={e => setClasificanPorGrupo(parseInt(e.target.value))} style={{ ...inputStyle, opacity: grupos.length > 0 ? .65 : 1, cursor: grupos.length > 0 ? 'not-allowed' : 'text' }}/>
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
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={handleCrearGrupos} disabled={generandoGrupos}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: generandoGrupos ? .7 : 1 }}>
                  <Shuffle size={16}/> {generandoGrupos ? 'Creando...' : grupos.length > 0 ? 'Regenerar grupos (sortea de nuevo)' : 'Crear grupos y sortear equipos'}
                </button>
                {grupos.length > 0 && (
                  <button onClick={handleGenerarPartidosGrupos} disabled={generandoGrupos || !fechaGrupos}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: (!fechaGrupos || generandoGrupos) ? .6 : 1 }}>
                    <Calendar size={16}/> Generar partidos todos vs todos
                  </button>
                )}
              </div>
              {grupos.length > 0 && (
                <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '10px' }}>
                  🔀 Tocá el ícono junto a cada equipo (en las tablas de abajo) para moverlo a otro grupo manualmente. "Regenerar grupos" vuelve a sortear todo desde cero — no lo uses si ya acomodaste los grupos a mano. Si movés equipos después de haber generado los partidos, volvé a tocar "Generar partidos todos vs todos" para que se actualicen.
                </div>
              )}
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
                                <td style={{ padding: '8px 12px', position: 'relative' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '.65rem', fontWeight: '700', color: clasifica ? color : '#9aa0a6', minWidth: '14px' }}>{i + 1}</span>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={row.equipo?.logo_url} name={row.equipo?.name} size={20}/></div>
                                    <span style={{ fontWeight: clasifica ? '700' : '500', color: '#202124', whiteSpace: 'nowrap', fontSize: '.78rem' }}>{row.equipo?.name}</span>
                                    {clasifica && <span style={{ fontSize: '.55rem', background: color, color: '#fff', borderRadius: '4px', padding: '1px 4px', fontWeight: '700' }}>✓</span>}
                                    {!gruposFinalizados && row.equipo && (
                                      <button onClick={() => setMoviendoEquipoId(moviendoEquipoId === row.equipo.id ? null : row.equipo.id)}
                                        title="Mover a otro grupo"
                                        style={{ marginLeft: 'auto', flexShrink: 0, background: '#f1f3f4', border: 'none', borderRadius: '6px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5f6368' }}>
                                        <Shuffle size={11}/>
                                      </button>
                                    )}
                                  </div>
                                  {moviendoEquipoId === row.equipo?.id && (
                                    <div onClick={() => setMoviendoEquipoId(null)}
                                      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                      <div onClick={e => e.stopPropagation()}
                                        style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,.3)', overflow: 'hidden', width: '100%', maxWidth: '280px' }}>
                                        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div style={{ fontSize: '.85rem', fontWeight: '700', color: '#202124' }}>Mover {row.equipo?.name}</div>
                                          <button onClick={() => setMoviendoEquipoId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={18}/></button>
                                        </div>
                                        <div style={{ padding: '6px' }}>
                                          {grupos.filter(g => g.id !== grupo.id).map(g => (
                                            <button key={g.id} onClick={() => { handleMoverEquipoGrupo(row.equipo.id, g.id); setMoviendoEquipoId(null) }}
                                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '.85rem', color: '#202124', fontWeight: '600' }}>
                                              → {g.nombre}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
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
                              <span style={{ flex: 1, minWidth: 0, fontSize: '.75rem', color: '#202124', fontWeight: '500', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</span>
                              <span style={{ fontWeight: '700', color: '#202124', background: p.status === 'finished' ? '#f1f3f4' : '#e8f0fe', borderRadius: '6px', padding: '2px 8px', fontSize: '.78rem', flexShrink: 0 }}>
                                {p.status === 'finished' ? `${p.home_score} - ${p.away_score}` : 'vs'}
                              </span>
                              <span style={{ flex: 1, minWidth: 0, fontSize: '.75rem', color: '#202124', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</span>
                              {p.status !== 'finished' && (
                                <button onClick={() => abrirPlanilla(p)}
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
            {(() => {
              const grupos_ = {}
              canchas.forEach(c => { const k = c.escenario || 'Sin sede'; (grupos_[k] = grupos_[k] || []).push(c) })
              const entradas = Object.entries(grupos_)
              if (entradas.length === 0) return <div style={{ fontSize: '.8rem', color: '#9aa0a6', marginBottom: '10px' }}>Sin canchas</div>
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {entradas.map(([esc, lista]) => (
                    <div key={esc}>
                      <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '4px' }}>🏟️ {esc} · {lista.length} cancha{lista.length !== 1 ? 's' : ''}</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {lista.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e8f0fe', borderRadius: '20px', padding: '3px 6px 3px 12px' }}>
                            <span style={{ fontSize: '.8rem', color: '#1a73e8' }}>{c.nombre}</span>
                            <button onClick={() => handleEliminarCancha(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', fontSize: '.75rem', padding: '0 3px', lineHeight: 1 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={nuevaCanchaEscenario} onChange={e => setNuevaCanchaEscenario(e.target.value)} placeholder="Sede/escenario (opcional, ej: Centegol)..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAgregarCancha()}/>
              <input value={nuevaCancha} onChange={e => setNuevaCancha(e.target.value)} placeholder="Nombre de la cancha..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAgregarCancha()}/>
              <button onClick={handleAgregarCancha} style={{ padding: '8px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem' }}>+ Agregar</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['partidos','jornada'].map(st => (
                <button key={st} onClick={() => setSubTab(st)}
                  style={{ padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '.875rem', fontWeight: '500', background: subTab === st ? '#1a73e8' : '#fff', color: subTab === st ? '#fff' : '#5f6368', border: subTab === st ? 'none' : '1px solid #dadce0' }}>
                  {st === 'partidos' ? 'Crear Partido' : 'Jornada Automática'}
                </button>
              ))}
            </div>
            {partidos.length > 0 && (
              <button onClick={() => setShowFlyerProgramacion(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
                <ImageIcon size={16}/> Crear flyer
              </button>
            )}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                      <div><label style={labelStyle}>Fecha *</label><input type="date" value={formPartido.played_at} onChange={e => setFormPartido(f => ({ ...f, played_at: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Hora</label><input type="time" value={formPartido.hora} onChange={e => setFormPartido(f => ({ ...f, hora: e.target.value }))} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Cancha</label><select value={formPartido.location} onChange={e => setFormPartido(f => ({ ...f, location: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option>{canchas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                      <div><label style={labelStyle}>Jornada #</label><input type="number" value={formPartido.matchday} onChange={e => setFormPartido(f => ({ ...f, matchday: e.target.value }))} style={inputStyle} placeholder="1"/></div>
                      <div><label style={labelStyle}>Fase</label><select value={formPartido.fase} onChange={e => setFormPartido(f => ({ ...f, fase: e.target.value }))} style={inputStyle}>{FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
                    </div>
                    {arbitrosAdmin.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        <div>
                          <label style={labelStyle}>🟡 Árbitro principal</label>
                          <select value={formPartido.arbitro1_id} onChange={e => setFormPartido(f => ({ ...f, arbitro1_id: e.target.value }))} style={inputStyle}>
                            <option value="">Sin asignar</option>
                            {arbitrosAdmin.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>🟡 Árbitro asistente 1</label>
                          <select value={formPartido.arbitro2_id} onChange={e => setFormPartido(f => ({ ...f, arbitro2_id: e.target.value }))} style={inputStyle}>
                            <option value="">Sin asignar</option>
                            {arbitrosAdmin.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>🟡 Árbitro asistente 2</label>
                          <select value={formPartido.arbitro3_id} onChange={e => setFormPartido(f => ({ ...f, arbitro3_id: e.target.value }))} style={inputStyle}>
                            <option value="">Sin asignar</option>
                            {arbitrosAdmin.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={handleCrearPartido} disabled={loadingPartido} style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}>{loadingPartido ? 'Guardando...' : 'Crear partido'}</button>
                    <button onClick={() => setShowFormPartido(false)} style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Lista partidos — acordeón por jornada */}
              {partidos.length === 0 && !showFormPartido ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
                  <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay partidos programados</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {agruparPartidosPorJornada(partidos).map(jornada => {
                    const isOpen    = !!abiertosJornada[jornada.key]
                    const jugados   = jornada.partidos.filter(p => p.status === 'finished').length
                    const pendientes= jornada.partidos.length - jugados
                    const esFase    = jornada.key.startsWith('fase_')
                    return (
                      <div key={jornada.key} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                        {/* Header */}
                        <div onClick={() => toggleJornada(jornada.key)}
                          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: esFase ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#fff' }}
                          onMouseEnter={e => !esFase && (e.currentTarget.style.background='#f8f9fa')}
                          onMouseLeave={e => !esFase && (e.currentTarget.style.background='#fff')}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '.9rem', color: esFase?'#fff':'#202124' }}>{jornada.label}</div>
                            <div style={{ fontSize: '.68rem', color: esFase?'rgba(255,255,255,.75)':'#9aa0a6', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {jornada.fechas.length > 0 && <span>📅 {jornada.fechas.join(' · ')}</span>}
                              <span>{jornada.partidos.length} partido{jornada.partidos.length!==1?'s':''}</span>
                              {jugados   > 0 && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#1e8e3e' }}>✓ {jugados} jugado{jugados!==1?'s':''}</span>}
                              {pendientes> 0 && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#e8710a' }}>⏳ {pendientes} pendiente{pendientes!==1?'s':''}</span>}
                            </div>
                          </div>
                          {isOpen ? <ChevronUp size={16} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/> : <ChevronDown size={16} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/>}
                        </div>
                        {/* Partidos */}
                        {isOpen && jornada.partidos.map((p, i) => {
                          const esJugado = p.status === 'finished'
                          return (
                            <div key={p.id} style={{ padding: '10px 16px', borderTop: '1px solid #f1f3f4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ minWidth: '58px', flexShrink: 0 }}>
                                  {p.played_at && <>
                                    <div style={{ fontSize: '.65rem', color: '#5f6368', fontWeight: '600' }}>{new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})}</div>
                                    <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>{fmtHoraDate(p.played_at)}</div>
                                  </>}
                                  {p.location && <div style={{ fontSize: '.6rem', color: '#1a73e8' }}>📍 {p.location}</div>}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</span>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={24}/></div>
                                  </div>
                                  {esJugado ? (
                                    <div style={{ fontWeight: '800', fontSize: '.92rem', color: '#202124', background: '#f1f3f4', padding: '3px 10px', borderRadius: '7px', flexShrink: 0 }} onClick={() => setModalPartidoAdmin(p)}>
                                      {p.home_score} - {p.away_score}
                                    </div>
                                  ) : (
                                    <div style={{ fontWeight: '700', fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', padding: '3px 9px', borderRadius: '7px', flexShrink: 0 }}>VS</div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={24}/></div>
                                    <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {!esJugado && <button onClick={() => { const { fecha, hora } = playedAtToLocal(p.played_at); setFormEditPartido({played_at:fecha,hora,location:p.location||'',matchday:p.matchday||'',fase:p.fase||'grupo',arbitro1_id:p.arbitro1_id||'',arbitro2_id:p.arbitro2_id||'',arbitro3_id:p.arbitro3_id||''}); setEditandoPartidoForm(p) }} style={{ background:'none', border:'1px solid #dadce0', borderRadius:'6px', padding:'5px 9px', cursor:'pointer', color:'#5f6368', fontSize:'.75rem' }}>✏️ Editar</button>}
                                <button onClick={() => abrirPlanilla(p)} style={{ background: esJugado?'none':'#1a73e8', border: esJugado?'1px solid #dadce0':'none', borderRadius:'6px', padding:'5px 10px', cursor:'pointer', color: esJugado?'#5f6368':'#fff', fontSize:'.75rem', fontWeight: '600', display:'flex', alignItems:'center', gap:'4px' }}>
                                  {esJugado ? '✏️ Resultado' : <><Check size={12}/> Resultado</>}
                                </button>
                                <button onClick={() => setPartidoAEliminar(p)} style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'5px 9px', cursor:'pointer', color:'#d93025', display:'flex', alignItems:'center', gap:'4px', fontSize:'.75rem' }}><X size={13}/> Eliminar</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {subTab === 'jornada' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} color="#1a73e8"/> Preferencias de días y hora por equipo</div>
                <div style={{ fontSize: '.78rem', color: '#9aa0a6', marginBottom: '14px' }}>Opcional — el sorteo intenta programar cada cruce en un día que les sirva a los dos equipos (dentro del rango de fechas de abajo) y respeta el "no antes de" de cada uno. Además reparte los horarios entre jornadas para que no le toque siempre el mismo horario al mismo equipo. Se guarda solo, no hace falta botón.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto', border: '1px solid #f1f3f4', borderRadius: '10px', padding: '10px' }}>
                  {equipos.map(e => (
                    <div key={e.tournament_team_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '4px 0' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={e.logo_url} name={e.name} size={22}/></div>
                      <span style={{ fontSize: '.78rem', fontWeight: '600', color: '#202124', minWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {DIAS_SEMANA_UI.map(d => {
                          const activo = (e.dias_preferidos || []).includes(d.key)
                          return (
                            <button key={d.key} onClick={() => toggleDiaPreferido(e, d.key)} title={d.key}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: activo ? 'none' : '1px solid #dadce0', background: activo ? '#1a73e8' : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.68rem', fontWeight: '700', cursor: 'pointer' }}>
                              {d.corta}
                            </button>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: '.7rem', color: '#9aa0a6' }}>no antes de</span>
                      <input type="time" value={e.hora_preferida || ''} onChange={ev => guardarPreferenciaEquipo(e, { hora_preferida: ev.target.value })}
                        title="No programar antes de esta hora (opcional) — ej: 19:00 si prefieren jugar después de las 7pm"
                        style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', width: '90px' }}/>
                      {guardandoPref === e.tournament_team_id && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>guardando...</span>}
                    </div>
                  ))}
                  {equipos.length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6' }}>Agrega equipos al torneo primero.</div>}
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Shuffle size={18} color="#1a73e8"/> Configurar jornada automática</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
                  <div><label style={labelStyle}>Número de jornada</label><input type="number" value={configJornada.numero} onChange={e => setConfigJornada(f => ({ ...f, numero: e.target.value }))} style={inputStyle} placeholder={fechas.length + 1}/></div>
                  <div><label style={labelStyle}>Fecha inicio *</label><input type="date" value={configJornada.fecha} onChange={e => setConfigJornada(f => ({ ...f, fecha: e.target.value }))} style={inputStyle}/></div>
                  <div><label style={labelStyle}>Fecha fin</label><input type="date" value={configJornada.fecha_fin} min={configJornada.fecha || undefined} onChange={e => setConfigJornada(f => ({ ...f, fecha_fin: e.target.value }))} style={inputStyle} placeholder="Igual a fecha inicio"/></div>
                  <div/>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>¿Qué días de esa semana se juega?</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {DIAS_SEMANA_UI.map(d => {
                      const activo = (configJornada.dias_semana || DIAS_SEMANA.map(x => x.key)).includes(d.key)
                      return (
                        <button key={d.key} onClick={() => toggleDiaSemanaJornada(d.key)} title={d.key}
                          style={{ width: '30px', height: '30px', borderRadius: '7px', border: activo ? 'none' : '1px solid #dadce0', background: activo ? '#1a73e8' : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.72rem', fontWeight: '700', cursor: 'pointer' }}>
                          {d.corta}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
                  <div><label style={labelStyle}>Hora desde *</label><input type="time" value={configJornada.hora_inicio} onChange={e => setConfigJornada(f => ({ ...f, hora_inicio: e.target.value }))} style={inputStyle}/></div>
                  <div><label style={labelStyle}>Hora hasta</label><input type="time" value={configJornada.hora_fin} onChange={e => setConfigJornada(f => ({ ...f, hora_fin: e.target.value }))} style={inputStyle} placeholder="Sin límite"/></div>
                </div>
                <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '6px' }}>"Hora desde/hasta" es el horario por defecto — para un día en particular podés marcar horarios distintos abajo (ej: sábado solo 8 y 9, domingo 5-6-7-8).</div>

                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Horarios específicos por día (opcional)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {DIAS_SEMANA_UI.filter(d => (configJornada.dias_semana || DIAS_SEMANA.map(x => x.key)).includes(d.key)).map(d => {
                      const marcadas = (configJornada.horarios_por_dia || {})[d.key] || []
                      return (
                        <div key={d.key}>
                          <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#202124', marginBottom: '4px' }}>{d.label}{marcadas.length === 0 && <span style={{ fontWeight: '400', color: '#9aa0a6' }}> — usa Hora desde/hasta</span>}</div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {HORAS_CHIP.map(h => {
                              const activo = marcadas.includes(h)
                              return (
                                <button key={h} onClick={() => toggleHorarioDia(d.key, h)}
                                  style={{ padding: '4px 8px', borderRadius: '6px', border: activo ? 'none' : '1px solid #dadce0', background: activo ? '#1e8e3e' : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.7rem', fontWeight: '600', cursor: 'pointer' }}>
                                  {fmtHora12(h)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    {(configJornada.dias_semana || DIAS_SEMANA.map(x => x.key)).length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6' }}>Marca primero qué días se juega, arriba.</div>}
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Escenarios y canchas a usar en esta jornada</label>
                  {(() => {
                    const grupos_ = {}
                    canchas.forEach(c => { const k = c.escenario || 'Sin sede'; (grupos_[k] = grupos_[k] || []).push(c) })
                    const entradas = Object.entries(grupos_)
                    const seleccionadas = configJornada.cancha_ids || canchas.map(c => c.id)
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #f1f3f4', borderRadius: '10px', padding: '10px' }}>
                        {entradas.map(([esc, lista]) => {
                          const todasMarcadas = lista.every(c => seleccionadas.includes(c.id))
                          return (
                            <div key={esc}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '.78rem', fontWeight: '700', color: '#202124', marginBottom: '4px' }}>
                                <input type="checkbox" checked={todasMarcadas} onChange={() => toggleEscenarioJornada(lista)}/>
                                🏟️ {esc} · {lista.length} cancha{lista.length !== 1 ? 's' : ''}
                              </label>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginLeft: '22px' }}>
                                {lista.map(c => (
                                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '.75rem', color: '#5f6368' }}>
                                    <input type="checkbox" checked={seleccionadas.includes(c.id)} onChange={() => toggleCanchaJornada(c.id)}/>
                                    {c.nombre}
                                  </label>
                                ))}
                              </div>
                              {todasMarcadas === true || lista.some(c => seleccionadas.includes(c.id)) ? (
                                <div style={{ marginLeft: '22px', marginTop: '6px' }}>
                                  <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginBottom: '3px' }}>¿Qué días se usa {esc}?{(!((configJornada.dias_por_escenario || {})[esc]?.length)) && <span> — todos los días marcados arriba</span>}</div>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    {DIAS_SEMANA_UI.map(d => {
                                      const diasEsc = (configJornada.dias_por_escenario || {})[esc] || []
                                      const activo = diasEsc.includes(d.key)
                                      return (
                                        <button key={d.key} onClick={() => toggleDiaEscenario(esc, d.key)} title={d.key}
                                          style={{ width: '26px', height: '26px', borderRadius: '6px', border: activo ? 'none' : '1px solid #dadce0', background: activo ? '#f9ab00' : '#fff', color: activo ? '#fff' : '#9aa0a6', fontSize: '.65rem', fontWeight: '700', cursor: 'pointer' }}>
                                          {d.corta}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                        {entradas.length === 0 && <div style={{ fontSize: '.78rem', color: '#9aa0a6' }}>Agrega canchas en la sección "Canchas" primero.</div>}
                      </div>
                    )
                  })()}
                </div>

                <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '10px' }}>
                  📅 Si dejas "Fecha fin" vacía, todos los partidos quedan en un solo día como antes. Si le pones un rango, el sorteo reparte los cruces entre esas fechas según los días marcados arriba y la preferencia de días de cada equipo. La hora "hasta" es un tope para todos los partidos de esta jornada (además del "no antes de" de cada equipo). Con los días 🟠 de cada escenario podés limitar, por ejemplo, que Old Traffod solo se use los sábados y Gol solo domingo y lunes.
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
                      <button onClick={salirJornada} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #fad2cf', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#d93025', fontSize: '.8rem' }}><X size={14}/> Salir</button>
                      <button onClick={generarJornada} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}><Shuffle size={14}/> Regenerar</button>
                      <button onClick={handleGuardarJornada} disabled={loadingPartido} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500', opacity: loadingPartido ? .7 : 1 }}><Check size={14}/> {loadingPartido ? 'Guardando...' : 'Guardar jornada'}</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {jornadaGenerada.map((p, i) => {
                      const veces = p.descanso ? 0 : vecesEnfrentados(p.local?.id, p.visitante?.id)
                      return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', borderRadius: '10px', border: veces > 0 ? '1px solid #f9ab00' : '1px solid #e8eaed', background: p.descanso ? '#f8f9fa' : veces > 0 ? '#fffbf0' : '#fff' }}>
                        {p.descanso ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div data-drop-pi={i} data-drop-slot="local"
                              onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); iniciarDragEquipo(i, 'local') }}
                              onPointerMove={e => moverDragEquipo(e.clientX, e.clientY)}
                              onPointerUp={e => soltarDragEquipo(e.clientX, e.clientY)}
                              onPointerCancel={cancelarDragEquipo}
                              style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: drag?.pi === i && drag?.slot === 'local' ? .4 : 1, border: dragOver?.pi === i && dragOver?.slot === 'local' ? '2px dashed #1a73e8' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'local' ? 'rgba(26,115,232,.06)' : 'transparent' }}>
                              <GripVertical size={13} color="#9aa0a6"/>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.local?.logo_url} name={p.local?.name} size={24}/></div>
                              <span style={{ color: '#9aa0a6', fontSize: '.875rem', fontStyle: 'italic' }}>{p.local?.name} — descansa</span>
                            </div>
                            <span style={{ fontSize: '.65rem', color: '#bdbdbd' }}>arrástralo sobre un partido para ponerlo a jugar</span>
                          </div>
                        ) : (
                          <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div data-drop-pi={i} data-drop-slot="local"
                              onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); iniciarDragEquipo(i, 'local') }}
                              onPointerMove={e => moverDragEquipo(e.clientX, e.clientY)}
                              onPointerUp={e => soltarDragEquipo(e.clientX, e.clientY)}
                              onPointerCancel={cancelarDragEquipo}
                              style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: drag?.pi === i && drag?.slot === 'local' ? .4 : 1, border: dragOver?.pi === i && dragOver?.slot === 'local' ? '2px dashed #1a73e8' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'local' ? 'rgba(26,115,232,.06)' : 'transparent' }}>
                              <GripVertical size={13} color="#9aa0a6"/>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.local?.logo_url} name={p.local?.name} size={24}/></div>
                              <div style={{ minWidth: 0 }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.local?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Local</div></div>
                            </div>
                            <span style={{ fontWeight: '700', color: '#9aa0a6', fontSize: '.75rem', flexShrink: 0 }}>VS</span>
                            <div data-drop-pi={i} data-drop-slot="visitante"
                              onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); iniciarDragEquipo(i, 'visitante') }}
                              onPointerMove={e => moverDragEquipo(e.clientX, e.clientY)}
                              onPointerUp={e => soltarDragEquipo(e.clientX, e.clientY)}
                              onPointerCancel={cancelarDragEquipo}
                              style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', padding: '6px 10px', borderRadius: '8px', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: drag?.pi === i && drag?.slot === 'visitante' ? .4 : 1, border: dragOver?.pi === i && dragOver?.slot === 'visitante' ? '2px dashed #e8710a' : '2px solid transparent', background: dragOver?.pi === i && dragOver?.slot === 'visitante' ? 'rgba(232,113,10,.06)' : 'transparent' }}>
                              <div style={{ textAlign: 'right', minWidth: 0 }}><div style={{ fontWeight: '600', color: '#202124', fontSize: '.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.visitante?.name}</div><div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>Visitante</div></div>
                              <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.visitante?.logo_url} name={p.visitante?.name} size={24}/></div>
                              <GripVertical size={13} color="#9aa0a6"/>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {p.intergrupo && <span style={{ fontSize: '.65rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>Intergrupo</span>}
                              {editJornadaIdx === i ? (
                                <>
                                  <input type="date" value={p.fecha || configJornada.fecha} onChange={e => actualizarPartidoJornada(i, { fecha: e.target.value })}
                                    style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124' }}/>
                                  <input type="time" value={p.hora || ''} onChange={e => actualizarPartidoJornada(i, { hora: e.target.value })}
                                    style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124' }}/>
                                  <select value={p.cancha ? String(p.cancha.id) : ''} onChange={e => actualizarPartidoJornada(i, { cancha: canchas.find(c => String(c.id) === e.target.value) || null })}
                                    style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', maxWidth: '140px' }}>
                                    <option value="">Sin cancha</option>
                                    {canchas.map(c => <option key={c.id} value={String(c.id)}>{c.escenario ? `${c.escenario} · ` : ''}{c.nombre}</option>)}
                                  </select>
                                  <button onClick={() => setEditJornadaIdx(null)} title="Listo"
                                    style={{ background: '#1e8e3e', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                                    <Check size={13}/>
                                  </button>
                                </>
                              ) : (
                                <>
                                  {p.fecha && (
                                    <span style={{ fontSize: '.72rem', color: '#5f6368' }}>📅 {new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                                  )}
                                  {p.hora ? (
                                    <span style={{ fontSize: '.72rem', color: '#5f6368' }}>🕐 {fmtHora12(p.hora)}</span>
                                  ) : (
                                    <span style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '700' }}>🕐 Sin hora</span>
                                  )}
                                  <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>📍 {p.cancha ? `${p.cancha.escenario ? p.cancha.escenario + ' · ' : ''}${p.cancha.nombre}` : 'Sin cancha'}</span>
                                  <button onClick={() => setEditJornadaIdx(i)} title="Editar fecha, horario y cancha"
                                    style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
                                    ✏️ Editar
                                  </button>
                                </>
                              )}
                              <button onClick={() => handleEliminarParejaJornada(i)} title="Eliminar partido — ambos equipos pasan a descansar"
                                style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                                <X size={13}/>
                              </button>
                          </div>
                          </>
                        )}
                        {!p.descanso && p.sinCoincidencia && (
                          <div style={{ fontSize: '.72rem', color: '#e8710a', fontWeight: '600', paddingLeft: '10px' }}>
                            ⚠️ {p.local?.name} y {p.visitante?.name} no comparten ningún día preferido — se le puso una fecha cualquiera del rango, revisala.
                          </div>
                        )}
                        {!p.descanso && p.sinHorarioDisponible && (
                          <div style={{ fontSize: '.72rem', color: '#e8710a', fontWeight: '600', paddingLeft: '10px' }}>
                            ⚠️ No había ningún horario libre ese día que cumpliera el "no antes de" de {p.local?.name} y/o {p.visitante?.name} — se le puso el horario disponible más cercano, revisalo.
                          </div>
                        )}
                        {!p.descanso && p.usoHoraDefault && (
                          <div style={{ fontSize: '.72rem', color: '#e8710a', fontWeight: '600', paddingLeft: '10px' }}>
                            ⚠️ Ese día no tiene horarios marcados en "Horarios específicos por día" — se usó "Hora desde" ({configJornada.hora_inicio ? fmtHora12(configJornada.hora_inicio) : 'vacía'}) como horario por defecto. Marca las horas de ese día arriba, o edita el horario acá con "✏️ Editar".
                          </div>
                        )}
                        {!p.descanso && p.sinCupo && (
                          <div style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '600', paddingLeft: '10px' }}>
                            ⚠️ No alcanzó cupo (horarios × canchas) ese día para este partido — quedó SIN hora ni cancha. Marca más horas para ese día, agrega otra cancha/escenario, o edita el horario acá con "✏️ Editar" para ponerlo en otro momento.
                          </div>
                        )}
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
      {tab === 'equipos' && (esOrganizador && torneoFinalizado ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Trophy size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div>Este torneo ya finalizó — los equipos y jugadores ya no están disponibles.</div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '.8rem', color: '#9aa0a6' }}>
              {equipos.length} equipo{equipos.length!==1?'s':''} activos
              {esOrganizador && (
                <span style={{ marginLeft: '8px', fontWeight: '600', color: cupoEquiposAlcanzado() ? '#d93025' : '#5f6368' }}>
                  · Cupo {equipos.length}/{torneo?.equipos_permitidos || 0}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!esOrganizador && (
                <button onClick={() => setVerDesact(!verDesact)}
                  style={{ padding: '6px 14px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
                  {verDesact ? 'Ocultar desactivados' : 'Ver desactivados'}
                </button>
              )}
              {equipos.length > 0 && (
                <button onClick={() => setShowFlyerTorneo(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #1a73e8', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#1a73e8', fontSize: '.875rem', fontWeight: '500' }}>
                  <ImageIcon size={16}/> Crear flyer
                </button>
              )}
              <button onClick={() => setShowAgregarEquipo(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
                <Plus size={16}/> Agregar equipo
              </button>
            </div>
          </div>

          {/* Equipos activos */}
          {equipos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
              <Shield size={36} style={{ opacity: .3, marginBottom: '8px' }}/><div>No hay equipos inscritos</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: '16px' }}>
              {equipos.map((e, i) => {
                const jugsEquipo = jugadores.filter(j => j.team_id === e.id && j.activo !== false)
                const grupoEq    = grupoEquipos.find(ge => ge.team_id === e.id)
                const grupo      = grupoEq ? grupos.find(g => g.id === grupoEq.grupo_id) : null
                const menuAbierto = menuEquipoId === e.id
                const equipoDiv = (
                  <div style={{ padding: '14px 20px', borderBottom: jugadoresEquipoId!==e.id && i < equipos.length - 1 ? '1px solid #f1f3f4' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={e.logo_url} name={e.name} size={44}/></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>{e.name}</div>
                        {grupo && <span style={{ fontSize: '.68rem', color: '#9955ff', background: '#f3e8fd', borderRadius: '10px', padding: '1px 8px', fontWeight: '600' }}>{grupo.nombre}</span>}
                      </div>
                      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px', display: 'flex', gap: '8px' }}>
                        <span>👥 {jugsEquipo.length} jugadores</span>
                        {e.city && <span>📍 {e.city}</span>}
                        {e.modalidad && <span>{e.modalidad}</span>}
                      </div>
                    </div>
                    {/* Menú 3 puntos */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button onClick={() => setMenuEquipoId(menuAbierto ? null : e.id)}
                        style={{ background: menuAbierto?'#f1f3f4':'none', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5f6368' }}>
                        ···
                      </button>
                      {menuAbierto && (
                        <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,.12)', zIndex: 200, minWidth: '190px', padding: '6px 0' }}>
                          {[
                            { label: 'Ver jugadores',     icon: '👥', action: () => { setJugadoresEquipoId(jugadoresEquipoId===e.id?null:e.id); setMenuEquipoId(null) } },
                            { label: 'Editar equipo',     icon: '✏️', action: () => { setMenuEquipoId(null); navigate(`/admin/equipos/${e.id}`) } },
                            { label: 'Descargar escudo',  icon: '⬇️', action: () => { descargarEscudo(e); setMenuEquipoId(null) } },
                            { label: 'Compartir link',    icon: '🔗', action: () => {
                                const link = `${window.location.origin}/registro/equipo/${e.registro_token}/${id}`
                                const mensaje = `📋 Registro de jugadores — ${e.name}\n\nEste link es para inscribir a los jugadores del equipo ${e.name} en el torneo ${torneo?.name || ''}.\n\n⏰ Válido por 24 horas desde ahora.\n\nPodés inscribir vos mismo a todos los jugadores desde acá, o enviarle este mismo link a cada jugador para que se inscriba él mismo.\n\n👉 ${link}`
                                navigator.clipboard.writeText(mensaje)
                                // Reinicia el reloj de 24h del link cada vez que se comparte de nuevo
                                supabase.from('teams').update({ registro_token_generado_en: new Date().toISOString() }).eq('id', e.id).then(() => {}, () => {})
                                showMsg('Link copiado con la descripción ✓')
                                setMenuEquipoId(null)
                              } },
                            { label: 'Poster bienvenida', icon: '🖼️', action: () => { setPosterEquipo(e); setMenuEquipoId(null) } },
                            { label: 'Uniforme',          icon: '👕', action: () => { setUniformeEquipo(e); setMenuEquipoId(null) } },
                            ...(esOrganizador ? [] : [{ label: 'Desactivar equipo', icon: '🚫', action: () => { handleDesactivarEquipo(e); setMenuEquipoId(null) }, color: '#d93025' }]),
                          ].map((op, idx) => (
                            <button key={idx} onClick={op.action}
                              style={{ width: '100%', padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '.875rem', color: op.color||'#202124', textAlign: 'left' }}
                              onMouseEnter={e2 => e2.currentTarget.style.background='#f8f9fa'}
                              onMouseLeave={e2 => e2.currentTarget.style.background='none'}>
                              <span>{op.icon}</span>{op.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
                return (
                  <Fragment key={e.id}>
                    {equipoDiv}
                    {/* Panel jugadores del equipo */}
                  {jugadoresEquipoId === e.id && (() => {
                    const jugsActivos = jugadores.filter(j => j.team_id === e.id && j.activo !== false)
                    const jugsDesact  = jugadores.filter(j => j.team_id === e.id && j.activo === false)
                    return (
                      <div style={{ borderTop:'1px solid #f1f3f4', background:'#f8f9fa', padding:'12px 20px 14px' }}>
                        <div style={{ fontSize:'.72rem', fontWeight:'700', color: torneo?.limite_jugadores_equipo && jugsActivos.length >= torneo.limite_jugadores_equipo ? '#d93025' : '#5f6368', marginBottom:'10px' }}>
                          👥 Jugadores de {e.name} · {jugsActivos.length}/{torneo?.limite_jugadores_equipo || '∞'}
                        </div>
                        {jugsActivos.length === 0 ? (
                          <div style={{ fontSize:'.78rem', color:'#9aa0a6', marginBottom:'8px' }}>Sin jugadores activos</div>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'10px' }}>
                            {jugsActivos.map(j => {
                              const p = j.players || {}
                              const sancion = sancionDeJugador(j.player_id)
                              return (
                                <div key={j.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'#fff', borderRadius:'8px', padding:'8px 12px', border: sancion ? '1px solid #fad2cf' : '1px solid #e8eaed' }}>
                                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#f1f3f4', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    {p.photo_face_url || p.photo_url
                                      ? <img src={p.photo_face_url||p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                                      : <span style={{ fontSize:'.85rem' }}>👤</span>}
                                  </div>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:'.82rem', fontWeight:'600', color:'#202124' }}>{p.name||'—'}</div>
                                    <div style={{ fontSize:'.65rem', color:'#9aa0a6' }}>{p.posicion_futbol5||p.posicion_futbol7||p.posicion_futbol11||'Sin posición'}</div>
                                    {sancion && (
                                      <div style={{ fontSize:'.65rem', color:'#d93025', fontWeight:'600', marginTop:'2px' }}>
                                        🚫 Sancionado{sancion.fecha_fin ? ` hasta ${new Date(sancion.fecha_fin).toLocaleDateString('es-CO')}` : ' (indefinido)'} — {sancion.motivo}
                                      </div>
                                    )}
                                  </div>
                                  {sancion ? (
                                    esAdminRol && (
                                      <button onClick={() => handleLevantarSancion(sancion.id)}
                                        style={{ background:'#e6f4ea', border:'1px solid #ceead6', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', color:'#1e8e3e', fontSize:'.68rem', flexShrink:0, fontWeight:'600' }}>
                                        Levantar sanción
                                      </button>
                                    )
                                  ) : (
                                    <button onClick={() => { setModalSuspender(j); setFormSancion({ motivo:'', meses:'1' }) }}
                                      style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', color:'#e8710a', fontSize:'.68rem', flexShrink:0, fontWeight:'600' }}>
                                      Suspender
                                    </button>
                                  )}
                                  <button onClick={async () => {
                                    if (!confirm('¿Sacar a ' + p.name + ' del equipo en este torneo? Ya no hará parte del equipo, pero sus estadísticas se conservan.')) return
                                    await supabase.from('tournament_player_registrations').update({ activo: false }).eq('id', j.id)
                                    fetchJugadores()
                                  }} style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', color:'#d93025', fontSize:'.68rem', flexShrink:0 }}>
                                    Sacar del equipo
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {jugsDesact.length > 0 && (
                          <div>
                            <div style={{ fontSize:'.68rem', fontWeight:'700', color:'#9aa0a6', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'.05em' }}>🚫 Desactivados</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                              {jugsDesact.map(j => {
                                const p = j.players || {}
                                return (
                                  <div key={j.id} style={{ display:'flex', alignItems:'center', gap:'10px', background:'#fff', borderRadius:'8px', padding:'8px 12px', border:'1px solid #fad2cf', opacity:.75 }}>
                                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', overflow:'hidden', flexShrink:0, background:'#f1f3f4', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                      {p.photo_face_url || p.photo_url
                                        ? <img src={p.photo_face_url||p.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                                        : <span style={{ fontSize:'.85rem' }}>👤</span>}
                                    </div>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ fontSize:'.82rem', fontWeight:'600', color:'#9aa0a6' }}>{p.name||'—'}</div>
                                      <div style={{ fontSize:'.65rem', color:'#bdbdbd' }}>Desactivado</div>
                                    </div>
                                    <button onClick={async () => {
                                      await supabase.from('tournament_player_registrations').update({ activo: true }).eq('id', j.id)
                                      fetchJugadores()
                                    }} style={{ background:'#e6f4ea', border:'1px solid #ceead6', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', color:'#1e8e3e', fontSize:'.68rem', flexShrink:0, fontWeight:'600' }}>
                                      Reactivar
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  </Fragment>
                )
              })}
            </div>
          )}

          {/* Equipos desactivados */}
          {verDesact && !esOrganizador && (
            <div>
              <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#9aa0a6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🚫 Equipos desactivados
              </div>
              <EquiposDesactivadosTorneo torneoId={id} onReactivar={fetchEquipos} showMsg={showMsg}/>
            </div>
          )}

          {/* Modales poster y uniforme */}
          {posterEquipo   && <ModalPosterEquipo   equipo={posterEquipo}   onClose={() => setPosterEquipo(null)}/>}
          {uniformeEquipo && <ModalUniformeEquipo equipo={uniformeEquipo} onClose={() => setUniformeEquipo(null)}/>}
          {showFlyerTorneo && <FlyerTorneo torneo={torneo} equipos={equipos} onClose={() => setShowFlyerTorneo(false)}/>}

          {/* Modal suspender jugador — la sanción queda solo para este torneo */}
          {modalSuspender && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
              onClick={e => e.target === e.currentTarget && setModalSuspender(null)}>
              <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'380px', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }}>
                <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124', marginBottom:'4px' }}>🚫 Suspender jugador</div>
                <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'18px' }}>{modalSuspender.players?.name} — solo queda sancionado en este torneo. Para levantar la sanción hay que escribirle a Golmebol.</div>
                <div style={{ marginBottom:'12px' }}>
                  <label style={labelStyle}>Motivo</label>
                  <textarea value={formSancion.motivo} onChange={e => setFormSancion(f => ({ ...f, motivo: e.target.value }))} rows={3} style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }} placeholder="Ej: agresión a un árbitro en la jornada 5"/>
                </div>
                <div style={{ marginBottom:'18px' }}>
                  <label style={labelStyle}>Duración</label>
                  <select value={formSancion.meses} onChange={e => setFormSancion(f => ({ ...f, meses: e.target.value }))} style={inputStyle}>
                    <option value="1">1 mes</option>
                    <option value="2">2 meses</option>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                    <option value="0">Indefinida</option>
                  </select>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setModalSuspender(null)} style={{ flex:1, padding:'10px', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.85rem' }}>Cancelar</button>
                  <button onClick={handleSuspenderJugador} disabled={suspendiendo} style={{ flex:1, padding:'10px', background: suspendiendo ? '#dadce0' : '#d93025', border:'none', borderRadius:'8px', cursor: suspendiendo?'not-allowed':'pointer', color:'#fff', fontSize:'.85rem', fontWeight:'700' }}>
                    {suspendiendo ? 'Suspendiendo...' : 'Suspender'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── TAB ESTADÍSTICAS ── */}
      {tab === 'estadisticas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Tabla general */}
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de posiciones — Fase de grupos</div>
            <TablaPosiciones rows={tablaOrdenada} vacio="No hay resultados aún"/>
          </div>

          {/* Goleadores */}
          <div>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>Tabla de goleadores</div>
            {loadingStats ? (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Cargando...</div>
            ) : (
              <RankingPoster
                statLabel="goles" statColor="#ffd54a"
                vacio="No hay estadísticas aún."
                rows={goleadores.map(g => ({
                  id: `${g.player_id}-${g.team_id}`,
                  nombre: g.player_name,
                  foto: g.photo_url,
                  teamName: g.team_name,
                  teamLogo: g.team_logo,
                  valor: g.total_goals,
                  sub: `${g.partidos_jugados} PJ${(g.total_yellow||0)>0?` · 🟨${g.total_yellow}`:''}${(g.total_blue||0)>0?` · 🟦${g.total_blue}`:''}${(g.total_red||0)>0?` · 🟥${g.total_red}`:''}`,
                }))}
              />
            )}
          </div>

          {/* Valla menos vencida GLOBAL por equipo (igual que en jugadores y
              pública), con botones para medir por menos goles o por promedio */}
          <div>
            <VallaEquipos
              vacio="Sin resultados aún"
              rows={calcVallaEquipos()}
            />
          </div>
        </div>
      )}

      {/* ── TAB ELIMINATORIAS ── */}
      {/* ── TAB ELIMINATORIAS ── */}
      {tab === 'eliminatorias' && (
        <div>
          {/* Iniciar / reconfigurar — este cartel con el botón grande solo sale
              cuando todavía no hay ni siquiera equipos/grupos para armar una
              vista previa. En cuanto hay algo que previsualizar, se muestra
              directamente el árbol en vivo de más abajo (con su propio botón
              para pasar esos partidos a jugar de verdad) y este cartel se oculta,
              para no tener dos formas de arrancar la misma cosa a la vista. */}
          {bracket.length === 0 && !(grupos.length > 0 || equipos.length >= 2) ? (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <GitBranch size={40} color="#e8710a" style={{ marginBottom: '10px' }}/>
              <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.05rem', marginBottom: '4px' }}>Eliminaciones directas</div>
              <div style={{ fontSize: '.8rem', color: '#9aa0a6', marginBottom: '18px', maxWidth: '420px', margin: '0 auto 18px' }}>
                Cuando termine la fase de grupos, configura cuántos clasifican, el formato y cómo se arman las llaves. El árbol se va armando solo hasta la final.
              </div>
              <button onClick={abrirWizardElim}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: '#e8710a', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.95rem', fontWeight: '700' }}>
                ⚡ Iniciar eliminaciones directas
              </button>
            </div>
          ) : bracket.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {!bracket.some(m => m.status === 'finished') && (
                <button onClick={handleQuitarBracket}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #fad2cf', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#d93025', fontSize: '.8rem' }}>
                  🗑️ Quitar árbol (fue un error)
                </button>
              )}
              <button onClick={abrirWizardElim}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
                <Shuffle size={13}/> Reconfigurar eliminatorias
              </button>
            </div>
          ) : null}

          {/* Vista previa en vivo — se recalcula sola con cada resultado de grupos */}
          {bracket.length === 0 && (grupos.length > 0 || equipos.length >= 2) && !showWizardElim && (() => {
            const participantesPreview = participantesPreviewLive
            // Si arrastraste equipos a mano, se usa ese orden de siembra;
            // si no, el orden por posición/reclasificación de siempre.
            const mapaPreview = new Map(participantesPreview.map(p => [String(p.id), p]))
            const idsOrden = previewOrden && previewOrden.length === participantesPreview.length
              ? previewOrden.map(String)
              : participantesPreview.map(p => String(p.id))
            const ordenPreview = idsOrden.map(id => mapaPreview.get(id)).filter(Boolean)
            const parejasPreview = []
            const totalOrden = ordenPreview.length
            if (estiloLlaves === 'cruzado') {
              for (let i = 0; i < Math.floor(totalOrden / 2); i++) parejasPreview.push([ordenPreview[i], ordenPreview[totalOrden - 1 - i]])
            } else {
              for (let i = 0; i < totalOrden - 1; i += 2) parejasPreview.push([ordenPreview[i], ordenPreview[i + 1]])
            }
            const totalPreview = parejasPreview.length * 2 + (byeInicialPreviewLive ? 1 : 0)
            if (parejasPreview.length === 0 && !byeInicialPreviewLive) return null

            // Arma las columnas del árbol igual que el bracket real: la ronda
            // actual con los equipos que van clasificando, y las siguientes
            // rondas como placeholders "Por definir" hasta llegar al campeón.
            const columnasPreview = []
            let llavesRonda = parejasPreview.map(([a, b]) => ({ a, b }))
            let totalRonda = totalPreview
            while (true) {
              columnasPreview.push({ total: totalRonda, fase: getFaseValue(totalRonda), llaves: llavesRonda })
              if (llavesRonda.length <= 1) break
              const siguienteN = Math.max(Math.floor(llavesRonda.length / 2), 1)
              llavesRonda = Array.from({ length: siguienteN }, () => null)
              totalRonda = Math.max(Math.floor(totalRonda / 2), 2)
            }

            // Cada partido (llave) tiene su propio horario — se guarda por
            // posición dentro de la ronda, no uno solo para toda la ronda
            // (actualizarCalendarioLlave está definida a nivel de componente,
            // se reusa también en el árbol ya creado más abajo).

            return (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d93025' }}/>
                  <span style={{ fontWeight: '700', fontSize: '.85rem', color: '#202124' }}>Vista previa en vivo</span>
                  {previewOrden && (
                    <button onClick={() => setPreviewOrden(null)} style={{ fontSize: '.72rem', color: '#d93025', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                      ↺ Deshacer orden movido a mano
                    </button>
                  )}
                  {totalPreview >= 4 && (
                    <button onClick={() => setCrearTercerPuesto(v => !v)}
                      style={{ fontSize: '.72rem', fontWeight: '700', cursor: 'pointer', borderRadius: '20px', padding: '3px 10px', color: crearTercerPuesto ? '#1e8e3e' : '#9aa0a6', background: crearTercerPuesto ? '#e6f4ea' : '#f1f3f4', border: crearTercerPuesto ? '1px solid #a8dab5' : '1px solid #dadce0' }}>
                      🥉 {crearTercerPuesto ? 'Se juega el 3° y 4° puesto' : 'Abrir espacio para el 3° y 4° puesto'}
                    </button>
                  )}
                  <button onClick={abrirWizardElim} style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                    ⚙️ Ajustar cupos/formato
                  </button>
                </div>
                <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '10px' }}>
                  Así quedaría el árbol si la fase de grupos terminara ahora ({grupos.length > 0 ? `clasifican ${clasificanPorGrupo} por grupo` : `clasifican ${numClasifElim}`}) — se va actualizando solo con cada resultado que cargues. Arrastrá un equipo encima de otro para intercambiar sus puestos en el orden, y ponele fecha/hora a cada llave acá abajo. Cuando ya esté como querés que se juegue, tocá el botón de acá abajo para mandar esos partidos a jugar de verdad, con esas mismas fechas.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                  <button onClick={handleGenerarEliminatorias} disabled={generandoElim}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', background: generandoElim ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '10px', cursor: generandoElim ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                    <GitBranch size={15}/> {generandoElim ? 'Creando...' : 'Iniciar eliminatorias con esta programación'}
                  </button>
                </div>
                {byeInicialPreviewLive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', background: '#e6f4ea', border: '1px solid #a8dab5', borderRadius: '10px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={byeInicialPreviewLive.logo_url} name={byeInicialPreviewLive.name} size={20}/></div>
                    <span style={{ fontSize: '.76rem', fontWeight: '700', color: '#1e8e3e' }}>⏭️ {byeInicialPreviewLive.name} pasa directo a la siguiente ronda sin jugar (número impar de clasificados)</span>
                    <button onClick={abrirWizardElim} style={{ marginLeft: 'auto', fontSize: '.68rem', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>cambiar</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
                  {columnasPreview.map((col, ci) => (
                    <div key={ci} style={{ minWidth: '220px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                        {getRondaNombre(col.total).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                        {col.llaves.map((ll, i) => ll ? (
                          <div key={i} style={{ background: '#fffaf3', border: '1.5px dashed #e8710a', borderLeft: '4px dashed #e8710a', borderRadius: '10px', overflow: 'hidden' }}>
                            {[ll.a, ll.b].map((eq, ti) => (
                              <div key={ti} data-prevteam-id={eq?.id}
                                onMouseDown={e => eq && startDragPreview(e, eq)} onTouchStart={e => eq && startDragPreview(e, eq)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderBottom: ti === 0 ? '1px solid #f1e0c8' : 'none',
                                  background: sobrePreviewId === String(eq?.id) ? '#ffe0b2' : 'transparent',
                                  cursor: eq ? 'grab' : 'default', touchAction: 'none',
                                  opacity: dragPreview?.team.id === eq?.id ? .25 : 1,
                                }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={eq?.logo_url} name={eq?.name} size={20}/></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq?.name || '— por definir —'}</div>
                                  {eq?.grupo && <div style={{ fontSize: '.6rem', color: '#9aa0a6' }}>{eq.grupo}</div>}
                                </div>
                                {eq?.posicion && <span style={{ fontSize: '.62rem', color: eq.mejorPerdedor ? '#e8710a' : '#9aa0a6', fontWeight: '700', flexShrink: 0 }}>{eq.mejorPerdedor ? '🎟️' : `#${eq.posicion}`}</span>}
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: '4px', padding: '6px 8px', background: '#f8f9fa' }}>
                              <input type="date" value={previewCalendario?.[col.fase]?.[i]?.fecha || ''}
                                onChange={e => actualizarCalendarioLlave(col.fase, i, 'fecha', e.target.value)}
                                style={{ flex: 1, minWidth: 0, fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368' }}/>
                              <input type="time" value={previewCalendario?.[col.fase]?.[i]?.hora || ''}
                                onChange={e => actualizarCalendarioLlave(col.fase, i, 'hora', e.target.value)}
                                style={{ width: '62px', fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368' }}/>
                            </div>
                          </div>
                        ) : (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '10px', textAlign: 'center', color: '#9aa0a6', fontSize: '.72rem', fontWeight: '600', background: '#f1f3f4' }}>
                            Por definir
                            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                              <input type="date" value={previewCalendario?.[col.fase]?.[i]?.fecha || ''}
                                onChange={e => actualizarCalendarioLlave(col.fase, i, 'fecha', e.target.value)}
                                style={{ flex: 1, minWidth: 0, fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368', background: '#fff' }}/>
                              <input type="time" value={previewCalendario?.[col.fase]?.[i]?.hora || ''}
                                onChange={e => actualizarCalendarioLlave(col.fase, i, 'hora', e.target.value)}
                                style={{ width: '62px', fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368', background: '#fff' }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {crearTercerPuesto && totalPreview >= 4 && (
                    <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#cd7f32', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                        🥉 3° Y 4° PUESTO
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '100%', border: '2px dashed #d4a574', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#a5732f', fontSize: '.72rem', fontWeight: '700', background: '#fffaf3' }}>
                          Por definir
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ minWidth: '150px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', fontSize: '.68rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.2px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                      🏆 CAMPEÓN
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '100%', border: '2px dashed #ffd66b', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#e8b93a', fontSize: '.72rem', fontWeight: '700', background: '#fffaf0' }}>
                        Por definir
                      </div>
                    </div>
                  </div>
                </div>
                {dragPreview && (
                  <div style={{
                    position: 'fixed', left: dragPreview.x - 90, top: dragPreview.y - 20, width: '180px',
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                    background: '#fff', border: '2px solid #e8710a', borderRadius: '10px',
                    boxShadow: '0 6px 18px rgba(0,0,0,.25)', pointerEvents: 'none', zIndex: 3000,
                  }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                      <TeamLogo logo_url={dragPreview.team.logo_url} name={dragPreview.team.name} size={20}/>
                    </div>
                    <span style={{ fontSize: '.78rem', fontWeight: '700', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dragPreview.team.name}</span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Asistente de configuración */}
          {showWizardElim && (() => {
            const participantesBase = getParticipantesElim(numClasifElim)
            const esImparInicial = estiloLlaves !== 'manual' && participantesBase.length >= 3 && participantesBase.length % 2 !== 0
            const byeTeam = estiloLlaves !== 'manual' ? getParticipantesConImpar().byeTeam : null
            const participantes = estiloLlaves === 'manual' ? ordenManual : getParticipantesConImpar().participantes
            const mejores = participantes.filter(p => p.mejorPerdedor)
            const parejas = getParejasElim()
            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                onClick={e => e.target === e.currentTarget && setShowWizardElim(false)}>
                <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ fontWeight: '700', color: '#202124', fontSize: '.95rem' }}>⚡ ¿Cómo se juegan las eliminaciones directas?</div>
                    <button onClick={() => setShowWizardElim(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={20}/></button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

                    {/* 1. Cupos */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>1. ¿Cuántos equipos clasifican?</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                        {[2, 4, 8, 16].map(n => (
                          <button key={n} onClick={() => cambiarCuposElim(n)} disabled={n > equipos.length}
                            style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: n > equipos.length ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '.9rem', border: numClasifElim === n ? '2px solid #e8710a' : '1px solid #dadce0', background: numClasifElim === n ? '#fff4e5' : '#fff', color: n > equipos.length ? '#dadce0' : numClasifElim === n ? '#e8710a' : '#5f6368' }}>
                            {n}
                          </button>
                        ))}
                        <input type="number" min="2" max="16" step="1" value={numClasifElim}
                          onChange={e => { const v = parseInt(e.target.value); if (v >= 2 && v <= 16) cambiarCuposElim(v) }}
                          style={{ ...inputStyle, width: '76px', textAlign: 'center', fontWeight: '700', border: ![2,4,8,16].includes(numClasifElim) ? '2px solid #e8710a' : '1px solid #dadce0' }}/>
                      </div>
                      <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '6px' }}>
                        Puede ser cualquier número, par o impar (ej: 5, 6, 7, 10). Si en una ronda quedan impares, elegís abajo cómo se resuelve.
                      </div>
                      {mejores.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '.72rem', color: '#e8710a', background: '#fff4e5', border: '1px solid #ffd8a8', borderRadius: '8px', padding: '8px 12px' }}>
                          🎟️ Los cupos se completan con los mejores de la reclasificación (mejor perdedor): {mejores.map(m => m.name).join(', ')}
                        </div>
                      )}
                      {esImparInicial && (
                        <div style={{ marginTop: '10px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 12px' }}>
                          <div style={{ fontSize: '.74rem', fontWeight: '700', color: '#202124', marginBottom: '6px' }}>
                            Número impar de clasificados ({participantesBase.length}) — ¿qué hacemos con el que sobra?
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.76rem', color: '#5f6368', marginBottom: '6px', cursor: 'pointer' }}>
                            <input type="radio" checked={modoImpar === 'mejor_perdedor'} onChange={() => setModoImpar('mejor_perdedor')} style={{ cursor: 'pointer' }}/>
                            🎟️ Entra un mejor perdedor más y quedan {participantesBase.length + 1}
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.76rem', color: '#5f6368', cursor: 'pointer' }}>
                            <input type="radio" checked={modoImpar === 'bye'} onChange={() => setModoImpar('bye')} style={{ cursor: 'pointer' }}/>
                            ⏭️ Un equipo pasa directo a la siguiente ronda y juegan {participantesBase.length - 1}
                          </label>
                          {modoImpar === 'bye' && (
                            <div style={{ marginTop: '8px' }}>
                              <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginBottom: '4px' }}>¿Quién pasa directo?</div>
                              <select value={equipoByeId || byeTeam?.id || ''} onChange={e => setEquipoByeId(e.target.value)} style={{ ...inputStyle, fontSize: '.8rem' }}>
                                {participantesBase.map(eq => (
                                  <option key={eq.id} value={eq.id}>{eq.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Formato */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>2. Formato de cada llave</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIdaVuelta(false)}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '.8rem', fontWeight: '600', border: !idaVuelta ? '2px solid #1a73e8' : '1px solid #dadce0', background: !idaVuelta ? '#e8f0fe' : '#fff', color: !idaVuelta ? '#1a73e8' : '#5f6368' }}>
                          Partido único
                        </button>
                        <button onClick={() => setIdaVuelta(true)}
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '.8rem', fontWeight: '600', border: idaVuelta ? '2px solid #1a73e8' : '1px solid #dadce0', background: idaVuelta ? '#e8f0fe' : '#fff', color: idaVuelta ? '#1a73e8' : '#5f6368' }}>
                          Ida y vuelta
                        </button>
                      </div>
                    </div>

                    {/* 3. Cómo se arman las llaves */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>3. ¿Cómo se arman las llaves?</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[
                          { v: 'consecutivo', t: 'Por reclasificación: 1° vs 2°, 3° vs 4°...', s: 'Según la tabla de reclasificación' },
                          { v: 'cruzado',     t: 'Por reclasificación cruzada: 1° vs último, 2° vs penúltimo...', s: 'El mejor contra el peor' },
                          { v: 'manual',      t: 'Sorteo físico: yo acomodo el orden', s: 'Ordena los equipos según como quedó tu sorteo' },
                        ].map(op => (
                          <button key={op.v} onClick={() => { setEstiloLlaves(op.v); if (op.v === 'manual' && ordenManual.length === 0) setOrdenManual(getParticipantesElim(numClasifElim)) }}
                            style={{ textAlign: 'left', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', border: estiloLlaves === op.v ? '2px solid #e8710a' : '1px solid #dadce0', background: estiloLlaves === op.v ? '#fff4e5' : '#fff' }}>
                            <div style={{ fontSize: '.8rem', fontWeight: '600', color: estiloLlaves === op.v ? '#e8710a' : '#202124' }}>{op.t}</div>
                            <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '2px' }}>{op.s}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Participantes — en sorteo físico se arma arrastrando */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>
                        4. {estiloLlaves === 'manual' ? 'Armá las llaves arrastrando' : 'Participantes'}
                      </div>
                      {estiloLlaves === 'manual' ? (() => {
                        const sinAsignarManual = ordenManual.filter(t => !llavesManuales.some(([a, b]) => a.id === t.id || b.id === t.id))
                        return (
                          <>
                            <SorteoManualDrag
                              pendientes={sinAsignarManual}
                              llaves={llavesManuales}
                              onFormarLlave={handleFormarLlaveManual}
                              onDeshacerLlave={handleDeshacerLlaveManual}
                            />
                            {sinAsignarManual.length === 1 && (
                              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#e6f4ea', border: '1px solid #a8dab5', borderRadius: '10px' }}>
                                <span style={{ fontSize: '.72rem', fontWeight: '700', color: '#1e8e3e' }}>⏭️ {sinAsignarManual[0].name} queda solo — pasa directo a la siguiente ronda sin jugar</span>
                              </div>
                            )}
                          </>
                        )
                      })() : (
                        <div style={{ border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'hidden' }}>
                          {participantes.map((eq, i) => (
                            <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', borderBottom: i < participantes.length - 1 ? '1px solid #f1f3f4' : 'none', background: '#fff' }}>
                              <span style={{ fontSize: '.7rem', fontWeight: '700', color: '#fff', background: '#1a73e8', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                              <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={eq.logo_url} name={eq.name} size={20}/></div>
                              <span style={{ flex: 1, fontSize: '.8rem', fontWeight: '500', color: '#202124' }}>{eq.name}</span>
                              {eq.mejorPerdedor
                                ? <span style={{ fontSize: '.62rem', color: '#e8710a', background: '#fff4e5', borderRadius: '10px', padding: '1px 7px', fontWeight: '600' }}>Mejor perdedor</span>
                                : eq.grupo && <span style={{ fontSize: '.65rem', color: '#9aa0a6' }}>{eq.grupo}</span>}
                            </div>
                          ))}
                          {participantes.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem' }}>Sin equipos con partidos aún</div>}
                          {byeTeam && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', background: '#e6f4ea', borderTop: '1px solid #f1f3f4' }}>
                              <span style={{ fontSize: '.62rem', color: '#1e8e3e', background: '#fff', borderRadius: '10px', padding: '1px 7px', fontWeight: '700', flexShrink: 0 }}>⏭️ Pasa directo</span>
                              <div style={{ width: '20px', height: '20px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={byeTeam.logo_url} name={byeTeam.name} size={20}/></div>
                              <span style={{ flex: 1, fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>{byeTeam.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 5. Vista previa de llaves */}
                    {(parejas.length > 0 || byeTeam) && (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>5. Así quedan las llaves — {getRondaNombre(parejas.length * 2 + (byeTeam ? 1 : 0))}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                          {parejas.map(([a, b], i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '8px 12px' }}>
                              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', flexShrink: 0 }}>Llave {i + 1}</span>
                              <span style={{ flex: 1, fontSize: '.75rem', fontWeight: '600', color: '#202124', textAlign: 'right' }}>{a?.name}</span>
                              <span style={{ fontSize: '.68rem', fontWeight: '700', color: '#e8710a' }}>vs</span>
                              <span style={{ flex: 1, fontSize: '.75rem', fontWeight: '600', color: '#202124' }}>{b?.name}</span>
                            </div>
                          ))}
                          {byeTeam && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e6f4ea', border: '1px solid #a8dab5', borderRadius: '10px', padding: '8px 12px' }}>
                              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#1e8e3e', flexShrink: 0 }}>⏭️</span>
                              <span style={{ flex: 1, fontSize: '.75rem', fontWeight: '600', color: '#202124' }}>{byeTeam.name}</span>
                              <span style={{ fontSize: '.68rem', fontWeight: '700', color: '#1e8e3e' }}>pasa directo</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 6. Fecha */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div><label style={labelStyle}>Fecha primeros partidos *</label><input type="date" value={fechaElim} onChange={e => setFechaElim(e.target.value)} style={inputStyle}/></div>
                      <div><label style={labelStyle}>Hora inicio</label><input type="time" value={horaElim} onChange={e => setHoraElim(e.target.value)} style={inputStyle}/></div>
                    </div>

                    {bracket.length > 0 && (
                      <div style={{ fontSize: '.72rem', color: '#d93025', background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '8px 12px' }}>
                        ⚠️ Ya existe un bracket: al crear uno nuevo se borran los partidos de eliminatorias anteriores.
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '14px 22px', borderTop: '1px solid #e8eaed', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={() => setShowWizardElim(false)} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>Cancelar</button>
                    <button onClick={handleGenerarEliminatorias} disabled={generandoElim}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 22px', background: generandoElim ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '8px', cursor: generandoElim ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                      <GitBranch size={15}/> {generandoElim ? 'Creando...' : 'Crear árbol de eliminatorias'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Árbol de eliminatorias */}
          {bracket.length > 0 && (() => {
            const est = getEstadoEliminatorias()
            if (!est) return null
            const { porFase, fasesExist, actual: faseActualElim, llaves: llavesActual, completa: rondaCompleta, hayEmpates, repechajePendiente, vivos } = est
            const llaveFinal = porFase['final']?.find(l => !(l.matches[0].ronda || '').toLowerCase().includes('tercer'))
            const campeon = llaveFinal?.ganador || null
            const subcampeon = campeon ? (llaveFinal.ganador.id === llaveFinal.teamA.id ? llaveFinal.teamB : llaveFinal.teamA) : null
            const llaveTercer = porFase['final']?.find(l => (l.matches[0].ronda || '').toLowerCase().includes('tercer'))
            const tercerPuestoEq = llaveTercer?.ganador || null
            const esImpar = !repechajePendiente && vivos.length % 2 !== 0 && vivos.length > 3
            const proximaEsFinal = !repechajePendiente && vivos.length === 2

            // La Final ya existe (se creó sola por casilla) pero todavía no
            // hay partido de 3°/4° puesto — pasa cuando no se activó a
            // tiempo en la vista previa. Se puede crear igual acá, usando
            // los dos perdedores de la semifinal (la fase justo antes de la final).
            const idxFinalFase = fasesExist.indexOf('final')
            const faseSemi = idxFinalFase > 0 ? fasesExist[idxFinalFase - 1] : null
            const llavesSemi = faseSemi ? porFase[faseSemi] : null
            const semisListas = llavesSemi && llavesSemi.length === 2 && llavesSemi.every(l => l.terminada && l.ganador)
            const perdedoresSemis = semisListas ? llavesSemi.map(l => l.ganador.id === l.teamA.id ? l.teamB : l.teamA) : null
            const faltaTercerPuesto = !!(llaveFinal && !llaveTercer && perdedoresSemis)
            const nombreSiguiente = repechajePendiente
              ? 'repechaje'
              : vivos.length === 3
                ? 'Semifinal (1° vs 2°)'
                : getRondaNombre(esImpar && modoImpar === 'mejor_perdedor' ? vivos.length + 1 : vivos.length)

            // Columnas del árbol: fases jugadas + placeholders, siempre hasta la final.
            // La PRIMERA columna todavía sin jugar guarda también "feeder": las
            // llaves de la columna anterior, para poder mostrar el nombre del
            // equipo que YA se sabe (ganó su llave) aunque el partido real
            // todavía no exista porque falta el rival (que es la otra llave
            // de esa misma pareja).
            const columnas = []
            let n = porFase[fasesExist[0]].length
            let ultimaLlavesReales = null
            for (let idx = FASE_ORDEN.indexOf(fasesExist[0]); idx < FASE_ORDEN.length; idx++) {
              const f = FASE_ORDEN[idx]
              if (porFase[f]) {
                columnas.push({ fase: f, llaves: porFase[f] })
                n = porFase[f].length
                ultimaLlavesReales = porFase[f]
              } else {
                n = Math.max(Math.floor(n / 2), 1)
                columnas.push({ fase: f, llaves: Array.from({ length: n }, () => null), feeder: ultimaLlavesReales })
                ultimaLlavesReales = null // el feeder solo aplica a la primera columna futura
              }
            }

            return (
              <div>
                {/* Campeón */}
                {campeon && (
                  <div style={{ background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '14px', padding: '18px 24px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '2rem' }}>🏆</span>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={campeon.logo_url} name={campeon.name} size={44}/></div>
                      <div>
                        <div style={{ fontSize: '.68rem', fontWeight: '800', color: '#e8710a', letterSpacing: '2px' }}>CAMPEÓN DEL TORNEO</div>
                        <div style={{ fontWeight: '900', color: '#202124', fontSize: '1.2rem' }}>{campeon.name}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      {subcampeon && <span style={{ fontSize: '.8rem', color: '#5f6368', fontWeight: '600' }}>🥈 Subcampeón: {subcampeon.name}</span>}
                      {tercerPuestoEq && <span style={{ fontSize: '.8rem', color: '#5f6368', fontWeight: '600' }}>🥉 Tercer puesto: {tercerPuestoEq.name}</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '14px', gap: '10px', flexWrap: 'wrap' }}>
                      <button onClick={handleGuardarLogrosTorneo} disabled={guardandoLogros}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', background: guardandoLogros ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '10px', cursor: guardandoLogros ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                        💾 {guardandoLogros ? 'Guardando...' : 'Guardar logros en la hoja de vida de equipos y jugadores'}
                      </button>
                      {(esAdminRol || torneo.premium) && (
                        <button onClick={handleCrearSiguienteEdicion}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', background: '#6c35de', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                          🔄 Crear siguiente edición
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', textAlign: 'center', marginTop: '6px' }}>
                      Guarda campeón, subcampeón, tercer puesto y hasta qué fase llegó cada equipo — en el historial del equipo y de cada uno de sus jugadores
                    </div>
                  </div>
                )}

                {/* Generar siguiente ronda */}
                {rondaCompleta && faseActualElim !== 'final' && (
                  <div style={{ background: hayEmpates ? '#fce8e6' : '#fff8e1', border: `1px solid ${hayEmpates ? '#fad2cf' : '#ffe082'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontWeight: '700', color: '#202124', fontSize: '.875rem' }}>
                          {hayEmpates ? '⚠️ Hay llaves empatadas' : repechajePendiente ? '🔁 Toca jugar el repechaje' : `✅ ${FASE_LABEL[faseActualElim]} completada`}
                        </div>
                        <div style={{ fontSize: '.75rem', color: hayEmpates ? '#d93025' : '#9aa0a6', marginTop: '2px' }}>
                          {hayEmpates
                            ? 'Registra los penales en la planilla del partido empatado para definir el ganador'
                            : repechajePendiente
                              ? `${est.perdedores[0]?.name} tiene otra oportunidad: juega contra ${est.byesActuales[0]?.name} por el otro cupo a la final`
                              : vivos.length === 3
                                ? `Quedan 3 equipos: el 1° juega contra el 2° de la reclasificación y el perdedor tendrá repechaje contra ${rankPorReclasificacion(vivos)[2]?.name} — el 3° no tiene esa ventaja`
                                : 'Los ganadores avanzan a la siguiente ronda del árbol'}
                        </div>
                      </div>
                      {!hayEmpates && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input type="date" value={fechaRonda} onChange={e => setFechaRonda(e.target.value)} style={{ ...inputStyle, width: 'auto' }}/>
                          <input type="time" value={horaRonda} onChange={e => setHoraRonda(e.target.value)} style={{ ...inputStyle, width: 'auto' }}/>
                          <button onClick={handleGenerarSiguienteRonda} disabled={generandoRonda || !fechaRonda}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: !fechaRonda || generandoRonda ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '8px', cursor: !fechaRonda || generandoRonda ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '700' }}>
                            → {generandoRonda ? 'Generando...' : `Generar ${nombreSiguiente}`}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Cantidad impar: elegir cómo resolver */}
                    {!hayEmpates && esImpar && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#795548' }}>Quedan {vivos.length} equipos (impar). ¿Cómo se resuelve?</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.78rem', color: '#5f6368' }}>
                          <input type="radio" checked={modoImpar === 'mejor_perdedor'} onChange={() => setModoImpar('mejor_perdedor')} style={{ cursor: 'pointer' }}/>
                          🎟️ Entra el mejor perdedor de esta ronda ({rankPorReclasificacion(est.perdedoresElegibles)[0]?.name || '—'}) y quedan {vivos.length + 1}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.78rem', color: '#5f6368' }}>
                          <input type="radio" checked={modoImpar === 'bye'} onChange={() => setModoImpar('bye')} style={{ cursor: 'pointer' }}/>
                          ⬆️ El 1° de la reclasificación ({rankPorReclasificacion(vivos)[0]?.name || '—'}) pasa directo y los otros {vivos.length - 1} juegan
                        </label>
                      </div>
                    )}

                    {/* Tercer puesto junto con la final */}
                    {!hayEmpates && proximaEsFinal && est.perdedoresElegibles.length >= 2 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '.78rem', color: '#5f6368', marginTop: '10px' }}>
                        <input type="checkbox" checked={crearTercerPuesto} onChange={e => setCrearTercerPuesto(e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer' }}/>
                        🥉 Crear también el partido por el tercer puesto ({rankPorReclasificacion(est.perdedoresElegibles)[0]?.name} vs {rankPorReclasificacion(est.perdedoresElegibles)[1]?.name})
                      </label>
                    )}
                  </div>
                )}

                {/* La Final ya existe pero falta el partido de 3°/4° puesto —
                    pasa cuando no se activó a tiempo en la vista previa. Se
                    puede crear igual acá, aunque la Final ya se haya jugado. */}
                {faltaTercerPuesto && (
                  <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontWeight: '700', color: '#202124', fontSize: '.875rem' }}>🥉 Falta el partido por el 3° y 4° puesto</div>
                        <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>
                          {perdedoresSemis[0]?.name} vs {perdedoresSemis[1]?.name} — los dos perdedores de semifinal
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="date" value={fechaRonda} onChange={e => setFechaRonda(e.target.value)} style={{ ...inputStyle, width: 'auto' }}/>
                        <input type="time" value={horaRonda} onChange={e => setHoraRonda(e.target.value)} style={{ ...inputStyle, width: 'auto' }}/>
                        <button onClick={() => handleCrearTercerPuestoRetroactivo(perdedoresSemis[0], perdedoresSemis[1])} disabled={generandoRonda}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: generandoRonda ? '#dadce0' : '#e8710a', border: 'none', borderRadius: '8px', cursor: generandoRonda ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '700' }}>
                          🥉 {generandoRonda ? 'Creando...' : 'Crear partido de 3° y 4° puesto'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Árbol */}
                <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '12px' }}>🏆 Árbol de eliminatorias</div>
                <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', alignItems: 'stretch' }}>
                  {columnas.map(col => (
                    <div key={col.fase} style={{ minWidth: '235px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ textAlign: 'center', fontSize: '.7rem', fontWeight: '800', color: '#e8710a', letterSpacing: '1.5px', marginBottom: '10px', background: '#fff4e5', borderRadius: '8px', padding: '6px' }}>
                        {FASE_LABEL[col.fase].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: '10px' }}>
                        {col.llaves.map((ll, i) => ll ? (
                          <div key={i} onClick={() => {
                            const pend = ll.matches.find(m => m.status !== 'finished')
                            if (pend) abrirPlanilla(pend)
                            else if (ll.terminada && !ll.ganador) { setPenalesForm({ local: '', visitante: '' }); setPartidoPenales(ll.matches[ll.matches.length - 1]) }
                            else setModalPartidoAdmin(ll.matches[ll.matches.length - 1])
                          }}
                            style={{ background: '#fff', border: '1.5px solid #c4c9d0', borderLeft: '4px solid #e8710a', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer' }}>
                            {(ll.matches[0].ronda || '').toLowerCase().includes('repechaje') && (
                              <div style={{ padding: '3px 12px', background: '#f3e8fd', fontSize: '.62rem', fontWeight: '800', color: '#9955ff', letterSpacing: '1px' }}>🔁 REPECHAJE</div>
                            )}
                            {(ll.matches[0].ronda || '').toLowerCase().includes('tercer') && (
                              <div style={{ padding: '3px 12px', background: '#fff4e5', fontSize: '.62rem', fontWeight: '800', color: '#cd7f32', letterSpacing: '1px' }}>🥉 TERCER PUESTO</div>
                            )}
                            {[{ team: ll.teamA, goles: ll.golesA }, { team: ll.teamB, goles: ll.golesB }].map(({ team, goles }, ti) => {
                              const esGanador  = ll.ganador?.id === team.id
                              const esPerdedor = ll.terminada && ll.ganador && !esGanador
                              return (
                                <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: esGanador ? '#e6f4ea' : ti === 1 ? '#f8f9fa' : '#fff', opacity: esPerdedor ? .45 : 1, borderBottom: ti === 0 ? '2px solid #dadce0' : 'none' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={team.logo_url} name={team.name} size={24}/></div>
                                  <span style={{ flex: 1, fontWeight: esGanador ? '800' : '500', color: '#202124', fontSize: '.8rem', textDecoration: esPerdedor ? 'line-through' : 'none' }}>{team.name}</span>
                                  <span style={{ fontWeight: '900', fontSize: '1rem', color: esGanador ? '#1e8e3e' : '#9aa0a6' }}>
                                    {ll.matches.some(m => m.status === 'finished') ? goles : '—'}
                                  </span>
                                  {esGanador && <span style={{ fontSize: '.75rem' }}>✓</span>}
                                </div>
                              )
                            })}
                            <div style={{ padding: '5px 12px', background: '#f8f9fa', fontSize: '.65rem', color: ll.terminada && !ll.ganador ? '#d93025' : '#9aa0a6', fontWeight: ll.terminada && !ll.ganador ? '700' : '400' }}>
                              {!ll.terminada
                                ? `${ll.matches.length > 1 ? 'Ida y vuelta · ' : ''}${ll.matches[0].played_at ? new Date(ll.matches[0].played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + fmtHoraDate(ll.matches[0].played_at) : 'Por jugar'}${ll.matches[0].location ? ' · 📍 ' + ll.matches[0].location : ''} · toca para planilla`
                                : !ll.ganador
                                  ? '⚠️ Empate — toca aquí para registrar los penales'
                                  : `${ll.matches.length > 1 ? `Global ${ll.golesA}-${ll.golesB}` : 'Jugado'}${ll.porPenales ? ' · Penales' : ''}`}
                            </div>
                            {ll.matches.some(m => m.status !== 'finished') && (
                              <div style={{ padding: '5px 10px', background: '#f8f9fa', borderTop: '1px solid #f1f3f4', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {ll.matches.map((m, mi) => m.status !== 'finished' && (
                                  <button key={m.id}
                                    onClick={e => { e.stopPropagation(); const { fecha, hora } = playedAtToLocal(m.played_at); setFormEditPartido({ played_at: fecha, hora, location: m.location || '', matchday: m.matchday || '', fase: m.fase || 'grupo' }); setEditandoPartidoForm(m) }}
                                    style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer', color: '#5f6368', fontSize: '.65rem' }}>
                                    ✏️ {ll.matches.length > 1 ? (mi === 0 ? 'Ida' : 'Vuelta') : 'Fecha/cancha'}
                                  </button>
                                ))}
                                {!ll.matches.some(m => m.status === 'finished') && (
                                  <button onClick={e => { e.stopPropagation(); setEquipoSale(''); setEquipoEntra(''); setReemplazoLlave(ll) }}
                                    style={{ background: '#fff', border: '1px solid #ffd8a8', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer', color: '#e8710a', fontSize: '.65rem' }}>
                                    🔄 Cambiar equipo
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (() => {
                          // ¿Ya se sabe alguno de los dos equipos de esta casilla? (ganó su
                          // llave en la ronda anterior, aunque el rival todavía no se sepa)
                          const feederA = col.feeder?.[i * 2], feederB = col.feeder?.[i * 2 + 1]
                          const conocidoA = feederA?.terminada && feederA?.ganador ? feederA.ganador : null
                          const conocidoB = feederB?.terminada && feederB?.ganador ? feederB.ganador : null
                          const hayConocido = conocidoA || conocidoB
                          return (
                            <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#9aa0a6', fontSize: '.72rem', fontWeight: '600', background: '#f1f3f4' }}>
                              {hayConocido ? (
                                <div style={{ marginBottom: '6px' }}>
                                  {[conocidoA, conocidoB].map((t, ti) => (
                                    <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 2px', justifyContent: 'center' }}>
                                      {t ? (
                                        <>
                                          <div style={{ width: '18px', height: '18px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={t.logo_url} name={t.name} size={18}/></div>
                                          <span style={{ fontSize: '.74rem', fontWeight: '800', color: '#1e8e3e' }}>{t.name} ✓</span>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: '.68rem', color: '#9aa0a6', fontStyle: 'italic' }}>rival por definir</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : 'Por definir'}
                              <div style={{ fontSize: '.62rem', fontWeight: '500', color: '#9aa0a6', marginTop: '4px', marginBottom: '4px' }}>
                                Podés ponerle fecha/hora desde ya
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                <input type="date" value={previewCalendario?.[col.fase]?.[i]?.fecha || ''}
                                  onChange={e => actualizarCalendarioLlave(col.fase, i, 'fecha', e.target.value)}
                                  style={{ flex: 1, minWidth: 0, fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368', background: '#fff' }}/>
                                <input type="time" value={previewCalendario?.[col.fase]?.[i]?.hora || ''}
                                  onChange={e => actualizarCalendarioLlave(col.fase, i, 'hora', e.target.value)}
                                  style={{ width: '62px', fontSize: '.62rem', padding: '3px 2px', border: '1px solid #dadce0', borderRadius: '5px', color: '#5f6368', background: '#fff' }}/>
                              </div>
                            </div>
                          )
                        })())}
                      </div>
                    </div>
                  ))}

                  {/* Columna campeón */}
                  <div style={{ minWidth: '170px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', fontSize: '.7rem', fontWeight: '800', color: '#f9a825', letterSpacing: '1.5px', marginBottom: '10px', background: '#fff8e1', borderRadius: '8px', padding: '6px' }}>
                      🏆 CAMPEÓN
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      {campeon ? (
                        <div style={{ width: '100%', background: 'linear-gradient(135deg, #fff8e1, #ffecb3)', border: '2px solid #f9a825', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', margin: '0 auto 8px' }}><TeamLogo logo_url={campeon.logo_url} name={campeon.name} size={40}/></div>
                          <div style={{ fontWeight: '900', color: '#202124', fontSize: '.85rem' }}>{campeon.name}</div>
                        </div>
                      ) : (
                        <div style={{ width: '100%', border: '1px dashed #f9a825', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#f9a825', fontSize: '.72rem', background: '#fffdf5' }}>
                          Por definir
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── TAB FINANZAS ── */}
      {tab === 'finanzas' && finanzasActivas && (() => {
        const fin = calcFinanzas()
        const pagosRegistrados = movimientos.filter(m => m.tipo === 'pago_tarjetas' || m.tipo === 'pago_cargos' || m.tipo === 'cargo_manual')
        return (
          <div>
            {/* Configurar precios — editables en cualquier momento */}
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>⚙️ Precios del torneo</div>
                  <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>Tarjetas, inscripción, arbitrajes, multas y gastos — al cambiarlos, todas las cuentas se recalculan solas</div>
                </div>
                <button onClick={() => showConfigFin ? setShowConfigFin(false) : abrirConfigFin()}
                  style={{ padding: '8px 16px', background: showConfigFin ? '#f1f3f4' : '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: showConfigFin ? '#5f6368' : '#fff', fontSize: '.8rem', fontWeight: '700' }}>
                  {showConfigFin ? 'Cerrar' : '✏️ Modificar precios'}
                </button>
              </div>
              {showConfigFin && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                    {[
                      { k: 'precio_amarilla',      l: '🟨 Tarjeta amarilla' },
                      { k: 'precio_azul',          l: '🟦 Tarjeta azul' },
                      { k: 'precio_roja',          l: '🟥 Tarjeta roja' },
                      { k: 'inscripcion',          l: '📝 Inscripción por equipo' },
                      { k: 'arbitraje_equipo',     l: '🧑‍⚖️ Arbitraje por equipo/partido' },
                      { k: 'valor_w_presenta',     l: '🏆 Cobro al que gana por W' },
                      { k: 'multa_no_presenta',    l: '⛔ Multa al que no se presenta' },
                      { k: 'pago_cancha_partido',  l: '🏟️ Gasto cancha por partido' },
                      { k: 'pago_cancha_w',        l: '🏟️ Gasto cancha por W' },
                      { k: 'pago_arbitro_partido', l: '💸 Pago árbitro por partido' },
                      { k: 'pago_arbitro_w',       l: '💸 Pago árbitro por W' },
                    ].map(c => (
                      <div key={c.k}>
                        <label style={{ display: 'block', fontSize: '.7rem', fontWeight: '600', color: '#5f6368', marginBottom: '4px' }}>{c.l}</label>
                        <input type="number" min="0" value={formFin[c.k] ?? 0}
                          onChange={e => setFormFin(f => ({ ...f, [c.k]: e.target.value }))}
                          onFocus={e => e.target.select()}
                          style={{ width: '100%', border: '1.5px solid #dadce0', borderRadius: '8px', padding: '9px 10px', fontSize: '.9rem', fontWeight: '700', color: '#202124', outline: 'none', boxSizing: 'border-box' }}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={handleGuardarConfigFin} disabled={guardandoFin}
                      style={{ padding: '10px 22px', background: guardandoFin ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoFin ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                      {guardandoFin ? 'Guardando...' : '✓ Guardar precios'}
                    </button>
                    <button onClick={() => setShowConfigFin(false)}
                      style={{ padding: '10px 18px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>
                      Cancelar
                    </button>
                  </div>
                  <div style={{ fontSize: '.68rem', color: '#e8710a', marginTop: '10px' }}>
                    ⚠️ Los precios aplican a TODO el torneo (también a las tarjetas y partidos ya jugados) — los pagos ya registrados no se tocan.
                  </div>
                </div>
              )}
            </div>

            {/* Resumen */}
            {fin.fc.llevar_cuentas && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '💵 Ingresos esperados', value: fmt(fin.ingresosEsperados), color: '#1a73e8' },
                  { label: '✅ Recaudado',          value: fmt(fin.recaudado),          color: '#1e8e3e' },
                  { label: '📤 Gastos',             value: fmt(fin.gastos),             color: '#d93025' },
                  { label: '📈 Ganancia esperada',  value: fmt(fin.gananciaEsperada),   color: '#6c35de' },
                  { label: '💰 Ganancia actual',    value: fmt(fin.gananciaActual),     color: fin.gananciaActual >= 0 ? '#1e8e3e' : '#d93025' },
                ].map(c => (
                  <div key={c.label} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', fontWeight: '600', marginBottom: '4px' }}>{c.label}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: '800', color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Gastos detalle */}
            {fin.fc.llevar_cuentas && (
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '.78rem', color: '#5f6368' }}>
                <span>🏟️ Canchas: <b style={{ color: '#202124' }}>{fmt(fin.gastoCanchas)}</b> ({fin.jugados} jugados · {fin.ws} W)</span>
                <span>🧑‍⚖️ Árbitros: <b style={{ color: '#202124' }}>{fmt(fin.gastoArbitros)}</b></span>
                <span>Los cobros a equipos y gastos se calculan automáticamente con cada partido jugado o W. El arbitraje se da por pagado solo (se cobra en efectivo en la cancha) — lo único que se registra a mano es inscripción, multas/W y tarjetas.</span>
              </div>
            )}

            {/* Cuentas por equipo */}
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '10px' }}>💳 Cuentas por equipo</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: '20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
             <div style={{ minWidth: '760px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 90px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.68rem', fontWeight: '700', color: '#5f6368', gap: '4px' }}>
                <div>EQUIPO</div>
                <div style={{ textAlign: 'right' }}>INSCRIP.</div>
                <div style={{ textAlign: 'right' }}>ARBITRAJES</div>
                <div style={{ textAlign: 'right' }}>W/MULTAS</div>
                <div style={{ textAlign: 'right' }}>TARJETAS</div>
                <div style={{ textAlign: 'right' }}>PAGADO</div>
                <div style={{ textAlign: 'right' }}>SALDO</div>
                <div/>
              </div>
              {fin.filas.map((r, i) => (
                <div key={r.equipo.id} style={{ borderBottom: i < fin.filas.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 90px', padding: '10px 16px', alignItems: 'center', gap: '4px', cursor: r.tarjetasDetalle.length > 0 ? 'pointer' : 'default' }}
                    onClick={() => r.tarjetasDetalle.length > 0 && setEquipoFinAbierto(equipoFinAbierto === r.equipo.id ? null : r.equipo.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '5px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={r.equipo.logo_url} name={r.equipo.name} size={24}/></div>
                      <span style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.equipo.name}</span>
                      {r.tarjetasDetalle.length > 0 && <ChevronDown size={13} color="#9aa0a6" style={{ transform: equipoFinAbierto === r.equipo.id ? 'rotate(180deg)' : 'none', flexShrink: 0 }}/>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '.78rem', color: '#5f6368' }}>{fin.fc.llevar_cuentas ? fmt(r.inscripcion) : '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: '.78rem', color: '#5f6368' }} title="Se paga en efectivo en la cancha — se da por pagado automáticamente al jugarse el partido">{fin.fc.llevar_cuentas ? (r.arbitrajes > 0 ? <>{fmt(r.arbitrajes)} <span style={{ color: '#1e8e3e' }}>✓</span></> : fmt(r.arbitrajes)) : '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: '.78rem', color: (r.multas + r.deudas) > 0 ? '#d93025' : '#5f6368' }} title={r.deudas > 0 ? `Incluye ${fmt(r.deudas)} en deudas anotadas a mano` : ''}>{fin.fc.llevar_cuentas ? fmt(r.w + r.multas + r.deudas) : '—'}</div>
                    <div style={{ textAlign: 'right', fontSize: '.78rem', fontWeight: '700', color: r.saldoTarjetas > 0 ? '#d93025' : '#1e8e3e' }}>{fmt(r.tarjetas)}</div>
                    <div style={{ textAlign: 'right', fontSize: '.78rem', color: '#1e8e3e' }}>{fmt(r.pagado)}</div>
                    <div style={{ textAlign: 'right', fontSize: '.82rem', fontWeight: '800', color: r.saldo > 0 ? '#d93025' : '#1e8e3e' }}>{fmt(r.saldo)}</div>
                    <div style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button onClick={e => { e.stopPropagation(); setPagoForm({ tipo: 'pago_tarjetas', monto: '', concepto: '' }); setTarjetasAPagar([]); setPagoModal({ ...r.equipo, tarjetasDetalle: r.tarjetasDetalle }) }}
                        style={{ background: '#1a73e8', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', fontWeight: '600' }}>
                        💵 Pago
                      </button>
                      <button onClick={e => { e.stopPropagation(); setPagoForm({ tipo: 'cargo_manual', monto: '', concepto: '' }); setTarjetasAPagar([]); setPagoModal({ ...r.equipo, tarjetasDetalle: r.tarjetasDetalle }) }}
                        title="Anotar una deuda del equipo (ej: quedó debiendo arbitraje)"
                        style={{ background: '#fff', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', fontSize: '.7rem', fontWeight: '700' }}>
                        ➖ Deuda
                      </button>
                    </div>
                  </div>
                  {equipoFinAbierto === r.equipo.id && r.tarjetasDetalle.length > 0 && (
                    <div style={{ padding: '8px 16px 12px 48px', background: '#fafafa' }}>
                      <div style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', marginBottom: '6px' }}>TARJETAS POR JUGADOR</div>
                      {r.tarjetasDetalle.map(j => {
                        const pend = (j.player_id && pendientesTarjetas[j.player_id]) || { am: 0, az: 0, rj: 0 }
                        return (
                        <div key={j.player_id || j.nombre} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '.75rem', color: '#5f6368', padding: '3px 0', flexWrap: 'wrap' }}>
                          <span style={{ flex: 1, color: '#202124', minWidth: '90px' }}>{j.nombre}</span>
                          {j.am > 0 && <span>🟨 ×{j.am}</span>}
                          {j.az > 0 && <span>🟦 ×{j.az}</span>}
                          {j.rj > 0 && <span>🟥 ×{j.rj}</span>}
                          <span style={{ fontWeight: '700', color: '#d93025' }}>{fmt(j.valor)}</span>
                          {j.player_id && (pend.am > 0 || pend.az > 0 || pend.rj > 0) && (
                            <button onClick={() => abrirPagoJugador(r.equipo, j)} title="Registrar el pago de este jugador con el monto ya calculado"
                              style={{ background: '#1a73e8', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: '#fff', fontSize: '.68rem', fontWeight: '700' }}>
                              💵 Cobrar {fmt(j.valor)}
                            </button>
                          )}
                          {j.player_id && pend.am > 0 && (
                            <button onClick={() => handlePagarTarjetaJugador(j.player_id, 'am', j.nombre)} title="Marcar tarjetas amarillas como pagadas (quita la advertencia en la planilla)"
                              style={{ background: '#fff8e1', border: '1px solid #f9d874', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', color: '#8a6d00', fontSize: '.68rem', fontWeight: '700' }}>
                              ✓ Pagar 🟨
                            </button>
                          )}
                          {j.player_id && pend.az > 0 && (
                            <button onClick={() => handlePagarTarjetaJugador(j.player_id, 'az', j.nombre)} title="Marcar tarjetas azules como pagadas (quita la advertencia en la planilla)"
                              style={{ background: '#e8f0fe', border: '1px solid #aac4f7', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', color: '#1a4fa0', fontSize: '.68rem', fontWeight: '700' }}>
                              ✓ Pagar 🟦
                            </button>
                          )}
                          {j.player_id && pend.rj > 0 && (
                            <button onClick={() => handlePagarTarjetaJugador(j.player_id, 'rj', j.nombre)} title="Marcar tarjetas rojas como pagadas (quita la advertencia en la planilla)"
                              style={{ background: '#fce8e6', border: '1px solid #f3aca4', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', color: '#a30000', fontSize: '.68rem', fontWeight: '700' }}>
                              ✓ Pagar 🟥
                            </button>
                          )}
                          {j.player_id && pend.am === 0 && pend.az === 0 && pend.rj === 0 && (j.am + j.az + j.rj) > 0 && (
                            <span style={{ color: '#1e8e3e', fontSize: '.68rem', fontWeight: '700' }}>✓ Al día</span>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
              {fin.filas.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Sin equipos en el torneo</div>}
             </div>
            </div>

            {/* Deudas personales — inscripción sin pagar (x2), repartida entre
                jugadores. Es lo único que se genera al guardar los logros del
                torneo (los botones "Guardar logros" de Eliminatorias) y lo
                único que sigue al jugador a próximos torneos del MISMO
                organizador — las tarjetas sin pagar ya no bloquean nada. */}
            {(() => {
              const deudasPersonales = movimientos.filter(m => m.tipo === 'deuda_personal' && !m.pagado)
              if (deudasPersonales.length === 0) return null
              return (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '10px' }}>🚫 Deudas personales pendientes ({deudasPersonales.length})</div>
                  <div style={{ background: '#fff', border: '1px solid #fad2cf', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ padding: '10px 16px', background: '#fce8e6', fontSize: '.72rem', color: '#a30000' }}>
                      Bloquean la inscripción del jugador en próximos torneos de este mismo organizador, hasta que se marquen pagadas.
                    </div>
                    {deudasPersonales.map((mv, i) => (
                      <div key={mv.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: i < deudasPersonales.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                        <span style={{ flex: 1, fontSize: '.8rem', color: '#202124', fontWeight: '600' }}>{mv.players?.name || 'Jugador'} <span style={{ fontWeight: '400', color: '#5f6368' }}>· {mv.teams?.name || ''}</span></span>
                        <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{mv.concepto}</span>
                        <span style={{ fontSize: '.85rem', fontWeight: '800', color: '#d93025' }}>{fmt(mv.monto)}</span>
                        <button onClick={() => handleMarcarDeudaPersonalPagada(mv)}
                          style={{ background: '#1e8e3e', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', fontWeight: '700' }}>
                          ✓ Marcar pagada
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Movimientos registrados (pagos y deudas) */}
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '10px' }}>🧾 Movimientos registrados</div>
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                         {pagosRegistrados.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: '#9aa0a6', fontSize: '.8rem' }}>Aún no hay movimientos — usa los botones 💵 Pago o ➖ Deuda de cada equipo</div>
              ) : pagosRegistrados.map((mv, i) => (
                <div key={mv.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: i < pagosRegistrados.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                  <span style={{ fontSize: '.75rem', color: '#9aa0a6', flexShrink: 0 }}>{new Date(mv.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                  <span style={{ flex: 1, fontSize: '.8rem', color: '#202124', fontWeight: '500' }}>{mv.teams?.name || '—'} · {mv.concepto || (mv.tipo === 'cargo_manual' ? 'Deuda anotada' : mv.tipo === 'pago_tarjetas' ? 'Pago de tarjetas' : 'Pago de cargos')}</span>
                  <span style={{ fontSize: '.68rem', color: mv.tipo === 'cargo_manual' ? '#d93025' : mv.tipo === 'pago_tarjetas' ? '#e8710a' : '#1a73e8', background: mv.tipo === 'cargo_manual' ? '#fce8e6' : mv.tipo === 'pago_tarjetas' ? '#fff4e5' : '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>{mv.tipo === 'cargo_manual' ? 'Deuda' : mv.tipo === 'pago_tarjetas' ? 'Tarjetas' : 'Cargos'}</span>
                  <span style={{ fontSize: '.85rem', fontWeight: '800', color: mv.tipo === 'cargo_manual' ? '#d93025' : '#1e8e3e' }}>{mv.tipo === 'cargo_manual' ? '−' : ''}{fmt(mv.monto)}</span>
                  <button onClick={() => handleEliminarPago(mv)} style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '3px 6px', cursor: 'pointer', color: '#d93025', display: 'flex' }}><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── TAB PERSONALIZACIÓN ── */}
      {tab === 'personalizacion' && (
        <div>
          {/* Marca */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', marginBottom: '4px' }}>🎨 Marca</div>
                <div style={{ fontSize: '.72rem', color: '#9aa0a6' }}>Colores, dominio, logo y favicon de este torneo</div>
              </div>
              <a
                href={`/t/${id}`}
                target="_blank"
                rel="noreferrer"
                title="Abre /t/{id} en otra pestaña: la página tal cual la ve el público, con colores, logo y sponsors ya aplicados (aunque el dominio personalizado aún no esté vinculado)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0, padding: '8px 12px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', color: '#1a73e8', fontSize: '.78rem', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                <ExternalLink size={14}/> Ver página pública
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Dominio personalizado</label>
                <input
                  value={formMarca.custom_domain}
                  onChange={e => setFormMarca(f => ({ ...f, custom_domain: e.target.value }))}
                  style={inputStyle}
                  placeholder="miclub.com"
                />
                <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '4px' }}>
                  Ej: miclub.com — después hay que configurar el DNS aparte
                </div>
              </div>

              <div>
                <label style={labelStyle}>Color primario</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={hexValido(formMarca.color_primario, '#1a73e8')}
                    onChange={e => setFormMarca(f => ({ ...f, color_primario: e.target.value }))}
                    style={{ width: '44px', height: '38px', border: '1px solid #dadce0', borderRadius: '8px', padding: '2px', background: '#fff', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    value={formMarca.color_primario}
                    onChange={e => setFormMarca(f => ({ ...f, color_primario: e.target.value }))}
                    onBlur={e => setFormMarca(f => ({ ...f, color_primario: hexValido(e.target.value, f.color_primario || '#1a73e8') }))}
                    style={inputStyle}
                    placeholder="#1a73e8"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Color secundario</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={hexValido(formMarca.color_secundario, '#202124')}
                    onChange={e => setFormMarca(f => ({ ...f, color_secundario: e.target.value }))}
                    style={{ width: '44px', height: '38px', border: '1px solid #dadce0', borderRadius: '8px', padding: '2px', background: '#fff', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <input
                    value={formMarca.color_secundario}
                    onChange={e => setFormMarca(f => ({ ...f, color_secundario: e.target.value }))}
                    onBlur={e => setFormMarca(f => ({ ...f, color_secundario: hexValido(e.target.value, f.color_secundario || '#202124') }))}
                    style={inputStyle}
                    placeholder="#202124"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              {/* Logo — mismo campo que el botón cámara del encabezado */}
              <div>
                <label style={labelStyle}>Logo del torneo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#e8f0fe', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {formMarca.logo_url || torneo.logo_url
                      ? <img src={formMarca.logo_url || torneo.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                      : <Trophy size={22} color="#1a73e8"/>}
                  </div>
                  <div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                      <Upload size={12}/> {uploadingLogoMarca ? 'Subiendo...' : 'Subir logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingLogoMarca}
                        onChange={e => { handleUploadLogoMarca(e.target.files[0]); e.target.value = '' }}/>
                    </label>
                    <div style={{ fontSize: '.65rem', color: '#9aa0a6', marginTop: '4px' }}>También desde el encabezado ↑</div>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div>
                <label style={labelStyle}>Favicon</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: '#f8f9fa', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {formMarca.favicon_url
                      ? <img src={formMarca.favicon_url} alt="favicon" style={{ width: '32px', height: '32px', objectFit: 'contain' }}/>
                      : <ImageIcon size={20} color="#9aa0a6"/>}
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
                    <Upload size={12}/> {uploadingFavicon ? 'Subiendo...' : 'Subir favicon'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingFavicon}
                      onChange={e => { handleUploadFavicon(e.target.files[0]); e.target.value = '' }}/>
                  </label>
                </div>
              </div>
            </div>

            <button onClick={handleGuardarMarca} disabled={guardandoMarca}
              style={{ padding: '10px 22px', background: guardandoMarca ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoMarca ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
              {guardandoMarca ? 'Guardando...' : '✓ Guardar marca'}
            </button>
          </div>

          {/* Patrocinadores del torneo */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>🤝 Patrocinadores del torneo</div>
                <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>Aparecen en la página pública — distinto de los sponsors de tarjetas de jugador</div>
              </div>
              <button onClick={handleAgregarSponsor}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                <Plus size={14}/> Agregar patrocinador
              </button>
            </div>

            {loadingSponsors ? (
              <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '32px', fontSize: '.875rem' }}>Cargando...</div>
            ) : torneoSponsors.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '28px', fontSize: '.8rem', background: '#f8f9fa', borderRadius: '10px' }}>
                Todavía no hay patrocinadores — agregá el primero
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {torneoSponsors.map(sponsor => (
                  <div key={sponsor.id} style={{ border: '1px solid #e8eaed', borderRadius: '10px', padding: '14px', background: '#fafafa' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'start' }}>
                      <div>
                        <div style={{ width: '100px', height: '60px', background: '#fff', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px' }}>
                          {sponsor.logo_url
                            ? <img src={sponsor.logo_url} alt={sponsor.nombre || 'sponsor'} style={{ maxWidth: '90px', maxHeight: '52px', objectFit: 'contain' }}/>
                            : <span style={{ fontSize: '.7rem', color: '#9aa0a6' }}>Sin logo</span>}
                        </div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                          <Upload size={11}/> {uploadingSponsorId === sponsor.id ? 'Subiendo...' : 'Logo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingSponsorId === sponsor.id}
                            onChange={e => { handleSponsorLogo(sponsor, e.target.files[0]); e.target.value = '' }}/>
                        </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
                        <div>
                          <label style={labelStyle}>Nombre</label>
                          <input
                            value={sponsor.nombre || ''}
                            onChange={e => updateSponsorLocal(sponsor.id, 'nombre', e.target.value)}
                            onBlur={e => saveSponsorField(sponsor, 'nombre', e.target.value)}
                            style={inputStyle}
                            placeholder="Nombre del patrocinador"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Link</label>
                          <input
                            value={sponsor.link || ''}
                            onChange={e => updateSponsorLocal(sponsor.id, 'link', e.target.value)}
                            onBlur={e => saveSponsorField(sponsor, 'link', e.target.value || null)}
                            style={inputStyle}
                            placeholder="https://..."
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ width: '90px' }}>
                            <label style={labelStyle}>Orden</label>
                            <input
                              type="number"
                              value={sponsor.orden ?? 0}
                              onChange={e => updateSponsorLocal(sponsor.id, 'orden', parseInt(e.target.value, 10) || 0)}
                              onBlur={e => saveSponsorField(sponsor, 'orden', parseInt(e.target.value, 10) || 0)}
                              style={inputStyle}
                            />
                          </div>
                          <button onClick={() => handleEliminarSponsor(sponsor)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: '#fff', border: '1px solid #fad2cf', borderRadius: '8px', cursor: 'pointer', color: '#d93025', fontSize: '.75rem', marginBottom: '1px' }}>
                            <X size={13}/> Eliminar
                          </button>
                          {savingSponsorId === sponsor.id && (
                            <span style={{ fontSize: '.72rem', color: '#9aa0a6', paddingBottom: '10px' }}>Guardando...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {pagoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setPagoModal(null)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', color: pagoForm.tipo === 'cargo_manual' ? '#d93025' : '#202124', fontSize: '.9rem' }}>
                {pagoForm.tipo === 'cargo_manual' ? `➖ Anotar deuda — ${pagoModal.name}` : `💵 Registrar pago — ${pagoModal.name}`}
              </div>
              <button onClick={() => setPagoModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6', display: 'flex' }}><X size={19}/></button>
            </div>
            <div style={{ padding: '18px 20px' }}>
              {pagoForm.tipo === 'cargo_manual' ? (
                <div style={{ marginBottom: '12px', background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '10px 14px', fontSize: '.75rem', color: '#c5221f', lineHeight: 1.5 }}>
                  Se sumará como <b>cargo pendiente</b> al equipo (sube su saldo en rojo). Ej.: quedó debiendo $10.000 del arbitraje, daño en la cancha, etc.
                </div>
              ) : (
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>¿Qué paga?</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setPagoForm(f => ({ ...f, tipo: 'pago_tarjetas' }))}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '.78rem', fontWeight: '600', border: pagoForm.tipo === 'pago_tarjetas' ? '2px solid #e8710a' : '1px solid #dadce0', background: pagoForm.tipo === 'pago_tarjetas' ? '#fff4e5' : '#fff', color: pagoForm.tipo === 'pago_tarjetas' ? '#e8710a' : '#5f6368' }}>
                    💳 Tarjetas
                  </button>
                  <button onClick={() => setPagoForm(f => ({ ...f, tipo: 'pago_cargos' }))}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', cursor: 'pointer', fontSize: '.78rem', fontWeight: '600', border: pagoForm.tipo === 'pago_cargos' ? '2px solid #1a73e8' : '1px solid #dadce0', background: pagoForm.tipo === 'pago_cargos' ? '#e8f0fe' : '#fff', color: pagoForm.tipo === 'pago_cargos' ? '#1a73e8' : '#5f6368' }}>
                    🧾 Otros cargos
                  </button>
                </div>
              </div>
              )}
              {pagoForm.tipo === 'pago_tarjetas' && (() => {
                // Lista de tarjetas sin pagar de este equipo (de pendientesTarjetas,
                // que sí refleja yellow_paid/blue_paid/red_paid en vivo) — marcar
                // una acá es lo que de verdad la desbloquea en la planilla; el
                // pago en sí solo mueve el saldo del equipo.
                const pendientesDelEquipo = (pagoModal.tarjetasDetalle || []).flatMap(j => {
                  const pend = (j.player_id && pendientesTarjetas[j.player_id]) || { am: 0, az: 0, rj: 0 }
                  const items = []
                  if (pend.am > 0) items.push({ player_id: j.player_id, color: 'am', nombre: j.nombre, emoji: '🟨' })
                  if (pend.az > 0) items.push({ player_id: j.player_id, color: 'az', nombre: j.nombre, emoji: '🟦' })
                  if (pend.rj > 0) items.push({ player_id: j.player_id, color: 'rj', nombre: j.nombre, emoji: '🟥' })
                  return items
                })
                if (pendientesDelEquipo.length === 0) return null
                return (
                  <div style={{ marginBottom: '12px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: '700', color: '#5f6368', marginBottom: '8px' }}>¿Qué tarjetas cubre este pago? (las que marques quedan desbloqueadas en la planilla)</div>
                    {pendientesDelEquipo.map(t => {
                      const marcada = tarjetasAPagar.some(x => x.player_id === t.player_id && x.color === t.color)
                      return (
                        <label key={t.player_id + t.color} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '.78rem', color: '#202124' }}>
                          <input type="checkbox" checked={marcada} onChange={() => toggleTarjetaAPagar(t.player_id, t.color, t.nombre)}/>
                          {t.emoji} {t.nombre}
                        </label>
                      )
                    })}
                  </div>
                )
              })()}
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Monto ($) *</label>
                <input type="number" min="0" value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))} style={{ ...inputStyle, fontWeight: '700', fontSize: '1rem' }} placeholder="0" autoFocus/>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Concepto (opcional)</label>
                <input value={pagoForm.concepto} onChange={e => setPagoForm(f => ({ ...f, concepto: e.target.value }))} style={inputStyle} placeholder={pagoForm.tipo === 'cargo_manual' ? 'Ej: quedó debiendo arbitraje jornada 3' : 'Ej: pago tarjetas jornada 3'}/>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setPagoModal(null)} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem' }}>Cancelar</button>
                <button onClick={handleRegistrarPago} disabled={guardandoPago}
                  style={{ flex: 1, padding: '10px', background: guardandoPago ? '#dadce0' : pagoForm.tipo === 'cargo_manual' ? '#d93025' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoPago ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
                  {guardandoPago ? 'Guardando...' : pagoForm.tipo === 'cargo_manual' ? '➖ Anotar deuda' : 'Registrar pago'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
