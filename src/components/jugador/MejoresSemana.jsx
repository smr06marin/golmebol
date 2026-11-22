import { useEffect, useState } from 'react'
import { Star, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { J, FD, FT, HEXAGONO } from './juegoEstilo'
import { Desplegable, Escudo } from './juegoUI'
import { semanaAtras, nombreSemana, cargarMejoresSemana, porQue } from '../../lib/mejoresSemana'

// ── Lo mejor de la semana: Top 5 de jugadores, arqueros, equipos y partidos ──────────────────────
// Todos los torneos juntos, de lunes a domingo. Por defecto se ve la semana que ya terminó y con las flechas se
// ven las anteriores. Cada puesto trae una frase corta de POR QUÉ salió ahí (y cuánto le sacó al de abajo).
// Si el jugador (o su equipo) salió, se resalta con "TÚ" / "TU EQUIPO" y se avisa en el resumen de la sección.

const PESTANAS = [
  { id: 'jugadores', icono: '⭐', texto: 'Jugadores' },
  { id: 'arqueros',  icono: '🧤', texto: 'Arqueros' },
  { id: 'equipos',   icono: '🛡️', texto: 'Equipos' },
  { id: 'partidos',  icono: '🔥', texto: 'Partidos' },
]
const COLOR_PUESTO = [J.gold, '#cfd8dc', '#e0a36b', J.text2, J.text2]
const MAX_ATRAS = 8

function Foto({ url, nombre, size }) {
  const ini = String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return url
    ? <img src={url} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', flexShrink: 0, background: '#222' }}/>
    : <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(160deg, #3a4a3c, #1a221c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * .34, color: J.text }}>{ini}</span>
}

function Puesto({ i }) {
  const c = COLOR_PUESTO[i]
  return (
    <span style={{ width: 34, height: 34, flexShrink: 0, clipPath: HEXAGONO, WebkitClipPath: HEXAGONO, background: i < 3 ? `linear-gradient(160deg, #fff8, ${c})` : 'rgba(255,255,255,.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FD, fontSize: '1.3rem', color: i < 3 ? '#1a1200' : J.text, paddingTop: 2 }}>{i + 1}</span>
  )
}

// Una fila del Top 5 (jugador, arquero o equipo)
function FilaTop({ i, foto, escudo, nombre, sub, datos, pts, frase, soyYo, etiquetaYo }) {
  const c = COLOR_PUESTO[i]
  const primero = i === 0
  return (
    <div className="gj-abre" style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, padding: primero ? 14 : 12, animationDelay: `${i * .06}s`,
      background: primero ? `radial-gradient(90% 90% at 0% 0%, ${J.gold}33, transparent 65%), rgba(255,255,255,.04)` : 'rgba(255,255,255,.035)',
      border: `1px solid ${soyYo ? J.green : i < 3 ? c + '77' : J.linea}`, boxShadow: soyYo ? `0 0 18px -6px ${J.green}` : primero ? `0 0 22px -8px ${J.gold}` : 'none' }}>
      {primero && <span aria-hidden="true" style={{ position: 'absolute', right: -4, top: -12, fontSize: '3.8rem', opacity: .14, transform: 'rotate(12deg)' }}>👑</span>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Puesto i={i}/>
        {escudo ? <Escudo url={escudo.logo_url} nombre={escudo.name} size={primero ? 56 : 46}/> : <Foto url={foto} nombre={nombre} size={primero ? 58 : 48}/>}
        <div style={{ flex: 1, minWidth: 0 }}>
          {soyYo && <span style={{ display: 'inline-block', fontSize: '.72rem', fontWeight: 900, color: J.greenDk, background: J.green, borderRadius: 999, padding: '1px 8px', marginBottom: 3 }}>{etiquetaYo}</span>}
          <div style={{ fontSize: primero ? '1.1rem' : '1.02rem', fontWeight: 900, lineHeight: 1.2 }}>{nombre}</div>
          {sub && <div style={{ fontSize: '.86rem', color: J.text2, marginTop: 2, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: FD, fontSize: primero ? '2.2rem' : '1.8rem', lineHeight: .9, color: i < 3 ? c : J.text }}>{pts}</div>
          <div style={{ fontSize: '.72rem', fontWeight: 800, color: J.muted }}>PUNTOS</div>
        </div>
      </div>
      {datos && <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>{datos.map(d => <span key={d} style={{ fontSize: '.86rem', fontWeight: 800, color: J.text, background: 'rgba(255,255,255,.07)', borderRadius: 999, padding: '2px 10px' }}>{d}</span>)}</div>}
      {frase && (
        <div style={{ position: 'relative', marginTop: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(0,0,0,.28)', fontSize: '.9rem', color: J.text2, lineHeight: 1.4 }}>
          💬 {frase}
        </div>
      )}
    </div>
  )
}

// Un partido del Top 5
function FilaPartidoTop({ i, m, frase, esMio }) {
  const c = COLOR_PUESTO[i]
  const primero = i === 0
  const ganaLocal = m.home_score > m.away_score, ganaVisita = m.away_score > m.home_score
  return (
    <div className="gj-abre" style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, padding: 12, animationDelay: `${i * .06}s`,
      background: primero ? `radial-gradient(90% 90% at 50% 0%, ${J.gold}2e, transparent 65%), rgba(255,255,255,.04)` : 'rgba(255,255,255,.035)',
      border: `1px solid ${esMio ? J.green : i < 3 ? c + '77' : J.linea}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Puesto i={i}/>
        <span style={{ fontSize: '.82rem', color: J.muted, fontWeight: 700, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {esMio && <b style={{ color: J.green }}>TU PARTIDO · </b>}{m.tournaments?.name}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6, marginTop: 8 }}>
        {[[m.home, ganaLocal], null, [m.away, ganaVisita]].map((x, k) => k === 1 ? (
          <span key="m" style={{ fontFamily: FD, fontSize: primero ? '2.6rem' : '2.2rem', lineHeight: 1, letterSpacing: '.02em', color: i < 3 ? c : J.text, padding: '0 4px' }}>{m.home_score}-{m.away_score}</span>
        ) : (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Escudo url={x[0]?.logo_url} nombre={x[0]?.name} size={primero ? 52 : 44}/>
            <span style={{ fontSize: '.88rem', fontWeight: x[1] ? 900 : 600, color: x[1] ? J.text : J.text2, textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>{x[0]?.name}</span>
          </div>
        ))}
      </div>
      {frase && <div style={{ marginTop: 9, padding: '7px 10px', borderRadius: 10, background: 'rgba(0,0,0,.28)', fontSize: '.9rem', color: J.text2, lineHeight: 1.4 }}>💬 {frase}</div>}
    </div>
  )
}

const EXPLICACION = {
  jugadores: 'Gol: 3 puntos · Victoria: 2 · Empate: 1 · MVP: 4 · Amarilla o azul: −1 · Roja: −3',
  arqueros:  'Arco en cero: 5 puntos · Victoria: 2 · Empate: 1 · MVP: 4 · Gol del arquero: 3 · Recibir pocos goles: 0 goles +3, 1 gol +2, 2 goles +1',
  equipos:   'Victoria: 3 puntos · Empate: 1 · Más la diferencia de gol de la semana',
  partidos:  'Un punto por cada gol · +4 si se definió por 1 gol o menos · +1 si fue empate · +2 si era de eliminación · +4 si hubo remontada (solo cuando el partido se planilló con el cronómetro: si los goles no tienen minuto, no se puede saber)',
}

export default function MejoresSemana({ playerId, misEquipos = [] }) {
  const [atras, setAtras] = useState(1)
  const [pestana, setPestana] = useState('jugadores')
  const [datos, setDatos] = useState(null)       // { clave, ...resultado }
  const [error, setError] = useState(false)
  const [verReglas, setVerReglas] = useState(false)
  const [intento, setIntento] = useState(0)     // para volver a intentar si falló la carga
  const semana = semanaAtras(atras)

  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      cargarMejoresSemana(semanaAtras(atras))
        .then(r => { if (vivo) { setDatos({ ...r, atras }); setError(false) } })
        .catch(() => { if (vivo) setError(true) })
    }, atras === 1 ? 600 : 0)   // la primera vez espera un poquito: lo importante del inicio carga primero
    return () => { vivo = false; clearTimeout(t) }
  }, [atras, intento])

  const listo = datos && datos.atras === atras
  const yo = String(playerId || '')
  const misEq = new Set((misEquipos || []).map(String))
  // ¿Dónde quedé yo esta semana? (para el resumen y para resaltar)
  const pJug = listo ? datos.puestoJugador?.get(yo) : null
  const pArq = listo ? datos.puestoArquero?.get(yo) : null
  const pEq = listo ? Math.min(...[...misEq].map(id => datos.puestoEquipo?.get(id) || Infinity)) : Infinity
  const logros = [
    pJug && pJug <= 5 && `#${pJug} en jugadores`,
    pArq && pArq <= 5 && `#${pArq} en arqueros`,
    pEq <= 5 && `tu equipo #${pEq}`,
  ].filter(Boolean)

  const resumen = !listo
    ? (error ? 'No se pudo cargar. Ábrela para intentar de nuevo.' : `Semana del ${nombreSemana(semana)}`)
    : logros.length > 0
      ? <b style={{ color: J.gold }}>🎉 ¡Saliste! {logros.join(' · ')}</b>
      : datos.partidosJugados === 0 ? `Semana del ${nombreSemana(semana)} · sin partidos` : `Top 5 de la semana del ${nombreSemana(semana)}`

  const lista = listo ? datos[pestana] : []
  // Mi puesto en la pestaña actual si no salí en el Top 5 (para animar)
  const miPuestoFuera = !listo ? null
    : pestana === 'jugadores' && pJug > 5 ? `Tú quedaste #${pJug} de ${datos.totalJugadores} jugadores.`
    : pestana === 'arqueros' && pArq > 5 ? `Tú quedaste #${pArq} de ${datos.totalArqueros} arqueros.`
    : pestana === 'equipos' && pEq > 5 && pEq !== Infinity ? `Tu equipo quedó #${pEq} de ${datos.totalEquipos}.`
    : null

  return (
    <Desplegable id="semana" icono={<Star size={22} color={J.gold} strokeWidth={2.5}/>} color={J.gold} titulo="Lo mejor de la semana" resumen={resumen} retraso={.08}
>
      {/* Semana: flechas para ver las anteriores */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button type="button" onClick={() => setAtras(a => Math.min(MAX_ATRAS, a + 1))} disabled={atras >= MAX_ATRAS} aria-label="Semana anterior" className="gj-boton"
          style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, border: `1px solid ${J.linea}`, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: atras >= MAX_ATRAS ? .35 : 1 }}>
          <ChevronLeft size={22} color={J.text}/>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 800, color: J.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{atras === 1 ? 'Semana pasada' : `Hace ${atras} semanas`}</div>
          <div style={{ fontSize: '1.02rem', fontWeight: 900 }}>{nombreSemana(semana)}</div>
        </div>
        <button type="button" onClick={() => setAtras(a => Math.max(1, a - 1))} disabled={atras <= 1} aria-label="Semana siguiente" className="gj-boton"
          style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, border: `1px solid ${J.linea}`, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: atras <= 1 ? .35 : 1 }}>
          <ChevronRight size={22} color={J.text}/>
        </button>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 12 }}>
        {PESTANAS.map(p => {
          const activa = p.id === pestana
          return (
            <button key={p.id} type="button" onClick={() => { setPestana(p.id); setVerReglas(false) }} aria-pressed={activa} className="gj-boton"
              style={{ padding: '8px 2px', borderRadius: 12, cursor: 'pointer', fontFamily: FT, color: activa ? '#1a1200' : J.text,
                border: activa ? 'none' : `1px solid ${J.linea}`, background: activa ? `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})` : 'rgba(255,255,255,.05)' }}>
              <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{p.icono}</div>
              <div style={{ fontSize: '.78rem', fontWeight: 900, marginTop: 3 }}>{p.texto}</div>
            </button>
          )
        })}
      </div>

      {!listo && !error && (
        <div style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2].map(k => <div key={k} style={{ height: 78, borderRadius: 14, background: 'rgba(255,255,255,.05)', animation: 'gjPulso 1.4s ease-in-out infinite' }}/>)}
        </div>
      )}
      {error && (
        <button type="button" onClick={() => { setError(false); setIntento(k => k + 1) }}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${J.linea}`, background: 'rgba(255,255,255,.05)', color: J.text, fontFamily: FT, fontWeight: 800, cursor: 'pointer' }}>
          No se pudo cargar. Tocar para intentar de nuevo
        </button>
      )}
      {listo && lista.length === 0 && (
        <div style={{ fontSize: '1.02rem', color: J.text2, lineHeight: 1.45, padding: '6px 2px' }}>Esta semana no hubo partidos terminados. Mira la semana anterior con la flecha ‹</div>
      )}

      {listo && lista.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {pestana === 'jugadores' && lista.map((j, i) => (
            <FilaTop key={j.id} i={i} foto={j.foto} nombre={j.nombre} sub={j.equipo?.name || j.torneo}
              datos={[j.goles > 0 && `⚽ ${j.goles} ${j.goles === 1 ? 'gol' : 'goles'}`, j.mvp > 0 && `⭐ ${j.mvp} MVP`, `✅ ${j.pg} de ${j.pj} ganados`].filter(Boolean)}
              pts={j.pts} frase={porQue('jugadores', j, lista, i)} soyYo={String(j.id) === yo} etiquetaYo="TÚ"/>
          ))}
          {pestana === 'arqueros' && lista.map((j, i) => (
            <FilaTop key={j.id} i={i} foto={j.foto} nombre={j.nombre} sub={j.equipo?.name || j.torneo}
              datos={[j.goles > 0 && `⚽ ${j.goles} ${j.goles === 1 ? 'gol' : 'goles'}`, `🧤 ${j.ceros} en cero`, `🥅 ${j.recibidos} ${j.recibidos === 1 ? 'recibido' : 'recibidos'}`, j.mvp > 0 && `⭐ ${j.mvp} MVP`].filter(Boolean)}
              pts={j.pts} frase={porQue('arqueros', j, lista, i)} soyYo={String(j.id) === yo} etiquetaYo="TÚ"/>
          ))}
          {pestana === 'equipos' && lista.map((e, i) => (
            <FilaTop key={e.id} i={i} escudo={e.equipo || { name: 'Equipo' }} nombre={e.equipo?.name || 'Equipo'} sub={e.torneo}
              datos={[e.pg > 0 && `✅ ${e.pg} ${e.pg === 1 ? 'ganado' : 'ganados'}`, e.pe > 0 && `🤝 ${e.pe} ${e.pe === 1 ? 'empate' : 'empates'}`, e.pp > 0 && `❌ ${e.pp} ${e.pp === 1 ? 'perdido' : 'perdidos'}`, `⚽ ${e.gf - e.gc >= 0 ? '+' : ''}${e.gf - e.gc} de diferencia`].filter(Boolean)}
              pts={e.pts} frase={porQue('equipos', e, lista, i)} soyYo={misEq.has(String(e.id))} etiquetaYo="TU EQUIPO"/>
          ))}
          {pestana === 'partidos' && lista.map((m, i) => (
            <FilaPartidoTop key={m.id} i={i} m={m} frase={porQue('partidos', m, lista, i)} esMio={misEq.has(String(m.home_team_id)) || misEq.has(String(m.away_team_id))}/>
          ))}
        </div>
      )}

      {miPuestoFuera && <div style={{ marginTop: 10, fontSize: '.95rem', fontWeight: 700, color: J.green, textAlign: 'center' }}>{miPuestoFuera} ¡A subir la próxima semana!</div>}

      {/* Cómo se cuentan los puntos */}
      <button type="button" onClick={() => setVerReglas(v => !v)}
        style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', border: 'none', color: J.muted, fontFamily: FT, fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', padding: 6 }}>
        <Info size={16}/> {verReglas ? 'Ocultar' : '¿Cómo se cuentan los puntos?'}
      </button>
      {verReglas && <div className="gj-abre" style={{ fontSize: '.9rem', color: J.text2, lineHeight: 1.5, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.04)' }}>{EXPLICACION[pestana]}. Cuentan todos los torneos de Golmebol de lunes a domingo.</div>}
    </Desplegable>
  )
}
