import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { X, Printer, Play, Pause, RotateCcw, Minimize2, Maximize2, Move, Edit2 } from 'lucide-react'
import { PLANILLA_ABIERTA_KEY } from '../lib/planillaRecovery'

const AZUL = '#1a3a8a'
const ROJO = '#d93025'

// La planilla física siempre trae 12 casillas por equipo. Las que sobran
// (sin jugador de la nómina) quedan como filas en blanco que el árbitro
// puede llenar a mano con alguien que no está registrado en el sistema
// (id: null) — se identifican por no tener id, y en la fila se puede
// escribir el nombre directamente.
function conRellenoA12(jugs) {
  const base = jugs || []
  const faltan = Math.max(0, 12 - base.length)
  const vacios = Array.from({ length: faltan }).map(() => ({
    id: null, nombre: '', cedula: '', numero: '', faltasPeriodo: [], amarilla: false, azul: false, roja: false,
    posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
  }))
  return [...base, ...vacios]
}

function FirmaCanvas({ titulo, onSave, onClose }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  useEffect(() => {
    const c = canvasRef.current, ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  }, [])
  function getPos(clientX, clientY, c) {
    const r = c.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }
  function startAt(x, y) { const c = canvasRef.current, ctx = c.getContext('2d'); drawing.current = true; ctx.beginPath(); ctx.moveTo(x, y) }
  function drawAt(x, y) { if (!drawing.current) return; const c = canvasRef.current, ctx = c.getContext('2d'); ctx.lineTo(x, y); ctx.stroke() }
  function stopDrawing() { drawing.current = false }

  // Listeners táctiles nativos y explícitamente NO pasivos: los handlers sintéticos
  // de React para touchmove pueden quedar pasivos en algunos navegadores Android,
  // haciendo que preventDefault() no funcione y la página haga scroll/zoom en vez
  // de dibujar — eso es lo que hacía fallar la firma a veces.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    function onTouchStart(e) { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY, c); startAt(p.x, p.y) }
    function onTouchMove(e)  { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY, c); drawAt(p.x, p.y) }
    function onTouchEnd(e)   { e.preventDefault(); stopDrawing() }
    c.addEventListener('touchstart', onTouchStart, { passive: false })
    c.addEventListener('touchmove',  onTouchMove,  { passive: false })
    c.addEventListener('touchend',   onTouchEnd,   { passive: false })
    c.addEventListener('touchcancel', onTouchEnd,  { passive: false })
    return () => {
      c.removeEventListener('touchstart', onTouchStart)
      c.removeEventListener('touchmove',  onTouchMove)
      c.removeEventListener('touchend',   onTouchEnd)
      c.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  function handleMouseDown(e) { const p = getPos(e.clientX, e.clientY, canvasRef.current); startAt(p.x, p.y) }
  function handleMouseMove(e) { const p = getPos(e.clientX, e.clientY, canvasRef.current); drawAt(p.x, p.y) }
  function handleMouseUp() { stopDrawing() }
  function limpiar() { const c = canvasRef.current, ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) }
  function guardar() { onSave(canvasRef.current.toDataURL('image/png')); onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: '600', color: '#202124', marginBottom: '12px', textAlign: 'center', fontSize: '.9rem' }}>✍ Firma: {titulo}</div>
        <canvas ref={canvasRef} width={320} height={120} style={{ border: '2px solid #dadce0', borderRadius: '8px', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}/>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
          <button onClick={limpiar} style={{ padding: '7px 14px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', fontSize: '.85rem' }}>Limpiar</button>
          <button onClick={guardar} style={{ padding: '7px 18px', background: AZUL, border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600' }}>Guardar</button>
          <button onClick={onClose} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', fontSize: '.85rem' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function FirmaSlot({ label, firma, onFirmar }) {
  return (
    <div onClick={onFirmar} title="Click para firmar" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #9aa0a6', borderRadius: '3px', minWidth: '60px', minHeight: '22px', background: '#fafafa', verticalAlign: 'middle' }}>
      {firma ? <img src={firma} style={{ maxWidth: '60px', maxHeight: '20px', objectFit: 'contain' }}/> : <span style={{ fontSize: '7px', color: '#9aa0a6' }}>✍ Firmar</span>}
    </div>
  )
}

function InputCamiseta({ value, onChange, onDoubleClick, repetido }) {
  const ref = useRef(null)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = String(value ?? '')
  }, [value])
  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    e.target.value = val
    if (val.length === 2 || val.length === 0) onChange(val)
    if (val.length === 2 && ref.current) ref.current.blur() // apenas se completa el número, vuelve a su tamaño normal
  }
  function handleBlur(e) { onChange(e.target.value.replace(/\D/g, '').slice(0, 2)); setFocused(false) }
  function handleDoubleClick() { if (ref.current) ref.current.value = ''; onChange(''); onDoubleClick() }
  const bg = !value ? '#fff3cd' : repetido ? '#ff4444' : '#111'
  const color = !value ? '#e8710a' : '#fff'
  return (
    <td style={{ border: '1px solid #000', padding: '1px', background: bg, textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}
      title={repetido ? '⚠ Número repetido' : !value ? 'Número obligatorio' : ''}>
      <input ref={ref} defaultValue={String(value ?? '')} onChange={handleChange} onFocus={() => setFocused(true)} onBlur={handleBlur}
        onDoubleClick={handleDoubleClick} placeholder="N°" maxLength={2} inputMode="numeric"
        style={{
          border: focused ? '2px solid #1a73e8' : 'none', outline: 'none',
          width: focused ? '40px' : '100%', height: focused ? '32px' : 'auto',
          fontSize: focused ? '19px' : '11px', fontWeight: '900', textAlign: 'center',
          background: focused ? '#fff' : 'transparent', color: focused ? '#111' : color,
          position: focused ? 'absolute' : 'static', top: focused ? '50%' : 'auto', left: focused ? '50%' : 'auto',
          transform: focused ? 'translate(-50%, -50%)' : 'none', zIndex: focused ? 60 : 'auto',
          borderRadius: focused ? '7px' : '0', boxShadow: focused ? '0 4px 14px rgba(0,0,0,.4)' : 'none',
          transition: 'all .12s ease',
        }}/>
    </td>
  )
}

