import { useState } from 'react'
import { ChevronRight, ChevronDown, BarChart3, History, Trophy } from 'lucide-react'
import { J, FD, FT, HEXAGONO } from './juegoEstilo'
import { Panel, Desplegable, BotonJuego, Escudo, Contador, Chip, FormaReciente, HojaJuego } from './juegoUI'

// ── Mi carrera, en el inicio del jugador (estilo videojuego, en secciones desplegables) ──
// Tres secciones que el jugador abre si quiere verlas; cerradas muestran solo un resumen corto:
//  1. MI CARRERA: marcador grande de ganados / empates / perdidos y sus números (arquero: arcos en cero y goles
//     recibidos; jugador de campo: goles y tarjetas), MVP y títulos.
//     TODO SE PUEDE TOCAR: "Ganados" abre la lista de los partidos que ganó, "Empates" los empatados, "Perdidos"
//     los perdidos, "Arcos en cero" los partidos sin goles en contra, "MVP" los partidos donde fue el mejor, y
//     "Títulos" sus campeonatos y subcampeonatos + hasta dónde llegó su equipo en CADA torneo.
//  2. ÚLTIMOS PARTIDOS: "10-4 GANAMOS vs La Cecilia", con su equipo siempre primero en el marcador.
//  3. MIS TORNEOS: cada torneo es desplegable. Cerrado: escudo, nombre y cómo le fue (campeón, subcampeón, 3.º, 4.º,
//     eliminado en semifinal…, en juego). Abierto: sus números en ese torneo, premios y el botón para ver sus partidos.
// historial: filas de player_match_stats con matches(…fase, ronda, home_team_id, away_team_id, home, away),
//            tournaments, teams y es_mvp.
// logros: filas de tournament_logros del jugador (tipo, match_id, tournament_id, team_id).
//
// Hasta dónde llegó en cada torneo: sale de lo que el organizador guarda al cerrar el torneo (campeón, subcampeón,
// tercer puesto, semifinal, cuartos, octavos o fase de grupos). El CUARTO puesto se reconoce solo: llegó a
// semifinal y perdió el partido por el tercer puesto. Si el torneo todavía no se cierra, dice "En juego" y
// hasta qué fase ha jugado.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const RESULTADO = {
  win:  { texto: 'Ganamos',   color: J.green },
  draw: { texto: 'Empatamos', color: J.gris },
  loss: { texto: 'Perdimos',  color: J.red },
}
// Premios individuales del torneo (aparte de la fase)
const PREMIOS = {
  goleador:            { icono: '⚽', texto: 'Goleador del torneo' },
  valla_menos_vencida: { icono: '🧤', texto: 'Valla menos vencida' },
  mejor_jugador:       { icono: '⭐', texto: 'Mejor jugador' },
  mejor_arquero:       { icono: '🧤', texto: 'Mejor arquero' },
  mejor_portero:       { icono: '🧤', texto: 'Mejor arquero' },
}
// Hasta dónde llegó el equipo (de mejor a peor)
const RESULTADO_TORNEO = {
  campeon:       { rango: 1, icono: '🏆', texto: 'Campeón',                         color: J.gold, medalla: true },
  subcampeon:    { rango: 2, icono: '🥈', texto: 'Subcampeón',                      color: '#cfd8dc', medalla: true },
  tercer_puesto: { rango: 3, icono: '🥉', texto: 'Tercer puesto',                   color: '#e0a36b', medalla: true },
  cuarto_puesto: { rango: 4, icono: '4️⃣', texto: 'Cuarto puesto',                   color: J.text2 },
  semifinal:     { rango: 5, icono: '⚡', texto: 'Eliminado en semifinal',          color: J.text2 },
  cuartos:       { rango: 6, icono: '🔥', texto: 'Eliminado en cuartos de final',   color: J.text2 },
  octavos:       { rango: 7, icono: '⚔️', texto: 'Eliminado en octavos de final',   color: J.text2 },
  fase_grupos:   { rango: 8, icono: '🏟️', texto: 'Eliminado en la fase de grupos',  color: J.muted },
}
const NOMBRE_FASE = { octavos: 'octavos de final', cuartos: 'cuartos de final', semifinal: 'semifinal', final: 'la final' }
const PESO_FASE = { octavos: 1, cuartos: 2, semifinal: 3, final: 4 }

const fechaCorta = iso => { const d = iso ? new Date(iso) : null; return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '' }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const esTercerPuesto = m => /tercer/i.test(m?.ronda || '')

