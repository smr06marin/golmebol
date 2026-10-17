import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// MODO RELOJ — página pensada para el navegador de un smartwatch.
// Entra por /reloj/<token> (link que genera el organizador, sin login ni app).
// Pantalla en "corte de torta": en el centro el tiempo del partido y alrededor
// los botones (Gol, Cambio, Amarilla, Roja y, si el organizador lo pidió, Falta).
// Tocar un botón → equipo → número de camiseta. Cada evento se guarda en el
// partido (tabla reloj_eventos) y la planilla lo recoge sola.
//
// Sin señal: los eventos quedan en una cola del reloj y se reenvían solos
// (cada uno lleva un id único, así que no se duplican).

const TIPOS = {
  goal:        { label: 'GOL',      color: '#1e8e3e', texto: '#fff' },
  cambio:      { label: 'CAMBIO',   color: '#1a73e8', texto: '#fff' },
  yellow_card: { label: 'AMARILLA', color: '#f9c400', texto: '#1a1a1a' },
  red_card:    { label: 'ROJA',     color: '#d93025', texto: '#fff' },
  falta_acum:  { label: 'FALTA',    color: '#e8710a', texto: '#fff' },
}
const COLOR_EQUIPO = { local: '#22d3ee', visitante: '#c4b5fd' }
// Errores que la base devuelve a propósito: reintentar no sirve, se descarta el evento.
const PERMANENTE = /Link inválido|El link venció|Partido cerrado|no marca faltas|Número inválido|Falta el número|Evento inválido|Equipo inválido/i

