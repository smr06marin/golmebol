import { useEffect, useState } from 'react'
import { Calendar, Lock, TrendingUp, TrendingDown, Trophy, Target, History, ChevronRight, Sparkles } from 'lucide-react'
import PlayerCard from '../card/PlayerCard'
import MisPuestos from '../card/MisPuestos'
import { CARD_DESIGNS } from '../card/designs/cardDesigns'
import { arteDe, NOMBRE_NIVEL } from '../card/designs/cardArte'
import { TarjetaPanel, FilaPanel, G } from '../PanelUI'
import { STAT_CONFIG, armarLista, rankingGlobal, obtenerAgregado, leerAgregadoGuardado } from '../../lib/rankingsJugadores'
import { fmtHoraDate } from '../../lib/horaHelpers'

// Inicio del jugador: su tarjeta al frente y, debajo, lo que cambia de un día para otro
// (novedades desde la última visita, próximo partido, reto de hoy, próxima tarjeta, puestos y últimos partidos).

const ETQ = { fontSize: '.74rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: G.muted }
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function cuantoFalta(fecha) {
  const ahora = new Date()
  const ms = fecha - ahora
  const diaDe = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dias = Math.round((diaDe(fecha) - diaDe(ahora)) / 86400000)
  if (ms <= 0) return 'Ya empezó'
  if (dias === 0) { const h = Math.floor(ms / 3600000); return h >= 1 ? `Hoy · en ${h} h` : `Hoy · en ${Math.max(1, Math.floor(ms / 60000))} min` }
  if (dias === 1) return 'Mañana'
  return `Faltan ${dias} días`
}

function Escudo({ url, nombre }) {
  return (
    <span style={{ width: 44, height: 44, borderRadius: 12, background: G.bg, border: `1px solid ${G.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/> : <span style={{ fontWeight: 900, fontSize: '.9rem', color: G.text2 }}>{String(nombre || '?').substring(0, 2).toUpperCase()}</span>}
    </span>
  )
}

// Reto de hoy: cada día toca una estadística distinta y dice cuánto falta para pasar al de arriba
function RetoDeHoy({ playerId, userId, esPortero, pj, onAbrir }) {
  const [agregado, setAgregado] = useState(() => leerAgregadoGuardado(userId))
  useEffect(() => {
    if (!pj) return
    let vivo = true
    obtenerAgregado(userId).then(a => { if (vivo) setAgregado(a) }).catch(() => {})
    return () => { vivo = false }
  }, [pj, userId])
  if (!pj || !agregado) return null

  const id = String(playerId)
  const lista = armarLista(agregado)
  const opciones = esPortero ? ['pj', 'pg', 'efic'] : ['gc', 'pj', 'pg', 'efic']
  const d = new Date()
  const diaDelAnio = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
  // Se empieza por la estadística que toca hoy; si en esa no hay reto posible, se prueba la siguiente
  for (let n = 0; n < opciones.length; n++) {
    const k = opciones[(diaDelAnio + n) % opciones.length]
    const cfg = STAT_CONFIG[k]
    const r = rankingGlobal(lista, k, esPortero)
    const i = r.findIndex(j => j.id === id)
    if (i < 0) continue
    const yo = r[i]
    let texto
    if (yo.puesto === 1) {
      texto = `Vas de líder en ${cfg.corto.toLowerCase()}. Defiende el #1.`
    } else {
      const arriba = [...r].reverse().find(j => j.puesto < yo.puesto)
      const falta = (arriba?.[cfg.campo] ?? 0) - (yo[cfg.campo] ?? 0)
      if (!arriba || falta <= 0) continue
      const cuanto = k === 'efic' ? `${falta} ${falta === 1 ? 'punto' : 'puntos'} de eficacia` : `${falta} ${cfg.unidad}${falta === 1 ? '' : (cfg.unidad.endsWith('l') ? 'es' : 's')}`
      texto = `Te ${falta === 1 ? 'falta' : 'faltan'} ${cuanto} para pasar a ${String(arriba.nombre).split(' ')[0]} y subir al #${arriba.puesto}.`
    }
    return (
      <button type="button" onClick={() => onAbrir(k)}
        style={{ boxSizing: 'border-box', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: G.text, background: G.card, border: `1px solid ${G.border}`, borderRadius: 18, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: G.greenBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Target size={22} color={G.green}/></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...ETQ, display: 'block' }}>Reto de hoy · {cfg.corto}</span>
          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700, lineHeight: 1.4, marginTop: 3 }}>{texto}</span>
          <span style={{ display: 'block', fontSize: '.86rem', color: G.muted, marginTop: 3 }}>Hoy eres #{yo.puesto} de {r.length}. Mañana toca otro reto.</span>
        </span>
        <ChevronRight size={20} color={G.muted} style={{ flexShrink: 0 }}/>
      </button>
    )
  }
  return null
}

