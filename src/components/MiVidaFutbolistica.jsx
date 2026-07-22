import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const S = {
  card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)', gold: '#f9a825',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', win: '#1e8e3e', loss: '#d93025',
}
const EV_ICONS = { goal: '⚽', assist: '🎯', yellow: '🟨', blue: '🟦', red: '🟥', sub: '🔄', highlight: '⭐', injury: '🩹', mvp: '👑', note: '📝', save: '🧤', goal_against: '🥅' }

function fmtFecha(f) {
  if (!f) return ''
  const d = new Date(f + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Stat({ label, valor, color }) {
  return (
    <div style={{ background: S.card2, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: color || S.cyan }}>{valor}</div>
      <div style={{ fontSize: '.6rem', color: S.muted, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function FilaPartido({ ps, jugadorId }) {
  const [abierto, setAbierto] = useState(false)
  const p = ps.partido
  if (!p) return null
  const resultado = p.score_home > p.score_away ? 'G' : p.score_home < p.score_away ? 'P' : 'E'
  const colorRes = resultado === 'G' ? S.win : resultado === 'P' ? S.loss : S.muted
  const misEventos = (p.eventos || []).filter(e => e.playerId === jugadorId)
  const esMvp = p.mvp?.first === jugadorId

  return (
    <div onClick={() => setAbierto(a => !a)} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '11px 14px', marginBottom: 8, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: colorRes, color: '#000', fontWeight: 900, fontSize: '.68rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{resultado}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>vs {p.rival || 'Rival'}</div>
            <div style={{ fontSize: '.68rem', color: S.muted }}>{fmtFecha(p.fecha)}{p.torneo ? ` · ${p.torneo}` : ''}</div>
          </div>
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: S.cyan, flexShrink: 0 }}>{p.score_home}-{p.score_away}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {ps.titular != null && (
          <span style={{ fontSize: '.62rem', fontWeight: 800, color: ps.titular ? S.gold : S.muted, background: ps.titular ? 'rgba(249,168,37,.15)' : 'rgba(255,255,255,.06)', borderRadius: 6, padding: '2px 7px' }}>
            {ps.titular ? '★ Titular' : 'Suplente'}
          </span>
        )}
        {ps.minutos != null && <span style={{ fontSize: '.62rem', fontWeight: 700, color: S.text2, background: 'rgba(255,255,255,.06)', borderRadius: 6, padding: '2px 7px' }}>⏱️ {ps.minutos}'</span>}
        {ps.calificacion != null && <span style={{ fontSize: '.62rem', fontWeight: 700, color: S.gold, background: 'rgba(249,168,37,.1)', borderRadius: 6, padding: '2px 7px' }}>📝 {ps.calificacion}</span>}
        {esMvp && <span style={{ fontSize: '.62rem', fontWeight: 800, color: S.gold, background: 'rgba(249,168,37,.15)', borderRadius: 6, padding: '2px 7px' }}>👑 MVP</span>}
      </div>
      {abierto && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
          {misEventos.length === 0 ? (
            <div style={{ fontSize: '.72rem', color: S.muted }}>Sin eventos anotados a tu nombre en este partido.</div>
          ) : misEventos.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 6, fontSize: '.74rem', padding: '3px 0' }}>
              <span style={{ color: S.cyan, fontFamily: 'monospace', minWidth: 26 }}>{e.min}'</span>
              <span>{EV_ICONS[e.type] || ''}</span>
              <span style={{ color: S.text2 }}>{e.desc || ''}</span>
            </div>
          ))}
          {p.observaciones && <div style={{ fontSize: '.72rem', color: S.text2, fontStyle: 'italic', marginTop: 8 }}>"{p.observaciones}"</div>}
        </div>
      )}
    </div>
  )
}