function idUnico() {
  try { return crypto.randomUUID() } catch { return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}` }
}
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const rad = d => (d * Math.PI) / 180
const polar = (r, d) => [100 + r * Math.cos(rad(d)), 100 + r * Math.sin(rad(d))]
function sector(a0, a1, rIn, rOut) {
  const [x0, y0] = polar(rOut, a0), [x1, y1] = polar(rOut, a1)
  const [x2, y2] = polar(rIn, a1), [x3, y3] = polar(rIn, a0)
  const grande = a1 - a0 > 180 ? 1 : 0
  return `M${x0} ${y0} A${rOut} ${rOut} 0 ${grande} 1 ${x1} ${y1} L${x2} ${y2} A${rIn} ${rIn} 0 ${grande} 0 ${x3} ${y3} Z`
}
function vibrar(p) { try { navigator.vibrate && navigator.vibrate(p) } catch { /* sin vibración */ } }

function leerCola(token) {
  try { const v = JSON.parse(localStorage.getItem(`reloj_cola_${token}`) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function guardarCola(token, cola) {
  try { localStorage.setItem(`reloj_cola_${token}`, JSON.stringify(cola)) } catch { /* sin almacenamiento */ }
}

function Tecla({ onClick, estilo, children }) {
  return (
    <button onClick={onClick} style={{ border: 'none', borderRadius: 12, background: '#1f2937', color: '#fff', fontWeight: 800, fontSize: 'min(8vmin, 30px)', cursor: 'pointer', ...estilo }}>{children}</button>
  )
}

export default function RelojLinkPage() {
  const { token } = useParams()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [ahora, setAhora] = useState(() => Date.now()) // se actualiza cada segundo: mueve el reloj sin llamar Date.now() al dibujar
  const [offsetMs, setOffsetMs] = useState(0)          // hora del servidor − hora del reloj
  const [paso, setPaso] = useState('pie')          // pie | equipo | num | num2
  const [tipo, setTipo] = useState(null)
  const [equipo, setEquipo] = useState(null)
  const [momento, setMomento] = useState(null)
  const [num, setNum] = useState('')
  const [num1, setNum1] = useState('')
  const [flash, setFlash] = useState(null)         // confirmación corta tras registrar
  const [ultimo, setUltimo] = useState(null)       // último evento: se puede deshacer unos segundos
  const [pendientes, setPendientes] = useState(() => leerCola(token).length)
  const [local, setLocal] = useState({ base: 0, desde: null }) // cronómetro propio si la planilla aún no tiene reloj
  const colaRef = useRef(leerCola(token))
  const enviandoRef = useRef(false)

  useEffect(() => { document.title = 'Golmebol · Reloj' }, [])

  // Pantalla encendida mientras se arbitra (si el navegador lo permite)
  useEffect(() => {
    let lock = null
    async function pedir() { try { lock = await navigator.wakeLock?.request('screen') } catch { /* no disponible */ } }
    pedir()
    const vis = () => { if (document.visibilityState === 'visible') pedir() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); try { lock?.release() } catch { /* nada */ } }
  }, [])

  // ── Info del partido + reloj de la planilla (cada 4 s) ─────────────────
  const cargar = useCallback(async () => {
    try {
      const { data, error: e } = await supabase.rpc('reloj_info', { p_token: token })
      if (e) { if (/Link inválido/i.test(e.message || '')) setError('Link inválido'); return }
      if (data?.ahora) setOffsetMs(new Date(data.ahora).getTime() - Date.now())
      setInfo(data)
      setError('')
    } catch { /* sin señal: se sigue con lo último que se vio */ }
  }, [token])
  useEffect(() => {
    const t0 = setTimeout(cargar, 0)
    const t = setInterval(cargar, 4000)
    const vis = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearTimeout(t0); clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [cargar])

  // Latido de 1 s para mover el reloj
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Tiempo del partido: el de la planilla (si ya está planillando) o el propio
  function leerReloj(nowMs) {
    if (info?.hay_reloj && info.segundos != null) {
      let s = info.segundos
      if (info.corriendo && info.actualizado) {
        const dt = (nowMs + offsetMs - new Date(info.actualizado).getTime()) / 1000
        s += Math.max(0, Math.min(30, Math.floor(dt)))
      }
      return { seg: s, periodo: info.periodo || 1, remoto: true, corriendo: !!info.corriendo }
    }
    const seg = local.base + (local.desde ? Math.floor((nowMs - local.desde) / 1000) : 0)
    return { seg, periodo: 1, remoto: false, corriendo: !!local.desde }
  }

  // ── Cola de envío (tolera falta de señal) ──────────────────────────────
  const vaciarCola = useCallback(async () => {
    if (enviandoRef.current) return
    enviandoRef.current = true
    try {
      while (colaRef.current.length > 0) {
        const it = colaRef.current[0]
        let err = null
        try {
          const r = it.op === 'anular'
            ? await supabase.rpc('reloj_anular', { p_token: token, p_id: it.id })
            : await supabase.rpc('reloj_registrar', {
                p_token: token, p_id: it.id, p_team: it.team, p_tipo: it.tipo,
                p_numero: it.numero || '', p_numero2: it.numero2 || null, p_minuto: it.minuto, p_periodo: it.periodo,
              })
          err = r.error
        } catch (e) { err = e || { message: 'sin señal' } }
        if (err) {
          const msg = err.message || ''
          if (err.code === 'P0001' || PERMANENTE.test(msg)) {
            // La base lo rechazó a propósito (partido cerrado, link vencido...): se descarta
            if (/Partido cerrado|El link venció|Link inválido/i.test(msg)) setError(msg)
            colaRef.current = colaRef.current.slice(1)
            guardarCola(token, colaRef.current); setPendientes(colaRef.current.length)
            continue
          }
          break // sin señal: se reintenta luego
        }
        colaRef.current = colaRef.current.slice(1)
        guardarCola(token, colaRef.current); setPendientes(colaRef.current.length)
      }
    } finally { enviandoRef.current = false }
  }, [token])
  useEffect(() => {
    vaciarCola()
    const t = setInterval(() => { if (colaRef.current.length > 0) vaciarCola() }, 5000)
    window.addEventListener('online', vaciarCola)
    return () => { clearInterval(t); window.removeEventListener('online', vaciarCola) }
  }, [vaciarCola])

  function encolar(item) {
    colaRef.current = [...colaRef.current, item]
    guardarCola(token, colaRef.current); setPendientes(colaRef.current.length)
    vaciarCola()
  }

  // ── Flujo de toques ────────────────────────────────────────────────────
  function tocarTipo(t) {
    const r = leerReloj(new Date().getTime())
    setMomento({ minuto: fmt(r.seg), periodo: r.periodo }) // el minuto es el del toque, no el de cuando termina de teclear el número
    setTipo(t); setEquipo(null); setNum(''); setNum1('')
    setPaso('equipo'); vibrar(25)
  }
  function elegirEquipo(e) { setEquipo(e); setNum(''); setPaso('num'); vibrar(15) }
  function teclear(d) { setNum(n => (n.length < 3 ? n + d : n)); vibrar(10) }
  function borrar() { setNum(n => n.slice(0, -1)) }
  function cancelar() { setPaso('pie'); setTipo(null); setEquipo(null); setNum(''); setNum1('') }

  function confirmar() {
    if (tipo === 'cambio' && paso === 'num') { setNum1(num); setNum(''); setPaso('num2'); vibrar(15); return }
    if (tipo !== 'cambio' && !num) return
    const item = {
      op: 'reg', id: idUnico(), team: equipo, tipo,
      numero: tipo === 'cambio' ? num1 : num,
      numero2: tipo === 'cambio' ? num : null,
      minuto: momento?.minuto || '00:00', periodo: momento?.periodo || 1,
    }
    encolar(item)
    const nombreEquipo = equipo === 'local' ? info?.home : info?.away
    const detalle = tipo === 'cambio'
      ? `${item.numero ? '↓' + item.numero : ''} ${item.numero2 ? '↑' + item.numero2 : ''}`.trim()
      : `#${item.numero}`
    setFlash(f => ({ txt: TIPOS[tipo].label, det: detalle, eq: nombreEquipo, color: TIPOS[tipo].color, t: (f?.t || 0) + 1 }))
    setUltimo({ id: item.id })
    vibrar([60, 40, 60])
    setPaso('pie'); setTipo(null); setEquipo(null); setNum(''); setNum1('')
  }

  // El flash dura poco y el "deshacer" 8 s
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 1300); return () => clearTimeout(t) }, [flash])
  useEffect(() => { if (!ultimo) return; const t = setTimeout(() => setUltimo(null), 8000); return () => clearTimeout(t) }, [ultimo])

  function deshacer() {
    if (!ultimo) return
    const aunEnCola = colaRef.current.some(i => i.op === 'reg' && i.id === ultimo.id)
    if (aunEnCola) {
      colaRef.current = colaRef.current.filter(i => !(i.op === 'reg' && i.id === ultimo.id))
      guardarCola(token, colaRef.current); setPendientes(colaRef.current.length)
    } else {
      encolar({ op: 'anular', id: ultimo.id })
    }
    setUltimo(null); setFlash(f => ({ txt: 'DESHECHO', det: '', eq: '', color: '#6b7280', t: (f?.t || 0) + 1 }))
    vibrar(40)
  }

  function tocarCentro() {
    if (ultimo) { deshacer(); return }
    if (info?.hay_reloj) return // el reloj lo maneja la planilla
    setLocal(l => l.desde
      ? { base: l.base + Math.floor((Date.now() - l.desde) / 1000), desde: null }
      : { base: l.base, desde: Date.now() })
    vibrar(20)
  }

  // ── Pantallas de estado ────────────────────────────────────────────────
  const contenedor = { position: 'fixed', inset: 0, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation', overflow: 'hidden' }
  const msg = (t, sub) => (
    <div style={contenedor}><div style={{ textAlign: 'center', padding: '14%' }}>
      <div style={{ fontSize: 'min(9vmin, 34px)', fontWeight: 800, lineHeight: 1.2 }}>{t}</div>
      {sub && <div style={{ fontSize: 'min(5.5vmin, 20px)', opacity: .7, marginTop: 8 }}>{sub}</div>}
    </div></div>
  )
  if (error && !info) return msg('Link inválido', 'Pídele otro al organizador')
  if (!info) return msg('Cargando…')
  if (info.terminado) return msg('Partido terminado ✓', `${info.home} vs ${info.away}`)
  if (info.vencido) return msg('Link vencido', 'Pídele otro al organizador')

  const r = leerReloj(ahora)
  const lista = ['goal', 'cambio', 'yellow_card', 'red_card', ...(info.con_faltas ? ['falta_acum'] : [])]

  // ── Equipo ─────────────────────────────────────────────────────────────
  if (paso === 'equipo') {
    const mitad = (key, nombre) => (
      <button onClick={() => elegirEquipo(key)} style={{ flex: 1, border: 'none', background: COLOR_EQUIPO[key], color: '#0b0b12', fontWeight: 900, fontSize: 'min(9vmin, 34px)', padding: '0 14%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.1, overflow: 'hidden' }}>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{nombre}</span>
      </button>
    )
    return (
      <div style={{ ...contenedor, flexDirection: 'column', alignItems: 'stretch' }}>
        {mitad('local', info.home)}
        {mitad('visitante', info.away)}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 6, background: TIPOS[tipo].color, color: TIPOS[tipo].texto, borderRadius: 999, padding: '6px 10px', fontWeight: 900, fontSize: 'min(5vmin, 18px)', border: '3px solid #000', pointerEvents: 'none' }}>
          {TIPOS[tipo].label}
        </div>
        <button onClick={cancelar} aria-label="Cancelar" style={{ position: 'absolute', left: '50%', bottom: '3%', transform: 'translateX(-50%)', background: '#000', color: '#fff', border: '2px solid #444', borderRadius: 999, width: 'min(11vmin, 44px)', height: 'min(11vmin, 44px)', fontSize: 'min(6vmin, 22px)', fontWeight: 900, cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  // ── Número (y segundo número en cambios) ───────────────────────────────
  if (paso === 'num' || paso === 'num2') {
    const t = TIPOS[tipo]
    const nombreEquipo = equipo === 'local' ? info.home : info.away
    const subtitulo = tipo === 'cambio' ? (paso === 'num' ? '↓ SALE' : '↑ ENTRA') : nombreEquipo
    const okListo = tipo === 'cambio' ? true : num.length > 0
    return (
      <div style={{ ...contenedor, flexDirection: 'column', alignItems: 'stretch', padding: '7% 9% 6%', gap: '2.5%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ background: t.color, color: t.texto, borderRadius: 999, padding: '2px 9px', fontWeight: 900, fontSize: 'min(4.2vmin, 15px)' }}>{t.label}</span>
          <span style={{ color: COLOR_EQUIPO[equipo], fontWeight: 800, fontSize: 'min(4.4vmin, 16px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{subtitulo}</span>
        </div>
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 'min(13vmin, 48px)', lineHeight: 1, minHeight: '1.05em', letterSpacing: 2, flexShrink: 0 }}>
          {num || <span style={{ opacity: .25 }}>{tipo === 'cambio' ? '—' : '#'}</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: '2.5%' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <Tecla key={d} onClick={() => teclear(d)}>{d}</Tecla>)}
          <Tecla onClick={borrar} estilo={{ background: '#3b2a2a', color: '#fca5a5' }}>⌫</Tecla>
          <Tecla onClick={() => teclear('0')}>0</Tecla>
          <Tecla onClick={confirmar} estilo={{ background: okListo ? '#16a34a' : '#14301f', color: okListo ? '#fff' : '#4b6b55' }}>✓</Tecla>
        </div>
        <button onClick={cancelar} style={{ background: 'none', border: 'none', color: '#9ca3af', fontWeight: 700, fontSize: 'min(3.8vmin, 14px)', cursor: 'pointer', padding: 0, flexShrink: 0 }}>cancelar</button>
      </div>
    )
  }

  // ── Torta ──────────────────────────────────────────────────────────────
  const n = lista.length
  const paso_ang = 360 / n
  const inicio = n === 4 ? -180 : -90 - paso_ang / 2 // 4: cuadrantes (goles/cambios arriba, tarjetas abajo); 5: Gol arriba al centro
  const R = 98, r_in = 42
  const marcador = `${info.goles_local} - ${info.goles_visitante}`

  return (
    <div style={contenedor}>
      <svg viewBox="0 0 200 200" style={{ width: '100vmin', height: '100vmin', display: 'block' }} role="group" aria-label="Registrar evento">
        {lista.map((k, i) => {
          const a0 = inicio + i * paso_ang, a1 = a0 + paso_ang, mid = (a0 + a1) / 2
          const t = TIPOS[k]
          const [lx, ly] = polar(67, mid)
          return (
            <g key={k} onClick={() => tocarTipo(k)} style={{ cursor: 'pointer' }}>
              <path d={sector(a0 + .8, a1 - .8, r_in + 2, R)} fill={t.color} stroke="#000" strokeWidth="2.5" />
              {k === 'yellow_card' || k === 'red_card' ? (
                <rect x={lx - 7} y={ly - 15} width="14" height="19" rx="2" fill={k === 'red_card' ? '#fff' : '#1a1a1a'} opacity=".92" pointerEvents="none" />
              ) : (
                <text x={lx} y={ly - 3} textAnchor="middle" fontSize="19" pointerEvents="none">{k === 'goal' ? '⚽' : k === 'cambio' ? '🔄' : '🟠'}</text>
              )}
              <text x={lx} y={ly + 13} textAnchor="middle" fontSize="8.8" fontWeight="900" fill={t.texto} pointerEvents="none">{t.label}</text>
            </g>
          )
        })}
        {/* Centro: tiempo del partido (toca para deshacer / iniciar el cronómetro propio) */}
        <g onClick={tocarCentro} style={{ cursor: 'pointer' }}>
          <circle cx="100" cy="100" r={r_in} fill="#0b0b12" stroke={ultimo ? '#f87171' : '#27272f'} strokeWidth="2.5" />
          <text x="100" y="84" textAnchor="middle" fontSize="8" fontWeight="800" fill="#9ca3af" pointerEvents="none">{r.periodo}T{r.remoto ? '' : ' · propio'}</text>
          <text x="100" y="105" textAnchor="middle" fontSize="23" fontWeight="900" fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }} pointerEvents="none">{fmt(r.seg)}</text>
          <text x="100" y="119" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={ultimo ? '#f87171' : pendientes > 0 ? '#fbbf24' : '#22d3ee'} pointerEvents="none">
            {ultimo ? '↶ DESHACER' : pendientes > 0 ? `⏳ ${pendientes} sin enviar` : (!r.remoto ? (r.corriendo ? '⏸ pausar' : '▶ iniciar') : marcador)}
          </text>
        </g>
      </svg>

      {flash && (
        <div key={flash.t} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: flash.color, color: '#fff', borderRadius: 18, padding: '10px 18px', textAlign: 'center', border: '3px solid #000', boxShadow: '0 0 0 3px rgba(255,255,255,.25)' }}>
            <div style={{ fontSize: 'min(8vmin, 30px)', fontWeight: 900 }}>✓ {flash.txt}</div>
            {(flash.det || flash.eq) && <div style={{ fontSize: 'min(5vmin, 18px)', fontWeight: 800, opacity: .95 }}>{flash.det} {flash.eq}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
