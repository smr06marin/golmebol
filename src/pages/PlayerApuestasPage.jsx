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

// ── Duelos 1v1 (retar a un jugador puntual apostando puntos de Predix) ──
// Quema creciente en revanchas: entre el mismo par de jugadores, el primer
// duelo el ganador se queda con 50% del monto del rival, el segundo 30%,
// del tercero en adelante 10%. Así no compensa usar siempre al mismo
// "compinche" para transferir puntos de forma repetida.
const FACTOR_DUELO = { 1: 0.5, 2: 0.3 }
function factorRepeticion(n) { return FACTOR_DUELO[n] ?? 0.1 }

function resultadoRealPartido(p) {
  if (!p || p.status !== 'finished' || p.home_score == null || p.away_score == null) return null
  if (p.home_score === p.away_score) {
    if (p.penales_ganador === 'home') return 'local'
    if (p.penales_ganador === 'away') return 'visitante'
    return 'empate'
  }
  return p.home_score > p.away_score ? 'local' : 'visitante'
}
function huboPenalesPartido(p) { return p && p.home_score === p.away_score && !!p.penales_ganador }

// Cuántos duelos aceptados y ya resueltos hubo antes entre este mismo par
// de jugadores (sin importar quién retó a quién) — determina el factor.
function repeticionParaDuelo(duelo, duelos, partidos) {
  const par = [duelo.retador_id, duelo.retado_id].sort().join('|')
  const anteriores = (duelos || []).filter(d => {
    if (d.estado !== 'aceptado' || d.id === duelo.id) return false
    if ([d.retador_id, d.retado_id].sort().join('|') !== par) return false
    const partido = partidos.find(pp => pp.id === d.match_id)
    if (!partido || partido.status !== 'finished') return false
    return new Date(d.created_at) < new Date(duelo.created_at)
  })
  return anteriores.length + 1
}

// Neto de puntos para retador y retado de un duelo (0 si aún no se puede resolver).
function calcularDuelo(duelo, partidos, duelos) {
  const partido = partidos.find(p => p.id === duelo.match_id)
  if (!partido || partido.status !== 'finished') return { retador: 0, retado: 0, estado: 'pendiente' }
  const real = resultadoRealPartido(partido)
  if (real === null) return { retador: 0, retado: 0, estado: 'pendiente' }
  if (real === 'empate') return { retador: -0.2 * duelo.monto, retado: -0.2 * duelo.monto, estado: 'empate' }
  const factor = huboPenalesPartido(partido) ? 0.5 : factorRepeticion(repeticionParaDuelo(duelo, duelos, partidos))
  const ganaRetador = duelo.retador_equipo === real
  return ganaRetador
    ? { retador: factor * duelo.monto, retado: -duelo.monto, estado: 'resuelto' }
    : { retador: -duelo.monto, retado: factor * duelo.monto, estado: 'resuelto' }
}

function saldoPredicciones(playerId, allPreds) {
  return (allPreds || []).filter(pr => pr.player_id === playerId).reduce((s, pr) => s + (pr.puntos_ganados || 0), 0)
}

function netoDuelosResueltos(playerId, duelos, partidos) {
  let neto = 0
  ;(duelos || []).filter(d => d.estado === 'aceptado' && (d.retador_id === playerId || d.retado_id === playerId)).forEach(d => {
    const r = calcularDuelo(d, partidos, duelos)
    if (r.estado === 'pendiente') return
    neto += d.retador_id === playerId ? r.retador : r.retado
  })
  return neto
}

function comprometidoEnDuelos(playerId, duelos, partidos) {
  return (duelos || []).filter(d => {
    if (d.estado !== 'pendiente' && d.estado !== 'aceptado') return false
    if (d.retador_id !== playerId && d.retado_id !== playerId) return false
    if (d.estado === 'aceptado') {
      const partido = partidos.find(p => p.id === d.match_id)
      if (partido && partido.status === 'finished') return false
    }
    return true
  }).reduce((s, d) => s + d.monto, 0)
}

// Un jugador no puede ser retado en un partido donde él mismo esté jugando
// (para no darle motivo a manipular el resultado real).
function jugadorJuegaEnPartido(playerId, partido, registros) {
  return (registros || []).some(j => j.players?.id === playerId && (j.team_id === partido.home_team_id || j.team_id === partido.away_team_id))
}

// ── Apuestas abiertas (mercado) ──
// Igual que un duelo directo, pero en vez de retar a alguien puntual, se
// deja la apuesta abierta y se cruza sola contra quien le meta puntos al
// equipo contrario (parcial permitido, como en Predix Apuestas 1x1).
function repeticionParaCruce(cruce, cruces, posturas, partidos) {
  const posturaA = posturas.find(p => p.id === cruce.postura_a_id)
  const posturaB = posturas.find(p => p.id === cruce.postura_b_id)
  if (!posturaA || !posturaB) return 1
  const par = [posturaA.player_id, posturaB.player_id].sort().join('|')
  const anteriores = (cruces || []).filter(c => {
    if (c.id === cruce.id) return false
    const a = posturas.find(p => p.id === c.postura_a_id)
    const b = posturas.find(p => p.id === c.postura_b_id)
    if (!a || !b) return false
    if ([a.player_id, b.player_id].sort().join('|') !== par) return false
    const partido = partidos.find(pp => pp.id === c.match_id)
    if (!partido || partido.status !== 'finished') return false
    return new Date(c.created_at) < new Date(cruce.created_at)
  })
  return anteriores.length + 1
}

function calcularCrucePostura(cruce, posturas, cruces, partidos) {
  const partido = partidos.find(p => p.id === cruce.match_id)
  if (!partido || partido.status !== 'finished') return { a: 0, b: 0, estado: 'pendiente' }
  const real = resultadoRealPartido(partido)
  if (real === null) return { a: 0, b: 0, estado: 'pendiente' }
  const posturaA = posturas.find(p => p.id === cruce.postura_a_id)
  const posturaB = posturas.find(p => p.id === cruce.postura_b_id)
  if (!posturaA || !posturaB) return { a: 0, b: 0, estado: 'pendiente' }
  if (real === 'empate') return { a: -0.2 * cruce.monto, b: -0.2 * cruce.monto, estado: 'empate' }
  const factor = huboPenalesPartido(partido) ? 0.5 : factorRepeticion(repeticionParaCruce(cruce, cruces, posturas, partidos))
  const aGana = posturaA.equipo === real
  return aGana
    ? { a: factor * cruce.monto, b: -cruce.monto, estado: 'resuelto' }
    : { a: -cruce.monto, b: factor * cruce.monto, estado: 'resuelto' }
}

function netoPostura(postura, cruces, posturas, partidos) {
  let neto = 0
  ;(cruces || []).filter(c => c.postura_a_id === postura.id || c.postura_b_id === postura.id).forEach(c => {
    const soyA = c.postura_a_id === postura.id
    const r = calcularCrucePostura(c, posturas, cruces, partidos)
    if (r.estado === 'pendiente') return
    neto += soyA ? r.a : r.b
  })
  return neto
}

