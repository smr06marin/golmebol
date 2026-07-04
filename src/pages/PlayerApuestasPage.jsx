import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react'

const S = {
  navy:    '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border:  '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', goldDim: 'rgba(249,168,37,.1)',
  win: '#1e8e3e', winDim: 'rgba(30,142,62,.1)',
  loss: '#d93025', lossDim: 'rgba(217,48,37,.1)',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

const PUNTOS = { ganador: 3, empate: 5, golesExactosCada: 3, bonusExacto: 10, goleador: 2 }

function TeamSheet({ teamId, teamName, teamLogo, tournamentId, tournamentName, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ttData }, { data: mData }, { data: sData }] = await Promise.all([
        supabase.from('tournament_teams').select('*, teams(*)').eq('tournament_id', tournamentId),
        supabase.from('matches')
          .select('*, home:home_team_id(id,name), away:away_team_id(id,name)')
          .eq('tournament_id', tournamentId).eq('status', 'finished')
          .order('played_at', { ascending: false }),
        supabase.from('goleadores_por_torneo').select('*')
          .eq('tournament_id', tournamentId).eq('team_id', teamId)
          .order('total_goals', { ascending: false }).limit(5),
      ])

      const tabla = {}
      ;(ttData || []).forEach(t => { tabla[t.teams.id] = { team: t.teams, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 } })
      ;(mData || []).filter(m => !m.fase || m.fase === 'grupo').forEach(m => {
        const h = tabla[m.home_team_id], a = tabla[m.away_team_id]
        if (h) { h.pj++; h.gf += m.home_score||0; h.gc += m.away_score||0; if (m.home_score > m.away_score) { h.pg++; h.pts += 3 } else if (m.home_score === m.away_score) { h.pe++; h.pts++ } else h.pp++ }
        if (a) { a.pj++; a.gf += m.away_score||0; a.gc += m.home_score||0; if (m.away_score > m.home_score) { a.pg++; a.pts += 3 } else if (m.away_score === m.home_score) { a.pe++; a.pts++ } else a.pp++ }
      })
      const sorted   = Object.values(tabla).sort((a,b) => b.pts - a.pts || (b.gf-b.gc)-(a.gf-a.gc))
      const pos      = sorted.findIndex(r => r.team.id === teamId) + 1
      const myStats  = tabla[teamId] || { pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0 }
      const teamMatches = (mData || []).filter(m => m.home_team_id === teamId || m.away_team_id === teamId).slice(0, 5).reverse()
      const form = teamMatches.map(m => { const isHome = m.home_team_id === teamId; const my = isHome ? m.home_score : m.away_score; const th = isHome ? m.away_score : m.home_score; return my > th ? 'W' : my === th ? 'D' : 'L' })
      const tablaRows = sorted.map((r, i) => ({ ...r, pos: i + 1, isMe: r.team.id === teamId }))
      setData({ pos, total: sorted.length, myStats, form, scorers: sData || [], tablaRows })
      setLoading(false)
    }
    load()
  }, [teamId, tournamentId])

  const FC = { W: S.win, D: '#9aa0a6', L: S.loss }
  const FB = { W: S.winDim, D: 'rgba(154,160,166,.1)', L: S.lossDim }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'92vh', overflowY:'auto', border:`0.5px solid ${S.border}` }}>
        <div style={{ padding:'16px 20px 12px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, background:S.surface, zIndex:1 }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'10px', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {teamLogo ? <img src={teamLogo} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <span style={{ fontSize:'1rem', fontWeight:'800', color:'#fff' }}>{(teamName||'?').substring(0,2).toUpperCase()}</span>}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:'800', fontSize:'1.05rem', color:S.text }}>{teamName}</div>
            <div style={{ fontSize:'.72rem', color:S.muted }}>{tournamentName}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'1.4rem', lineHeight:1 }}>✕</button>
        </div>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:S.muted }}>Cargando ficha...</div>
        ) : (
          <div style={{ padding:'16px 20px 32px', display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ background:S.card, borderRadius:'14px', padding:'18px', textAlign:'center' }}>
              <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'6px' }}>Posición en la tabla</div>
              <div style={{ fontSize:'3.5rem', fontWeight:'900', color: data.pos <= 3 ? S.cyan : S.text, lineHeight:1 }}>#{data.pos}</div>
              <div style={{ fontSize:'.78rem', color:S.muted, marginTop:'4px' }}>de {data.total} equipos</div>
            </div>
            <div style={{ background:S.card, borderRadius:'14px', padding:'14px 16px' }}>
              <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'10px' }}>Estadísticas del torneo</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                {[['PJ', data.myStats.pj, S.text2],['PG', data.myStats.pg, S.win],['PE', data.myStats.pe, S.gold],['PP', data.myStats.pp, S.loss],['GF', data.myStats.gf, S.cyan],['GC', data.myStats.gc, S.muted],['DIF', (data.myStats.gf-data.myStats.gc)>0 ? '+'+(data.myStats.gf-data.myStats.gc) : (data.myStats.gf-data.myStats.gc), S.text2],['PTS', data.myStats.pts, S.gold]].map(([lbl, val, color]) => (
                  <div key={lbl} style={{ background:S.card2, borderRadius:'8px', padding:'10px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:'1.3rem', fontWeight:'800', color }}>{val}</div>
                    <div style={{ fontSize:'.6rem', color:S.muted, marginTop:'2px' }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {data.form.length > 0 && (
              <div style={{ background:S.card, borderRadius:'14px', padding:'14px 16px' }}>
                <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'10px' }}>Forma reciente</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {data.form.map((r,i) => <div key={i} style={{ width:'38px', height:'38px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:FB[r], border:`1px solid ${FC[r]}`, fontWeight:'900', fontSize:'.85rem', color:FC[r] }}>{r}</div>)}
                  {data.form.length < 5 && [...Array(5-data.form.length)].map((_,i) => <div key={'e'+i} style={{ width:'38px', height:'38px', borderRadius:'10px', background:'rgba(30,45,61,.4)', border:`1px dashed ${S.border}` }}/>)}
                </div>
                <div style={{ fontSize:'.65rem', color:S.muted, marginTop:'6px' }}>W=Victoria · D=Empate · L=Derrota</div>
              </div>
            )}
            <div style={{ background:S.card, borderRadius:'14px', padding:'14px 16px' }}>
              <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'10px' }}>Tabla de posiciones</div>
              <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 30px 30px 30px 36px', gap:'0', fontSize:'.65rem', color:S.muted, fontWeight:'600', padding:'0 4px 6px', borderBottom:`1px solid ${S.border}`, marginBottom:'4px' }}>
                <span>#</span><span>Equipo</span><span style={{ textAlign:'center' }}>PJ</span><span style={{ textAlign:'center' }}>DIF</span><span style={{ textAlign:'center' }}>GC</span><span style={{ textAlign:'right' }}>PTS</span>
              </div>
              {data.tablaRows.map(r => (
                <div key={r.team.id} style={{ display:'grid', gridTemplateColumns:'28px 1fr 30px 30px 30px 36px', alignItems:'center', padding:'6px 4px', borderRadius:'8px', background: r.isMe ? S.cyanDim : 'transparent', border: r.isMe ? `1px solid ${S.cyan}` : '1px solid transparent', marginBottom:'2px' }}>
                  <span style={{ fontSize:'.75rem', fontWeight:'800', color: r.pos <= 3 ? S.cyan : S.muted }}>{r.pos}</span>
                  <span style={{ fontSize:'.8rem', fontWeight: r.isMe ? '800' : '500', color: r.isMe ? S.cyan : S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.team.name}</span>
                  <span style={{ textAlign:'center', fontSize:'.78rem', color:S.muted }}>{r.pj}</span>
                  <span style={{ textAlign:'center', fontSize:'.78rem', color:(r.gf-r.gc)>0?S.win:(r.gf-r.gc)<0?S.loss:S.muted, fontWeight:'600' }}>{(r.gf-r.gc)>0?'+':''}{r.gf-r.gc}</span>
                  <span style={{ textAlign:'center', fontSize:'.78rem', color:S.muted }}>{r.gc}</span>
                  <span style={{ textAlign:'right', fontSize:'.85rem', fontWeight:'800', color: r.isMe ? S.gold : S.text }}>{r.pts}</span>
                </div>
              ))}
            </div>
            {data.scorers.length > 0 && (
              <div style={{ background:S.card, borderRadius:'14px', padding:'14px 16px' }}>
                <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'10px' }}>Goleadores del equipo</div>
                {data.scorers.map((s,i) => (
                  <div key={s.player_id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom: i < data.scorers.length-1 ? `1px solid ${S.border}` : 'none' }}>
                    <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {s.photo_url ? <img src={s.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.8rem' }}>👤</span>}
                    </div>
                    <span style={{ flex:1, fontSize:'.85rem', color: i===0?S.cyan:S.text, fontWeight: i===0?'700':'400' }}>{s.player_name}</span>
                    <span style={{ fontSize:'1rem', fontWeight:'900', color:S.cyan }}>{s.total_goals}</span>
                    <span style={{ fontSize:'.72rem', color:S.muted }}>⚽</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayerApuestasPage() {
  const navigate = useNavigate()
  const [player,       setPlayer]       = useState(null)
  const [partidos,     setPartidos]     = useState([])
  const [miscPreds,    setMiscPreds]    = useState({})
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('pendientes')
  const [modal,        setModal]        = useState(null)
  const [step,         setStep]         = useState(1)
  const [form,         setForm]         = useState({ ganador:null, golesHome:0, golesAway:0, goleadorId:null })
  const [guardando,    setGuardando]    = useState(false)
  const [successAnim,  setSuccessAnim]  = useState(false)
  const [ranking,      setRanking]      = useState([])
  const [misPuntos,    setMisPuntos]    = useState(0)
  const [jugadores,    setJugadores]    = useState([])
  const [teamSheet,    setTeamSheet]    = useState(null)
  const [torneoFiltro, setTorneoFiltro] = useState(null)
  const [collapsed,    setCollapsed]    = useState({})

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.activo_membresia) { navigate('/jugador'); return }
    setPlayer(p)

    const [{ data: pts }, { data: preds }, { data: jugs }, { data: allPreds }] = await Promise.all([
      supabase.from('matches')
        .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(id,name,modalidad)')
        .order('played_at', { ascending: true })
        .limit(300),
      supabase.from('predicciones')
        .select('*, goleador:goleador_id(name)')
        .eq('player_id', p.id),
      supabase.from('tournament_player_registrations')
        .select('tournament_id, team_id, players(id,name,photo_url)')
        .eq('activo', true),
      supabase.from('predicciones').select('player_id, puntos_ganados'),
    ])

    // Traer MVPs de todos los partidos terminados
    const partidosData = pts || []
    const terminadosIds = partidosData.filter(pp => pp.status === 'finished').map(pp => pp.id)
    let mvpMap = {}
    if (terminadosIds.length > 0) {
      const { data: mvps } = await supabase
        .from('tournament_logros')
        .select('match_id, players(name, photo_face_url, photo_url)')
        .eq('tipo', 'mvp')
        .in('match_id', terminadosIds)
      ;(mvps || []).forEach(m => {
        mvpMap[m.match_id] = {
          nombre: m.players?.name,
          foto:   m.players?.photo_face_url || m.players?.photo_url,
        }
      })
    }
    setPartidos(partidosData.map(pp => ({ ...pp, mvp: mvpMap[pp.id] || null })))

    const predMap = {}
    ;(preds || []).forEach(pr => { predMap[pr.match_id] = pr })
    setMiscPreds(predMap)
    setMisPuntos((preds || []).reduce((s, pr) => s + (pr.puntos_ganados || 0), 0))
    setJugadores(jugs || [])

    const rankMap = {}
    ;(allPreds || []).forEach(pr => {
      if (!rankMap[pr.player_id]) rankMap[pr.player_id] = { id: pr.player_id, puntos: 0, nombre: null, foto: null }
      rankMap[pr.player_id].puntos += pr.puntos_ganados || 0
    })
    const playerIds = Object.keys(rankMap)
    if (playerIds.length > 0) {
      const { data: playersData } = await supabase.from('players').select('id, name, photo_face_url, photo_url').in('id', playerIds)
      ;(playersData || []).forEach(pl => {
        if (rankMap[pl.id]) { rankMap[pl.id].nombre = pl.name; rankMap[pl.id].foto = pl.photo_face_url || pl.photo_url }
      })
    }
    setRanking(Object.values(rankMap).sort((a,b) => b.puntos - a.puntos))
    setLoading(false)
  }

  function abrirModal(partido) {
    if (partido.played_at && new Date(partido.played_at) <= new Date()) {
      if (!miscPreds[partido.id]) return
    }
    const pred = miscPreds[partido.id]
    if (pred) {
      setForm({ ganador: pred.ganador, golesHome: pred.goles_home, golesAway: pred.goles_away, goleadorId: pred.goleador_id })
      setStep(5)
    } else {
      setForm({ ganador:null, golesHome:0, golesAway:0, goleadorId:null })
      setStep(1)
    }
    setSuccessAnim(false)
    setModal(partido)
  }

  async function guardarPrediccion() {
    if (!form.ganador) return
    setGuardando(true)
    const pred = miscPreds[modal.id]
    const data = { player_id: player.id, match_id: modal.id, ganador: form.ganador, goles_home: form.golesHome, goles_away: form.golesAway, goleador_id: form.goleadorId || null }
    if (pred) await supabase.from('predicciones').update(data).eq('id', pred.id)
    else       await supabase.from('predicciones').insert(data)
    setGuardando(false)
    setSuccessAnim(true)
    setStep(5)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const terminados = partidos.filter(p => p.status === 'finished')
  const miRanking  = ranking.findIndex(r => r.id === player.id) + 1

  const jugsModal = modal ? jugadores
    .filter(j => j.tournament_id === modal.tournament_id && (j.team_id === modal.home_team_id || j.team_id === modal.away_team_id))
    .map(j => j.players).filter(Boolean) : []

  function groupByTournament(lista) {
    const groups = {}
    lista.forEach(p => {
      const tid = p.tournament_id
      if (!groups[tid]) groups[tid] = { torneo: p.tournaments, partidos: [] }
      groups[tid].partidos.push(p)
    })
    return Object.values(groups)
  }

  const gruposPendientes = groupByTournament(torneoFiltro ? pendientes.filter(p => p.tournament_id === torneoFiltro) : pendientes)
  const torneosUnicos    = [...new Map(pendientes.map(p => [p.tournament_id, p.tournaments])).values()]

  function toggleCollapse(tid) { setCollapsed(prev => ({ ...prev, [tid]: !prev[tid] })) }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>

      {teamSheet && <TeamSheet {...teamSheet} onClose={() => setTeamSheet(null)}/>}

      {/* Modal predicción */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', border:`0.5px solid ${S.border}` }}>
            <div style={{ padding:'16px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:'700', fontSize:'.95rem', color:S.text }}>{modal.home?.name} vs {modal.away?.name}</div>
                <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'2px' }}>{modal.tournaments?.name} · {modal.tournaments?.modalidad}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
            </div>

            {step < 5 && (
              <div style={{ padding:'12px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', gap:'6px', flexShrink:0 }}>
                {['Resultado','Marcador','Goleador','Confirmar'].map((s,i) => (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                    <div style={{ width:'24px', height:'24px', borderRadius:'50%', fontSize:'.7rem', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', background: step>i+1 ? S.win : step===i+1 ? S.cyan : S.border, color: step>i+1||step===i+1 ? '#000' : S.muted }}>
                      {step>i+1 ? '✓' : i+1}
                    </div>
                    <div style={{ fontSize:'.6rem', color: step===i+1 ? S.cyan : S.muted }}>{s}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {step === 1 && (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'14px' }}>¿Quién gana?</div>
                  {[{ val:'home', label:modal.home?.name, pts:PUNTOS.ganador },{ val:'draw', label:'Empate', pts:PUNTOS.empate },{ val:'away', label:modal.away?.name, pts:PUNTOS.ganador }].map(opt => (
                    <div key={opt.val} onClick={() => setForm(f => ({ ...f, ganador:opt.val }))}
                      style={{ padding:'14px 16px', borderRadius:'12px', marginBottom:'8px', cursor:'pointer', border:`1px solid ${form.ganador===opt.val ? S.cyan : S.border}`, background: form.ganador===opt.val ? S.cyanDim : S.card, display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all .15s' }}>
                      <span style={{ fontWeight:'600', color: form.ganador===opt.val ? S.cyan : S.text, fontSize:'.875rem' }}>{opt.label}</span>
                      <span style={{ fontSize:'.72rem', color:S.gold, fontWeight:'700', background:S.goldDim, borderRadius:'20px', padding:'2px 8px' }}>+{opt.pts} pts</span>
                    </div>
                  ))}
                  <button disabled={!form.ganador} onClick={() => setStep(2)} style={{ width:'100%', marginTop:'12px', padding:'12px', background: form.ganador?S.cyan:S.border, border:'none', borderRadius:'10px', cursor: form.ganador?'pointer':'not-allowed', color: form.ganador?'#000':S.muted, fontWeight:'700', fontSize:'.875rem' }}>CONTINUAR →</button>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'16px' }}>¿Cuál será el marcador?</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'32px', marginBottom:'20px' }}>
                    {[0,1].map(team => (
                      <div key={team} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                        <div style={{ fontSize:'.75rem', color:S.muted, textAlign:'center' }}>{team===0 ? modal.home?.name : modal.away?.name}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                          <button onClick={() => setForm(f => ({ ...f, [team===0?'golesHome':'golesAway']: Math.max(0,(team===0?f.golesHome:f.golesAway)-1) }))} style={{ width:'40px', height:'40px', borderRadius:'50%', border:`1px solid ${S.border}`, background:S.card, color:S.text, cursor:'pointer', fontSize:'1.2rem', fontWeight:'700' }}>−</button>
                          <div style={{ fontSize:'2.5rem', fontWeight:'800', color:S.cyan, minWidth:'36px', textAlign:'center' }}>{team===0 ? form.golesHome : form.golesAway}</div>
                          <button onClick={() => setForm(f => ({ ...f, [team===0?'golesHome':'golesAway']: (team===0?f.golesHome:f.golesAway)+1 }))} style={{ width:'40px', height:'40px', borderRadius:'50%', border:`1px solid ${S.border}`, background:S.card, color:S.text, cursor:'pointer', fontSize:'1.2rem', fontWeight:'700' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign:'center', fontSize:'.75rem', color:S.muted, marginBottom:'16px' }}>Marcador exacto: <span style={{ color:S.gold, fontWeight:'700' }}>+{PUNTOS.golesExactosCada*2+PUNTOS.bonusExacto} pts bonus</span></div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => setStep(1)} style={{ flex:1, padding:'11px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontWeight:'600', fontSize:'.875rem' }}>← Volver</button>
                    <button onClick={() => setStep(3)} style={{ flex:2, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'700', fontSize:'.875rem' }}>CONTINUAR →</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'4px' }}>¿Quién anota? <span style={{ color:S.gold, fontSize:'.72rem' }}>+{PUNTOS.goleador} pts</span></div>
                  <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'12px' }}>Opcional — puedes saltar este paso</div>
                  <div onClick={() => setForm(f => ({ ...f, goleadorId: null }))}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'10px', cursor:'pointer', marginBottom:'8px', border:`1px solid ${form.goleadorId===null ? S.muted : S.border}`, background: form.goleadorId===null ? 'rgba(154,160,166,.08)' : S.card }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:S.card2, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:'.9rem' }}>🚫</span></div>
                    <span style={{ fontSize:'.85rem', color: form.goleadorId===null ? S.text2 : S.muted }}>Sin goleador favorito</span>
                    {form.goleadorId===null && <span style={{ marginLeft:'auto', color:S.muted }}>✓</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'220px', overflowY:'auto' }}>
                    {jugsModal.length === 0 ? (
                      <div style={{ color:S.muted, fontSize:'.8rem', textAlign:'center', padding:'16px' }}>Sin jugadores registrados en este partido</div>
                    ) : jugsModal.map(j => (
                      <div key={j.id} onClick={() => setForm(f => ({ ...f, goleadorId: j.id }))}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'10px', cursor:'pointer', border:`1px solid ${form.goleadorId===j.id ? S.cyan : S.border}`, background: form.goleadorId===j.id ? S.cyanDim : S.card, transition:'all .15s' }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:S.border, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {j.photo_url ? <img src={j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.8rem' }}>👤</span>}
                        </div>
                        <span style={{ fontSize:'.85rem', fontWeight: form.goleadorId===j.id?'700':'500', color: form.goleadorId===j.id?S.cyan:S.text }}>{j.name}</span>
                        {form.goleadorId===j.id && <span style={{ marginLeft:'auto', color:S.cyan }}>✓</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                    <button onClick={() => setStep(2)} style={{ flex:1, padding:'11px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontWeight:'600', fontSize:'.875rem' }}>← Volver</button>
                    <button onClick={() => setStep(4)} style={{ flex:2, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'700', fontSize:'.875rem' }}>{form.goleadorId ? 'CONTINUAR →' : 'SALTAR →'}</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'16px' }}>Confirma tu predicción</div>
                  {[
                    { label:'Resultado', value: form.ganador==='home' ? modal.home?.name+' gana' : form.ganador==='away' ? modal.away?.name+' gana' : 'Empate' },
                    { label:'Marcador',  value: `${modal.home?.name} ${form.golesHome} – ${form.golesAway} ${modal.away?.name}` },
                    { label:'Goleador',  value: form.goleadorId ? jugsModal.find(j=>j.id===form.goleadorId)?.name||'—' : 'Sin favorito' },
                  ].map(row => (
                    <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${S.border}` }}>
                      <span style={{ fontSize:'.8rem', color:S.muted }}>{row.label}</span>
                      <span style={{ fontSize:'.85rem', fontWeight:'700', color:S.text }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:'8px', marginTop:'20px' }}>
                    <button onClick={() => setStep(3)} style={{ flex:1, padding:'11px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.muted, fontWeight:'600', fontSize:'.875rem' }}>← Editar</button>
                    <button onClick={guardarPrediccion} disabled={guardando} style={{ flex:2, padding:'11px', background:S.win, border:'none', borderRadius:'10px', cursor: guardando?'not-allowed':'pointer', color:'#fff', fontWeight:'700', fontSize:'.875rem', opacity: guardando?.7:1 }}>
                      {guardando ? 'Guardando...' : '✅ CONFIRMAR'}
                    </button>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  {successAnim && <div style={{ fontSize:'3rem', marginBottom:'12px' }}>🎯</div>}
                  <div style={{ fontWeight:'700', fontSize:'1rem', color:S.cyan, marginBottom:'6px' }}>
                    {successAnim ? '¡Predicción guardada!' : 'Tu predicción'}
                  </div>
                  <div style={{ fontSize:'.85rem', color:S.muted }}>
                    {miscPreds[modal?.id]?.ganador === 'home' ? modal?.home?.name+' gana' : miscPreds[modal?.id]?.ganador === 'away' ? modal?.away?.name+' gana' : 'Empate'}
                    {' · '}{miscPreds[modal?.id]?.goles_home} – {miscPreds[modal?.id]?.goles_away}
                  </div>
                  {/* MVP del partido terminado */}
                  {modal?.mvp && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'12px', padding:'8px 14px', background:'rgba(249,168,37,.1)', border:'1px solid rgba(249,168,37,.3)', borderRadius:'10px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {modal.mvp.foto ? <img src={modal.mvp.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.8rem' }}>👤</span>}
                      </div>
                      <span style={{ fontSize:'.78rem', color:S.gold, fontWeight:'700' }}>⭐ MVP: {modal.mvp.nombre}</span>
                    </div>
                  )}
                  <button onClick={() => setModal(null)} style={{ marginTop:'20px', padding:'10px 28px', background:S.card, border:`1px solid ${S.border}`, borderRadius:'10px', cursor:'pointer', color:S.text, fontWeight:'600', fontSize:'.875rem' }}>Cerrar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'600px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <button onClick={() => navigate('/jugador')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', display:'flex', alignItems:'center', gap:'5px', width:'fit-content' }}>← Inicio</button>
            <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>Predix</div>
            <div style={{ fontWeight:'800', fontSize:'1.1rem', color:S.text }}>{player.name}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'1.8rem', fontWeight:'900', color:S.gold, lineHeight:1 }}>{misPuntos}</div>
            <div style={{ fontSize:'.65rem', color:S.muted }}>pts totales · #{miRanking || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'0 16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', padding:'12px 0', position:'sticky', top:0, background:S.navy, zIndex:10 }}>
          {[{ id:'pendientes', label:'Próximos' },{ id:'mias', label:'Mis predicciones' },{ id:'ranking', label:'Ranking' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', transition:'all .15s', background: tab===t.id ? S.cyan : S.card, color: tab===t.id ? '#000' : S.muted }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Próximos */}
        {tab === 'pendientes' && (
          <div>
            {torneosUnicos.length > 1 && (
              <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'8px', marginBottom:'12px', scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}>
                {[{ id:null, name:'Todos' }, ...torneosUnicos].map(t => (
                  <button key={t?.id||'all'} onClick={() => setTorneoFiltro(t?.id||null)}
                    style={{ flexShrink:0, padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer', fontWeight:'600', fontSize:'.75rem', whiteSpace:'nowrap', background: torneoFiltro===(t?.id||null) ? S.cyan : S.card, color: torneoFiltro===(t?.id||null) ? '#000' : S.muted }}>
                    {t?.name||'Todos'}
                  </button>
                ))}
              </div>
            )}
            {gruposPendientes.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:S.muted }}><div style={{ fontSize:'2rem', marginBottom:'12px' }}>🎯</div><div>No hay partidos pendientes</div></div>
            ) : gruposPendientes.map(grupo => {
              const tid = grupo.torneo?.id, isCollapsed = collapsed[tid]
              const hayPrediccion = grupo.partidos.some(p => miscPreds[p.id])
              return (
                <div key={tid} style={{ marginBottom:'16px', background:S.card, borderRadius:'16px', overflow:'hidden', border:`0.5px solid ${S.border}` }}>
                  <div onClick={() => toggleCollapse(tid)} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', background:S.card2, borderBottom: isCollapsed ? 'none' : `0.5px solid ${S.border}` }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'rgba(0,221,208,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><Trophy size={16} color={S.cyan}/></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:'700', fontSize:'.9rem', color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{grupo.torneo?.name || 'Torneo'}</div>
                      <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'1px' }}>
                        {grupo.torneo?.modalidad} · {grupo.partidos.length} partido{grupo.partidos.length!==1?'s':''}
                        {hayPrediccion && <span style={{ color:S.gold, marginLeft:'6px' }}>· {grupo.partidos.filter(p=>miscPreds[p.id]).length} predicción{grupo.partidos.filter(p=>miscPreds[p.id]).length!==1?'es':''}</span>}
                      </div>
                    </div>
                    {isCollapsed ? <ChevronDown size={18} color={S.muted}/> : <ChevronUp size={18} color={S.muted}/>}
                  </div>
                  {!isCollapsed && grupo.partidos.map((p, i) => {
                    const pred = miscPreds[p.id], pasado = p.played_at && new Date(p.played_at) <= new Date(), clickable = !pasado || !!pred
                    return (
                      <div key={p.id} style={{ borderTop: i>0 ? `0.5px solid ${S.border}` : 'none' }}>
                        <div style={{ padding:'10px 16px 0', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                          {p.matchday && <span style={{ fontSize:'.65rem', background:'rgba(0,221,208,.1)', color:S.cyan, borderRadius:'10px', padding:'1px 7px', fontWeight:'600' }}>J{p.matchday}</span>}
                          {p.played_at && <span style={{ fontSize:'.68rem', color:S.muted }}>📅 {new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})} {new Date(p.played_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</span>}
                          {p.location && <span style={{ fontSize:'.68rem', color:S.muted }}>📍 {p.location}</span>}
                          {pred && <span style={{ fontSize:'.65rem', color:S.gold, background:S.goldDim, borderRadius:'10px', padding:'1px 7px' }}>✓ Predicho</span>}
                          {pasado && !pred && <span style={{ fontSize:'.65rem', color:S.loss, background:S.lossDim, borderRadius:'10px', padding:'1px 7px' }}>Sin predicción</span>}
                        </div>
                        <div onClick={() => clickable && abrirModal(p)} style={{ padding:'10px 16px 12px', display:'flex', alignItems:'center', gap:'8px', cursor: clickable?'pointer':'default', opacity: pasado&&!pred ? 0.5 : 1 }}>
                          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end' }}>
                            <button onClick={e => { e.stopPropagation(); setTeamSheet({ teamId:p.home_team_id, teamName:p.home?.name, teamLogo:p.home?.logo_url, tournamentId:p.tournament_id, tournamentName:p.tournaments?.name }) }} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'4px 6px', borderRadius:'8px' }}>
                              <span style={{ fontWeight:'700', fontSize:'.88rem', color:S.text, textAlign:'right', textDecoration:'underline', textDecorationColor:'rgba(255,255,255,.15)', textUnderlineOffset:'3px' }}>{p.home?.name}</span>
                              <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <span style={{ fontSize:'.6rem', fontWeight:'800', color:'#fff' }}>{(p.home?.name||'?').substring(0,2).toUpperCase()}</span>}
                              </div>
                            </button>
                          </div>
                          <div style={{ flexShrink:0, background:S.card2, borderRadius:'8px', padding:'6px 10px', textAlign:'center', minWidth:'44px' }}>
                            {pred ? <div style={{ fontSize:'.8rem', fontWeight:'800', color:S.cyan }}>{pred.goles_home}–{pred.goles_away}</div> : <div style={{ fontSize:'.7rem', fontWeight:'700', color:S.muted }}>VS</div>}
                          </div>
                          <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px' }}>
                            <button onClick={e => { e.stopPropagation(); setTeamSheet({ teamId:p.away_team_id, teamName:p.away?.name, teamLogo:p.away?.logo_url, tournamentId:p.tournament_id, tournamentName:p.tournaments?.name }) }} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', padding:'4px 6px', borderRadius:'8px' }}>
                              <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/> : <span style={{ fontSize:'.6rem', fontWeight:'800', color:'#fff' }}>{(p.away?.name||'?').substring(0,2).toUpperCase()}</span>}
                              </div>
                              <span style={{ fontWeight:'700', fontSize:'.88rem', color:S.text, textDecoration:'underline', textDecorationColor:'rgba(255,255,255,.15)', textUnderlineOffset:'3px' }}>{p.away?.name}</span>
                            </button>
                          </div>
                        </div>
                        <div style={{ padding:'0 16px 10px', display:'flex', gap:'6px' }}>
                          <button onClick={e => { e.stopPropagation(); setTeamSheet({ teamId:p.home_team_id, teamName:p.home?.name, teamLogo:p.home?.logo_url, tournamentId:p.tournament_id, tournamentName:p.tournaments?.name }) }} style={{ fontSize:'.62rem', color:S.cyan, background:'rgba(0,221,208,.06)', border:`0.5px solid rgba(0,221,208,.2)`, borderRadius:'6px', padding:'2px 8px', cursor:'pointer' }}>📊 Stats {p.home?.name}</button>
                          <button onClick={e => { e.stopPropagation(); setTeamSheet({ teamId:p.away_team_id, teamName:p.away?.name, teamLogo:p.away?.logo_url, tournamentId:p.tournament_id, tournamentName:p.tournaments?.name }) }} style={{ fontSize:'.62rem', color:S.cyan, background:'rgba(0,221,208,.06)', border:`0.5px solid rgba(0,221,208,.2)`, borderRadius:'6px', padding:'2px 8px', cursor:'pointer' }}>📊 Stats {p.away?.name}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Mis predicciones */}
        {tab === 'mias' && (
          <div>
            {Object.keys(miscPreds).length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:S.muted }}><div style={{ fontSize:'2rem', marginBottom:'12px' }}>🎯</div><div>Aún no tienes predicciones</div></div>
            ) : terminados.filter(p => miscPreds[p.id]).concat(pendientes.filter(p => miscPreds[p.id])).map(p => {
              const pred = miscPreds[p.id], esTerminado = p.status === 'finished', acerto = pred.resuelta && pred.puntos_ganados > 0
              return (
                <div key={p.id} style={{ background:S.card, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', border:`0.5px solid ${pred.resuelta ? (acerto?S.win:S.border) : S.border}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <span style={{ fontSize:'.72rem', color:S.muted }}>{p.tournaments?.name}</span>
                    {pred.resuelta
                      ? <span style={{ fontSize:'.75rem', fontWeight:'800', color: acerto?S.gold:S.muted, background: acerto?S.goldDim:'rgba(154,160,166,.1)', borderRadius:'10px', padding:'2px 10px' }}>{acerto ? `+${pred.puntos_ganados} pts ✓` : '0 pts'}</span>
                      : <span style={{ fontSize:'.7rem', color:S.muted, background:S.card2, borderRadius:'10px', padding:'2px 8px' }}>Pendiente</span>}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'.85rem' }}>
                    <span style={{ flex:1, textAlign:'right', fontWeight:'600', color:S.text }}>{p.home?.name}</span>
                    <div style={{ background:S.card2, borderRadius:'8px', padding:'4px 10px', textAlign:'center', minWidth:'56px' }}>
                      {esTerminado
                        ? <span style={{ fontSize:'.9rem', fontWeight:'800', color:S.text }}>{p.home_score}–{p.away_score}</span>
                        : <span style={{ fontSize:'.75rem', color:S.cyan, fontWeight:'700' }}>{pred.goles_home}–{pred.goles_away}</span>}
                    </div>
                    <span style={{ flex:1, fontWeight:'600', color:S.text }}>{p.away?.name}</span>
                  </div>
                  {esTerminado && (() => {
                    // Calcular desglose de puntos
                    const resultadoReal = p.home_score > p.away_score ? 'home' : p.away_score > p.home_score ? 'away' : 'draw'
                    const acertoResultado = pred.ganador === resultadoReal
                    const acertoGolesHome = pred.goles_home === p.home_score
                    const acertoGolesAway = pred.goles_away === p.away_score
                    const acertoMarcador  = acertoGolesHome && acertoGolesAway
                    const acertoGoleador  = pred.goleador_id && p.mvp_goleador_id && pred.goleador_id === p.mvp_goleador_id
                    const ptsResultado = acertoResultado ? (resultadoReal==='draw' ? 5 : 3) : 0
                    const ptsMarcador  = acertoGolesHome ? 3 : 0
                    const ptsMarcador2 = acertoGolesAway ? 3 : 0
                    const ptsExacto    = acertoMarcador  ? 10 : 0
                    const ptsGoleador  = acertoGoleador  ? 2  : 0
                    const nombreGanador = pred.ganador==='home'?p.home?.name+' gana':pred.ganador==='away'?p.away?.name+' gana':'Empate'
                    return (
                      <div style={{ marginTop:'10px', background:S.navy, borderRadius:'10px', padding:'10px 12px', border:`0.5px solid ${S.border}` }}>
                        <div style={{ fontSize:'.68rem', fontWeight:'700', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Desglose de tu predicción</div>
                        <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:'6px' }}>
                          Predijiste: <span style={{ color:S.text, fontWeight:'600' }}>{pred.goles_home}–{pred.goles_away} · {nombreGanador}</span>
                        </div>
                        {[
                          { label: acertoResultado ? '✅ Resultado correcto' : '❌ Resultado incorrecto', pts: ptsResultado, detail: acertoResultado ? (resultadoReal==='draw'?'Empate vale más':'Ganador correcto') : `Era ${resultadoReal==='home'?p.home?.name:resultadoReal==='away'?p.away?.name:'Empate'}` },
                          { label: acertoGolesHome ? `✅ Goles ${p.home?.name} exactos` : `❌ Goles ${p.home?.name} incorrectos`, pts: ptsMarcador, detail: acertoGolesHome ? `Predijiste ${pred.goles_home} ✓` : `Predijiste ${pred.goles_home}, fueron ${p.home_score}` },
                          { label: acertoGolesAway ? `✅ Goles ${p.away?.name} exactos` : `❌ Goles ${p.away?.name} incorrectos`, pts: ptsMarcador2, detail: acertoGolesAway ? `Predijiste ${pred.goles_away} ✓` : `Predijiste ${pred.goles_away}, fueron ${p.away_score}` },
                          acertoMarcador ? { label: '🎯 Bonus marcador exacto', pts: ptsExacto, detail: 'Acertaste el marcador exacto' } : null,
                          pred.goleador_id ? { label: acertoGoleador ? '✅ Goleador correcto' : '❌ Goleador incorrecto', pts: ptsGoleador, detail: acertoGoleador ? `${pred.goleador?.name} anotó ✓` : `Predijiste ${pred.goleador?.name||'—'}` } : null,
                        ].filter(Boolean).map((row, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 0', borderTop: i>0?`0.5px solid ${S.border}`:'none' }}>
                            <div>
                              <div style={{ fontSize:'.72rem', color: row.pts>0?S.text:S.muted, fontWeight: row.pts>0?'600':'400' }}>{row.label}</div>
                              <div style={{ fontSize:'.65rem', color:S.muted }}>{row.detail}</div>
                            </div>
                            <span style={{ fontSize:'.82rem', fontWeight:'900', color: row.pts>0?S.gold:S.muted, minWidth:'40px', textAlign:'right' }}>
                              {row.pts>0 ? `+${row.pts}` : '—'}
                            </span>
                          </div>
                        ))}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'8px', paddingTop:'8px', borderTop:`1px solid ${S.border}` }}>
                          <span style={{ fontSize:'.75rem', fontWeight:'700', color:S.text }}>Total ganado</span>
                          <span style={{ fontSize:'1rem', fontWeight:'900', color: pred.puntos_ganados>0?S.gold:S.muted }}>{pred.puntos_ganados>0?`+${pred.puntos_ganados} pts`:'0 pts'}</span>
                        </div>
                      </div>
                    )
                  })()}
                  {/* MVP del partido */}
                  {esTerminado && p.mvp && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px', padding:'6px 10px', background:'rgba(249,168,37,.1)', border:'1px solid rgba(249,168,37,.3)', borderRadius:'8px' }}>
                      <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {p.mvp.foto ? <img src={p.mvp.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.75rem' }}>👤</span>}
                      </div>
                      <span style={{ fontSize:'.72rem', color:S.gold, fontWeight:'700' }}>⭐ MVP: {p.mvp.nombre}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Ranking */}
        {tab === 'ranking' && (
          <div>
            {ranking.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:S.muted }}><div style={{ fontSize:'2rem', marginBottom:'12px' }}>🏆</div><div>Sin datos de ranking aún</div></div>
            ) : ranking.map((r, i) => {
              const esYo = r.id === player.id
              return (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', background: esYo ? S.cyanDim : S.card, borderRadius:'12px', marginBottom:'8px', border: `0.5px solid ${esYo ? S.cyan : S.border}` }}>
                  <div style={{ width:'28px', fontWeight:'900', fontSize:'.9rem', textAlign:'center', flexShrink:0, color: i===0?S.gold : i===1?'#9aa0a6' : i===2?'#cd7f32' : S.muted }}>
                    {i===0 ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : `#${i+1}`}
                  </div>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {r.foto ? <img src={r.foto} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.9rem' }}>👤</span>}
                  </div>
                  <span style={{ flex:1, fontWeight: esYo?'800':'500', color: esYo?S.cyan:S.text, fontSize:'.875rem' }}>
                    {r.nombre} {esYo && <span style={{ fontSize:'.68rem', color:S.muted }}>(tú)</span>}
                  </span>
                  <span style={{ fontWeight:'900', fontSize:'1.1rem', color:S.gold }}>{r.puntos}</span>
                  <span style={{ fontSize:'.65rem', color:S.muted }}>pts</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