// Toda la "vida futbolística" del jugador de escuela: resumen acumulado,
// récord contra cada rival, goles con minuto, y el historial completo de
// partidos (cada uno expandible con sus propios eventos y la nota del
// profesor). Se apoya en escuela_partido_stats (una fila por jugador por
// partido) para saber en qué partidos jugó exactamente.
export default function MiVidaFutbolistica({ jugador }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => { if (jugador?.id) fetchTodo() }, [jugador?.id])

  async function fetchTodo() {
    setLoading(true)
    const { data } = await supabase.from('escuela_partido_stats')
      .select('*, partido:partido_id(rival, fecha, torneo, score_home, score_away, eventos, mvp, observaciones, estado)')
      .eq('jugador_id', jugador.id)
      .order('created_at', { ascending: false })
    const conPartido = (data || []).filter(r => r.partido && r.partido.estado === 'finalizado')
    setRegistros(conPartido)
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign: 'center', color: S.muted, padding: '20px', fontSize: '.85rem' }}>Cargando tu historial...</div>
  if (registros.length === 0) return null

  const pj = registros.length
  const pg = registros.filter(r => r.partido.score_home > r.partido.score_away).length
  const pe = registros.filter(r => r.partido.score_home === r.partido.score_away).length
  const pp = registros.filter(r => r.partido.score_home < r.partido.score_away).length
  const minutosTotales = registros.reduce((s, r) => s + (r.minutos || 0), 0)
  const vecesTitular = registros.filter(r => r.titular).length
  const vecesMvp = registros.filter(r => r.partido.mvp?.first === jugador.id).length

  const golesConMinuto = registros
    .flatMap(r => (r.partido.eventos || []).filter(e => e.type === 'goal' && e.playerId === jugador.id).map(e => ({ min: e.min, rival: r.partido.rival, fecha: r.partido.fecha })))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const porRival = {}
  registros.forEach(r => {
    const rival = r.partido.rival || 'Rival'
    if (!porRival[rival]) porRival[rival] = { g: 0, e: 0, p: 0 }
    if (r.partido.score_home > r.partido.score_away) porRival[rival].g++
    else if (r.partido.score_home < r.partido.score_away) porRival[rival].p++
    else porRival[rival].e++
  })

  const partidosAMostrar = verTodos ? registros : registros.slice(0, 6)

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 800, fontSize: '.95rem', color: S.cyan, marginBottom: 10 }}>⚽ Tu vida futbolística</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
        <Stat label="Jugados" valor={pj}/>
        <Stat label="Ganados" valor={pg} color={S.win}/>
        <Stat label="Empatados" valor={pe} color={S.muted}/>
        <Stat label="Perdidos" valor={pp} color={S.loss}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
        <Stat label="Min. jugados" valor={minutosTotales}/>
        <Stat label="De titular" valor={`${vecesTitular}/${pj}`}/>
        <Stat label="Veces MVP" valor={vecesMvp} color={S.gold}/>
        <Stat label="Goles" valor={jugador.goles_escuela || 0}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <Stat label="Asistencias" valor={jugador.asistencias_escuela || 0}/>
        <Stat label="Amarillas" valor={jugador.amarillas_escuela || 0} color="#f9d423"/>
        <Stat label="Rojas" valor={jugador.rojas_escuela || 0} color={S.loss}/>
        {jugador.posicion === 'Portero'
          ? <Stat label="Goles recibidos" valor={jugador.goles_recibidos_escuela || 0} color={S.loss}/>
          : <Stat label="Partidos" valor={jugador.partidos_escuela || 0}/>}
      </div>

      {golesConMinuto.length > 0 && (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: S.muted, marginBottom: 8, textTransform: 'uppercase' }}>⚽ Tus goles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {golesConMinuto.map((g, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: '.76rem' }}>
                <span style={{ color: S.cyan, fontFamily: 'monospace', minWidth: 30 }}>{g.min}'</span>
                <span style={{ color: S.text2 }}>vs {g.rival} · {fmtFecha(g.fecha)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(porRival).length > 0 && (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: S.muted, marginBottom: 8, textTransform: 'uppercase' }}>🆚 Contra cada rival</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(porRival).map(([rival, r]) => (
              <div key={rival} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.78rem' }}>
                <span style={{ color: S.text }}>{rival}</span>
                <span style={{ color: S.text2 }}>
                  <b style={{ color: S.win }}>{r.g}G</b> · <b style={{ color: S.muted }}>{r.e}E</b> · <b style={{ color: S.loss }}>{r.p}P</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: '.72rem', fontWeight: 700, color: S.muted, marginBottom: 8, textTransform: 'uppercase' }}>📆 Historial de partidos</div>
      {partidosAMostrar.map(r => <FilaPartido key={r.id} ps={r} jugadorId={jugador.id}/>)}
      {registros.length > 6 && (
        <button onClick={() => setVerTodos(v => !v)} style={{ width: '100%', padding: '9px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 10, cursor: 'pointer', color: S.cyan, fontSize: '.78rem', fontWeight: 700 }}>
          {verTodos ? 'Ver menos' : `Ver todos (${registros.length})`}
        </button>
      )}
    </div>
  )
}
