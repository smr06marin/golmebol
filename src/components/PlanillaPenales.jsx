import { useState, useMemo } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, CIAN, ORO, VERDE, ROJO, btnPrimario, btnSecundario } from './planillaRapida/estilosRapida'
import { ganadorTanda, siguienteCobro, marcador, tomados, normalizarGanador } from '../lib/penales'

// ── PLANILLA DE PENALES ─────────────────────────────────────────────────────
// Se abre cuando una eliminatoria queda empatada y el árbitro dice que se
// definió por penales. Sirve para la planilla completa y para la rápida.
//
//  Paso 1 · Configurar: cuántos patean por equipo, quién cobra primero, los
//           nombres de los cobradores y el arquero de cada equipo.
//  Paso 2 · Cobros: por cada tiro el árbitro toca ⚽ GOL, ❌ FUERA o 🧤 ATAJÓ.
//           Si siguen empatados tras los N cobros, sigue la muerte súbita.
//
// Estos goles son SOLO de la tanda: no se le cuentan al jugador como gol del
// partido ni al arquero como gol recibido. Al arquero solo se le suman las atajadas.
//
// Props: jugadoresLocal / jugadoresVisitante: [{ id, nombre, numero }]
//        arqueroLocal / arqueroVis: { id, nombre } del arquero titular (opcional)
//        onConfirmar({ kicks, penalesLocal, penalesVisitante, ganador: 'home'|'away', n })

const OTRO = 'otro'

function candidatos(roster) {
  return (roster || [])
    .filter(j => (j.numero ?? '').toString().trim() && ((j.nombre || '').trim() || j.id))
    .map(j => ({ id: j.id || null, nombre: (j.nombre || '').trim(), numero: String(j.numero).trim() }))
    .sort((a, b) => (parseInt(a.numero, 10) || 0) - (parseInt(b.numero, 10) || 0))
}

const etiqueta = c => `#${c.numero} ${c.nombre || 'Sin nombre'}`

function resolver(slot, cands) {
  if (!slot) return null
  if (slot.sel === OTRO) {
    const nombre = (slot.nombre || '').trim()
    return nombre ? { jugadorId: null, jugadorNombre: nombre, numero: '' } : null
  }
  const c = cands[Number(slot.sel)]
  return slot.sel !== '' && c ? { jugadorId: c.id, jugadorNombre: c.nombre, numero: c.numero } : null
}

const selectStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '9px', border: `1px solid ${BORDE}`, background: '#0d1117', color: TEXTO, fontSize: '.85rem', outline: 'none' }
const inputStyle = { ...selectStyle, marginTop: '6px' }

function SelectorJugador({ valor, onChange, cands, placeholder }) {
  return (
    <div>
      <select value={valor?.sel ?? ''} onChange={e => onChange({ sel: e.target.value, nombre: valor?.nombre || '' })} style={selectStyle}>
        <option value="">{placeholder}</option>
        {cands.map((c, i) => <option key={i} value={String(i)}>{etiqueta(c)}</option>)}
        <option value={OTRO}>Otro (escribir nombre)…</option>
      </select>
      {valor?.sel === OTRO && (
        <input value={valor.nombre || ''} onChange={e => onChange({ sel: OTRO, nombre: e.target.value })} placeholder="Nombre del jugador" style={inputStyle}/>
      )}
    </div>
  )
}

