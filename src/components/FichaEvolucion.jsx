import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import EscuelaFeatureCard from './EscuelaFeatureCard'

const S = {
  card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)', gold: '#f9a825',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'9px 12px', color:S.text, fontSize:'.82rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.66rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'3px', textTransform:'uppercase', letterSpacing:'.04em' }

// Fotos de fondo tenues para cada tarjeta — mismas que ya se usan en el
// resto del portal de escuela, así no se depende de subir imágenes nuevas.
const IMG_MEDIDAS    = 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=60'
const IMG_FISICAS    = 'https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=800&q=60'
const IMG_TECNICA    = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=60'
const IMG_TACTICA    = 'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=60'
const IMG_DISCIPLINA = 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=60'

// ── Categorías: tabla, frecuencia recomendada y campos (config-driven, así
// el formulario y las gráficas se generan solos para las 5 categorías). ──
const CATEGORIAS = [
  {
    key:'medidas', tabla:'escuela_medidas', emoji:'📏', tituloCorto:'Medidas', label:'📏 Medidas físicas', frecuencia:'Peso cada mes · estatura/envergadura/pie cada 3-6 meses', bg: IMG_MEDIDAS,
    campos:[
      { key:'peso_kg', label:'Peso (kg)', step:0.1 },
      { key:'estatura_cm', label:'Estatura (cm)', step:0.5 },
      { key:'envergadura_cm', label:'Envergadura (cm)', step:0.5 },
      { key:'talla_pie', label:'Talla de pie', step:0.5 },
    ],
    destacados:['peso_kg','estatura_cm'],
  },
  {
    key:'fisicas', tabla:'escuela_pruebas_fisicas', emoji:'⚡', tituloCorto:'Pruebas físicas', label:'⚡ Pruebas físicas', frecuencia:'Cada 3 meses', bg: IMG_FISICAS,
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
    key:'tecnica', tabla:'escuela_tecnica', emoji:'⚽', tituloCorto:'Técnica', label:'⚽ Evaluación técnica', frecuencia:'Cada 2-3 meses · escala 1 a 10', escala10:true, bg: IMG_TECNICA,
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
    key:'tactica', tabla:'escuela_tactica', emoji:'🧠', tituloCorto:'Táctica', label:'🧠 Evaluación táctica', frecuencia:'Cada 3 meses · escala 1 a 10', escala10:true, bg: IMG_TACTICA,
    campos:[
      { key:'posicionamiento', label:'Posicionamiento' },
      { key:'decisiones', label:'Toma de decisiones' },
      { key:'comprension', label:'Comprensión del juego' },
      { key:'marcacion', label:'Marcación' },
      { key:'movimientos_sin_balon', label:'Movimientos sin balón' },
    ],
  },
  {
    key:'disciplina', tabla:'escuela_disciplina', emoji:'🤝', tituloCorto:'Disciplina', label:'🤝 Disciplina y actitud', frecuencia:'Mensual · escala 1 a 10', escala10:true, bg: IMG_DISCIPLINA,
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
function Spark({ historial, campoKey, color = S.green }) {
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
          <b style={{ color: i === puntos.length-1 ? S.green : S.text2 }}>{v}</b>
          {i < puntos.length-1 && <span style={{ color:S.muted }}> → </span>}
        </span>
      ))}
    </span>
  )
}

function today() { return new Date().toISOString().slice(0,10) }