// Marcador y rival desde el lado del jugador (su equipo primero)
function ladoDelJugador(h) {
  const m = h.matches || {}
  const deVisita = !!(h.team_id && m.away_team_id && h.team_id === m.away_team_id)
  return {
    propios: deVisita ? m.away_score : m.home_score,
    ajenos:  deVisita ? m.home_score : m.away_score,
    rival:   deVisita ? m.home : m.away,
  }
}

// ¿Hasta dónde llegó en este torneo? → { clave, ...RESULTADO_TORNEO[clave] } o { enJuego, fase, ... }
//  1. Lo que guardó el organizador al cerrar el torneo (lo más confiable).
//  2. Si no hay nada guardado, se deduce de sus partidos de eliminación: perdió la final → subcampeón,
//     ganó el partido por el 3.º → tercero, perdió una semifinal ya jugada en un torneo viejo → eliminado ahí…
//     (los cruces de ida y vuelta no se deducen: un partido de ida no define nada).
function resultadoDelTorneo(filas, logrosDelTorneo) {
  const FASE_GUARDADA = { campeon: 1, campeonato: 1, subcampeon: 2, final: 2, tercer_puesto: 3, semifinal: 5, cuartos: 6, octavos: 7, fase_grupos: 8 }
  let mejor = null
  ;(logrosDelTorneo || []).forEach(l => {
    const r = FASE_GUARDADA[l.tipo]
    if (r && (!mejor || r < FASE_GUARDADA[mejor])) mejor = l.tipo
  })
  const partidoTercero = filas.find(h => esTercerPuesto(h.matches))
  if (mejor) {
    let clave = mejor === 'campeonato' ? 'campeon' : mejor === 'final' ? 'subcampeon' : mejor
    // Llegó a semifinal y jugó el partido por el tercer puesto: ganó → 3.º, perdió → 4.º
    if (clave === 'semifinal' && partidoTercero) clave = partidoTercero.team_result === 'win' ? 'tercer_puesto' : partidoTercero.team_result === 'loss' ? 'cuarto_puesto' : clave
    return { clave, ...RESULTADO_TORNEO[clave] }
  }

  // Sin fase guardada: se mira el partido de eliminación más alto que jugó
  const idaVuelta = m => /\((ida|vuelta)\)/i.test(m?.ronda || '')
  let alto = null
  filas.forEach(h => {
    const f = h.matches?.fase
    if (PESO_FASE[f] && !esTercerPuesto(h.matches) && (!alto || PESO_FASE[f] > PESO_FASE[alto.matches.fase])) alto = h
  })
  const ultimo = Math.max(...filas.map(h => new Date(h.matches?.played_at || 0).getTime()))
  const reciente = Date.now() - ultimo < 60 * 24 * 60 * 60 * 1000
  const fase = alto?.matches?.fase || null
  const definido = alto && !idaVuelta(alto.matches) && (alto.team_result === 'win' || alto.team_result === 'loss')
  if (definido && fase === 'final') {
    const clave = alto.team_result === 'win' ? 'campeon' : 'subcampeon'
    return { clave, ...RESULTADO_TORNEO[clave] }
  }
  if (partidoTercero && !idaVuelta(partidoTercero.matches) && partidoTercero.team_result !== 'draw') {
    const clave = partidoTercero.team_result === 'win' ? 'tercer_puesto' : 'cuarto_puesto'
    return { clave, ...RESULTADO_TORNEO[clave] }
  }
  if (definido && alto.team_result === 'loss') return { clave: fase, ...RESULTADO_TORNEO[fase] }
  const SIGUIENTE = { octavos: 'cuartos de final', cuartos: 'semifinal', semifinal: 'la final' }
  if (reciente) {
    const texto = !fase ? 'En juego' : definido && alto.team_result === 'win' && SIGUIENTE[fase] ? `En juego · pasó a ${SIGUIENTE[fase]}` : `En juego · llegó a ${NOMBRE_FASE[fase]}`
    return { enJuego: true, fase, icono: '⏳', texto, color: J.green, rango: 9 }
  }
  if (fase) return { fase, icono: '📋', texto: `Llegó a ${NOMBRE_FASE[fase]}`, color: J.text2, rango: 8.5 }
  return { icono: '📋', texto: 'Torneo terminado', color: J.muted, rango: 10 }
}

