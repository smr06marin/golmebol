import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X, Printer, Plus, Play, Pause, RotateCcw, Clock } from 'lucide-react'

const AZUL = '#1a3a8a'
const ROJO = '#d93025'

export default function PlanillaPartido({ partido, onClose, onGuardarResultado }) {
  const printRef = useRef(null)
  const timerRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [arbitros, setArbitros] = useState([])
  const [nuevoArbitro, setNuevoArbitro] = useState('')

  // Jugadores
  const [jugadoresLocal, setJugadoresLocal] = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])

  // Cronómetro
  const [periodo, setPeriodo] = useState(1)
  const [segundos, setSegundos] = useState(0)
  const [corriendo, setCorriendo] = useState(false)

  // Goles
  const [golesLocal, setGolesLocal] = useState([]) // [{numero, minuto, periodo}]
  const [golesVisitante, setGolesVisitante] = useState([])
  const [inputGolLocal, setInputGolLocal] = useState('')
  const [inputGolVisitante, setInputGolVisitante] = useState('')

  // Faltas acumuladas
  const [faltasAcumLocal1, setFaltasAcumLocal1] = useState([])
  const [faltasAcumLocal2, setFaltasAcumLocal2] = useState([])
  const [faltasAcumVis1, setFaltasAcumVis1] = useState([])
  const [faltasAcumVis2, setFaltasAcumVis2] = useState([])
  const [inputFaltaLocal, setInputFaltaLocal] = useState('')
  const [inputFaltaVis, setInputFaltaVis] = useState('')

  // Otros datos
  const [arbitro1, setArbitro1] = useState('')
  const [arbitro2, setArbitro2] = useState('')
  const [anotador, setAnotador] = useState('')
  const [cronometro, setCronometro] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [etapa, setEtapa] = useState('')
  const [horaInicio1, setHoraInicio1] = useState('')
  const [horaFin1, setHoraFin1] = useState('')
  const [horaInicio2, setHoraInicio2] = useState('')
  const [horaFin2, setHoraFin2] = useState('')

  useEffect(() => { fetchTodo() }, [])

  useEffect(() => {
    if (corriendo) {
      timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [corriendo])

  async function fetchTodo() {
    setLoading(true)
    const [jugsL, jugsV, arbs] = await Promise.all([
      supabase.from('tournament_player_registrations')
        .select('*, players(id,name,numero_cedula)')
        .eq('tournament_id', partido.tournament_id)
        .eq('team_id', partido.home_team_id)
        .eq('activo', true),
      supabase.from('tournament_player_registrations')
        .select('*, players(id,name,numero_cedula)')
        .eq('tournament_id', partido.tournament_id)
        .eq('team_id', partido.away_team_id)
        .eq('activo', true),
      supabase.from('arbitros').select('*').eq('activo', true).order('nombre'),
    ])

    const mapJug = (data) => (data || []).map((r, i) => ({
      id: r.players?.id,
      nombre: r.players?.name || '',
      cedula: r.players?.numero_cedula || '',
      numero: i + 1,
      faltas1: 0,
      faltas2: 0,
      amarilla: false,
      azul: false,
      roja: false,
    }))

    setJugadoresLocal(mapJug(jugsL.data))
    setJugadoresVisitante(mapJug(jugsV.data))
    setArbitros(arbs.data || [])
    setLoading(false)
  }

  async function handleAgregarArbitro() {
    if (!nuevoArbitro.trim()) return
    const { data } = await supabase.from('arbitros').insert({ nombre: nuevoArbitro.trim() }).select().single()
    if (data) { setArbitros(prev => [...prev, data]); setNuevoArbitro('') }
  }

  function formatTiempo(s) {
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  function handleCambiarPeriodo() {
    setCorriendo(false)
    setSegundos(0)
    setPeriodo(2)
  }

  function updateJugador(equipo, idx, campo, valor) {
    const setter = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    setter(prev => prev.map((j, i) => i === idx ? { ...j, [campo]: valor } : j))
  }

  function toggleFalta(equipo, idx) {
    const jugs = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
    const setter = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const j = jugs[idx]
    if (periodo === 1) {
      const nuevasFaltas = Math.min((j.faltas1 || 0) + 1, 5)
      setter(prev => prev.map((jj, i) => i === idx ? { ...jj, faltas1: nuevasFaltas } : jj))
    } else {
      const nuevasFaltas = Math.min((j.faltas2 || 0) + 1, 5)
      setter(prev => prev.map((jj, i) => i === idx ? { ...jj, faltas2: nuevasFaltas } : jj))
    }
  }

  function registrarGol(equipo) {
    const numCamiseta = equipo === 'local' ? inputGolLocal : inputGolVisitante
    if (!numCamiseta) return
    const minuto = formatTiempo(segundos)
    const gol = { numero: parseInt(numCamiseta), minuto, periodo }
    if (equipo === 'local') { setGolesLocal(prev => [...prev, gol]); setInputGolLocal('') }
    else { setGolesVisitante(prev => [...prev, gol]); setInputGolVisitante('') }
  }

  function registrarFaltaAcum(equipo) {
    const num = equipo === 'local' ? inputFaltaLocal : inputFaltaVis
    if (!num) return
    const numero = parseInt(num)
    // Sumar falta personal al jugador con ese número
    const jugs = equipo === 'local' ? jugadoresLocal : jugadoresVisitante
    const setter = equipo === 'local' ? setJugadoresLocal : setJugadoresVisitante
    const idx = jugs.findIndex(j => j.numero === numero)
    if (idx >= 0) toggleFalta(equipo, idx)
    // Agregar a acumuladas
    if (equipo === 'local') {
      if (periodo === 1) setFaltasAcumLocal1(prev => [...prev, numero])
      else setFaltasAcumLocal2(prev => [...prev, numero])
      setInputFaltaLocal('')
    } else {
      if (periodo === 1) setFaltasAcumVis1(prev => [...prev, numero])
      else setFaltasAcumVis2(prev => [...prev, numero])
      setInputFaltaVis('')
    }
  }

  const golesLocalTotal = golesLocal.length
  const golesVisTotal = golesVisitante.length

  async function handleGuardar() {
    await onGuardarResultado(golesLocalTotal, golesVisTotal)
  }

  const fecha = partido.played_at ? new Date(partido.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const hora = partido.played_at ? new Date(partido.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''

  const cell = { border: '1px solid #000', padding: '2px 4px', fontSize: '10px', textAlign: 'center' }
  const cellL = { border: '1px solid #000', padding: '2px 4px', fontSize: '10px', textAlign: 'left' }
  const inp = { border: 'none', outline: 'none', width: '100%', fontSize: '10px', textAlign: 'center', background: 'transparent' }
  const inpL = { border: 'none', outline: 'none', width: '100%', fontSize: '10px', textAlign: 'left', background: 'transparent' }

  const TablaJugadores = ({ jugs, equipo }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '4px' }}>
      <thead>
        <tr style={{ background: '#ddd' }}>
          <th style={{ ...cell, width: '60px' }}>CÉDULA</th>
          <th style={{ ...cellL, width: '150px' }}>NOMBRE Y APELLIDO</th>
          <th style={{ ...cell, width: '24px' }}>N°</th>
          <th style={{ ...cell, width: '16px', color: AZUL }}>1P</th>
          <th style={{ ...cell, width: '16px', color: AZUL }}>2P</th>
          <th style={{ ...cell, width: '16px', color: AZUL }}>3P</th>
          <th style={{ ...cell, width: '16px', color: AZUL }}>4P</th>
          <th style={{ ...cell, width: '16px', color: AZUL }}>5P</th>
          <th style={{ ...cell, width: '16px', color: ROJO }}>1P</th>
          <th style={{ ...cell, width: '16px', color: ROJO }}>2P</th>
          <th style={{ ...cell, width: '16px', color: ROJO }}>3P</th>
          <th style={{ ...cell, width: '16px', color: ROJO }}>4P</th>
          <th style={{ ...cell, width: '16px', color: ROJO }}>5P</th>
          <th style={{ ...cell, width: '28px', background: '#ffcc00' }}>AMAR</th>
          <th style={{ ...cell, width: '24px', background: '#aaddff' }}>AZUL</th>
          <th style={{ ...cell, width: '24px', background: '#ffaaaa' }}>ROJA</th>
          <th style={{ ...cell, width: '28px', color: AZUL }}>G 1P</th>
          <th style={{ ...cell, width: '28px', color: ROJO }}>G 2P</th>
          <th style={{ ...cell, width: '28px', fontWeight: '700' }}>TOT</th>
        </tr>
        <tr style={{ background: '#eee', fontSize: '8px' }}>
          <th style={cell}></th>
          <th style={cellL}></th>
          <th style={cell}></th>
          <th colSpan={5} style={{ ...cell, color: AZUL }}>1ER PERIODO</th>
          <th colSpan={5} style={{ ...cell, color: ROJO }}>2DO PERIODO</th>
          <th colSpan={3} style={cell}>TARJETAS</th>
          <th colSpan={3} style={cell}>GOLES</th>
        </tr>
      </thead>
      <tbody>
        {jugs.map((j, idx) => {
          const goles1 = golesLocal.filter(g => g.numero === j.numero && g.periodo === 1 && equipo === 'local').length +
            golesVisitante.filter(g => g.numero === j.numero && g.periodo === 1 && equipo === 'visitante').length
          const goles2 = golesLocal.filter(g => g.numero === j.numero && g.periodo === 2 && equipo === 'local').length +
            golesVisitante.filter(g => g.numero === j.numero && g.periodo === 2 && equipo === 'visitante').length
          return (
            <tr key={idx} style={{ height: '20px' }}>
              <td style={cell}><input value={j.cedula} onChange={e => updateJugador(equipo, idx, 'cedula', e.target.value)} style={inp}/></td>
              <td style={cellL}><input value={j.nombre} onChange={e => updateJugador(equipo, idx, 'nombre', e.target.value)} style={inpL}/></td>
              <td style={cell}><input value={j.numero} onChange={e => updateJugador(equipo, idx, 'numero', parseInt(e.target.value) || '')} style={inp}/></td>
              {/* Faltas 1er periodo */}
              {[1,2,3,4,5].map(n => (
                <td key={n} style={{ ...cell, background: (j.faltas1 || 0) >= n ? '#4488ff33' : 'transparent', cursor: 'pointer' }}
                  onClick={() => { if (periodo === 1) toggleFalta(equipo, idx) }}>
                  <span style={{ color: AZUL, fontWeight: '700' }}>{(j.faltas1 || 0) >= n ? n : ''}</span>
                </td>
              ))}
              {/* Faltas 2do periodo */}
              {[1,2,3,4,5].map(n => (
                <td key={n} style={{ ...cell, background: (j.faltas2 || 0) >= n ? '#ff444433' : 'transparent', cursor: 'pointer' }}
                  onClick={() => { if (periodo === 2) toggleFalta(equipo, idx) }}>
                  <span style={{ color: ROJO, fontWeight: '700' }}>{(j.faltas2 || 0) >= n ? n : ''}</span>
                </td>
              ))}
              <td style={{ ...cell, background: j.amarilla ? '#ffcc0066' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'amarilla', !j.amarilla)}>{j.amarilla ? '✓' : ''}</td>
              <td style={{ ...cell, background: j.azul ? '#4488ff44' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'azul', !j.azul)}>{j.azul ? '✓' : ''}</td>
              <td style={{ ...cell, background: j.roja ? '#ff444444' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'roja', !j.roja)}>{j.roja ? '✓' : ''}</td>
              <td style={{ ...cell, color: AZUL, fontWeight: '700' }}>{goles1 || ''}</td>
              <td style={{ ...cell, color: ROJO, fontWeight: '700' }}>{goles2 || ''}</td>
              <td style={{ ...cell, fontWeight: '900' }}>{(goles1 + goles2) || ''}</td>
            </tr>
          )
        })}
        {Array.from({ length: Math.max(0, 12 - jugs.length) }).map((_, i) => (
          <tr key={`e${i}`} style={{ height: '20px' }}>
            {Array.from({ length: 19 }).map((_, j) => <td key={j} style={cell}>&nbsp;</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const TablaGoles = ({ goles, label }) => (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', marginBottom: '2px' }}>GOLES — AUTOR Y MINUTO ({label})</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#ddd' }}>
            <th style={{ ...cell, width: '40px' }}>N° CAM</th>
            <th style={{ ...cellL }}>NOMBRE</th>
            <th style={{ ...cell, width: '50px' }}>MINUTO</th>
            <th style={{ ...cell, width: '40px' }}>PERIODO</th>
          </tr>
        </thead>
        <tbody>
          {goles.map((g, i) => {
            const jugs = label === 'LOCAL' ? jugadoresLocal : jugadoresVisitante
            const jug = jugs.find(j => j.numero === g.numero)
            return (
              <tr key={i} style={{ background: g.periodo === 1 ? '#e8f0fe' : '#fce8e6' }}>
                <td style={{ ...cell, fontWeight: '700', color: g.periodo === 1 ? AZUL : ROJO }}>{g.numero}</td>
                <td style={{ ...cellL, color: g.periodo === 1 ? AZUL : ROJO }}>{jug?.nombre || '—'}</td>
                <td style={{ ...cell, fontWeight: '700' }}>{g.minuto}</td>
                <td style={{ ...cell, color: g.periodo === 1 ? AZUL : ROJO }}>{g.periodo}°P</td>
              </tr>
            )
          })}
          {Array.from({ length: Math.max(0, 6 - goles.length) }).map((_, i) => (
            <tr key={`eg${i}`} style={{ height: '16px' }}>
              {[0,1,2,3].map(j => <td key={j} style={cell}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #planilla-print, #planilla-print * { visibility: visible; }
          #planilla-print { position: fixed; left: 0; top: 0; width: 100%; zoom: 0.75; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
        <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '960px', marginBottom: '20px' }}>

          {/* Barra controles */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e8eaed', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>📋 Planilla — {partido.home?.name} vs {partido.away?.name}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={nuevoArbitro} onChange={e => setNuevoArbitro(e.target.value)} placeholder="+ Árbitro..."
                style={{ padding: '5px 10px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.8rem', outline: 'none', width: '130px' }}
                onKeyDown={e => e.key === 'Enter' && handleAgregarArbitro()}/>
              <button onClick={handleAgregarArbitro} style={{ padding: '5px 10px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', fontSize: '.8rem' }}>
                <Plus size={13}/>
              </button>
              <button onClick={handleGuardar} style={{ padding: '6px 14px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                Guardar resultado
              </button>
              <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                <Printer size={13}/> Imprimir
              </button>
              <button onClick={onClose} style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#5f6368', display: 'flex' }}>
                <X size={15}/>
              </button>
            </div>
          </div>

          {/* CRONÓMETRO */}
          <div className="no-print" style={{ background: periodo === 1 ? '#e8f0fe' : '#fce8e6', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color={periodo === 1 ? AZUL : ROJO}/>
              <span style={{ fontSize: '2rem', fontWeight: '900', color: periodo === 1 ? AZUL : ROJO, fontFamily: 'monospace', minWidth: '80px' }}>{formatTiempo(segundos)}</span>
              <span style={{ fontSize: '.8rem', fontWeight: '700', color: periodo === 1 ? AZUL : ROJO, background: '#fff', borderRadius: '8px', padding: '2px 10px' }}>
                {periodo === 1 ? '1ER PERIODO' : '2DO PERIODO'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setCorriendo(!corriendo)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', background: corriendo ? '#e8710a' : '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                {corriendo ? <><Pause size={14}/> Pausar</> : <><Play size={14}/> {segundos > 0 ? 'Continuar' : 'Iniciar'}</>}
              </button>
              <button onClick={() => { setCorriendo(false); setSegundos(0) }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
                <RotateCcw size={13}/> Reset
              </button>
              {periodo === 1 && (
                <button onClick={handleCambiarPeriodo}
                  style={{ padding: '7px 14px', background: ROJO, border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600' }}>
                  → 2do Periodo
                </button>
              )}
            </div>

            {/* Registrar goles rápido */}
            <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', align: 'center', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '.75rem', fontWeight: '600', color: AZUL }}>⚽ {partido.home?.name}:</span>
                <input type="number" value={inputGolLocal} onChange={e => setInputGolLocal(e.target.value)}
                  placeholder="N° camiseta" style={{ width: '90px', padding: '5px 8px', border: `2px solid ${AZUL}`, borderRadius: '6px', fontSize: '.8rem', outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && registrarGol('local')}/>
                <button onClick={() => registrarGol('local')}
                  style={{ padding: '5px 10px', background: AZUL, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.75rem', fontWeight: '600' }}>
                  + Gol {formatTiempo(segundos)}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '.75rem', fontWeight: '600', color: ROJO }}>⚽ {partido.away?.name}:</span>
                <input type="number" value={inputGolVisitante} onChange={e => setInputGolVisitante(e.target.value)}
                  placeholder="N° camiseta" style={{ width: '90px', padding: '5px 8px', border: `2px solid ${ROJO}`, borderRadius: '6px', fontSize: '.8rem', outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && registrarGol('visitante')}/>
                <button onClick={() => registrarGol('visitante')}
                  style={{ padding: '5px 10px', background: ROJO, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.75rem', fontWeight: '600' }}>
                  + Gol {formatTiempo(segundos)}
                </button>
              </div>
            </div>
          </div>

          {/* Faltas acumuladas rápidas */}
          <div className="no-print" style={{ background: '#f8f9fa', padding: '8px 20px', display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid #e8eaed', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.75rem', fontWeight: '600', color: '#5f6368' }}>FALTA ACUMULADA:</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '.75rem', color: AZUL, fontWeight: '600' }}>{partido.home?.name}:</span>
              <input type="number" value={inputFaltaLocal} onChange={e => setInputFaltaLocal(e.target.value)}
                placeholder="N° cam" style={{ width: '70px', padding: '4px 8px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.8rem', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && registrarFaltaAcum('local')}/>
              <button onClick={() => registrarFaltaAcum('local')}
                style={{ padding: '4px 10px', background: AZUL, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.75rem' }}>
                + Falta
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '.75rem', color: ROJO, fontWeight: '600' }}>{partido.away?.name}:</span>
              <input type="number" value={inputFaltaVis} onChange={e => setInputFaltaVis(e.target.value)}
                placeholder="N° cam" style={{ width: '70px', padding: '4px 8px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.8rem', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && registrarFaltaAcum('visitante')}/>
              <button onClick={() => registrarFaltaAcum('visitante')}
                style={{ padding: '4px 10px', background: ROJO, border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontSize: '.75rem' }}>
                + Falta
              </button>
            </div>
            {/* Marcador live */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '.75rem', color: '#5f6368' }}>MARCADOR:</span>
              <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#202124' }}>
                <span style={{ color: AZUL }}>{golesLocalTotal}</span>
                <span style={{ color: '#9aa0a6', margin: '0 6px' }}>—</span>
                <span style={{ color: ROJO }}>{golesVisTotal}</span>
              </span>
            </div>
          </div>

          {/* PLANILLA IMPRIMIBLE */}
          <div id="planilla-print" ref={printRef} style={{ padding: '14px', fontFamily: 'Arial, sans-serif' }}>

            {/* Encabezado */}
            <div style={{ textAlign: 'center', marginBottom: '6px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
              <div style={{ fontWeight: '900', fontSize: '14px', letterSpacing: '2px' }}>GOLMEBOL</div>
              <div style={{ fontWeight: '700', fontSize: '11px' }}>PLANILLA OFICIAL DE REGISTRO DE JUEGO</div>
            </div>

            {/* Info general */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <tbody>
                <tr>
                  <td style={cellL}><b>CAMPEONATO:</b> {partido.tournaments?.name}</td>
                  <td style={cellL}><b>CATEGORÍA:</b> <input style={{ ...inp, width: '80px', display:'inline', borderBottom:'1px solid #000' }}/></td>
                  <td style={cellL}><b>ETAPA:</b> <input value={etapa} onChange={e => setEtapa(e.target.value)} style={{ ...inp, width: '70px', display:'inline', borderBottom:'1px solid #000' }}/></td>
                </tr>
                <tr>
                  <td style={cellL}><b>CIUDAD:</b> {partido.tournaments?.city || ''}</td>
                  <td style={cellL}><b>FECHA:</b> {fecha}</td>
                  <td style={cellL}><b>CANCHA:</b> {partido.location || ''}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={cell}>
                    <b>1°P</b> H.I.: <input value={horaInicio1} onChange={e => setHoraInicio1(e.target.value)} style={{...inp,width:'45px',display:'inline',borderBottom:'1px solid #000'}}/> H.F.: <input value={horaFin1} onChange={e => setHoraFin1(e.target.value)} style={{...inp,width:'45px',display:'inline',borderBottom:'1px solid #000'}}/>
                    &nbsp;&nbsp;<b>2°P</b> H.I.: <input value={horaInicio2} onChange={e => setHoraInicio2(e.target.value)} style={{...inp,width:'45px',display:'inline',borderBottom:'1px solid #000'}}/> H.F.: <input value={horaFin2} onChange={e => setHoraFin2(e.target.value)} style={{...inp,width:'45px',display:'inline',borderBottom:'1px solid #000'}}/>
                    &nbsp;&nbsp;<b>HORA INICIO:</b> {hora}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* EQUIPO LOCAL */}
            <div style={{ border: '2px solid #000', padding: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                <div style={{ fontWeight: '900', fontSize: '12px', color: AZUL }}>EQUIPO LOCAL: {partido.home?.name?.toUpperCase()}</div>
                <div style={{ fontSize: '10px' }}>
                  <b>CAPITÁN N°:</b> <input style={{...inp,width:'25px',display:'inline',borderBottom:'1px solid #000'}}/>
                  &nbsp;&nbsp;<b>FIRMA:</b> ___________
                </div>
              </div>
              <TablaJugadores jugs={jugadoresLocal} equipo="local"/>
              {/* Faltas acumuladas */}
              <div style={{ display: 'flex', gap: '4px', fontSize: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                <b>FALTAS ACUMULATIVAS 1°P:</b>
                {faltasAcumLocal1.map((n, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: AZUL, fontWeight: '700', fontSize: '9px' }}>{n}</span>)}
                {Array.from({ length: Math.max(0, 5 - faltasAcumLocal1.length) }).map((_, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex' }}/>)}
                <b style={{ marginLeft: '10px' }}>2°P:</b>
                {faltasAcumLocal2.map((n, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: ROJO, fontWeight: '700', fontSize: '9px' }}>{n}</span>)}
                {Array.from({ length: Math.max(0, 5 - faltasAcumLocal2.length) }).map((_, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex' }}/>)}
              </div>
              <TablaGoles goles={golesLocal} label="LOCAL"/>
            </div>

            {/* EQUIPO VISITANTE */}
            <div style={{ border: '2px solid #000', padding: '6px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                <div style={{ fontWeight: '900', fontSize: '12px', color: ROJO }}>EQUIPO VISITANTE: {partido.away?.name?.toUpperCase()}</div>
                <div style={{ fontSize: '10px' }}>
                  <b>CAPITÁN N°:</b> <input style={{...inp,width:'25px',display:'inline',borderBottom:'1px solid #000'}}/>
                  &nbsp;&nbsp;<b>FIRMA:</b> ___________
                </div>
              </div>
              <TablaJugadores jugs={jugadoresVisitante} equipo="visitante"/>
              <div style={{ display: 'flex', gap: '4px', fontSize: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                <b>FALTAS ACUMULATIVAS 1°P:</b>
                {faltasAcumVis1.map((n, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: AZUL, fontWeight: '700', fontSize: '9px' }}>{n}</span>)}
                {Array.from({ length: Math.max(0, 5 - faltasAcumVis1.length) }).map((_, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex' }}/>)}
                <b style={{ marginLeft: '10px' }}>2°P:</b>
                {faltasAcumVis2.map((n, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: ROJO, fontWeight: '700', fontSize: '9px' }}>{n}</span>)}
                {Array.from({ length: Math.max(0, 5 - faltasAcumVis2.length) }).map((_, i) => <span key={i} style={{ border: '1px solid #000', width: '20px', height: '16px', display: 'inline-flex' }}/>)}
              </div>
              <TablaGoles goles={golesVisitante} label="VISITANTE"/>
            </div>

            {/* Árbitros y resultado */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellL, width: '35%' }}>
                    <b>ÁRBITRO 1:</b>
                    <select value={arbitro1} onChange={e => setArbitro1(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '10px', marginLeft: '4px' }}>
                      <option value="">Seleccionar...</option>
                      {arbitros.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  </td>
                  <td style={{ ...cellL, width: '35%' }}>
                    <b>ÁRBITRO 2:</b>
                    <select value={arbitro2} onChange={e => setArbitro2(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '10px', marginLeft: '4px' }}>
                      <option value="">Seleccionar...</option>
                      {arbitros.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  </td>
                  <td rowSpan={3} style={{ ...cell, fontWeight: '900', textAlign: 'center', background: '#f1f3f4' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700' }}>RESULTADO FINAL</div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#202124' }}>
                      <span style={{ color: AZUL }}>{golesLocalTotal}</span>
                      <span style={{ color: '#9aa0a6', margin: '0 6px' }}>—</span>
                      <span style={{ color: ROJO }}>{golesVisTotal}</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#5f6368' }}>{partido.home?.name} vs {partido.away?.name}</div>
                  </td>
                </tr>
                <tr>
                  <td style={cellL}><b>ANOTADOR:</b> <input value={anotador} onChange={e => setAnotador(e.target.value)} style={{...inpL,width:'120px',display:'inline',borderBottom:'1px solid #000'}}/></td>
                  <td style={cellL}><b>CRONÓMETRO:</b> <input value={cronometro} onChange={e => setCronometro(e.target.value)} style={{...inpL,width:'110px',display:'inline',borderBottom:'1px solid #000'}}/></td>
                </tr>
                <tr>
                  <td colSpan={2} style={cellL}><b>OBSERVACIONES:</b> <input value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{...inpL,borderBottom:'1px solid #000'}}/></td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '9px', color: '#9aa0a6', marginTop: '4px' }}>
              GOLMEBOL — {new Date().toLocaleDateString('es-CO')}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
