import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, Medal, Building2, ArrowRight, Plus } from 'lucide-react'
import EscuelaPageHeader from '../components/EscuelaPageHeader'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  green: '#22c55e', greenDim: 'rgba(34,197,94,.14)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { nombre:'', temporada:'', fecha_inicio:'', fecha_fin:'' }

function IconoResultado({ r, size = 20 }) {
  const t = (r || '').toLowerCase()
  if (t.includes('subcampe') || t.includes('semi')) return <Medal size={size} color={S.gold}/>
  return <Trophy size={size} color={S.gold}/>
}

export default function EscuelaTorneosPage() {
  const navigate = useNavigate()
  const [profesor, setProfesor] = useState(null)
  const [escuela, setEscuela] = useState(null)
  const [torneos, setTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).single()
    if (!p || !(p.rol === 'profesor' || p.es_profesor || p.es_profesor_coordinador)) { navigate('/jugador'); return }
    if (!p.escuela_id) { navigate('/escuela'); return }
    setProfesor(p)

    const { data: esc } = await supabase.from('teams').select('*').eq('id', p.escuela_id).single()
    setEscuela(esc || null)

    const { data: t } = await supabase.from('escuela_torneos').select('*').eq('escuela_id', p.escuela_id).order('created_at', { ascending:false })
    setTorneos(t || [])
    setLoading(false)
  }

  const esCoordinador = !!profesor?.es_profesor_coordinador

  async function handleCrear() {
    setError('')
    if (!form.nombre.trim()) return setError('Ponle un nombre al torneo')
    setGuardando(true)
    const { data, error: err } = await supabase.from('escuela_torneos')
      .insert({ escuela_id: escuela.id, nombre: form.nombre.trim(), temporada: form.temporada.trim() || null, fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null })
      .select().single()
    setGuardando(false)
    if (err || !data) { setError('Error al crear: ' + (err?.message || '')); return }
    setShowForm(false); setForm(EMPTY)
    navigate(`/escuela/torneos/${data.id}`)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.green, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <EscuelaPageHeader escuela={escuela} kicker={escuela?.name} titulo="TORNEOS"
        subtitulo="Torneos en los que participa"
        accion={esCoordinador ? (
          <button onClick={() => { setForm(EMPTY); setShowForm(s => !s) }}
            style={{ display:'flex', alignItems:'center', gap:'6px', background:S.green, border:'none', borderRadius:'12px', padding:'11px 16px', cursor:'pointer', color:'#07240f', fontWeight:'900', fontSize:'.72rem', letterSpacing:'.02em', whiteSpace:'nowrap', flexShrink:0 }}>
            {showForm ? 'CANCELAR' : (<><Plus size={15} strokeWidth={3}/> AGREGAR TORNEO</>)}
          </button>
        ) : null}/>

      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'18px 16px' }}>

        {(escuela?.torneos_campeon > 0 || escuela?.torneos_subcampeon > 0 || escuela?.torneos_tercero > 0) && (
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            {escuela.torneos_campeon > 0 && (
              <div style={{ flex:1, minWidth:90, background:S.card, border:`1px solid ${S.gold}55`, borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:900, color:S.gold }}>🏆 {escuela.torneos_campeon}</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:2 }}>Campeonatos</div>
              </div>
            )}
            {escuela.torneos_subcampeon > 0 && (
              <div style={{ flex:1, minWidth:90, background:S.card, border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:900, color:S.text2 }}>🥈 {escuela.torneos_subcampeon}</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:2 }}>Subcampeonatos</div>
              </div>
            )}
            {escuela.torneos_tercero > 0 && (
              <div style={{ flex:1, minWidth:90, background:S.card, border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                <div style={{ fontSize:'1.3rem', fontWeight:900, color:S.text2 }}>🥉 {escuela.torneos_tercero}</div>
                <div style={{ fontSize:'.62rem', color:S.muted, marginTop:2 }}>Terceros puestos</div>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'16px', padding:'18px', marginBottom:'18px' }}>
            <div style={{ fontWeight:'700', fontSize:'.95rem', marginBottom:'14px' }}>Nuevo torneo</div>
            <div style={{ marginBottom:'12px' }}>
              <label style={lbl}>Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre:e.target.value }))} style={inp} placeholder="Ej: Intercolegiados 2026"/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Temporada</label>
                <input value={form.temporada} onChange={e => setForm(f => ({ ...f, temporada:e.target.value }))} style={inp} placeholder="Ej: 2026-I"/>
              </div>
              <div>
                <label style={lbl}>Fecha de inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio:e.target.value }))} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Fecha de fin</label>
                <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin:e.target.value }))} style={inp}/>
              </div>
            </div>
            {error && <div style={{ color:'#ff6b6b', fontSize:'.78rem', marginBottom:'12px' }}>{error}</div>}
            <button onClick={handleCrear} disabled={guardando}
              style={{ width:'100%', padding:'11px', background:S.green, border:'none', borderRadius:'10px', cursor:'pointer', color:'#07240f', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>
              {guardando ? 'Creando...' : 'Crear torneo'}
            </button>
          </div>
        )}

        {torneos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ marginBottom:'10px', display:'flex', justifyContent:'center' }}><Trophy size={30} color={S.muted}/></div>
            <div style={{ fontSize:'.85rem' }}>Todavía no hay torneos registrados.</div>
          </div>
        ) : torneos.map(t => (
          <div key={t.id} onClick={() => navigate(`/escuela/torneos/${t.id}`)}
            style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
            {t.resultado_final ? <IconoResultado r={t.resultado_final}/> : <Building2 size={20} color={S.muted}/>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:'700', fontSize:'.9rem' }}>{t.nombre}</div>
              <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'2px' }}>
                {t.temporada && <span>{t.temporada} · </span>}
                {t.fase_actual ? t.fase_actual : (t.estado === 'finalizado' ? 'Finalizado' : 'En curso')}
                {t.resultado_final && <span> · {t.resultado_final}</span>}
              </div>
            </div>
            <ArrowRight size={15} color={S.muted}/>
          </div>
        ))}
      </div>
    </div>
  )
}