function netoPosturasJugador(playerId, posturas, cruces, partidos) {
  return (posturas || []).filter(p => p.player_id === playerId).reduce((s, p) => {
    const partido = partidos.find(pp => pp.id === p.match_id)
    if (!partido || partido.status !== 'finished') return s
    return s + netoPostura(p, cruces, posturas, partidos)
  }, 0)
}

function comprometidoEnPosturas(playerId, posturas, partidos) {
  return (posturas || []).filter(p => {
    if (p.player_id !== playerId) return false
    const partido = partidos.find(pp => pp.id === p.match_id)
    return !partido || partido.status !== 'finished'
  }).reduce((s, p) => s + p.monto, 0)
}

// ── Predix con suscripción: modo "demo" (gratis, sin premio) vs "pago"
// (con suscripción — por torneo o completa — activa ahora mismo, sí
// compite por el ranking de premios). Son dos economías separadas: los
// puntos de una no cuentan ni se pueden usar en la otra.
const HOY = () => new Date().toISOString().slice(0, 10)

function tieneSuscActiva(playerId, tournamentId, suscripciones) {
  return (suscripciones || []).some(s =>
    s.player_id === playerId && s.estado === 'activa' && s.fecha_fin >= HOY() &&
    (s.tournament_id === tournamentId || s.tournament_id === null))
}

function modoPara(playerId, tournamentId, suscripciones) {
  return tieneSuscActiva(playerId, tournamentId, suscripciones) ? 'pago' : 'demo'
}

function filtrarPorModo(modo, allPreds, duelos, posturas, cruces) {
  const predsM    = (allPreds || []).filter(pr => pr.modo === modo)
  const duelosM   = (duelos   || []).filter(d  => d.modo  === modo)
  const posturasM = (posturas || []).filter(p  => p.modo  === modo)
  const idsM      = new Set(posturasM.map(p => p.id))
  const crucesM   = (cruces   || []).filter(c => idsM.has(c.postura_a_id) && idsM.has(c.postura_b_id))
  return { predsM, duelosM, posturasM, crucesM }
}

function puntosPorModo(playerId, modo, allPreds, duelos, partidos, posturas, cruces) {
  const { predsM, duelosM, posturasM, crucesM } = filtrarPorModo(modo, allPreds, duelos, posturas, cruces)
  return saldoPredicciones(playerId, predsM)
    + netoDuelosResueltos(playerId, duelosM, partidos)
    + netoPosturasJugador(playerId, posturasM, crucesM, partidos)
}

function saldoDisponiblePorModo(playerId, modo, allPreds, duelos, partidos, posturas, cruces) {
  const { duelosM, posturasM } = filtrarPorModo(modo, allPreds, duelos, posturas, cruces)
  return puntosPorModo(playerId, modo, allPreds, duelos, partidos, posturas, cruces)
    - comprometidoEnDuelos(playerId, duelosM, partidos)
    - comprometidoEnPosturas(playerId, posturasM, partidos)
}

const WA_PREDIX = (texto) => `https://wa.me/573226490055?text=${encodeURIComponent(texto)}`

