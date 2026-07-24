import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PlanillaPartido from '../../components/PlanillaPartido'
import RankingPoster from '../../components/RankingPoster'
import TablaPosiciones from '../../components/TablaPosiciones'
import VallaEquipos from '../../components/VallaEquipos'
import FlyerTorneo from '../../components/FlyerTorneo'
import { buscarEquiposParecidos } from '../../lib/equiposParecidos'
import { recuperarPlanillaAbierta } from '../../lib/planillaRecovery'
import { ArrowLeft, Trophy, Calendar, BarChart2, Shield, Clock, MapPin, Check, X, Plus, Shuffle, GripVertical, Camera, Users, GitBranch, ChevronDown, ChevronUp, DollarSign, Pencil, Image as ImageIcon } from 'lucide-react'
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
  { id: 'actividad',      label: 'Actividad',      icon: <Trophy size={16}/> },
  { id: 'grupos',         label: 'Grupos',          icon: <Users size={16}/> },
  { id: 'calendario',     label: 'Calendario',      icon: <Calendar size={16}/> },
  { id: 'equipos',        label: 'Equipos',         icon: <Shield size={16}/> },
  { id: 'estadisticas',   label: 'Estadísticas',    icon: <BarChart2 size={16}/> },
  { id: 'eliminatorias',  label: 'Eliminatorias',   icon: <GitBranch size={16}/> },
  { id: 'finanzas',       label: 'Finanzas',        icon: <DollarSign size={16}/> },
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