function Puntos({ kicks, side, n }) {
  const mios = kicks.filter(k => k.side === side)
  const total = Math.max(n, mios.length)
  return (
    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
      {Array.from({ length: total }).map((_, i) => {
        const k = mios[i]
        const [bg, borde, txt] = !k ? ['transparent', BORDE, ''] : k.resultado === 'gol' ? [VERDE, VERDE, '⚽'] : k.resultado === 'atajado' ? [ORO, ORO, '🧤'] : [ROJO, ROJO, '✕']
        return <span key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: bg, border: `2px solid ${borde}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.62rem', color: '#fff', fontWeight: 800 }}>{txt}</span>
      })}
    </div>
  )
}

export default function PlanillaPenales({
  nombreLocal, nombreVis, jugadoresLocal, jugadoresVisitante, arqueroLocal, arqueroVis, onConfirmar, onCerrar,
}) {
  const candL = useMemo(() => candidatos(jugadoresLocal), [jugadoresLocal])
  const candV = useMemo(() => candidatos(jugadoresVisitante), [jugadoresVisitante])
  const cands = { local: candL, visitante: candV }
  const nombres = { local: nombreLocal || 'Local', visitante: nombreVis || 'Visitante' }

  const [paso, setPaso] = useState('config')
  const [n, setN] = useState(5)
  const [primero, setPrimero] = useState('local')
  const [cobradores, setCobradores] = useState({ local: [], visitante: [] }) // slots por ronda
  const indiceDe = (lista, a) => {
    if (!a?.id) return ''
    const i = lista.findIndex(c => c.id === a.id)
    return i >= 0 ? String(i) : ''
  }
  const [arqueros, setArqueros] = useState({
    local: { sel: indiceDe(candL, arqueroLocal), nombre: '' },
    visitante: { sel: indiceDe(candV, arqueroVis), nombre: '' },
  })
  const [kicks, setKicks] = useState([])
  const [error, setError] = useState('')

  const setSlot = (side, i, v) => setCobradores(prev => {
    const arr = [...prev[side]]; arr[i] = v; return { ...prev, [side]: arr }
  })

  // ── Paso 1 → 2 ──
  function empezar() {
    for (const side of ['local', 'visitante']) {
      for (let i = 0; i < n; i++) {
        if (!resolver(cobradores[side][i], cands[side])) return setError(`Falta el cobrador ${i + 1} de ${nombres[side]}.`)
      }
      const claves = Array.from({ length: n }).map((_, i) => { const r = resolver(cobradores[side][i], cands[side]); return r.jugadorId || `n:${r.jugadorNombre.toLowerCase()}` })
      if (new Set(claves).size !== claves.length) return setError(`En ${nombres[side]} hay un jugador repetido: cada uno cobra una sola vez.`)
      if (!resolver(arqueros[side], cands[side])) return setError(`Falta el arquero de ${nombres[side]}.`)
    }
    setError(''); setPaso('cobros')
  }

  // ── Paso 2 ──
  const ganadorSide = ganadorTanda(kicks, n)
  const siguiente = siguienteCobro(kicks, n, primero)
  const pm = marcador(kicks)
  const rivalDe = s => (s === 'local' ? 'visitante' : 'local')

  const slotActual = siguiente ? cobradores[siguiente.side][siguiente.ronda - 1] : null
  const cobradorActual = siguiente ? resolver(slotActual, cands[siguiente.side]) : null
  const arqueroRival = siguiente ? resolver(arqueros[rivalDe(siguiente.side)], cands[rivalDe(siguiente.side)]) : null

  function anotar(resultado) {
    if (!siguiente || !cobradorActual || !arqueroRival) return
    setKicks(prev => [...prev, {
      side: siguiente.side,
      jugadorId: cobradorActual.jugadorId, jugadorNombre: cobradorActual.jugadorNombre, numero: cobradorActual.numero,
      arqueroId: arqueroRival.jugadorId, arqueroNombre: arqueroRival.jugadorNombre,
      resultado,
    }])
  }
  const deshacer = () => setKicks(prev => prev.slice(0, -1))

  function confirmar() {
    if (!ganadorSide) return
    onConfirmar({ kicks, penalesLocal: pm.local, penalesVisitante: pm.visitante, ganador: normalizarGanador(ganadorSide), n })
  }

  const envoltura = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
  const hoja = { background: PANEL, borderRadius: '18px 18px 0 0', padding: '18px', width: '100%', maxWidth: '520px', maxHeight: '94dvh', overflowY: 'auto', boxSizing: 'border-box', color: TEXTO, fontFamily: 'system-ui, sans-serif' }

  // ───────────── PASO 1: configurar ─────────────
  if (paso === 'config') {
    return (
      <div style={envoltura}>
        <div style={hoja}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, textAlign: 'center', marginBottom: '4px' }}>⚽ Tanda de penales</div>
          <div style={{ fontSize: '.72rem', color: TEXTO_TENUE, textAlign: 'center', marginBottom: '16px' }}>Elige quiénes cobran y qué arquero defiende. Después anotas cada cobro.</div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div style={{ flex: 1, background: '#0d1117', border: `1px solid ${BORDE}`, borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '.66rem', fontWeight: 700, color: TEXTO_TENUE, marginBottom: '6px' }}>¿CUÁNTOS PATEAN POR EQUIPO?</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                <button type="button" onClick={() => setN(v => Math.max(1, v - 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${BORDE}`, background: 'none', color: TEXTO, fontSize: '1.2rem', cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, minWidth: '30px', textAlign: 'center' }}>{n}</span>
                <button type="button" onClick={() => setN(v => Math.min(11, v + 1))} style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${BORDE}`, background: 'none', color: TEXTO, fontSize: '1.2rem', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#0d1117', border: `1px solid ${BORDE}`, borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '.66rem', fontWeight: 700, color: TEXTO_TENUE, marginBottom: '6px' }}>COBRA PRIMERO</div>
              {['local', 'visitante'].map(s => (
                <button key={s} type="button" onClick={() => setPrimero(s)}
                  style={{ display: 'block', width: '100%', marginBottom: '4px', padding: '6px 8px', borderRadius: '8px', border: `1.5px solid ${primero === s ? CIAN : BORDE}`, background: primero === s ? 'rgba(0,221,208,.12)' : 'none', color: primero === s ? CIAN : TEXTO_TENUE, fontSize: '.72rem', fontWeight: 700, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nombres[s]}
                </button>
              ))}
            </div>
          </div>

          {['local', 'visitante'].map(side => (
            <div key={side} style={{ background: '#0d1117', border: `1px solid ${BORDE}`, borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '.85rem', marginBottom: '10px', color: CIAN }}>{nombres[side]}</div>
              <div style={{ fontSize: '.66rem', fontWeight: 700, color: ORO, marginBottom: '4px' }}>🧤 ARQUERO QUE VA A TAPAR</div>
              <SelectorJugador valor={arqueros[side]} onChange={v => setArqueros(p => ({ ...p, [side]: v }))} cands={cands[side]} placeholder="Elige el arquero…"/>
              <div style={{ fontSize: '.66rem', fontWeight: 700, color: TEXTO_TENUE, margin: '12px 0 6px' }}>COBRADORES (EN ORDEN)</div>
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ width: 24, height: 24, marginTop: '8px', borderRadius: '50%', background: BORDE, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SelectorJugador valor={cobradores[side][i]} onChange={v => setSlot(side, i, v)} cands={cands[side]} placeholder={`Cobrador ${i + 1}…`}/>
                  </div>
                </div>
              ))}
              {cands[side].length === 0 && <div style={{ fontSize: '.7rem', color: ROJO }}>No hay jugadores con número en este equipo: usa "Otro (escribir nombre)".</div>}
            </div>
          ))}

          {error && <div style={{ background: 'rgba(217,48,37,.12)', border: `1px solid ${ROJO}`, color: '#ff8a80', borderRadius: '10px', padding: '9px 12px', fontSize: '.78rem', fontWeight: 600, marginBottom: '12px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onCerrar} style={{ ...btnSecundario, flex: 1 }}>‹ Cancelar</button>
            <button type="button" onClick={empezar} style={{ ...btnPrimario, flex: 2 }}>Empezar penales ›</button>
          </div>
        </div>
      </div>
    )
  }

  // ───────────── PASO 2: cobros ─────────────
  const cobrosRonda = siguiente?.ronda
  const necesitaCobrador = siguiente && !cobradorActual
  return (
    <div style={envoltura}>
      <div style={hoja}>
        <div style={{ fontSize: '.7rem', fontWeight: 800, color: TEXTO_TENUE, textAlign: 'center', letterSpacing: '.12em', marginBottom: '10px' }}>
          TANDA DE PENALES{siguiente?.enMuerteSubita ? ' · MUERTE SÚBITA' : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'start', marginBottom: '16px' }}>
          {['local', 'visitante'].map((side, idx) => (
            <div key={side} style={{ gridColumn: idx === 0 ? 1 : 3, gridRow: 1, textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: TEXTO_TENUE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombres[side]}</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.1, color: ganadorSide === side ? VERDE : TEXTO }}>{side === 'local' ? pm.local : pm.visitante}</div>
              <Puntos kicks={kicks} side={side} n={n}/>
            </div>
          ))}
          <div style={{ gridColumn: 2, gridRow: 1, alignSelf: 'center', fontSize: '1.4rem', fontWeight: 800, color: TEXTO_TENUE }}>-</div>
        </div>

        {ganadorSide ? (
          <div style={{ background: 'rgba(30,142,62,.14)', border: `1px solid ${VERDE}`, borderRadius: '12px', padding: '14px', textAlign: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '1.6rem' }}>🏆</div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{nombres[ganadorSide]} gana por penales</div>
            <div style={{ fontSize: '.8rem', color: TEXTO_TENUE, marginTop: '2px' }}>{pm.local} - {pm.visitante}</div>
          </div>
        ) : (
          <div style={{ background: '#0d1117', border: `1px solid ${BORDE}`, borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '.66rem', fontWeight: 700, color: CIAN, letterSpacing: '.08em' }}>COBRA · {nombres[siguiente.side].toUpperCase()} · RONDA {cobrosRonda}</div>
            {necesitaCobrador ? (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '.74rem', color: TEXTO_TENUE, marginBottom: '6px' }}>
                  {siguiente.enMuerteSubita ? 'Muerte súbita: elige quién cobra esta ronda.' : 'Elige quién cobra.'}
                </div>
                <SelectorJugador valor={slotActual} onChange={v => setSlot(siguiente.side, siguiente.ronda - 1, v)} cands={cands[siguiente.side]} placeholder="Cobrador…"/>
              </div>
            ) : (
              <div style={{ fontSize: '1.15rem', fontWeight: 800, margin: '6px 0 2px' }}>
                {cobradorActual.numero ? `#${cobradorActual.numero} ` : ''}{cobradorActual.jugadorNombre}
              </div>
            )}
            <div style={{ fontSize: '.74rem', color: ORO, marginTop: '8px', fontWeight: 700 }}>
              🧤 Defiende: {arqueroRival ? arqueroRival.jugadorNombre : '—'} <span style={{ color: TEXTO_TENUE, fontWeight: 600 }}>({nombres[rivalDe(siguiente.side)]})</span>
            </div>
            <details style={{ marginTop: '8px' }}>
              <summary style={{ fontSize: '.7rem', color: TEXTO_TENUE, cursor: 'pointer' }}>Cambiar arquero de {nombres[rivalDe(siguiente.side)]}</summary>
              <div style={{ marginTop: '6px' }}>
                <SelectorJugador valor={arqueros[rivalDe(siguiente.side)]} onChange={v => setArqueros(p => ({ ...p, [rivalDe(siguiente.side)]: v }))} cands={cands[rivalDe(siguiente.side)]} placeholder="Arquero…"/>
              </div>
            </details>
          </div>
        )}

        {!ganadorSide && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {[
              { r: 'gol', txt: '⚽ GOL', bg: VERDE },
              { r: 'fuera', txt: '❌ FUERA', bg: ROJO },
              { r: 'atajado', txt: '🧤 ATAJÓ', bg: ORO },
            ].map(b => (
              <button key={b.r} type="button" onClick={() => anotar(b.r)} disabled={necesitaCobrador || !arqueroRival}
                style={{ padding: '18px 4px', borderRadius: '12px', border: 'none', background: b.bg, color: b.r === 'atajado' ? '#1a1305' : '#fff', fontWeight: 900, fontSize: '.88rem', cursor: 'pointer', opacity: (necesitaCobrador || !arqueroRival) ? .4 : 1 }}>
                {b.txt}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          {kicks.length > 0
            ? <button type="button" onClick={deshacer} style={{ ...btnSecundario, flex: 1 }}>↶ Deshacer último</button>
            : <button type="button" onClick={() => setPaso('config')} style={{ ...btnSecundario, flex: 1 }}>‹ Configuración</button>}
          {ganadorSide
            ? <button type="button" onClick={confirmar} style={{ ...btnPrimario, flex: 2 }}>✔ Confirmar penales</button>
            : <button type="button" onClick={onCerrar} style={{ ...btnSecundario, flex: 1 }}>Cancelar tanda</button>}
        </div>
        {kicks.length > 0 && !ganadorSide && (
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '.66rem', color: TEXTO_TENUE }}>
            Cobros anotados: {tomados(kicks, 'local') + tomados(kicks, 'visitante')}
          </div>
        )}
      </div>
    </div>
  )
}