// Modal que se abre al tocar la tarjeta cuadrada de una categoría — trae el
// formulario para registrar (si es editable) y el historial/evolución.
function CategoriaModal({ cat, historial, editable, onAgregar, onClose }) {
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
    if (payload.peso_kg && payload.estatura_cm) {
      payload.imc = Math.round((payload.peso_kg / Math.pow(payload.estatura_cm/100, 2)) * 10) / 10
    }
    await onAgregar(cat, payload)
    setForm({ fecha: today() })
    setGuardando(false)
    setAbierto(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:600, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:S.card, borderTop:`1px solid ${S.border}`, borderRadius:'20px 20px 0 0', width:'100%', maxWidth:'560px', maxHeight:'88vh', overflowY:'auto', padding:'18px 18px 26px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:4 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:'.95rem' }}>{cat.label}</div>
            <div style={{ fontSize:'.7rem', color:S.muted, marginTop:2 }}>{cat.frecuencia}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:S.muted, display:'flex', flexShrink:0 }}><X size={20}/></button>
        </div>

        {editable && (
          <div style={{ marginTop:14 }}>
            {!abierto ? (
              <button onClick={() => setAbierto(true)} style={{ width:'100%', background:S.greenDim, border:`1px solid ${S.green}55`, color:S.green, borderRadius:10, padding:'10px', fontSize:'.8rem', fontWeight:800, cursor:'pointer' }}>
                + Registrar
              </button>
            ) : (
              <div style={{ background:S.card2, borderRadius:10, padding:12, marginBottom:14 }}>
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
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={guardar} disabled={guardando} style={{ flex:1, padding:'9px', background:S.green, border:'none', borderRadius:8, cursor:'pointer', color:'#07240f', fontWeight:800, fontSize:'.78rem', opacity:guardando?.7:1 }}>
                    {guardando ? 'Guardando...' : 'Guardar registro'}
                  </button>
                  <button onClick={() => setAbierto(false)} style={{ padding:'9px 14px', background:'none', border:`1px solid ${S.border}`, borderRadius:8, cursor:'pointer', color:S.muted, fontSize:'.78rem' }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop:16 }}>
          {historial.length === 0 ? (
            <div style={{ fontSize:'.78rem', color:S.muted, textAlign:'center', padding:'10px 0' }}>Todavía no hay registros.</div>
          ) : cat.escala10 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {cat.campos.map(c => (
                <div key={c.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'.8rem' }}>
                  <span style={{ color:S.text2 }}>{c.label}</span>
                  <Cadena historial={historial} campoKey={c.key}/>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {cat.destacados ? (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {cat.destacados.map(k => {
                    const campo = cat.campos.find(c => c.key === k)
                    return (
                      <div key={k}>
                        <div style={{ fontSize:'.75rem', color:S.text2, marginBottom:4 }}>{campo.label}</div>
                        <Spark historial={historial} campoKey={k}/>
                      </div>
                    )
                  })}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', fontSize:'.74rem', color:S.muted }}>
                    {cat.campos.filter(c => !cat.destacados.includes(c.key)).map(c => (
                      ultimo?.[c.key] != null ? <span key={c.key}>{c.label}: <b style={{ color:S.text2 }}>{ultimo[c.key]}</b></span> : null
                    ))}
                    {ultimo?.imc != null && <span>IMC: <b style={{ color:S.text2 }}>{ultimo.imc}</b></span>}
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', fontSize:'.78rem', color:S.text2 }}>
                  {cat.campos.map(c => ultimo?.[c.key] != null ? <span key={c.key}>{c.label}: <b>{ultimo[c.key]}</b></span> : null)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EstadisticasPartidos({ registros }) {
  if (registros.length === 0) return null
  const totalMinutos = registros.reduce((s, r) => s + (r.minutos || 0), 0)
  const totalTitular = registros.filter(r => r.titular).length
  return (
    <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:14, padding:16, marginBottom:12 }}>
      <div style={{ fontWeight:700, fontSize:'.86rem', marginBottom:2 }}>📊 Historial de partidos</div>
      <div style={{ fontSize:'.66rem', color:S.muted, marginBottom:10 }}>Titular/suplente y minutos se calculan solos al finalizar cada partido; recuperaciones, pases y calificación los carga el profesor.</div>
      <div style={{ display:'flex', gap:16, marginBottom:12, padding:'8px 10px', background:S.card2, borderRadius:10 }}>
        <div><div style={{ fontWeight:800, fontSize:'.95rem', color:S.green }}>⏱️ {totalMinutos}'</div><div style={{ fontSize:'.6rem', color:S.muted }}>minutos totales</div></div>
        <div><div style={{ fontWeight:800, fontSize:'.95rem', color:S.gold }}>★ {totalTitular}/{registros.length}</div><div style={{ fontSize:'.6rem', color:S.muted }}>partidos de titular</div></div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {registros.map(r => (
          <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:S.card2, borderRadius:10, fontSize:'.74rem' }}>
            <div>
              <div style={{ fontWeight:700, color:S.text, display:'flex', alignItems:'center', gap:6 }}>
                {r.partido?.rival || 'Rival'}
                {r.titular != null && (
                  <span style={{ fontSize:'.58rem', fontWeight:800, color: r.titular ? S.gold : S.muted, background: r.titular ? 'rgba(249,168,37,.15)' : 'rgba(255,255,255,.06)', borderRadius:6, padding:'1px 5px' }}>
                    {r.titular ? '★ Titular' : 'Suplente'}
                  </span>
                )}
              </div>
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
// táctica, disciplina y estadísticas de partido. Cada categoría se ve como
// una tarjeta cuadrada (mismo estilo que el resto del portal de escuela) y
// al tocarla se abre el formulario/historial en una hoja abajo.
// editable=true → el coordinador puede agregar registros nuevos.
export default function FichaEvolucion({ jugadorId, editable = false }) {
  const [datos, setDatos] = useState(null)
  const [partidoStats, setPartidoStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [catAbierta, setCatAbierta] = useState(null)

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
      <div style={{ fontSize:'.72rem', color:S.muted, marginBottom:14 }}>Así ha ido mejorando con el paso de los meses. Toca una tarjeta para ver el detalle{editable ? ' o registrar' : ''}.</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'10px', marginBottom:'14px' }}>
        {CATEGORIAS.map(cat => {
          const historial = datos[cat.key]
          const ultimo = historial[historial.length - 1]
          return (
            <EscuelaFeatureCard key={cat.key} onClick={() => setCatAbierta(cat)} bg={cat.bg}
              icon={<span style={{ fontSize:'1.7rem' }}>{cat.emoji}</span>}
              title={cat.tituloCorto}
              desc={ultimo ? `Último: ${fmtFecha(ultimo.fecha)}` : 'Sin registros'}/>
          )
        })}
      </div>

      <EstadisticasPartidos registros={partidoStats}/>

      {catAbierta && (
        <CategoriaModal cat={catAbierta} historial={datos[catAbierta.key]} editable={editable}
          onAgregar={handleAgregar} onClose={() => setCatAbierta(null)}/>
      )}
    </div>
  )
}
