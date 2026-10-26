import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Star, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtHoraDate } from '../lib/horaHelpers'
import { useFavoritos } from '../lib/favoritos'
import { prefetchTorneoPublico, propsPrefetchTorneo } from '../lib/torneoPublicoDatos'
import BotonEstrella from './BotonEstrella'

// ── "Partidos de hoy" ───────────────────────────────────────────────────────
// Lista de partidos del día de TODOS los torneos, agrupada por torneo, como
// FotMob / Sofascore: es lo primero que alguien quiere ver al entrar ("¿a qué
// hora juega mi equipo?"). Se puede cambiar de día con las flechas, filtrar
// por estado y seguir equipos con la estrella (favoritos en el navegador).
//
// partidosVivo: los partidos en juego que ya calcula la landing (con marcador
// y reloj en vivo). Aquí solo se leen para pintar el marcador al instante.

const S = {
  card: '#161616', card2: '#1c1c1c', border: '#2a2a2a', green: '#6fcf3d',
  red: '#e5433d', gold: '#f5a623', text: '#ffffff', muted: '#8a8a8a',
}

const COLS = 'id, tournament_id, status, fase, matchday, played_at, location, cancha_id, home_score, away_score, home_team_id, away_team_id, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments!inner(name, logo_url)'
const FASES = { octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final' }

function inicioDia(offset) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d
}

function etiquetaDia(offset) {
  if (offset === 0) return 'Hoy'
  if (offset === -1) return 'Ayer'
  if (offset === 1) return 'Mañana'
  const t = inicioDia(offset).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function EscudoMini({ logo_url, name, size = 24 }) {
  const iniciales = (name || '?').split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: 7, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {logo_url
        ? <img src={logo_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}/>
        : <span style={{ fontSize: size * .36, fontWeight: 800, color: '#1a3a8a' }}>{iniciales}</span>}
    </div>
  )
}

const ESTILO = `
@keyframes gmPdPulso { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
.gm-pd-fila { box-sizing: border-box; display: grid; grid-template-columns: 30px minmax(0,1fr) 70px minmax(0,1fr) 30px; align-items: center; column-gap: 4px; padding: 9px 8px; min-height: 58px; cursor: pointer; border-top: 1px solid #242424; background: transparent; width: 100%; border-left: none; border-right: none; border-bottom: none; color: inherit; font-family: inherit; text-align: left; }
.gm-pd-fila:hover { background: #1c1c1c; }
.gm-pd-lugar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 4px; min-width: 0; margin-top: 5px; font-size: .66rem; font-weight: 600; color: #8a8a8a; }
.gm-pd-lugar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.gm-pd-eq { display: flex; align-items: center; gap: 7px; min-width: 0; }
.gm-pd-local { justify-content: flex-end; text-align: right; }
.gm-pd-nombre { font-size: .78rem; font-weight: 700; line-height: 1.15; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; word-break: break-word; min-width: 0; }
.gm-pd-chips::-webkit-scrollbar { display: none }
.gm-pd-cab { display: flex; align-items: center; gap: 11px; width: 100%; box-sizing: border-box; padding: 13px 14px; background: transparent; border: none; color: #fff; cursor: pointer; text-align: left; font-family: inherit; -webkit-tap-highlight-color: transparent; }
.gm-pd-cab:hover { background: #1b1b1b; }
.gm-pd-tit { font-weight: 800; font-size: .86rem; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; word-break: break-word; }
.gm-pd-sub { font-size: .7rem; color: #8a8a8a; font-weight: 600; margin-top: 3px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.gm-pd-chev { transition: transform .2s ease; flex-shrink: 0; }
.gm-pd-ver { display: block; width: 100%; box-sizing: border-box; padding: 11px 12px; background: transparent; border: none; border-top: 1px solid #242424; color: #6fcf3d; font-size: .74rem; font-weight: 800; cursor: pointer; font-family: inherit; }
.gm-pd-ver:hover { background: #1b1b1b; }
`

