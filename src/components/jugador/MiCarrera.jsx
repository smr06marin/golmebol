import { ChevronRight, BarChart3, History, Trophy } from 'lucide-react'
import { J, FD, FT, HEXAGONO } from './juegoEstilo'
import { Panel, Desplegable, BotonJuego, Escudo, Contador, Chip, FormaReciente } from './juegoUI'

// ── Mi carrera, en el inicio del jugador (estilo videojuego, en secciones desplegables) ──
// Tres secciones que el jugador abre si quiere verlas; cerradas muestran solo un resumen corto:
//  1. MI CARRERA: marcador grande de ganados / empates / perdidos y sus números (arquero: arcos en cero y goles
//     recibidos; jugador de campo: goles y tarjetas), MVP y títulos.
//  2. ÚLTIMOS PARTIDOS: "10-4 GANAMOS vs La Cecilia", con su equipo siempre primero en el marcador.
//  3. MIS TORNEOS: con qué equipo, cómo le fue y lo que ganó (campeón, MVP, hasta dónde llegó…).
// historial: filas de player_match_stats con matches(…home_team_id, away_team_id, home, away), tournaments, teams y es_mvp.
// logros: filas de tournament_logros del jugador (tipo, match_id, tournament_id).

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const RESULTADO = {
  win:  { texto: 'Ganamos',   color: J.green },
  draw: { texto: 'Empatamos', color: J.gris },
  loss: { texto: 'Perdimos',  color: J.red },
}
const PREMIOS = {
  campeon:             { icono: '🏆', texto: 'Campeón' },
  subcampeon:          { icono: '🥈', texto: 'Subcampeón' },
  tercer_puesto:       { icono: '🥉', texto: 'Tercer puesto' },
  goleador:            { icono: '⚽', texto: 'Goleador del torneo' },
  valla_menos_vencida: { icono: '🧤', texto: 'Valla menos vencida' },
  mejor_jugador:       { icono: '⭐', texto: 'Mejor jugador' },
  mejor_arquero:       { icono: '🧤', texto: 'Mejor arquero' },
  mejor_portero:       { icono: '🧤', texto: 'Mejor arquero' },
}
const FASES = { final: 'Llegó a la final', semifinal: 'Llegó a semifinales', cuartos: 'Llegó a cuartos', octavos: 'Llegó a octavos' }

const fechaCorta = iso => { const d = iso ? new Date(iso) : null; return d ? `${d.getDate()} ${MESES[d.getMonth()]}` : '' }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

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

// Un número grande del marcador (Ganados / Empates / Perdidos)
function Marcador({ valor, texto, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 4px 9px', background: `linear-gradient(180deg, ${color}22, rgba(0,0,0,.25))`, borderTop: `3px solid ${color}`, boxShadow: `0 -6px 18px -8px ${color}`, borderRadius: '4px 4px 10px 10px' }}>
      <div style={{ fontFamily: FD, fontSize: '3rem', lineHeight: .9, color, textShadow: `0 0 18px ${color}66` }}><Contador valor={valor}/></div>
      <div style={{ fontWeight: 800, fontSize: '.95rem', color: J.text, marginTop: 4 }}>{texto}</div>
    </div>
  )
}

