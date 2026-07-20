import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const S = {
  card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)', gold: '#f9a825',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'9px 12px', color:S.text, fontSize:'.82rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.66rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em' }

// ── Categorías: tabla, frecuencia recomendada y campos (config-driven, así
// el formulario y las gráficas se generan solos para las 5 categorías). ──
const CATEGORIAS = [
  {
    key:'medidas', tabla:'escuela_medidas', label:'📏 Medidas físicas', frecuencia:'Peso cada mes · estatura/envergadura/pie cada 3-6 meses',
    campos:[
      { key:'peso_kg', label:'Peso (kg)', step:0.1 },
      { key:'estatura_cm', label:'Estatura (cm)', step:0.5 },
      { key:'envergadura_cm', label:'Envergadura (cm)', step:0.5 },
      { key:'talla_pie', label:'Talla de pie', step:0.5 },
    ],
    destacados:['peso_kg','estatura_cm'],
  },
  {
    key:'fisicas', tabla:'escuela_pruebas_fisicas', label:'⚡ Pruebas físicas', frecuencia:'Cada 3 meses',
    campos:[
      { key:'velocidad_seg', label:'Velocidad 20-30m (seg)', step:0.01 },
      { key:'agilidad_seg', label:'Agilidad / zigzag (seg)', step:0.01 },
      { key:'resistencia_nivel', label:'Resistencia (Yo-Yo / Course Navette)', step:0.1 },
      { key:'salto_vertical_cm', label:'Salto vertical (cm)', step:0.5 },
      { key:'flexibilidad_cm', label:'Flexibilidad (cm)', step:0.5 },
      { key:'fuerza_reps', label:'Fuerza (repeticiones)', step:1 },
    ],
    destacados:['velocidad_seg','resistencia_nivel'],
  },
  {
    key:'tecnica', tabla:'escuela_tecnica', label:'⚽ Evaluación técnica', frecuencia:'Cada 2-3 meses · escala 1 a 10', escala10:true,
    campos:[
      { key:'control', label:'Control del balón' },
      { key:'pase_corto', label:'Pase corto' },
      { key:'pase_largo', label:'Pase largo' },
      { key:'conduccion', label:'Conducción' },
      { key:'regate', label:'Regate' },
      { key:'remate', label:'Remate' },
      { key:'cabeceo', label:'Cabeceo' },
      { key:'ambas_piernas', label:'Dominio con ambas piernas' },
    ],
  },
  {
    key:'tactica', tabla:'escuela_tactica', label:'🧠 Evaluación táctica', frecuencia:'Cada 3 meses · escala 1 a 10', escala10:true,
    campos:[
      { key:'posicionamiento', label:'Posicionamiento' },
      { key:'decisiones', label:'Toma de decisiones' },
      { key:'comprension', label:'Comprensión del juego' },
      { key:'marcacion', label:'Marcación' },
      { key:'movimientos_sin_balon', label:'Movimientos sin balón' },
    ],
  },
  {
    key:'disciplina', tabla:'escuela_disciplina', label:'🤝 Disciplina y actitud', frecuencia:'Mensual · escala 1 a 10', escala10:true,
    campos:[
      { key:'puntualidad', label:'Puntualidad' },
      { key:'asistencia', label:'Asistencia' },
      { key:'actitud', label:'Actitud' },
      { key:'trabajo_equipo', label:'Trabajo en equipo' },
      { key:'liderazgo', label:'Liderazgo' },
      { key:'respeto', label:'Respeto' },
      { key:'esfuerzo', label:'Esfuerzo' },
    ],
  },
]

function fmtFecha(f) {
  if (!f) return ''
  const d = new Date(f + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'2-digit' })
}