export default function InicioJugador({
  player, userId, nombre, stats, cardStats, cardType, esPortero, esDefensa, torneosData, equiposData,
  novedades = [], proximo, historial = [], siguiente, desbloqueadas = 0, totalTarjetas = 0,
  onVerTarjeta, onVerColeccion, onVerHistorial, onAbrirRanking, onVerSiguiente,
}) {
  const design = CARD_DESIGNS.find(d => d.id === cardType) || CARD_DESIGNS[0]
  const arte = arteDe(design)
  const pj = stats?.pj || 0
  const fechaProx = proximo?.played_at ? new Date(proximo.played_at) : null
  const ultimos = (historial || []).slice(0, 5)
  const LETRA = { win: ['V', G.green, G.greenBg], draw: ['E', G.text2, G.soft], loss: ['D', G.loss, G.lossBg] }

  return (
    <>
      {/* Tu tarjeta, al frente */}
      <div style={{ position: 'relative', overflow: 'hidden', background: G.card, border: `1px solid ${G.border}`, borderRadius: 22, padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: '-20%', top: '-40%', width: '80%', height: '180%', background: `radial-gradient(closest-side, ${arte.clara ? '#e9c75e' : arte.a}33, transparent)`, pointerEvents: 'none' }}/>
        <button type="button" onClick={onVerTarjeta} aria-label="Ver mi tarjeta"
          style={{ position: 'relative', width: '44%', maxWidth: 176, flexShrink: 0, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <PlayerCard mini playerName={nombre} stats={cardStats} cardType={cardType} esPortero={esPortero} esDefensa={esDefensa}
            photoUrlExterno={player.photo_url || null} torneosData={torneosData} equiposData={equiposData}/>
        </button>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div style={ETQ}>Tu tarjeta</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, lineHeight: 1.15, marginTop: 4, wordBreak: 'break-word' }}>{design.nombre}</div>
          <div style={{ fontSize: '.92rem', color: G.text2, marginTop: 4, lineHeight: 1.4 }}>
            {NOMBRE_NIVEL[arte.n].charAt(0) + NOMBRE_NIVEL[arte.n].slice(1).toLowerCase()}{arte.p ? ` · ${arte.p} de 5` : ''}
          </div>
          <button type="button" onClick={onVerTarjeta}
            style={{ marginTop: 12, width: '100%', minHeight: 48, border: 'none', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 900, fontSize: '1rem', background: G.green, color: G.greenDk, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            Ver mi tarjeta <ChevronRight size={20}/>
          </button>
          <button type="button" onClick={onVerColeccion}
            style={{ marginTop: 8, width: '100%', minHeight: 44, background: 'transparent', border: `1px solid ${G.border}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '.92rem', color: G.text }}>
            Mis tarjetas · {desbloqueadas}/{totalTarjetas}
          </button>
        </div>
      </div>

      {/* Novedades desde la última visita */}
      {novedades.length > 0 && (
        <div style={{ background: G.card, border: `1px solid ${G.green}55`, borderRadius: 18, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ ...ETQ, color: G.green, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Sparkles size={15}/> Desde tu última visita</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {novedades.map((n, i) => {
              const Icono = n.tono === 'baja' ? TrendingDown : n.tono === 'oro' ? Trophy : TrendingUp
              const color = n.tono === 'baja' ? G.gold : n.tono === 'oro' ? G.gold : G.green
              const fila = (
                <>
                  <Icono size={18} color={color} style={{ flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '1rem', fontWeight: 700, lineHeight: 1.35 }}>{n.texto}</span>
                  {n.stat && <ChevronRight size={18} color={G.muted} style={{ flexShrink: 0 }}/>}
                </>
              )
              return n.stat
                ? <button key={i} type="button" onClick={() => onAbrirRanking(n.stat)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: G.text, fontFamily: 'inherit' }}>{fila}</button>
                : <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 }}>{fila}</div>
            })}
          </div>
        </div>
      )}

      {/* Próximo partido */}
      {proximo !== undefined && (
        <TarjetaPanel icono={Calendar} titulo="Tu próximo partido" derecha={fechaProx ? cuantoFalta(fechaProx) : null}>
          {fechaProx ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Escudo url={proximo.home?.logo_url} nombre={proximo.home?.name}/>
                <div style={{ flex: 1, minWidth: 0, fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3 }}>
                  {proximo.home?.name} <span style={{ color: G.muted, fontWeight: 600 }}>vs</span> {proximo.away?.name}
                </div>
                <Escudo url={proximo.away?.logo_url} nombre={proximo.away?.name}/>
              </div>
              <div style={{ fontSize: '.95rem', color: G.text2, marginTop: 10 }}>
                {DIAS[fechaProx.getDay()].charAt(0).toUpperCase() + DIAS[fechaProx.getDay()].slice(1)} {fechaProx.getDate()} de {MESES[fechaProx.getMonth()]} · {fmtHoraDate(fechaProx)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '.98rem', color: G.text2, lineHeight: 1.5 }}>Todavía no tienes partido programado. Apenas lo programen aparece aquí con el día y la hora.</div>
          )}
        </TarjetaPanel>
      )}

      {/* Reto de hoy */}
      <RetoDeHoy playerId={player.id} userId={userId} esPortero={esPortero} pj={pj} onAbrir={onAbrirRanking}/>

      {/* Próxima tarjeta por desbloquear */}
      {siguiente && (
        <button type="button" onClick={() => onVerSiguiente(siguiente.design)}
          style={{ boxSizing: 'border-box', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: G.text, background: G.card, border: `1px solid ${G.border}`, borderRadius: 18, padding: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ position: 'relative', width: 92, flexShrink: 0, display: 'block' }}>
            <span style={{ display: 'block', filter: 'saturate(.8) brightness(.68)' }}>
              <PlayerCard mini playerName={nombre} stats={cardStats} cardType={siguiente.design.id} esPortero={esPortero} esDefensa={esDefensa} photoUrlExterno={player.photo_url || null} hideShields/>
            </span>
            <span style={{ position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.75)', border: '1.5px solid rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lock size={17} color="#fff"/></span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...ETQ, display: 'block' }}>Tu próxima tarjeta</span>
            <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 900, marginTop: 3, lineHeight: 1.2 }}>{siguiente.design.nombre}</span>
            {siguiente.prog && (
              <>
                <span style={{ display: 'block', fontSize: '.92rem', color: G.text2, margin: '5px 0 8px', lineHeight: 1.35 }}>
                  {siguiente.prog.actual >= siguiente.prog.meta
                    ? 'Ya cumpliste los logros. Se desbloquea en tu próximo partido.'
                    : `Te ${siguiente.prog.meta - siguiente.prog.actual === 1 ? 'falta 1 logro' : `faltan ${siguiente.prog.meta - siguiente.prog.actual} logros`} para desbloquearla`}
                </span>
                <span style={{ display: 'block', height: 6, borderRadius: 999, background: G.soft, overflow: 'hidden' }} aria-hidden="true">
                  <span style={{ display: 'block', width: `${siguiente.prog.pct}%`, height: '100%', background: G.gold, borderRadius: 999 }}/>
                </span>
              </>
            )}
            {siguiente.cerca && (
              <span style={{ display: 'block', fontSize: '.86rem', color: G.muted, marginTop: 8, lineHeight: 1.35 }}>
                Lo más cerca: <b style={{ color: G.text2 }}>{siguiente.cerca.nombre}</b> ({siguiente.cerca.valorActual}/{siguiente.cerca.meta})
              </span>
            )}
          </span>
          <ChevronRight size={20} color={G.muted} style={{ flexShrink: 0 }}/>
        </button>
      )}

      {/* Puestos en los rankings */}
      <div style={{ marginBottom: 14 }}>
        <MisPuestos playerId={player.id} userId={userId} pj={pj} onAbrir={onAbrirRanking} enInicio/>
      </div>

      {/* Últimos partidos */}
      <TarjetaPanel icono={History} titulo="Últimos partidos" derecha={stats?.rachaVictorias >= 2 ? `Racha: ${stats.rachaVictorias} victorias` : null}>
        {ultimos.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            {ultimos.map((h, i) => {
              const [letra, color, fondo] = LETRA[h.team_result] || ['–', G.muted, G.soft]
              const m = h.matches
              return (
                <div key={h.id || i} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <div style={{ height: 44, borderRadius: 12, background: fondo, border: `1px solid ${color}55`, color, fontWeight: 900, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{letra}</div>
                  <div style={{ fontSize: '.8rem', color: G.muted, marginTop: 4, whiteSpace: 'nowrap' }}>{m && m.home_score != null ? `${m.home_score}-${m.away_score}` : ''}</div>
                </div>
              )
            })}
          </div>
        ) : null}
        {ultimos.length > 0 ? (
          <div style={{ fontSize: '.86rem', color: G.muted, marginBottom: 14 }}>V ganado · E empatado · D perdido. El primero es el más reciente.</div>
        ) : (
          <div style={{ fontSize: '.98rem', color: G.text2, lineHeight: 1.5, marginBottom: 14 }}>Cuando juegues tu primer partido, aquí vas a ver cómo te fue en los últimos cinco.</div>
        )}
        <FilaPanel verde icono={History} titulo="Mi historial" sub="Todos tus partidos y resultados" onClick={onVerHistorial}/>
      </TarjetaPanel>
    </>
  )
}
