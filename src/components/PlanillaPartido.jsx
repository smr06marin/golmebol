import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X, Printer, Plus, Trash2 } from 'lucide-react'

export default function PlanillaPartido({ partido, onClose, onGuardarResultado }) {
  const printRef = useRef(null)

  const [jugadoresLocal, setJugadoresLocal] = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])
  const [arbitros, setArbitros] = useState([])
  const [nuevoArbitro, setNuevoArbitro] = useState('')
  const [loading, setLoading] = useState(true)

  // Datos editables planilla
  const [datosLocal, setDatosLocal] = useState([])
  const [datosVisitante, setDatosVisitante] = useState([])
  const [arbitro1, setArbitro1] = useState('')
  const [arbitro2, setArbitro2] = useState('')
  const [anotador, setAnotador] = useState('')
  const [cronometro, setCronometro] = useState('')
  const [resultado1p, setResultado1p] = useState({ local: '', visitante: '' })
  const [resultado2p, setResultado2p] = useState({ local: '', visitante: '' })
  const [observaciones, setObservaciones] = useState('')
  const [etapa, setEtapa] = useState('')
  const [horaInicio1, setHoraInicio1] = useState('')
  const [horaFin1, setHoraFin1] = useState('')
  const [horaInicio2, setHoraInicio2] = useState('')
  const [horaFin2, setHoraFin2] = useState('')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const [jugsL, jugsV, arbs] = await Promise.all([
      supabase.from('tournament_player_registrations')
        .select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)')
        .eq('tournament_id', partido.tournament_id)
        .eq('team_id', partido.home_team_id)
        .eq('activo', true),
      supabase.from('tournament_player_registrations')
        .select('*, players(id,name,numero_cedula,posicion_futbol5,posicion_futbol7,posicion_futbol11)')
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
      faltas: [false, false, false, false, false],
      amarilla: false,
      azul: false,
      roja: false,
      goles1p: '',
      goles2p: '',
    }))

    setJugadoresLocal(mapJug(jugsL.data))
    setJugadoresVisitante(mapJug(jugsV.data))
    setDatosLocal(mapJug(jugsL.data))
    setDatosVisitante(mapJug(jugsV.data))
    setArbitros(arbs.data || [])
    setLoading(false)
  }

  async function handleAgregarArbitro() {
    if (!nuevoArbitro.trim()) return
    const { data } = await supabase.from('arbitros').insert({ nombre: nuevoArbitro.trim() }).select().single()
    if (data) { setArbitros(prev => [...prev, data]); setNuevoArbitro('') }
  }

  function updateJugador(equipo, idx, campo, valor) {
    const setter = equipo === 'local' ? setDatosLocal : setDatosVisitante
    setter(prev => prev.map((j, i) => i === idx ? { ...j, [campo]: valor } : j))
  }

  function updateFalta(equipo, idx, faltaIdx) {
    const setter = equipo === 'local' ? setDatosLocal : setDatosVisitante
    const data = equipo === 'local' ? datosLocal : datosVisitante
    const faltas = [...data[idx].faltas]
    faltas[faltaIdx] = !faltas[faltaIdx]
    setter(prev => prev.map((j, i) => i === idx ? { ...j, faltas } : j))
  }

  const resultadoFinal = {
    local: (parseInt(resultado1p.local) || 0) + (parseInt(resultado2p.local) || 0),
    visitante: (parseInt(resultado1p.visitante) || 0) + (parseInt(resultado2p.visitante) || 0),
  }

  async function handleGuardar() {
    await onGuardarResultado(resultadoFinal.local, resultadoFinal.visitante)
  }

  function handleImprimir() {
    window.print()
  }

  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
  const hora = partido.played_at
    ? new Date(partido.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : ''

  const cell = { border: '1px solid #000', padding: '2px 4px', fontSize: '10px', textAlign: 'center' }
  const cellL = { border: '1px solid #000', padding: '2px 4px', fontSize: '10px', textAlign: 'left' }
  const inputCell = { border: 'none', outline: 'none', width: '100%', fontSize: '10px', textAlign: 'center', background: 'transparent' }
  const inputCellL = { border: 'none', outline: 'none', width: '100%', fontSize: '10px', textAlign: 'left', background: 'transparent' }

  const TablaJugadores = ({ datos, equipo }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '8px' }}>
      <thead>
        <tr style={{ background: '#ddd' }}>
          <th style={{ ...cell, width: '60px' }}>DOCUMENTO</th>
          <th style={{ ...cellL, width: '160px' }}>NOMBRE Y APELLIDO</th>
          <th style={{ ...cell, width: '24px' }}>N°</th>
          <th style={{ ...cell, width: '16px' }}>1</th>
          <th style={{ ...cell, width: '16px' }}>2</th>
          <th style={{ ...cell, width: '16px' }}>3</th>
          <th style={{ ...cell, width: '16px' }}>4</th>
          <th style={{ ...cell, width: '16px' }}>5</th>
          <th style={{ ...cell, width: '30px' }}>AMAR.</th>
          <th style={{ ...cell, width: '24px' }}>AZUL</th>
          <th style={{ ...cell, width: '24px' }}>ROJA</th>
          <th style={{ ...cell, width: '28px' }}>1°P.</th>
          <th style={{ ...cell, width: '28px' }}>2°P.</th>
          <th style={{ ...cell, width: '32px' }}>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {datos.map((j, idx) => (
          <tr key={idx} style={{ height: '20px' }}>
            <td style={cell}><input value={j.cedula} onChange={e => updateJugador(equipo, idx, 'cedula', e.target.value)} style={inputCell}/></td>
            <td style={cellL}><input value={j.nombre} onChange={e => updateJugador(equipo, idx, 'nombre', e.target.value)} style={inputCellL}/></td>
            <td style={cell}><input value={j.numero} onChange={e => updateJugador(equipo, idx, 'numero', e.target.value)} style={inputCell}/></td>
            {j.faltas.map((f, fi) => (
              <td key={fi} style={{ ...cell, cursor: 'pointer', background: f ? '#ffcc00' : 'transparent' }} onClick={() => updateFalta(equipo, idx, fi)}>
                {f ? '✓' : ''}
              </td>
            ))}
            <td style={{ ...cell, background: j.amarilla ? '#ffcc00' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'amarilla', !j.amarilla)}>{j.amarilla ? '✓' : ''}</td>
            <td style={{ ...cell, background: j.azul ? '#4488ff' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'azul', !j.azul)}>{j.azul ? '✓' : ''}</td>
            <td style={{ ...cell, background: j.roja ? '#ff4444' : 'transparent', cursor: 'pointer' }} onClick={() => updateJugador(equipo, idx, 'roja', !j.roja)}>{j.roja ? '✓' : ''}</td>
            <td style={cell}><input value={j.goles1p} onChange={e => updateJugador(equipo, idx, 'goles1p', e.target.value)} style={inputCell}/></td>
            <td style={cell}><input value={j.goles2p} onChange={e => updateJugador(equipo, idx, 'goles2p', e.target.value)} style={inputCell}/></td>
            <td style={{ ...cell, fontWeight: '700' }}>{(parseInt(j.goles1p) || 0) + (parseInt(j.goles2p) || 0) || ''}</td>
          </tr>
        ))}
        {/* Filas vacías si hay menos de 12 */}
        {Array.from({ length: Math.max(0, 12 - datos.length) }).map((_, i) => (
          <tr key={`empty-${i}`} style={{ height: '20px' }}>
            {Array.from({ length: 14 }).map((_, j) => <td key={j} style={cell}>&nbsp;</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <>
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #planilla-print, #planilla-print * { visibility: visible; }
          #planilla-print { position: fixed; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
        <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '900px', marginBottom: '20px' }}>

          {/* Barra controles */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8eaed' }}>
            <span style={{ fontWeight: '600', color: '#202124' }}>Planilla Oficial — {partido.home?.name} vs {partido.away?.name}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Gestionar árbitros */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={nuevoArbitro} onChange={e => setNuevoArbitro(e.target.value)}
                  placeholder="Agregar árbitro..."
                  style={{ padding: '6px 10px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '.8rem', outline: 'none', width: '160px' }}
                  onKeyDown={e => e.key === 'Enter' && handleAgregarArbitro()}/>
                <button onClick={handleAgregarArbitro}
                  style={{ padding: '6px 10px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', fontSize: '.8rem' }}>
                  <Plus size={14}/>
                </button>
              </div>
              <button onClick={handleGuardar}
                style={{ padding: '7px 16px', background: '#1e8e3e', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                Guardar resultado
              </button>
              <button onClick={handleImprimir}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500' }}>
                <Printer size={14}/> Imprimir
              </button>
              <button onClick={onClose}
                style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '7px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                <X size={16}/>
              </button>
            </div>
          </div>

          {/* PLANILLA */}
          <div id="planilla-print" ref={printRef} style={{ padding: '16px', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>

            {/* Encabezado */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '1px' }}>GOLMEBOL</div>
              <div style={{ fontWeight: '700', fontSize: '11px' }}>PLANILLA OFICIAL DE REGISTRO DE JUEGO</div>
            </div>

            {/* Info general */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <tbody>
                <tr>
                  <td style={cellL}><strong>CAMPEONATO:</strong> {partido.tournaments?.name}</td>
                  <td style={cellL}><strong>CATEGORÍA:</strong> <input style={{ ...inputCellL, width: '100px' }}/></td>
                  <td style={cellL}><strong>ETAPA:</strong> <input value={etapa} onChange={e => setEtapa(e.target.value)} style={{ ...inputCellL, width: '80px' }}/></td>
                </tr>
                <tr>
                  <td style={cellL}><strong>CIUDAD:</strong> {partido.tournaments?.city || ''}</td>
                  <td style={cellL}><strong>FECHA:</strong> {fecha}</td>
                  <td style={cellL}><strong>ESTADIO/CANCHA:</strong> {partido.location || ''}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={cell}>
                    <span style={{ marginRight: '20px' }}><strong>HORARIO 1°P —</strong> H.I.: <input value={horaInicio1} onChange={e => setHoraInicio1(e.target.value)} style={{ ...inputCell, width: '50px', display: 'inline' }}/> H.F.: <input value={horaFin1} onChange={e => setHoraFin1(e.target.value)} style={{ ...inputCell, width: '50px', display: 'inline' }}/></span>
                    <span><strong>2°P —</strong> H.I.: <input value={horaInicio2} onChange={e => setHoraInicio2(e.target.value)} style={{ ...inputCell, width: '50px', display: 'inline' }}/> H.F.: <input value={horaFin2} onChange={e => setHoraFin2(e.target.value)} style={{ ...inputCell, width: '50px', display: 'inline' }}/></span>
                    <span style={{ marginLeft: '20px' }}><strong>HORA INICIO:</strong> {hora}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── EQUIPO LOCAL ── */}
            <div style={{ border: '2px solid #000', padding: '6px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontWeight: '700', fontSize: '12px' }}>EQUIPO LOCAL: <span style={{ fontWeight: '900', color: '#1a3a8a' }}>{partido.home?.name?.toUpperCase()}</span></div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '10px' }}>
                  <span><strong>CAPITÁN N°:</strong> <input style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/></span>
                  <span><strong>FIRMA:</strong> _______________</span>
                </div>
              </div>
              <TablaJugadores datos={datosLocal} equipo="local"/>
              {/* Faltas acumulativas */}
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginBottom: '4px' }}>
                <strong>FALTAS ACUMULATIVAS 1°P:</strong>
                {[1,2,3,4,5].map(n => <span key={n} style={{ border: '1px solid #000', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}
                <strong style={{ marginLeft: '12px' }}>2°P:</strong>
                {[1,2,3,4,5].map(n => <span key={n} style={{ border: '1px solid #000', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}
              </div>
            </div>

            {/* ── EQUIPO VISITANTE ── */}
            <div style={{ border: '2px solid #000', padding: '6px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontWeight: '700', fontSize: '12px' }}>EQUIPO VISITANTE: <span style={{ fontWeight: '900', color: '#d93025' }}>{partido.away?.name?.toUpperCase()}</span></div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '10px' }}>
                  <span><strong>CAPITÁN N°:</strong> <input style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/></span>
                  <span><strong>FIRMA:</strong> _______________</span>
                </div>
              </div>
              <TablaJugadores datos={datosVisitante} equipo="visitante"/>
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginBottom: '4px' }}>
                <strong>FALTAS ACUMULATIVAS 1°P:</strong>
                {[1,2,3,4,5].map(n => <span key={n} style={{ border: '1px solid #000', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}
                <strong style={{ marginLeft: '12px' }}>2°P:</strong>
                {[1,2,3,4,5].map(n => <span key={n} style={{ border: '1px solid #000', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>)}
              </div>
            </div>

            {/* Árbitros y resultados */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellL, width: '40%' }}>
                    <strong>ÁRBITRO 1:</strong>
                    <select value={arbitro1} onChange={e => setArbitro1(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '10px', marginLeft: '4px' }}>
                      <option value="">Seleccionar...</option>
                      {arbitros.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  </td>
                  <td style={{ ...cell, width: '30%' }}>
                    <strong>RESULTADO 1ER PERÍODO:</strong>
                    <input value={resultado1p.local} onChange={e => setResultado1p(r => ({ ...r, local: e.target.value }))} style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/>
                    —
                    <input value={resultado1p.visitante} onChange={e => setResultado1p(r => ({ ...r, visitante: e.target.value }))} style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/>
                  </td>
                  <td rowSpan={4} style={{ ...cell, fontWeight: '900', fontSize: '14px', textAlign: 'center', background: '#f1f3f4' }}>
                    RESULTADO FINAL<br/>
                    <span style={{ fontSize: '24px', color: '#1a3a8a' }}>{resultadoFinal.local} — {resultadoFinal.visitante}</span><br/>
                    <span style={{ fontSize: '10px' }}>{partido.home?.name} vs {partido.away?.name}</span>
                  </td>
                </tr>
                <tr>
                  <td style={cellL}>
                    <strong>ÁRBITRO 2:</strong>
                    <select value={arbitro2} onChange={e => setArbitro2(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '10px', marginLeft: '4px' }}>
                      <option value="">Seleccionar...</option>
                      {arbitros.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <strong>RESULTADO 2DO PERÍODO:</strong>
                    <input value={resultado2p.local} onChange={e => setResultado2p(r => ({ ...r, local: e.target.value }))} style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/>
                    —
                    <input value={resultado2p.visitante} onChange={e => setResultado2p(r => ({ ...r, visitante: e.target.value }))} style={{ ...inputCell, width: '30px', display: 'inline', borderBottom: '1px solid #000' }}/>
                  </td>
                </tr>
                <tr>
                  <td style={cellL}><strong>ANOTADOR:</strong> <input value={anotador} onChange={e => setAnotador(e.target.value)} style={{ ...inputCellL, width: '150px', display: 'inline', borderBottom: '1px solid #000' }}/></td>
                  <td style={cellL} rowSpan={2}><strong>OBSERVACIONES:</strong><br/><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', fontSize: '10px', resize: 'none', minHeight: '40px' }}/></td>
                </tr>
                <tr>
                  <td style={cellL}><strong>CRONÓMETRO:</strong> <input value={cronometro} onChange={e => setCronometro(e.target.value)} style={{ ...inputCellL, width: '150px', display: 'inline', borderBottom: '1px solid #000' }}/></td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '10px', color: '#5f6368', marginTop: '4px' }}>
              Generado por GOLMEBOL — {new Date().toLocaleDateString('es-CO')}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