// Mini gráfica de línea en SVG, sin librerías externas.
function Spark({ historial, campoKey, color = S.cyan }) {
  const puntos = historial.filter(h => h[campoKey] != null).map(h => ({ fecha:h.fecha, value:Number(h[campoKey]) }))
  if (puntos.length === 0) return null
  if (puntos.length === 1) {
    return <div style={{ fontSize:'.72rem', color:S.text2 }}>{fmtFecha(puntos[0].fecha)}: <b style={{ color }}>{puntos[0].value}</b> <span style={{ color:S.muted }}>(falta otro registro para ver la evolución)</span></div>
  }
  const vals = puntos.map(p => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = (max - min) || 1
  const w = 280, h = 46
  const coords = puntos.map((p,i) => {
    const x = (i / (puntos.length - 1)) * w
    const y = h - ((p.value - min) / range) * h
    return { x, y, v:p.value }
  })
  const path = coords.map(c => `${c.x},${c.y}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width:'100%', height:h, display:'block' }} preserveAspectRatio="none">
        <polyline points={path} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke"/>
        {coords.map((c,i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill={color}/>)}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.64rem', color:S.muted, marginTop:2 }}>
        <span>{fmtFecha(puntos[0].fecha)}: {puntos[0].value}</span>
        <span style={{ color, fontWeight:700 }}>{fmtFecha(puntos[puntos.length-1].fecha)}: {puntos[puntos.length-1].value}</span>
      </div>
    </div>
  )
}

// Cadena de valores tipo "6 → 8 → 9" para campos en escala 1-10.
function Cadena({ historial, campoKey }) {
  const puntos = historial.filter(h => h[campoKey] != null).map(h => Number(h[campoKey]))
  if (puntos.length === 0) return <span style={{ color:S.muted }}>—</span>
  return (
    <span>
      {puntos.map((v,i) => (
        <span key={i}>
          <b style={{ color: i === puntos.length-1 ? S.cyan : S.text2 }}>{v}</b>
          {i < puntos.length-1 && <span style={{ color:S.muted }}> → </span>}
        </span>
      ))}
    </span>
  )
}

function today() { return new Date().toISOString().slice(0,10) }

function Categoria({ cat, historial, editable, onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ fecha: today() })
  const [guardando, setGuardando] = useState(false)

  const ultimo = historial[historial.length - 1]

  async function guardar() {
    setGuardando(true)
    const payload = { fecha: form.fecha || today() }
    cat.campos.forEach(c => {
      if (form[c.key] !== undefined && form[c.key] !== '') payload[c.key] = Number(form[c.key])
    })
    // IMC automático si esta categoría trae peso y estatura juntos
    if (payload.peso_kg && payload.estatura_cm) {
      payload.imc = Math.round((payload.peso_kg / Math.pow(payload.estatura_cm/100, 2)) * 10) / 10
    }
    await onAgregar(cat, payload)
    setForm({ fecha: today() })
    setGuardando(false)
    setAbierto(false)
  }

  return (
    <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:4 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'.86rem' }}>{cat.label}</div>
          <div style={{ fontSize:'.66rem', color:S.muted, marginTop:1 }}>{cat.frecuencia}</div>
        </div>
        {editable && (
          <button onClick={() => setAbierto(a => !a)} style={{ background:S.cyanDim, border:`1px solid ${S.cyan}55`, color:S.cyan, borderRadius:8, padding:'5px 10px', fontSize:'.72rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
            {abierto ? 'Cancelar' : '+ Registrar'}
          </button>
        )}
      </div>

      {abierto && (
        <div style={{ background:S.card2, borderRadius:10, padding:12, margin:'10px 0' }}>
          <div style={{ marginBottom:8 }}>
            <label style={lbl}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha:e.target.value }))} style={inp}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {cat.campos.map(c => (
              <div key={c.key}>
                <label style={lbl}>{c.label}</label>
                <input type="number" step={cat.escala10 ? 1 : (c.step ?? 0.1)} min={cat.escala10 ? 1 : undefined} max={cat.escala10 ? 10 : undefined}
                  value={form[c.key] ?? ''} onChange={e => setForm(f => ({ ...f, [c.key]:e.target.value }))} style={inp} placeholder={cat.escala10 ? '1-10' : 'Opcional'}/>
              </div>
            ))}
          </div>
          <button onClick={guardar} disabled={guardando} style={{ width:'100%', padding:'9px', background:S.cyan, border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:800, fontSize:'.78rem', opacity:guardando?.7:1 }}>
            {guardando ? 'Guardando...' : 'Guardar registro'}
          </button>
        </div>
      )}

      {historial.length === 0 ? (
        <div style={{ fontSize:'.74rem', color:S.muted, marginTop:6 }}>Todavía no hay registros.</div>
      ) : cat.escala10 ? (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
          {cat.campos.map(c => (
            <div key={c.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'.76rem' }}>
              <span style={{ color:S.text2 }}>{c.label}</span>
              <Cadena historial={historial} campoKey={c.key}/>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop:8 }}>
          {cat.destacados ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {cat.destacados.map(k => {
                const campo = cat.campos.find(c => c.key === k)
                return (
                  <div key={k}>
                    <div style={{ fontSize:'.72rem', color:S.text2, marginBottom:4 }}>{campo.label}</div>
                    <Spark historial={historial} campoKey={k}/>
                  </div>
                )
              })}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', fontSize:'.72rem', color:S.muted }}>
                {cat.campos.filter(c => !cat.destacados.includes(c.key)).map(c => (
                  ultimo?.[c.key] != null ? <span key={c.key}>{c.label}: <b style={{ color:S.text2 }}>{ultimo[c.key]}</b></span> : null
                ))}
                {ultimo?.imc != null && <span>IMC: <b style={{ color:S.text2 }}>{ultimo.imc}</b></span>}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', fontSize:'.76rem', color:S.text2 }}>
              {cat.campos.map(c => ultimo?.[c.key] != null ? <span key={c.key}>{c.label}: <b>{ultimo[c.key]}</b></span> : null)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EstadisticasPartidos({ registros }) {
  if (registros.length === 0) return null
  return (
    <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
      <div style={{ fontWeight:700, fontSize:'.86rem', marginBottom:2 }}>📊 Historial de partidos</div>
      <div style={{ fontSize:'.66rem', color:S.muted, marginBottom:10 }}>Minutos, recuperaciones, pases y calificación — se registran al finalizar cada partido.</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {registros.map(r => (
          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:S.card2, borderRadius:10, fontSize:'.74rem' }}>
            <div>
              <div style={{ fontWeight:700, color:S.text }}>{r.partido?.rival || 'Rival'}</div>
              <div style={{ color:S.muted, fontSize:'.66rem' }}>{fmtFecha(r.partido?.fecha)}</div>
            </div>
            <div style={{ display:'flex', gap:12, color:S.text2, textAlign:'center' }}>
              {r.minutos != null && <div><div style={{ fontWeight:700 }}>{r.minutos}'</div><div style={{ fontSize:'.6rem', color:S.muted }}>min</div></div>}
              {r.recuperaciones != null && <div><div style={{ fontWeight:700 }}>{r.recuperaciones}</div><div style={{ fontSize:'.6rem', color:S.muted }}>recup.</div></div>}
              {r.pases_acertados != null && <div><div style={{ fontWeight:700 }}>{r.pases_acertados}</div><div style={{ fontSize:'.6rem', color:S.muted }}>pases</div></div>}
              {r.calificacion != null && <div><div style={{ fontWeight:700, color:S.gold }}>{r.calificacion}</div><div style={{ fontSize:'.6rem', color:S.muted }}>nota</div></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Ficha de Evolución del Jugador: mediciones físicas, pruebas, técnica,
// táctica, disciplina y estadísticas de partido — cada una con su propia
// frecuencia recomendada y gráfica de evolución en el tiempo.
// editable=true → el coordinador puede agregar registros nuevos.
export default function FichaEvolucion({ jugadorId, editable = false }) {
  const [datos, setDatos] = useState(null)
  const [partidoStats, setPartidoStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (jugadorId) fetchTodo() }, [jugadorId])

  async function fetchTodo() {
    setLoading(true)
    const resultados = {}
    for (const cat of CATEGORIAS) {
      const { data } = await supabase.from(cat.tabla).select('*').eq('jugador_id', jugadorId).order('fecha', { ascending:true })
      resultados[cat.key] = data || []
    }
    setDatos(resultados)
    const { data: ps } = await supabase.from('escuela_partido_stats').select('*, partido:partido_id(rival, fecha)').eq('jugador_id', jugadorId).order('created_at', { ascending:false })
    setPartidoStats(ps || [])
    setLoading(false)
  }

  async function handleAgregar(cat, payload) {
    const { data, error } = await supabase.from(cat.tabla).insert({ jugador_id: jugadorId, ...payload }).select().single()
    if (!error && data) {
      setDatos(d => ({ ...d, [cat.key]: [...d[cat.key], data].sort((a,b) => a.fecha.localeCompare(b.fecha)) }))
    }
  }

  if (loading || !datos) return <div style={{ fontSize:'.78rem', color:S.muted, textAlign:'center', padding:'16px 0' }}>Cargando ficha de evolución...</div>

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:'.95rem', color:S.text, margin:'18px 0 4px' }}>📈 Ficha de evolución</div>
      <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:14 }}>Así ha ido mejorando con el paso de los meses.</div>
      {CATEGORIAS.map(cat => (
        <Categoria key={cat.key} cat={cat} historial={datos[cat.key]} editable={editable} onAgregar={handleAgregar}/>
      ))}
      <EstadisticasPartidos registros={partidoStats}/>
    </div>
  )
}