function ModalMVP({ jugadoresLocal, jugadoresVisitante, partido, mvpGuardado, onGuardar, onSaltear }) {
  const [equipo,  setEquipo]  = useState('')
  const [numero,  setNumero]  = useState('')
  const [jugador, setJugador] = useState(null)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (mvpGuardado) {
      const jug = [...jugadoresLocal, ...jugadoresVisitante].find(j => j.id === mvpGuardado)
      if (jug) setJugador(jug)
    }
  }, [mvpGuardado])

  function handleNumero(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setNumero(val); setError('')
    if (val && equipo) {
      const jugs = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
      setJugador(jugs.find(j => String(j.numero) === val) || null)
    } else setJugador(null)
  }
  function handleEquipo(e) { setEquipo(e.target.value); setNumero(''); setJugador(null); setError('') }
  function handleGuardar() {
    if (!equipo)  { setError('Selecciona el equipo'); return }
    if (!numero)  { setError('Ingresa el número de camiseta'); return }
    if (!jugador) { setError('No se encontró ese número en el equipo'); return }
    if (!jugador.id) { setError('Ese jugador no está registrado en el sistema — no puede ser MVP'); return }
    onGuardar(jugador.id)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⭐</div>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem' }}>MVP del partido</div>
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '4px' }}>{partido.home?.name} vs {partido.away?.name}</div>
          <div style={{ fontSize: '.72rem', color: '#d93025', marginTop: '6px', fontWeight: '600' }}>* Obligatorio para guardar el resultado</div>
        </div>
        {mvpGuardado && jugador && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⭐</span>
            <div><div style={{ fontSize: '.78rem', color: '#795548', fontWeight: '700' }}>MVP ya guardado</div><div style={{ fontSize: '.85rem', color: '#202124', fontWeight: '600' }}>{jugador.nombre} · #{jugador.numero}</div></div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Equipo</label>
            <select value={equipo} onChange={handleEquipo} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #dadce0', borderRadius: '8px', fontSize: '.9rem', color: '#202124', outline: 'none', background: '#fff' }}>
              <option value="">Seleccionar equipo...</option>
              <option value="local">{partido.home?.name}</option>
              <option value="visitante">{partido.away?.name}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Número de camiseta</label>
            <input value={numero} onChange={handleNumero} placeholder="Ej: 10" inputMode="numeric" maxLength={2} disabled={!equipo}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #dadce0', borderRadius: '8px', fontSize: '1.2rem', fontWeight: '700', color: '#202124', outline: 'none', boxSizing: 'border-box', background: !equipo ? '#f8f9fa' : '#fff' }}/>
          </div>
          <div style={{ minHeight: '44px', background: jugador ? '#e6f4ea' : numero && equipo ? '#fce8e6' : '#f8f9fa', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', border: `1px solid ${jugador ? '#ceead6' : numero && equipo ? '#fad2cf' : '#e8eaed'}` }}>
            {jugador ? (
              <><span style={{ fontSize: '1.4rem' }}>✅</span><div><div style={{ fontWeight: '700', color: '#1e8e3e', fontSize: '.95rem' }}>{jugador.nombre}</div><div style={{ fontSize: '.72rem', color: '#5f6368' }}>Camiseta #{jugador.numero}</div></div></>
            ) : numero && equipo ? (
              <><span style={{ fontSize: '1.4rem' }}>❌</span><div style={{ fontSize: '.82rem', color: '#d93025' }}>No se encontró camiseta #{numero}</div></>
            ) : (
              <div style={{ fontSize: '.78rem', color: '#9aa0a6' }}>El nombre del jugador aparecerá aquí</div>
            )}
          </div>
          {error && <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '8px', padding: '8px 12px', fontSize: '.78rem', color: '#d93025' }}>{error}</div>}
          <button onClick={handleGuardar} disabled={!jugador}
            style={{ padding: '12px', background: !jugador ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: !jugador ? 'not-allowed' : 'pointer', color: !jugador ? '#9aa0a6' : '#fff', fontWeight: '700', fontSize: '.95rem' }}>
            ⭐ Guardar MVP y resultado
          </button>
          {/* Ya no existe "guardar sin MVP": el resultado NO se guarda hasta
              elegir el MVP. Este botón solo vuelve a la planilla para revisar
              los jugadores y recordar quién fue. */}
          <button onClick={onSaltear} style={{ padding: '11px', background: 'none', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.82rem', fontWeight: '600' }}>
            ← Volver a ver la planilla
          </button>
          <div style={{ fontSize: '.68rem', color: '#9aa0a6', textAlign: 'center' }}>El resultado no se guarda hasta que elijas el MVP</div>
        </div>
      </div>
    </div>
  )
}

function ModalSeleccionArquero({ nombreEquipo, jugadores, onSeleccionar }) {
  const disponibles = jugadores.filter(j => j.numero !== '' && j.numero !== null && j.numero !== undefined)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🧤</div>
          <div style={{ fontWeight: '800', color: '#202124', fontSize: '1.05rem' }}>Arquero obligatorio</div>
          <div style={{ fontSize: '.82rem', color: '#5f6368', marginTop: '4px', fontWeight: '600' }}>{nombreEquipo}</div>
          <div style={{ fontSize: '.72rem', color: '#d93025', marginTop: '8px', fontWeight: '600' }}>Selecciona quién arranca en el arco. No se puede anotar nada de este equipo sin esto.</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e8eaed', borderRadius: '10px' }}>
          {disponibles.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '.8rem', color: '#9aa0a6' }}>Primero asigna los números de camiseta para poder elegir el arquero.</div>
          ) : disponibles.map(j => (
            <div key={j.id || j.numero} onClick={() => onSeleccionar(j)}
              style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f3f4' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <span style={{ fontWeight: '800', color: '#111', minWidth: '32px', background: '#e8f0fe', borderRadius: '6px', textAlign: 'center', padding: '4px 6px', fontSize: '.9rem' }}>#{j.numero}</span>
              <span style={{ fontSize: '.9rem', color: '#202124', fontWeight: '600' }}>{j.nombre || 'Sin nombre'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ModalEspecial({ tipo, partido, onConfirmar, onCancelar }) {
  const esW = tipo === 'w'
  const [equipoGana, setEquipoGana] = useState('')
  function handleConfirmar() {
    if (esW && !equipoGana) return
    onConfirmar({ tipo, equipoGana: esW ? equipoGana : null })
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{esW ? '🏆' : '❌'}</div>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.1rem' }}>{esW ? 'Partido por W' : 'Partido Desierto'}</div>
          <div style={{ fontSize: '.82rem', color: '#5f6368', marginTop: '8px', lineHeight: 1.5 }}>
            {esW ? 'Un equipo no se presentó. El equipo que SÍ asistió gana 3 a 0.' : 'Ninguno de los dos equipos se presentó. El partido queda anulado.'}
          </div>
        </div>
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '.78rem', color: '#795548', fontWeight: '700', marginBottom: '4px' }}>⚠️ Predicciones</div>
          <div style={{ fontSize: '.75rem', color: '#795548' }}>Este partido <b>no contará</b> para las predicciones.</div>
        </div>
        {esW && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '.78rem', fontWeight: '600', color: '#5f6368', display: 'block', marginBottom: '8px' }}>¿Qué equipo SÍ se presentó?</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEquipoGana('local')} style={{ flex: 1, padding: '10px', border: `2px solid ${equipoGana === 'local' ? '#1e8e3e' : '#dadce0'}`, borderRadius: '8px', cursor: 'pointer', background: equipoGana === 'local' ? '#e6f4ea' : '#fff', color: equipoGana === 'local' ? '#1e8e3e' : '#5f6368', fontWeight: equipoGana === 'local' ? '700' : '400', fontSize: '.82rem' }}>{partido.home?.name}</button>
              <button onClick={() => setEquipoGana('visitante')} style={{ flex: 1, padding: '10px', border: `2px solid ${equipoGana === 'visitante' ? '#1e8e3e' : '#dadce0'}`, borderRadius: '8px', cursor: 'pointer', background: equipoGana === 'visitante' ? '#e6f4ea' : '#fff', color: equipoGana === 'visitante' ? '#1e8e3e' : '#5f6368', fontWeight: equipoGana === 'visitante' ? '700' : '400', fontSize: '.82rem' }}>{partido.away?.name}</button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleConfirmar} disabled={esW && !equipoGana}
            style={{ flex: 1, padding: '11px', background: esW && !equipoGana ? '#dadce0' : esW ? '#1e8e3e' : '#d93025', border: 'none', borderRadius: '10px', cursor: esW && !equipoGana ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem' }}>
            Confirmar
          </button>
          <button onClick={onCancelar} style={{ padding: '11px 16px', background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function PlanillaPartido({ partido, onClose, onGuardarResultado }) {
  const [loading,            setLoading]            = useState(true)
  const [arbitrosTorneo,     setArbitrosTorneo]     = useState([])
  const [arbitroInput1,      setArbitroInput1]      = useState('')
  const [arbitroInput2,      setArbitroInput2]      = useState('')
  const [showSuggest1,       setShowSuggest1]       = useState(false)
  const [showSuggest2,       setShowSuggest2]       = useState(false)
  const [jugadoresLocal,     setJugadoresLocal]     = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])
  const [torneo,             setTorneo]             = useState(null)
  const [guardandoDB,        setGuardandoDB]        = useState(false)
  const [isOnline,           setIsOnline]           = useState(navigator.onLine)
  const [hayDatosLocales,    setHayDatosLocales]    = useState(false)
  const [arbitrosReg,        setArbitrosReg]        = useState([])
  const [hayCambios,         setHayCambios]         = useState(false)
  const [showMVP,            setShowMVP]            = useState(false)
  const [mvpId,              setMvpId]              = useState('')
  const [showEspecial,       setShowEspecial]       = useState(null)
  const [logEdicion,         setLogEdicion]         = useState([]) // historial de ediciones después de cerrada

  const [hubopenales,      setHuboPenales]      = useState(false)
  const [penalesGanador,   setPenalesGanador]   = useState('')
  const [penalesLocal,     setPenalesLocal]     = useState('')
  const [penalesVisitante, setPenalesVisitante] = useState('')

  const [colorLocal,     setColorLocal]     = useState('#1a3a8a')
  const [colorVisitante, setColorVisitante] = useState('#d93025')
  const [periodo,          setPeriodo]          = useState(1)
  const [segundos,         setSegundos]         = useState(0)
  const [corriendo,        setCorriendo]        = useState(false)
  const [miniCrono,        setMiniCrono]        = useState(true)
  const [tiempoAgotado,    setTiempoAgotado]    = useState(false)
  const [tiempoExtra,      setTiempoExtra]      = useState(0)
  const [duracionMinutos,  setDuracionMinutos]  = useState(20)
  const [editandoDuracion, setEditandoDuracion] = useState(false)
  const [duracionInput,    setDuracionInput]    = useState('20')

  const timerRef  = useRef(null)
  const syncTimerRef = useRef(null) // debounce de la sincronización con el servidor
  const inicioEpochRef = useRef(null) // ancla de hora real: si el celular se bloquea o el árbitro cambia de app y el navegador frena el setInterval, al volver se recalcula el tiempo real transcurrido en vez de quedar atrasado
  const [cronoPos, setCronoPos] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 320 : 200, y: 20 })
  const dragStart = useRef(null)

  const [golesLocal,      setGolesLocal]      = useState(Array(24).fill(null))
  const [golesVisitante,  setGolesVisitante]  = useState(Array(24).fill(null))
  const [faltasAcumLocal, setFaltasAcumLocal] = useState({ p1: Array(5).fill(null), p2: Array(5).fill(null) })
  const [faltasAcumVis,   setFaltasAcumVis]   = useState({ p1: Array(5).fill(null), p2: Array(5).fill(null) })
  const [dropdownOpen,    setDropdownOpen]    = useState(null)
  const [tiroInicial,     setTiroInicial]     = useState(null)

  const [finalistasLocal, setFinalistasLocal] = useState(Array(5).fill(''))
  const [finalistasVis,   setFinalistasVis]   = useState(Array(5).fill(''))
  const [ingresosLocal,   setIngresosLocal]   = useState(Array(7).fill(''))
  const [ingresosVis,     setIngresosVis]     = useState(Array(7).fill(''))

  const [firmaModal, setFirmaModal] = useState(null)
  const [firmas,     setFirmas]     = useState({ capitanLocal: null, capitanVisitante: null, arbitro1: null, arbitro2: null, anotador: null })
  const [capitanes,  setCapitanes]  = useState({ local: '', visitante: '' }) // N° de camiseta del capitán
  // Alarma de fin de tiempo: pita y vibra SIN PARAR hasta que le den "Parar"
  const [alarmaActiva, setAlarmaActiva] = useState(false)
  const alarmaRef = useRef(null)
  // true si el partido YA tenía estadísticas guardadas cuando se abrió esta
  // planilla (o sea, esto es una edición, no el primer guardado) — se usa
  // para no descontar dos veces el contador de sanciones automáticas.
  const yaJugadoRef = useRef(false)
  // Aviso al tocar casillas del 1er tiempo estando en el 2do
  const [avisoPeriodo, setAvisoPeriodo] = useState(false)
  // Informe del partido (obligatorio con roja o partido terminado antes de tiempo)
  const [showInforme,      setShowInforme]      = useState(null) // { motivo, continuar:'mvp'|null, continuarEspecial:info|null }
  const [informeTipo,      setInformeTipo]      = useState('')
  const [informeTexto,     setInformeTexto]     = useState('')
  const [informeGuardado,  setInformeGuardado]  = useState(false)
  const [guardandoInforme, setGuardandoInforme] = useState(false)
  const [dictando,         setDictando]         = useState(false)
  const recVozRef = useRef(null)
  // Modo árbitro solo: interfaz simplificada de celular (botones grandes para
  // gol/tarjetas/faltas) para cuando NO hay planillador. Usa los mismos datos
  // y reglas que la planilla completa.
  const [modoRapido, setModoRapido] = useState(false)
  const [avisoFirmas,    setAvisoFirmas]    = useState(null) // árbitros que faltan por firmar
  const [avisoAcumulado, setAvisoAcumulado] = useState(null) // jugador que completó sus faltas

  const CUERPO_ROLES = ['TECNICO', 'A. TECNICO', 'MASAJISTA', 'MEDICO', 'P. FISICO']
  const [cuerpoLocal, setCuerpoLocal] = useState(CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
  const [cuerpoVis,   setCuerpoVis]   = useState(CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))

  const [arbitro1,         setArbitro1]         = useState('')
  const [arbitro2,         setArbitro2]         = useState('')
  const [arbitro3,         setArbitro3]         = useState('')
  // Arqueros del partido (obligatorio)
  const [arqueroLocal,     setArqueroLocal]     = useState(null) // { id, numero, name }
  const [arqueroVis,       setArqueroVis]       = useState(null)
  const [histArquerosLocal,setHistArquerosLocal]= useState([])   // [{id,numero,name,orden}]
  const [histArquerosVis,  setHistArquerosVis]  = useState([])
  const [avisoArqueroFaltante, setAvisoArqueroFaltante] = useState(null) // nombre del equipo sin arquero al intentar anotar
  const arqueroSalienteRef = useRef({ local: null, visitante: null })
  const [anotador,         setAnotador]         = useState('')
  const [cronometroNombre, setCronometroNombre] = useState('')
  const [observaciones,    setObservaciones]    = useState('')
  const [horaInicio1,      setHoraInicio1]      = useState('')
  const [horaFin1,         setHoraFin1]         = useState('')
  const [horaInicio2,      setHoraInicio2]      = useState('')
  const [horaFin2,         setHoraFin2]         = useState('')

  const localKey     = `planilla_${partido.id}`
  const cacheJugsKey = `planilla_jugs_${partido.tournament_id}_${partido.id}`
  const arbitrosKey  = `arbitros_torneo_${partido.tournament_id}`
  const limiteSegundos = duracionMinutos * 60 + tiempoExtra * 60

  // Snapshot completo de la planilla (datos + cronómetro) para poder
  // continuar exactamente igual desde OTRO celular si el que la estaba
  // llenando se daña/apaga. snapshotAt permite recalcular cuántos segundos
  // han pasado realmente si el cronómetro seguía corriendo.
  function construirSnap() {
    return {
      jugadoresLocal, jugadoresVisitante, golesLocal, golesVisitante, faltasAcumLocal, faltasAcumVis,
      finalistasLocal, finalistasVis, ingresosLocal, ingresosVis, cuerpoLocal, cuerpoVis,
      arbitro1, arbitro2, arbitro3, anotador, cronometroNombre, observaciones,
      horaInicio1, horaFin1, horaInicio2, horaFin2, tiroInicial, colorLocal, colorVisitante,
      duracionMinutos, mvpId, huboPenales: hubopenales, penalesGanador, penalesLocal, penalesVisitante,
      periodo, segundos, corriendo, tiempoAgotado, tiempoExtra,
      arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis,
      firmas, capitanes, informeTexto, informeTipo, informeGuardado, modoRapido,
      savedAt: new Date().toISOString(), pendienteSync: true,
    }
  }

  // Sube el snapshot a Supabase (matches.live_state) para que cualquier otro
  // celular asignado a este partido pueda retomarlo tal cual. No bloquea la
  // interfaz ni rompe nada si falla (ej. sin internet): es solo un respaldo.
  function sincronizarRemoto(snap, { inmediato = false } = {}) {
    clearTimeout(syncTimerRef.current)
    const subir = () => {
      supabase.from('matches').update({ live_state: snap, live_state_updated_at: snap.savedAt }).eq('id', partido.id).then(() => {}, () => {})
    }
    if (inmediato) subir()
    else syncTimerRef.current = setTimeout(subir, 1500)
  }

  // Aplica un snapshot (local o del servidor) al estado de la planilla. Si el
  // cronómetro seguía corriendo, se le suma el tiempo real transcurrido desde
  // que se guardó, para que al retomar desde otro celular el reloj muestre lo
  // que realmente debería marcar en este momento, no lo último que se guardó.
  function aplicarSnap(snap, defaultDur) {
    setJugadoresLocal(conRellenoA12(snap.jugadoresLocal)); setJugadoresVisitante(conRellenoA12(snap.jugadoresVisitante))
    setGolesLocal(snap.golesLocal || Array(24).fill(null)); setGolesVisitante(snap.golesVisitante || Array(24).fill(null))
    setFaltasAcumLocal(snap.faltasAcumLocal || { p1: Array(5).fill(null), p2: Array(5).fill(null) })
    setFaltasAcumVis(snap.faltasAcumVis || { p1: Array(5).fill(null), p2: Array(5).fill(null) })
    setFinalistasLocal(snap.finalistasLocal || Array(5).fill('')); setFinalistasVis(snap.finalistasVis || Array(5).fill(''))
    setIngresosLocal(snap.ingresosLocal || Array(7).fill('')); setIngresosVis(snap.ingresosVis || Array(7).fill(''))
    setCuerpoLocal(snap.cuerpoLocal || CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
    setCuerpoVis(snap.cuerpoVis || CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
    setArbitro1(snap.arbitro1 || ''); setArbitroInput1(snap.arbitro1 || '')
    setArbitro2(snap.arbitro2 || ''); setArbitroInput2(snap.arbitro2 || '')
    if (snap.arbitro3) setArbitro3(snap.arbitro3)
    // Firmas y capitanes: se restauran para que no se pierdan al reabrir
    if (snap.firmas) setFirmas(prev => ({ ...prev, ...snap.firmas }))
    if (snap.capitanes) setCapitanes(snap.capitanes)
    if (snap.informeTexto) setInformeTexto(snap.informeTexto)
    if (snap.informeTipo) setInformeTipo(snap.informeTipo)
    if (snap.informeGuardado) setInformeGuardado(true)
    if (snap.modoRapido) setModoRapido(true)
    setAnotador(snap.anotador || ''); setCronometroNombre(snap.cronometroNombre || ''); setObservaciones(snap.observaciones || '')
    setHoraInicio1(snap.horaInicio1 || ''); setHoraFin1(snap.horaFin1 || ''); setHoraInicio2(snap.horaInicio2 || ''); setHoraFin2(snap.horaFin2 || '')
    setTiroInicial(snap.tiroInicial || null); setColorLocal(snap.colorLocal || '#1a3a8a'); setColorVisitante(snap.colorVisitante || '#d93025')
    if (snap.mvpId) setMvpId(snap.mvpId)
    // Arqueros ya marcados: se restauran para no volver a pedirlos.
    // (snapshots viejos no traen estos campos — en ese caso no se toca nada)
    if (snap.arqueroLocal) setArqueroLocal(snap.arqueroLocal)
    if (snap.arqueroVis)   setArqueroVis(snap.arqueroVis)
    if (snap.histArquerosLocal?.length) setHistArquerosLocal(snap.histArquerosLocal)
    if (snap.histArquerosVis?.length)   setHistArquerosVis(snap.histArquerosVis)
    if (snap.huboPenales) setHuboPenales(snap.huboPenales); if (snap.penalesGanador) setPenalesGanador(snap.penalesGanador)
    if (snap.penalesLocal) setPenalesLocal(snap.penalesLocal); if (snap.penalesVisitante) setPenalesVisitante(snap.penalesVisitante)
    const dur = snap.duracionMinutos || defaultDur
    setDuracionMinutos(dur); setDuracionInput(String(dur))

    if (snap.periodo) setPeriodo(snap.periodo)
    const extra = typeof snap.tiempoExtra === 'number' ? snap.tiempoExtra : 0
    setTiempoExtra(extra)
    let segs = typeof snap.segundos === 'number' ? snap.segundos : 0
    if (snap.corriendo && snap.savedAt) {
      const transcurrido = Math.floor((Date.now() - new Date(snap.savedAt).getTime()) / 1000)
      if (transcurrido > 0) segs += transcurrido
    }
    const limite = dur * 60 + extra * 60
    if (segs >= limite) { segs = limite; setCorriendo(false); setTiempoAgotado(true) }
    else { setCorriendo(!!snap.corriendo); if (snap.tiempoAgotado) setTiempoAgotado(true) }
    setSegundos(segs)

    setHayDatosLocales(true)
  }

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Marca en localStorage qué partido está abierto, para poder reabrir esta
  // misma planilla automáticamente si el navegador recarga la página o mata
  // la pestaña (ej. al pasar a WhatsApp y volver). Se borra al cerrar normal.
  useEffect(() => {
    try { localStorage.setItem(PLANILLA_ABIERTA_KEY, JSON.stringify({ id: partido.id })) } catch(e) {}
    return () => { try { localStorage.removeItem(PLANILLA_ABIERTA_KEY) } catch(e) {} }
  }, [partido.id])

  // Bloquear el zoom (pinch/gotas de lluvia) mientras la planilla está abierta.
  // Se restaura el viewport original al cerrar para no afectar al resto de la web.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const original = meta ? meta.getAttribute('content') : null
    if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    return () => { if (meta) meta.setAttribute('content', original || 'width=device-width, initial-scale=1.0') }
  }, [])

  // Pantalla completa real: oculta la barra de direcciones/menú del navegador en
  // celular mientras la planilla está abierta. Si el navegador no lo soporta (ej.
  // iOS Safari) simplemente no pasa nada — el fondo blanco de borde a borde ya
  // tapa el resto de la página igual.
  useEffect(() => {
    try { document.documentElement.requestFullscreen?.().catch(() => {}) } catch (e) {}
    return () => { try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) } catch (e) {} }
  }, [])

  // Si el cronómetro se pausa por cualquier vía (botón pausa, reset, cambio de
  // periodo, tiempo agotado, etc.) se limpia el ancla de hora real para que al
  // reanudar se recalcule desde el segundo actual, no desde un punto viejo.
  useEffect(() => { if (!corriendo) inicioEpochRef.current = null }, [corriendo])

  // El cronómetro se ancla a la hora real (Date.now), no a "ir sumando 1 cada
  // segundo": así, si el celular se bloquea o el árbitro cambia de app y el
  // navegador frena el setInterval, al volver (visibilitychange/focus) se
  // recalcula el tiempo real transcurrido en vez de quedar atrasado o parado.
  useEffect(() => {
    if (!corriendo) return
    if (inicioEpochRef.current == null) inicioEpochRef.current = Date.now() - segundos * 1000

    function recalcular() {
      const elapsed = Math.floor((Date.now() - inicioEpochRef.current) / 1000)
      const next = elapsed >= limiteSegundos ? limiteSegundos : elapsed
      setSegundos(next)
      if (next >= limiteSegundos && !tiempoAgotado) {
        setTiempoAgotado(true); setCorriendo(false)
        // Alarma insistente: pita y vibra SIN PARAR hasta que le den "Parar
        // alarma" — así nadie se pasa del tiempo sin darse cuenta.
        iniciarAlarma()
      }
      // Cada ~8s con el reloj corriendo, se guarda también en el servidor
      // para que si este celular se apaga, otro pueda retomar el cronómetro
      // calculando cuánto tiempo real pasó desde el último guardado.
      if (!loading && next % 8 === 0) {
        const snap = construirSnap()
        try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch(e) {}
        sincronizarRemoto(snap)
      }
    }

    timerRef.current = setInterval(recalcular, 1000)
    document.addEventListener('visibilitychange', recalcular)
    window.addEventListener('focus', recalcular)
    window.addEventListener('pageshow', recalcular)
    return () => {
      clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', recalcular)
      window.removeEventListener('focus', recalcular)
      window.removeEventListener('pageshow', recalcular)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo, limiteSegundos, tiempoAgotado])

  // Al arrancar o pausar el cronómetro, guardar de inmediato (sin esperar el
  // debounce) para que el estado corriendo/pausado quede reflejado ya mismo.
  useEffect(() => {
    if (loading) return
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch(e) {}
    sincronizarRemoto(snap, { inmediato: true })
  }, [corriendo])

  useEffect(() => {
    if (loading) return
    setHayCambios(true)
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch(e) {}
    sincronizarRemoto(snap)
  }, [jugadoresLocal, jugadoresVisitante, golesLocal, golesVisitante, faltasAcumLocal, faltasAcumVis, finalistasLocal, finalistasVis, ingresosLocal, ingresosVis, cuerpoLocal, cuerpoVis, arbitro1, arbitro2, anotador, cronometroNombre, observaciones, horaInicio1, horaFin1, horaInicio2, horaFin2, tiroInicial, colorLocal, colorVisitante, duracionMinutos, mvpId, hubopenales, penalesGanador, penalesLocal, penalesVisitante, periodo, tiempoExtra, arqueroLocal, arqueroVis, histArquerosLocal, histArquerosVis, firmas, capitanes, informeTexto, informeTipo, informeGuardado, modoRapido])

  useEffect(() => { fetchTodo() }, [])
  useEffect(() => {
    const close = () => setDropdownOpen(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    try { const stored = localStorage.getItem(arbitrosKey); if (stored) setArbitrosTorneo(JSON.parse(stored)) } catch(e) {}
    // Cargar árbitros registrados en BD y arqueros
    ;(async () => {
      const { data } = await supabase.from('players').select('id,name,photo_face_url,photo_url').or('rol.eq.arbitro,es_arbitro.eq.true').order('name')
      setArbitrosReg(data || [])
      // Precargar arqueros si ya fueron guardados
      const { data: arqData } = await supabase.from('partido_arqueros').select('*').eq('match_id', partido.id).order('orden')
      if (arqData && arqData.length > 0) {
        const arqLocales = arqData.filter(a => a.team_id === partido.home_team_id)
        const arqVises   = arqData.filter(a => a.team_id === partido.away_team_id)
        // prev || ...: si el snapshot de autoguardado ya restauró un arquero
        // (más reciente), no se pisa con lo que haya guardado en la BD.
        // Los arqueros SIN registro se restauran con su nombre y número.
        const mapArq = a => a.player_id
          ? { id: a.player_id, orden: a.orden }
          : { id: undefined, name: a.player_nombre || '', numero: a.numero || '', orden: a.orden }
        if (arqLocales.length > 0) {
          const ultimo = arqLocales[arqLocales.length-1]
          setArqueroLocal(prev => prev || mapArq(ultimo))
          setHistArquerosLocal(prev => prev.length > 0 ? prev : arqLocales.map(mapArq))
        }
        if (arqVises.length > 0) {
          const ultimo = arqVises[arqVises.length-1]
          setArqueroVis(prev => prev || mapArq(ultimo))
          setHistArquerosVis(prev => prev.length > 0 ? prev : arqVises.map(mapArq))
        }
      }
      // Precargar árbitros asignados al partido SIEMPRE que el campo esté
      // vacío (antes solo se hacía si no había borrador local, y los árbitros
      // asignados por la coordinadora no salían automáticamente). prev || ...:
      // si la planilla ya tiene un nombre puesto, no se pisa.
      if (partido.arbitro1_id) { const a = (data||[]).find(x=>x.id===partido.arbitro1_id); if(a) { setArbitro1(prev => prev || a.name); setArbitroInput1(prev => prev || a.name) } }
      if (partido.arbitro2_id) { const a = (data||[]).find(x=>x.id===partido.arbitro2_id); if(a) { setArbitro2(prev => prev || a.name); setArbitroInput2(prev => prev || a.name) } }
      if (partido.arbitro3_id) { const a = (data||[]).find(x=>x.id===partido.arbitro3_id); if(a) setArbitro3(prev => prev || a.name) }
    })()
  }, [])

  function getDefaultDuracion(modalidad) {
    if (modalidad === 'Fútbol 5') return 20
    if (modalidad === 'Fútbol 7') return 25
    if (modalidad === 'Fútbol 11') return 45
    return 20
  }

  function guardarArbitroLocal(nombre) {
    if (!nombre.trim()) return
    try {
      const stored = localStorage.getItem(arbitrosKey)
      const lista  = stored ? JSON.parse(stored) : []
      if (!lista.includes(nombre.trim())) {
        const nueva = [...lista, nombre.trim()].slice(-20)
        localStorage.setItem(arbitrosKey, JSON.stringify(nueva))
        setArbitrosTorneo(nueva)
      }
    } catch(e) {}
  }

  async function fetchTodo() {
    // Restauro INSTANTÁNEO desde el borrador de este celular, sin esperar la
    // red — para que abrir la planilla sea inmediato (el árbitro solo tiene el
    // celular en la mano unos segundos). El snapshot guardado ya trae todo lo
    // necesario (jugadores, goles, cronómetro, etc.), así que se puede mostrar
    // de una. La sincronización con la base de datos (jugadores nuevos,
    // eventos guardados desde otro celular, etc.) sigue pasando exactamente
    // igual que antes, solo que ahora en 2do plano sin bloquear la pantalla.
    let localSnapInstant = null
    try {
      const local = localStorage.getItem(localKey)
      localSnapInstant = local ? JSON.parse(local) : null
    } catch (e) {}
    if (localSnapInstant && localSnapInstant.pendienteSync) {
      aplicarSnap(localSnapInstant, 20)
      setLoading(false)
    } else {
      setLoading(true)
    }

    if (!navigator.onLine) {
      try {
        const snap = localStorage.getItem(localKey)
        const cache = localStorage.getItem(cacheJugsKey)
        if (snap) {
          aplicarSnap(JSON.parse(snap), 20)
        } else if (cache) {
          const c = JSON.parse(cache)
          setJugadoresLocal(conRellenoA12(c.jugadoresLocal)); setJugadoresVisitante(conRellenoA12(c.jugadoresVisitante))
          setTorneo(c.torneo || null)
          const dur = c.duracion || 20; setDuracionMinutos(dur); setDuracionInput(String(dur))
        }
      } catch(e) {}
      setLoading(false); return
    }

    const [jugsL, jugsV, torn, eventos, statsDB, logrosDB, liveDB, editLogDB, sancionesDB, tarjetasDB] = await Promise.all([
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true),
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true),
      supabase.from('tournaments').select('*').eq('id', partido.tournament_id).single(),
      supabase.from('match_events').select('*').eq('match_id', partido.id).order('created_at', { ascending: true }),
      supabase.from('player_match_stats').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('match_id', partido.id),
      supabase.from('tournament_logros').select('*').eq('match_id', partido.id).eq('tipo', 'mvp').maybeSingle(),
      // Snapshot que haya dejado guardado OTRO celular (árbitro/admin) llenando esta misma planilla
      supabase.from('matches').select('live_state, live_state_updated_at, firmas, capitan_local, capitan_visitante').eq('id', partido.id).maybeSingle(),
      // Historial de ediciones hechas DESPUÉS de que la planilla ya estaba cerrada
      supabase.from('match_edit_log').select('*').eq('match_id', partido.id).order('edited_at', { ascending: false }),
      // Jugadores sancionados: no se les deja aparecer en la planilla de este torneo
      supabase.from('sanciones').select('player_id, fecha_fin, partidos_pendientes').eq('activa', true).or(`tournament_id.eq.${partido.tournament_id},tournament_id.is.null`),
      // Tarjetas sin pagar (de este torneo): para avisarle al árbitro en la planilla
      supabase.from('player_match_stats').select('player_id, yellow_cards, yellow_paid, blue_cards, blue_paid, red_cards, red_paid').eq('tournament_id', partido.tournament_id),
    ])
    setLogEdicion(editLogDB?.data || [])

    // Filtrar jugadores sancionados (sanción de este torneo, o global) — no
    // pueden salir como opción en la planilla mientras dure la sanción.
    // (Si tiene partidos_pendientes en 0, ya cumplió la sanción automática.)
    const hoyIso = new Date().toISOString()
    const idsSancionados = new Set((sancionesDB?.data || [])
      .filter(s => (!s.fecha_fin || s.fecha_fin > hoyIso) && (s.partidos_pendientes === null || s.partidos_pendientes === undefined || s.partidos_pendientes > 0))
      .map(s => s.player_id))
    if (idsSancionados.size > 0) {
      if (jugsL.data) jugsL.data = jugsL.data.filter(r => !idsSancionados.has(r.players?.id))
      if (jugsV.data) jugsV.data = jugsV.data.filter(r => !idsSancionados.has(r.players?.id))
    }

    // Jugadores que deben alguna tarjeta de este torneo (solo si el torneo
    // cobra por tarjetas) — se les muestra un aviso chiquito en la planilla.
    const fcTorneoDeuda = torn.data?.finanzas_config || {}
    const cobraTarjetas = (fcTorneoDeuda.precio_amarilla || 0) + (fcTorneoDeuda.precio_azul || 0) + (fcTorneoDeuda.precio_roja || 0) > 0
    const idsDebenTarjeta = new Set()
    if (cobraTarjetas) {
      (tarjetasDB?.data || []).forEach(s => {
        if ((s.yellow_cards > 0 && !s.yellow_paid) || (s.blue_cards > 0 && !s.blue_paid) || (s.red_cards > 0 && !s.red_paid)) idsDebenTarjeta.add(s.player_id)
      })
    }

    // Firmas y capitanes guardados en la BD (de un guardado anterior). Se
    // aplican primero: si el borrador (snapshot) trae unos más recientes,
    // los pisará más abajo al restaurarse.
    if (liveDB?.data?.firmas) setFirmas(prev => ({ ...prev, ...liveDB.data.firmas }))
    if (liveDB?.data?.capitan_local || liveDB?.data?.capitan_visitante) {
      setCapitanes(prev => ({ local: prev.local || liveDB.data.capitan_local || '', visitante: prev.visitante || liveDB.data.capitan_visitante || '' }))
    }

    const evs = eventos.data || [], stats = statsDB.data || [], yaJugado = stats.length > 0, torneoData = torn.data
    yaJugadoRef.current = yaJugado
    if (logrosDB.data?.player_id) setMvpId(logrosDB.data.player_id)

    const mapJug = (data) => (data || []).map(r => ({ id: r.players?.id, nombre: r.players?.name || '', cedula: r.players?.numero_cedula || '', numero: '', faltasPeriodo: [], amarilla: false, azul: false, roja: false, posicion_futbol5: r.players?.posicion_futbol5 || '', posicion_futbol7: r.players?.posicion_futbol7 || '', posicion_futbol11: r.players?.posicion_futbol11 || '', debeTarjeta: idsDebenTarjeta.has(r.players?.id) }))

    let jugsLocalBase, jugsVisBase
    if (yaJugado) {
      const sL = stats.filter(s => s.team_id === partido.home_team_id)
      const sV = stats.filter(s => s.team_id === partido.away_team_id)
      jugsLocalBase = sL.map(s => ({ id: s.player_id, nombre: s.players?.name || '', cedula: s.players?.numero_cedula || '', numero: s.numero_camiseta || '', faltasPeriodo: [], amarilla: s.yellow_cards > 0, azul: s.blue_cards > 0, roja: s.red_cards > 0, posicion_futbol5: s.players?.posicion_futbol5 || '', posicion_futbol7: s.players?.posicion_futbol7 || '', posicion_futbol11: s.players?.posicion_futbol11 || '', debeTarjeta: idsDebenTarjeta.has(s.player_id) }))
      jugsVisBase   = sV.map(s => ({ id: s.player_id, nombre: s.players?.name || '', cedula: s.players?.numero_cedula || '', numero: s.numero_camiseta || '', faltasPeriodo: [], amarilla: s.yellow_cards > 0, azul: s.blue_cards > 0, roja: s.red_cards > 0, posicion_futbol5: s.players?.posicion_futbol5 || '', posicion_futbol7: s.players?.posicion_futbol7 || '', posicion_futbol11: s.players?.posicion_futbol11 || '', debeTarjeta: idsDebenTarjeta.has(s.player_id) }))
    } else { jugsLocalBase = mapJug(jugsL.data); jugsVisBase = mapJug(jugsV.data) }

    const golesLocRec = Array(24).fill(null), golesVisRec = Array(24).fill(null)
    let slotL = 0, slotV = 0
    evs.filter(e => e.event_type === 'goal').forEach(e => {
      const esLocal = e.team_id === partido.home_team_id
      const jugs = esLocal ? jugsLocalBase : jugsVisBase
      const jugador = jugs.find(j => j.id === e.player_id)
      const gol = { numero: jugador?.numero || 0, minuto: e.minute || '', periodo: e.periodo || 1 }
      if (esLocal && slotL < 24) { golesLocRec[slotL] = gol; slotL++ }
      else if (!esLocal && slotV < 24) { golesVisRec[slotV] = gol; slotV++ }
    })

    const fAL = { p1: Array(5).fill(null), p2: Array(5).fill(null) }
    const fAV = { p1: Array(5).fill(null), p2: Array(5).fill(null) }
    evs.filter(e => e.event_type === 'falta_acum').forEach(e => {
      const esLocal = e.team_id === partido.home_team_id
      const jugs = esLocal ? jugsLocalBase : jugsVisBase
      const jugador = jugs.find(j => j.id === e.player_id)
      if (!jugador) return
      const fa = esLocal ? fAL : fAV, key = `p${e.periodo || 1}`, slot = fa[key].indexOf(null)
      if (slot >= 0) fa[key][slot] = jugador.numero
    })

    if (yaJugado) {
      const applyTarjetas = (jugs, statsArr) => jugs.map(j => { const s = statsArr.find(st => st.player_id === j.id); if (!s) return j; return { ...j, amarilla: s.yellow_cards > 0, azul: s.blue_cards > 0, roja: s.red_cards > 0, faltasPeriodo: Array(s.fouls || 0).fill(1) } })
      jugsLocalBase = applyTarjetas(jugsLocalBase, stats.filter(s => s.team_id === partido.home_team_id))
      jugsVisBase   = applyTarjetas(jugsVisBase,   stats.filter(s => s.team_id === partido.away_team_id))

      // Jugadores SIN registro con tarjetas: reconstruirlos desde los eventos.
      // No tienen fila de estadísticas, así que al reabrir la planilla cerrada
      // desaparecían — y al volver a guardar, sus tarjetas se borraban de la
      // base de datos (el guardado reinserta los eventos desde lo visible).
      evs.filter(e => !e.player_id && e.player_nombre && ['yellow_card', 'blue_card', 'red_card'].includes(e.event_type)).forEach(e => {
        const lista = e.team_id === partido.home_team_id ? jugsLocalBase : e.team_id === partido.away_team_id ? jugsVisBase : null
        if (!lista) return
        let j = lista.find(x => !x.id && (x.nombre || '').trim() === e.player_nombre)
        if (!j) {
          j = { id: undefined, nombre: e.player_nombre, cedula: '', numero: '', faltasPeriodo: [], amarilla: false, azul: false, roja: false }
          lista.push(j)
        }
        if (e.event_type === 'yellow_card') j.amarilla = true
        if (e.event_type === 'blue_card')   j.azul = true
        if (e.event_type === 'red_card')    j.roja = true
      })

      // Restaurar el TIEMPO de cada tarjeta (guardado en el evento): antes al
      // reabrir la planilla solo quedaba un chulo ✓ en vez del minuto.
      const aplicarMinutos = (jugs, team_id) => jugs.map(j => {
        const propios = evs.filter(e => e.team_id === team_id
          && ['yellow_card', 'blue_card', 'red_card'].includes(e.event_type)
          && (j.id ? e.player_id === j.id : (!e.player_id && (e.player_nombre || '') === (j.nombre || '').trim())))
        if (propios.length === 0) return j
        const minuto = t => propios.find(e => e.event_type === t)?.minute
        return { ...j,
          amarilla: j.amarilla ? (minuto('yellow_card') || j.amarilla) : j.amarilla,
          azul:     j.azul     ? (minuto('blue_card')   || j.azul)     : j.azul,
          roja:     j.roja     ? (minuto('red_card')    || j.roja)     : j.roja,
        }
      })
      jugsLocalBase = aplicarMinutos(jugsLocalBase, partido.home_team_id)
      jugsVisBase   = aplicarMinutos(jugsVisBase,   partido.away_team_id)
    }
    jugsLocalBase = conRellenoA12(jugsLocalBase)
    jugsVisBase   = conRellenoA12(jugsVisBase)

    // Elegir el snapshot más reciente entre el de ESTE celular (localStorage)
    // y el que haya dejado guardado OTRO celular en el servidor (matches.live_state).
    // Así, si el celular que llenaba la planilla se dañó, cualquier otro árbitro
    // asignado o el admin puede entrar y sigue exactamente donde iba.
    let restaurado = false
    try {
      const local = localStorage.getItem(localKey)
      const localSnap  = local ? JSON.parse(local) : null
      const remoteSnap = liveDB?.data?.live_state || null
      const localTime  = localSnap?.pendienteSync ? new Date(localSnap.savedAt || 0).getTime() : -1
      const remoteTime = remoteSnap ? new Date(liveDB.data.live_state_updated_at || remoteSnap.savedAt || 0).getTime() : -1
      if (localTime >= 0 || remoteTime >= 0) {
        const ganador = remoteTime > localTime ? remoteSnap : localSnap
        aplicarSnap(ganador, getDefaultDuracion(torneoData?.modalidad))
        // Si el snapshot que ganó vino del servidor, lo guardamos también aquí
        // para que este celular quede sincronizado desde ya.
        if (ganador === remoteSnap) { try { localStorage.setItem(localKey, JSON.stringify(remoteSnap)) } catch(e) {} }
        restaurado = true
      }
    } catch(e) {}

    if (!restaurado) {
      setJugadoresLocal(jugsLocalBase); setJugadoresVisitante(jugsVisBase)
      setGolesLocal(yaJugado ? golesLocRec : Array(24).fill(null))
      setGolesVisitante(yaJugado ? golesVisRec : Array(24).fill(null))
      if (yaJugado) { setFaltasAcumLocal(fAL); setFaltasAcumVis(fAV) }
      const dur = getDefaultDuracion(torneoData?.modalidad); setDuracionMinutos(dur); setDuracionInput(String(dur))
    }

    setTorneo(torneoData)
    try { localStorage.setItem(cacheJugsKey, JSON.stringify({ jugadoresLocal: jugsLocalBase, jugadoresVisitante: jugsVisBase, torneo: torneoData, duracion: getDefaultDuracion(torneoData?.modalidad), savedAt: new Date().toISOString() })) } catch(e) {}
    setLoading(false)
  }

  // ── GUARDAR EN DB ─────────────────────────────────────────────────────────
  // esEspecial: { tipo: 'w'|'desierto', equipoGana: 'local'|'visitante'|null }
  // mvpIdFinal: id del jugador MVP (viene del modal)
  async function guardarEnDB(esEspecial = null, mvpIdFinal = null) {
    setGuardandoDB(true)

    // Si el partido YA estaba cerrado (finalizado) antes de este guardado, es una
    // reedición posterior al cierre: queda registrado quién y cuándo la hizo.
    if (partido.status === 'finished') {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        let editorName = user?.email || 'Desconocido'
        if (user?.id) {
          const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle()
          if (pRow?.name) editorName = pRow.name
        }
        await supabase.from('match_edit_log').insert({
          match_id: partido.id, editor_user_id: user?.id || null,
          editor_name: editorName, editor_email: user?.email || null,
        })
      } catch (e) { console.error('No se pudo registrar la edición post-cierre:', e) }
    }

    let golesLocalTotal, golesVisTotal, tipoPartido = null
    if (esEspecial) {
      tipoPartido = esEspecial.tipo
      golesLocalTotal = esEspecial.tipo === 'w' ? (esEspecial.equipoGana === 'local' ? 3 : 0) : 0
      golesVisTotal   = esEspecial.tipo === 'w' ? (esEspecial.equipoGana === 'visitante' ? 3 : 0) : 0
    } else {
      golesLocalTotal = golesLocal.filter(Boolean).length
      golesVisTotal   = golesVisitante.filter(Boolean).length
    }

    const eventosGolLocal = golesLocal.filter(Boolean).map(g => { const jugador = jugadoresLocal.find(j => String(j.numero) === String(g.numero)); return { match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.home_team_id, player_id: jugador?.id || null, event_type: 'goal', minute: g.minuto, periodo: g.periodo } })
    const eventosGolVis   = golesVisitante.filter(Boolean).map(g => { const jugador = jugadoresVisitante.find(j => String(j.numero) === String(g.numero)); return { match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.away_team_id, player_id: jugador?.id || null, event_type: 'goal', minute: g.minuto, periodo: g.periodo } })

    const eventosTarjetas = []
    const procesarTarjetas = (jugadores, team_id) => jugadores.forEach(j => {
      if (!j.amarilla && !j.azul && !j.roja) return
      // Jugadores SIN registro también: la tarjeta queda con player_id nulo y
      // el nombre escrito en la planilla, para que las finanzas la cobren.
      if (!j.id && !(j.nombre || '').trim()) return
      const base = { match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id || null, player_nombre: j.id ? null : (j.nombre || '').trim() }
      // El minuto de la tarjeta (tiempo del cronómetro al marcarla) se guarda
      // en el evento para poder mostrarlo siempre al reabrir la planilla
      if (j.amarilla) eventosTarjetas.push({ ...base, event_type: 'yellow_card', periodo, minute: typeof j.amarilla === 'string' ? j.amarilla : null })
      if (j.azul)    eventosTarjetas.push({ ...base, event_type: 'blue_card', periodo, minute: typeof j.azul === 'string' ? j.azul : null })
      if (j.roja)    eventosTarjetas.push({ ...base, event_type: 'red_card', periodo, minute: typeof j.roja === 'string' ? j.roja : null })
    })
    procesarTarjetas(jugadoresLocal, partido.home_team_id)
    procesarTarjetas(jugadoresVisitante, partido.away_team_id)

    const eventosFaltas = []
    ;['p1','p2'].forEach(key => {
      const per = key === 'p1' ? 1 : 2
      faltasAcumLocal[key].filter(Boolean).forEach(numero => { const j = jugadoresLocal.find(jj => String(jj.numero) === String(numero)); if (j?.id) eventosFaltas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.home_team_id, player_id: j.id, event_type: 'falta_acum', periodo: per }) })
      faltasAcumVis[key].filter(Boolean).forEach(numero => { const j = jugadoresVisitante.find(jj => String(jj.numero) === String(numero)); if (j?.id) eventosFaltas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.away_team_id, player_id: j.id, event_type: 'falta_acum', periodo: per }) })
    })

    // Errores de guardado: antes se ignoraban en silencio y el árbitro creía
    // que había guardado cuando en realidad el partido nunca pasó a "jugado".
    const erroresGuardado = []

    await supabase.from('match_events').delete().eq('match_id', partido.id)
    const todosEventos = [...eventosGolLocal, ...eventosGolVis, ...eventosTarjetas, ...eventosFaltas]
    if (todosEventos.length > 0) {
      let { error: errEv } = await supabase.from('match_events').insert(todosEventos)
      if (errEv && (errEv.message || '').includes('player_nombre')) {
        // La BD aún no tiene la columna (falta migración): reintentar sin ella
        ;({ error: errEv } = await supabase.from('match_events').insert(todosEventos.map(({ player_nombre, ...e }) => e)))
      }
      if (errEv) erroresGuardado.push('Eventos: ' + errEv.message)
    }

    const updatePartido = { home_score: golesLocalTotal, away_score: golesVisTotal, status: 'finished', live_state: null, live_state_updated_at: null, firmas, capitan_local: capitanes.local || null, capitan_visitante: capitanes.visitante || null }
    // Actualizar árbitros si se cambiaron en la planilla
    const arb1Obj = arbitrosReg.find(a => a.name === arbitro1)
    const arb2Obj = arbitrosReg.find(a => a.name === arbitro2)
    const arb3Obj = arbitrosReg.find(a => a.name === arbitro3)
    if (arbitro1) { updatePartido.arbitro1 = arbitro1; if(arb1Obj) updatePartido.arbitro1_id = arb1Obj.id }
    if (arbitro2) { updatePartido.arbitro2 = arbitro2; if(arb2Obj) updatePartido.arbitro2_id = arb2Obj.id }
    if (arbitro3) { updatePartido.arbitro3 = arbitro3; if(arb3Obj) updatePartido.arbitro3_id = arb3Obj.id }
    if (tipoPartido) updatePartido.tipo_resultado = tipoPartido
    if (hubopenales) { updatePartido.penales_local = parseInt(penalesLocal) || 0; updatePartido.penales_visitante = parseInt(penalesVisitante) || 0; updatePartido.penales_ganador = penalesGanador }
    let { error: errPartido } = await supabase.from('matches').update(updatePartido).eq('id', partido.id)
    // Si la BD no tiene alguna columna opcional (falta una migración), se quita
    // esa columna y se reintenta: el RESULTADO nunca se debe quedar sin subir
    // por un dato secundario (nombres de árbitros, firmas, capitanes...).
    const columnasOpcionales = ['firmas', 'capitan_local', 'capitan_visitante', 'arbitro1', 'arbitro2', 'arbitro3']
    let reintentos = 0
    while (errPartido && reintentos < 3) {
      const msgErr = errPartido.message || ''
      const faltantes = columnasOpcionales.filter(c => msgErr.includes(`'${c}'`))
      if (faltantes.length === 0) break
      faltantes.forEach(c => delete updatePartido[c])
      ;({ error: errPartido } = await supabase.from('matches').update(updatePartido).eq('id', partido.id))
      reintentos++
    }
    if (errPartido) erroresGuardado.push('Resultado: ' + errPartido.message)

    // Guardar arqueros del partido — TAMBIÉN los sin registro (con su nombre
    // y número escritos), para que al reabrir no vuelva a pedir arquero
    await supabase.from('partido_arqueros').delete().eq('match_id', partido.id)
    const arqRows = []
    const pushArq = (a, team_id) => {
      if (a?.id) arqRows.push({ match_id: partido.id, team_id, player_id: a.id, orden: a.orden || 1 })
      else if ((a?.name || '').trim()) arqRows.push({ match_id: partido.id, team_id, player_id: null, player_nombre: a.name.trim(), numero: a.numero != null ? String(a.numero) : null, orden: a.orden || 1 })
    }
    histArquerosLocal.forEach(a => pushArq(a, partido.home_team_id))
    histArquerosVis.forEach(a =>   pushArq(a, partido.away_team_id))
    const yaEnHist = (hist, a) => hist.some(h => (h.id && h.id === a.id) || (!h.id && !a.id && (h.name || '') === (a.name || '')))
    if (arqueroLocal && !yaEnHist(histArquerosLocal, arqueroLocal)) pushArq({ ...arqueroLocal, orden: 1 }, partido.home_team_id)
    if (arqueroVis   && !yaEnHist(histArquerosVis,   arqueroVis))   pushArq({ ...arqueroVis,   orden: 1 }, partido.away_team_id)
    if (arqRows.length > 0) {
      let { error: errArq } = await supabase.from('partido_arqueros').insert(arqRows)
      if (errArq && ((errArq.message || '').includes('player_nombre') || (errArq.message || '').includes('null value'))) {
        // BD sin migración: guardar al menos los arqueros registrados
        ;({ error: errArq } = await supabase.from('partido_arqueros').insert(arqRows.filter(r => r.player_id).map(({ player_nombre, numero, ...r }) => r)))
      }
    }

    // Marcar si gol fue hecho siendo arquero (marcador_fue_arquero)
    // Arquero local que mete gol → es gol de jugador
    // Jugador de campo que tapó → sus goles recibidos son de arquero
    const todosArquerosLocalIds = new Set([...histArquerosLocal.map(a=>a.id), arqueroLocal?.id].filter(Boolean))
    const todosArquerosVisIds   = new Set([...histArquerosVis.map(a=>a.id),   arqueroVis?.id].filter(Boolean))

    const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
    const statsRows = []
    // Cuenta como "jugó" cualquier jugador al que se le haya anotado el
    // número de camiseta en la planilla (esté o no marcado explícitamente en
    // iniciales/ingresos) — así como el arquero, o cualquiera con gol,
    // tarjeta o falta registrada.
    const procesarStats = (jugadores, goles, team_id, esLocal, iniciales, ingresos) => {
      const gF = esLocal ? golesLocalTotal : golesVisTotal
      const gC = esLocal ? golesVisTotal   : golesLocalTotal
      const arqueroIds = esLocal ? todosArquerosLocalIds : todosArquerosVisIds
      // El arquero actual (último) recibe todos los GC
      const arqueroActualId = esLocal ? arqueroLocal?.id : arqueroVis?.id
      jugadores.forEach(j => {
        if (!j.id || !j.numero) return
        const esArqueroEnEstePartido = arqueroIds.has(j.id)
        const esArqueroActual        = j.id === arqueroActualId
        const golesAnotados          = goles.filter(g => g && String(g.numero) === String(j.numero)).length
        // GC solo al arquero actual (o último que tapó)
        const golesRecibidos         = esArqueroActual ? gC : 0
        statsRows.push({
          match_id: partido.id, tournament_id: partido.tournament_id,
          player_id: j.id, team_id, numero_camiseta: j.numero,
          goals_scored: golesAnotados,
          goals_conceded: golesRecibidos,
          fue_arquero: esArqueroEnEstePartido,
          own_goals: 0, yellow_cards: j.amarilla ? 1 : 0, blue_cards: j.azul ? 1 : 0,
          red_cards: j.roja ? 1 : 0, fouls: (j.faltasPeriodo || []).length,
          team_result: tipoPartido === 'desierto' ? 'draw' : calcResultado(gF, gC)
        })
      })
    }
    procesarStats(jugadoresLocal, golesLocal, partido.home_team_id, true, finalistasLocal, ingresosLocal)
    procesarStats(jugadoresVisitante, golesVisitante, partido.away_team_id, false, finalistasVis, ingresosVis)
    if (statsRows.length > 0) {
      const { error: errStats } = await supabase.from('player_match_stats').upsert(statsRows, { onConflict: 'match_id,player_id' })
      if (errStats) erroresGuardado.push('Estadísticas: ' + errStats.message)
    }

    // Sanción automática por tarjeta roja: mínimo 1 fecha de suspensión, sin
    // que el organizador tenga que hacer nada. Si quiere suspenderlo más
    // tiempo, eso sí lo hace él a mano (como ya funcionaba).
    try {
      const equiposPartido = [partido.home_team_id, partido.away_team_id].filter(Boolean)
      // Solo la primera vez que se guarda este partido como jugado se
      // descuenta 1 fecha a las sanciones automáticas pendientes de estos
      // equipos (evita descontar de más si se edita el partido después).
      if (!yaJugadoRef.current && equiposPartido.length > 0) {
        const { data: pendientes } = await supabase.from('sanciones').select('id, partidos_pendientes')
          .eq('activa', true).not('partidos_pendientes', 'is', null).gt('partidos_pendientes', 0).in('team_id', equiposPartido)
        for (const s of (pendientes || [])) {
          const restante = (s.partidos_pendientes || 1) - 1
          await supabase.from('sanciones').update({ partidos_pendientes: restante, activa: restante > 0 }).eq('id', s.id)
        }
      }
      const conRoja = statsRows.filter(r => r.red_cards > 0)
      if (conRoja.length > 0) {
        const { data: yaExisten } = await supabase.from('sanciones').select('player_id').eq('match_id', partido.id).in('player_id', conRoja.map(r => r.player_id))
        const idsConSancion = new Set((yaExisten || []).map(s => s.player_id))
        const nuevasSanciones = conRoja.filter(r => !idsConSancion.has(r.player_id)).map(r => ({
          player_id: r.player_id, team_id: r.team_id, tournament_id: partido.tournament_id, match_id: partido.id,
          motivo: 'Tarjeta roja automática (mínimo 1 fecha) — el organizador puede extenderla desde el torneo',
          activa: true, partidos_pendientes: 1, fecha_fin: null,
        }))
        if (nuevasSanciones.length > 0) await supabase.from('sanciones').insert(nuevasSanciones)
      }
    } catch (e) { console.error('sanción automática roja:', e) }

    // MVP
    const mvpFinal = mvpIdFinal || mvpId
    if (mvpFinal) {
      // Borrar MVP anterior del partido si existe
      await supabase.from('tournament_logros').delete()
        .eq('match_id', partido.id).eq('tipo', 'mvp')
      // Insertar nuevo MVP
      await supabase.from('tournament_logros').insert({
        player_id:     mvpFinal,
        tournament_id: partido.tournament_id,
        match_id:      partido.id,
        tipo:          'mvp',
      })
    }

    // Predicciones
    if (!tipoPartido) {
      const ganador = golesLocalTotal > golesVisTotal ? 'home' : golesLocalTotal < golesVisTotal ? 'away' : 'draw'
      const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', partido.id).eq('resuelta', false)
      if (preds && preds.length > 0) {
        for (const pred of preds) {
          let pts = 0
          if (pred.ganador === ganador) pts += ganador === 'draw' ? 5 : 3
          if (pred.goles_home === golesLocalTotal) pts += 3
          if (pred.goles_away === golesVisTotal) pts += 3
          if (pred.goles_home === golesLocalTotal && pred.goles_away === golesVisTotal) pts += 10
          await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
        }
      }
    } else {
      await supabase.from('predicciones').update({ puntos_ganados: 0, resuelta: true }).eq('match_id', partido.id).eq('resuelta', false)
    }

    // Si algo crítico falló, NO se cierra la planilla ni se borra el borrador:
    // se muestra el error para reintentar (o avisar al administrador).
    if (erroresGuardado.length > 0) {
      setGuardandoDB(false)
      alert('⚠️ NO SE PUDO GUARDAR EL RESULTADO:\n\n' + erroresGuardado.join('\n') + '\n\nLa planilla NO se cerró y tus datos siguen guardados como borrador. Intenta de nuevo con buena señal, o avisa al administrador con este mensaje.')
      return
    }

    try { localStorage.removeItem(localKey) } catch(e) {}
    setHayDatosLocales(false)
    setGuardandoDB(false)
    onGuardarResultado(golesLocalTotal, golesVisTotal)
    onClose()
  }

  // Árbitros del partido que aún no han firmado la planilla.
  // La firma del árbitro PRINCIPAL es SIEMPRE obligatoria (aunque el nombre
  // esté vacío); la del árbitro 2 lo es apenas tenga nombre asignado.
  function firmasFaltantes() {
    const faltan = []
    if (!firmas.arbitro1) faltan.push(arbitro1 || 'Árbitro principal')
    if (arbitro2 && !firmas.arbitro2) faltan.push(arbitro2)
    return faltan
  }

  function handleCerrar() {
    // La X roja y el botón "✕ Cerrar" SOLO guardan lo llenado hasta ahora como
    // borrador (localStorage + snapshot remoto en vivo), para que al volver a
    // entrar aparezca tal cual quedó (números, goles, etc.). No exigen firma
    // ni MVP, y NO suben resultado ni marcan el partido como jugado — eso solo
    // pasa al tocar "💾 Guardar resultado".
    const snap = construirSnap()
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch (e) {}
    sincronizarRemoto(snap, { inmediato: true })
    onClose()
  }

  // Flujo: botón guardar → modal MVP → guardar todo
  async function handleClickGuardar() {
    // Planilla YA cerrada que se está reeditando: antes este botón solo
    // cerraba sin guardar NADA — los cambios del coordinador (tarjetas
    // agregadas, correcciones) se perdían en silencio. Ahora pregunta y
    // vuelve a guardar todo (queda registrado quién editó y cuándo).
    if (partido.status === 'finished' && mvpId) {
      const ok = window.confirm('Esta planilla ya estaba cerrada.\n\n¿Guardar los cambios que hiciste? Quedará registrado quién la editó.')
      if (!ok) return
      await guardarEnDB(null, mvpId)
      return
    }
    // Arquero obligatorio de ambos equipos antes de guardar
    if (!arqueroLocal) { setAvisoArqueroFaltante(partido.home?.name); return }
    if (!arqueroVis)   { setAvisoArqueroFaltante(partido.away?.name); return }
    // La firma de los árbitros que pitaron es obligatoria antes de guardar
    const faltan = firmasFaltantes()
    if (faltan.length > 0) { setAvisoFirmas(faltan); return }
    // Con tarjeta roja el informe del partido es OBLIGATORIO antes de guardar
    const hayRoja = [...jugadoresLocal, ...jugadoresVisitante].some(j => j.roja)
    if (hayRoja && !informeGuardado) {
      if (!informeTipo) setInformeTipo('roja')
      setShowInforme({ motivo: 'roja', continuar: 'mvp' })
      return
    }
    setShowMVP(true)
  }

  async function handleGuardarMVP(playerId) {
    setShowMVP(false)
    setMvpId(playerId)
    await guardarEnDB(null, playerId)
  }

  async function handleConfirmarEspecial(info) {
    setShowEspecial(null)
    // También aquí la firma de los árbitros es OBLIGATORIA (antes el guardado
    // por W/Desierto se saltaba este control)
    const faltanFirmas = firmasFaltantes()
    if (faltanFirmas.length > 0) { setAvisoFirmas(faltanFirmas); return }
    // Partido terminado antes de tiempo / no jugado (W o desierto):
    // el informe de lo que pasó es OBLIGATORIO antes de guardar
    if (!informeGuardado) {
      if (!informeTipo) setInformeTipo('terminado_antes')
      setShowInforme({ motivo: 'especial', continuarEspecial: info })
      return
    }
    await guardarEnDB(info, null)
  }

  // ── INFORME DEL PARTIDO (dictado por voz o escrito) ──────────────────────
  function toggleDictado() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Este navegador no soporta dictado por voz — escribe el informe con el teclado.'); return }
    if (dictando) { try { recVozRef.current?.stop() } catch(e) {}; setDictando(false); return }
    const rec = new SR()
    rec.lang = 'es-CO'; rec.continuous = true; rec.interimResults = false
    rec.onresult = e => {
      let t = ''
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript
      if (t.trim()) setInformeTexto(prev => (prev ? prev.trim() + ' ' : '') + t.trim())
    }
    rec.onend   = () => setDictando(false)
    rec.onerror = () => setDictando(false)
    recVozRef.current = rec
    try { rec.start(); setDictando(true) } catch(e) { setDictando(false) }
  }

  async function guardarInforme() {
    if (!informeTipo) { alert('Selecciona el motivo del informe'); return }
    if ((informeTexto || '').trim().length < 10) { alert('Escribe o dicta el informe (mínimo unas palabras) — es obligatorio.'); return }
    setGuardandoInforme(true)
    try { recVozRef.current?.stop() } catch(e) {}
    setDictando(false)
    let creadoPor = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      creadoPor = user?.email || null
      if (user?.id) {
        const { data: pRow } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle()
        if (pRow?.name) creadoPor = pRow.name
      }
    } catch(e) {}
    const { error } = await supabase.from('match_informes').insert({
      match_id: partido.id, tournament_id: partido.tournament_id,
      tipo: informeTipo, descripcion: informeTexto.trim(), creado_por: creadoPor,
    })
    setGuardandoInforme(false)
    if (error) { alert('No se pudo guardar el informe: ' + error.message + '\nRevisa la señal e intenta de nuevo.'); return }
    setInformeGuardado(true)
    const pendiente = showInforme
    setShowInforme(null)
    if (pendiente?.continuarEspecial) await guardarEnDB(pendiente.continuarEspecial, null)
    else if (pendiente?.continuar === 'mvp') setShowMVP(true)
  }

  function formatTiempo(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }

  // ── ARQUERO OBLIGATORIO ──────────────────────────────────────────────────
  function seleccionarArquero(equipo, jugador) {
    const saliente = arqueroSalienteRef.current[equipo]
    const nuevoArq = { id: jugador.id, numero: jugador.numero, name: jugador.nombre || jugador.name }
    const setArq  = equipo === 'local' ? setArqueroLocal : setArqueroVis
    const setHist = equipo === 'local' ? setHistArquerosLocal : setHistArquerosVis
    setArq(nuevoArq)
    setHist(prev => {
      if (saliente && saliente.id !== jugador.id) {
        const base = prev.length > 0 ? prev : [{ ...saliente, orden: 1 }]
        if (base.some(a => a.id === jugador.id)) return base
        return [...base, { ...nuevoArq, orden: base.length + 1 }]
      }
      if (prev.length === 0) return [{ ...nuevoArq, orden: 1 }]
      return prev
    })
    arqueroSalienteRef.current[equipo] = null
  }
  // Doble click al arquero ya marcado: lo borra y obliga a elegir uno nuevo (popup)
  function liberarArquero(equipo) {
    const actual = equipo === 'local' ? arqueroLocal : arqueroVis
    arqueroSalienteRef.current[equipo] = actual
    if (equipo === 'local') setArqueroLocal(null); else setArqueroVis(null)
  }
  function equipoTieneArquero(equipo) { return equipo === 'local' ? !!arqueroLocal : !!arqueroVis }
  function intentarAccionConArquero(equipo, accion) {
    if (!equipoTieneArquero(equipo)) { setAvisoArqueroFaltante(equipo === 'local' ? partido.home?.name : partido.away?.name); return }
    accion()
  }

  const updateJugador = useCallback((equipo, idx, campo, valor) => {
    const s = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    s(prev => prev.map((j, i) => i === idx ? { ...j, [campo]: valor } : j))
  }, [])

  function numeroRepetido(equipo, numero, idxActual) {
    if (numero === '' || numero === null || numero === undefined) return false
    const jugs = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
    return jugs.some((j, i) => i !== idxActual && String(j.numero) === String(numero) && String(numero) !== '')
  }

  function addFaltaAJugador(equipo, numero) {
    const s = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    s(prev => prev.map(j => {
      if (String(j.numero) !== String(numero)) return j
      const fp = [...(j.faltasPeriodo || []), periodo]
      // Al completar 5 faltas personales: aviso emergente + vibración
      if (fp.length === 5) {
        setAvisoAcumulado({ nombre: j.nombre || `Jugador #${numero}`, numero })
        try { if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]) } catch(e) {}
      }
      return { ...j, faltasPeriodo: fp }
    }))
  }
  function quitarFaltaDeJugador(equipo, numero, per) {
    const s = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    s(prev => prev.map(j => { if (String(j.numero) !== String(numero)) return j; const fp = [...(j.faltasPeriodo || [])]; const idx = fp.indexOf(per); if (idx >= 0) fp.splice(idx, 1); return { ...j, faltasPeriodo: fp } }))
  }
  function registrarGol(equipo, slotIdx, numero) {
    const goles = equipo === 'local' ? golesLocal : golesVisitante
    if (slotIdx > 0 && goles[slotIdx - 1] === null) return
    const gol = { numero, minuto: formatTiempo(segundos), periodo }
    if (equipo === 'local') setGolesLocal(prev => { const n = [...prev]; n[slotIdx] = gol; return n })
    else setGolesVisitante(prev => { const n = [...prev]; n[slotIdx] = gol; return n })
    setDropdownOpen(null)
  }
  function eliminarGol(equipo, slotIdx) {
    const ul = (equipo === 'local' ? golesLocal : golesVisitante).reduce((l, g, i) => g !== null ? i : l, -1)
    if (slotIdx !== ul) return
    if (equipo === 'local') setGolesLocal(prev => { const n = [...prev]; n[slotIdx] = null; return n })
    else setGolesVisitante(prev => { const n = [...prev]; n[slotIdx] = null; return n })
  }
  function registrarFaltaAcum(equipo, per, slotIdx, numero) {
    const key = `p${per}`, fa = equipo === 'local' ? faltasAcumLocal : faltasAcumVis
    if (slotIdx > 0 && fa[key][slotIdx - 1] === null) return
    if (equipo === 'local') setFaltasAcumLocal(prev => { const arr = [...prev[key]]; arr[slotIdx] = numero; return { ...prev, [key]: arr } })
    else setFaltasAcumVis(prev => { const arr = [...prev[key]]; arr[slotIdx] = numero; return { ...prev, [key]: arr } })
    addFaltaAJugador(equipo, numero); setDropdownOpen(null)
  }
  function eliminarFaltaAcum(equipo, per, slotIdx) {
    const key = `p${per}`, fa = equipo === 'local' ? faltasAcumLocal : faltasAcumVis
    const numero = fa[key][slotIdx]; if (numero === null) return
    quitarFaltaDeJugador(equipo, numero, per)
    if (equipo === 'local') setFaltasAcumLocal(prev => { const arr = [...prev[key]]; arr[slotIdx] = null; return { ...prev, [key]: arr } })
    else setFaltasAcumVis(prev => { const arr = [...prev[key]]; arr[slotIdx] = null; return { ...prev, [key]: arr } })
  }
  function puedeAbrirFalta(fa, key, i) { return i === 0 ? fa[key][0] === null : fa[key][i-1] !== null && fa[key][i] === null }
  function puedeAbrirGol(goles, si) { return si === 0 ? goles[0] === null : goles[si-1] !== null && goles[si] === null }
  // Arrastre del cronómetro: funciona tocando/clickeando en CUALQUIER parte del
  // widget (no solo en una barrita específica). Se distingue de un tap/click sobre
  // un botón interno (Play, Minimizar, etc.) con un umbral de movimiento: si el dedo
  // no se mueve más de unos px, se deja pasar el click normal; si se mueve, se
  // considera arrastre y se mueve el cronómetro, bloqueando el click para que no
  // se dispare por error el botón que quedó debajo del dedo.
  function onDragStart(e) {
    const t = e.touches ? e.touches[0] : e
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: cronoPos.x, oy: cronoPos.y, moved: false }
    if (e.touches) {
      window.addEventListener('touchmove', onDrag, { passive: false })
      window.addEventListener('touchend', onDragEnd)
      window.addEventListener('touchcancel', onDragEnd)
    } else {
      window.addEventListener('mousemove', onDrag)
      window.addEventListener('mouseup', onDragEnd)
    }
  }
  function onDrag(e) {
    if (!dragStart.current) return
    const t = e.touches ? e.touches[0] : e
    const dx = t.clientX - dragStart.current.mx, dy = t.clientY - dragStart.current.my
    if (!dragStart.current.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) dragStart.current.moved = true
    if (dragStart.current.moved) {
      if (e.touches) e.preventDefault()
      setCronoPos({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    }
  }
  function onDragEnd() {
    if (dragStart.current?.moved) {
      // Hubo arrastre real: se traga el próximo click (o el actual, si ya se
      // disparó) para que no le pegue por accidente al botón que quedó debajo.
      const bloquear = ev => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', bloquear, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', bloquear, { capture: true }), 400)
    }
    dragStart.current = null
    window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDrag); window.removeEventListener('touchend', onDragEnd); window.removeEventListener('touchcancel', onDragEnd)
  }
  // ── ALARMA DE FIN DE TIEMPO (no para hasta que la paren) ────────────────
  function sonarAlarmaUnaVez() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (freq, start, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur); g.gain.setValueAtTime(0.3, ctx.currentTime + start); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur) }
      beep(880, 0, 0.3); beep(1100, 0.4, 0.6)
    } catch(e) {}
    try { if (navigator.vibrate) navigator.vibrate([450, 150, 450]) } catch(e) {}
  }
  function iniciarAlarma() {
    if (alarmaRef.current) return
    sonarAlarmaUnaVez()
    alarmaRef.current = setInterval(sonarAlarmaUnaVez, 1500)
    setAlarmaActiva(true)
  }
  function pararAlarma() {
    clearInterval(alarmaRef.current); alarmaRef.current = null
    setAlarmaActiva(false)
    try { if (navigator.vibrate) navigator.vibrate(0) } catch(e) {}
  }
  useEffect(() => () => { clearInterval(alarmaRef.current); try { navigator.vibrate && navigator.vibrate(0) } catch(e) {} }, [])

  function iniciarPeriodo2() { pararAlarma(); setCorriendo(false); setSegundos(0); setTiempoAgotado(false); setTiempoExtra(0); setPeriodo(2) }
  function agregarTiempoExtra(mins) { pararAlarma(); setTiempoExtra(prev => prev + mins); setTiempoAgotado(false); setCorriendo(true) }
  function confirmarDuracion() {
    const val = parseInt(duracionInput)
    if (!isNaN(val) && val > 0 && val <= 90) { setDuracionMinutos(val); setSegundos(0); setTiempoAgotado(false); setTiempoExtra(0); setCorriendo(false) }
    setEditandoDuracion(false)
  }

  const golesLocalTotal = golesLocal.filter(Boolean).length
  const golesVisTotal   = golesVisitante.filter(Boolean).length
  const fecha    = partido.played_at ? new Date(partido.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const hora     = partido.played_at ? new Date(partido.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''
  const etapaNombre = partido.matchday ? `Jornada ${partido.matchday}` : ''
  const B    = '1px solid #000'
  const cell  = { border: B, padding: '2px 3px', fontSize: '9px', textAlign: 'center', verticalAlign: 'middle' }
  const cellL = { border: B, padding: '2px 3px', fontSize: '9px', textAlign: 'left',   verticalAlign: 'middle' }
  const inp   = { border: 'none', outline: 'none', width: '100%', fontSize: '9px', textAlign: 'center', background: 'transparent', color: '#111' }
  const inpL  = { border: 'none', outline: 'none', width: '100%', fontSize: '9px', textAlign: 'left',   background: 'transparent', color: '#111' }
  const progreso = Math.min(segundos / limiteSegundos, 1)
  const cronoBg  = tiempoAgotado ? '#b71c1c' : periodo === 1 ? AZUL : ROJO

  // Lista de camisetas GRANDE y siempre visible: se pinta con position:fixed
  // centrada en la pantalla (la hoja tiene scroll lateral y una lista absoluta
  // podía quedar fuera de la parte visible). El equipo de ARRIBA (local) la
  // despliega en la mitad superior; el de ABAJO (visitante) en la inferior.
  // `excluir`: números que ya fueron usados y no deben volver a salir.
  function DropdownCamisetas({ jugs, dropKey, onSelect, equipo, excluir = [] }) {
    if (dropdownOpen !== dropKey) return null
    const usados = new Set((excluir || []).filter(n => n !== '' && n !== null && n !== undefined).map(String))
    const jugsConNumero = jugs.filter(j => j.numero !== '' && j.numero !== null && j.numero !== undefined && !usados.has(String(j.numero)))
    const arriba = equipo !== 'visitante'
    return (
      <>
        {/* Fondo oscuro: enfoca la lista y al tocarlo se cierra */}
        <div onClick={e => { e.stopPropagation(); setDropdownOpen(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9490 }}/>
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            ...(arriba ? { top: '60px' } : { bottom: '20px' }),
            zIndex: 9500, background: '#fff', border: '1px solid #dadce0', borderRadius: '14px',
            boxShadow: '0 12px 40px rgba(0,0,0,.45)', width: 'min(92vw, 340px)', maxHeight: '62vh',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', background: arriba ? colorLocal : colorVisitante, color: '#fff', fontWeight: 800, fontSize: '.82rem', position: 'sticky', top: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{arriba ? partido.home?.name : partido.away?.name}</span>
            <span onClick={() => setDropdownOpen(null)} style={{ cursor: 'pointer', fontWeight: 900, padding: '0 4px' }}>✕</span>
          </div>
          {jugsConNumero.length === 0 && <div style={{ padding: '16px', fontSize: '.85rem', color: '#9aa0a6', textAlign: 'center' }}>Sin números disponibles</div>}
          {jugsConNumero.map(j => (
            <div key={j.numero} onClick={() => onSelect(j.numero)}
              style={{ padding: '13px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f1f3f4' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <span style={{ fontWeight: 900, color: '#111', minWidth: '44px', background: '#e8f0fe', borderRadius: '8px', textAlign: 'center', padding: '6px 4px', fontSize: '1.05rem' }}>#{j.numero}</span>
              <span style={{ fontSize: '.92rem', color: '#111', fontWeight: 600 }}>{j.nombre}</span>
            </div>
          ))}
        </div>
      </>
    )
  }

  function SlotGol({ equipo, slotIdx, goles, jugs, colorEquipo }) {
    const gol = goles[slotIdx], num = slotIdx + 1, dropKey = `gol-${equipo}-${slotIdx}`
    const ul = goles.reduce((l, g, i) => g !== null ? i : l, -1), esUl = ul === slotIdx
    const puedeClic = puedeAbrirGol(goles, slotIdx)
    return (
      <td style={{ border: B, padding: '1px 2px', position: 'relative', verticalAlign: 'middle', background: gol ? (gol.periodo === 2 ? ROJO + '45' : AZUL + '45') : (colorEquipo || '#1a3a8a') + '30' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <span style={{ fontSize: '8px', color: '#111', minWidth: '9px', fontWeight: '700' }}>{num}</span>
          {gol ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flex: 1 }} onDoubleClick={() => { if (esUl) eliminarGol(equipo, slotIdx) }} title={esUl ? 'Doble click para eliminar' : ''}>
              <span style={{ fontWeight: '900', fontSize: '10px', color: '#111' }}>#{gol.numero}</span>
              <span style={{ fontSize: '8px', color: '#111' }}>{gol.minuto}</span>
              {esUl && <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '6px' }}>2x✕</span>}
            </div>
          ) : puedeClic ? (
            <div style={{ flex: 1, position: 'relative' }} onClick={e => { e.stopPropagation(); intentarAccionConArquero(equipo, () => setDropdownOpen(dropdownOpen === dropKey ? null : dropKey)) }}>
              <span style={{ fontSize: '9px', color: equipoTieneArquero(equipo) ? '#555' : '#ccc', cursor: 'pointer', fontWeight: '700' }}>+N°</span>
              <DropdownCamisetas jugs={jugs} dropKey={dropKey} equipo={equipo} onSelect={n => registrarGol(equipo, slotIdx, n)}/>
            </div>
          ) : <span style={{ fontSize: '7px', color: '#bbb' }}>—</span>}
        </div>
      </td>
    )
  }

  function SlotFalta({ equipo, per, i, faltasAcum, jugs }) {
    const key = `p${per}`, val = faltasAcum[key][i], dropKey = `falta-${equipo}-p${per}-${i}`
    // En el 2do tiempo las casillas del 1er tiempo quedan BLOQUEADAS
    const bloqueadaPorPeriodo = per < periodo
    const puedeClic = !bloqueadaPorPeriodo && puedeAbrirFalta(faltasAcum, key, i)
    return (
      <td style={{ border: B, padding: '2px 1px', position: 'relative', textAlign: 'center', verticalAlign: 'middle', background: val !== null ? (per === 1 ? '#ddeeff' : '#ffdddd') : bloqueadaPorPeriodo ? '#e0e0e0' : puedeClic ? '#f8f9fa' : '#f1f3f4', cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); if (bloqueadaPorPeriodo && val === null) { setAvisoPeriodo(true); return } if (puedeClic && val === null) intentarAccionConArquero(equipo, () => setDropdownOpen(dropdownOpen === dropKey ? null : dropKey)) }}
        onDoubleClick={e => { e.stopPropagation(); if (val !== null) { if (bloqueadaPorPeriodo) { setAvisoPeriodo(true); return } eliminarFaltaAcum(equipo, per, i) } }}
        title={val !== null ? 'Doble click para eliminar' : ''}>
        {val !== null ? <span style={{ fontWeight: '700', color: '#111', fontSize: '9px' }}>{val}<span style={{ fontSize: '6px', color: '#aaa' }}>2x</span></span>
          : puedeClic ? <span style={{ color: '#555', fontSize: '9px' }}>+</span>
          : <span style={{ color: bloqueadaPorPeriodo ? '#999' : '#ccc', fontSize: '8px' }}>{bloqueadaPorPeriodo ? '🔒' : '—'}</span>}
        <DropdownCamisetas jugs={jugs} dropKey={dropKey} equipo={equipo} onSelect={n => registrarFaltaAcum(equipo, per, i, n)}/>
      </td>
    )
  }

  // Casillas INICIALES e INGRESOS: mismo comportamiento que Faltas Acumulativas
  // (se hunden en orden y al click aparece la lista de jugadores del equipo).
  function registrarSeleccion(setArr, valores, i, numero) {
    if (i > 0 && valores[i - 1] === '') return
    setArr(prev => { const n = [...prev]; n[i] = numero; return n })
    setDropdownOpen(null)
  }
  function eliminarSeleccion(setArr, i) {
    setArr(prev => { const n = [...prev]; n[i] = ''; return n })
  }
  function SlotSeleccion({ equipo, i, valores, setArr, jugs, dropKeyPrefix, ultimaCol }) {
    const val = valores[i], dropKey = `${dropKeyPrefix}-${equipo}-${i}`
    const puedeClic = i === 0 ? valores[0] === '' : valores[i - 1] !== '' && valores[i] === ''
    return (
      <div style={{ flex: 1, borderRight: ultimaCol ? 'none' : B, padding: '2px', textAlign: 'center', position: 'relative', cursor: 'pointer', background: val ? '#e6f4ea' : puedeClic ? '#f8f9fa' : '#f1f3f4' }}
        onClick={e => { e.stopPropagation(); if (puedeClic && !val) intentarAccionConArquero(equipo, () => setDropdownOpen(dropdownOpen === dropKey ? null : dropKey)) }}
        onDoubleClick={e => { e.stopPropagation(); if (val) eliminarSeleccion(setArr, i) }}
        title={val ? 'Doble click para borrar' : ''}>
        {val ? <span style={{ fontWeight: '700', color: '#111', fontSize: '9px' }}>#{val}</span>
          : puedeClic ? <span style={{ color: '#555', fontSize: '9px' }}>+</span>
          : <span style={{ color: '#ccc', fontSize: '8px' }}>—</span>}
        {/* excluir={valores}: un número ya elegido en esta lista no vuelve a salir */}
        <DropdownCamisetas jugs={jugs} dropKey={dropKey} equipo={equipo} excluir={valores} onSelect={n => registrarSeleccion(setArr, valores, i, n)}/>
      </div>
    )
  }

  function TablaJugadores({ jugs, equipo, goles, colorEquipo }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '55px' }}/><col style={{ width: '90px' }}/><col style={{ width: '24px' }}/>
          <col style={{ width: '12px' }}/><col style={{ width: '12px' }}/><col style={{ width: '12px' }}/><col style={{ width: '12px' }}/><col style={{ width: '12px' }}/>
          <col style={{ width: '26px' }}/><col style={{ width: '20px' }}/><col style={{ width: '20px' }}/>
          <col style={{ width: '20px' }}/><col style={{ width: '20px' }}/><col style={{ width: '26px' }}/>
        </colgroup>
        <thead>
          <tr style={{ background: '#ddd' }}>
            <th style={{ ...cell, fontSize: '8px', color: '#111' }}>DOCUMENTO N°</th>
            <th style={{ ...cellL, fontSize: '8px', color: '#111' }}>NOMBRE Y APELLIDO</th>
            <th style={{ ...cell, fontSize: '8px', color: '#111' }}>N°</th>
            <th style={{ ...cell, fontSize: '7px', color: '#111' }}>1</th><th style={{ ...cell, fontSize: '7px', color: '#111' }}>2</th>
            <th style={{ ...cell, fontSize: '7px', color: '#111' }}>3</th><th style={{ ...cell, fontSize: '7px', color: '#111' }}>4</th>
            <th style={{ ...cell, fontSize: '7px', color: '#111' }}>5</th>
            <th style={{ ...cell, fontSize: '7px', background: '#ffcc00', color: '#111' }}>AMARILLA</th>
            <th style={{ ...cell, fontSize: '7px', background: '#aaddff', color: '#111' }}>AZUL</th>
            <th style={{ ...cell, fontSize: '7px', background: '#ffaaaa', color: '#111' }}>ROJA</th>
            <th style={{ ...cell, fontSize: '7px', color: '#111' }}>1°P.</th>
            <th style={{ ...cell, fontSize: '7px', color: '#111' }}>2°P.</th>
            <th style={{ ...cell, fontSize: '7px', fontWeight: '700', color: '#111' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {jugs.map((j, idx) => {
            const g1 = goles.filter(g => g && String(g.numero) === String(j.numero) && g.periodo === 1).length
            const g2 = goles.filter(g => g && String(g.numero) === String(j.numero) && g.periodo === 2).length
            const faltas = j.faltasPeriodo || []
            const repetido = numeroRepetido(equipo, j.numero, idx)
            const esPortero = j.posicion_futbol5 === 'Portero' || j.posicion_futbol7 === 'Portero' || j.posicion_futbol11 === 'Portero'
            const esMVP = j.id && j.id === mvpId
            const arqueroActual   = equipo === 'local' ? arqueroLocal : arqueroVis
            // Un jugador sin registro (sin id) también puede ser arquero: se
            // identifica por su número y nombre escritos en la planilla.
            const esArqueroActual = !!arqueroActual && (
              (j.id && arqueroActual.id === j.id) ||
              (!j.id && !arqueroActual.id && (arqueroActual.name || '').trim() === (j.nombre || '').trim())
            )
            const hayArqueroEquipo = !!arqueroActual
            const sinRegistro = !j.id
            const tieneNombreEscrito = sinRegistro && (j.nombre || '').trim() !== ''
            return (
              <tr key={idx} style={{ height: '19px', background: esMVP ? '#fff8e1' : esArqueroActual ? '#c8f7d4' : tieneNombreEscrito ? '#ffe6c2' : 'transparent' }}>
                <td style={cell}>
                  {sinRegistro
                    ? <span style={{ ...inp, display: 'block', color: tieneNombreEscrito ? '#c46200' : '#bbb', fontWeight: '700', fontStyle: 'italic' }}>{tieneNombreEscrito ? 'Sin registro' : ''}</span>
                    : <span style={{ ...inp, display: 'block' }}>{j.cedula}</span>}
                </td>
                <td style={{ ...cellL, background: esMVP ? '#fff59d' : esArqueroActual ? '#a8f0c0' : tieneNombreEscrito ? '#ffdca6' : (colorEquipo || '#1a3a8a') + '35' }}>
                  {esArqueroActual && <div style={{ fontSize: '6px', fontWeight: '800', lineHeight: 1, color: '#1e8e3e' }}>ARQUERO TITULAR</div>}
                  {sinRegistro && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <input value={j.nombre} onChange={e => updateJugador(equipo, idx, 'nombre', e.target.value)}
                        placeholder="Jugador sin registrar..." style={{ ...inpL, fontWeight: '700', color: '#111', width: '100%' }}/>
                      {/* Un jugador sin registro también puede marcarse como arquero */}
                      {tieneNombreEscrito && !hayArqueroEquipo && (
                        <button onClick={() => { if (!j.numero) { alert('Primero escribe su número de camiseta para poder marcarlo como arquero 🧤'); return } seleccionarArquero(equipo, j) }}
                          title="Marcar como arquero titular" style={{ background: '#fff3cd', border: '1px solid #f9a825', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', padding: '0 3px', lineHeight: 1.4, flexShrink: 0 }}>🧤</button>
                      )}
                      {esArqueroActual && (
                        <button onClick={() => liberarArquero(equipo)} title="Cambiar de arquero" style={{ background: '#fff', border: '1px solid #1e8e3e', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '0 3px', color: '#1e8e3e', flexShrink: 0 }}>🔄</button>
                      )}
                    </div>
                  )}
                  <span style={{ ...inpL, display: sinRegistro ? 'none' : 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: '#111' }}>{j.nombre}
                    {esArqueroActual && <button onClick={() => liberarArquero(equipo)} title="Cambiar de arquero" style={{ background: '#fff', border: '1px solid #1e8e3e', borderRadius: '3px', cursor: 'pointer', fontSize: '8px', padding: '0 3px', color: '#1e8e3e' }}>🔄 cambiar</button>}
                    {esArqueroActual ? '' : ' '}
                  </span>
                  {esPortero && <span style={{ fontSize: '6px', color: '#1a73e8', fontWeight: '700' }}> (portero natural)</span>}
                  {esMVP     && <span style={{ fontSize: '6px', color: '#e8710a', fontWeight: '700' }}> ⭐MVP</span>}
                  {j.debeTarjeta && <span title="Tiene una tarjeta de un partido anterior sin pagar" style={{ display: 'inline-block', marginLeft: '3px', fontSize: '6px', fontWeight: '800', color: '#fff', background: '#d93025', borderRadius: '4px', padding: '1px 4px' }}>⚠️ DEBE TARJETA</span>}
                </td>
                {(hayArqueroEquipo || sinRegistro) ? (
                  <InputCamiseta value={j.numero} onChange={val => updateJugador(equipo, idx, 'numero', val)} onDoubleClick={() => updateJugador(equipo, idx, 'numero', '')} repetido={repetido}/>
                ) : (
                  <td style={{ ...cell, background: '#fff3cd', padding: '1px' }}>
                    <button onClick={() => seleccionarArquero(equipo, j)} title="Marcar como arquero titular" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px', lineHeight: 1 }}>🧤</button>
                  </td>
                )}
                {[0,1,2,3,4].map(n => {
                  const tF = faltas.length > n
                  const per = faltas[n]
                  const esUltima = tF && n === faltas.length - 1
                  return (
                    <td key={n}
                      onDoubleClick={() => { if (esUltima && String(j.numero) !== '') quitarFaltaDeJugador(equipo, j.numero, per) }}
                      title={esUltima ? 'Doble click para borrar esta falta' : ''}
                      style={{ ...cell, background: tF ? (per === 2 ? ROJO : AZUL) : 'transparent', cursor: esUltima ? 'pointer' : 'default' }}>
                      {tF && <span style={{ color: '#fff', fontWeight: '800' }}>P</span>}
                    </td>
                  )
                })}
                <td title={j.amarilla ? 'Doble click para quitar' : 'Doble click para marcar con el tiempo del cronómetro'}
                  style={{ ...cell, background: j.amarilla ? '#ffcc00' : 'transparent', cursor: 'pointer' }}
                  onDoubleClick={() => { if (j.amarilla) updateJugador(equipo, idx, 'amarilla', false); else intentarAccionConArquero(equipo, () => updateJugador(equipo, idx, 'amarilla', formatTiempo(segundos))) }}>
                  <span style={{ color: j.amarilla ? '#111' : 'transparent', fontSize: '6.5px', fontWeight: '800' }}>{typeof j.amarilla === 'string' ? j.amarilla : j.amarilla ? '✓' : '·'}</span>
                </td>
                <td title={j.azul ? 'Doble click para quitar' : 'Doble click para marcar con el tiempo del cronómetro'}
                  style={{ ...cell, background: j.azul ? '#4488ff' : 'transparent', cursor: 'pointer' }}
                  onDoubleClick={() => { if (j.azul) updateJugador(equipo, idx, 'azul', false); else intentarAccionConArquero(equipo, () => updateJugador(equipo, idx, 'azul', formatTiempo(segundos))) }}>
                  <span style={{ color: j.azul ? '#fff' : 'transparent', fontSize: '6.5px', fontWeight: '800' }}>{typeof j.azul === 'string' ? j.azul : j.azul ? '✓' : '·'}</span>
                </td>
                <td title={j.roja ? 'Doble click para quitar' : 'Doble click para marcar con el tiempo del cronómetro'}
                  style={{ ...cell, background: j.roja ? '#dd2211' : 'transparent', cursor: 'pointer' }}
                  onDoubleClick={() => { if (j.roja) updateJugador(equipo, idx, 'roja', false); else intentarAccionConArquero(equipo, () => updateJugador(equipo, idx, 'roja', formatTiempo(segundos))) }}>
                  <span style={{ color: j.roja ? '#fff' : 'transparent', fontSize: '6.5px', fontWeight: '800' }}>{typeof j.roja === 'string' ? j.roja : j.roja ? '✓' : '·'}</span>
                </td>
                <td style={{ ...cell, color: '#111', fontWeight: '700' }}>{g1||''}</td>
                <td style={{ ...cell, color: '#111', fontWeight: '700' }}>{g2||''}</td>
                <td style={{ ...cell, background: (g1+g2) ? '#eaff00' : 'transparent', color: '#111', fontWeight: '900' }}>{(g1+g2)||''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  function ParteInferior({ equipo, jugs, faltasAcum, cuerpo, setCuerpo, goles, finalistas, setFinalistas, ingresos, setIngresos, colorEquipo }) {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', width: '100%', borderTop: B }}>
          <div style={{ flex: '0 0 50%', borderRight: B }}>
            <div style={{ background: '#ddd', borderBottom: B, padding: '2px 4px', fontWeight: '700', fontSize: '9px', textAlign: 'center', color: '#111' }}>FALTAS ACUMULATIVAS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ ...cell, border: 'none', borderRight: B, fontWeight: '700', color: '#111', fontSize: '8px', background: '#eef', width: '24px' }}>1°P.</td>
                  {[0,1,2,3,4].map(i => <SlotFalta key={i} equipo={equipo} per={1} i={i} faltasAcum={faltasAcum} jugs={jugs}/>)}
                  <td style={{ ...cell, border: 'none', borderLeft: B, borderRight: B, fontWeight: '700', color: '#111', fontSize: '8px', background: '#fee', width: '24px' }}>2°P.</td>
                  {[0,1,2,3,4].map(i => <SlotFalta key={i} equipo={equipo} per={2} i={i} faltasAcum={faltasAcum} jugs={jugs}/>)}
                </tr>
              </tbody>
            </table>
            <div style={{ borderTop: B, padding: '3px 6px', background: '#f9f9f9' }}>
              <span style={{ fontSize: '8px', fontWeight: '700', marginRight: '6px', color: '#111' }}>TIRO INICIAL:</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', marginRight: '8px' }}>
                <input type="radio" name={`tiro-${equipo}`} checked={tiroInicial === 'local'} onChange={() => setTiroInicial('local')} style={{ accentColor: AZUL, width: '10px', height: '10px' }}/>
                <span style={{ color: '#111', fontWeight: '600', fontSize: '8px' }}>Local</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input type="radio" name={`tiro-${equipo}`} checked={tiroInicial === 'visitante'} onChange={() => setTiroInicial('visitante')} style={{ accentColor: ROJO, width: '10px', height: '10px' }}/>
                <span style={{ color: '#111', fontWeight: '600', fontSize: '8px' }}>Visitante</span>
              </label>
            </div>
          </div>
          <div style={{ flex: '0 0 50%' }}>
            <div style={{ background: '#ddd', borderBottom: B, padding: '2px 4px', fontWeight: '700', fontSize: '9px', textAlign: 'center', color: '#111' }}>INICIALES</div>
            <div style={{ display: 'flex', borderBottom: B }}>
              {[0,1,2,3,4].map(i => (
                <SlotSeleccion key={i} equipo={equipo} i={i} valores={finalistas} setArr={setFinalistas} jugs={jugs} dropKeyPrefix="inicial" ultimaCol={i === 4}/>
              ))}
            </div>
            <div style={{ background: '#ddd', borderBottom: B, padding: '2px 4px', fontWeight: '700', fontSize: '9px', textAlign: 'center', color: '#111' }}>INGRESOS</div>
            <div style={{ display: 'flex' }}>
              {[0,1,2,3,4,5,6].map(i => (
                <SlotSeleccion key={i} equipo={equipo} i={i} valores={ingresos} setArr={setIngresos} jugs={jugs} dropKeyPrefix="ingreso" ultimaCol={i === 6}/>
              ))}
            </div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderTop: B }}>
          <colgroup>
            <col style={{ width: '16%' }}/><col style={{ width: '7%' }}/><col style={{ width: '11%' }}/>
            <col style={{ width: '5%' }}/><col style={{ width: '5%' }}/><col style={{ width: '5%' }}/>
            <col style={{ width: '13%' }}/><col style={{ width: '13%' }}/><col style={{ width: '13%' }}/><col style={{ width: '13%' }}/>
          </colgroup>
          <thead>
            <tr style={{ background: '#ddd' }}>
              <th style={{ ...cell, textAlign: 'left', fontSize: '8px', color: '#111' }}>CUERPO TÉCNICO</th>
              <th style={{ ...cell, fontSize: '7px', color: '#111' }}>C.I. N°</th>
              <th style={{ ...cell, fontSize: '7px', color: '#111' }}>FIRMA</th>
              <th style={{ ...cell, fontSize: '7px', background: '#ffcc00', color: '#111' }}>AM</th>
              <th style={{ ...cell, fontSize: '7px', background: '#aaddff', color: '#111' }}>AZ</th>
              <th style={{ ...cell, fontSize: '7px', background: '#ffaaaa', color: '#111' }}>RJ</th>
              <th colSpan={4} style={{ ...cell, fontWeight: '700', fontSize: '8px', background: colorEquipo || '#1a3a8a', color: '#fff' }}>GOLES AUTOR, MINUTO</th>
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3,4].map(rowIdx => {
              const m = cuerpo[rowIdx], cfk = `cuerpo-${equipo}-${rowIdx}`
              return (
                <tr key={rowIdx} style={{ height: '22px' }}>
                  <td style={cellL}>
                    <span style={{ color: '#111', fontWeight: '700', fontSize: '7px' }}>{m.rol} </span>
                    <input value={m.nombre} onChange={e => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,nombre:e.target.value}:mm))} onDoubleClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,nombre:''}:mm))} style={{ ...inpL, fontSize: '8px', color: '#111' }} placeholder="Nombre..."/>
                  </td>
                  <td style={cell}><input value={m.ci} onChange={e => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,ci:e.target.value}:mm))} onDoubleClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,ci:''}:mm))} style={{ ...inp, color: '#111' }} placeholder="C.I."/></td>
                  <td style={{ ...cell, padding: '1px' }}>
                    <FirmaSlot label={m.rol} firma={m.firma} onFirmar={() => setFirmaModal(cfk)}/>
                    {firmaModal === cfk && <FirmaCanvas titulo={m.rol} onSave={img => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,firma:img}:mm))} onClose={() => setFirmaModal(null)}/>}
                  </td>
                  <td title="Doble click para marcar/quitar" style={{ ...cell, background: m.amarilla?'#ffcc00':'transparent', cursor:'pointer' }} onDoubleClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,amarilla:!mm.amarilla}:mm))}><span style={{ color: m.amarilla?'#111':'transparent' }}>✓</span></td>
                  <td title="Doble click para marcar/quitar" style={{ ...cell, background: m.azul?'#4488ff':'transparent', cursor:'pointer' }} onDoubleClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,azul:!mm.azul}:mm))}><span style={{ color: m.azul?'#fff':'transparent' }}>✓</span></td>
                  <td title="Doble click para marcar/quitar" style={{ ...cell, background: m.roja?'#dd2211':'transparent', cursor:'pointer' }} onDoubleClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,roja:!mm.roja}:mm))}><span style={{ color: m.roja?'#fff':'transparent' }}>✓</span></td>
                  {[0,1,2,3].map(ci => <SlotGol key={ci} equipo={equipo} slotIdx={rowIdx*4+ci} goles={goles} jugs={jugs} colorEquipo={colorEquipo}/>)}
                </tr>
              )
            })}
            <tr style={{ height: '20px' }}>
              <td colSpan={6} style={cell}></td>
              {[20,21,22,23].map(si => <SlotGol key={si} equipo={equipo} slotIdx={si} goles={goles} jugs={jugs} colorEquipo={colorEquipo}/>)}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '32px 48px', textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124' }}>Cargando planilla...</div>
      </div>
    </div>
  )

  const suggestFiltro1 = arbitrosTorneo.filter(a => a.toLowerCase().includes(arbitroInput1.toLowerCase()) && a !== arbitroInput1)
  const suggestFiltro2 = arbitrosTorneo.filter(a => a.toLowerCase().includes(arbitroInput2.toLowerCase()) && a !== arbitroInput2)

  return (
    <>
      <style>{`
        @media print { body * { visibility: hidden; } #planilla-print, #planilla-print * { visibility: visible; } #planilla-print { position: fixed; left: 0; top: 0; width: 100%; zoom: 0.68; } .no-print { display: none !important; } }
        @keyframes parpadeo { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      {firmaModal && firmaModal.startsWith('principal-') && (
        <FirmaCanvas titulo={firmaModal.replace('principal-', '')} onSave={img => setFirmas(prev => ({ ...prev, [firmaModal.replace('principal-', '')]: img }))} onClose={() => setFirmaModal(null)}/>
      )}

      {showMVP && (
        <ModalMVP jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante} partido={partido} mvpGuardado={mvpId} onGuardar={handleGuardarMVP} onSaltear={() => setShowMVP(false)}/>
      )}

      {showEspecial && (
        <ModalEspecial tipo={showEspecial} partido={partido} onConfirmar={handleConfirmarEspecial} onCancelar={() => setShowEspecial(null)}/>
      )}

      {/* Aviso: faltan firmas de los árbitros para poder cerrar/guardar */}
      {avisoFirmas && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>✍</div>
            <div style={{ fontWeight: '800', color: '#d93025', fontSize: '1rem', marginBottom: '8px' }}>⛔ NO SE PUEDE GUARDAR</div>
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '10px' }}>
              Falta <b>obligatoriamente</b> la firma de los árbitros que pitaron el partido. La planilla no se puede guardar sin ella.
            </div>
            <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px' }}>
              <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#d93025', marginBottom: '4px' }}>FALTA LA FIRMA DE:</div>
              {avisoFirmas.map((n, i) => (
                <div key={i} style={{ fontSize: '.9rem', fontWeight: '700', color: '#202124' }}>🧑‍⚖️ {n}</div>
              ))}
            </div>
            <button onClick={() => setAvisoFirmas(null)}
              style={{ width: '100%', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '700' }}>
              Ir a firmar
            </button>
          </div>
        </div>
      )}

      {/* Aviso: jugador completó sus faltas personales */}
      {avisoAcumulado && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)', border: '3px solid #d93025' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🚨</div>
            <div style={{ fontWeight: '900', color: '#d93025', fontSize: '1.05rem', marginBottom: '8px', letterSpacing: '.03em' }}>JUGADOR ACUMULADO</div>
            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#202124', marginBottom: '6px' }}>
              #{avisoAcumulado.numero} · {avisoAcumulado.nombre}
            </div>
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '18px' }}>
              Completó sus <b>5 faltas personales</b>.
            </div>
            <button onClick={() => setAvisoAcumulado(null)}
              style={{ width: '100%', padding: '12px', background: '#d93025', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '700' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Aviso: intentaron llenar una casilla del 1er tiempo estando en el 2do */}
      {avisoPeriodo && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '26px', width: '100%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🔒</div>
            <div style={{ fontWeight: '800', color: '#d93025', fontSize: '1rem', marginBottom: '8px' }}>Estás en el 2do tiempo</div>
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '18px' }}>
              Las casillas del <b>1er tiempo</b> quedaron bloqueadas. Tienes que llenar las del <b>2do tiempo</b>.
            </div>
            <button onClick={() => setAvisoPeriodo(false)}
              style={{ width: '100%', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '700' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* INFORME DEL PARTIDO — obligatorio con roja o partido terminado antes */}
      {showInforme && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9800, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 18px 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>📝</div>
              <div style={{ fontWeight: '900', color: '#202124', fontSize: '1.15rem' }}>Informe del partido</div>
              <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '4px' }}>{partido.home?.name} vs {partido.away?.name}</div>
              {showInforme.motivo !== 'otro' && (
                <div style={{ marginTop: '10px', background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: '10px', padding: '10px 14px', fontSize: '.8rem', color: '#d93025', fontWeight: '700' }}>
                  {showInforme.motivo === 'roja' ? '🟥 Hay tarjeta roja: el informe es OBLIGATORIO para poder guardar.' : '⏱️ El partido no se completó: el informe es OBLIGATORIO para poder guardar.'}
                </div>
              )}
            </div>

            <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#5f6368', marginBottom: '6px' }}>Motivo</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {[{ id: 'roja', t: '🟥 Tarjeta roja' }, { id: 'terminado_antes', t: '⏱️ Terminado antes de tiempo' }, { id: 'otro', t: '📝 Otro' }].map(op => (
                <button key={op.id} onClick={() => setInformeTipo(op.id)}
                  style={{ padding: '9px 14px', borderRadius: '20px', border: `2px solid ${informeTipo === op.id ? '#1a73e8' : '#dadce0'}`, background: informeTipo === op.id ? '#e8f0fe' : '#fff', color: informeTipo === op.id ? '#1a73e8' : '#5f6368', fontSize: '.82rem', fontWeight: '700', cursor: 'pointer' }}>
                  {op.t}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '.78rem', fontWeight: '700', color: '#5f6368' }}>¿Qué pasó? (escribe o dicta)</div>
              <button onClick={toggleDictado}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: dictando ? '#d93025' : '#1a73e8', color: '#fff', fontWeight: '800', fontSize: '.82rem', animation: dictando ? 'parpadeo 1s infinite' : 'none' }}>
                {dictando ? '⏹ Parar dictado' : '🎤 Hablar'}
              </button>
            </div>
            <textarea value={informeTexto} onChange={e => setInformeTexto(e.target.value)}
              placeholder={'Ej: Al minuto 12 del segundo tiempo el jugador #7 recibió tarjeta roja por...\n\nToca 🎤 Hablar y dicta el informe con tu voz.'}
              style={{ width: '100%', minHeight: '180px', border: '2px solid #dadce0', borderRadius: '12px', padding: '14px', fontSize: '1rem', lineHeight: 1.5, color: '#202124', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}/>
            {dictando && <div style={{ fontSize: '.75rem', color: '#d93025', fontWeight: '700', marginTop: '6px' }}>🎙️ Escuchando... habla claro y cerca del celular. Lo que digas se va escribiendo arriba.</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button onClick={guardarInforme} disabled={guardandoInforme}
                style={{ padding: '14px', background: guardandoInforme ? '#dadce0' : '#1e8e3e', border: 'none', borderRadius: '12px', cursor: guardandoInforme ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '800', fontSize: '1rem' }}>
                {guardandoInforme ? 'Guardando...' : '✓ Guardar informe y continuar'}
              </button>
              <button onClick={() => { try { recVozRef.current?.stop() } catch(e) {}; setDictando(false); setShowInforme(null) }}
                style={{ padding: '11px', background: 'none', border: '1px solid #dadce0', borderRadius: '12px', cursor: 'pointer', color: '#5f6368', fontSize: '.85rem', fontWeight: '600' }}>
                ← Volver a la planilla{showInforme.motivo !== 'otro' ? ' (sin el informe no se puede guardar)' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso corto: intentaron anotar algo de un equipo sin arquero marcado */}
      {avisoArqueroFaltante && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '26px', width: '100%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🧤</div>
            <div style={{ fontWeight: '800', color: '#d93025', fontSize: '1rem', marginBottom: '8px' }}>Falta marcar el arquero</div>
            <div style={{ fontSize: '.85rem', color: '#5f6368', marginBottom: '18px' }}>
              No puedes anotar datos de <b>{avisoArqueroFaltante}</b> sin marcar antes quién es su arquero titular.
            </div>
            <button onClick={() => setAvisoArqueroFaltante(null)}
              style={{ width: '100%', padding: '12px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.9rem', fontWeight: '700' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* (Antiguo popup obligatorio de arquero eliminado: ahora se marca con el guante 🧤 en la columna N°) */}
      {/* Popup obligatorio: se muestra solo mientras un equipo tenga jugadores numerados pero sin arquero asignado */}
      {false && !arqueroLocal && jugadoresLocal.some(j => j.numero) && (
        <ModalSeleccionArquero nombreEquipo={partido.home?.name} jugadores={jugadoresLocal} onSeleccionar={j => seleccionarArquero('local', j)}/>
      )}
      {false && arqueroLocal && !arqueroVis && jugadoresVisitante.some(j => j.numero) && (
        <ModalSeleccionArquero nombreEquipo={partido.away?.name} jugadores={jugadoresVisitante} onSeleccionar={j => seleccionarArquero('visitante', j)}/>
      )}

      {/* Botón flotante rojo: SOLO cierra la planilla (con la misma confirmación
          de cambios sin guardar que el botón "✕ Cerrar" de la barra superior).
          NO guarda — para guardar está el botón verde "💾 Guardar resultado". */}
      <button onClick={handleCerrar} className="no-print"
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998, width: '52px', height: '52px', borderRadius: '50%', background: '#d93025', border: '3px solid #fff', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
        <X size={22}/>
      </button>

      {/* CRONÓMETRO */}
      <div onMouseDown={onDragStart} onTouchStart={onDragStart}
        style={{ position: 'fixed', left: cronoPos.x, top: cronoPos.y, zIndex: 9999, background: cronoBg, borderRadius: miniCrono?'50px':'20px', boxShadow: '0 8px 32px rgba(0,0,0,.5)', minWidth: miniCrono?'150px':'310px', userSelect: 'none', touchAction: 'none', cursor: 'grab' }}>
        <div style={{ padding: miniCrono?'8px 12px':'10px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Move size={miniCrono?12:14} color="rgba(255,255,255,.6)"/>
            {!miniCrono && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.9)', fontWeight: '600' }}>{tiempoAgotado ? '⏰ TIEMPO AGOTADO' : periodo===1 ? '1ER PERIODO' : '2DO PERIODO'}{torneo?.modalidad && ` · ${torneo.modalidad}`}</span>}
          </div>
          <button onClick={() => setMiniCrono(!miniCrono)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.8)', display: 'flex' }}>{miniCrono?<Maximize2 size={12}/>:<Minimize2 size={12}/>}</button>
        </div>
        {!miniCrono && <div style={{ margin: '0 16px 4px', height: '4px', background: 'rgba(255,255,255,.2)', borderRadius: '2px' }}><div style={{ height: '100%', width: `${progreso * 100}%`, background: tiempoAgotado ? '#ff5555' : '#fff', borderRadius: '2px', transition: 'width .5s' }}/></div>}
        {miniCrono ? (
          <div style={{ padding: '2px 12px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', fontFamily: 'monospace', animation: tiempoAgotado ? 'parpadeo 1s infinite' : 'none' }}>{formatTiempo(segundos)}</span>
            {alarmaActiva ? (
              <button onClick={pararAlarma} style={{ background: '#fff', border: 'none', borderRadius: '14px', padding: '4px 10px', cursor: 'pointer', color: '#b71c1c', fontWeight: '900', fontSize: '.72rem', animation: 'parpadeo 1s infinite' }}>🔕 PARAR</button>
            ) : (
              <button onClick={() => { if (!tiempoAgotado) setCorriendo(!corriendo) }} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{corriendo?<Pause size={14}/>:<Play size={14}/>}</button>
            )}
          </div>
        ) : (
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ fontSize: '4rem', fontWeight: '900', color: '#fff', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,.3)', animation: tiempoAgotado ? 'parpadeo 1s infinite' : 'none' }}>{formatTiempo(segundos)}</div>
            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              {editandoDuracion ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <input type="number" min="1" max="90" value={duracionInput} onChange={e => setDuracionInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmarDuracion(); if (e.key === 'Escape') setEditandoDuracion(false) }} autoFocus style={{ width: '50px', textAlign: 'center', fontWeight: '700', fontSize: '.9rem', borderRadius: '6px', border: 'none', padding: '3px 6px', color: '#111' }}/>
                  <span style={{ color: 'rgba(255,255,255,.8)', fontSize: '11px' }}>min/periodo</span>
                  <button onClick={confirmarDuracion} style={{ background: 'rgba(255,255,255,.9)', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: cronoBg, fontWeight: '700', fontSize: '11px' }}>✓</button>
                  <button onClick={() => setEditandoDuracion(false)} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: '#fff', fontSize: '11px' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.7)' }}>{duracionMinutos} min/periodo</span>
                  <button onClick={() => { setDuracionInput(String(duracionMinutos)); setEditandoDuracion(true) }} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '6px', padding: '2px 7px', cursor: 'pointer', color: 'rgba(255,255,255,.85)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}><Edit2 size={9}/> Cambiar</button>
                </div>
              )}
            </div>
            {tiempoAgotado ? (
              <div style={{ marginTop: '10px' }}>
                <div style={{ textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: '.85rem', marginBottom: '8px' }}>⏰ Fin del {periodo===1 ? '1er' : '2do'} periodo</div>
                {alarmaActiva && (
                  <button onClick={pararAlarma} style={{ width: '100%', marginBottom: '8px', padding: '12px', background: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#b71c1c', fontSize: '1rem', fontWeight: '900', animation: 'parpadeo 1s infinite', letterSpacing: '.05em' }}>
                    🔕 PARAR ALARMA
                  </button>
                )}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[1,2,3,5].map(m => <button key={m} onClick={() => agregarTiempoExtra(m)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,.25)', border: '1px solid rgba(255,255,255,.4)', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '600' }}>+{m} min</button>)}
                </div>
                {periodo === 1 && <button onClick={iniciarPeriodo2} style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,.4)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>→ Iniciar 2do Periodo</button>}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'center' }}>
                  <button onClick={() => setCorriendo(!corriendo)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 18px', background: corriendo?'rgba(255,255,255,.25)':'rgba(255,255,255,.9)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: corriendo?'#fff':cronoBg, fontSize: '.85rem', fontWeight: '700' }}>
                    {corriendo?<><Pause size={16}/> Pausar</>:<><Play size={16}/> {segundos>0?'Continuar':'Iniciar'}</>}
                  </button>
                  <button onClick={() => { pararAlarma(); setCorriendo(false); setSegundos(0); setTiempoAgotado(false); setTiempoExtra(0) }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.8rem' }}><RotateCcw size={14}/> Reset</button>
                </div>
                <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '9px', color: 'rgba(255,255,255,.7)' }}>Restante: {formatTiempo(Math.max(0, limiteSegundos - segundos))}{tiempoExtra > 0 && <span style={{ color: '#ffdd44' }}> (+{tiempoExtra}' extra)</span>}</div>
                {periodo===1 && <button onClick={iniciarPeriodo2} style={{ width: '100%', marginTop: '8px', padding: '7px', background: 'rgba(0,0,0,.3)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '700' }}>→ Saltar a 2do Periodo</button>}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{golesLocalTotal} — {golesVisTotal}</div>
            <div style={{ textAlign: 'center', fontSize: '9px', color: 'rgba(255,255,255,.7)' }}>{partido.home?.name} vs {partido.away?.name}</div>
          </div>
        )}
      </div>

      {/* Pantalla completa: sin overlay oscuro, sin márgenes ni bordes redondeados,
          para que no se alcance a ver ni un pedacito del menú/cabezote de la página
          de atrás — la planilla tapa TODO el viewport de borde a borde. */}
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
        <div style={{ background: '#fff', width: '100%', maxWidth: '980px', minHeight: '100%' }}>

          {/* Barra superior */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e8eaed', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>📋 {partido.home?.name} vs {partido.away?.name}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isOnline && <span style={{ fontSize: '.75rem', color: '#e8710a', background: '#fff3e0', borderRadius: '6px', padding: '4px 10px', fontWeight: '500', border: '1px solid #ffe0b2' }}>📵 Sin internet</span>}
              {isOnline && hayDatosLocales && <span style={{ fontSize: '.75rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '6px', padding: '4px 10px', fontWeight: '500', border: '1px solid #ceead6' }}>🔄 Datos locales</span>}
              {mvpId && <span style={{ fontSize: '.75rem', color: '#e8710a', background: '#fff8e1', borderRadius: '6px', padding: '4px 10px', fontWeight: '600', border: '1px solid #ffe082' }}>⭐ MVP: {[...jugadoresLocal, ...jugadoresVisitante].find(j => j.id === mvpId)?.nombre || '...'}</span>}
              <button onClick={handleCerrar}
                style={{ padding:'6px 12px', background:'none', border:'1px solid #dadce0', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.8rem', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px' }}>
                ✕ Cerrar
              </button>
              <button onClick={() => { if (!informeTipo) setInformeTipo('otro'); setShowInforme({ motivo: 'otro' }) }} style={{ padding: '6px 12px', background: informeGuardado ? '#1e8e3e' : '#7b1fa2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700' }}>{informeGuardado ? '✓ Informe' : '📝 Informe'}</button>
              <button onClick={() => setShowEspecial('w')} style={{ padding: '6px 12px', background: '#e8710a', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700' }}>🏆 Por W</button>
              <button onClick={() => setShowEspecial('desierto')} style={{ padding: '6px 12px', background: '#5f6368', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700' }}>❌ Desierto</button>
              <button onClick={handleClickGuardar} disabled={guardandoDB || !isOnline}
                style={{ padding: '6px 14px', background: guardandoDB || !isOnline ? '#9aa0a6' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoDB || !isOnline ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                {guardandoDB ? 'Guardando...' : !isOnline ? '📵 Sin internet' : '💾 Guardar resultado'}
              </button>
              <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}><Printer size={13}/> Imprimir</button>
            </div>
          </div>

          {/* Aviso: esta planilla ya estaba cerrada y fue reeditada — queda quién y cuándo */}
          {partido.status === 'finished' && logEdicion.length > 0 && (
            <div className="no-print" style={{ padding: '10px 16px', background: '#fce8e6', borderBottom: '1px solid #fad2cf' }}>
              <div style={{ fontSize: '.75rem', fontWeight: '700', color: '#d93025', marginBottom: '4px' }}>⚠️ Planilla cerrada editada después del cierre:</div>
              {logEdicion.map(l => (
                <div key={l.id} style={{ fontSize: '.72rem', color: '#8c1d18' }}>
                  {l.editor_name} · {new Date(l.edited_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})} {new Date(l.edited_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}
                </div>
              ))}
            </div>
          )}

          {/* Estado del arquero obligatorio — se marca tocando el nombre en la tabla de cada equipo */}
          <div className="no-print" style={{ padding: '10px 16px', background: '#fffde7', borderBottom: '1px solid #ffe082', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.78rem', fontWeight: '700', color: '#f57f17' }}>🧤 Arquero obligatorio:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '.72rem', color: '#5f6368', fontWeight: '600' }}>{partido.home?.name}:</span>
              {arqueroLocal
                ? <span style={{ fontSize: '.75rem', color: '#1e8e3e', fontWeight: '700' }}>✓ #{arqueroLocal.numero} {arqueroLocal.name}</span>
                : <span style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '700' }}>⚠️ Sin marcar — toca el nombre en la tabla</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '.72rem', color: '#5f6368', fontWeight: '600' }}>{partido.away?.name}:</span>
              {arqueroVis
                ? <span style={{ fontSize: '.75rem', color: '#1e8e3e', fontWeight: '700' }}>✓ #{arqueroVis.numero} {arqueroVis.name}</span>
                : <span style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '700' }}>⚠️ Sin marcar — toca el nombre en la tabla</span>}
            </div>
            {(!arqueroLocal || !arqueroVis) && (
              <span style={{ fontSize: '.7rem', color: '#d93025', fontWeight: '600' }}>No se pueden anotar goles, faltas ni tarjetas del equipo sin arquero marcado</span>
            )}
          </div>

          {/* Penales */}
          <div className="no-print" style={{ padding: '8px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>
              <input type="checkbox" checked={hubopenales} onChange={e => setHuboPenales(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: '#1a73e8' }}/>
              ⚽ Hubo penales
            </label>
            {hubopenales && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{partido.home?.name}:</span>
                  <input type="number" min="0" value={penalesLocal} onChange={e => setPenalesLocal(e.target.value)} style={{ width: '40px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', padding: '3px 6px', fontSize: '.85rem', fontWeight: '700' }}/>
                </div>
                <span style={{ fontWeight: '700', color: '#5f6368' }}>—</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '.75rem', color: '#5f6368' }}>{partido.away?.name}:</span>
                  <input type="number" min="0" value={penalesVisitante} onChange={e => setPenalesVisitante(e.target.value)} style={{ width: '40px', textAlign: 'center', border: '1px solid #dadce0', borderRadius: '6px', padding: '3px 6px', fontSize: '.85rem', fontWeight: '700' }}/>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', color: '#5f6368' }}>Ganador:</span>
                  <button onClick={() => setPenalesGanador('local')} style={{ padding: '4px 10px', border: `2px solid ${penalesGanador === 'local' ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px', cursor: 'pointer', background: penalesGanador === 'local' ? '#e6f4ea' : '#fff', color: penalesGanador === 'local' ? '#1e8e3e' : '#5f6368', fontSize: '.75rem', fontWeight: penalesGanador === 'local' ? '700' : '400' }}>{partido.home?.name}</button>
                  <button onClick={() => setPenalesGanador('visitante')} style={{ padding: '4px 10px', border: `2px solid ${penalesGanador === 'visitante' ? '#1e8e3e' : '#dadce0'}`, borderRadius: '6px', cursor: 'pointer', background: penalesGanador === 'visitante' ? '#e6f4ea' : '#fff', color: penalesGanador === 'visitante' ? '#1e8e3e' : '#5f6368', fontSize: '.75rem', fontWeight: penalesGanador === 'visitante' ? '700' : '400' }}>{partido.away?.name}</button>
                </div>
              </>
            )}
            <div style={{ marginLeft: 'auto', fontSize: '.7rem', color: '#9aa0a6' }}>💡 <b>Doble click</b> para borrar · Goles/faltas: doble click en el último para eliminar</div>
          </div>

          <div id="planilla-print" style={{ padding: '10px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '4px', borderBottom: '2px solid #000', paddingBottom: '3px' }}>
              <div style={{ fontWeight: '900', fontSize: '12px', letterSpacing: '2px', color: '#111' }}>GOLMEBOL</div>
              <div style={{ fontWeight: '700', fontSize: '9px', color: '#111' }}>PLANILLA OFICIAL DE REGISTRO DE JUEGO</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '3px' }}>
              <tbody>
                <tr>
                  <td style={cellL}><b>CAMPEONATO:</b> {torneo?.name||''}</td>
                  <td style={cellL}><b>CATEGORÍA:</b> {torneo?.categoria||''}</td>
                  <td style={cellL}><b>ETAPA:</b> {etapaNombre}</td>
                </tr>
                <tr>
                  <td style={cellL}><b>CIUDAD:</b> {torneo?.city||''}</td>
                  <td style={cellL}><b>FECHA:</b> {fecha}</td>
                  <td style={cellL}><b>CANCHA:</b> {partido.location||''}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={cell}>
                    <b>1°P</b> H.I.:<input value={horaInicio1} onChange={e=>setHoraInicio1(e.target.value)} style={{...inp,width:'34px',display:'inline',borderBottom:'1px solid #000'}}/> H.F.:<input value={horaFin1} onChange={e=>setHoraFin1(e.target.value)} style={{...inp,width:'34px',display:'inline',borderBottom:'1px solid #000'}}/>
                    &nbsp;<b>2°P</b> H.I.:<input value={horaInicio2} onChange={e=>setHoraInicio2(e.target.value)} style={{...inp,width:'34px',display:'inline',borderBottom:'1px solid #000'}}/> H.F.:<input value={horaFin2} onChange={e=>setHoraFin2(e.target.value)} style={{...inp,width:'34px',display:'inline',borderBottom:'1px solid #000'}}/>
                    &nbsp;<b>HORA:</b> {hora}&nbsp;<b>TIRO INICIAL:</b> <span style={{ fontWeight:'700',color:'#111' }}>{tiroInicial==='local'?partido.home?.name:tiroInicial==='visitante'?partido.away?.name:'—'}</span>
                    {hubopenales && penalesGanador && <>&nbsp;<b>PENALES:</b> <span style={{ fontWeight:'700',color:'#1a73e8' }}>{partido.home?.name} {penalesLocal} — {penalesVisitante} {partido.away?.name} · 🏆 {penalesGanador==='local'?partido.home?.name:partido.away?.name}</span></>}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* EQUIPO LOCAL */}
            <div style={{ border: '2px solid #000', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 5px', alignItems: 'center', borderBottom: B, background: colorLocal + '30' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: '900', fontSize: '10px', color: '#111' }}>EQUIPO LOCAL: {partido.home?.name?.toUpperCase()}</div>
                  <label className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '7px', color: '#555' }}>
                    <span>Uniforme:</span>
                    <input type="color" value={colorLocal} onChange={e => setColorLocal(e.target.value)} style={{ width: '22px', height: '14px', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer', padding: '0' }}/>
                  </label>
                </div>
                <div style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#111', position: 'relative' }} onClick={e => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'capitan-local' ? null : 'capitan-local') }}>
                    <b>CAPITÁN N°:</b> <span style={{ display: 'inline-block', minWidth: '24px', borderBottom: '1px solid #000', fontWeight: '900', cursor: 'pointer', textAlign: 'center', background: capitanes.local ? '#e6f4ea' : '#fff3cd' }}>{capitanes.local ? `#${capitanes.local}` : '+'}</span>
                    <DropdownCamisetas jugs={jugadoresLocal} dropKey="capitan-local" equipo="local" onSelect={n => { setCapitanes(prev => ({ ...prev, local: n })); setDropdownOpen(null) }}/>
                  </span>
                  <span style={{ color: '#111' }}><b>FIRMA:</b></span>
                  <FirmaSlot label="Capitán Local" firma={firmas.capitanLocal} onFirmar={() => setFirmaModal('principal-capitanLocal')}/>
                </div>
              </div>
              {/* Se invocan como función normal (no como <Componente/>) porque están
                  definidas dentro de este mismo componente y se recrean en cada
                  render (cada segundo, por el cronómetro). Usarlas como JSX hacía
                  que React las desmontara y remontara cada segundo, perdiendo el
                  foco justo cuando alguien estaba escribiendo un número de camiseta
                  o un nombre — por eso "no dejaba escribir" con el cronómetro corriendo. */}
              {TablaJugadores({ jugs: jugadoresLocal, equipo: 'local', goles: golesLocal, colorEquipo: colorLocal })}
              {ParteInferior({ equipo: 'local', jugs: jugadoresLocal, faltasAcum: faltasAcumLocal, cuerpo: cuerpoLocal, setCuerpo: setCuerpoLocal, goles: golesLocal, finalistas: finalistasLocal, setFinalistas: setFinalistasLocal, ingresos: ingresosLocal, setIngresos: setIngresosLocal, colorEquipo: colorLocal })}
            </div>

            {/* EQUIPO VISITANTE */}
            <div style={{ border: '2px solid #000', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 5px', alignItems: 'center', borderBottom: B, background: colorVisitante + '30' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: '900', fontSize: '10px', color: '#111' }}>EQUIPO VISITANTE: {partido.away?.name?.toUpperCase()}</div>
                  <label className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '7px', color: '#555' }}>
                    <span>Uniforme:</span>
                    <input type="color" value={colorVisitante} onChange={e => setColorVisitante(e.target.value)} style={{ width: '22px', height: '14px', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer', padding: '0' }}/>
                  </label>
                </div>
                <div style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#111', position: 'relative' }} onClick={e => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'capitan-visitante' ? null : 'capitan-visitante') }}>
                    <b>CAPITÁN N°:</b> <span style={{ display: 'inline-block', minWidth: '24px', borderBottom: '1px solid #000', fontWeight: '900', cursor: 'pointer', textAlign: 'center', background: capitanes.visitante ? '#e6f4ea' : '#fff3cd' }}>{capitanes.visitante ? `#${capitanes.visitante}` : '+'}</span>
                    <DropdownCamisetas jugs={jugadoresVisitante} dropKey="capitan-visitante" equipo="visitante" onSelect={n => { setCapitanes(prev => ({ ...prev, visitante: n })); setDropdownOpen(null) }}/>
                  </span>
                  <span style={{ color: '#111' }}><b>FIRMA:</b></span>
                  <FirmaSlot label="Capitán Visitante" firma={firmas.capitanVisitante} onFirmar={() => setFirmaModal('principal-capitanVisitante')}/>
                </div>
              </div>
              {TablaJugadores({ jugs: jugadoresVisitante, equipo: 'visitante', goles: golesVisitante, colorEquipo: colorVisitante })}
              {ParteInferior({ equipo: 'visitante', jugs: jugadoresVisitante, faltasAcum: faltasAcumVis, cuerpo: cuerpoVis, setCuerpo: setCuerpoVis, goles: golesVisitante, finalistas: finalistasVis, setFinalistas: setFinalistasVis, ingresos: ingresosVis, setIngresos: setIngresosVis, colorEquipo: colorVisitante })}
            </div>

            {/* ÁRBITROS Y RESULTADO */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellL, width: '30%', position: 'relative' }}>
                    <b>ÁRBITRO 1:</b>
                    <select value={arbitro1} onChange={e => { setArbitro1(e.target.value); setArbitroInput1(e.target.value) }} style={{ ...inpL, width:'140px', display:'inline', borderBottom:'1px solid #000', marginLeft:'3px', background:'transparent' }}>
                          <option value="">-- Seleccionar --</option>
                          {arbitrosReg.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                          <option value="__otro__">Otro (escribir)</option>
                        </select>
                        {(arbitro1 === '__otro__' || (arbitro1 && !arbitrosReg.find(a => a.name === arbitro1))) && (
                          <input value={arbitroInput1} onChange={e => { setArbitroInput1(e.target.value); setArbitro1(e.target.value) }} placeholder="Nombre árbitro..." style={{ ...inpL, width:'120px', display:'inline', borderBottom:'1px solid #000', marginLeft:'3px' }}/>
                        )}
                    {showSuggest1 && suggestFiltro1.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.15)', minWidth: '180px', maxHeight: '120px', overflowY: 'auto' }}>
                        {suggestFiltro1.map((a, i) => <div key={i} onClick={() => { setArbitroInput1(a); setArbitro1(a); setShowSuggest1(false) }} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px', borderBottom: '1px solid #f1f3f4' }} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>{a}</div>)}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'3px' }}>
                      <span style={{ fontSize:'8px', color:'#111' }}>FIRMA:</span>
                      <FirmaSlot label="Árbitro 1" firma={firmas.arbitro1} onFirmar={() => setFirmaModal('principal-arbitro1')}/>
                    </div>
                  </td>
                  <td style={{ ...cellL, width: '30%', position: 'relative' }}>
                    <b>ÁRBITRO 2:</b>
                    <select value={arbitro2} onChange={e => { setArbitro2(e.target.value); setArbitroInput2(e.target.value) }} style={{ ...inpL, width:'140px', display:'inline', borderBottom:'1px solid #000', marginLeft:'3px', background:'transparent' }}>
                          <option value="">-- Seleccionar --</option>
                          {arbitrosReg.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                          <option value="__otro__">Otro (escribir)</option>
                        </select>
                        {(arbitro2 === '__otro__' || (arbitro2 && !arbitrosReg.find(a => a.name === arbitro2))) && (
                          <input value={arbitroInput2} onChange={e => { setArbitroInput2(e.target.value); setArbitro2(e.target.value) }} placeholder="Nombre árbitro..." style={{ ...inpL, width:'120px', display:'inline', borderBottom:'1px solid #000', marginLeft:'3px' }}/>
                        )}
                    {showSuggest2 && suggestFiltro2.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,.15)', minWidth: '180px', maxHeight: '120px', overflowY: 'auto' }}>
                        {suggestFiltro2.map((a, i) => <div key={i} onClick={() => { setArbitroInput2(a); setArbitro2(a); setShowSuggest2(false) }} style={{ padding: '5px 10px', cursor: 'pointer', fontSize: '9px', borderBottom: '1px solid #f1f3f4' }} onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>{a}</div>)}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'3px' }}>
                      <span style={{ fontSize:'8px', color:'#111' }}>FIRMA:</span>
                      <FirmaSlot label="Árbitro 2" firma={firmas.arbitro2} onFirmar={() => setFirmaModal('principal-arbitro2')}/>
                    </div>
                  </td>
                  <td rowSpan={2} style={{ ...cell, textAlign:'center', background:'#f1f3f4', width:'20%' }}>
                    <div style={{ fontSize:'10px', fontWeight:'700', color:'#111' }}>RESULTADO FINAL</div>
                    <div style={{ fontSize:'26px', fontWeight:'900' }}>
                      <span style={{ color:colorLocal }}>{golesLocalTotal}</span>
                      <span style={{ color:'#9aa0a6', margin:'0 4px' }}>—</span>
                      <span style={{ color:colorVisitante }}>{golesVisTotal}</span>
                    </div>
                    {hubopenales && penalesGanador && <div style={{ fontSize:'8px', color:'#1a73e8', fontWeight:'700' }}>Penales: {penalesLocal} — {penalesVisitante}<br/>🏆 {penalesGanador==='local'?partido.home?.name:partido.away?.name}</div>}
                    <div style={{ fontSize:'8px', color:'#5f6368' }}>{partido.home?.name} vs {partido.away?.name}</div>
                    {mvpId && <div style={{ marginTop:'4px', fontSize:'8px', color:'#e8710a', fontWeight:'700' }}>⭐ MVP: {[...jugadoresLocal, ...jugadoresVisitante].find(j => j.id === mvpId)?.nombre || ''}</div>}
                  </td>
                </tr>
                <tr>
                  <td style={cellL}>
                    <b>ANOTADOR:</b>
                    <select value={arbitrosReg.find(a=>a.name===anotador)?.id||'__texto__'} onChange={e=>{
                      if(e.target.value==='__texto__') return
                      if(e.target.value==='__libre__') { setAnotador(''); return }
                      const arb=arbitrosReg.find(a=>a.id===e.target.value); if(arb) setAnotador(arb.name)
                    }} style={{...inpL,width:'90px',display:'inline',borderBottom:'1px solid #000',background:'transparent'}}>
                      <option value="__texto__">{anotador||'Seleccionar...'}</option>
                      <option value="__libre__">✏️ Escribir nombre</option>
                      {arbitrosReg.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    {(!anotador||!arbitrosReg.find(a=>a.name===anotador))&&<input value={anotador} onChange={e=>setAnotador(e.target.value)} style={{...inpL,width:'80px',display:'inline',borderBottom:'1px solid #000',marginLeft:'2px'}} placeholder="Nombre..."/>}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'3px' }}>
                      <span style={{ fontSize:'8px', color:'#111' }}>FIRMA:</span>
                      <FirmaSlot label="Anonotador" firma={firmas.anotador} onFirmar={() => setFirmaModal('principal-anotador')}/>
                    </div>
                  </td>
                  <td style={cellL}>
                    <b>CRONÓMETRO:</b> <input value={cronometroNombre} onChange={e=>setCronometroNombre(e.target.value)} style={{...inpL,width:'80px',display:'inline',borderBottom:'1px solid #000'}}/><br/>
                    <b>OBS:</b> <input value={observaciones} onChange={e=>setObservaciones(e.target.value)} style={{...inpL,borderBottom:'1px solid #000'}}/>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign:'right', fontSize:'7px', color:'#9aa0a6', marginTop:'3px' }}>GOLMEBOL — {new Date().toLocaleDateString('es-CO')}</div>
          </div>
        </div>
      </div>
    </>
  )
}