export default function PartidosDelDia({ partidosVivo = [], onVerDetalleVivo, senalVivo = 0 }) {
  const navigate = useNavigate()
  const { ids: favoritos, esFavorito, alternar } = useFavoritos()
  const [offset, setOffset] = useState(0)
  const [filtro, setFiltro] = useState('todos') // todos | vivo | proximos | finales | favoritos
  const [partidos, setPartidos] = useState([])
  const [cargado, setCargado] = useState(false)
  const [abiertos, setAbiertos] = useState({}) // torneo.id -> true/false (lo que la persona abrió o cerró a mano)
  const [extendidos, setExtendidos] = useState({}) // torneo.id -> true: ya pidió ver también los partidos que no están en vivo
  const cacheDias = useRef(new Map()) // offset -> partidos, para que volver a un día ya visto sea instantáneo

  const vivoPorId = useMemo(() => {
    const m = new Map()
    partidosVivo.forEach(p => { if (p.id && p.vivo) m.set(p.id, p) }) // el partido completo: trae .vivo (marcador/reloj) y .global (ida y vuelta)
    return m
  }, [partidosVivo])
  const nVivos = partidosVivo.length

  // Un partido que se está jugando ahora siempre cuenta para "hoy", aunque
  // todavía no tenga hora programada o su hora caiga en otro día.
  const lista = useMemo(() => {
    if (offset !== 0) return partidos
    const ya = new Set(partidos.map(m => m.id))
    const extra = partidosVivo.filter(m => m.id && m.vivo && !ya.has(m.id)).map(m => ({
      id: m.id, tournament_id: m.tournament_id, status: m.status, fase: m.fase, matchday: m.matchday,
      played_at: null, location: m.location || null, cancha_id: m.cancha_id || null, home_team_id: m.home_team_id, away_team_id: m.away_team_id,
      home: m.home, away: m.away, tournaments: { name: m.tournaments?.name, logo_url: null },
    }))
    return extra.length ? [...extra, ...partidos] : partidos
  }, [partidos, partidosVivo, offset])

  useEffect(() => {
    let cancelado = false
    const previo = cacheDias.current.get(offset)
    if (previo) { setPartidos(previo); setCargado(true) } else { setCargado(false) }

    async function cargar() {
      const ini = inicioDia(offset)
      const fin = inicioDia(offset + 1)
      const { data, error } = await supabase.from('matches').select(COLS)
        .gte('played_at', ini.toISOString()).lt('played_at', fin.toISOString())
        .order('played_at', { ascending: true })
      if (cancelado) return
      if (!error) {
        const lista = data || []
        cacheDias.current.set(offset, lista)
        setPartidos(lista)
      }
      setCargado(true)
    }
    cargar()

    // Solo "hoy" se refresca solo (un partido que termina pasa a "FIN").
    let timer = null
    if (offset === 0) timer = setInterval(() => { if (!document.hidden) cargar() }, 60000)
    return () => { cancelado = true; if (timer) clearInterval(timer) }
  }, [offset, nVivos])

  // "VER EN VIVO" del inicio: vuelve a hoy y deja solo los partidos en juego.
  useEffect(() => {
    if (!senalVivo) return
    setOffset(0)
    setFiltro(nVivos > 0 ? 'vivo' : 'todos')
  }, [senalVivo])

  // Escenario y cancha donde se juega cada partido. matches.location guarda el nombre de la cancha y el
  // escenario vive en la tabla canchas (a veces no tiene). Se piden las canchas de los torneos que salen hoy.
  const [canchasPorTorneo, setCanchasPorTorneo] = useState({})
  const torneosKey = useMemo(() => [...new Set(lista.map(m => m.tournament_id).filter(Boolean))].sort().join(','), [lista])
  useEffect(() => {
    const ids = torneosKey ? torneosKey.split(',').filter(id => !(id in canchasPorTorneo)) : []
    if (ids.length === 0) return
    let cancelado = false
    supabase.from('canchas').select('id, nombre, escenario, tournament_id').in('tournament_id', ids).then(({ data, error }) => {
      if (cancelado || error) return
      setCanchasPorTorneo(prev => {
        const sig = { ...prev }
        ids.forEach(id => { sig[id] = [] })
        ;(data || []).forEach(c => { sig[c.tournament_id].push(c) })
        return sig
      })
    }, () => {})
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneosKey])

  // "Escenario · Cancha". Si no se sabe el escenario, solo el nombre de la cancha que guardó el partido.
  function lugarDe(m) {
    const canchas = canchasPorTorneo[m.tournament_id] || []
    let c = m.cancha_id != null && m.cancha_id !== '' ? canchas.find(x => String(x.id) === String(m.cancha_id)) : null
    if (!c && m.location) {
      const coinc = canchas.filter(x => x.nombre === m.location)
      if (coinc.length === 1) c = coinc[0] // mismo nombre en dos escenarios: no se adivina cuál
    }
    const cancha = c?.nombre || m.location || ''
    const escenario = c?.escenario && c.escenario !== cancha ? c.escenario : ''
    return [escenario, cancha].filter(Boolean).join(' · ')
  }

  const estadoDe = m => vivoPorId.has(m.id) ? 'vivo' : m.status === 'finished' ? 'final' : 'proximo'

  const conteo = useMemo(() => {
    const c = { todos: lista.length, vivo: 0, proximos: 0, finales: 0, favoritos: 0 }
    lista.forEach(m => {
      const e = estadoDe(m)
      if (e === 'vivo') c.vivo++
      else if (e === 'final') c.finales++
      else c.proximos++
      if (favoritos.includes(m.home_team_id) || favoritos.includes(m.away_team_id)) c.favoritos++
    })
    return c
  }, [lista, vivoPorId, favoritos])

  // Si estaba en "En vivo" y el último partido terminó, vuelve a "Todos" en vez de quedar vacío.
  useEffect(() => { if (filtro === 'vivo' && conteo.vivo === 0) setFiltro('todos') }, [filtro, conteo.vivo])

  const grupos = useMemo(() => {
    const visibles = lista.filter(m => {
      const e = estadoDe(m)
      if (filtro === 'vivo') return e === 'vivo'
      if (filtro === 'proximos') return e === 'proximo'
      if (filtro === 'finales') return e === 'final'
      if (filtro === 'favoritos') return favoritos.includes(m.home_team_id) || favoritos.includes(m.away_team_id)
      return true
    })
    const mapa = new Map()
    visibles.forEach(m => {
      if (!mapa.has(m.tournament_id)) mapa.set(m.tournament_id, { id: m.tournament_id, torneo: m.tournaments, partidos: [] })
      mapa.get(m.tournament_id).partidos.push(m)
    })
    const porTorneo = [...mapa.values()]
    // Los torneos con algo en vivo van primero; el resto por la hora de su primer partido.
    porTorneo.sort((a, b) => (b.partidos.some(m => vivoPorId.has(m.id)) ? 1 : 0) - (a.partidos.some(m => vivoPorId.has(m.id)) ? 1 : 0))
    return porTorneo
  }, [lista, filtro, vivoPorId, favoritos])

  function etiquetaRonda(g) {
    const set = new Set()
    g.partidos.forEach(m => {
      if (m.fase && m.fase !== 'grupo') set.add(FASES[m.fase] || 'Eliminatorias')
      else if (m.matchday) set.add(`Fecha ${m.matchday}`)
    })
    return [...set].slice(0, 2).join(' · ')
  }

  // Por defecto solo está abierto el torneo que tiene algo en vivo (o todos, si se filtra por "Mis equipos").
  // Un torneo con partido en vivo muestra SOLO el partido en vivo; los demás de ese torneo salen con un botón.
  const hayVivoEn = g => g.partidos.some(m => vivoPorId.has(m.id))
  const soloVivosEn = g => filtro === 'todos' && hayVivoEn(g) && !extendidos[g.id]
  const partidosVisibles = g => (soloVivosEn(g) ? g.partidos.filter(m => vivoPorId.has(m.id)) : g.partidos)
  const estaAbierto = g => (g.id in abiertos ? abiertos[g.id] : (hayVivoEn(g) || filtro === 'favoritos'))
  const todosAbiertos = grupos.length > 0 && grupos.every(estaAbierto)
  function alternarGrupo(g) { setAbiertos(a => ({ ...a, [g.id]: !estaAbierto(g) })) }
  function alternarTodos() {
    const nuevo = {}
    grupos.forEach(g => { nuevo[g.id] = !todosAbiertos })
    setAbiertos(a => ({ ...a, ...nuevo }))
  }
  function resumenGrupo(g) {
    const n = g.partidos.length
    const horas = g.partidos.map(m => m.played_at).filter(Boolean).sort()
    const h1 = horas.length ? fmtHoraDate(horas[0]) : ''
    const h2 = horas.length ? fmtHoraDate(horas[horas.length - 1]) : ''
    const todosFin = g.partidos.every(m => estadoDe(m) === 'final')
    return {
      n,
      cuando: todosFin ? 'Finalizados' : h1 && h2 && h1 !== h2 ? `${h1} – ${h2}` : h1,
    }
  }

  function abrir(m) {
    prefetchTorneoPublico(m.tournament_id)
    navigate('/t/' + m.tournament_id)
  }

  const chips = [
    ['todos', 'Todos'],
    ['vivo', 'En vivo'],
    ['proximos', 'Próximos'],
    ['finales', 'Finalizados'],
    ['favoritos', '★ Mis equipos'],
  ].filter(([k]) => k === 'todos' || k === 'favoritos' || conteo[k] > 0)

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 16px 8px' }}>
      <style>{ESTILO}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: nVivos > 0 ? S.red : S.green, display: 'inline-block', animation: nVivos > 0 ? 'gmPdPulso 1.2s ease-in-out infinite' : 'none' }}/>
          Partidos
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: S.card, border: `1px solid ${S.border}`, borderRadius: 999, padding: 3 }}>
          <button onClick={() => setOffset(o => Math.max(-30, o - 1))} aria-label="Día anterior" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: S.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={18}/></button>
          <button onClick={() => setOffset(0)} aria-label="Volver a hoy" style={{ minWidth: 86, border: 'none', background: 'transparent', color: offset === 0 ? S.green : S.text, fontWeight: 800, fontSize: '.8rem', cursor: 'pointer', padding: '0 4px' }}>{etiquetaDia(offset)}</button>
          <button onClick={() => setOffset(o => Math.min(30, o + 1))} aria-label="Día siguiente" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: S.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronRight size={18}/></button>
        </div>
      </div>

      <div className="gm-pd-chips" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12 }}>
        {chips.map(([k, txt]) => {
          const activo = filtro === k
          const rojo = k === 'vivo'
          const color = activo ? (rojo ? S.red : S.green) : S.muted
          return (
            <button key={k} onClick={() => setFiltro(k)} style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 999, border: `1px solid ${activo ? color : S.border}`, background: activo ? (rojo ? 'rgba(229,67,61,.15)' : 'rgba(111,207,61,.15)') : 'transparent', color, fontSize: '.74rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {txt} <span style={{ opacity: .75 }}>{conteo[k]}</span>
            </button>
          )
        })}
      </div>

      {!cargado && lista.length === 0 ? (
        <div aria-hidden="true" style={{ height: 120, borderRadius: 16, background: S.card, border: `1px solid ${S.border}`, animation: 'gmPdPulso 1.3s ease-in-out infinite' }}/>
      ) : grupos.length === 0 ? (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '26px 20px', textAlign: 'center', color: S.muted, fontSize: '.85rem', lineHeight: 1.5 }}>
          {filtro === 'favoritos' ? (
            favoritos.length === 0 ? (
              <>Toca la <Star size={13} style={{ verticalAlign: '-2px' }}/> junto al nombre de un equipo para seguirlo. Aquí verás solo sus partidos.</>
            ) : 'Tus equipos no juegan este día.'
          ) : lista.length === 0 ? (
            <>No hay partidos programados {offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : offset === -1 ? 'ayer' : 'este día'}.<br/>Usa las flechas para ver otros días.</>
          ) : 'No hay partidos con este filtro.'}
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 2px 10px', fontSize: '.74rem', color: S.muted, fontWeight: 600 }}>
          <span>{grupos.reduce((n, g) => n + g.partidos.length, 0)} partidos · {grupos.length} {grupos.length === 1 ? 'torneo' : 'torneos'}</span>
          {grupos.length > 1 && (
            <button type="button" onClick={alternarTodos} style={{ background: 'none', border: 'none', color: S.green, fontWeight: 800, fontSize: '.74rem', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>
              {todosAbiertos ? 'Cerrar todos' : 'Abrir todos'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grupos.map(g => (
            <div key={g.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, overflow: 'hidden' }}>
              {(() => {
                const abierto = estaAbierto(g)
                const vivo = hayVivoEn(g)
                const r = resumenGrupo(g)
                const ronda = etiquetaRonda(g)
                return (
                  <button type="button" className="gm-pd-cab" aria-expanded={abierto} onClick={() => alternarGrupo(g)} {...propsPrefetchTorneo(g.id)}
                    style={{ background: abierto ? S.card2 : undefined }}>
                    <EscudoMini logo_url={g.torneo?.logo_url} name={g.torneo?.name} size={32}/>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="gm-pd-tit" style={{ display: '-webkit-box' }}>{g.torneo?.name}</span>
                      <span className="gm-pd-sub">
                        {vivo && <span style={{ color: S.red, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: S.red, animation: 'gmPdPulso 1.2s ease-in-out infinite' }}/>EN VIVO</span>}
                        {ronda && <span>{ronda}</span>}
                        <span>{r.n} {r.n === 1 ? 'partido' : 'partidos'}</span>
                        {r.cuando && <span>{r.cuando}</span>}
                      </span>
                    </span>
                    <ChevronDown className="gm-pd-chev" size={18} color={S.muted} style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
                  </button>
                )
              })()}
              {estaAbierto(g) && partidosVisibles(g).map(m => {
                const e = estadoDe(m)
                const pv = vivoPorId.get(m.id)
                const v = pv?.vivo
                const favL = esFavorito(m.home_team_id), favV = esFavorito(m.away_team_id)
                return (
                  <div key={m.id} className="gm-pd-fila" role="link" tabIndex={0}
                    onClick={() => (e === 'vivo' && onVerDetalleVivo ? onVerDetalleVivo(m.id) : abrir(m))}
                    onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); e === 'vivo' && onVerDetalleVivo ? onVerDetalleVivo(m.id) : abrir(m) } }}
                    {...propsPrefetchTorneo(m.tournament_id)}
                    style={{ background: (favL || favV) ? 'rgba(111,207,61,.06)' : undefined }}>
                    <BotonEstrella activo={favL} onClick={() => alternar(m.home_team_id)} nombre={m.home?.name}/>
                    <div className="gm-pd-eq gm-pd-local">
                      <span className="gm-pd-nombre">{m.home?.name}</span>
                      <EscudoMini logo_url={m.home?.logo_url} name={m.home?.name}/>
                    </div>
                    <div style={{ textAlign: 'center', lineHeight: 1.15 }}>
                      {e === 'vivo' ? (
                        <>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: S.red }}>{v.golesLocal} - {v.golesVis}</div>
                          <div style={{ fontSize: '.58rem', fontWeight: 800, color: S.red, animation: 'gmPdPulso 1.2s ease-in-out infinite' }}>{v.descanso ? 'DESCANSO' : (v.reloj || 'EN VIVO')}</div>
                          {pv.global && <div style={{ fontSize: '.55rem', fontWeight: 800, color: S.gold }}>Global {pv.global.local}-{pv.global.visitante}</div>}
                          {onVerDetalleVivo && <div style={{ fontSize: '.52rem', fontWeight: 700, color: S.muted, marginTop: 1 }}>ver goles ›</div>}
                        </>
                      ) : e === 'final' ? (
                        <>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>{m.home_score ?? 0} - {m.away_score ?? 0}</div>
                          <div style={{ fontSize: '.58rem', fontWeight: 800, color: S.muted }}>FIN</div>
                        </>
                      ) : (
                        <div style={{ fontWeight: 800, fontSize: '.8rem', color: S.green }}>{fmtHoraDate(m.played_at)}</div>
                      )}
                    </div>
                    <div className="gm-pd-eq">
                      <EscudoMini logo_url={m.away?.logo_url} name={m.away?.name}/>
                      <span className="gm-pd-nombre">{m.away?.name}</span>
                    </div>
                    <BotonEstrella activo={favV} onClick={() => alternar(m.away_team_id)} nombre={m.away?.name}/>
                    {lugarDe(m) && (
                      <div className="gm-pd-lugar"><MapPin size={11} style={{ flexShrink: 0 }}/><span>{lugarDe(m)}</span></div>
                    )}
                  </div>
                )
              })}
              {estaAbierto(g) && soloVivosEn(g) && g.partidos.length > partidosVisibles(g).length && (
                <button type="button" className="gm-pd-ver" onClick={() => setExtendidos(x => ({ ...x, [g.id]: true }))}>
                  Ver {g.partidos.length - partidosVisibles(g).length === 1 ? 'el otro partido' : `los otros ${g.partidos.length - partidosVisibles(g).length} partidos`} de hoy ›
                </button>
              )}
              {estaAbierto(g) && (
                <button type="button" className="gm-pd-ver" onClick={() => { prefetchTorneoPublico(g.id); navigate('/t/' + g.id) }}>Ver torneo completo ›</button>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