// Pregunta previa al guardado: la eliminatoria quedó empatada, ¿se definió por penales?
// Sí → abre la tanda · No → se guarda el partido tal cual (el organizador puede registrar
// los penales después desde el calendario).
export function PreguntaPenales({ nombreLocal, nombreVis, marcadorTexto, onSi, onNo, onCerrar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: PANEL, borderRadius: '18px', padding: '22px 18px', width: '100%', maxWidth: '400px', boxSizing: 'border-box', color: TEXTO, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚖️</div>
        <div style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '6px' }}>Partido empatado en eliminatoria</div>
        <div style={{ fontSize: '.82rem', color: TEXTO_TENUE, marginBottom: '4px' }}>{nombreLocal} {marcadorTexto} {nombreVis}</div>
        <div style={{ fontSize: '.9rem', fontWeight: 700, margin: '14px 0 16px' }}>¿Se definió por penales?</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onNo} style={{ ...btnSecundario, flex: 1 }}>No</button>
          <button type="button" onClick={onSi} style={{ ...btnPrimario, flex: 2 }}>Sí, anotar penales</button>
        </div>
        <button type="button" onClick={onCerrar} style={{ marginTop: '10px', background: 'none', border: 'none', color: TEXTO_TENUE, fontSize: '.74rem', cursor: 'pointer' }}>‹ Volver al partido</button>
      </div>
    </div>
  )
}
