import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { X, Printer, Play, Pause, RotateCcw, Minimize2, Maximize2, Move, Edit2 } from 'lucide-react'

const AZUL = '#1a3a8a'
const ROJO = '#d93025'

function FirmaCanvas({ titulo, onSave, onClose }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  useEffect(() => {
    const c = canvasRef.current, ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  }, [])
  function getPos(e, c) {
    const r = c.getBoundingClientRect()
    if (e.touches) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function start(e) { e.preventDefault(); drawing.current = true; const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  function draw(e) { e.preventDefault(); if (!drawing.current) return; const c = canvasRef.current, ctx = c.getContext('2d'), p = getPos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke() }
  function stop(e) { e.preventDefault(); drawing.current = false }
  function limpiar() { const c = canvasRef.current, ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) }
  function guardar() { onSave(canvasRef.current.toDataURL('image/png')); onClose() }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: '600', color: '#202124', marginBottom: '12px', textAlign: 'center', fontSize: '.9rem' }}>✍ Firma: {titulo}</div>
        <canvas ref={canvasRef} width={320} height={120} style={{ border: '2px solid #dadce0', borderRadius: '8px', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}/>
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
  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) ref.current.value = String(value ?? '')
  }, [value])
  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    e.target.value = val
    if (val.length === 2 || val.length === 0) onChange(val)
  }
  function handleBlur(e) { onChange(e.target.value.replace(/\D/g, '').slice(0, 2)) }
  function handleDoubleClick() { if (ref.current) ref.current.value = ''; onChange(''); onDoubleClick() }
  const bg = !value ? '#fff3cd' : repetido ? '#ff4444' : '#111'
  const color = !value ? '#e8710a' : '#fff'
  return (
    <td style={{ border: '1px solid #000', padding: '1px', background: bg, textAlign: 'center', verticalAlign: 'middle' }}
      title={repetido ? '⚠ Número repetido' : !value ? 'Número obligatorio' : ''}>
      <input ref={ref} defaultValue={String(value ?? '')} onChange={handleChange} onBlur={handleBlur}
        onDoubleClick={handleDoubleClick} placeholder="N°" maxLength={2} inputMode="numeric"
        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '11px', fontWeight: '900', textAlign: 'center', background: 'transparent', color }}/>
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
          <button onClick={onSaltear} style={{ padding: '10px', background: 'none', border: '1px solid #dadce0', borderRadius: '10px', cursor: 'pointer', color: '#9aa0a6', fontSize: '.78rem' }}>
            Cerrar sin MVP (no recomendado)
          </button>
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
  const [sancionados,        setSancionados]        = useState({}) // player_id -> motivo
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

  const [hubopenales,      setHuboPenales]      = useState(false)
  const [penalesGanador,   setPenalesGanador]   = useState('')
  const [penalesLocal,     setPenalesLocal]     = useState('')
  const [penalesVisitante, setPenalesVisitante] = useState('')

  const [colorLocal,     setColorLocal]     = useState('#1a3a8a')
  const [colorVisitante, setColorVisitante] = useState('#d93025')
  const [periodo,          setPeriodo]          = useState(1)
  const [segundos,         setSegundos]         = useState(0)
  const [corriendo,        setCorriendo]        = useState(false)
  const [miniCrono,        setMiniCrono]        = useState(false)
  const [tiempoAgotado,    setTiempoAgotado]    = useState(false)
  const [tiempoExtra,      setTiempoExtra]      = useState(0)
  const [duracionMinutos,  setDuracionMinutos]  = useState(20)
  const [editandoDuracion, setEditandoDuracion] = useState(false)
  const [duracionInput,    setDuracionInput]    = useState('20')

  const timerRef  = useRef(null)
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

  const CUERPO_ROLES = ['TECNICO', 'A. TECNICO', 'MASAJISTA', 'MEDICO', 'P. FISICO']
  const [cuerpoLocal, setCuerpoLocal] = useState(CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
  const [cuerpoVis,   setCuerpoVis]   = useState(CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))

  const [arbitro1,         setArbitro1]         = useState('')
  const [arbitro2,         setArbitro2]         = useState('')
  const [arbitro3,         setArbitro3]         = useState('')
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

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (corriendo) {
      timerRef.current = setInterval(() => {
        setSegundos(s => {
          const next = s + 1
          if (next >= limiteSegundos && !tiempoAgotado) {
            setTiempoAgotado(true); setCorriendo(false)
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)()
              const beep = (freq, start, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur); g.gain.setValueAtTime(0.3, ctx.currentTime + start); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur) }
              beep(880, 0, 0.3); beep(880, 0.4, 0.3); beep(1100, 0.8, 0.6)
            } catch(e) {}
          }
          return next
        })
      }, 1000)
    } else clearInterval(timerRef.current)
    return () => clearInterval(timerRef.current)
  }, [corriendo, limiteSegundos, tiempoAgotado])

  useEffect(() => {
    if (loading) return
    setHayCambios(true)
    const snap = { jugadoresLocal, jugadoresVisitante, golesLocal, golesVisitante, faltasAcumLocal, faltasAcumVis, finalistasLocal, finalistasVis, ingresosLocal, ingresosVis, cuerpoLocal, cuerpoVis, arbitro1, arbitro2, arbitro3, anotador, cronometroNombre, observaciones, horaInicio1, horaFin1, horaInicio2, horaFin2, tiroInicial, colorLocal, colorVisitante, duracionMinutos, mvpId, huboPenales: hubopenales, penalesGanador, penalesLocal, penalesVisitante, savedAt: new Date().toISOString(), pendienteSync: true }
    try { localStorage.setItem(localKey, JSON.stringify(snap)) } catch(e) {}
  }, [jugadoresLocal, jugadoresVisitante, golesLocal, golesVisitante, faltasAcumLocal, faltasAcumVis, finalistasLocal, finalistasVis, ingresosLocal, ingresosVis, cuerpoLocal, cuerpoVis, arbitro1, arbitro2, anotador, cronometroNombre, observaciones, horaInicio1, horaFin1, horaInicio2, horaFin2, tiroInicial, colorLocal, colorVisitante, duracionMinutos, mvpId, hubopenales, penalesGanador, penalesLocal, penalesVisitante])

  useEffect(() => { fetchTodo() }, [])
  useEffect(() => {
    const close = () => setDropdownOpen(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    try { const stored = localStorage.getItem(arbitrosKey); if (stored) setArbitrosTorneo(JSON.parse(stored)) } catch(e) {}
    // Cargar árbitros registrados en BD
    supabase.from('players').select('id,name,photo_face_url,photo_url').or('rol.eq.arbitro,es_arbitro.eq.true').order('name').then(({ data }) => {
      setArbitrosReg(data || [])
      // Precargar árbitros asignados al partido si no hay planilla guardada localmente
      let haySnapLocal = false
      try { haySnapLocal = !!localStorage.getItem(localKey) } catch { haySnapLocal = false }
      if (!haySnapLocal) {
        if (partido.arbitro1_id) { const a = (data||[]).find(x=>x.id===partido.arbitro1_id); if(a) setArbitro1(a.name) }
        if (partido.arbitro2_id) { const a = (data||[]).find(x=>x.id===partido.arbitro2_id); if(a) setArbitro2(a.name) }
        if (partido.arbitro3_id) { const a = (data||[]).find(x=>x.id===partido.arbitro3_id); if(a) setArbitro3(a.name) }
      }
    })
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
    setLoading(true)
    if (!navigator.onLine) {
      try {
        const snap = localStorage.getItem(localKey)
        const cache = localStorage.getItem(cacheJugsKey)
        if (snap) {
          const s = JSON.parse(snap)
          setJugadoresLocal(s.jugadoresLocal || []); setJugadoresVisitante(s.jugadoresVisitante || [])
          setGolesLocal(s.golesLocal || Array(24).fill(null)); setGolesVisitante(s.golesVisitante || Array(24).fill(null))
          setFaltasAcumLocal(s.faltasAcumLocal || { p1: Array(5).fill(null), p2: Array(5).fill(null) })
          setFaltasAcumVis(s.faltasAcumVis || { p1: Array(5).fill(null), p2: Array(5).fill(null) })
          setFinalistasLocal(s.finalistasLocal || Array(5).fill('')); setFinalistasVis(s.finalistasVis || Array(5).fill(''))
          setIngresosLocal(s.ingresosLocal || Array(7).fill('')); setIngresosVis(s.ingresosVis || Array(7).fill(''))
          setCuerpoLocal(s.cuerpoLocal || CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
          setCuerpoVis(s.cuerpoVis || CUERPO_ROLES.map(r => ({ rol: r, nombre: '', ci: '', firma: null, amarilla: false, azul: false, roja: false })))
          setArbitro1(s.arbitro1 || ''); setArbitroInput1(s.arbitro1 || '')
          setArbitro2(s.arbitro2 || ''); setArbitroInput2(s.arbitro2 || '')
          setAnotador(s.anotador || ''); setCronometroNombre(s.cronometroNombre || ''); setObservaciones(s.observaciones || '')
          setHoraInicio1(s.horaInicio1 || ''); setHoraFin1(s.horaFin1 || ''); setHoraInicio2(s.horaInicio2 || ''); setHoraFin2(s.horaFin2 || '')
          setTiroInicial(s.tiroInicial || null); setColorLocal(s.colorLocal || '#1a3a8a'); setColorVisitante(s.colorVisitante || '#d93025')
          if (s.mvpId) setMvpId(s.mvpId)
          if (s.huboPenales) setHuboPenales(s.huboPenales); if (s.penalesGanador) setPenalesGanador(s.penalesGanador)
          if (s.penalesLocal) setPenalesLocal(s.penalesLocal); if (s.penalesVisitante) setPenalesVisitante(s.penalesVisitante)
          const dur = s.duracionMinutos || 20; setDuracionMinutos(dur); setDuracionInput(String(dur))
          setHayDatosLocales(true)
        } else if (cache) {
          const c = JSON.parse(cache)
          setJugadoresLocal(c.jugadoresLocal || []); setJugadoresVisitante(c.jugadoresVisitante || [])
          setTorneo(c.torneo || null)
          const dur = c.duracion || 20; setDuracionMinutos(dur); setDuracionInput(String(dur))
        }
      } catch(e) {}
      setLoading(false); return
    }

    const [jugsL, jugsV, torn, eventos, statsDB, logrosDB] = await Promise.all([
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.home_team_id).eq('activo', true),
      supabase.from('tournament_player_registrations').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('tournament_id', partido.tournament_id).eq('team_id', partido.away_team_id).eq('activo', true),
      supabase.from('tournaments').select('*').eq('id', partido.tournament_id).single(),
      supabase.from('match_events').select('*').eq('match_id', partido.id).order('created_at', { ascending: true }),
      supabase.from('player_match_stats').select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)').eq('match_id', partido.id),
      supabase.from('tournament_logros').select('*').eq('match_id', partido.id).eq('tipo', 'mvp').maybeSingle(),
    ])

    const evs = eventos.data || [], stats = statsDB.data || [], yaJugado = stats.length > 0, torneoData = torn.data
    if (logrosDB.data?.player_id) setMvpId(logrosDB.data.player_id)

    const mapJug = (data) => (data || []).map(r => ({ id: r.players?.id, nombre: r.players?.name || '', cedula: r.players?.numero_cedula || '', numero: '', faltasPeriodo: [], amarilla: false, azul: false, roja: false, posicion_futbol5: r.players?.posicion_futbol5 || '', posicion_futbol7: r.players?.posicion_futbol7 || '', posicion_futbol11: r.players?.posicion_futbol11 || '' }))

    let jugsLocalBase, jugsVisBase
    if (yaJugado) {
      const sL = stats.filter(s => s.team_id === partido.home_team_id)
      const sV = stats.filter(s => s.team_id === partido.away_team_id)
      jugsLocalBase = sL.map(s => ({ id: s.player_id, nombre: s.players?.name || '', cedula: s.players?.numero_cedula || '', numero: s.numero_camiseta || '', faltasPeriodo: [], amarilla: s.yellow_cards > 0, azul: s.blue_cards > 0, roja: s.red_cards > 0, posicion_futbol5: s.players?.posicion_futbol5 || '', posicion_futbol7: s.players?.posicion_futbol7 || '', posicion_futbol11: s.players?.posicion_futbol11 || '' }))
      jugsVisBase   = sV.map(s => ({ id: s.player_id, nombre: s.players?.name || '', cedula: s.players?.numero_cedula || '', numero: s.numero_camiseta || '', faltasPeriodo: [], amarilla: s.yellow_cards > 0, azul: s.blue_cards > 0, roja: s.red_cards > 0, posicion_futbol5: s.players?.posicion_futbol5 || '', posicion_futbol7: s.players?.posicion_futbol7 || '', posicion_futbol11: s.players?.posicion_futbol11 || '' }))
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
    }

    // ── SANCIONES ─────────────────────────────────────
    // 1) Roja en el último partido jugado del equipo → sancionado esta fecha (se
    //    levanta sola al terminar este partido, porque deja de ser el último).
    // 2) Sanciones manuales activas (aplican a todos los torneos).
    if (!yaJugado) {
      const mapSanc = {}
      try {
        for (const teamId of [partido.home_team_id, partido.away_team_id]) {
          const { data: ult } = await supabase.from('matches')
            .select('id')
            .eq('tournament_id', partido.tournament_id)
            .eq('status', 'finished')
            .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
            .neq('id', partido.id)
            .order('played_at', { ascending: false })
            .limit(1)
          if (ult && ult[0]) {
            const { data: rojas } = await supabase.from('player_match_stats')
              .select('player_id')
              .eq('match_id', ult[0].id)
              .eq('team_id', teamId)
              .gt('red_cards', 0)
            ;(rojas || []).forEach(r => { mapSanc[r.player_id] = '🟥 Tarjeta roja en el partido anterior — cumple 1 fecha' })
          }
        }
        const idsJug = [...jugsLocalBase, ...jugsVisBase].map(j => j.id).filter(Boolean)
        if (idsJug.length > 0) {
          const { data: sanc } = await supabase.from('sanciones')
            .select('player_id, motivo, fecha_fin')
            .eq('activa', true)
            .in('player_id', idsJug)
          const ahora = new Date()
          ;(sanc || []).forEach(s => {
            if (s.fecha_fin && new Date(s.fecha_fin) < ahora) return
            mapSanc[s.player_id] = `⛔ ${s.motivo || 'Sancionado'} — ${s.fecha_fin ? 'hasta ' + new Date(s.fecha_fin).toLocaleDateString('es-CO') : 'sanción permanente'}`
          })
        }
      } catch (e) { console.error('sanciones:', e) }
      setSancionados(mapSanc)
    } else {
      setSancionados({})
    }

    let restaurado = false
    try {
      const local = localStorage.getItem(localKey)
      if (local) {
        const snap = JSON.parse(local)
        if (snap.pendienteSync) {
          setJugadoresLocal(snap.jugadoresLocal); setJugadoresVisitante(snap.jugadoresVisitante)
          setGolesLocal(snap.golesLocal); setGolesVisitante(snap.golesVisitante)
          setFaltasAcumLocal(snap.faltasAcumLocal); setFaltasAcumVis(snap.faltasAcumVis)
          setFinalistasLocal(snap.finalistasLocal); setFinalistasVis(snap.finalistasVis)
          setIngresosLocal(snap.ingresosLocal); setIngresosVis(snap.ingresosVis)
          setCuerpoLocal(snap.cuerpoLocal); setCuerpoVis(snap.cuerpoVis)
          setArbitro1(snap.arbitro1 || ''); setArbitroInput1(snap.arbitro1 || '')
          setArbitro2(snap.arbitro2 || ''); setArbitroInput2(snap.arbitro2 || '')
          setAnotador(snap.anotador || ''); setCronometroNombre(snap.cronometroNombre || ''); setObservaciones(snap.observaciones || '')
          setHoraInicio1(snap.horaInicio1 || ''); setHoraFin1(snap.horaFin1 || ''); setHoraInicio2(snap.horaInicio2 || ''); setHoraFin2(snap.horaFin2 || '')
          setTiroInicial(snap.tiroInicial || null); setColorLocal(snap.colorLocal || '#1a3a8a'); setColorVisitante(snap.colorVisitante || '#d93025')
          if (snap.mvpId) setMvpId(snap.mvpId)
          if (snap.huboPenales) setHuboPenales(snap.huboPenales); if (snap.penalesGanador) setPenalesGanador(snap.penalesGanador)
          if (snap.penalesLocal) setPenalesLocal(snap.penalesLocal); if (snap.penalesVisitante) setPenalesVisitante(snap.penalesVisitante)
          const dur = snap.duracionMinutos || getDefaultDuracion(torneoData?.modalidad)
          setDuracionMinutos(dur); setDuracionInput(String(dur))
          setHayDatosLocales(true); restaurado = true
        }
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
      if (!j.id) return
      if (j.amarilla) eventosTarjetas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'yellow_card', periodo })
      if (j.azul)    eventosTarjetas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'blue_card', periodo })
      if (j.roja)    eventosTarjetas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id, player_id: j.id, event_type: 'red_card', periodo })
    })
    procesarTarjetas(jugadoresLocal, partido.home_team_id)
    procesarTarjetas(jugadoresVisitante, partido.away_team_id)

    const eventosFaltas = []
    ;['p1','p2'].forEach(key => {
      const per = key === 'p1' ? 1 : 2
      faltasAcumLocal[key].filter(Boolean).forEach(numero => { const j = jugadoresLocal.find(jj => String(jj.numero) === String(numero)); if (j?.id) eventosFaltas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.home_team_id, player_id: j.id, event_type: 'falta_acum', periodo: per }) })
      faltasAcumVis[key].filter(Boolean).forEach(numero => { const j = jugadoresVisitante.find(jj => String(jj.numero) === String(numero)); if (j?.id) eventosFaltas.push({ match_id: partido.id, tournament_id: partido.tournament_id, team_id: partido.away_team_id, player_id: j.id, event_type: 'falta_acum', periodo: per }) })
    })

    await supabase.from('match_events').delete().eq('match_id', partido.id)
    const todosEventos = [...eventosGolLocal, ...eventosGolVis, ...eventosTarjetas, ...eventosFaltas]
    if (todosEventos.length > 0) await supabase.from('match_events').insert(todosEventos)

    const updatePartido = { home_score: golesLocalTotal, away_score: golesVisTotal, status: 'finished' }
    // Actualizar árbitros si se cambiaron en la planilla
    const arb1Obj = arbitrosReg.find(a => a.name === arbitro1)
    const arb2Obj = arbitrosReg.find(a => a.name === arbitro2)
    const arb3Obj = arbitrosReg.find(a => a.name === arbitro3)
    if (arbitro1) { updatePartido.arbitro1 = arbitro1; if(arb1Obj) updatePartido.arbitro1_id = arb1Obj.id }
    if (arbitro2) { updatePartido.arbitro2 = arbitro2; if(arb2Obj) updatePartido.arbitro2_id = arb2Obj.id }
    if (arbitro3) { updatePartido.arbitro3 = arbitro3; if(arb3Obj) updatePartido.arbitro3_id = arb3Obj.id }
    if (tipoPartido) updatePartido.tipo_resultado = tipoPartido
    if (hubopenales) { updatePartido.penales_local = parseInt(penalesLocal) || 0; updatePartido.penales_visitante = parseInt(penalesVisitante) || 0; updatePartido.penales_ganador = penalesGanador }
    await supabase.from('matches').update(updatePartido).eq('id', partido.id)

    const calcResultado = (gF, gC) => gF > gC ? 'win' : gF === gC ? 'draw' : 'loss'
    const statsRows = []
    const procesarStats = (jugadores, goles, team_id, esLocal) => {
      const gF = esLocal ? golesLocalTotal : golesVisTotal
      const gC = esLocal ? golesVisTotal   : golesLocalTotal
      jugadores.forEach(j => {
        if (!j.id || !j.numero) return
        const esPorteroJugador = j.posicion_futbol5 === 'Portero' || j.posicion_futbol7 === 'Portero' || j.posicion_futbol11 === 'Portero'
        statsRows.push({ match_id: partido.id, tournament_id: partido.tournament_id, player_id: j.id, team_id, numero_camiseta: j.numero, goals_scored: goles.filter(g => g && String(g.numero) === String(j.numero)).length, goals_conceded: esPorteroJugador ? gC : 0, own_goals: 0, yellow_cards: j.amarilla ? 1 : 0, blue_cards: j.azul ? 1 : 0, red_cards: j.roja ? 1 : 0, fouls: (j.faltasPeriodo || []).length, team_result: tipoPartido === 'desierto' ? 'draw' : calcResultado(gF, gC) })
      })
    }
    procesarStats(jugadoresLocal, golesLocal, partido.home_team_id, true)
    procesarStats(jugadoresVisitante, golesVisitante, partido.away_team_id, false)
    if (statsRows.length > 0) await supabase.from('player_match_stats').upsert(statsRows, { onConflict: 'match_id,player_id' })

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

    try { localStorage.removeItem(localKey) } catch(e) {}
    setHayDatosLocales(false)
    setGuardandoDB(false)
    onGuardarResultado(golesLocalTotal, golesVisTotal)
    onClose()
  }

  function handleCerrar() {
    if (hayCambios && partido.status !== 'finished') {
      if (!confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) return
    }
    // Limpiar localStorage
    try { localStorage.removeItem(`planilla_${partido.id}`) } catch(e) {}
    onClose()
  }

  // Flujo: botón guardar → modal MVP → guardar todo
  function handleClickGuardar() {
    // Si el partido ya está terminado y ya tiene MVP, solo cerrar
    if (partido.status === 'finished' && mvpId) {
      onClose()
      return
    }
    setShowMVP(true)
  }

  async function handleGuardarMVP(playerId) {
    setShowMVP(false)
    setMvpId(playerId)
    await guardarEnDB(null, playerId)
  }

  async function handleSaltearMVP() {
    setShowMVP(false)
    await guardarEnDB(null, null)
  }

  async function handleConfirmarEspecial(info) {
    setShowEspecial(null)
    await guardarEnDB(info, null)
  }

  function formatTiempo(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }

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
    s(prev => prev.map(j => String(j.numero) !== String(numero) ? j : { ...j, faltasPeriodo: [...(j.faltasPeriodo || []), periodo] }))
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
  function onDragStart(e) { dragStart.current = { mx: e.clientX, my: e.clientY, ox: cronoPos.x, oy: cronoPos.y }; window.addEventListener('mousemove', onDrag); window.addEventListener('mouseup', onDragEnd) }
  function onDrag(e) { if (!dragStart.current) return; setCronoPos({ x: dragStart.current.ox + (e.clientX - dragStart.current.mx), y: dragStart.current.oy + (e.clientY - dragStart.current.my) }) }
  function onDragEnd() { dragStart.current = null; window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', onDragEnd) }
  function iniciarPeriodo2() { setCorriendo(false); setSegundos(0); setTiempoAgotado(false); setTiempoExtra(0); setPeriodo(2) }
  function agregarTiempoExtra(mins) { setTiempoExtra(prev => prev + mins); setTiempoAgotado(false); setCorriendo(true) }
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

  function DropdownCamisetas({ jugs, dropKey, onSelect }) {
    if (dropdownOpen !== dropKey) return null
    const jugsConNumero = jugs.filter(j => j.numero !== '' && j.numero !== null && j.numero !== undefined)
    return (
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,.2)', minWidth: '160px', maxHeight: '180px', overflowY: 'auto' }}>
        {jugsConNumero.length === 0 && <div style={{ padding: '8px 12px', fontSize: '9px', color: '#9aa0a6' }}>Sin números asignados</div>}
        {jugsConNumero.map(j => (
          <div key={j.numero} onClick={() => onSelect(j.numero)}
            style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f3f4' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            <span style={{ fontWeight: '700', color: '#111', minWidth: '26px', background: '#e8f0fe', borderRadius: '4px', textAlign: 'center', padding: '1px 3px', fontSize: '10px' }}>#{j.numero}</span>
            <span style={{ fontSize: '10px', color: '#111' }}>{j.nombre}</span>
          </div>
        ))}
      </div>
    )
  }

  function SlotGol({ equipo, slotIdx, goles, jugs, colorEquipo }) {
    const gol = goles[slotIdx], num = slotIdx + 1, dropKey = `gol-${equipo}-${slotIdx}`
    const ul = goles.reduce((l, g, i) => g !== null ? i : l, -1), esUl = ul === slotIdx
    const puedeClic = puedeAbrirGol(goles, slotIdx)
    return (
      <td style={{ border: B, padding: '1px 2px', position: 'relative', verticalAlign: 'middle', background: (colorEquipo || '#1a3a8a') + '30' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
          <span style={{ fontSize: '8px', color: '#111', minWidth: '9px', fontWeight: '700' }}>{num}</span>
          {gol ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flex: 1 }} onDoubleClick={() => { if (esUl) eliminarGol(equipo, slotIdx) }} title={esUl ? 'Doble click para eliminar' : ''}>
              <span style={{ fontWeight: '900', fontSize: '10px', color: '#111' }}>#{gol.numero}</span>
              <span style={{ fontSize: '8px', color: '#333' }}>{gol.minuto}</span>
              {esUl && <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '6px' }}>2x✕</span>}
            </div>
          ) : puedeClic ? (
            <div style={{ flex: 1, position: 'relative' }} onClick={e => { e.stopPropagation(); setDropdownOpen(dropdownOpen === dropKey ? null : dropKey) }}>
              <span style={{ fontSize: '9px', color: '#555', cursor: 'pointer', fontWeight: '700' }}>+N°</span>
              <DropdownCamisetas jugs={jugs} dropKey={dropKey} onSelect={n => registrarGol(equipo, slotIdx, n)}/>
            </div>
          ) : <span style={{ fontSize: '7px', color: '#bbb' }}>—</span>}
        </div>
      </td>
    )
  }

  function SlotFalta({ equipo, per, i, faltasAcum, jugs }) {
    const key = `p${per}`, val = faltasAcum[key][i], dropKey = `falta-${equipo}-p${per}-${i}`
    const puedeClic = puedeAbrirFalta(faltasAcum, key, i)
    return (
      <td style={{ border: B, padding: '2px 1px', position: 'relative', textAlign: 'center', verticalAlign: 'middle', background: val !== null ? (per === 1 ? '#ddeeff' : '#ffdddd') : puedeClic ? '#f8f9fa' : '#f1f3f4', cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); if (puedeClic && val === null) setDropdownOpen(dropdownOpen === dropKey ? null : dropKey) }}
        onDoubleClick={e => { e.stopPropagation(); if (val !== null) eliminarFaltaAcum(equipo, per, i) }}
        title={val !== null ? 'Doble click para eliminar' : ''}>
        {val !== null ? <span style={{ fontWeight: '700', color: '#111', fontSize: '9px' }}>{val}<span style={{ fontSize: '6px', color: '#aaa' }}>2x</span></span>
          : puedeClic ? <span style={{ color: '#555', fontSize: '9px' }}>+</span>
          : <span style={{ color: '#ccc', fontSize: '8px' }}>—</span>}
        <DropdownCamisetas jugs={jugs} dropKey={dropKey} onSelect={n => registrarFaltaAcum(equipo, per, i, n)}/>
      </td>
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
            const sancion = j.id ? sancionados[j.id] : null
            return (
              <tr key={idx} title={sancion || ''} style={{ height: '17px', background: sancion ? '#fce8e6' : esMVP ? '#fff8e1' : 'transparent', opacity: sancion ? .75 : 1 }}>
                <td style={cell}><input value={j.cedula} onChange={e => updateJugador(equipo, idx, 'cedula', e.target.value)} onDoubleClick={() => updateJugador(equipo, idx, 'cedula', '')} style={inp}/></td>
                <td style={{ ...cellL, background: sancion ? '#fad2cf' : esMVP ? '#fff59d' : (colorEquipo || '#1a3a8a') + '35' }}>
                  <input value={j.nombre} onChange={e => updateJugador(equipo, idx, 'nombre', e.target.value)} onDoubleClick={() => updateJugador(equipo, idx, 'nombre', '')} style={{ ...inpL, fontWeight: '700', color: '#111', textDecoration: sancion ? 'line-through' : 'none' }}/>
                  {sancion   && <span style={{ fontSize: '6px', color: '#d93025', fontWeight: '800' }}> ⛔SANCIONADO</span>}
                  {!sancion && esPortero && <span style={{ fontSize: '6px', color: '#1a73e8', fontWeight: '700' }}> 🧤</span>}
                  {!sancion && esMVP     && <span style={{ fontSize: '6px', color: '#e8710a', fontWeight: '700' }}> ⭐MVP</span>}
                </td>
                {sancion
                  ? <td style={{ ...cell, background: '#d93025' }}><span style={{ color: '#fff', fontSize: '6px', fontWeight: '800' }}>SANC</span></td>
                  : <InputCamiseta value={j.numero} onChange={val => updateJugador(equipo, idx, 'numero', val)} onDoubleClick={() => updateJugador(equipo, idx, 'numero', '')} repetido={repetido}/>}
                {[0,1,2,3,4].map(n => { const tF = faltas.length > n; return <td key={n} style={{ ...cell, background: tF ? '#e0e0e0' : 'transparent' }}>{tF && <span style={{ color: '#111', fontWeight: '700' }}>{n+1}</span>}</td> })}
                <td style={{ ...cell, background: j.amarilla ? '#ffcc00' : 'transparent', cursor: sancion ? 'not-allowed' : 'pointer' }} onClick={() => !sancion && updateJugador(equipo, idx, 'amarilla', !j.amarilla)}><span style={{ color: j.amarilla ? '#111' : 'transparent' }}>✓</span></td>
                <td style={{ ...cell, background: j.azul ? '#4488ff' : 'transparent', cursor: sancion ? 'not-allowed' : 'pointer' }} onClick={() => !sancion && updateJugador(equipo, idx, 'azul', !j.azul)}><span style={{ color: j.azul ? '#fff' : 'transparent' }}>✓</span></td>
                <td style={{ ...cell, background: j.roja ? '#dd2211' : 'transparent', cursor: sancion ? 'not-allowed' : 'pointer' }} onClick={() => !sancion && updateJugador(equipo, idx, 'roja', !j.roja)}><span style={{ color: j.roja ? '#fff' : 'transparent' }}>✓</span></td>
                <td style={{ ...cell, background: g1 ? (colorEquipo || '#1a3a8a') : 'transparent', color: g1 ? '#fff' : '#111', fontWeight: '700' }}>{g1||''}</td>
                <td style={{ ...cell, background: g2 ? (colorEquipo || '#1a3a8a') : 'transparent', color: g2 ? '#fff' : '#111', fontWeight: '700' }}>{g2||''}</td>
                <td style={{ ...cell, background: (g1+g2) ? (colorEquipo || '#1a3a8a') : 'transparent', color: (g1+g2) ? '#fff' : '#111', fontWeight: '900' }}>{(g1+g2)||''}</td>
              </tr>
            )
          })}
          {Array.from({ length: Math.max(0, 12 - jugs.length) }).map((_, i) => (
            <tr key={`e${i}`} style={{ height: '17px' }}>{Array.from({ length: 14 }).map((_, j) => <td key={j} style={cell}>&nbsp;</td>)}</tr>
          ))}
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
            <div style={{ background: '#ddd', borderBottom: B, padding: '2px 4px', fontWeight: '700', fontSize: '9px', textAlign: 'center', color: '#111' }}>FINALISTAS</div>
            <div style={{ display: 'flex', borderBottom: B }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, borderRight: i < 4 ? B : 'none', padding: '2px', textAlign: 'center' }}>
                  <input value={finalistas[i]} onChange={e => setFinalistas(prev => { const n=[...prev]; n[i]=e.target.value; return n })} onDoubleClick={() => setFinalistas(prev => { const n=[...prev]; n[i]=''; return n })} style={{ ...inp, fontWeight: finalistas[i]?'700':'400', color: '#111', fontSize: '9px' }} placeholder="N°"/>
                </div>
              ))}
            </div>
            <div style={{ background: '#ddd', borderBottom: B, padding: '2px 4px', fontWeight: '700', fontSize: '9px', textAlign: 'center', color: '#111' }}>INGRESOS</div>
            <div style={{ display: 'flex' }}>
              {[0,1,2,3,4,5,6].map(i => (
                <div key={i} style={{ flex: 1, borderRight: i < 6 ? B : 'none', padding: '2px', textAlign: 'center' }}>
                  <input value={ingresos[i]} onChange={e => setIngresos(prev => { const n=[...prev]; n[i]=e.target.value; return n })} onDoubleClick={() => setIngresos(prev => { const n=[...prev]; n[i]=''; return n })} style={{ ...inp, fontWeight: ingresos[i]?'700':'400', color: '#111', fontSize: '9px' }} placeholder="N°"/>
                </div>
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
                  <td style={{ ...cell, background: m.amarilla?'#ffcc00':'transparent', cursor:'pointer' }} onClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,amarilla:!mm.amarilla}:mm))}><span style={{ color: m.amarilla?'#111':'transparent' }}>✓</span></td>
                  <td style={{ ...cell, background: m.azul?'#4488ff':'transparent', cursor:'pointer' }} onClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,azul:!mm.azul}:mm))}><span style={{ color: m.azul?'#fff':'transparent' }}>✓</span></td>
                  <td style={{ ...cell, background: m.roja?'#dd2211':'transparent', cursor:'pointer' }} onClick={() => setCuerpo(prev => prev.map((mm,i) => i===rowIdx?{...mm,roja:!mm.roja}:mm))}><span style={{ color: m.roja?'#fff':'transparent' }}>✓</span></td>
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
        <ModalMVP jugadoresLocal={jugadoresLocal} jugadoresVisitante={jugadoresVisitante} partido={partido} mvpGuardado={mvpId} onGuardar={handleGuardarMVP} onSaltear={handleSaltearMVP}/>
      )}

      {showEspecial && (
        <ModalEspecial tipo={showEspecial} partido={partido} onConfirmar={handleConfirmarEspecial} onCancelar={() => setShowEspecial(null)}/>
      )}

      <button onClick={handleClickGuardar} className="no-print"
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9998, width: '52px', height: '52px', borderRadius: '50%', background: '#d93025', border: '3px solid #fff', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
        <X size={22}/>
      </button>

      {/* CRONÓMETRO */}
      <div style={{ position: 'fixed', left: cronoPos.x, top: cronoPos.y, zIndex: 9999, background: cronoBg, borderRadius: miniCrono?'50px':'20px', boxShadow: '0 8px 32px rgba(0,0,0,.5)', minWidth: miniCrono?'150px':'310px', userSelect: 'none' }}>
        <div onMouseDown={onDragStart} style={{ cursor: 'grab', padding: miniCrono?'8px 12px':'10px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <button onClick={() => { if (!tiempoAgotado) setCorriendo(!corriendo) }} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{corriendo?<Pause size={14}/>:<Play size={14}/>}</button>
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
                  <button onClick={() => { setCorriendo(false); setSegundos(0); setTiempoAgotado(false); setTiempoExtra(0) }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '.8rem' }}><RotateCcw size={14}/> Reset</button>
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

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
        <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '980px', marginBottom: '20px' }}>

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
              <button onClick={() => setShowEspecial('w')} style={{ padding: '6px 12px', background: '#e8710a', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700' }}>🏆 Por W</button>
              <button onClick={() => setShowEspecial('desierto')} style={{ padding: '6px 12px', background: '#5f6368', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.78rem', fontWeight: '700' }}>❌ Desierto</button>
              <button onClick={handleClickGuardar} disabled={guardandoDB || !isOnline}
                style={{ padding: '6px 14px', background: guardandoDB || !isOnline ? '#9aa0a6' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: guardandoDB || !isOnline ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                {guardandoDB ? 'Guardando...' : !isOnline ? '📵 Sin internet' : '💾 Guardar resultado'}
              </button>
              <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}><Printer size={13}/> Imprimir</button>
            </div>
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
                  <span style={{ color: '#111' }}><b>CAPITÁN N°:</b> <input style={{...inp,width:'20px',display:'inline',borderBottom:'1px solid #000'}}/></span>
                  <span style={{ color: '#111' }}><b>FIRMA:</b></span>
                  <FirmaSlot label="Capitán Local" firma={firmas.capitanLocal} onFirmar={() => setFirmaModal('principal-capitanLocal')}/>
                </div>
              </div>
              <TablaJugadores jugs={jugadoresLocal} equipo="local" goles={golesLocal} colorEquipo={colorLocal}/>
              <ParteInferior equipo="local" jugs={jugadoresLocal} faltasAcum={faltasAcumLocal} cuerpo={cuerpoLocal} setCuerpo={setCuerpoLocal} goles={golesLocal} finalistas={finalistasLocal} setFinalistas={setFinalistasLocal} ingresos={ingresosLocal} setIngresos={setIngresosLocal} colorEquipo={colorLocal}/>
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
                  <span style={{ color: '#111' }}><b>CAPITÁN N°:</b> <input style={{...inp,width:'20px',display:'inline',borderBottom:'1px solid #000'}}/></span>
                  <span style={{ color: '#111' }}><b>FIRMA:</b></span>
                  <FirmaSlot label="Capitán Visitante" firma={firmas.capitanVisitante} onFirmar={() => setFirmaModal('principal-capitanVisitante')}/>
                </div>
              </div>
              <TablaJugadores jugs={jugadoresVisitante} equipo="visitante" goles={golesVisitante} colorEquipo={colorVisitante}/>
              <ParteInferior equipo="visitante" jugs={jugadoresVisitante} faltasAcum={faltasAcumVis} cuerpo={cuerpoVis} setCuerpo={setCuerpoVis} goles={golesVisitante} finalistas={finalistasVis} setFinalistas={setFinalistasVis} ingresos={ingresosVis} setIngresos={setIngresosVis} colorEquipo={colorVisitante}/>
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
                      <FirmaSlot label="Anotador" firma={firmas.anotador} onFirmar={() => setFirmaModal('principal-anotador')}/>
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
