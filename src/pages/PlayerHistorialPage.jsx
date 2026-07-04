import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Filter, ChevronDown, Shield, X } from 'lucide-react'

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

function ModalDetallePartido({ stat, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'540px', maxHeight:'85vh', overflowY:'auto', paddingBottom:'32px' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
          <div>
            <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124' }}>
              {stat.matches?.home?.name} vs {stat.matches?.away?.name}
            </div>
            <div style={{ fontSize:'.72rem', color:'#9aa0a6', marginTop:'2px' }}>
              {stat.matches?.played_at && new Date(stat.matches.played_at).toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
              {stat.matches?.matchday && ` · J${stat.matches.matchday}`}
              {stat.tournament_name && ` · ${stat.tournament_name}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6' }}><X size={20}/></button>
        </div>

        {/* Marcador */}
        <div style={{ padding:'16px 20px', background:'#f8f9fa', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'center', gap:'16px' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end' }}>
            <span style={{ fontWeight:'700', fontSize:'.88rem', color:'#202124', textAlign:'right' }}>{stat.matches?.home?.name}</span>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#fff', border:'1px solid #e8eaed', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {stat.matches?.home?.logo_url ? <img src={stat.matches.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
            </div>
          </div>
          <div style={{ fontWeight:'900', fontSize:'1.6rem', color:'#202124', background:'#fff', border:'1px solid #e8eaed', borderRadius:'10px', padding:'5px 16px', flexShrink:0 }}>
            {stat.matches?.home_score} — {stat.matches?.away_score}
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#fff', border:'1px solid #e8eaed', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {stat.matches?.away?.logo_url ? <img src={stat.matches.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={12} color="#9aa0a6"/>}
            </div>
            <span style={{ fontWeight:'700', fontSize:'.88rem', color:'#202124' }}>{stat.matches?.away?.name}</span>
          </div>
        </div>

        {/* Mi resultado */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8eaed' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'600', color:'#5f6368', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mi resultado</div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            {(() => {
              const r = stat.team_result
              const color = r==='win'?'#1e8e3e':r==='draw'?'#e8710a':'#d93025'
              const bg    = r==='win'?'#e6f4ea':r==='draw'?'#fce8d9':'#fce8e6'
              const label = r==='win'?'Victoria':r==='draw'?'Empate':'Derrota'
              return <span style={{ fontSize:'.85rem', fontWeight:'700', color, background:bg, borderRadius:'8px', padding:'4px 14px' }}>{label}</span>
            })()}
            <span style={{ fontSize:'.78rem', color:'#5f6368' }}>jugando con <b>{stat.teams?.name}</b></span>
            {stat.es_mvp && <span style={{ fontSize:'.78rem', color:'#e8710a', background:'#fff8e1', borderRadius:'8px', padding:'3px 10px', fontWeight:'700' }}>⭐ MVP del partido</span>}
          </div>
        </div>

        {/* Mis estadísticas del partido */}
        <div style={{ padding:'14px 20px' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'600', color:'#5f6368', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mis estadísticas</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { label:'Goles',      value: stat.goals_scored   || 0, color:'#1a73e8', bg:'#e8f0fe', icon:'⚽' },
              { label:'Amarillas',  value: stat.yellow_cards   || 0, color:'#e8710a', bg:'#fce8d9', icon:'🟨' },
              { label:'Azules',     value: stat.blue_cards     || 0, color:'#1a73e8', bg:'#e8f0fe', icon:'🟦' },
              { label:'Rojas',      value: stat.red_cards      || 0, color:'#d93025', bg:'#fce8e6', icon:'🟥' },
              { label:'Faltas',     value: stat.fouls          || 0, color:'#5f6368', bg:'#f1f3f4', icon:'✋' },
              { label:'Recibidos',  value: stat.goals_conceded || 0, color:'#9aa0a6', bg:'#f1f3f4', icon:'🧤' },
            ].map(s => (
              <div key={s.label} style={{ background: s.value > 0 ? s.bg : '#f8f9fa', borderRadius:'10px', padding:'12px', textAlign:'center', border: s.value > 0 ? `1px solid ${s.color}30` : '1px solid #e8eaed' }}>
                <div style={{ fontSize:'1.1rem', marginBottom:'2px' }}>{s.icon}</div>
                <div style={{ fontSize:'1.4rem', fontWeight:'900', color: s.value > 0 ? s.color : '#bdbdbd', lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.62rem', color:'#9aa0a6', marginTop:'3px' }}>{s.label}</div>
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
  const [loading,      setLoading]      = useState(true)
  const [player,       setPlayer]       = useState(null)
  const [historial,    setHistorial]    = useState([])
  const [torneos,      setTorneos]      = useState([])
  const [filtroTipo,   setFiltroTipo]   = useState('todos')
  const [filtroTorneo, setFiltroTorneo] = useState('todos')
  const [detalle,      setDetalle]      = useState(null)
  const [showFiltros,  setShowFiltros]  = useState(false)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p) { navigate('/jugador'); return }
    setPlayer(p)

    // Historial completo con info del partido y torneo
    const { data: stats } = await supabase
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
      .order('created_at', { ascending: false })

    // Traer MVPs del jugador
    const { data: mvps } = await supabase
      .from('tournament_logros')
      .select('match_id')
      .eq('player_id', p.id)
      .eq('tipo', 'mvp')

    const mvpMatchIds = new Set((mvps || []).map(m => m.match_id))

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

  // Totales del filtro actual
  const totales = historialFiltrado.reduce((acc, s) => ({
    pj:       acc.pj + 1,
    goles:    acc.goles    + (s.goals_scored   || 0),
    amarillas:acc.amarillas+ (s.yellow_cards   || 0),
    azules:   acc.azules   + (s.blue_cards     || 0),
    rojas:    acc.rojas    + (s.red_cards      || 0),
    faltas:   acc.faltas   + (s.fouls          || 0),
    victorias:acc.victorias+ (s.team_result === 'win'  ? 1 : 0),
    empates:  acc.empates  + (s.team_result === 'draw' ? 1 : 0),
    derrotas: acc.derrotas + (s.team_result === 'loss' ? 1 : 0),
    mvps:     acc.mvps     + (s.es_mvp ? 1 : 0),
  }), { pj:0, goles:0, amarillas:0, azules:0, rojas:0, faltas:0, victorias:0, empates:0, derrotas:0, mvps:0 })

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f8f9fa', display:'flex', alignItems:'center', justifyContent:'center', color:'#1a73e8', fontSize:'.9rem' }}>Cargando historial...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f9fa', fontFamily:'system-ui,sans-serif' }}>

      {detalle && <ModalDetallePartido stat={detalle} onClose={() => setDetalle(null)}/>}

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8eaed', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => navigate('/jugador')} style={{ background:'none', border:'1px solid #dadce0', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#5f6368', display:'flex', alignItems:'center', flexShrink:0 }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:'700', color:'#202124', fontSize:'.95rem' }}>Mi historial</div>
          <div style={{ fontSize:'.72rem', color:'#9aa0a6' }}>{player?.name}</div>
        </div>
        <button onClick={() => setShowFiltros(!showFiltros)}
          style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', background: showFiltros?'#1a73e8':'#f1f3f4', border:'none', borderRadius:'20px', cursor:'pointer', color: showFiltros?'#fff':'#5f6368', fontSize:'.78rem', fontWeight:'600' }}>
          <Filter size={14}/> Filtros
          {(filtroTipo !== 'todos' || filtroTorneo !== 'todos') && (
            <span style={{ background:'#d93025', color:'#fff', borderRadius:'50%', width:'16px', height:'16px', fontSize:'.6rem', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700' }}>
              {(filtroTipo !== 'todos' ? 1 : 0) + (filtroTorneo !== 'todos' ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Panel filtros */}
      {showFiltros && (
        <div style={{ background:'#fff', borderBottom:'1px solid #e8eaed', padding:'14px 16px' }}>
          {/* Filtro por torneo */}
          {torneos.length > 0 && (
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'.72rem', fontWeight:'600', color:'#5f6368', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Torneo</div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                <button onClick={() => setFiltroTorneo('todos')}
                  style={{ padding:'5px 14px', borderRadius:'20px', border:`1px solid ${filtroTorneo==='todos'?'#1a73e8':'#dadce0'}`, background: filtroTorneo==='todos'?'#1a73e8':'#fff', color: filtroTorneo==='todos'?'#fff':'#5f6368', fontSize:'.75rem', fontWeight: filtroTorneo==='todos'?'600':'400', cursor:'pointer' }}>
                  Todos
                </button>
                {torneos.map(t => (
                  <button key={t.id} onClick={() => setFiltroTorneo(t.id)}
                    style={{ padding:'5px 14px', borderRadius:'20px', border:`1px solid ${filtroTorneo===t.id?'#1a73e8':'#dadce0'}`, background: filtroTorneo===t.id?'#1a73e8':'#fff', color: filtroTorneo===t.id?'#fff':'#5f6368', fontSize:'.75rem', fontWeight: filtroTorneo===t.id?'600':'400', cursor:'pointer', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Filtro por tipo */}
          <div>
            <div style={{ fontSize:'.72rem', fontWeight:'600', color:'#5f6368', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.05em' }}>Mostrar</div>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {FILTROS.map(f => (
                <button key={f.id} onClick={() => setFiltroTipo(f.id)}
                  style={{ padding:'5px 14px', borderRadius:'20px', border:`1px solid ${filtroTipo===f.id?'#1a73e8':'#dadce0'}`, background: filtroTipo===f.id?'#1a73e8':'#fff', color: filtroTipo===f.id?'#fff':'#5f6368', fontSize:'.75rem', fontWeight: filtroTipo===f.id?'600':'400', cursor:'pointer' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {(filtroTipo !== 'todos' || filtroTorneo !== 'todos') && (
            <button onClick={() => { setFiltroTipo('todos'); setFiltroTorneo('todos') }}
              style={{ marginTop:'10px', padding:'5px 14px', background:'none', border:'1px solid #fad2cf', borderRadius:'20px', cursor:'pointer', color:'#d93025', fontSize:'.75rem', fontWeight:'600' }}>
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      )}

      <div style={{ padding:'16px', maxWidth:'600px', margin:'0 auto' }}>

        {/* Resumen de totales */}
        <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'14px', padding:'16px', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize:'.72rem', fontWeight:'600', color:'#5f6368', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'.05em' }}>
            Resumen {filtroTipo !== 'todos' || filtroTorneo !== 'todos' ? '(filtrado)' : 'total'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'10px' }}>
            {[
              { label:'Partidos', value:totales.pj,        color:'#1a73e8' },
              { label:'Victorias',value:totales.victorias,  color:'#1e8e3e' },
              { label:'Empates',  value:totales.empates,    color:'#e8710a' },
              { label:'Derrotas', value:totales.derrotas,   color:'#d93025' },
              { label:'MVPs',     value:totales.mvps,       color:'#f9a825' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', background:'#f8f9fa', borderRadius:'8px', padding:'8px 4px' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:'900', color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.6rem', color:'#9aa0a6', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
            {[
              { label:'Goles',    value:totales.goles,     icon:'⚽', color:'#1a73e8' },
              { label:'Amarillas',value:totales.amarillas,  icon:'🟨', color:'#e8710a' },
              { label:'Azules',   value:totales.azules,     icon:'🟦', color:'#1a73e8' },
              { label:'Rojas',    value:totales.rojas,      icon:'🟥', color:'#d93025' },
              { label:'Faltas',   value:totales.faltas,     icon:'✋', color:'#5f6368' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center', background:'#f8f9fa', borderRadius:'8px', padding:'8px 4px' }}>
                <div style={{ fontSize:'.85rem', marginBottom:'1px' }}>{s.icon}</div>
                <div style={{ fontSize:'1.1rem', fontWeight:'900', color: s.value>0?s.color:'#bdbdbd', lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'.6rem', color:'#9aa0a6', marginTop:'2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de partidos */}
        <div style={{ fontSize:'.78rem', fontWeight:'600', color:'#5f6368', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{historialFiltrado.length} partido{historialFiltrado.length !== 1 ? 's' : ''}</span>
          <span style={{ fontWeight:'400', color:'#9aa0a6', fontSize:'.7rem' }}>Toca para ver detalles</span>
        </div>

        {historialFiltrado.length === 0 ? (
          <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'48px', textAlign:'center', color:'#9aa0a6' }}>
            <div style={{ fontSize:'2rem', marginBottom:'8px' }}>🔍</div>
            <div style={{ fontSize:'.875rem' }}>Sin partidos con ese filtro</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {historialFiltrado.map((s, i) => {
              const resultado = s.team_result
              const resColor  = resultado==='win'?'#1e8e3e':resultado==='draw'?'#e8710a':'#d93025'
              const resBg     = resultado==='win'?'#e6f4ea':resultado==='draw'?'#fce8d9':'#fce8e6'
              const resLabel  = resultado==='win'?'G':resultado==='draw'?'E':'P'
              const match     = s.matches

              return (
                <div key={i} onClick={() => setDetalle(s)}
                  style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'12px 14px', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.04)', transition:'background .1s', borderLeft:`3px solid ${resColor}` }}
                  onMouseEnter={e => e.currentTarget.style.background='#f8f9fa'}
                  onMouseLeave={e => e.currentTarget.style.background='#fff'}>

                  {/* Fila superior: resultado + torneo + fecha */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'.7rem', fontWeight:'700', color:resColor, background:resBg, borderRadius:'5px', padding:'1px 8px' }}>{resLabel}</span>
                    {s.es_mvp && <span style={{ fontSize:'.68rem', color:'#e8710a', background:'#fff8e1', borderRadius:'5px', padding:'1px 7px', fontWeight:'700' }}>⭐ MVP</span>}
                    {match?.matchday && <span style={{ fontSize:'.68rem', color:'#1a73e8', background:'#e8f0fe', borderRadius:'20px', padding:'1px 7px' }}>J{match.matchday}</span>}
                    {match?.grupo && <span style={{ fontSize:'.65rem', color:'#9955ff', background:'#f3e8fd', borderRadius:'20px', padding:'1px 7px' }}>{match.grupo}</span>}
                    <span style={{ fontSize:'.68rem', color:'#9aa0a6', marginLeft:'auto' }}>
                      {match?.played_at && new Date(match.played_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                    </span>
                  </div>

                  {/* Partido */}
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                      <span style={{ fontSize:'.82rem', fontWeight:'600', color:'#202124', textAlign:'right' }}>{match?.home?.name}</span>
                      <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#f1f3f4', border:'1px solid #e8eaed', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {match?.home?.logo_url ? <img src={match.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={10} color="#9aa0a6"/>}
                      </div>
                    </div>
                    <div style={{ fontWeight:'700', fontSize:'.95rem', color:'#202124', background:'#f1f3f4', borderRadius:'7px', padding:'3px 10px', flexShrink:0, minWidth:'48px', textAlign:'center' }}>
                      {match?.home_score} - {match?.away_score}
                    </div>
                    <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#f1f3f4', border:'1px solid #e8eaed', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {match?.away?.logo_url ? <img src={match.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain', padding:'2px' }}/> : <Shield size={10} color="#9aa0a6"/>}
                      </div>
                      <span style={{ fontSize:'.82rem', fontWeight:'600', color:'#202124' }}>{match?.away?.name}</span>
                    </div>
                  </div>

                  {/* Torneo */}
                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginBottom:'8px' }}>
                    🏆 {s.tournament_name} {s.teams?.name && `· ${s.teams.name}`}
                  </div>

                  {/* Mis stats del partido */}
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    {(s.goals_scored   ||0)>0 && <span style={{ fontSize:'.72rem', color:'#1e8e3e', background:'#e6f4ea', borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>⚽ {s.goals_scored} gol{s.goals_scored>1?'es':''}</span>}
                    {(s.yellow_cards   ||0)>0 && <span style={{ fontSize:'.72rem', color:'#e8710a', background:'#fce8d9', borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟨 Amarilla</span>}
                    {(s.blue_cards     ||0)>0 && <span style={{ fontSize:'.72rem', color:'#1a73e8', background:'#e8f0fe', borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟦 Azul</span>}
                    {(s.red_cards      ||0)>0 && <span style={{ fontSize:'.72rem', color:'#d93025', background:'#fce8e6', borderRadius:'20px', padding:'2px 9px', fontWeight:'700' }}>🟥 Roja</span>}
                    {(s.fouls          ||0)>0 && <span style={{ fontSize:'.72rem', color:'#9aa0a6', background:'#f1f3f4', borderRadius:'20px', padding:'2px 9px' }}>✋ {s.fouls} falta{s.fouls>1?'s':''}</span>}
                    {(s.goals_conceded ||0)>0 && <span style={{ fontSize:'.72rem', color:'#9aa0a6', background:'#f1f3f4', borderRadius:'20px', padding:'2px 9px' }}>🧤 {s.goals_conceded} recibido{s.goals_conceded>1?'s':''}</span>}
                    {(s.goals_scored||0)===0 && (s.yellow_cards||0)===0 && (s.blue_cards||0)===0 && (s.red_cards||0)===0 && (s.fouls||0)===0 && (s.goals_conceded||0)===0 && (
                      <span style={{ fontSize:'.72rem', color:'#bdbdbd' }}>Sin incidencias</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