const FASE_ORDEN = ['octavos', 'cuartos', 'semifinal', 'final']

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

  const [configJornada,   setConfigJornada]   = useState(draftJornada?.config || { fecha: '', hora_inicio: '', numero: '' })
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
  const [fechaRonda,       setFechaRonda]       = useState('')
  const [horaRonda,        setHoraRonda]        = useState('08:00')
  const [generandoRonda,   setGenerandoRonda]   = useState(false)
  const [modoImpar,        setModoImpar]        = useState('mejor_perdedor') // 'mejor_perdedor' | 'bye'
  const [crearTercerPuesto, setCrearTercerPuesto] = useState(false)

  // Cupos sugeridos para la vista previa en vivo del árbol: si hay grupos,
  // "clasifican X por grupo" × cantidad de grupos; si aún no se creó el
  // bracket real, se recalcula solo cuando cambia la config de grupos.
  useEffect(() => {
    if (bracket.length > 0) return
    if (grupos.length > 0) {
      let sugerido = clasificanPorGrupo * grupos.length
      if (sugerido % 2 !== 0) sugerido += 1
      if (sugerido >= 2) setNumClasifElim(sugerido)
    }
  }, [grupos.length, clasificanPorGrupo, bracket.length])

  // Vista previa en vivo: arrastrar un equipo encima de otro intercambia
  // sus puestos en el orden de siembra (el 5° se va al puesto del 2° y el
  // 2° pasa al puesto del 5°), y las llaves se arman de nuevo con ese
  // orden. Si cambia quién clasifica (nuevo resultado, cambian cupos), el
  // orden a mano se descarta y vuelve al automático.
  const [previewOrden,     setPreviewOrden]      = useState(null) // array de ids en el orden a mano, o null = orden por defecto
  const [dragPreview,      setDragPreview]      = useState(null) // { team, x, y }
  const [sobrePreviewId,   setSobrePreviewId]   = useState(null)
  const participantesPreviewLive = (bracket.length === 0 && (grupos.length > 0 || equipos.length >= 2)) ? getParticipantesElim(numClasifElim) : []

  useEffect(() => {
    setPreviewOrden(prev => {
      if (!prev) return prev
      const idsLive = participantesPreviewLive.map(p => String(p.id))
      const idsPrev = prev.map(String)
      const mismos = idsLive.length === idsPrev.length && idsLive.every(id => idsPrev.includes(id))
      return mismos ? prev : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantesPreviewLive.map(p => p.id).join(',')])

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
  const [guardandoPago,    setGuardandoPago]    = useState(false)
  const [equipoFinAbierto, setEquipoFinAbierto] = useState(null)

  useEffect(() => { if (id && id !== 'undefined') fetchTodo() }, [id])
  const [menuEquipoId,     setMenuEquipoId]     = useState(null)
  const [posterEquipo,     setPosterEquipo]      = useState(null)
  const [uniformeEquipo,   setUniformeEquipo]   = useState(null)
  const [showFlyerTorneo,  setShowFlyerTorneo]  = useState(false)
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
    setConfigJornada({ fecha: '', hora_inicio: '', numero: '' })
    setEditJornadaIdx(null)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    // Pintar la página apenas llega el torneo; equipos y partidos llegan
    // en paralelo y van llenando las secciones (clave en celular).
    const pResto = Promise.all([fetchEquipos(), fetchPartidos(), fetchFinalizado()])
    await fetchTorneo()
    setLoading(false)
    await pResto

    Promise.all([fetchJugadores(), fetchCanchas(), fetchFechas(), fetchGrupos(), fetchSanciones()]).catch(() => {})

    ;(async () => {
      try {
        const { data: arbs } = await supabase.from('players').select('id,name').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
        setArbitrosAdmin(arbs || [])
      } catch (e) { console.error('carga secundaria:', e) }
    })()
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
  }

  async function fetchEquipos() {
    const { data } = await supabase.from('tournament_teams').select('*, teams(id, name, city, logo_url, modalidad, genero, registro_token)').eq('tournament_id', id)
    setEquipos((data || []).map(d => ({ ...d.teams, tournament_team_id: d.id })))
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
  }

  // Sorteo físico: arrastrar un equipo encima de otro arma esa llave.
  function handleFormarLlaveManual(a, b) {
    setLlavesManuales(prev => [...prev, [a, b]])
  }
  function handleDeshacerLlaveManual(i) {
    setLlavesManuales(prev => prev.filter((_, idx) => idx !== i))
  }


  // Parejas según el estilo elegido (para vista previa y generación)
  function getParejasElim() {
    if (estiloLlaves === 'manual') return llavesManuales
    const participantes = getParticipantesElim(numClasifElim)
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
      if (!fechaElim) return showMsg('Selecciona la fecha de los partidos', 'error')
      if (numClasifElim % 2 !== 0) return showMsg('El número de clasificados debe ser par', 'error')
      if (estiloLlaves === 'manual') {
        const idsEnLlaves = new Set(llavesManuales.flatMap(([a, b]) => [a.id, b.id]))
        const sinAsignar = ordenManual.filter(t => !idsEnLlaves.has(t.id))
        if (sinAsignar.length > 0) return showMsg(`Faltan por emparejar: ${sinAsignar.map(t => t.name).join(', ')} — arrastralos encima de otro equipo`, 'error')
      }
      const parejas = getParejasElim()
      if (parejas.length < 1) return showMsg('Necesitas al menos 2 clasificados', 'error')
      if (!window.confirm(`Esto va a crear ${parejas.length} partido${parejas.length > 1 ? 's' : ''} programado${parejas.length > 1 ? 's' : ''} de verdad (no es la vista previa) para el ${fechaElim}. ¿Seguro que ya terminó la fase de grupos y querés crearlos?`)) return
      setGenerandoElim(true)

      // Un equipo no avanza a eliminatorias con tarjetas sin pagar
      const idsParticipantes = [...new Set(parejas.flatMap(([a, b]) => [a?.id, b?.id]).filter(Boolean))]
      const deudores = await getDeudoresTarjetas(idsParticipantes)
      if (deudores.length > 0) {
        showMsg(`⛔ Tienen tarjetas sin pagar: ${deudores.map(d => `${d.name} (${fmt(d.deuda)})`).join(', ')} — registra los pagos en la pestaña Finanzas`, 'error')
        return
      }

      const total = parejas.length * 2
      const fase  = getFaseValue(total)
      const ronda = getRondaNombre(total)

      // Eliminar eliminatorias anteriores
      const { error: errDel } = await supabase.from('matches').delete().eq('tournament_id', id).neq('fase', 'grupo')
      if (errDel) { showMsg(`No se pudo borrar el bracket anterior: ${errDel.message}`, 'error'); return }

      const inserts = []
      parejas.forEach(([local, visitante]) => {
        inserts.push({
          tournament_id: id, home_team_id: local.id, away_team_id: visitante.id,
          played_at: `${fechaElim}T${horaElim}:00-05:00`, status: 'scheduled', fase, ronda, matchday: null,
        })
        if (idaVuelta) {
          inserts.push({
            tournament_id: id, home_team_id: visitante.id, away_team_id: local.id,
            played_at: `${fechaElim}T${horaElim}:00-05:00`, status: 'scheduled', fase, ronda: `${ronda} (vuelta)`, matchday: null,
          })
        }
      })

      const { error } = await supabase.from('matches').insert(inserts)
      if (error) { showMsg(`Error al crear el bracket: ${error.message}`, 'error'); return }
      await supabase.from('tournaments').update({ fase_actual: 'eliminatorias' }).eq('id', id)
      showMsg(`${ronda} creada con ${parejas.length} llaves ✓`)
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
      await supabase.from('tournaments').update({ fase_actual: 'grupos' }).eq('id', id)
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
        return { matches, teamA, teamB, golesA, golesB, terminada, ganador, porPenales }
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
    let vivos = null
    fasesExist.forEach(f => {
      const llavesF = porFase[f]
      const enFase = new Set(llavesF.flatMap(l => [l.teamA.id, l.teamB.id]))
      const ganadoresF = llavesF.map(l => l.ganador).filter(Boolean)
      const byes = vivos ? vivos.filter(v => !enFase.has(v.id)) : []
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
      supabase.from('torneo_finanzas').select('*, teams(name)').eq('tournament_id', id).order('created_at', { ascending: false }),
      // Tarjetas de DOS fuentes combinadas:
      // 1. Eventos del partido: incluyen jugadores sin registro (con su nombre)
      // 2. Estadísticas: respaldo para partidos viejos guardados sin eventos
      supabase.from('match_events').select('match_id, player_id, team_id, event_type, player_nombre, players(name)')
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
      const { data: evs2 } = await supabase.from('match_events').select('match_id, player_id, team_id, event_type, players(name)')
        .eq('tournament_id', id).in('event_type', ['yellow_card', 'blue_card', 'red_card'])
      eventos = evs2 || []
    }

    // Normalizar: filas { team_id, player_id, nombre, am, az, rj }
    // Si un partido tiene eventos de tarjeta, manda el evento; si no tiene
    // ninguno (planilla vieja), se usan sus estadísticas.
    const partidosConEventos = new Set(eventos.map(e => e.match_id))
    const filasTarjetas = []
    eventos.forEach(e => filasTarjetas.push({
      team_id: e.team_id, player_id: e.player_id,
      nombre: e.players?.name || (e.player_nombre ? `${e.player_nombre} (sin registro)` : 'Jugador sin registro'),
      am: e.event_type === 'yellow_card' ? 1 : 0,
      az: e.event_type === 'blue_card'   ? 1 : 0,
      rj: e.event_type === 'red_card'    ? 1 : 0,
    }))
    ;(st || []).forEach(s => {
      if (partidosConEventos.has(s.match_id)) return
      const am = s.yellow_cards || 0, az = s.blue_cards || 0, rj = s.red_cards || 0
      if (am + az + rj === 0) return
      filasTarjetas.push({ team_id: s.team_id, player_id: s.player_id, nombre: s.players?.name, am, az, rj })
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
    const porJugador = {}
    statsTarjetas.forEach(s => {
      if ((s.am || 0) + (s.az || 0) + (s.rj || 0) === 0) return
      const key = `${s.team_id}|${s.player_id || 'nr:' + (s.nombre || 'sin nombre')}`
      if (!porJugador[key]) porJugador[key] = { team_id: s.team_id, player_id: s.player_id, nombre: s.nombre || 'Jugador sin registro', am: 0, az: 0, rj: 0, valor: 0 }
      porJugador[key].am += s.am || 0
      porJugador[key].az += s.az || 0
      porJugador[key].rj += s.rj || 0
      porJugador[key].valor += (s.am || 0) * pA + (s.az || 0) * pZ + (s.rj || 0) * pR
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

  async function handleRegistrarPago() {
    const monto = parseFloat(pagoForm.monto)
    const esDeuda = pagoForm.tipo === 'cargo_manual'
    if (!monto || monto <= 0) return showMsg(esDeuda ? 'Ingresa el monto de la deuda' : 'Ingresa el monto del pago', 'error')
    setGuardandoPago(true)
    const { error } = await supabase.from('torneo_finanzas').insert({
      tournament_id: id, team_id: pagoModal.id, tipo: pagoForm.tipo, monto,
      concepto: pagoForm.concepto || (esDeuda ? 'Deuda anotada' : pagoForm.tipo === 'pago_tarjetas' ? 'Pago de tarjetas' : 'Pago de cargos'),
    })
    setGuardandoPago(false)
    if (error) return showMsg('Error al registrar (¿ejecutaste migracion_finanzas.sql?)', 'error')
    showMsg(esDeuda ? 'Deuda anotada ✓ — sumada al saldo del equipo' : 'Pago registrado ✓')
    setPagoModal(null); setPagoForm({ tipo: 'pago_tarjetas', monto: '', concepto: '' })
    fetchFinanzas()
  }

  async function handleEliminarPago(mv) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('torneo_finanzas').delete().eq('id', mv.id)
    fetchFinanzas()
  }

  // Marca como pagadas TODAS las tarjetas pendientes de un color de un
  // jugador en este torneo — así deja de salirle la advertencia "debe
  // tarjeta" en la planilla del próximo partido. No toca el saldo del
  // equipo (eso lo sigue manejando el botón "💵 Pago" de arriba).
  async function handlePagarTarjetaJugador(playerId, color, nombre) {
    const columnaPagado = color === 'am' ? 'yellow_paid' : color === 'az' ? 'blue_paid' : 'red_paid'
    const columnaCantidad = color === 'am' ? 'yellow_cards' : color === 'az' ? 'blue_cards' : 'red_cards'
    const { error } = await supabase.from('player_match_stats').update({ [columnaPagado]: true })
      .eq('tournament_id', id).eq('player_id', playerId).gt(columnaCantidad, 0)
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

  // Equipos con tarjetas sin pagar (para bloquear eliminatorias)
  async function getDeudoresTarjetas(teamIds) {
    const fc = torneo?.finanzas_config || {}
    const pA = fc.precio_amarilla || 0, pZ = fc.precio_azul || 0, pR = fc.precio_roja || 0
    if (pA + pZ + pR === 0) return []
    const { data: st } = await supabase.from('player_match_stats').select('team_id, yellow_cards, blue_cards, red_cards').eq('tournament_id', id)
    const { data: pagos } = await supabase.from('torneo_finanzas').select('team_id, monto').eq('tournament_id', id).eq('tipo', 'pago_tarjetas')
    const saldo = {}
    ;(st || []).forEach(s => { saldo[s.team_id] = (saldo[s.team_id] || 0) + (s.yellow_cards || 0) * pA + (s.blue_cards || 0) * pZ + (s.red_cards || 0) * pR })
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

    // Tarjetas sin pagar al cierre del torneo → deuda personal de cada jugador
    let deudoresPersonales = 0
    try {
      const fc = torneo?.finanzas_config || {}
      const pA = fc.precio_amarilla || 0, pZ = fc.precio_azul || 0, pR = fc.precio_roja || 0
      if (pA + pZ + pR > 0) {
        const [{ data: st }, { data: pagos }] = await Promise.all([
          supabase.from('player_match_stats').select('player_id, team_id, yellow_cards, blue_cards, red_cards').eq('tournament_id', id),
          supabase.from('torneo_finanzas').select('team_id, monto').eq('tournament_id', id).eq('tipo', 'pago_tarjetas'),
        ])
        const cargoEq = {}, pagosEq = {}, valorJug = {}
        ;(st || []).forEach(s => {
          const v = (s.yellow_cards || 0) * pA + (s.blue_cards || 0) * pZ + (s.red_cards || 0) * pR
          if (v === 0) return
          cargoEq[s.team_id] = (cargoEq[s.team_id] || 0) + v
          const k = `${s.team_id}|${s.player_id}`
          valorJug[k] = (valorJug[k] || 0) + v
        })
        ;(pagos || []).forEach(p => { pagosEq[p.team_id] = (pagosEq[p.team_id] || 0) + (p.monto || 0) })

        const deudas = []
        Object.entries(valorJug).forEach(([k, valor]) => {
          const [team_id, player_id] = k.split('|')
          const cargo = cargoEq[team_id] || 0
          const saldo = Math.max(0, cargo - (pagosEq[team_id] || 0))
          if (cargo === 0 || saldo === 0) return
          const monto = Math.round(valor * (saldo / cargo))
          if (monto > 0) deudas.push({ tournament_id: id, team_id, player_id, tipo: 'deuda_personal', monto, concepto: `Tarjetas del torneo ${torneo?.name || ''}`.trim(), pagado: false })
        })

        await supabase.from('torneo_finanzas').delete().eq('tournament_id', id).eq('tipo', 'deuda_personal')
        if (deudas.length > 0) await supabase.from('torneo_finanzas').insert(deudas)
        deudoresPersonales = deudas.length
      }
    } catch (e) { console.error('deuda personal:', e) }

    const equiposSinJugadores = equipos.filter(e => !jugadores.some(j => j.team_id === e.id))
    showMsg(`Logros guardados ✓ 🏆 ${campeonEq.name} · 🥈 ${subcampeonEq.name}${tercerEq ? ` · 🥉 ${tercerEq.name}` : ''}${deudoresPersonales > 0 ? ` · 💳 ${deudoresPersonales} jugadores quedaron con deuda personal de tarjetas` : ''}${equiposSinJugadores.length > 0 ? ` (${equiposSinJugadores.length} equipos sin jugadores inscritos quedaron sin logro)` : ''}`)
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

  async function handleGenerarSiguienteRonda() {
    const est = getEstadoEliminatorias()
    if (!est) return
    if (est.actual === 'final') return showMsg('El torneo ya está en la final', 'error')
    if (!est.completa) return showMsg('Faltan partidos por jugar en esta ronda', 'error')
    if (est.hayEmpates) return showMsg('Hay llaves empatadas — registra los penales en la planilla', 'error')
    if (!fechaRonda) return showMsg('Selecciona la fecha de la siguiente ronda', 'error')
    setGenerandoRonda(true)

    // Un equipo no avanza de ronda con tarjetas sin pagar
    const deudoresRonda = await getDeudoresTarjetas(est.vivos.map(v => v.id))
    if (deudoresRonda.length > 0) {
      showMsg(`⛔ Tienen tarjetas sin pagar: ${deudoresRonda.map(d => `${d.name} (${fmt(d.deuda)})`).join(', ')} — registra los pagos en la pestaña Finanzas`, 'error')
      setGenerandoRonda(false)
      return
    }

    const conVuelta = est.llaves.some(l => l.matches.length > 1)
    const base = { tournament_id: id, played_at: `${fechaRonda}T${horaRonda}:00-05:00`, status: 'scheduled', matchday: null }
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

    for (let i = 0; i + 1 < equiposRonda.length; i += 2) {
      const local = equiposRonda[i], visitante = equiposRonda[i + 1]
      inserts.push({ ...base, home_team_id: local.id, away_team_id: visitante.id, fase, ronda })
      if (conVuelta) inserts.push({ ...base, home_team_id: visitante.id, away_team_id: local.id, fase, ronda: `${ronda} (vuelta)` })
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
    if (error) { showMsg(`Error al actualizar torneo: ${error.message}`, 'error'); return }
    setTorneo(p => ({ ...p, ...formTorneo })); setEditandoTorneo(false); showMsg('Torneo actualizado ✓')
  }

  async function handleGuardarEditPartido() {
    if (!formEditPartido.played_at || !formEditPartido.hora) return showMsg('Fecha y hora son obligatorias', 'error')
    const { error } = await supabase.from('matches').update({
      played_at: `${formEditPartido.played_at}T${formEditPartido.hora}:00-05:00`,
      location: formEditPartido.location || null, matchday: formEditPartido.matchday ? parseInt(formEditPartido.matchday) : null,
      fase: formEditPartido.fase || 'grupo',
    }).eq('id', editandoPartidoForm.id)
    if (error) { showMsg(`Error al guardar: ${error.message}`, 'error'); return }
    showMsg('Partido actualizado ✓'); setEditandoPartidoForm(null); fetchPartidos()
  }

  function generarJornada() {
    setEditJornadaIdx(null)
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
    setLoadingPartido(true)
    const { data: fechaData, error: fechaErr } = await supabase.from('fechas').insert({
      tournament_id: id, numero: parseInt(configJornada.numero) || (fechas.length + 1),
      nombre: `Jornada ${configJornada.numero || fechas.length + 1}`, fecha_inicio: configJornada.fecha,
    }).select().single()
    if (fechaErr) { showMsg('Error al crear jornada', 'error'); setLoadingPartido(false); return }
    const inserts = jornadaGenerada.filter(p => !p.descanso && p.visitante).map(p => ({
      tournament_id: id, home_team_id: p.local.id, away_team_id: p.visitante.id,
      played_at: `${configJornada.fecha}T${p.hora || configJornada.hora_inicio}:00-05:00`, location: p.cancha?.nombre || null,
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
              showMsg('Resultado guardado ✓'); cerrarPlanilla(); fetchPartidos(); fetchBracket()
            }
          }}
        />
      )}

      {modalPartidoAdmin && (
        <ModalPartidoAdmin partido={modalPartidoAdmin} onClose={() => setModalPartidoAdmin(null)}/>
      )}

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
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '420px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>Editar torneo</div>
            <div className="gm-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[{ label: 'Nombre', key: 'name' }, { label: 'Ciudad', key: 'city' }, { label: 'Temporada', key: 'season' }, { label: 'Categoría', key: 'categoria' }].map(f => (
                <div key={f.key}><label style={labelStyle}>{f.label}</label><input value={formTorneo[f.key] || ''} onChange={e => setFormTorneo(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}/></div>
              ))}
              <div><label style={labelStyle}>Modalidad</label><select value={formTorneo.modalidad || ''} onChange={e => setFormTorneo(p => ({ ...p, modalidad: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Fútbol 5</option><option>Fútbol 7</option><option>Fútbol 11</option></select></div>
              <div><label style={labelStyle}>Género</label><select value={formTorneo.genero || ''} onChange={e => setFormTorneo(p => ({ ...p, genero: e.target.value }))} style={inputStyle}><option value="">Seleccionar...</option><option>Masculino</option><option>Femenino</option><option>Mixto</option></select></div>
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
          <button onClick={() => { setFormTorneo({ name: torneo.name, city: torneo.city, season: torneo.season, categoria: torneo.categoria, modalidad: torneo.modalidad, genero: torneo.genero, equipos_permitidos: torneo.equipos_permitidos ?? 0, requiere_cedula: torneo.requiere_cedula !== false }); setEditandoTorneo(true) }}
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
                                    <div style={{ fontSize: '.65rem', color: '#9aa0a6' }}>{new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</div>
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
                                  <input type="time" value={p.hora || ''} onChange={e => actualizarPartidoJornada(i, { hora: e.target.value })}
                                    style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124' }}/>
                                  <select value={p.cancha ? String(p.cancha.id) : ''} onChange={e => actualizarPartidoJornada(i, { cancha: canchas.find(c => String(c.id) === e.target.value) || null })}
                                    style={{ fontSize: '.75rem', padding: '3px 6px', border: '1px solid #dadce0', borderRadius: '6px', color: '#202124', maxWidth: '140px' }}>
                                    <option value="">Sin cancha</option>
                                    {canchas.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                                  </select>
                                  <button onClick={() => setEditJornadaIdx(null)} title="Listo"
                                    style={{ background: '#1e8e3e', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                                    <Check size={13}/>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '.72rem', color: '#5f6368' }}>🕐 {p.hora}</span>
                                  <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>📍 {p.cancha?.nombre || 'Sin cancha'}</span>
                                  <button onClick={() => setEditJornadaIdx(i)} title="Editar horario y cancha"
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
                        <div style={{ fontSize:'.72rem', fontWeight:'700', color:'#5f6368', marginBottom:'10px' }}>👥 Jugadores de {e.name}</div>
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
                                  {!esOrganizador && (
                                    <button onClick={async () => {
                                      if (!confirm('¿Desactivar a ' + p.name + ' del equipo en este torneo? Sus estadísticas se conservan.')) return
                                      await supabase.from('tournament_player_registrations').update({ activo: false }).eq('id', j.id)
                                      fetchJugadores()
                                    }} style={{ background:'none', border:'1px solid #fad2cf', borderRadius:'6px', padding:'3px 8px', cursor:'pointer', color:'#d93025', fontSize:'.68rem', flexShrink:0 }}>
                                      Desactivar
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {jugsDesact.length > 0 && !esOrganizador && (
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
              rows={tablaOrdenada.filter(r => r.pj > 0).map(r => ({
                equipo: r.equipo, gc: r.gc, pj: r.pj,
                arqueros: arquerosEquipos.filter(a => a.team_id === r.equipo.id),
              }))}
            />
          </div>
        </div>
      )}

      {/* ── TAB ELIMINATORIAS ── */}
      {/* ── TAB ELIMINATORIAS ── */}
      {tab === 'eliminatorias' && (
        <div>
          {/* Iniciar / reconfigurar */}
          {bracket.length === 0 ? (
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
          ) : (
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
          )}

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
            const totalPreview = parejasPreview.length * 2
            if (parejasPreview.length === 0) return null

            // Arma las columnas del árbol igual que el bracket real: la ronda
            // actual con los equipos que van clasificando, y las siguientes
            // rondas como placeholders "Por definir" hasta llegar al campeón.
            const columnasPreview = []
            let llavesRonda = parejasPreview.map(([a, b]) => ({ a, b }))
            let totalRonda = totalPreview
            while (true) {
              columnasPreview.push({ total: totalRonda, llaves: llavesRonda })
              if (llavesRonda.length <= 1) break
              const siguienteN = Math.max(Math.floor(llavesRonda.length / 2), 1)
              llavesRonda = Array.from({ length: siguienteN }, () => null)
              totalRonda = Math.max(Math.floor(totalRonda / 2), 2)
            }

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
                  <button onClick={abrirWizardElim} style={{ marginLeft: 'auto', fontSize: '.72rem', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                    ⚙️ Ajustar cupos/formato
                  </button>
                </div>
                <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '10px' }}>
                  Así quedaría el árbol si la fase de grupos terminara ahora ({grupos.length > 0 ? `clasifican ${clasificanPorGrupo} por grupo` : `clasifican ${numClasifElim}`}) — se va actualizando solo con cada resultado que cargues. Arrastrá un equipo encima de otro para intercambiar sus puestos en el orden. Cuando termines la fase de grupos, tocá "{bracket.length > 0 ? 'Reconfigurar' : 'Iniciar'} eliminaciones directas" para que el árbol quede en firme y se puedan jugar esos partidos.
                </div>
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
                          </div>
                        ) : (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#9aa0a6', fontSize: '.72rem', fontWeight: '600', background: '#f1f3f4' }}>
                            Por definir
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
            const participantes = estiloLlaves === 'manual' ? ordenManual : getParticipantesElim(numClasifElim)
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
                        <input type="number" min="2" max="16" step="2" value={numClasifElim}
                          onChange={e => { const v = parseInt(e.target.value); if (v >= 2 && v <= 16) cambiarCuposElim(v) }}
                          style={{ ...inputStyle, width: '76px', textAlign: 'center', fontWeight: '700', border: ![2,4,8,16].includes(numClasifElim) ? '2px solid #e8710a' : '1px solid #dadce0' }}/>
                      </div>
                      <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '6px' }}>
                        Puede ser cualquier número par (ej: 6, 10, 12). Si en una ronda quedan impares, podrás meter un mejor perdedor o dar pase directo al 1° de la reclasificación.
                      </div>
                      {numClasifElim % 2 !== 0 && (
                        <div style={{ marginTop: '6px', fontSize: '.72rem', color: '#d93025', fontWeight: '600' }}>
                          ⚠️ El número de clasificados debe ser par para armar las llaves iniciales
                        </div>
                      )}
                      {mejores.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '.72rem', color: '#e8710a', background: '#fff4e5', border: '1px solid #ffd8a8', borderRadius: '8px', padding: '8px 12px' }}>
                          🎟️ Los cupos se completan con los mejores de la reclasificación (mejor perdedor): {mejores.map(m => m.name).join(', ')}
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
                      {estiloLlaves === 'manual' ? (
                        <SorteoManualDrag
                          pendientes={ordenManual.filter(t => !llavesManuales.some(([a, b]) => a.id === t.id || b.id === t.id))}
                          llaves={llavesManuales}
                          onFormarLlave={handleFormarLlaveManual}
                          onDeshacerLlave={handleDeshacerLlaveManual}
                        />
                      ) : (
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
                        </div>
                      )}
                    </div>

                    {/* 5. Vista previa de llaves */}
                    {parejas.length > 0 && (
                      <div style={{ marginBottom: '18px' }}>
                        <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '8px' }}>5. Así quedan las llaves — {getRondaNombre(parejas.length * 2)}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                          {parejas.map(([a, b], i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '8px 12px' }}>
                              <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', flexShrink: 0 }}>Llave {i + 1}</span>
                              <span style={{ flex: 1, fontSize: '.75rem', fontWeight: '600', color: '#202124', textAlign: 'right' }}>{a?.name}</span>
                              <span style={{ fontSize: '.68rem', fontWeight: '700', color: '#e8710a' }}>vs</span>
                              <span style={{ flex: 1, fontSize: '.75rem', fontWeight: '600', color: '#202124' }}>{b?.name}</span>
                            </div>
                          ))}
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
            const nombreSiguiente = repechajePendiente
              ? 'repechaje'
              : vivos.length === 3
                ? 'Semifinal (1° vs 2°)'
                : getRondaNombre(esImpar && modoImpar === 'mejor_perdedor' ? vivos.length + 1 : vivos.length)

            // Columnas del árbol: fases jugadas + placeholders, siempre hasta la final
            const columnas = []
            let n = porFase[fasesExist[0]].length
            for (let idx = FASE_ORDEN.indexOf(fasesExist[0]); idx < FASE_ORDEN.length; idx++) {
              const f = FASE_ORDEN[idx]
              if (porFase[f]) {
                columnas.push({ fase: f, llaves: porFase[f] })
                n = porFase[f].length
              } else {
                n = Math.max(Math.floor(n / 2), 1)
                columnas.push({ fase: f, llaves: Array.from({ length: n }, () => null) })
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
                                ? `${ll.matches.length > 1 ? 'Ida y vuelta · ' : ''}${ll.matches[0].played_at ? new Date(ll.matches[0].played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) + ' ' + new Date(ll.matches[0].played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'Por jugar'}${ll.matches[0].location ? ' · 📍 ' + ll.matches[0].location : ''} · toca para planilla`
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
                        ) : (
                          <div key={i} style={{ border: '2px dashed #b0b6bd', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#9aa0a6', fontSize: '.72rem', fontWeight: '600', background: '#f1f3f4' }}>
                            Por definir
                          </div>
                        ))}
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
                      <button onClick={e => { e.stopPropagation(); setPagoForm({ tipo: 'pago_tarjetas', monto: '', concepto: '' }); setPagoModal(r.equipo) }}
                        style={{ background: '#1a73e8', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', fontWeight: '600' }}>
                        💵 Pago
                      </button>
                      <button onClick={e => { e.stopPropagation(); setPagoForm({ tipo: 'cargo_manual', monto: '', concepto: '' }); setPagoModal(r.equipo) }}
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
