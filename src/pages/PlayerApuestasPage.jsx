import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy:     '#07070e',
  surface:  '#0d1117',
  card:     '#111827',
  card2:    '#1a2234',
  border:   '#1e2d3d',
  cyan:     '#00ddd0',
  cyanDim:  'rgba(0,221,208,.12)',
  gold:     '#f9a825',
  goldDim:  'rgba(249,168,37,.1)',
  win:      '#1e8e3e',
  winDim:   'rgba(30,142,62,.1)',
  loss:     '#d93025',
  text:     '#e8f4fd',
  text2:    '#b8d4e8',
  muted:    '#7a9ab5',
}

const PUNTOS = {
  ganador: 3,
  empate:  5,
  golesExactosCada: 3,
  bonusExacto: 10,
  goleador: 2,
}

function maxPuntos(isDraw) {
  return isDraw
    ? PUNTOS.empate + PUNTOS.golesExactosCada * 2 + PUNTOS.bonusExacto + PUNTOS.goleador
    : PUNTOS.ganador + PUNTOS.golesExactosCada * 2 + PUNTOS.bonusExacto + PUNTOS.goleador
}

export default function PlayerApuestasPage() {
  const navigate = useNavigate()
  const [player,    setPlayer]    = useState(null)
  const [partidos,  setPartidos]  = useState([])
  const [jugadores, setJugadores] = useState([])
  const [miscPreds, setMiscPreds] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('pendientes')
  const [modal,     setModal]     = useState(null)
  const [step,      setStep]      = useState(1)
  const [form,      setForm]      = useState({ ganador: null, golesHome: 0, golesAway: 0, goleadorId: null })
  const [guardando, setGuardando] = useState(false)
  const [successAnim, setSuccessAnim] = useState(false)
  const [ranking,   setRanking]   = useState([])
  const [misPuntos, setMisPuntos] = useState(0)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.activo_membresia) { navigate('/jugador'); return }
    setPlayer(p)

    const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pts } = await supabase
      .from('matches')
      .select('*, home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url), tournaments(name,modalidad)')
      .gte('played_at', hace7)
      .order('played_at', { ascending: true })
    setPartidos(pts || [])

    const { data: preds } = await supabase
      .from('predicciones')
      .select('*, goleador:goleador_id(name)')
      .eq('player_id', p.id)
    const predMap = {}
    ;(preds || []).forEach(pr => { predMap[pr.match_id] = pr })
    setMiscPreds(predMap)

    const total = (preds || []).reduce((s, pr) => s + (pr.puntos_ganados || 0), 0)
    setMisPuntos(total)

    const { data: jugs } = await supabase
      .from('tournament_player_registrations')
      .select('*, players(id,name,photo_url)')
      .eq('activo', true)
    setJugadores(jugs || [])

    const { data: allPreds } = await supabase
      .from('predicciones')
      .select('player_id, puntos_ganados, players(name, photo_face_url, photo_url)')
    const rankMap = {}
    ;(allPreds || []).forEach(pr => {
      if (!rankMap[pr.player_id]) rankMap[pr.player_id] = { nombre: pr.players?.name, foto: pr.players?.photo_face_url || pr.players?.photo_url, puntos: 0 }
      rankMap[pr.player_id].puntos += pr.puntos_ganados || 0
    })
    const rank = Object.entries(rankMap).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.puntos - a.puntos)
    setRanking(rank)
    setLoading(false)
  }

  function abrirModal(partido) {
    // Verificar si el partido ya empezó
    if (partido.played_at && new Date(partido.played_at) <= new Date()) {
      if (!miscPreds[partido.id]) return
    }
    const pred = miscPreds[partido.id]
    if (pred) {
      setForm({ ganador: pred.ganador, golesHome: pred.goles_home, golesAway: pred.goles_away, goleadorId: pred.goleador_id })
      setStep(5)
    } else {
      setForm({ ganador: null, golesHome: 0, golesAway: 0, goleadorId: null })
      setStep(1)
    }
    setSuccessAnim(false)
    setModal(partido)
  }

  async function guardarPrediccion() {
    if (!form.ganador || form.goleadorId === null) return
    setGuardando(true)
    const pred = miscPreds[modal.id]
    const data = {
      player_id:   player.id,
      match_id:    modal.id,
      ganador:     form.ganador,
      goles_home:  form.golesHome,
      goles_away:  form.golesAway,
      goleador_id: form.goleadorId,
    }
    if (pred) {
      await supabase.from('predicciones').update(data).eq('id', pred.id)
    } else {
      await supabase.from('predicciones').insert(data)
    }
    setGuardando(false)
    setSuccessAnim(true)
    setStep(5)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.cyan, fontSize: '.9rem' }}>
      Cargando...
    </div>
  )

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const miRanking  = ranking.findIndex(r => r.id === player?.id) + 1

  const jugsModal = modal ? jugadores
    .filter(j => j.tournament_id === modal.tournament_id && (j.team_id === modal.home_team_id || j.team_id === modal.away_team_id))
    .map(j => j.players).filter(Boolean) : []

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'system-ui, sans-serif', color: S.text }}>

      {/* ── MODAL PREDICCIÓN ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: S.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `0.5px solid ${S.border}` }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: `0.5px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '.95rem', color: S.text }}>{modal.home?.name} vs {modal.away?.name}</div>
                <div style={{ fontSize: '.72rem', color: S.muted, marginTop: '2px' }}>{modal.tournaments?.name} · {modal.tournaments?.modalidad}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            {/* Steps */}
            {step < 5 && (
              <div style={{ padding: '12px 20px', borderBottom: `0.5px solid ${S.border}`, display: 'flex', gap: '6px', flexShrink: 0 }}>
                {['Resultado', 'Marcador', 'Goleador', 'Confirmar'].map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', fontSize: '.7rem', fontWeight: '700',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step > i + 1 ? S.win : step === i + 1 ? S.cyan : S.border,
                      color: step > i + 1 || step === i + 1 ? '#000' : S.muted,
                    }}>{step > i + 1 ? '✓' : i + 1}</div>
                    <div style={{ fontSize: '.6rem', color: step === i + 1 ? S.cyan : S.muted }}>{s}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Contenido */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* PASO 1 — Ganador */}
              {step === 1 && (
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: '600', color: S.text, marginBottom: '14px' }}>¿Quién gana?</div>
                  {[
                    { val: 'home', label: modal.home?.name, pts: PUNTOS.ganador },
                    { val: 'draw', label: 'Empate',         pts: PUNTOS.empate  },
                    { val: 'away', label: modal.away?.name, pts: PUNTOS.ganador },
                  ].map(opt => (
                    <div key={opt.val} onClick={() => setForm(f => ({ ...f, ganador: opt.val }))}
                      style={{
                        padding: '14px 16px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
                        border: `1px solid ${form.ganador === opt.val ? S.cyan : S.border}`,
                        background: form.ganador === opt.val ? S.cyanDim : S.card,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all .15s',
                      }}>
                      <span style={{ fontWeight: '600', color: form.ganador === opt.val ? S.cyan : S.text, fontSize: '.875rem' }}>{opt.label}</span>
                      <span style={{ fontSize: '.72rem', color: S.gold, fontWeight: '700', background: S.goldDim, borderRadius: '20px', padding: '2px 8px' }}>+{opt.pts} pts</span>
                    </div>
                  ))}
                  <button disabled={!form.ganador} onClick={() => setStep(2)}
                    style={{ width: '100%', marginTop: '12px', padding: '12px', background: form.ganador ? S.cyan : S.border, border: 'none', borderRadius: '10px', cursor: form.ganador ? 'pointer' : 'not-allowed', color: form.ganador ? '#000' : S.muted, fontWeight: '700', fontSize: '.875rem' }}>
                    CONTINUAR →
                  </button>
                </div>
              )}

              {/* PASO 2 — Marcador */}
              {step === 2 && (
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: '600', color: S.text, marginBottom: '16px' }}>¿Cuál será el marcador?</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', marginBottom: '20px' }}>
                    {[0, 1].map(team => (
                      <div key={team} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '.75rem', color: S.muted, textAlign: 'center' }}>{team === 0 ? modal.home?.name : modal.away?.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <button onClick={() => setForm(f => ({ ...f, [team === 0 ? 'golesHome' : 'golesAway']: Math.max(0, (team === 0 ? f.golesHome : f.golesAway) - 1) }))}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${S.border}`, background: S.card, color: S.text, cursor: 'pointer', fontSize: '1.2rem', fontWeight: '700' }}>−</button>
                          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: S.cyan, minWidth: '36px', textAlign: 'center' }}>{team === 0 ? form.golesHome : form.golesAway}</div>
                          <button onClick={() => setForm(f => ({ ...f, [team === 0 ? 'golesHome' : 'golesAway']: Math.min(9, (team === 0 ? f.golesHome : f.golesAway) + 1) }))}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: `1px solid ${S.border}`, background: S.card, color: S.text, cursor: 'pointer', fontSize: '1.2rem', fontWeight: '700' }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '.75rem', color: S.muted, marginBottom: '16px' }}>
                    Marcador exacto: <span style={{ color: S.gold, fontWeight: '700' }}>+{PUNTOS.golesExactosCada * 2 + PUNTOS.bonusExacto} pts bonus</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontWeight: '600', fontSize: '.875rem' }}>← Volver</button>
                    <button onClick={() => setStep(3)} style={{ flex: 2, padding: '11px', background: S.cyan, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#000', fontWeight: '700', fontSize: '.875rem' }}>CONTINUAR →</button>
                  </div>
                </div>
              )}

              {/* PASO 3 — Goleador */}
              {step === 3 && (
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: '600', color: S.text, marginBottom: '12px' }}>
                    ¿Quién anota? <span style={{ color: S.gold, fontSize: '.72rem' }}>+{PUNTOS.goleador} pts</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                    {jugsModal.length === 0 ? (
                      <div style={{ color: S.muted, fontSize: '.8rem', textAlign: 'center', padding: '20px' }}>Sin jugadores registrados en este partido</div>
                    ) : jugsModal.map(j => (
                      <div key={j.id} onClick={() => setForm(f => ({ ...f, goleadorId: j.id }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${form.goleadorId === j.id ? S.cyan : S.border}`, background: form.goleadorId === j.id ? S.cyanDim : S.card, transition: 'all .15s' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: S.border, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {j.photo_url ? <img src={j.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.8rem' }}>👤</span>}
                        </div>
                        <span style={{ fontSize: '.85rem', fontWeight: form.goleadorId === j.id ? '700' : '500', color: form.goleadorId === j.id ? S.cyan : S.text }}>{j.name}</span>
                        {form.goleadorId === j.id && <span style={{ marginLeft: 'auto', color: S.cyan }}>✓</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontWeight: '600', fontSize: '.875rem' }}>← Volver</button>
                    <button disabled={!form.goleadorId} onClick={() => setStep(4)}
                      style={{ flex: 2, padding: '11px', background: form.goleadorId ? S.cyan : S.border, border: 'none', borderRadius: '10px', cursor: form.goleadorId ? 'pointer' : 'not-allowed', color: form.goleadorId ? '#000' : S.muted, fontWeight: '700', fontSize: '.875rem' }}>
                      CONTINUAR →
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 4 — Confirmar */}
              {step === 4 && (
                <div>
                  <div style={{ fontSize: '.82rem', fontWeight: '600', color: S.text, marginBottom: '16px' }}>Confirma tu predicción</div>
                  {[
                    { label: 'Resultado', value: form.ganador === 'home' ? modal.home?.name + ' gana' : form.ganador === 'away' ? modal.away?.name + ' gana' : 'Empate' },
                    { label: 'Marcador',  value: `${modal.home?.name} ${form.golesHome} - ${form.golesAway} ${modal.away?.name}` },
                    { label: 'Goleador',  value: jugsModal.find(j => j.id === form.goleadorId)?.name || '—' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `0.5px solid ${S.border}` }}>
                      <span style={{ fontSize: '.78rem', color: S.muted }}>{row.label}</span>
                      <span style={{ fontSize: '.85rem', fontWeight: '600', color: S.text }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: '14px', padding: '14px', background: S.goldDim, borderRadius: '12px', border: `0.5px solid ${S.gold}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '.78rem', color: S.gold }}>Máximo posible</span>
                    <span style={{ fontWeight: '800', color: S.gold, fontSize: '1.2rem' }}>+{maxPuntos(form.ganador === 'draw')} pts</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={() => setStep(3)} style={{ flex: 1, padding: '11px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.muted, fontWeight: '600', fontSize: '.875rem' }}>← Volver</button>
                    <button onClick={guardarPrediccion} disabled={guardando}
                      style={{ flex: 2, padding: '11px', background: S.win, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: guardando ? .7 : 1 }}>
                      {guardando ? 'Guardando...' : '✓ CONFIRMAR PREDICCIÓN'}
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 5 — Éxito / Resumen */}
              {step === 5 && (
                <div style={{ textAlign: 'center', paddingTop: '8px' }}>
                  {successAnim && <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎯</div>}
                  <div style={{ fontWeight: '700', color: S.cyan, fontSize: '1.1rem', marginBottom: '4px' }}>
                    {successAnim ? '¡Predicción guardada!' : 'Tu predicción'}
                  </div>
                  <div style={{ fontSize: '.75rem', color: S.muted, marginBottom: '20px' }}>
                    {successAnim ? 'Los puntos se acreditarán cuando termine el partido' : 'Ya tienes una predicción para este partido'}
                  </div>
                  {[
                    { label: 'Resultado', value: form.ganador === 'home' ? modal.home?.name + ' gana' : form.ganador === 'away' ? modal.away?.name + ' gana' : 'Empate' },
                    { label: 'Marcador',  value: `${form.golesHome} - ${form.golesAway}` },
                    { label: 'Goleador',  value: jugsModal.find(j => j.id === form.goleadorId)?.name || '—' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${S.border}` }}>
                      <span style={{ fontSize: '.78rem', color: S.muted }}>{row.label}</span>
                      <span style={{ fontSize: '.85rem', fontWeight: '600', color: S.text }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setStep(1); setSuccessAnim(false) }}
                      style={{ flex: 1, padding: '11px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', cursor: 'pointer', color: S.text, fontSize: '.85rem', fontWeight: '500' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => setModal(null)}
                      style={{ flex: 1, padding: '11px', background: S.cyan, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#000', fontSize: '.85rem', fontWeight: '700' }}>
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: S.card, borderBottom: `0.5px solid ${S.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/jugador')}
            style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: S.muted, fontSize: '.75rem' }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: S.cyan, letterSpacing: '2px' }}>PREDIX</div>
            <div style={{ fontSize: '.65rem', color: S.muted }}>Predicciones GOLMEBOL</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {miRanking > 0 && (
            <div style={{ padding: '4px 10px', background: S.goldDim, border: `0.5px solid ${S.gold}`, borderRadius: '20px' }}>
              <span style={{ fontSize: '.72rem', color: S.gold, fontWeight: '700' }}>#{miRanking} Ranking</span>
            </div>
          )}
          <div style={{ padding: '4px 12px', background: S.cyanDim, border: `0.5px solid ${S.cyan}`, borderRadius: '20px' }}>
            <span style={{ fontSize: '.78rem', color: S.cyan, fontWeight: '700' }}>{misPuntos} pts</span>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px', background: S.navy, borderBottom: `0.5px solid ${S.border}`, position: 'sticky', top: '52px', zIndex: 40 }}>
        {[
          { id: 'pendientes', label: `Próximos (${pendientes.length})` },
          { id: 'mis',        label: 'Mis predicciones' },
          { id: 'ranking',    label: '🏆 Ranking' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: `0.5px solid ${tab === t.id ? S.cyan : S.border}`, background: tab === t.id ? S.cyan : 'transparent', color: tab === t.id ? '#000' : S.muted, fontSize: '.78rem', fontWeight: tab === t.id ? '700' : '400', cursor: 'pointer', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>

        {/* PRÓXIMOS */}
        {tab === 'pendientes' && (
          <div>
            {pendientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: S.muted }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                <div>No hay partidos próximos</div>
              </div>
            ) : pendientes.map(p => {
              const pred = miscPreds[p.id]
              return (
                <div key={p.id} onClick={() => abrirModal(p)}
                  style={{ background: S.card, border: `0.5px solid ${pred ? S.cyan : S.border}`, borderRadius: '14px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all .18s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = S.cyan}
                  onMouseLeave={e => e.currentTarget.style.borderColor = pred ? S.cyan : S.border}>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '.68rem', color: S.muted }}>{p.tournaments?.name} · {p.tournaments?.modalidad}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {pred && <span style={{ fontSize: '.65rem', color: S.cyan, background: S.cyanDim, borderRadius: '20px', padding: '2px 8px', fontWeight: '700' }}>✓ Enviada</span>}
                      <span style={{ fontSize: '.65rem', color: S.gold, background: S.goldDim, borderRadius: '4px', padding: '2px 8px', fontWeight: '700' }}>
                        {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : 'Sin fecha'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: S.border, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {p.home?.logo_url ? <img src={p.home.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span>⚽</span>}
                      </div>
                      <span style={{ fontWeight: '600', fontSize: '.875rem', color: S.text }}>{p.home?.name}</span>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 12px', flexShrink: 0 }}>
                      <div style={{ fontSize: '.72rem', color: S.muted, fontWeight: '700' }}>VS</div>
                      <div style={{ fontSize: '.62rem', color: S.gold, marginTop: '2px' }}>+{maxPuntos(false)} pts</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                      <span style={{ fontWeight: '600', fontSize: '.875rem', color: S.text }}>{p.away?.name}</span>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: S.border, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {p.away?.logo_url ? <img src={p.away.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span>⚽</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  {(() => {
  const ahora = new Date()
  const fechaPartido = p.played_at ? new Date(p.played_at) : null
  const yaEmpezó = fechaPartido && fechaPartido <= ahora
  const diff = fechaPartido ? fechaPartido - ahora : null
  const horas = diff ? Math.floor(diff / 3600000) : null
  const mins  = diff ? Math.floor((diff % 3600000) / 60000) : null

  if (yaEmpezó && !pred) {
    return <span style={{ fontSize: '.72rem', color: S.loss }}>⛔ Predicción cerrada</span>
  }
  if (!yaEmpezó && diff && diff < 3600000) {
    return <span style={{ fontSize: '.72rem', color: S.gold }}>⏰ Cierra en {mins} min · {pred ? 'Ver predicción →' : 'Predecir →'}</span>
  }
  if (!yaEmpezó && diff && diff < 86400000) {
    return <span style={{ fontSize: '.72rem', color: pred ? S.cyan : S.muted }}>⏰ Cierra en {horas}h {mins}min · {pred ? 'Ver →' : 'Predecir →'}</span>
  }
  return <span style={{ fontSize: '.72rem', color: pred ? S.cyan : S.muted }}>{pred ? 'Toca para ver o editar →' : 'Toca para predecir →'}</span>
})()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* MIS PREDICCIONES */}
        {tab === 'mis' && (
          <div>
            {Object.keys(miscPreds).length === 0 ? (
  <div style={{ textAlign: 'center', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
    <div style={{ fontSize: '3rem' }}>🎯</div>
    <div style={{ fontWeight: '700', color: S.text, fontSize: '1rem' }}>Aún no has predicho nada</div>
    <div style={{ fontSize: '.8rem', color: S.muted, maxWidth: '260px', lineHeight: 1.5 }}>
      Predice los resultados de los próximos partidos y gana puntos para subir en el ranking
    </div>
    <button onClick={() => setTab('pendientes')}
      style={{ marginTop: '8px', padding: '12px 28px', background: S.cyan, border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#000', fontWeight: '800', fontSize: '.875rem', letterSpacing: '.5px' }}>
      🎮 VER PARTIDOS →
    </button>
  </div>
            ) : partidos.map(p => {
              const pred = miscPreds[p.id]
              if (!pred) return null
              const ganador = pred.ganador === 'home' ? p.home?.name + ' gana' : pred.ganador === 'away' ? p.away?.name + ' gana' : 'Empate'
              return (
                <div key={p.id} style={{ background: S.card, border: `0.5px solid ${pred.resuelta ? (pred.puntos_ganados > 0 ? S.win : S.border) : S.border}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '600', fontSize: '.875rem', color: S.text }}>{p.home?.name} vs {p.away?.name}</div>
                    {pred.resuelta
                      ? <span style={{ fontSize: '.75rem', fontWeight: '700', color: pred.puntos_ganados > 0 ? S.gold : S.muted, background: pred.puntos_ganados > 0 ? S.goldDim : 'transparent', borderRadius: '20px', padding: '2px 10px' }}>
                          {pred.puntos_ganados > 0 ? `+${pred.puntos_ganados} pts` : '0 pts'}
                        </span>
                      : <span style={{ fontSize: '.65rem', color: S.muted, background: S.card, border: `0.5px solid ${S.border}`, borderRadius: '20px', padding: '2px 10px' }}>Pendiente</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '.78rem', color: S.text2 }}>
                    <span>🏆 {ganador}</span>
                    <span>⚽ {pred.goles_home} - {pred.goles_away}</span>
                  </div>
                  {p.status === 'finished' && (
                    <div style={{ marginTop: '8px', fontSize: '.72rem', color: S.muted }}>
                      Resultado real: <span style={{ color: S.text, fontWeight: '600' }}>{p.home_score} - {p.away_score}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* RANKING */}
        {tab === 'ranking' && (
          <div>
            <div style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', padding: '10px 16px', background: S.navy, borderBottom: `0.5px solid ${S.border}`, fontSize: '.68rem', fontWeight: '700', color: S.muted, letterSpacing: '.06em' }}>
                <div>#</div><div>JUGADOR</div><div style={{ textAlign: 'center', color: S.gold }}>PUNTOS</div>
              </div>
              {ranking.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: S.muted, fontSize: '.875rem' }}>Sin predicciones aún</div>
              ) : ranking.map((r, i) => {
                const esYo = r.id === player?.id
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', padding: '12px 16px', borderBottom: `0.5px solid ${S.border}`, alignItems: 'center', background: esYo ? S.cyanDim : 'transparent', borderLeft: esYo ? `3px solid ${S.cyan}` : '3px solid transparent' }}>
                    <div style={{ fontSize: '.85rem', fontWeight: '700', color: i === 0 ? S.gold : i === 1 ? S.text2 : i === 2 ? '#cd7f32' : S.muted }}>{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: S.border, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {r.foto ? <img src={r.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ fontSize: '.75rem' }}>👤</span>}
                      </div>
                      <span style={{ fontSize: '.85rem', fontWeight: esYo ? '700' : '500', color: esYo ? S.cyan : S.text }}>{r.nombre} {esYo && '(tú)'}</span>
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '700', fontSize: '.95rem', color: i === 0 ? S.gold : S.text }}>{r.puntos}</div>
                  </div>
                )
              })}
            </div>

            {/* Sistema de puntos */}
            <div style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: '14px', padding: '16px' }}>
              <div style={{ fontSize: '.82rem', fontWeight: '700', color: S.text, marginBottom: '12px' }}>📋 Sistema de puntos</div>
              {[
                { label: 'Acertar el ganador',                  pts: PUNTOS.ganador },
                { label: 'Acertar empate (bonus especial)',      pts: PUNTOS.empate },
                { label: 'Goles exactos local o visitante',     pts: PUNTOS.golesExactosCada },
                { label: 'Bonus marcador exacto completo',      pts: PUNTOS.bonusExacto },
                { label: 'Goleador correcto',                   pts: PUNTOS.goleador },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${S.border}` }}>
                  <span style={{ fontSize: '.78rem', color: S.text2 }}>{r.label}</span>
                  <span style={{ fontSize: '.82rem', fontWeight: '700', color: S.gold }}>+{r.pts} pts</span>
                </div>
              ))}
              <div style={{ marginTop: '10px', fontSize: '.72rem', color: S.muted }}>
                Máximo: <span style={{ color: S.gold, fontWeight: '700' }}>{maxPuntos(false)} pts</span> sin empate · <span style={{ color: S.gold, fontWeight: '700' }}>{maxPuntos(true)} pts</span> con empate
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