// Ficha de planes disponibles + mis suscripciones, con botón directo a
// WhatsApp para pagar (el cobro es manual, lo activa un admin después).
function ModalPlanesPredix({ planes, misSuscripciones, jugadorNombre, onClose }) {
  function fmtMoney(n) { return `$${Number(n || 0).toLocaleString('es-CO')}` }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto', border:`0.5px solid ${S.border}` }}>
        <div style={{ padding:'16px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:S.surface }}>
          <div style={{ fontWeight:'700', fontSize:'.95rem', color:S.text }}>💰 Suscripción Predix</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ padding:'18px 20px 32px' }}>

          {misSuscripciones.length > 0 && (
            <div style={{ marginBottom:'20px' }}>
              <div style={{ fontSize:'.68rem', fontWeight:'700', color:S.gold, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'8px' }}>Tus suscripciones</div>
              {misSuscripciones.map(s => (
                <div key={s.id} style={{ background:S.card, borderRadius:'10px', padding:'10px 14px', marginBottom:'6px', border:`0.5px solid ${S.border}` }}>
                  <div style={{ fontSize:'.8rem', fontWeight:'700', color:S.text }}>{s.predix_planes?.nombre || (s.tournament_id ? 'Por torneo' : 'Completa')}</div>
                  <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>Pagaste {fmtMoney(s.monto_pagado)} · vence {new Date(s.fecha_fin).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize:'.68rem', fontWeight:'700', color:S.cyan, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'8px' }}>Planes disponibles</div>
          {planes.length === 0 ? (
            <div style={{ color:S.muted, fontSize:'.8rem', textAlign:'center', padding:'20px' }}>Aún no hay planes publicados</div>
          ) : planes.map(p => (
            <div key={p.id} style={{ background:S.card, borderRadius:'12px', padding:'14px 16px', marginBottom:'10px', border:`0.5px solid ${S.border}` }}>
              <div style={{ fontWeight:'700', fontSize:'.85rem', color:S.text }}>{p.nombre}</div>
              <div style={{ fontSize:'.72rem', color:S.muted, marginTop:'4px' }}>
                {fmtMoney(p.precio_min)} – {fmtMoney(p.precio_max)} · tú eliges cuánto pagar en ese rango
              </div>
              <div style={{ fontSize:'.72rem', color:S.gold, marginTop:'2px' }}>Si quedas 1° del ranking, ganas {p.multiplicador_premio}x lo que pagaste</div>
              <a href={WA_PREDIX(`Hola! Soy ${jugadorNombre} y quiero suscribirme a "${p.nombre}" en Predix Golmebol (rango ${fmtMoney(p.precio_min)}–${fmtMoney(p.precio_max)}). ¿Cómo pago?`)}
                target="_blank" rel="noreferrer"
                style={{ display:'block', textAlign:'center', marginTop:'10px', padding:'9px', background:S.cyan, borderRadius:'8px', color:'#000', fontWeight:'800', fontSize:'.78rem', textDecoration:'none' }}>
                📲 Escribir por WhatsApp
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
  const [rankingDemo,  setRankingDemo]  = useState([])
  const [rankingPago,  setRankingPago]  = useState([])
  const [rankingModo,  setRankingModo]  = useState('pago')
  const [misPuntosDemo,setMisPuntosDemo]= useState(0)
  const [misPuntosPago,setMisPuntosPago]= useState(0)
  const [jugadores,    setJugadores]    = useState([])
  const [teamSheet,    setTeamSheet]    = useState(null)
  const [torneoFiltro, setTorneoFiltro] = useState(null)
  const [collapsed,    setCollapsed]    = useState({})

  // Duelos 1v1
  const [duelos,           setDuelos]           = useState([])
  const [jugadoresTodos,   setJugadoresTodos]   = useState([])
  const [todasPredicciones,setTodasPredicciones]= useState([])
  const [modalReto,        setModalReto]        = useState(null)
  const [busquedaRival,    setBusquedaRival]    = useState('')
  const [guardandoReto,    setGuardandoReto]    = useState(false)
  const [msgReto,          setMsgReto]          = useState(null)
  const [procesandoDuelo,  setProcesandoDuelo]  = useState(null)

  // Apuestas abiertas (mercado)
  const [posturas,        setPosturas]        = useState([])
  const [cruces,          setCruces]          = useState([])
  const [modalPostura,    setModalPostura]    = useState(null)
  const [guardandoPostura,setGuardandoPostura]= useState(false)
  const [msgPostura,      setMsgPostura]      = useState(null)
  const [subTabDuelos,    setSubTabDuelos]    = useState('retos')

  // Suscripciones Predix (modo demo vs pago)
  const [suscripciones,   setSuscripciones]   = useState([])
  const [planesPredix,    setPlanesPredix]    = useState([])
  const [modalPlanes,     setModalPlanes]     = useState(false)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !p.activo_membresia) { navigate('/jugador'); return }
    setPlayer(p)

    const [{ data: pts }, { data: preds }, { data: jugs }, { data: allPreds }, { data: duelosData }, { data: activos }, { data: posturasData }, { data: crucesData }, { data: suscData }, { data: planesData }] = await Promise.all([
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
      supabase.from('predicciones').select('player_id, puntos_ganados, modo'),
      supabase.from('predix_duelos').select('*').order('created_at', { ascending: false }),
      supabase.from('players').select('id, name, photo_face_url, photo_url, user_id, es_arbitro, rol').eq('activo_membresia', true).order('name'),
      supabase.from('predix_posturas').select('*').order('created_at', { ascending: true }),
      supabase.from('predix_posturas_cruces').select('*'),
      supabase.from('predix_suscripciones').select('*, predix_planes(nombre, tipo)'),
      supabase.from('predix_planes').select('*').eq('activo', true).order('created_at', { ascending: false }),
    ])
    setDuelos(duelosData || [])
    setJugadoresTodos((activos || []).filter(pl => pl.id !== p.id && !pl.es_arbitro && pl.rol !== 'arbitro'))
    setTodasPredicciones(allPreds || [])
    setPosturas(posturasData || [])
    setCruces(crucesData || [])
    setSuscripciones(suscData || [])
    setPlanesPredix(planesData || [])

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
    setMisPuntosDemo(puntosPorModo(p.id, 'demo', allPreds || [], duelosData || [], partidosData, posturasData || [], crucesData || []))
    setMisPuntosPago(puntosPorModo(p.id, 'pago', allPreds || [], duelosData || [], partidosData, posturasData || [], crucesData || []))
    setJugadores(jugs || [])

    // Ranking separado por modo: demo (gratis, sin premio) y pago (con
    // suscripción activa, sí compite por premio) son economías distintas.
    function construirRanking(modo) {
      const rankMap = {}
      ;(allPreds || []).filter(pr => pr.modo === modo).forEach(pr => {
        if (!rankMap[pr.player_id]) rankMap[pr.player_id] = { id: pr.player_id, puntos: 0, nombre: null, foto: null }
        rankMap[pr.player_id].puntos += pr.puntos_ganados || 0
      })
      ;(duelosData || []).filter(d => d.estado === 'aceptado' && d.modo === modo).forEach(d => {
        const partido = partidosData.find(pp => pp.id === d.match_id)
        if (!partido || partido.status !== 'finished') return
        const r = calcularDuelo(d, partidosData, duelosData || [])
        if (r.estado === 'pendiente') return
        if (!rankMap[d.retador_id]) rankMap[d.retador_id] = { id: d.retador_id, puntos: 0, nombre: d.retador_nombre, foto: null }
        if (!rankMap[d.retado_id])  rankMap[d.retado_id]  = { id: d.retado_id,  puntos: 0, nombre: d.retado_nombre,  foto: null }
        rankMap[d.retador_id].puntos += r.retador
        rankMap[d.retado_id].puntos  += r.retado
      })
      const posturasModo = (posturasData || []).filter(p2 => p2.modo === modo)
      const idsModo = new Set(posturasModo.map(p2 => p2.id))
      ;(crucesData || []).filter(c => idsModo.has(c.postura_a_id) && idsModo.has(c.postura_b_id)).forEach(c => {
        const partido = partidosData.find(pp => pp.id === c.match_id)
        if (!partido || partido.status !== 'finished') return
        const r = calcularCrucePostura(c, posturasModo, crucesData || [], partidosData)
        if (r.estado === 'pendiente') return
        const posturaA = posturasModo.find(p2 => p2.id === c.postura_a_id)
        const posturaB = posturasModo.find(p2 => p2.id === c.postura_b_id)
        if (!posturaA || !posturaB) return
        if (!rankMap[posturaA.player_id]) rankMap[posturaA.player_id] = { id: posturaA.player_id, puntos: 0, nombre: posturaA.nombre, foto: null }
        if (!rankMap[posturaB.player_id]) rankMap[posturaB.player_id] = { id: posturaB.player_id, puntos: 0, nombre: posturaB.nombre, foto: null }
        rankMap[posturaA.player_id].puntos += r.a
        rankMap[posturaB.player_id].puntos += r.b
      })
      return rankMap
    }
    const rankMapDemo = construirRanking('demo')
    const rankMapPago = construirRanking('pago')
    const playerIds = [...new Set([...Object.keys(rankMapDemo), ...Object.keys(rankMapPago)])]
    if (playerIds.length > 0) {
      const { data: playersData } = await supabase.from('players').select('id, name, photo_face_url, photo_url').in('id', playerIds)
      ;(playersData || []).forEach(pl => {
        if (rankMapDemo[pl.id]) { rankMapDemo[pl.id].nombre = pl.name; rankMapDemo[pl.id].foto = pl.photo_face_url || pl.photo_url }
        if (rankMapPago[pl.id]) { rankMapPago[pl.id].nombre = pl.name; rankMapPago[pl.id].foto = pl.photo_face_url || pl.photo_url }
      })
    }
    setRankingDemo(Object.values(rankMapDemo).sort((a,b) => b.puntos - a.puntos))
    setRankingPago(Object.values(rankMapPago).sort((a,b) => b.puntos - a.puntos))
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
    const modo = modoPara(player.id, modal.tournament_id, suscripciones)
    const data = { player_id: player.id, match_id: modal.id, ganador: form.ganador, goles_home: form.golesHome, goles_away: form.golesAway, goleador_id: form.goleadorId || null, modo }
    if (pred) await supabase.from('predicciones').update(data).eq('id', pred.id)
    else       await supabase.from('predicciones').insert(data)
    setGuardando(false)
    setSuccessAnim(true)
    setStep(5)
    fetchTodo()
  }

  async function crearReto() {
    if (!modalReto?.rival || !modalReto?.partido || !modalReto?.equipo) return
    const monto = parseFloat(modalReto.monto)
    if (!monto || monto <= 0) { setMsgReto({ tipo:'error', texto:'Pon un número válido' }); return }
    const modo = modoPara(player.id, modalReto.partido.tournament_id, suscripciones)
    if (modoPara(modalReto.rival.id, modalReto.partido.tournament_id, suscripciones) !== modo) {
      setMsgReto({ tipo:'error', texto:'Tú y tu rival deben estar en el mismo modo (demo o pago) en este torneo' }); return
    }
    const disponible = saldoDisponiblePorModo(player.id, modo, todasPredicciones, duelos, partidos, posturas, cruces)
    const tope = disponible * 0.25
    if (monto > tope) { setMsgReto({ tipo:'error', texto:`Máximo ${Math.floor(tope)} pts (25% de tu saldo disponible en modo ${modo}: ${Math.round(disponible)})` }); return }
    setGuardandoReto(true)
    const { error } = await supabase.from('predix_duelos').insert({
      match_id: modalReto.partido.id,
      tournament_id: modalReto.partido.tournament_id,
      retador_id: player.id, retador_user_id: player.user_id, retador_nombre: player.name,
      retador_equipo: modalReto.equipo,
      retado_id: modalReto.rival.id, retado_user_id: modalReto.rival.user_id, retado_nombre: modalReto.rival.name,
      monto, estado: 'pendiente', modo,
    })
    setGuardandoReto(false)
    if (error) { setMsgReto({ tipo:'error', texto:'No se pudo crear el reto' }); return }
    setModalReto(null)
    fetchTodo()
  }

  async function responderReto(duelo, nuevoEstado) {
    setProcesandoDuelo(duelo.id)
    if (nuevoEstado === 'aceptado') {
      const disponible = saldoDisponiblePorModo(player.id, duelo.modo || 'demo', todasPredicciones, duelos, partidos, posturas, cruces)
      const tope = disponible * 0.25
      if (duelo.monto > tope) {
        alert(`No tienes saldo suficiente para aceptar este duelo (máximo permitido ahora mismo: ${Math.floor(tope)} pts).`)
        setProcesandoDuelo(null)
        return
      }
    }
    await supabase.from('predix_duelos').update({ estado: nuevoEstado, respondido_at: new Date().toISOString() }).eq('id', duelo.id)
    setProcesandoDuelo(null)
    fetchTodo()
  }

  async function crearPostura() {
    if (!modalPostura?.partido || !modalPostura?.equipo) return
    const monto = parseFloat(modalPostura.monto)
    if (!monto || monto <= 0) { setMsgPostura({ tipo:'error', texto:'Pon un número válido' }); return }
    const modo = modoPara(player.id, modalPostura.partido.tournament_id, suscripciones)
    const disponible = saldoDisponiblePorModo(player.id, modo, todasPredicciones, duelos, partidos, posturas, cruces)
    const tope = disponible * 0.25
    if (monto > tope) { setMsgPostura({ tipo:'error', texto:`Máximo ${Math.floor(tope)} pts (25% de tu saldo disponible en modo ${modo}: ${Math.round(disponible)})` }); return }
    setGuardandoPostura(true)
    const equipoRival = modalPostura.equipo === 'local' ? 'visitante' : 'local'

    const { data: rivales } = await supabase.from('predix_posturas')
      .select('*').eq('match_id', modalPostura.partido.id).eq('equipo', equipoRival).eq('estado', 'abierta').eq('modo', modo)
      .order('created_at', { ascending: true })

    const { data: nueva, error } = await supabase.from('predix_posturas')
      .insert({ match_id: modalPostura.partido.id, tournament_id: modalPostura.partido.tournament_id, player_id: player.id, user_id: player.user_id, nombre: player.name, equipo: modalPostura.equipo, monto, monto_emparejado: 0, estado: 'abierta', modo })
      .select().single()
    if (error || !nueva) { setMsgPostura({ tipo:'error', texto:'No se pudo registrar la apuesta' }); setGuardandoPostura(false); return }

    let restante = monto
    for (const riv of (rivales || [])) {
      if (restante <= 0) break
      const capacidad = riv.monto - riv.monto_emparejado
      if (capacidad <= 0) continue
      const cruce = Math.min(restante, capacidad)
      await supabase.from('predix_posturas_cruces').insert({ match_id: modalPostura.partido.id, postura_a_id: nueva.id, postura_b_id: riv.id, monto: cruce })
      const nuevoEmp = riv.monto_emparejado + cruce
      await supabase.from('predix_posturas').update({ monto_emparejado: nuevoEmp, estado: nuevoEmp >= riv.monto ? 'cerrada' : 'abierta' }).eq('id', riv.id)
      restante -= cruce
    }
    const empPropio = monto - restante
    await supabase.from('predix_posturas').update({ monto_emparejado: empPropio, estado: empPropio >= monto ? 'cerrada' : 'abierta' }).eq('id', nueva.id)

    setGuardandoPostura(false)
    setModalPostura(null)
    fetchTodo()
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const terminados = partidos.filter(p => p.status === 'finished')
  const rankingActual = rankingModo === 'pago' ? rankingPago : rankingDemo
  const miRankingActual = rankingActual.findIndex(r => r.id === player.id) + 1
  const misSuscripciones = suscripciones.filter(s => s.player_id === player.id && s.estado === 'activa' && s.fecha_fin >= HOY())

  const jugsModal = modal ? jugadores
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

  // Duelos 1v1 — datos derivados (saldo separado por modo demo/pago)
  const miSaldoDemo = saldoDisponiblePorModo(player.id, 'demo', todasPredicciones, duelos, partidos, posturas, cruces)
  const miSaldoPago = saldoDisponiblePorModo(player.id, 'pago', todasPredicciones, duelos, partidos, posturas, cruces)
  const modoRetoActual = modalReto?.partido ? modoPara(player.id, modalReto.partido.tournament_id, suscripciones) : null
  const saldoRetoActual = modoRetoActual ? (modoRetoActual === 'pago' ? miSaldoPago : miSaldoDemo) : 0
  const modoPosturaActual = modalPostura?.partido ? modoPara(player.id, modalPostura.partido.tournament_id, suscripciones) : null
  const saldoPosturaActual = modoPosturaActual ? (modoPosturaActual === 'pago' ? miSaldoPago : miSaldoDemo) : 0
  const misDuelos          = duelos.filter(d => d.retador_id === player.id || d.retado_id === player.id)
  const retosRecibidos     = misDuelos.filter(d => d.retado_id === player.id && d.estado === 'pendiente')
  const retosEnviados      = misDuelos.filter(d => d.retador_id === player.id && d.estado === 'pendiente')
  const duelosEnJuego      = misDuelos.filter(d => {
    if (d.estado !== 'aceptado') return false
    const partido = partidos.find(p => p.id === d.match_id)
    return !partido || partido.status !== 'finished'
  })
  const duelosResueltos = misDuelos.filter(d => {
    if (d.estado === 'rechazado' || d.estado === 'cancelado') return true
    if (d.estado !== 'aceptado') return false
    const partido = partidos.find(p => p.id === d.match_id)
    return partido && partido.status === 'finished'
  })

  const jugadoresFiltrados = jugadoresTodos.filter(j => j.name.toLowerCase().includes(busquedaRival.toLowerCase()))
  const partidosElegibles = modalReto?.rival
    ? pendientes.filter(p => !jugadorJuegaEnPartido(player.id, p, jugadores) && !jugadorJuegaEnPartido(modalReto.rival.id, p, jugadores)
        && modoPara(player.id, p.tournament_id, suscripciones) === modoPara(modalReto.rival.id, p.tournament_id, suscripciones))
    : []

  // Apuestas abiertas — datos derivados
  const partidosElegiblesPostura = pendientes.filter(p => !jugadorJuegaEnPartido(player.id, p, jugadores))
  function resumenPosturasPartido(matchId) {
    const ps = posturas.filter(p => p.match_id === matchId)
    return { local: ps.filter(p => p.equipo === 'local'), visitante: ps.filter(p => p.equipo === 'visitante') }
  }
  const partidosConMercado = partidosElegiblesPostura.filter(p => {
    const { local, visitante } = resumenPosturasPartido(p.id)
    return [...local, ...visitante].some(x => x.monto - x.monto_emparejado > 0)
  })
  const misPosturas = posturas.filter(p => p.player_id === player.id)

  function PosturaCard(pu) {
    const partido = partidos.find(p => p.id === pu.match_id)
    const partidoTerminado = partido && partido.status === 'finished'
    const equipoNombre = pu.equipo === 'local' ? partido?.home?.name : partido?.away?.name
    const libre = pu.monto - pu.monto_emparejado
    const neto = partidoTerminado ? netoPostura(pu, cruces, posturas, partidos) : 0
    const colorEstado = !partidoTerminado ? S.gold : neto > 0 ? S.win : neto < 0 ? S.loss : S.gold
    const labelEstado = !partidoTerminado
      ? (pu.monto_emparejado === 0 ? 'Sin cruzar todavía' : libre > 0 ? `Cruzada parcial · ${libre} libre` : 'Cruzada completa')
      : (pu.monto_emparejado === 0 ? 'Nadie cruzó · sin efecto' : neto > 0 ? `Ganaste · +${Math.round(neto*10)/10} pts` : neto < 0 ? `Perdiste · ${Math.round(neto*10)/10} pts` : 'Empate')
    return (
      <div key={pu.id} style={{ background:S.card, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', border:`0.5px solid ${S.border}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
          <span style={{ fontSize:'.72rem', color:S.muted }}>{partido?.tournaments?.name}</span>
          <span style={{ fontSize:'.72rem', fontWeight:'800', color:colorEstado, background:`${colorEstado}22`, borderRadius:'10px', padding:'2px 10px' }}>{labelEstado}</span>
        </div>
        <div style={{ fontSize:'.85rem', fontWeight:'600', color:S.text, marginBottom:'4px' }}>{partido?.home?.name} vs {partido?.away?.name}</div>
        <div style={{ fontSize:'.75rem', color:S.text2 }}>
          Pusiste <span style={{ color:S.cyan, fontWeight:'700' }}>{pu.monto}</span> pts a <span style={{ fontWeight:'700' }}>{equipoNombre}</span>
          {pu.monto_emparejado > 0 && <span> · cruzado: {pu.monto_emparejado}</span>}
        </div>
      </div>
    )
  }

  function DueloCard(d) {
    const partido = partidos.find(p => p.id === d.match_id)
    const soyRetador = d.retador_id === player.id
    const rivalNombre = soyRetador ? d.retado_nombre : d.retador_nombre
    const miEquipoVal = soyRetador ? d.retador_equipo : (d.retador_equipo === 'local' ? 'visitante' : 'local')
    const miEquipoNombre = miEquipoVal === 'local' ? partido?.home?.name : partido?.away?.name
    const partidoTerminado = partido && partido.status === 'finished'
    const calc = partidoTerminado ? calcularDuelo(d, partidos, duelos) : null
    const miNeto = calc ? (soyRetador ? calc.retador : calc.retado) : 0
    const colorEstado = d.estado === 'rechazado' || d.estado === 'cancelado' ? S.muted
      : d.estado === 'pendiente' ? S.gold
      : !partidoTerminado ? S.cyan
      : miNeto > 0 ? S.win : miNeto < 0 ? S.loss : S.gold
    const labelEstado = d.estado === 'rechazado' ? 'Rechazado' : d.estado === 'cancelado' ? 'Cancelado'
      : d.estado === 'pendiente' ? 'Esperando respuesta'
      : !partidoTerminado ? 'En juego'
      : miNeto > 0 ? `Ganaste · +${Math.round(miNeto*10)/10} pts` : miNeto < 0 ? `Perdiste · ${Math.round(miNeto*10)/10} pts` : 'Empate'
    return (
      <div key={d.id} style={{ background:S.card, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', border:`0.5px solid ${S.border}` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
          <span style={{ fontSize:'.72rem', color:S.muted }}>vs {rivalNombre}</span>
          <span style={{ fontSize:'.72rem', fontWeight:'800', color:colorEstado, background:`${colorEstado}22`, borderRadius:'10px', padding:'2px 10px' }}>{labelEstado}</span>
        </div>
        <div style={{ fontSize:'.85rem', fontWeight:'600', color:S.text, marginBottom:'4px' }}>{partido?.home?.name} vs {partido?.away?.name}</div>
        <div style={{ fontSize:'.75rem', color:S.text2 }}>
          Le apostaste <span style={{ color:S.cyan, fontWeight:'700' }}>{d.monto}</span> pts a <span style={{ fontWeight:'700' }}>{miEquipoNombre}</span>
        </div>
        {d.estado === 'pendiente' && d.retado_id === player.id && (
          <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
            <button disabled={procesandoDuelo === d.id} onClick={() => responderReto(d, 'aceptado')} style={{ flex:1, padding:'9px', background:S.win, border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', fontSize:'.78rem' }}>Aceptar</button>
            <button disabled={procesandoDuelo === d.id} onClick={() => responderReto(d, 'rechazado')} style={{ flex:1, padding:'9px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:S.muted, fontWeight:'700', fontSize:'.78rem' }}>Rechazar</button>
          </div>
        )}
        {d.estado === 'pendiente' && d.retador_id === player.id && (
          <button disabled={procesandoDuelo === d.id} onClick={() => responderReto(d, 'cancelado')} style={{ marginTop:'10px', width:'100%', padding:'9px', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'8px', cursor:'pointer', color:S.muted, fontWeight:'700', fontSize:'.78rem' }}>Cancelar reto</button>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>

      {teamSheet && <TeamSheet {...teamSheet} onClose={() => setTeamSheet(null)}/>}
      {modalPlanes && <ModalPlanesPredix planes={planesPredix} misSuscripciones={misSuscripciones} jugadorNombre={player.name} onClose={() => setModalPlanes(false)}/>}

      {/* Modal: retar a alguien (Duelos 1v1) */}
      {modalReto && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && setModalReto(null)}>
          <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', border:`0.5px solid ${S.border}` }}>
            <div style={{ padding:'16px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontWeight:'700', fontSize:'.95rem', color:S.text }}>⚔️ Retar a alguien</div>
              <button onClick={() => setModalReto(null)} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {!modalReto.rival ? (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'12px' }}>¿A quién quieres retar?</div>
                  <input value={busquedaRival} onChange={e => setBusquedaRival(e.target.value)} placeholder="Buscar jugador..."
                    style={{ width:'100%', padding:'10px 14px', borderRadius:'10px', border:`1px solid ${S.border}`, background:S.card, color:S.text, fontSize:'.85rem', marginBottom:'12px', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'320px', overflowY:'auto' }}>
                    {jugadoresFiltrados.length === 0 ? (
                      <div style={{ color:S.muted, fontSize:'.8rem', textAlign:'center', padding:'16px' }}>Sin resultados</div>
                    ) : jugadoresFiltrados.map(j => (
                      <div key={j.id} onClick={() => setModalReto(m => ({ ...m, rival:j }))}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'10px', cursor:'pointer', border:`1px solid ${S.border}`, background:S.card }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:S.card2, overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <span style={{ fontSize:'.8rem' }}>👤</span>}
                        </div>
                        <span style={{ fontSize:'.85rem', fontWeight:'500', color:S.text }}>{j.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !modalReto.partido ? (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                    <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text }}>Retando a <span style={{ color:S.cyan }}>{modalReto.rival.name}</span></div>
                    <button onClick={() => setModalReto(m => ({ ...m, rival:null }))} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'.72rem' }}>Cambiar</button>
                  </div>
                  <div style={{ fontSize:'.78rem', color:S.muted, marginBottom:'10px' }}>Elige un partido donde ninguno de los dos esté jugando:</div>
                  {partidosElegibles.length === 0 ? (
                    <div style={{ color:S.muted, fontSize:'.8rem', textAlign:'center', padding:'24px' }}>No hay partidos disponibles para retar a este jugador ahora mismo.</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'320px', overflowY:'auto' }}>
                      {partidosElegibles.map(p => (
                        <div key={p.id} onClick={() => setModalReto(m => ({ ...m, partido:p }))}
                          style={{ padding:'10px 12px', borderRadius:'10px', cursor:'pointer', border:`1px solid ${S.border}`, background:S.card }}>
                          <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text }}>{p.home?.name} vs {p.away?.name}</div>
                          <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>{p.tournaments?.name}{p.played_at ? ` · ${new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                    <div style={{ fontSize:'.9rem', fontWeight:'700', color:S.text }}>{modalReto.partido.home?.name} vs {modalReto.partido.away?.name}</div>
                    <button onClick={() => setModalReto(m => ({ ...m, partido:null }))} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'.72rem' }}>Cambiar</button>
                  </div>
                  <div style={{ fontSize:'.75rem', color:S.muted, marginBottom:'16px' }}>Retando a {modalReto.rival.name}</div>

                  <div style={{ fontSize:'.8rem', fontWeight:'600', color:S.text, marginBottom:'10px' }}>¿A cuál equipo le pones?</div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'18px' }}>
                    {[{ val:'local', label:modalReto.partido.home?.name },{ val:'visitante', label:modalReto.partido.away?.name }].map(opt => (
                      <div key={opt.val} onClick={() => setModalReto(m => ({ ...m, equipo:opt.val }))}
                        style={{ flex:1, padding:'14px 10px', borderRadius:'12px', textAlign:'center', cursor:'pointer', border:`1px solid ${modalReto.equipo===opt.val ? S.cyan : S.border}`, background: modalReto.equipo===opt.val ? S.cyanDim : S.card }}>
                        <span style={{ fontWeight:'700', fontSize:'.85rem', color: modalReto.equipo===opt.val ? S.cyan : S.text }}>{opt.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize:'.8rem', fontWeight:'600', color:S.text, marginBottom:'8px' }}>¿Cuántos puntos apuestas?</div>
                  <input type="number" inputMode="numeric" value={modalReto.monto} onChange={e => setModalReto(m => ({ ...m, monto:e.target.value }))} placeholder="Ej: 20"
                    style={{ width:'100%', padding:'14px 16px', borderRadius:'12px', border:`1px solid ${S.border}`, background:S.card, color:S.text, fontSize:'1.3rem', fontWeight:'700', textAlign:'center', marginBottom:'8px', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                    <span style={{ fontSize:'.7rem', fontWeight:'800', color: modoRetoActual==='pago'?S.gold:S.muted, background: modoRetoActual==='pago'?S.goldDim:'rgba(154,160,166,.1)', borderRadius:'10px', padding:'2px 9px' }}>
                      {modoRetoActual==='pago' ? '💰 Modo Pago' : '🎓 Modo Demo — sin premio'}
                    </span>
                  </div>
                  <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'16px' }}>
                    Tu saldo disponible en este modo: {Math.round(saldoRetoActual*10)/10} pts · máximo por duelo: {Math.max(0, Math.floor(saldoRetoActual*0.25))} pts.
                    Si tu rival acepta y ganas, te quedas con parte de su apuesta (menos si ya se han enfrentado antes); si pierdes, pierdes toda tu apuesta.
                  </div>

                  {msgReto && <div style={{ fontSize:'.75rem', color: msgReto.tipo==='error'?S.loss:S.win, marginBottom:'10px' }}>{msgReto.texto}</div>}

                  <button disabled={guardandoReto || !modalReto.equipo} onClick={crearReto}
                    style={{ width:'100%', padding:'13px', background: modalReto.equipo ? S.cyan : S.border, border:'none', borderRadius:'12px', cursor: guardandoReto||!modalReto.equipo ? 'not-allowed' : 'pointer', color: modalReto.equipo ? '#000' : S.muted, fontWeight:'800', fontSize:'.9rem', opacity: guardandoReto?.7:1 }}>
                    {guardandoReto ? 'Enviando reto...' : 'ENVIAR RETO'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: apuesta abierta (mercado) */}
      {modalPostura && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => e.target === e.currentTarget && setModalPostura(null)}>
          <div style={{ background:S.surface, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'480px', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', border:`0.5px solid ${S.border}` }}>
            <div style={{ padding:'16px 20px', borderBottom:`0.5px solid ${S.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontWeight:'700', fontSize:'.95rem', color:S.text }}>📢 Apuesta abierta</div>
              <button onClick={() => setModalPostura(null)} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              {!modalPostura.partido ? (
                <div>
                  <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text, marginBottom:'12px' }}>¿En qué partido quieres apostar?</div>
                  {partidosElegiblesPostura.length === 0 ? (
                    <div style={{ color:S.muted, fontSize:'.8rem', textAlign:'center', padding:'24px' }}>No hay partidos disponibles ahora mismo (no puedes apostar en uno donde tú estés jugando).</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'380px', overflowY:'auto' }}>
                      {partidosElegiblesPostura.map(p => (
                        <div key={p.id} onClick={() => setModalPostura(m => ({ ...m, partido:p }))}
                          style={{ padding:'10px 12px', borderRadius:'10px', cursor:'pointer', border:`1px solid ${S.border}`, background:S.card }}>
                          <div style={{ fontSize:'.82rem', fontWeight:'600', color:S.text }}>{p.home?.name} vs {p.away?.name}</div>
                          <div style={{ fontSize:'.68rem', color:S.muted, marginTop:'2px' }}>{p.tournaments?.name}{p.played_at ? ` · ${new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                    <div style={{ fontSize:'.9rem', fontWeight:'700', color:S.text }}>{modalPostura.partido.home?.name} vs {modalPostura.partido.away?.name}</div>
                    <button onClick={() => setModalPostura(m => ({ ...m, partido:null, equipo:null }))} style={{ background:'none', border:'none', color:S.muted, cursor:'pointer', fontSize:'.72rem' }}>Cambiar</button>
                  </div>

                  <div style={{ fontSize:'.8rem', fontWeight:'600', color:S.text, marginBottom:'10px' }}>¿A cuál equipo le pones?</div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'18px' }}>
                    {[{ val:'local', label:modalPostura.partido.home?.name },{ val:'visitante', label:modalPostura.partido.away?.name }].map(opt => (
                      <div key={opt.val} onClick={() => setModalPostura(m => ({ ...m, equipo:opt.val }))}
                        style={{ flex:1, padding:'14px 10px', borderRadius:'12px', textAlign:'center', cursor:'pointer', border:`1px solid ${modalPostura.equipo===opt.val ? S.cyan : S.border}`, background: modalPostura.equipo===opt.val ? S.cyanDim : S.card }}>
                        <span style={{ fontWeight:'700', fontSize:'.85rem', color: modalPostura.equipo===opt.val ? S.cyan : S.text }}>{opt.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize:'.8rem', fontWeight:'600', color:S.text, marginBottom:'8px' }}>¿Cuántos puntos apuestas?</div>
                  <input type="number" inputMode="numeric" value={modalPostura.monto} onChange={e => setModalPostura(m => ({ ...m, monto:e.target.value }))} placeholder="Ej: 50"
                    style={{ width:'100%', padding:'14px 16px', borderRadius:'12px', border:`1px solid ${S.border}`, background:S.card, color:S.text, fontSize:'1.3rem', fontWeight:'700', textAlign:'center', marginBottom:'8px', boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                    <span style={{ fontSize:'.7rem', fontWeight:'800', color: modoPosturaActual==='pago'?S.gold:S.muted, background: modoPosturaActual==='pago'?S.goldDim:'rgba(154,160,166,.1)', borderRadius:'10px', padding:'2px 9px' }}>
                      {modoPosturaActual==='pago' ? '💰 Modo Pago' : '🎓 Modo Demo — sin premio'}
                    </span>
                  </div>
                  <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'16px' }}>
                    Tu saldo disponible en este modo: {Math.round(saldoPosturaActual*10)/10} pts · máximo por apuesta: {Math.max(0, Math.floor(saldoPosturaActual*0.25))} pts.
                    Se cruza automáticamente contra lo que otros pongan al equipo contrario, siempre dentro del mismo modo. Lo que no se cruce con nadie no gana ni pierde.
                  </div>

                  {msgPostura && <div style={{ fontSize:'.75rem', color: msgPostura.tipo==='error'?S.loss:S.win, marginBottom:'10px' }}>{msgPostura.texto}</div>}

                  <button disabled={guardandoPostura || !modalPostura.equipo} onClick={crearPostura}
                    style={{ width:'100%', padding:'13px', background: modalPostura.equipo ? S.cyan : S.border, border:'none', borderRadius:'12px', cursor: guardandoPostura||!modalPostura.equipo ? 'not-allowed' : 'pointer', color: modalPostura.equipo ? '#000' : S.muted, fontWeight:'800', fontSize:'.9rem', opacity: guardandoPostura?.7:1 }}>
                    {guardandoPostura ? 'Enviando...' : 'CONFIRMAR APUESTA'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          <div style={{ display:'flex', gap:'14px' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.muted, lineHeight:1 }}>{Math.round(misPuntosDemo*10)/10}</div>
              <div style={{ fontSize:'.6rem', color:S.muted }}>🎓 Demo</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:'1.3rem', fontWeight:'900', color:S.gold, lineHeight:1 }}>{Math.round(misPuntosPago*10)/10}</div>
              <div style={{ fontSize:'.6rem', color:S.muted }}>💰 Pago</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'600px', margin:'0 auto', padding:'0 16px' }}>

        {/* Suscripción Predix */}
        <div onClick={() => setModalPlanes(true)}
          style={{ cursor:'pointer', marginTop:'12px', background: misSuscripciones.length>0 ? 'rgba(249,168,37,.08)' : S.card, border:`1px solid ${misSuscripciones.length>0 ? 'rgba(249,168,37,.35)' : S.border}`, borderRadius:'12px', padding:'12px 14px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'1.3rem' }}>{misSuscripciones.length>0 ? '💰' : '🎓'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'.8rem', fontWeight:'700', color:S.text }}>
              {misSuscripciones.length>0 ? `Suscrito · ${misSuscripciones.length} plan${misSuscripciones.length>1?'es':''} activo${misSuscripciones.length>1?'s':''}` : 'Estás en modo Demo — sin premio'}
            </div>
            <div style={{ fontSize:'.68rem', color:S.muted }}>
              {misSuscripciones.length>0 ? 'Toca para ver el detalle o sumar otro plan' : 'Suscríbete para competir por premios reales'}
            </div>
          </div>
          <span style={{ color:S.muted }}>→</span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', padding:'12px 0', position:'sticky', top:0, background:S.navy, zIndex:10 }}>
          {[{ id:'pendientes', label:'Próximos' },{ id:'mias', label:'Mis predicciones' },{ id:'duelos', label:'Duelos 1v1' },{ id:'ranking', label:'Ranking' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', transition:'all .15s', background: tab===t.id ? S.cyan : S.card, color: tab===t.id ? '#000' : S.muted, position:'relative' }}>
              {t.label}
              {t.id === 'duelos' && retosRecibidos.length > 0 && (
                <span style={{ position:'absolute', top:'-4px', right:'-4px', background:S.loss, color:'#fff', borderRadius:'50%', width:'16px', height:'16px', fontSize:'.6rem', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center' }}>{retosRecibidos.length}</span>
              )}
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

        {/* TAB: Duelos 1v1 */}
        {tab === 'duelos' && (
          <div>
            <div style={{ background:S.card, borderRadius:'14px', padding:'14px 16px', marginBottom:'14px', border:`0.5px solid ${S.border}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'20px', marginBottom:'10px' }}>
                <div>
                  <div style={{ fontSize:'.62rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.08em' }}>🎓 Saldo Demo</div>
                  <div style={{ fontSize:'1.15rem', fontWeight:'900', color: miSaldoDemo >= 0 ? S.muted : S.loss }}>{Math.round(miSaldoDemo*10)/10} pts</div>
                </div>
                <div>
                  <div style={{ fontSize:'.62rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.08em' }}>💰 Saldo Pago</div>
                  <div style={{ fontSize:'1.15rem', fontWeight:'900', color: miSaldoPago >= 0 ? S.gold : S.loss }}>{Math.round(miSaldoPago*10)/10} pts</div>
                </div>
              </div>
              <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'10px' }}>Puedes apostar hasta el 25% de tu saldo por duelo/apuesta, y solo contra alguien en tu mismo modo (demo con demo, pago con pago). No puedes participar en un partido donde tú (o a quien retes) estén jugando.</div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => { setModalReto({ rival:null, partido:null, equipo:null, monto:'' }); setBusquedaRival(''); setMsgReto(null) }}
                  style={{ flex:1, padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.82rem' }}>
                  ⚔️ Retar a alguien
                </button>
                <button onClick={() => { setModalPostura({ partido:null, equipo:null, monto:'' }); setMsgPostura(null) }}
                  style={{ flex:1, padding:'11px', background:S.card2, border:`1px solid ${S.cyan}`, borderRadius:'10px', cursor:'pointer', color:S.cyan, fontWeight:'800', fontSize:'.82rem' }}>
                  📢 Apuesta abierta
                </button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div style={{ display:'flex', gap:'4px', marginBottom:'14px' }}>
              {[{ id:'retos', label:'Retos directos' },{ id:'mercado', label:'Mercado abierto' }].map(t => (
                <button key={t.id} onClick={() => setSubTabDuelos(t.id)}
                  style={{ flex:1, padding:'7px 4px', borderRadius:'8px', cursor:'pointer', fontSize:'.72rem', fontWeight:'700', background: subTabDuelos===t.id ? S.card2 : 'transparent', color: subTabDuelos===t.id ? S.cyan : S.muted, border: subTabDuelos===t.id ? `1px solid ${S.cyan}` : `1px solid ${S.border}` }}>
                  {t.label}
                </button>
              ))}
            </div>

            {subTabDuelos === 'retos' ? (
              retosRecibidos.length === 0 && retosEnviados.length === 0 && duelosEnJuego.length === 0 && duelosResueltos.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 20px', color:S.muted }}><div style={{ fontSize:'2rem', marginBottom:'12px' }}>⚔️</div><div>Aún no tienes retos directos</div></div>
              ) : (
                <>
                  {retosRecibidos.length > 0 && (
                    <div style={{ marginBottom:'16px' }}>
                      <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.gold, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Te retaron</div>
                      {retosRecibidos.map(d => DueloCard(d))}
                    </div>
                  )}
                  {retosEnviados.length > 0 && (
                    <div style={{ marginBottom:'16px' }}>
                      <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Retos enviados</div>
                      {retosEnviados.map(d => DueloCard(d))}
                    </div>
                  )}
                  {duelosEnJuego.length > 0 && (
                    <div style={{ marginBottom:'16px' }}>
                      <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.cyan, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>En juego</div>
                      {duelosEnJuego.map(d => DueloCard(d))}
                    </div>
                  )}
                  {duelosResueltos.length > 0 && (
                    <div>
                      <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.muted, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Historial</div>
                      {duelosResueltos.map(d => DueloCard(d))}
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.gold, marginBottom:'8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Apuestas abiertas de todos</div>
                {partidosConMercado.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'24px 20px', color:S.muted, marginBottom:'16px' }}><div style={{ fontSize:'1.6rem', marginBottom:'8px' }}>📢</div><div style={{ fontSize:'.82rem' }}>No hay apuestas abiertas ahora mismo</div></div>
                ) : partidosConMercado.map(p => {
                  const { local, visitante } = resumenPosturasPartido(p.id)
                  const libreLocal = local.reduce((s,x) => s + (x.monto - x.monto_emparejado), 0)
                  const libreVisitante = visitante.reduce((s,x) => s + (x.monto - x.monto_emparejado), 0)
                  return (
                    <div key={p.id} style={{ marginBottom:'12px', background:S.card, borderRadius:'14px', padding:'12px 14px', border:`0.5px solid ${S.border}` }}>
                      <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'8px' }}>{p.tournaments?.name}</div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        {[{ eq:'local', nombre:p.home?.name, libre:libreLocal },{ eq:'visitante', nombre:p.away?.name, libre:libreVisitante }].map(col => (
                          <div key={col.eq} style={{ flex:1, background:S.navy, borderRadius:'10px', padding:'10px', border:`0.5px solid ${S.border}` }}>
                            <div style={{ fontSize:'.78rem', fontWeight:'700', color:S.text, marginBottom:'6px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{col.nombre}</div>
                            {col.libre > 0 ? (
                              <>
                                <div style={{ fontSize:'.7rem', color:S.gold, marginBottom:'6px' }}>{col.libre} pts libres</div>
                                <button onClick={() => { setModalPostura({ partido:p, equipo:col.eq, monto:'' }); setMsgPostura(null) }}
                                  style={{ width:'100%', padding:'6px', background:S.cyanDim, border:`1px solid ${S.cyan}`, borderRadius:'8px', cursor:'pointer', color:S.cyan, fontWeight:'700', fontSize:'.68rem' }}>
                                  + Igualar
                                </button>
                              </>
                            ) : (
                              <div style={{ fontSize:'.7rem', color:S.muted }}>Sin apuestas libres</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                <div style={{ fontSize:'.72rem', fontWeight:'700', color:S.muted, margin:'16px 0 8px', textTransform:'uppercase', letterSpacing:'.06em' }}>Mis apuestas abiertas</div>
                {misPosturas.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'24px 20px', color:S.muted }}><div style={{ fontSize:'.82rem' }}>Aún no has puesto ninguna</div></div>
                ) : misPosturas.slice().reverse().map(pu => PosturaCard(pu))}
              </>
            )}
          </div>
        )}

        {/* TAB: Ranking */}
        {tab === 'ranking' && (
          <div>
            <div style={{ display:'flex', gap:'4px', marginBottom:'14px' }}>
              {[{ id:'pago', label:'💰 Pago (premios)' },{ id:'demo', label:'🎓 Demo' }].map(t => (
                <button key={t.id} onClick={() => setRankingModo(t.id)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:'8px', cursor:'pointer', fontSize:'.74rem', fontWeight:'700', background: rankingModo===t.id ? S.card2 : 'transparent', color: rankingModo===t.id ? (t.id==='pago'?S.gold:S.text) : S.muted, border: rankingModo===t.id ? `1px solid ${t.id==='pago'?S.gold:S.border}` : `1px solid ${S.border}` }}>
                  {t.label}
                </button>
              ))}
            </div>
            {rankingModo === 'pago' && (
              <div style={{ fontSize:'.68rem', color:S.muted, marginBottom:'12px' }}>Este es el ranking que compite por los premios mensuales. #{miRankingActual || '—'} es tu posición.</div>
            )}
            {rankingActual.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', color:S.muted }}><div style={{ fontSize:'2rem', marginBottom:'12px' }}>🏆</div><div>Sin datos de ranking aún</div></div>
            ) : rankingActual.map((r, i) => {
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
