import { useEffect, useRef, useState } from 'react'
import { formatTiempo } from '../planillaRapida/estilosRapida'
import { fmtHoraDate } from '../../lib/horaHelpers'
import { PREGUNTAS_PAPEL } from '../../lib/planillaPapel'

// Pantalla de la PLANILLA DE PAPEL: la hoja impresa hecha pantalla.
//
//   TORNEO / FECHA / Cancha / Hora / ÁRBITRO CENTRAL / ASISTENTES
//   por equipo:  DOCUMENTO | NOMBRE | No | Amarilla | Roja | GOL
//                + DT, GOLES ANOTADOS, 4 preguntas Sí/No, CAPITÁN y #Carnés
//   INFORME ARBITRAL
//
// · No:       número de camiseta. Quien tiene número es quien JUGÓ.
// · Amarilla / Roja: DOBLE TOQUE (dos toques seguidos) para anotarla con el
//             minuto del cronómetro. Un toque suelto solo avisa "otra vez".
// · GOL:      cada toque suma UN gol con el minuto del cronómetro.
// · Tocar un minuto (o una tarjeta) anotado lo quita (pide confirmar).
// En pantalla ancha se ven los dos equipos lado a lado como en el papel; en
// celular se ve un equipo a la vez (pestañas arriba) para que se pueda tocar
// cómodo. Todo lo que se anota se guarda y se ve en vivo, igual que antes.

const TINTA = '#111'
const LINEA = '1px solid #111'
const GRIS = '#5f6368'
const AMARILLA = '#f9c400'
const ROJA = '#d93025'
const VERDE = '#1e8e3e'
const AZUL = '#1a73e8'

const COLS_ANCHA = '96px minmax(0,1fr) 54px 64px 64px 132px'
const COLS_ESTRECHA = 'minmax(0,1fr) 50px 58px 58px 104px'

function useAncho(ref) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setW(el.getBoundingClientRect().width)
    medir()
    let ro = null
    try { ro = new ResizeObserver(medir); ro.observe(el) } catch { window.addEventListener('resize', medir) }
    return () => { try { ro && ro.disconnect() } catch { /* nada */ } window.removeEventListener('resize', medir) }
  }, [ref])
  return w
}

function etiquetaMinuto(e) {
  return `${e.periodo === 2 ? '2T ' : ''}${e.minuto || ''}`
}

function eventosDeJugador(eventosEquipo, j) {
  return eventosEquipo.filter(e => (j.id ? e.jugadorId === j.id : (!e.jugadorId && (e.jugadorNombre || '') === (j.nombre || ''))))
}

// ── Número de camiseta (se confirma al salir del campo o con Enter) ──────────
function InputNumero({ valor, onCommit }) {
  const [txt, setTxt] = useState(valor || '')
  const [err, setErr] = useState('')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  function confirmar() {
    const limpio = txt.replace(/\D/g, '').slice(0, 2)
    if (limpio === (valor || '')) { setTxt(valor || ''); return }
    const r = onCommit(limpio)
    if (r) {
      setErr(r); setTxt(valor || '')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setErr(''), 2600)
    } else setErr('')
  }
  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
      <input value={txt} onChange={e => setTxt(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={confirmar} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        inputMode="numeric" maxLength={2} placeholder="–" aria-label="Número de camiseta"
        style={{ width: '40px', height: '34px', boxSizing: 'border-box', textAlign: 'center', fontSize: '1.05rem', fontWeight: '900', border: `1px solid ${err ? ROJA : '#9aa0a6'}`, borderRadius: '6px', outline: 'none', background: txt ? '#e6f4ea' : '#fff', color: TINTA, padding: 0 }}/>
      {err && (
        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 5, marginTop: '2px', background: ROJA, color: '#fff', fontSize: '.62rem', fontWeight: '800', padding: '3px 6px', borderRadius: '5px', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}>{err}</div>
      )}
    </div>
  )
}

// ── Tarjeta: DOBLE TOQUE ────────────────────────────────────────────────────
function BotonTarjeta({ emoji, color, desactivado, onConfirmar, titulo }) {
  const [aviso, setAviso] = useState(false)
  const ultimo = useRef(0)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  function tocar() {
    if (desactivado) return
    const ahora = Date.now()
    if (ahora - ultimo.current < 600) {
      ultimo.current = 0; clearTimeout(timer.current); setAviso(false)
      onConfirmar()
      return
    }
    ultimo.current = ahora
    setAviso(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(false), 900)
  }
  return (
    <button type="button" onClick={tocar} disabled={desactivado} title={desactivado ? 'Primero ponle el número de camiseta' : titulo}
      style={{ width: '44px', height: '34px', borderRadius: '8px', border: `2px solid ${aviso ? TINTA : color}`, background: aviso ? color : '#fff', cursor: desactivado ? 'default' : 'pointer', opacity: desactivado ? .35 : 1, fontSize: aviso ? '.58rem' : '1.05rem', fontWeight: '900', color: TINTA, padding: 0, touchAction: 'manipulation', lineHeight: 1.05 }}>
      {aviso ? 'otra vez' : emoji}
    </button>
  )
}