// Un número grande del marcador (Ganados / Empates / Perdidos), se puede tocar
function Marcador({ valor, texto, color, onClick }) {
  return (
    <button type="button" onClick={onClick} className="gj-boton" aria-label={`Ver mis partidos: ${texto}`}
      style={{ textAlign: 'center', padding: '10px 4px 8px', background: `linear-gradient(180deg, ${color}22, rgba(0,0,0,.25))`, border: 'none', borderTop: `3px solid ${color}`, boxShadow: `0 -6px 18px -8px ${color}`, borderRadius: '4px 4px 10px 10px', cursor: 'pointer', color: J.text, fontFamily: FT }}>
      <div style={{ fontFamily: FD, fontSize: '3rem', lineHeight: .9, color, textShadow: `0 0 18px ${color}66` }}><Contador valor={valor}/></div>
      <div style={{ fontWeight: 800, fontSize: '.95rem', marginTop: 4 }}>{texto}</div>
      <div style={{ fontSize: '.78rem', fontWeight: 700, color, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>Ver <ChevronRight size={14} strokeWidth={3}/></div>
    </button>
  )
}

// Ficha de estadística: ícono en hexágono, número grande y qué significa (si tiene onClick, se puede tocar)
function Ficha({ icono, valor, titulo, detalle, color = J.green, onClick }) {
  const contenido = (
    <Panel corte={12} borde={`linear-gradient(150deg, ${color}99, ${color}11 45%, rgba(255,255,255,.06))`} fondo={`linear-gradient(160deg, ${color}14, transparent 55%), #121513`} style={{ marginBottom: 0, height: '100%' }} interior={{ height: '100%' }}>
      <div style={{ padding: 12, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: `${color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>{icono}</span>
          <span style={{ fontFamily: FD, fontSize: '2.5rem', lineHeight: .9, color: J.text, textShadow: `0 0 16px ${color}55` }}><Contador valor={valor}/></span>
          {onClick && <ChevronRight size={20} color={color} strokeWidth={3} style={{ marginLeft: 'auto' }}/>}
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.02rem', color, marginTop: 8, lineHeight: 1.15 }}>{titulo}</div>
        {detalle && <div style={{ fontSize: '.9rem', color: J.text2, marginTop: 3, lineHeight: 1.3 }}>{detalle}</div>}
      </div>
    </Panel>
  )
  if (!onClick) return contenido
  return (
    <button type="button" onClick={onClick} className="gj-boton" aria-label={`Ver: ${titulo}`}
      style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: J.text, fontFamily: FT }}>
      {contenido}
    </button>
  )
}

// Un partido en una fila: marcador grande con su color, rival, fecha, equipo y lo que hizo el jugador
function FilaPartido({ h, esPortero, onClick, retraso = 0 }) {
  const r = RESULTADO[h.team_result] || { texto: 'Jugado', color: J.muted }
  const { propios, ajenos, rival } = ladoDelJugador(h)
  const chips = []
  if (h.es_mvp) chips.push({ t: '⭐ MVP', c: J.gold })
  if (esPortero && h.fue_arquero !== false && (h.goals_conceded || 0) === 0) chips.push({ t: '🧤 Arco en cero', c: J.green })
  if ((h.goals_scored || 0) > 0) chips.push({ t: `⚽ ${plural(h.goals_scored, 'gol', 'goles')}`, c: J.green })
  if ((h.red_cards || 0) > 0) chips.push({ t: '🟥 Roja', c: J.red })
  else if ((h.yellow_cards || 0) > 0) chips.push({ t: '🟨 Amarilla', c: J.gold })
  const fase = h.matches?.fase && NOMBRE_FASE[h.matches.fase] ? (esTercerPuesto(h.matches) ? 'Tercer puesto' : (n => n.charAt(0).toUpperCase() + n.slice(1))(NOMBRE_FASE[h.matches.fase].replace(/^la /, ''))) : null
  const Etiqueta = onClick ? 'button' : 'div'
  return (
    <Etiqueta {...(onClick ? { type: 'button', onClick } : {})} className={`gj-abre${onClick ? ' gj-boton' : ''}`}
      style={{ width: '100%', display: 'flex', alignItems: 'stretch', padding: 0, border: 'none', cursor: onClick ? 'pointer' : 'default', textAlign: 'left', color: J.text, fontFamily: FT,
        background: `linear-gradient(90deg, ${r.color}26, rgba(255,255,255,.03) 50%)`, borderRadius: 10, overflow: 'hidden', animationDelay: `${retraso}s` }}>
      <span aria-hidden="true" style={{ width: 5, flexShrink: 0, background: r.color, boxShadow: `0 0 12px ${r.color}` }}/>
      <span style={{ width: 86, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px' }}>
        <span style={{ fontFamily: FD, fontSize: '2rem', lineHeight: .95, color: r.color, letterSpacing: '.02em' }}>{propios != null ? `${propios}-${ajenos}` : '–'}</span>
        <span style={{ fontWeight: 800, fontSize: '.82rem', color: r.color, marginTop: 3 }}>{r.texto}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0, padding: '10px 8px 10px 2px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}><span style={{ color: J.muted, fontWeight: 600 }}>vs </span>{rival?.name || 'Rival'}</span>
        <span style={{ fontSize: '.9rem', color: J.text2, marginTop: 2 }}>{fechaCorta(h.matches?.played_at)}{h.teams?.name ? ` · con ${h.teams.name}` : ''}</span>
        {(h.tournaments?.name || fase) && <span style={{ fontSize: '.82rem', color: J.muted, marginTop: 2 }}>{[h.tournaments?.name, fase && `🏆 ${fase}`].filter(Boolean).join(' · ')}</span>}
        {chips.length > 0 && <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{chips.map(c => <Chip key={c.t} color={c.c}>{c.t}</Chip>)}</span>}
      </span>
    </Etiqueta>
  )
}

// Lista de partidos para la hoja de detalle
function ListaPartidos({ filas, esPortero, vacio }) {
  if (!filas.length) return <div style={{ fontSize: '1.05rem', color: J.text2, lineHeight: 1.45, padding: '14px 4px' }}>{vacio}</div>
  return <div style={{ display: 'grid', gap: 8 }}>{filas.map((h, i) => <FilaPartido key={h.id || i} h={h} esPortero={esPortero} retraso={Math.min(i, 10) * .03}/>)}</div>
}

// Medalla grande para la hoja de títulos
function Medalla({ icono, valor, texto, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px 8px 12px', borderRadius: 14, background: `radial-gradient(80% 80% at 50% 20%, ${color}33, transparent 70%), rgba(255,255,255,.04)`, border: `1px solid ${color}66` }}>
      <div style={{ fontSize: '2.2rem', lineHeight: 1 }}>{icono}</div>
      <div style={{ fontFamily: FD, fontSize: '2.8rem', lineHeight: .9, color, marginTop: 6, textShadow: `0 0 16px ${color}66` }}><Contador valor={valor}/></div>
      <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: 4 }}>{texto}</div>
    </div>
  )
}

// Pastilla con el resultado del torneo (campeón dorado, subcampeón plateado, tercero bronce…)
function PastillaResultado({ res, chica = false }) {
  return (
    <span style={{ display: 'inline-block', fontWeight: 900, fontSize: chica ? '.88rem' : '.95rem', padding: chica ? '2px 9px' : '4px 12px', borderRadius: 8, lineHeight: 1.3,
      ...(res.medalla ? { color: '#1a1200', background: `linear-gradient(180deg, #ffffff66, ${res.color})` } : { color: res.color, background: 'rgba(255,255,255,.08)' }) }}>
      {res.icono} {res.texto}
    </span>
  )
}

// Un número del resumen de un torneo
function Dato({ valor, texto, color = J.text }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 2px', background: 'rgba(255,255,255,.04)', borderRadius: 10, borderTop: `2px solid ${color}` }}>
      <div style={{ fontFamily: FD, fontSize: '1.9rem', lineHeight: .95, color }}>{valor}</div>
      <div style={{ fontSize: '.8rem', fontWeight: 700, color: J.text2, marginTop: 3 }}>{texto}</div>
    </div>
  )
}

// Un torneo: cerrado se ve solo el escudo, el nombre y cómo le fue; al tocarlo se abre con sus números
function TorneoDesplegable({ t, esPortero, onVerPartidos, abiertoPorDefecto = false }) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto)
  const res = t.resultado
  const brilla = res.clave === 'campeon'
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12,
      background: brilla ? `linear-gradient(135deg, ${J.gold}26, rgba(255,255,255,.03) 60%)` : res.medalla ? `linear-gradient(135deg, ${res.color}1a, rgba(255,255,255,.03) 60%)` : 'rgba(255,255,255,.035)',
      border: `1px solid ${res.medalla ? res.color + '77' : abierto ? 'rgba(255,255,255,.18)' : J.linea}`, boxShadow: brilla ? `0 0 20px -8px ${J.gold}88` : 'none' }}>
      {brilla && <span aria-hidden="true" style={{ position: 'absolute', right: -6, top: -12, fontSize: '3.6rem', opacity: .13, transform: 'rotate(12deg)', pointerEvents: 'none' }}>🏆</span>}
      <button type="button" onClick={() => setAbierto(a => !a)} aria-expanded={abierto} className="gj-boton"
        style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: J.text, fontFamily: FT }}>
        <Escudo url={t.logo || t.equipo?.logo_url} nombre={t.nombre} size={46}/>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '1.02rem', fontWeight: 800, lineHeight: 1.2 }}>{t.nombre}</span>
          <span style={{ display: 'block', marginTop: 5 }}><PastillaResultado res={res} chica/></span>
        </span>
        <ChevronDown className="gj-flecha" size={22} color={J.text2} style={{ flexShrink: 0, transform: abierto ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {abierto && (
        <div className="gj-abre" style={{ position: 'relative', padding: '0 12px 12px' }}>
          {t.equipo?.name && <div style={{ fontSize: '.95rem', color: J.text2, marginBottom: 10 }}>Jugaste con <b style={{ color: J.text }}>{t.equipo.name}</b></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            <Dato valor={t.filas.length} texto={t.filas.length === 1 ? 'Jugado' : 'Jugados'}/>
            <Dato valor={t.g} texto={t.g === 1 ? 'Ganado' : 'Ganados'} color={J.green}/>
            <Dato valor={t.e} texto={t.e === 1 ? 'Empate' : 'Empates'} color={J.gris}/>
            <Dato valor={t.p} texto={t.p === 1 ? 'Perdido' : 'Perdidos'} color={J.red}/>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {esPortero
              ? <><Chip color={J.green}>🧤 {plural(t.enCero, 'arco en cero', 'arcos en cero')}</Chip><Chip color={J.text2}>🥅 {plural(t.recibidos, 'gol recibido', 'goles recibidos')}</Chip></>
              : <Chip color={J.green}>⚽ {plural(t.goles, 'gol', 'goles')}</Chip>}
            {t.mvp > 0 && <Chip color={J.gold}>⭐ {t.mvp} {t.mvp === 1 ? 'vez' : 'veces'} MVP</Chip>}
          </div>
          {t.premios.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {t.premios.map((x, i) => (
                <span key={i} style={{ fontWeight: 900, fontSize: '.92rem', color: '#2a1a00', background: `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})`, padding: '3px 10px', borderRadius: 8 }}>{x.icono} {x.texto}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <BotonJuego variante="contorno" onClick={() => onVerPartidos?.(t)}>Ver mis {plural(t.filas.length, 'partido', 'partidos')} de este torneo <ChevronRight size={18} color={J.green} strokeWidth={3}/></BotonJuego>
          </div>
        </div>
      )}
    </div>
  )
}

// Fila corta de un torneo (para la hoja de títulos)
function FilaTorneoCorta({ t }) {
  const res = t.resultado
  return (
    <div className="gj-abre" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12,
      background: res.medalla ? `linear-gradient(135deg, ${res.color}1f, rgba(255,255,255,.03) 60%)` : 'rgba(255,255,255,.035)', border: `1px solid ${res.medalla ? res.color + '77' : J.linea}` }}>
      <Escudo url={t.logo || t.equipo?.logo_url} nombre={t.nombre} size={42}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2 }}>{t.nombre}</div>
        {t.equipo?.name && <div style={{ fontSize: '.88rem', color: J.text2, marginTop: 2 }}>Con {t.equipo.name}</div>}
        <div style={{ marginTop: 5 }}><PastillaResultado res={res} chica/></div>
      </div>
    </div>
  )
}

function Subtitulo({ children }) {
  return <div style={{ fontSize: '.9rem', fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: J.muted, margin: '16px 2px 8px' }}>{children}</div>
}

export default function MiCarrera({ historial = [], logros = [], esPortero, onVerTodos, cargando }) {
  const [hoja, setHoja] = useState(null)   // qué detalle está abierto: 'win' | 'draw' | 'loss' | 'cero' | 'mvp' | 'goles' | 'tarjetas' | 'titulos'
  const [torneoAbierto, setTorneoAbierto] = useState(null)   // torneo cuyos partidos se están viendo en la hoja

  const partidos = [...(historial || [])]
    .filter(h => h.matches)
    .sort((a, b) => new Date(b.matches?.played_at || 0) - new Date(a.matches?.played_at || 0))
  const pj = partidos.length

  if (!pj) {
    return (
      <Desplegable id="carrera" icono={<BarChart3 size={22} color={J.green} strokeWidth={2.5}/>} color={J.green} titulo="Mi carrera" retraso={.1}
        resumen={cargando ? 'Cargando tus partidos…' : 'Todavía no has jugado partidos'}>
        <div style={{ fontSize: '1.02rem', color: J.text2, lineHeight: 1.45 }}>
          Cuando juegues tu primer partido, aquí vas a ver todo: cuántos ganaste, tus goles y tus torneos.
        </div>
      </Desplegable>
    )
  }

  const ganados   = partidos.filter(h => h.team_result === 'win')
  const empatados = partidos.filter(h => h.team_result === 'draw')
  const perdidos  = partidos.filter(h => h.team_result === 'loss')
  const enCero    = partidos.filter(h => h.fue_arquero !== false && (h.goals_conceded || 0) === 0)
  const conMvp    = partidos.filter(h => h.es_mvp)
  const conGol    = partidos.filter(h => (h.goals_scored || 0) > 0)
  const conTarjeta = partidos.filter(h => (h.yellow_cards || 0) + (h.blue_cards || 0) + (h.red_cards || 0) > 0)
  const g = ganados.length, e = empatados.length, p = perdidos.length
  const goles = partidos.reduce((s, h) => s + (h.goals_scored || 0), 0)
  const recibidos = partidos.reduce((s, h) => s + (h.goals_conceded || 0), 0)
  const tarjetas = partidos.reduce((s, h) => s + (h.yellow_cards || 0) + (h.blue_cards || 0) + (h.red_cards || 0), 0)

  // Racha actual (desde el partido más reciente)
  let racha = 0
  const tipoRacha = partidos[0]?.team_result
  for (const h of partidos) { if (h.team_result === tipoRacha) racha++; else break }

  // Torneos: agrupados (del más reciente al más viejo), con su resultado
  const porTorneo = []
  partidos.forEach(h => {
    const id = h.tournaments?.id || h.tournament_id || 'sin'
    let t = porTorneo.find(x => x.id === id)
    if (!t) { t = { id, nombre: h.tournaments?.name || 'Torneo', logo: h.tournaments?.logo_url || null, equipo: h.teams, filas: [] }; porTorneo.push(t) }
    t.filas.push(h)
  })
  porTorneo.forEach(t => {
    const delTorneo = (logros || []).filter(l => l.tournament_id === t.id)
    t.resultado = resultadoDelTorneo(t.filas, delTorneo)
    t.premios = delTorneo.map(l => PREMIOS[l.tipo]).filter(Boolean)
    t.g = t.filas.filter(h => h.team_result === 'win').length
    t.e = t.filas.filter(h => h.team_result === 'draw').length
    t.p = t.filas.filter(h => h.team_result === 'loss').length
    t.goles = t.filas.reduce((s, h) => s + (h.goals_scored || 0), 0)
    t.recibidos = t.filas.reduce((s, h) => s + (h.goals_conceded || 0), 0)
    t.mvp = t.filas.filter(h => h.es_mvp).length
    t.enCero = t.filas.filter(h => h.fue_arquero !== false && (h.goals_conceded || 0) === 0).length
  })
  const campeonatos    = porTorneo.filter(t => t.resultado.clave === 'campeon')
  const subcampeonatos = porTorneo.filter(t => t.resultado.clave === 'subcampeon')
  const terceros       = porTorneo.filter(t => t.resultado.clave === 'tercer_puesto')
  // Para la hoja de títulos: primero los mejores resultados, los torneos en juego al final
  const torneosPorResultado = [...porTorneo].sort((a, b) => a.resultado.rango - b.resultado.rango)

  const ultimo = partidos[0]
  const uRes = RESULTADO[ultimo.team_result]
  const uLado = ladoDelJugador(ultimo)

  // Qué muestra cada hoja de detalle
  const HOJAS = {
    win:      { titulo: 'Partidos ganados',   icono: '✅', color: J.green, filas: ganados,    vacio: 'Todavía no has ganado un partido. ¡El próximo es tuyo!' },
    draw:     { titulo: 'Partidos empatados', icono: '🤝', color: J.gris,  filas: empatados,  vacio: 'No has empatado ningún partido.' },
    loss:     { titulo: 'Partidos perdidos',  icono: '❌', color: J.red,   filas: perdidos,   vacio: 'No has perdido ningún partido. ¡Sigue así!' },
    cero:     { titulo: 'Arcos en cero',      icono: '🧤', color: J.green, filas: enCero,     vacio: 'Todavía no tienes partidos sin goles en contra.' },
    mvp:      { titulo: 'Partidos como MVP',  icono: '⭐', color: J.gold,  filas: conMvp,     vacio: 'Todavía no has sido el mejor jugador de un partido.' },
    goles:    { titulo: 'Partidos con gol',   icono: '⚽', color: J.green, filas: conGol,     vacio: 'Todavía no has marcado goles.' },
    tarjetas: { titulo: 'Partidos con tarjeta', icono: '🟨', color: J.gold, filas: conTarjeta, vacio: 'No tienes tarjetas. ¡Juego limpio!' },
  }
  const hojaPartidos = hoja && HOJAS[hoja]

  return (
    <>
      {/* 1. Mi carrera: marcador y números (todo se puede tocar) */}
      <Desplegable id="carrera" icono={<BarChart3 size={22} color={J.green} strokeWidth={2.5}/>} color={J.green} titulo="Mi carrera" retraso={.1}
        resumen={<>{plural(pj, 'partido', 'partidos')} · <b style={{ color: J.green }}>{plural(g, 'ganado', 'ganados')}</b></>}>
        <div style={{ fontSize: '.92rem', fontWeight: 600, color: J.muted, margin: '0 2px 8px' }}>👆 Toca cualquier número para ver los partidos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <Marcador valor={g} texto={g === 1 ? 'Ganado' : 'Ganados'} color={J.green} onClick={() => setHoja('win')}/>
          <Marcador valor={e} texto={e === 1 ? 'Empate' : 'Empates'} color={J.gris} onClick={() => setHoja('draw')}/>
          <Marcador valor={p} texto={p === 1 ? 'Perdido' : 'Perdidos'} color={J.red} onClick={() => setHoja('loss')}/>
        </div>
        <div style={{ display: 'flex', gap: 3, height: 9, marginTop: 12 }} aria-hidden="true">
          {[[g, J.green], [e, J.gris], [p, J.red]].filter(([n]) => n > 0).map(([n, c], i) => (
            <span key={i} className="gj-anim" style={{ width: `${(n / pj) * 100}%`, background: c, boxShadow: `0 0 10px ${c}88`, transform: 'skewX(-20deg)', transformOrigin: 'left', animation: `gjLlena .8s cubic-bezier(.2,.8,.2,1) ${.15 + i * .12}s both` }}/>
          ))}
        </div>
        {racha >= 2 && tipoRacha === 'win' && (
          <div style={{ marginTop: 12, textAlign: 'center', fontWeight: 800, fontSize: '1.05rem', color: J.gold }}>🔥 Llevas {racha} partidos seguidos ganando</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
          {esPortero ? (
            <>
              <Ficha icono="🧤" valor={enCero.length} titulo="Arcos en cero" detalle="Partidos sin que te hicieran gol" onClick={() => setHoja('cero')}/>
              <Ficha icono="🥅" valor={recibidos} titulo="Goles recibidos" detalle={`${(recibidos / pj).toFixed(1)} por partido`} color={J.red}/>
            </>
          ) : (
            <>
              <Ficha icono="⚽" valor={goles} titulo={goles === 1 ? 'Gol' : 'Goles'} detalle={`${(goles / pj).toFixed(1)} por partido`} onClick={() => setHoja('goles')}/>
              <Ficha icono="🟨" valor={tarjetas} titulo="Tarjetas" detalle={tarjetas === 0 ? '¡Juego limpio!' : 'Amarillas, azules y rojas'} color={J.gold} onClick={() => setHoja('tarjetas')}/>
            </>
          )}
          <Ficha icono="⭐" valor={conMvp.length} titulo={conMvp.length === 1 ? 'Vez MVP' : 'Veces MVP'} detalle="Mejor jugador del partido" color={J.gold} onClick={() => setHoja('mvp')}/>
          <Ficha icono="🏆" valor={campeonatos.length} titulo={campeonatos.length === 1 ? 'Título' : 'Títulos'} color={J.gold} onClick={() => setHoja('titulos')}
            detalle={subcampeonatos.length + terceros.length > 0 ? [subcampeonatos.length > 0 && `🥈 ${subcampeonatos.length} subcampeón`, terceros.length > 0 && `🥉 ${terceros.length} tercero`].filter(Boolean).join(' · ') : 'Campeonatos ganados'}/>
        </div>
      </Desplegable>

      {/* 2. Últimos partidos */}
      <Desplegable id="partidos" icono={<History size={22} color={J.azul} strokeWidth={2.5}/>} color={J.azul} titulo="Mis últimos partidos" retraso={.15}
        resumen={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <FormaReciente resultados={partidos.slice(0, 5).map(h => h.team_result)}/>
            {uRes && uLado.propios != null && <span>Último: <b style={{ color: uRes.color }}>{uLado.propios}-{uLado.ajenos}</b></span>}
          </span>
        }>
        <div style={{ display: 'grid', gap: 8, marginTop: 2 }}>
          {partidos.slice(0, 5).map((h, i) => <FilaPartido key={h.id || i} h={h} esPortero={esPortero} onClick={onVerTodos} retraso={i * .05}/>)}
        </div>
        <div style={{ marginTop: 10 }}>
          <BotonJuego variante="contorno" onClick={onVerTodos}>Ver todos mis partidos ({pj}) <ChevronRight size={20} color={J.green} strokeWidth={3}/></BotonJuego>
        </div>
      </Desplegable>

      {/* 3. Mis torneos */}
      <Desplegable id="torneos" icono={<Trophy size={22} color={J.gold} strokeWidth={2.5}/>} color={J.gold} titulo="Mis torneos" retraso={.2}
        resumen={<>{plural(porTorneo.length, 'torneo', 'torneos')}{campeonatos.length > 0 && <> · <b style={{ color: J.gold }}>{plural(campeonatos.length, 'título', 'títulos')} 🏆</b></>}{porTorneo.some(t => t.resultado.enJuego) && <> · <span style={{ color: J.green }}>{porTorneo.filter(t => t.resultado.enJuego).length} en juego</span></>}</>}>
        <div style={{ fontSize: '.92rem', fontWeight: 600, color: J.muted, margin: '0 2px 8px' }}>👆 Toca un torneo para ver cómo te fue</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {porTorneo.map(t => <TorneoDesplegable key={t.id} t={t} esPortero={esPortero} onVerPartidos={setTorneoAbierto}/>)}
        </div>
      </Desplegable>

      {/* Hoja de detalle: lista de partidos (ganados, empatados, perdidos, arcos en cero, MVP…) */}
      <HojaJuego abierta={!!hojaPartidos} onCerrar={() => setHoja(null)} color={hojaPartidos?.color} icono={hojaPartidos?.icono}
        titulo={hojaPartidos ? `${hojaPartidos.titulo} (${hojaPartidos.filas.length})` : ''}
        subtitulo={hojaPartidos ? 'Del más reciente al más antiguo' : ''}>
        {hojaPartidos && <ListaPartidos filas={hojaPartidos.filas} esPortero={esPortero} vacio={hojaPartidos.vacio}/>}
      </HojaJuego>

      {/* Hoja de detalle: partidos de un torneo */}
      <HojaJuego abierta={!!torneoAbierto} onCerrar={() => setTorneoAbierto(null)} color={J.gold} icono="🏆"
        titulo={torneoAbierto?.nombre || ''} subtitulo={torneoAbierto ? `${torneoAbierto.resultado.texto}${torneoAbierto.equipo?.name ? ` · con ${torneoAbierto.equipo.name}` : ''}` : ''}>
        {torneoAbierto && <ListaPartidos filas={torneoAbierto.filas} esPortero={esPortero} vacio="Sin partidos."/>}
      </HojaJuego>

      {/* Hoja de detalle: títulos (campeón, subcampeón, tercero) y hasta dónde llegó en cada torneo */}
      <HojaJuego abierta={hoja === 'titulos'} onCerrar={() => setHoja(null)} color={J.gold} icono="🏆" titulo="Mis títulos" subtitulo="Campeón, subcampeón, tercer puesto y cómo te fue en cada torneo">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <Medalla icono="🏆" valor={campeonatos.length} texto="Campeón" color={J.gold}/>
          <Medalla icono="🥈" valor={subcampeonatos.length} texto="Subcampeón" color="#cfd8dc"/>
          <Medalla icono="🥉" valor={terceros.length} texto="Tercero" color="#e0a36b"/>
        </div>
        {campeonatos.length > 0 && (<><Subtitulo>🏆 Campeón</Subtitulo><div style={{ display: 'grid', gap: 8 }}>{campeonatos.map(t => <FilaTorneoCorta key={t.id} t={t}/>)}</div></>)}
        {subcampeonatos.length > 0 && (<><Subtitulo>🥈 Subcampeón</Subtitulo><div style={{ display: 'grid', gap: 8 }}>{subcampeonatos.map(t => <FilaTorneoCorta key={t.id} t={t}/>)}</div></>)}
        {terceros.length > 0 && (<><Subtitulo>🥉 Tercer puesto</Subtitulo><div style={{ display: 'grid', gap: 8 }}>{terceros.map(t => <FilaTorneoCorta key={t.id} t={t}/>)}</div></>)}
        {campeonatos.length + subcampeonatos.length + terceros.length === 0 && (
          <div style={{ fontSize: '1.02rem', color: J.text2, lineHeight: 1.45, marginTop: 12 }}>Todavía no tienes títulos ni podios. ¡Vamos por el primero!</div>
        )}
        <Subtitulo>Hasta dónde llegaste en cada torneo</Subtitulo>
        <div style={{ display: 'grid', gap: 8 }}>
          {torneosPorResultado.map(t => <FilaTorneoCorta key={t.id} t={t}/>)}
        </div>
      </HojaJuego>
    </>
  )
}