// Ficha de estadística: ícono en hexágono, número grande y qué significa
function Ficha({ icono, valor, titulo, detalle, color = J.green }) {
  return (
    <Panel corte={12} borde={`linear-gradient(150deg, ${color}99, ${color}11 45%, rgba(255,255,255,.06))`} fondo={`linear-gradient(160deg, ${color}14, transparent 55%), #121513`} style={{ marginBottom: 0 }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: `${color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem' }}>{icono}</span>
          <span style={{ fontFamily: FD, fontSize: '2.5rem', lineHeight: .9, color: J.text, textShadow: `0 0 16px ${color}55` }}><Contador valor={valor}/></span>
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.02rem', color, marginTop: 8, lineHeight: 1.15 }}>{titulo}</div>
        {detalle && <div style={{ fontSize: '.9rem', color: J.text2, marginTop: 3, lineHeight: 1.3 }}>{detalle}</div>}
      </div>
    </Panel>
  )
}

export default function MiCarrera({ historial = [], logros = [], esPortero, onVerTodos, cargando }) {
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

  const g = partidos.filter(h => h.team_result === 'win').length
  const e = partidos.filter(h => h.team_result === 'draw').length
  const p = partidos.filter(h => h.team_result === 'loss').length
  const goles = partidos.reduce((s, h) => s + (h.goals_scored || 0), 0)
  const recibidos = partidos.reduce((s, h) => s + (h.goals_conceded || 0), 0)
  const arcosCero = partidos.filter(h => h.fue_arquero !== false && (h.goals_conceded || 0) === 0).length
  const mvps = partidos.filter(h => h.es_mvp).length
  const tarjetas = partidos.reduce((s, h) => s + (h.yellow_cards || 0) + (h.blue_cards || 0) + (h.red_cards || 0), 0)
  const titulos = (logros || []).filter(l => l.tipo === 'campeon').length

  // Racha actual (desde el partido más reciente)
  let racha = 0
  const tipoRacha = partidos[0]?.team_result
  for (const h of partidos) { if (h.team_result === tipoRacha) racha++; else break }

  // Torneos: agrupados, del más reciente al más viejo
  const porTorneo = []
  partidos.forEach(h => {
    const id = h.tournaments?.id || h.tournament_id || 'sin'
    let t = porTorneo.find(x => x.id === id)
    if (!t) { t = { id, nombre: h.tournaments?.name || 'Torneo', logo: h.tournaments?.logo_url || null, equipo: h.teams, filas: [] }; porTorneo.push(t) }
    t.filas.push(h)
  })

  const ultimo = partidos[0]
  const uRes = RESULTADO[ultimo.team_result]
  const uLado = ladoDelJugador(ultimo)

  return (
    <>
      {/* 1. Mi carrera: marcador y números */}
      <Desplegable id="carrera" icono={<BarChart3 size={22} color={J.green} strokeWidth={2.5}/>} color={J.green} titulo="Mi carrera" retraso={.1}
        resumen={<>{plural(pj, 'partido', 'partidos')} · <b style={{ color: J.green }}>{plural(g, 'ganado', 'ganados')}</b></>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
          <Marcador valor={g} texto={g === 1 ? 'Ganado' : 'Ganados'} color={J.green}/>
          <Marcador valor={e} texto={e === 1 ? 'Empate' : 'Empates'} color={J.gris}/>
          <Marcador valor={p} texto={p === 1 ? 'Perdido' : 'Perdidos'} color={J.red}/>
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
              <Ficha icono="🧤" valor={arcosCero} titulo="Arcos en cero" detalle="Partidos sin que te hicieran gol"/>
              <Ficha icono="🥅" valor={recibidos} titulo="Goles recibidos" detalle={`${(recibidos / pj).toFixed(1)} por partido`} color={J.red}/>
            </>
          ) : (
            <>
              <Ficha icono="⚽" valor={goles} titulo={goles === 1 ? 'Gol' : 'Goles'} detalle={`${(goles / pj).toFixed(1)} por partido`}/>
              <Ficha icono="🟨" valor={tarjetas} titulo="Tarjetas" detalle={tarjetas === 0 ? '¡Juego limpio!' : 'Amarillas, azules y rojas'} color={J.gold}/>
            </>
          )}
          <Ficha icono="⭐" valor={mvps} titulo={mvps === 1 ? 'Vez MVP' : 'Veces MVP'} detalle="Mejor jugador del partido" color={J.gold}/>
          <Ficha icono="🏆" valor={titulos} titulo={titulos === 1 ? 'Título' : 'Títulos'} detalle="Torneos ganados" color={J.gold}/>
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
          {partidos.slice(0, 5).map((h, i) => {
            const r = RESULTADO[h.team_result] || { texto: 'Jugado', color: J.muted }
            const { propios, ajenos, rival } = ladoDelJugador(h)
            const chips = []
            if (h.es_mvp) chips.push({ t: '⭐ MVP', c: J.gold })
            if (esPortero && h.fue_arquero !== false && (h.goals_conceded || 0) === 0) chips.push({ t: '🧤 Arco en cero', c: J.green })
            if ((h.goals_scored || 0) > 0) chips.push({ t: `⚽ ${plural(h.goals_scored, 'gol', 'goles')}`, c: J.green })
            if ((h.red_cards || 0) > 0) chips.push({ t: '🟥 Roja', c: J.red })
            else if ((h.yellow_cards || 0) > 0) chips.push({ t: '🟨 Amarilla', c: J.gold })
            return (
              <button key={h.id || i} type="button" onClick={onVerTodos} className="gj-boton gj-abre"
                style={{ width: '100%', display: 'flex', alignItems: 'stretch', padding: 0, border: 'none', cursor: 'pointer', textAlign: 'left', color: J.text, fontFamily: FT,
                  background: `linear-gradient(90deg, ${r.color}26, rgba(255,255,255,.03) 50%)`, borderRadius: 10, overflow: 'hidden', animationDelay: `${i * .05}s` }}>
                <span aria-hidden="true" style={{ width: 5, background: r.color, boxShadow: `0 0 12px ${r.color}` }}/>
                <span style={{ width: 86, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 4px' }}>
                  <span style={{ fontFamily: FD, fontSize: '2rem', lineHeight: .95, color: r.color, letterSpacing: '.02em' }}>{propios != null ? `${propios}-${ajenos}` : '–'}</span>
                  <span style={{ fontWeight: 800, fontSize: '.82rem', color: r.color, marginTop: 3 }}>{r.texto}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0, padding: '10px 6px 10px 2px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}><span style={{ color: J.muted, fontWeight: 600 }}>vs </span>{rival?.name || 'Rival'}</span>
                  <span style={{ fontSize: '.9rem', color: J.text2, marginTop: 2 }}>{fechaCorta(h.matches?.played_at)}{h.teams?.name ? ` · con ${h.teams.name}` : ''}</span>
                  {chips.length > 0 && <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{chips.map(c => <Chip key={c.t} color={c.c}>{c.t}</Chip>)}</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 10 }}>
          <BotonJuego variante="contorno" onClick={onVerTodos}>Ver todos mis partidos ({pj}) <ChevronRight size={20} color={J.green} strokeWidth={3}/></BotonJuego>
        </div>
      </Desplegable>

      {/* 3. Mis torneos */}
      <Desplegable id="torneos" icono={<Trophy size={22} color={J.gold} strokeWidth={2.5}/>} color={J.gold} titulo="Mis torneos" retraso={.2}
        resumen={<>{plural(porTorneo.length, 'torneo', 'torneos')}{titulos > 0 && <> · <b style={{ color: J.gold }}>{plural(titulos, 'título', 'títulos')} 🏆</b></>}</>}>
        <div style={{ display: 'grid', gap: 10, marginTop: 2 }}>
          {porTorneo.map(t => {
            const tg = t.filas.filter(h => h.team_result === 'win').length
            const te = t.filas.filter(h => h.team_result === 'draw').length
            const tp = t.filas.filter(h => h.team_result === 'loss').length
            const tGoles = t.filas.reduce((s, h) => s + (h.goals_scored || 0), 0)
            const tRec = t.filas.reduce((s, h) => s + (h.goals_conceded || 0), 0)
            const tMvp = t.filas.filter(h => h.es_mvp).length
            const delTorneo = (logros || []).filter(l => l.tournament_id === t.id)
            const premios = delTorneo.map(l => PREMIOS[l.tipo]).filter(Boolean)
            const campeon = delTorneo.some(l => l.tipo === 'campeon')
            const fase = !premios.some(x => ['Campeón', 'Subcampeón', 'Tercer puesto'].includes(x.texto))
              ? ['final', 'semifinal', 'cuartos', 'octavos'].find(f => delTorneo.some(l => l.tipo === f)) : null
            return (
              <div key={t.id} className="gj-abre" style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, padding: 12,
                background: campeon ? `linear-gradient(135deg, ${J.gold}2e, rgba(255,255,255,.03) 60%)` : 'rgba(255,255,255,.035)',
                border: `1px solid ${campeon ? J.gold + '88' : J.linea}`, boxShadow: campeon ? `0 0 22px -6px ${J.gold}88` : 'none' }}>
                {campeon && <span aria-hidden="true" style={{ position: 'absolute', right: -8, top: -14, fontSize: '4.4rem', opacity: .15, transform: 'rotate(12deg)' }}>🏆</span>}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Escudo url={t.logo || t.equipo?.logo_url} nombre={t.nombre} size={46}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2 }}>{t.nombre}</div>
                    {t.equipo?.name && <div style={{ fontSize: '.92rem', color: J.text2, marginTop: 2 }}>Con {t.equipo.name}</div>}
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <Chip color={J.text2}>{plural(t.filas.length, 'partido', 'partidos')}</Chip>
                  {tg > 0 && <Chip color={J.green}>{plural(tg, 'ganado', 'ganados')}</Chip>}
                  {te > 0 && <Chip color={J.gris}>{plural(te, 'empate', 'empates')}</Chip>}
                  {tp > 0 && <Chip color={J.red}>{plural(tp, 'perdido', 'perdidos')}</Chip>}
                  {esPortero
                    ? <Chip color={J.text2}>{plural(tRec, 'gol recibido', 'goles recibidos')}</Chip>
                    : tGoles > 0 && <Chip color={J.green}>⚽ {plural(tGoles, 'gol', 'goles')}</Chip>}
                </div>
                {(premios.length > 0 || tMvp > 0 || fase) && (
                  <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {premios.map((x, i) => (
                      <span key={i} style={{ fontWeight: 900, fontSize: '.95rem', color: '#2a1a00', background: `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})`, padding: '4px 12px', borderRadius: 8, boxShadow: `0 0 14px ${J.gold}77` }}>{x.icono} {x.texto}</span>
                    ))}
                    {fase && <span style={{ fontWeight: 800, fontSize: '.95rem', color: J.text, background: 'rgba(255,255,255,.1)', padding: '4px 12px', borderRadius: 8 }}>{FASES[fase]}</span>}
                    {tMvp > 0 && <span style={{ fontWeight: 800, fontSize: '.95rem', color: J.gold, background: `${J.gold}1f`, border: `1px solid ${J.gold}55`, padding: '3px 12px', borderRadius: 8 }}>⭐ {tMvp} {tMvp === 1 ? 'vez' : 'veces'} MVP</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Desplegable>
    </>
  )
}