// ── Gol: cada toque suma uno (con una pequeña pausa para no duplicar por rebote) ──
function BotonGol({ cantidad, desactivado, onGol }) {
  const ultimo = useRef(0)
  function tocar() {
    if (desactivado) return
    const ahora = Date.now()
    if (ahora - ultimo.current < 500) return
    ultimo.current = ahora
    onGol()
  }
  return (
    <button type="button" onClick={tocar} disabled={desactivado} title={desactivado ? 'Primero ponle el número de camiseta' : 'Anotar gol con el minuto del cronómetro'}
      style={{ minWidth: '52px', height: '34px', borderRadius: '8px', border: `2px solid ${VERDE}`, background: cantidad > 0 ? VERDE : '#fff', color: cantidad > 0 ? '#fff' : TINTA, cursor: desactivado ? 'default' : 'pointer', opacity: desactivado ? .35 : 1, fontSize: '1rem', fontWeight: '900', padding: '0 8px', touchAction: 'manipulation' }}>
      ⚽{cantidad > 0 ? ` ${cantidad}` : ''}
    </button>
  )
}

function Chip({ evento, color, texto, nombre, onQuitar }) {
  return (
    <button type="button" onClick={() => { if (window.confirm(`¿Quitar ${texto} del ${etiquetaMinuto(evento)}${nombre ? ` de ${nombre}` : ''}?`)) onQuitar(evento.id) }}
      title="Tocar para quitar"
      style={{ background: color, border: 'none', borderRadius: '5px', padding: '1px 5px', fontSize: '.62rem', fontWeight: '800', color: color === AMARILLA ? TINTA : '#fff', cursor: 'pointer', lineHeight: 1.35 }}>
      {etiquetaMinuto(evento)}
    </button>
  )
}

const celda = (extra = {}) => ({ borderRight: LINEA, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 4px', minWidth: 0, boxSizing: 'border-box', ...extra })

function FilaJugador({ j, eventos, ancha, onNumero, onAbrir, onGol, onTarjeta, onQuitar }) {
  const tieneNumero = (j.numero || '').trim() !== ''
  const bloqueado = !!(j.debeTarjeta || j.debeInscripcion)
  const goles = eventos.filter(e => e.tipo === 'goal')
  const amarillas = eventos.filter(e => e.tipo === 'yellow_card')
  const rojas = eventos.filter(e => e.tipo === 'red_card')
  const dobleAmarilla = amarillas.length >= 2 && rojas.length === 0
  const sinAccion = !tieneNumero || bloqueado
  const nombre = j.nombre || 'Sin nombre'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: ancha ? COLS_ANCHA : COLS_ESTRECHA, borderBottom: LINEA, minHeight: '48px', background: rojas.length > 0 ? 'rgba(217,48,37,.07)' : 'transparent' }}>
      {ancha && (
        <div style={celda({ justifyContent: 'flex-start', fontSize: '.74rem', color: GRIS, fontWeight: '600' })}>{j.cedula || ''}</div>
      )}
      <div style={celda({ justifyContent: 'flex-start', alignItems: 'flex-start', flexDirection: 'column', gap: '2px', padding: '4px 6px' })}>
        <button type="button" onClick={onAbrir} title="Tocar para ver la foto"
          style={{ background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: TINTA, width: '100%', fontSize: '.86rem', fontWeight: '700', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}>
          {j.nombre || <em style={{ color: GRIS, fontWeight: '500' }}>Sin nombre — tocar para escribirlo</em>}
        </button>
        {!ancha && j.cedula && <span style={{ fontSize: '.64rem', color: GRIS, fontWeight: '600' }}>{j.cedula}</span>}
        {(j.debeTarjeta || j.debeInscripcion || j.debeFoto || dobleAmarilla) && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {j.debeTarjeta && <span style={{ fontSize: '.58rem', fontWeight: '800', color: '#fff', background: ROJA, borderRadius: '4px', padding: '1px 5px' }}>DEBE TARJETA</span>}
            {j.debeInscripcion && <span style={{ fontSize: '.58rem', fontWeight: '800', color: '#fff', background: '#e8710a', borderRadius: '4px', padding: '1px 5px' }}>INSCRIPCIÓN SIN PAGAR</span>}
            {j.debeFoto && <span style={{ fontSize: '.58rem', fontWeight: '800', color: '#fff', background: '#e8710a', borderRadius: '4px', padding: '1px 5px' }}>CAMBIAR FOTO</span>}
            {dobleAmarilla && <span style={{ fontSize: '.58rem', fontWeight: '800', color: '#fff', background: ROJA, borderRadius: '4px', padding: '1px 5px' }}>2 AMARILLAS</span>}
          </span>
        )}
      </div>
      <div style={celda()}>
        {bloqueado ? (
          <button type="button" onClick={onAbrir} title="Tiene una deuda: toca para ver el detalle"
            style={{ width: '40px', height: '34px', borderRadius: '6px', border: `1px solid ${ROJA}`, background: '#fff', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>🔒</button>
        ) : (
          <InputNumero key={j.numero || ''} valor={j.numero || ''} onCommit={onNumero}/>
        )}
      </div>
      <div style={celda({ flexDirection: 'column', gap: '3px' })}>
        <BotonTarjeta emoji="🟨" color={AMARILLA} desactivado={sinAccion} titulo="Doble toque: anotar amarilla" onConfirmar={() => onTarjeta('yellow_card')}/>
        {amarillas.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
            {amarillas.map(e => <Chip key={e.id} evento={e} color={AMARILLA} texto="la amarilla" nombre={nombre} onQuitar={onQuitar}/>)}
          </span>
        )}
      </div>
      <div style={celda({ flexDirection: 'column', gap: '3px' })}>
        <BotonTarjeta emoji="🟥" color={ROJA} desactivado={sinAccion} titulo="Doble toque: anotar roja" onConfirmar={() => onTarjeta('red_card')}/>
        {rojas.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
            {rojas.map(e => <Chip key={e.id} evento={e} color={ROJA} texto="la roja" nombre={nombre} onQuitar={onQuitar}/>)}
          </span>
        )}
      </div>
      <div style={celda({ flexDirection: 'column', gap: '3px', borderRight: 'none' })}>
        <BotonGol cantidad={goles.length} desactivado={sinAccion} onGol={onGol}/>
        {goles.length > 0 && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center' }}>
            {goles.map(e => <Chip key={e.id} evento={e} color={VERDE} texto="el gol" nombre={nombre} onQuitar={onQuitar}/>)}
          </span>
        )}
      </div>
    </div>
  )
}

