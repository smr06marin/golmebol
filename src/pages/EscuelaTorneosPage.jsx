import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}
const inp = { width:'100%', background:S.card2, border:`1px solid ${S.border}`, borderRadius:'10px', padding:'10px 13px', color:S.text, fontSize:'.85rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.7rem', fontWeight:'600', color:S.muted, display:'block', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'.05em' }

const EMPTY = { nombre:'', temporada:'', fecha_inicio:'', fecha_fin:'' }

function iconoResultado(r) {
  if (!r) return '🏆'
  const t = r.toLowerCase()
  if (t.includes('campe') && !t.includes('sub')) return '🏆'
  if (t.includes('subcampe')) return '🥈'
  if (t.includes('semi')) return '🥉'
  return '🏆'
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
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'560px', margin:'0 auto' }}>
          <button onClick={() => navigate('/escuela')} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:S.muted, fontSize:'.75rem', marginBottom:'10px' }}>← Escuela</button>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontWeight:'800', fontSize:'1.05rem' }}>Torneos</div>
              <div style={{ fontSize:'.72rem', color:S.muted }}>{escuela?.name} · torneos en los que participa</div>
            </div>
            {esCoordinador && (
              <button onClick={() => { setForm(EMPTY); setShowForm(s => !s) }}
                style={{ background:S.cyan, border:'none', borderRadius:'10px', padding:'9px 16px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.82rem' }}>
                {showForm ? 'Cancelar' : '+ Torneo'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:'560px', margin:'0 auto', padding:'18px 16px' }}>

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
              style={{ width:'100%', padding:'11px', background:S.cyan, border:'none', borderRadius:'10px', cursor:'pointer', color:'#000', fontWeight:'800', fontSize:'.85rem', opacity:guardando?.7:1 }}>
              {guardando ? 'Creando...' : 'Crear torneo'}
            </button>
          </div>
        )}

        {torneos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'50px 20px', color:S.muted }}>
            <div style={{ fontSize:'2rem', marginBottom:'10px' }}>🏆</div>
            <div style={{ fontSize:'.85rem' }}>Todavía no hay torneos registrados.</div>
          </div>
        ) : torneos.map(t => (
          <div key={t.id} onClick={() => navigate(`/escuela/torneos/${t.id}`)}
            style={{ background:S.card, border:`1px solid ${S.border}`, borderRadius:'14px', padding:'14px 16px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
            <span style={{ fontSize:'1.5rem' }}>{t.resultado_final ? iconoResultado(t.resultado_final) : '🏟️'}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:'700', fontSize:'.9rem' }}>{t.nombre}</div>
              <div style={{ fontSize:'.7rem', color:S.muted, marginTop:'2px' }}>
                {t.temporada && <span>{t.temporada} · </span>}
                {t.fase_actual ? t.fase_actual : (t.estado === 'finalizado' ? 'Finalizado' : 'En curso')}
                {t.resultado_final && <span> · {t.resultado_final}</span>}
              </div>
            </div>
            <span style={{ color:S.muted }}>→</span>
          </div>
        ))}
      </div>
    </div>
  )
}