const campo = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid #9aa0a6', borderRadius: '6px', fontSize: '.85rem', outline: 'none', background: '#fff', color: TINTA, fontFamily: 'inherit' }

function AgregarJugador({ onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [doc, setDoc] = useState('')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [err, setErr] = useState('')
  function enviar() {
    if (!nombre.trim()) { setErr('Escribe el nombre'); return }
    if (!numero.trim()) { setErr('Escribe el número de camiseta'); return }
    const r = onAgregar({ cedula: doc.trim(), nombre: nombre.trim(), numero: numero.trim() })
    if (r) { setErr(r); return }
    setDoc(''); setNombre(''); setNumero(''); setErr(''); setAbierto(false)
  }
  if (!abierto) {
    return (
      <button type="button" className="gm-papel-no-imprimir" onClick={() => setAbierto(true)}
        style={{ width: '100%', padding: '9px', background: '#f1f3f4', border: 'none', borderBottom: LINEA, cursor: 'pointer', fontSize: '.78rem', fontWeight: '800', color: AZUL }}>
        + Agregar jugador que no está en la lista
      </button>
    )
  }
  return (
    <div className="gm-papel-no-imprimir" style={{ padding: '8px', borderBottom: LINEA, background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Documento (opcional)" inputMode="numeric" style={campo}/>
      <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido" style={campo}/>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="N°" inputMode="numeric" maxLength={2} style={{ ...campo, width: '70px', textAlign: 'center', fontWeight: '900' }}/>
        <button type="button" onClick={enviar} style={{ flex: 1, padding: '9px', background: VERDE, border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>✓ Agregar</button>
        <button type="button" onClick={() => { setAbierto(false); setErr('') }} style={{ padding: '9px 12px', background: '#fff', border: '1px solid #9aa0a6', borderRadius: '6px', color: GRIS, fontWeight: '700', cursor: 'pointer' }}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize: '.72rem', color: ROJA, fontWeight: '700' }}>{err}</div>}
    </div>
  )
}

function BloqueEquipo({ team, nombre, jugadores, eventos, datos, onDatos, onNumero, onAbrir, onGol, onTarjeta, onQuitar, onAgregar }) {
  const ref = useRef(null)
  const ancho = useAncho(ref)
  const ancha = ancho >= 540
  const goles = eventos.filter(e => e.tipo === 'goal').length
  const numerados = jugadores.map((j, i) => ({ j, i })).filter(x => (x.j.numero || '').trim() !== '')
  const set = (campoClave, valor) => onDatos(team, d => ({ ...d, [campoClave]: valor }))
  const setResp = (clave, valor) => onDatos(team, d => ({ ...d, resp: { ...d.resp, [clave]: d.resp[clave] === valor ? null : valor } }))
  const cabeza = { ...celda({ fontSize: '.64rem', fontWeight: '900', letterSpacing: '.03em', background: '#f1f3f4', minHeight: '34px' }) }
  return (
    <div ref={ref} style={{ border: LINEA, background: '#fff', minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: ancha ? COLS_ANCHA : COLS_ESTRECHA, borderBottom: LINEA }}>
        {ancha && <div style={cabeza}>DOCUMENTO</div>}
        <div style={{ ...cabeza, justifyContent: 'flex-start', padding: '3px 6px', fontSize: '.8rem', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', fontWeight: '900' }}>{nombre}</span>
          {!ancha && <span style={{ fontSize: '.55rem', color: GRIS, fontWeight: '700' }}>DOCUMENTO · NOMBRE</span>}
        </div>
        <div style={cabeza}>No</div>
        <div style={{ ...cabeza, background: 'rgba(249,196,0,.35)' }}>Amarilla</div>
        <div style={{ ...cabeza, background: 'rgba(217,48,37,.22)' }}>Roja</div>
        <div style={{ ...cabeza, borderRight: 'none', background: 'rgba(30,142,62,.18)' }}>GOL</div>
      </div>

      {jugadores.length === 0 && (
        <div style={{ padding: '14px', fontSize: '.8rem', color: GRIS, borderBottom: LINEA }}>Este equipo no tiene jugadores inscritos. Agrégalos abajo.</div>
      )}
      {jugadores.map((j, i) => (
        <FilaJugador key={j.id || `sr${i}`} j={j} ancha={ancha} eventos={eventosDeJugador(eventos, j)}
          onNumero={n => onNumero(team, i, n)} onAbrir={() => onAbrir(team, i)}
          onGol={() => onGol(team, i)} onTarjeta={tipo => onTarjeta(team, i, tipo)} onQuitar={id => onQuitar(team, id)}/>
      ))}

      <AgregarJugador onAgregar={datosJugador => onAgregar(team, datosJugador)}/>

      {/* DT */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) minmax(0,1.6fr)', borderBottom: LINEA, alignItems: 'stretch' }}>
        <div style={celda({ fontSize: '.7rem', fontWeight: '900', background: '#f1f3f4' })}>DT</div>
        <div style={celda({ padding: '4px' })}><input value={datos.dtDoc} onChange={e => set('dtDoc', e.target.value)} placeholder="Documento" inputMode="numeric" style={campo}/></div>
        <div style={celda({ padding: '4px', borderRight: 'none' })}><input value={datos.dtNombre} onChange={e => set('dtNombre', e.target.value)} placeholder="Nombre del DT" style={campo}/></div>
      </div>

      {/* Goles anotados */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '6px 8px', borderBottom: LINEA }}>
        <span style={{ fontSize: '.9rem', fontWeight: '900', letterSpacing: '.02em' }}>GOLES ANOTADOS:</span>
        <span style={{ minWidth: '42px', textAlign: 'center', border: LINEA, padding: '4px 8px', fontSize: '1.2rem', fontWeight: '900', background: '#f1f3f4' }}>{goles}</span>
      </div>

      {/* Preguntas Sí / No */}
      {PREGUNTAS_PAPEL.map(p => (
        <div key={p.clave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderBottom: LINEA }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: '.72rem', fontWeight: '700', lineHeight: 1.25 }}>{p.texto}</span>
          {[['si', 'Si'], ['no', 'No']].map(([valor, etiqueta]) => {
            const activo = datos.resp[p.clave] === valor
            return (
              <button key={valor} type="button" onClick={() => setResp(p.clave, valor)}
                style={{ width: '40px', height: '30px', borderRadius: '6px', border: `1px solid ${activo ? TINTA : '#9aa0a6'}`, background: activo ? (valor === 'si' ? VERDE : ROJA) : '#fff', color: activo ? '#fff' : TINTA, fontWeight: '800', fontSize: '.72rem', cursor: 'pointer', padding: 0, touchAction: 'manipulation' }}>{etiqueta}</button>
            )
          })}
        </div>
      ))}

      {/* Capitán y carnés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto 70px', alignItems: 'center', gap: '6px', padding: '6px 8px' }}>
        <span style={{ fontSize: '.78rem', fontWeight: '900' }}>CAPITÁN:</span>
        <select value={datos.capitan} onChange={e => set('capitan', e.target.value)} style={{ ...campo, padding: '7px 4px' }}>
          <option value="">— elegir —</option>
          {numerados.map(({ j, i }) => <option key={j.id || `sr${i}`} value={j.numero}>#{j.numero} · {j.nombre || 'Sin nombre'}</option>)}
        </select>
        <span style={{ fontSize: '.72rem', fontWeight: '900' }}>#Carnés</span>
        <input value={datos.carnes} onChange={e => set('carnes', e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" placeholder="0" style={{ ...campo, textAlign: 'center', fontWeight: '800' }}/>
      </div>
    </div>
  )
}

// ── Informe arbitral con dictado por voz (igual que en el cierre de siempre) ──
function InformeArbitral({ valor, onCambio, obligatorio }) {
  const [escuchando, setEscuchando] = useState(false)
  const recRef = useRef(null)
  const manualRef = useRef(true)
  const baseRef = useRef('')
  const valorRef = useRef(valor)
  useEffect(() => { valorRef.current = valor })
  const vozOk = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  useEffect(() => () => { manualRef.current = true; try { recRef.current?.stop() } catch { /* nada */ } }, [])
  function alternarVoz() {
    if (escuchando) { manualRef.current = true; try { recRef.current?.stop() } catch { /* nada */ } setEscuchando(false); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    manualRef.current = false
    const rec = new SR()
    rec.lang = 'es-CO'; rec.continuous = true; rec.interimResults = true
    baseRef.current = valorRef.current.trim() ? valorRef.current.trim() + ' ' : ''
    rec.onresult = e => {
      let fin = '', prov = ''
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const t = e.results[k][0].transcript
        if (e.results[k].isFinal) fin += t + ' '; else prov += t
      }
      if (fin) baseRef.current += fin
      onCambio((baseRef.current + prov).trimStart())
    }
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { manualRef.current = true; setEscuchando(false) } }
    rec.onend = () => { if (!manualRef.current) { try { rec.start(); return } catch { /* nada */ } } setEscuchando(false) }
    recRef.current = rec
    try { rec.start(); setEscuchando(true) } catch { /* nada */ }
  }
  return (
    <div style={{ border: LINEA, background: '#fff', marginTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 8px', borderBottom: LINEA }}>
        <span style={{ fontSize: '.9rem', fontWeight: '900' }}>INFORME ARBITRAL:{obligatorio && <span style={{ color: ROJA, fontSize: '.7rem', fontWeight: '800' }}> · obligatorio por tarjeta roja</span>}</span>
        {vozOk && (
          <button type="button" onClick={alternarVoz}
            style={{ background: escuchando ? ROJA : '#f1f3f4', color: escuchando ? '#fff' : TINTA, border: '1px solid #9aa0a6', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '.72rem', fontWeight: '800', flexShrink: 0 }}>
            {escuchando ? '⏹ Detener' : '🎙️ Dictar'}
          </button>
        )}
      </div>
      <textarea value={valor} onChange={e => onCambio(e.target.value)} rows={5} placeholder="Escribe aquí lo que pasó en el partido…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', border: 'none', outline: 'none', resize: 'vertical', fontSize: '.88rem', fontFamily: 'inherit', background: obligatorio && valor.trim().length < 10 ? 'rgba(217,48,37,.05)' : '#fff', color: TINTA }}/>
    </div>
  )
}

function Cabecera({ partido, torneoNombre, papel, onPapel, compacta }) {
  const [verArbitros, setVerArbitros] = useState(false)
  const fecha = partido?.played_at ? new Date(partido.played_at) : null
  const fechaTxt = fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const horaTxt = fecha && !Number.isNaN(fecha.getTime()) ? fmtHoraDate(fecha) : ''
  const fila = { display: 'grid', gridTemplateColumns: 'minmax(86px,auto) minmax(0,1fr)', borderBottom: LINEA, alignItems: 'stretch' }
  const etiqueta = { ...celda({ justifyContent: 'flex-start', fontSize: '.8rem', fontWeight: '900', padding: '5px 8px', background: '#f1f3f4' }) }
  const valorTxt = { display: 'flex', alignItems: 'center', padding: '5px 8px', fontSize: '.88rem', fontWeight: '700', minWidth: 0, wordBreak: 'break-word' }
  const setArb = (k, v) => onPapel(p => ({ ...p, arbitros: { ...p.arbitros, [k]: v } }))
  const inputArb = (k, ph) => (
    <div style={{ padding: '3px 4px' }}>
      <input value={papel.arbitros[k]} onChange={e => setArb(k, e.target.value)} placeholder={ph} style={{ ...campo, border: '1px solid #dadce0' }}/>
    </div>
  )
  const nombresArb = [papel.arbitros.central, papel.arbitros.asist1, papel.arbitros.asist2].map(x => (x || '').trim()).filter(Boolean)
  if (compacta) {
    return (
      <div style={{ border: LINEA, background: '#fff', marginBottom: '10px' }}>
        <div style={fila}><div style={etiqueta}>TORNEO</div><div style={valorTxt}>{torneoNombre || partido?.tournaments?.name || ''}</div></div>
        <div style={fila}><div style={etiqueta}>FECHA</div><div style={valorTxt}>{[fechaTxt, horaTxt].filter(Boolean).join(' · ')}</div></div>
        <div style={fila}><div style={etiqueta}>Cancha:</div><div style={valorTxt}>{partido?.location || ''}</div></div>
        <button type="button" onClick={() => setVerArbitros(v => !v)}
          style={{ ...fila, width: '100%', background: '#fff', border: 'none', borderBottom: verArbitros ? LINEA : 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: TINTA }}>
          <span style={etiqueta}>ÁRBITROS {verArbitros ? '▾' : '▸'}</span>
          <span style={{ ...valorTxt, fontSize: '.8rem', fontWeight: '600', color: nombresArb.length ? TINTA : GRIS }}>{nombresArb.length ? nombresArb.join(' · ') : 'Toca para anotar árbitro central y asistentes'}</span>
        </button>
        {verArbitros && (
          <>
            <div style={fila}><div style={{ ...etiqueta, fontSize: '.7rem' }}>CENTRAL:</div>{inputArb('central', 'Nombre del árbitro central')}</div>
            <div style={fila}><div style={{ ...etiqueta, fontSize: '.7rem' }}>ASIST. N° 1:</div>{inputArb('asist1', 'Nombre del asistente 1')}</div>
            <div style={{ ...fila, borderBottom: 'none' }}><div style={{ ...etiqueta, fontSize: '.7rem' }}>ASIST. N° 2:</div>{inputArb('asist2', 'Nombre del asistente 2')}</div>
          </>
        )}
      </div>
    )
  }
  return (
    <div style={{ border: LINEA, background: '#fff', marginBottom: '10px' }}>
      <div style={fila}><div style={etiqueta}>TORNEO</div><div style={valorTxt}>{torneoNombre || partido?.tournaments?.name || ''}</div></div>
      <div style={{ ...fila, gridTemplateColumns: 'minmax(86px,auto) minmax(0,1.2fr) auto minmax(0,1fr) auto minmax(0,.8fr)' }}>
        <div style={etiqueta}>FECHA</div>
        <div style={{ ...valorTxt, borderRight: LINEA }}>{fechaTxt}</div>
        <div style={{ ...etiqueta, background: '#fff' }}>Cancha:</div>
        <div style={{ ...valorTxt, borderRight: LINEA }}>{partido?.location || ''}</div>
        <div style={{ ...etiqueta, background: '#fff' }}>Hora:</div>
        <div style={valorTxt}>{horaTxt}</div>
      </div>
      <div style={fila}><div style={etiqueta}>ÁRBITRO CENTRAL:</div>{inputArb('central', 'Nombre del árbitro central')}</div>
      <div style={fila}><div style={{ ...etiqueta, fontSize: '.7rem' }}>ASISTENTE N° 1:</div>{inputArb('asist1', 'Nombre del asistente 1')}</div>
      <div style={{ ...fila, borderBottom: 'none' }}><div style={{ ...etiqueta, fontSize: '.7rem' }}>ASISTENTE N° 2:</div>{inputArb('asist2', 'Nombre del asistente 2')}</div>
    </div>
  )
}

// Franja del arquero (igual que la de la planilla profesional): cada equipo
// necesita su arquero marcado para poder guardar el resultado.
function SelectorArquero({ etiqueta, jugadores, arquero, onElegir, vertical }) {
  const numerados = jugadores.map((j, i) => ({ j, i })).filter(x => (x.j.numero || '').trim() !== '')
  const actual = arquero ? jugadores.findIndex(j => (j.id && j.id === arquero.id) || (!j.id && !arquero.id && j.nombre === arquero.nombre)) : -1
  return (
    <div style={{ display: 'flex', alignItems: vertical ? 'stretch' : 'center', flexDirection: vertical ? 'column' : 'row', gap: vertical ? '3px' : '6px', minWidth: 0, flexWrap: vertical ? 'nowrap' : 'wrap' }}>
      <span style={{ fontSize: '.72rem', color: GRIS, fontWeight: '700', maxWidth: vertical ? '100%' : '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiqueta}{arquero ? ' ✓' : ':'}</span>
      <select value={actual >= 0 ? String(actual) : ''} onChange={e => { const k = e.target.value; if (k !== '') onElegir(jugadores[Number(k)]) }}
        style={{ ...campo, width: vertical ? '100%' : 'auto', minWidth: vertical ? 0 : '150px', padding: '5px 4px', borderColor: arquero ? '#1e8e3e' : ROJA, fontSize: '.78rem', fontWeight: '700' }}>
        <option value="">{numerados.length === 0 ? 'Primero pon los números' : '⚠️ Elegir arquero'}</option>
        {numerados.map(({ j, i }) => <option key={j.id || `sr${i}`} value={String(i)}>#{j.numero} · {j.nombre || 'Sin nombre'}</option>)}
      </select>
    </div>
  )
}

export default function PantallaPapel({
  partido, torneoNombre, nombreLocal, nombreVis, jugadoresLocal, jugadoresVisitante, eventosLocal, eventosVis,
  periodo, segundos, corriendo, tiempoAgotado, globalLlave, papel, onPapel, hayRoja, guardando,
  arqueroLocal, arqueroVis, onElegirArquero,
  onToggleCronometro, onCambiarPeriodo, onAsignarNumero, onAbrirJugador, onGol, onTarjeta, onQuitarEvento, onAgregarJugador,
  onSalir, onAbrirCierre, onAbrirEspecial,
  duracionMinutos = 0, alarmaActiva = false, onTerminarTiempo, onSilenciar,
}) {
  const hojaRef = useRef(null)
  const informeRef = useRef(null)
  const anchoHoja = useAncho(hojaRef)
  const dosColumnas = anchoHoja >= 980
  const compacta = !dosColumnas && anchoHoja > 0 && anchoHoja < 700
  const [pestana, setPestana] = useState('local')
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  const golesLocal = eventosLocal.filter(e => e.tipo === 'goal').length
  const golesVis = eventosVis.filter(e => e.tipo === 'goal').length

  useEffect(() => {
    const on = () => setEnLinea(true)
    const off = () => setEnLinea(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Pausar y pasar a 2T exigen DOBLE TOQUE (como el cronómetro de siempre).
  const ultimoToque = useRef({ pausa: 0, periodo: 0 })
  const [aviso, setAviso] = useState(null)
  const avisoTimer = useRef(null)
  useEffect(() => () => clearTimeout(avisoTimer.current), [])
  function doble(clave, accion) {
    const ahora = Date.now()
    if (ahora - ultimoToque.current[clave] < 600) {
      ultimoToque.current[clave] = 0; clearTimeout(avisoTimer.current); setAviso(null); accion(); return
    }
    ultimoToque.current[clave] = ahora
    setAviso(clave)
    clearTimeout(avisoTimer.current)
    avisoTimer.current = setTimeout(() => setAviso(null), 1200)
  }

  const onDatos = (team, fn) => onPapel(p => ({ ...p, [team]: fn(p[team]) }))
  const setPenales = cambios => onPapel(p => ({ ...p, penales: { ...p.penales, ...cambios } }))
  // TIEMPO EXTRA: al cumplirse el tiempo el reloj sigue corriendo ("EXTRA +mm:ss")
  // hasta que se toque IR AL DESCANSO / FINALIZAR.
  const limiteReloj = (duracionMinutos || 0) * 60
  const enExtra = !tiempoAgotado && limiteReloj > 0 && segundos >= limiteReloj
  const fondoReloj = tiempoAgotado ? '#b71c1c' : enExtra ? '#b45309' : periodo === 1 ? '#1a3a8a' : '#d93025'
  const boton = { padding: '7px 12px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontSize: '.8rem', fontWeight: '800', touchAction: 'manipulation' }
  const botonBarra = (fondo, extra = {}) => ({ padding: '7px 12px', background: fondo, border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700', touchAction: 'manipulation', ...extra })
  const informeListo = (papel.informe || '').trim().length >= 10
  const pen = papel.penales
  const puedeGuardar = !guardando && enLinea

  function irAlInforme() {
    try { informeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* nada */ }
    setTimeout(() => { try { informeRef.current?.querySelector('textarea')?.focus() } catch { /* nada */ } }, 350)
  }

  const bloque = (team, oculto) => (
    <div key={team} className={oculto ? 'gm-papel-tab-oculto' : undefined}>
      <BloqueEquipo team={team}
        nombre={team === 'local' ? nombreLocal : nombreVis}
        jugadores={team === 'local' ? jugadoresLocal : jugadoresVisitante}
        eventos={team === 'local' ? eventosLocal : eventosVis}
        datos={papel[team]} onDatos={onDatos}
        onNumero={onAsignarNumero} onAbrir={onAbrirJugador} onGol={onGol} onTarjeta={onTarjeta}
        onQuitar={onQuitarEvento} onAgregar={onAgregarJugador}/>
    </div>
  )

  return (
    <div className="gm-papel-raiz" style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#e8eaed', color: TINTA, fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .gm-papel-tab-oculto { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #planilla-papel-print, #planilla-papel-print * { visibility: visible !important; }
          #planilla-papel-print { position: absolute !important; left: 0; top: 0; width: 100% !important; zoom: .8; }
          .gm-papel-raiz, .gm-papel-scroll { position: static !important; overflow: visible !important; height: auto !important; }
          .gm-papel-no-imprimir { display: none !important; }
          .gm-papel-tab-oculto { display: block !important; }
        }
      `}</style>

      {/* Cronómetro + marcador (siempre a la vista) */}
      <div className="gm-papel-no-imprimir" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 14px', padding: '6px 10px', background: fondoReloj, color: '#fff', flexShrink: 0 }}>
        <span style={{ fontSize: '.78rem', fontWeight: '800', background: 'rgba(0,0,0,.25)', borderRadius: '6px', padding: '2px 8px' }}>{periodo === 1 ? '1T' : '2T'}</span>
        <span style={{ fontSize: '2rem', fontWeight: '900', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,.35)' }}>
          {enExtra && <span style={{ fontSize: '.7rem', letterSpacing: '.14em', color: '#ffe066', marginRight: '6px', fontFamily: 'system-ui,sans-serif' }}>EXTRA</span>}
          {enExtra ? `+${formatTiempo(segundos - limiteReloj)}` : formatTiempo(segundos)}
        </span>
        {alarmaActiva && onSilenciar && (
          <button type="button" onClick={onSilenciar} style={{ ...boton, background: '#fff', color: '#b71c1c' }}>🔕 Silenciar</button>
        )}
        {enExtra && onTerminarTiempo && (
          <button type="button" onClick={() => { onTerminarTiempo(); if (periodo === 2) onAbrirCierre() }}
            style={{ ...boton, padding: '10px 16px', fontSize: '.9rem', background: periodo === 1 ? '#e8710a' : '#1a73e8', color: '#fff', boxShadow: '0 0 0 2px #fff' }}>
            {periodo === 1 ? '⏸ IR AL DESCANSO' : '🏁 FINALIZAR PARTIDO'}
          </button>
        )}
        <button type="button" onClick={() => { if (corriendo) doble('pausa', onToggleCronometro); else onToggleCronometro() }}
          title={corriendo ? 'Doble toque para pausar' : 'Iniciar'}
          style={{ ...boton, background: aviso === 'pausa' ? '#ffdd44' : 'rgba(255,255,255,.92)', color: aviso === 'pausa' ? '#222' : fondoReloj }}>
          {corriendo ? (aviso === 'pausa' ? '⏸ ¡Otra vez!' : '⏸ Pausar ×2') : '▶️ Iniciar'}
        </button>
        {periodo === 1 && (
          <button type="button" onClick={() => doble('periodo', onCambiarPeriodo)} title="Doble toque para pasar al 2do tiempo"
            style={{ ...boton, background: aviso === 'periodo' ? '#ffdd44' : 'rgba(255,255,255,.2)', color: aviso === 'periodo' ? '#222' : '#fff' }}>
            {aviso === 'periodo' ? '¡Otra vez!' : '2T →'}
          </button>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,.25)', borderRadius: '10px', padding: '3px 10px', minWidth: 0, maxWidth: '100%' }}>
          <span style={{ fontSize: '.7rem', fontWeight: '700', opacity: .9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{nombreLocal}</span>
          <span style={{ fontSize: '1.25rem', fontWeight: '900', whiteSpace: 'nowrap' }}>{golesLocal} - {golesVis}</span>
          <span style={{ fontSize: '.7rem', fontWeight: '700', opacity: .9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>{nombreVis}</span>
        </span>
        {globalLlave && (
          <span style={{ fontSize: '.7rem', fontWeight: '800' }}><span style={{ color: '#ffdd44', marginRight: '4px' }}>GLOBAL</span>{globalLlave.local} - {globalLlave.visitante}</span>
        )}
      </div>
      {!corriendo && segundos === 0 && periodo === 1 && !tiempoAgotado && (
        <div className="gm-papel-no-imprimir" style={{ background: '#fff3cd', color: '#664d03', fontSize: '.72rem', fontWeight: '700', textAlign: 'center', padding: '4px 8px', flexShrink: 0 }}>
          Toca ▶️ Iniciar cuando empiece el partido: cada gol y tarjeta se anota con el minuto del cronómetro.
        </div>
      )}

      {/* Pestañas de equipo (solo cuando no caben los dos lado a lado) */}
      {!dosColumnas && (
        <div className="gm-papel-no-imprimir" style={{ display: 'flex', gap: '6px', padding: '6px 8px 0', flexShrink: 0 }}>
          {[['local', nombreLocal, golesLocal], ['visitante', nombreVis, golesVis]].map(([clave, nom, g]) => (
            <button key={clave} type="button" onClick={() => setPestana(clave)}
              style={{ flex: 1, minWidth: 0, padding: '9px 6px', borderRadius: '9px 9px 0 0', border: `1px solid ${pestana === clave ? TINTA : '#bdc1c6'}`, borderBottom: 'none', background: pestana === clave ? '#fff' : '#d2d5d9', color: TINTA, fontWeight: '900', fontSize: '.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clave === 'local' ? '🏠' : '🚩'} {nom}</span>
              <span style={{ background: TINTA, color: '#fff', borderRadius: '10px', padding: '1px 8px', fontSize: '.74rem', flexShrink: 0 }}>{g}</span>
            </button>
          ))}
        </div>
      )}

      <div className="gm-papel-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div ref={hojaRef} style={{ maxWidth: '1240px', margin: '0 auto', padding: dosColumnas ? '12px' : '0 8px 24px' }}>

          {/* Botones de arriba: los mismos de la planilla profesional */}
          <div className="gm-papel-no-imprimir" style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', padding: '8px 10px', margin: '8px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            {!compacta && <span style={{ fontWeight: '700', fontSize: '.82rem', color: '#202124', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>📋 {nombreLocal} vs {nombreVis}</span>}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!enLinea && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fff3e0', borderRadius: '6px', padding: '4px 8px', fontWeight: '700', border: '1px solid #ffe0b2' }}>📵 Sin internet</span>}
              <button type="button" onClick={onSalir} title="Pausa y guarda un borrador — el partido queda pendiente para seguir después, sin marcarlo como jugado"
                style={botonBarra('#fff', { color: GRIS, border: '1px solid #dadce0' })}>⏸ Suspender</button>
              <button type="button" onClick={irAlInforme} style={botonBarra(informeListo ? '#1e8e3e' : '#7b1fa2')}>{informeListo ? '✓ Informe' : '📝 Informe'}</button>
              <button type="button" onClick={() => onAbrirEspecial('w')} style={botonBarra('#e8710a')}>🏆 Por W</button>
              <button type="button" onClick={() => onAbrirEspecial('desierto')} style={botonBarra('#5f6368')}>❌ Desierto</button>
              <button type="button" onClick={onAbrirCierre} disabled={!puedeGuardar}
                style={botonBarra(puedeGuardar ? '#1e8e3e' : '#9aa0a6', { cursor: puedeGuardar ? 'pointer' : 'not-allowed' })}>
                {guardando ? 'Guardando...' : !enLinea ? '📵 Sin internet' : '💾 Guardar resultado'}
              </button>
              <button type="button" onClick={() => window.print()} style={botonBarra('#1a73e8')}>🖨 Imprimir</button>
            </div>
          </div>

          {/* Arquero obligatorio */}
          <div className="gm-papel-no-imprimir" style={{ padding: '8px 10px', background: '#fffde7', border: '1px solid #ffe082', borderRadius: '10px', marginBottom: '8px', display: compacta ? 'grid' : 'flex', gridTemplateColumns: compacta ? '1fr 1fr' : undefined, alignItems: compacta ? 'start' : 'center', gap: '8px 16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.78rem', fontWeight: '800', color: '#f57f17', gridColumn: compacta ? '1 / -1' : undefined }}>🧤 Arquero obligatorio:</span>
            <SelectorArquero vertical={compacta} etiqueta={nombreLocal} jugadores={jugadoresLocal} arquero={arqueroLocal} onElegir={j => onElegirArquero('local', j)}/>
            <SelectorArquero vertical={compacta} etiqueta={nombreVis} jugadores={jugadoresVisitante} arquero={arqueroVis} onElegir={j => onElegirArquero('visitante', j)}/>
          </div>

          {/* Penales */}
          <div className="gm-papel-no-imprimir" style={{ padding: '8px 10px', background: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '10px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px 12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '.8rem', fontWeight: '700', color: '#202124' }}>
              <input type="checkbox" checked={pen.hubo} onChange={e => setPenales({ hubo: e.target.checked })} style={{ width: '17px', height: '17px', accentColor: '#1a73e8' }}/>
              ⚽ Hubo penales
            </label>
            {pen.hubo && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '.75rem', color: GRIS, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreLocal}:</span>
                  <input type="number" min="0" inputMode="numeric" value={pen.local} onChange={e => setPenales({ local: e.target.value })} style={{ width: '48px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 6px', fontSize: '.9rem', fontWeight: '800' }}/>
                </div>
                <span style={{ fontWeight: '800', color: GRIS }}>—</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '.75rem', color: GRIS, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreVis}:</span>
                  <input type="number" min="0" inputMode="numeric" value={pen.visitante} onChange={e => setPenales({ visitante: e.target.value })} style={{ width: '48px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 6px', fontSize: '.9rem', fontWeight: '800' }}/>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.75rem', color: GRIS }}>Ganador:</span>
                  {[['local', nombreLocal], ['visitante', nombreVis]].map(([clave, nom]) => (
                    <button key={clave} type="button" onClick={() => setPenales({ ganador: clave })}
                      style={{ padding: '5px 10px', border: `2px solid ${pen.ganador === clave ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px', cursor: 'pointer', background: pen.ganador === clave ? '#e6f4ea' : '#fff', color: pen.ganador === clave ? '#1e8e3e' : GRIS, fontSize: '.75rem', fontWeight: pen.ganador === clave ? '800' : '500', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── La hoja (esto es lo que se imprime) ── */}
          <div id="planilla-papel-print">
            <Cabecera partido={partido} torneoNombre={torneoNombre} papel={papel} onPapel={onPapel} compacta={compacta}/>
            {dosColumnas ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'start' }}>
                {bloque('local', false)}
                {bloque('visitante', false)}
              </div>
            ) : (
              <>
                {bloque('local', pestana !== 'local')}
                {bloque('visitante', pestana !== 'visitante')}
              </>
            )}
            <div ref={informeRef}>
              <InformeArbitral valor={papel.informe} onCambio={v => onPapel(p => ({ ...p, informe: v }))} obligatorio={hayRoja}/>
            </div>
          </div>

          <div className="gm-papel-no-imprimir" style={{ marginTop: '14px' }}>
            <button type="button" onClick={onAbrirCierre} disabled={!puedeGuardar}
              style={{ width: '100%', padding: '14px', background: puedeGuardar ? '#1e8e3e' : '#9aa0a6', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '.95rem', fontWeight: '800', cursor: puedeGuardar ? 'pointer' : 'not-allowed' }}>
              {guardando ? 'Guardando...' : !enLinea ? '📵 Sin internet' : '💾 Guardar resultado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
