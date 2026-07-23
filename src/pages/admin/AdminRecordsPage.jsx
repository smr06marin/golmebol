import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { calcularRecordsAutomaticos } from '../../lib/recordsAutomaticos'

const COLORES = ['#f9a825','#00ddd0','#e8710a','#9955ff','#d93025','#00ee55','#1a73e8','#ff69b4','#4488ff','#a1887f']
const ICONOS  = ['⭐','⚽','🏆','🔥','⚡','🎩','🧤','✅','💥','🎮','🥇','👑','🎯','💪','🛡️']

// Récords que se calculan solos (no se crean a mano) — el admin solo decide si se muestran o no
const RECORDS_AUTOMATICOS = [
  { id: 'max_goleador',  icono: '⚽', nombre: 'Máximo goleador histórico' },
  { id: 'goles_partido', icono: '💥', nombre: 'Más goles en un partido' },
  { id: 'hat_tricks',    icono: '🎩', nombre: 'Más hat-tricks' },
  { id: 'victorias',     icono: '🏅', nombre: 'Más victorias' },
  { id: 'mas_partidos',  icono: '🎽', nombre: 'Más partidos jugados' },
  { id: 'racha_vic',     icono: '🔥', nombre: 'Racha de victorias' },
  { id: 'racha_gol',     icono: '🔥', nombre: 'Racha goleadora' },
  { id: 'arcos_cero',    icono: '🧤', nombre: 'Arcos en cero (arquero)' },
  { id: 'fair_play',     icono: '🤝', nombre: 'Fair play' },
  { id: 'partido_goles', icono: '⚡', nombre: 'Partido más goleador' },
  { id: 'goleada',       icono: '🚀', nombre: 'Mayor goleada' },
  { id: 'eq_goles',      icono: '🛡️', nombre: 'Equipo más goleador' },
  { id: 'eq_victorias',  icono: '👑', nombre: 'Equipo más victorioso' },
]

const inp = {
  background: '#fff', border: '1px solid #dadce0', borderRadius: '8px',
  padding: '8px 12px', color: '#202124', fontSize: '.85rem', outline: 'none',
  fontFamily: 'system-ui, sans-serif', width: '100%', boxSizing: 'border-box',
}

export default function AdminRecordsPage() {
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [autoOcultos, setAutoOcultos] = useState(new Set()) // ids de récords automáticos apagados
  const [autoDatos,   setAutoDatos]   = useState({})        // id -> { titulo, nombre, subtitulo, descripcion } (lo que realmente se mostraría)
  const [loadingAuto, setLoadingAuto] = useState(true)

  const formVacio = { titulo: '', nombre: '', subtitulo: '', descripcion: '', icono: '⭐', color: '#f9a825', orden: 0 }
  const [form, setForm] = useState(formVacio)

  useEffect(() => { fetchRecords(); fetchAutoConfig(); fetchAutoDatos() }, [])

  async function fetchAutoConfig() {
    const { data } = await supabase.from('records_config').select('id').eq('visible', false)
    setAutoOcultos(new Set((data || []).map(r => r.id)))
  }

  // Trae el dato REAL que se mostraría en cada récord automático (quién lo tiene,
  // con qué cifra), para que el admin vea exactamente qué va a salir antes de
  // decidir si lo oculta.
  async function fetchAutoDatos() {
    setLoadingAuto(true)
    const recs = await calcularRecordsAutomaticos()
    const map = {}
    recs.forEach(r => { map[r.id] = r })
    setAutoDatos(map)
    setLoadingAuto(false)
  }

  async function handleToggleAuto(id) {
    const ocultoActual = autoOcultos.has(id)
    const { error } = await supabase.from('records_config').upsert({ id, visible: ocultoActual, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      // Si no se guarda de verdad en la base de datos, el botón se ve como si
      // hubiera cambiado pero al volver a entrar se "reactiva solo" — por eso
      // es clave no tocar el estado local si esto falla, y avisar qué pasó
      // (la causa más común es que falte correr la migración records_config).
      showMsg(`No se pudo guardar: ${error.message}`, 'error')
      return
    }
    setAutoOcultos(prev => {
      const next = new Set(prev)
      if (ocultoActual) next.delete(id); else next.add(id)
      return next
    })
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchRecords() {
    setLoading(true)
    const { data } = await supabase.from('records_historicos').select('*').order('orden')
    setRecords(data || [])
    setLoading(false)
  }

  function handleEditar(r) {
    setEditando(r.id)
    setForm({ titulo: r.titulo, nombre: r.nombre, subtitulo: r.subtitulo || '', descripcion: r.descripcion || '', icono: r.icono || '⭐', color: r.color || '#f9a825', orden: r.orden || 0 })
    setShowForm(true)
  }

  function handleNuevo() {
    setEditando(null)
    setForm(formVacio)
    setShowForm(true)
  }

  async function handleGuardar() {
    if (!form.titulo.trim()) { showMsg('Ingresa el título', 'error'); return }
    if (!form.nombre.trim()) { showMsg('Ingresa el nombre', 'error'); return }
    setGuardando(true)
    if (editando) {
      await supabase.from('records_historicos').update({ ...form, orden: Number(form.orden) }).eq('id', editando)
      showMsg('Récord actualizado ✓')
    } else {
      await supabase.from('records_historicos').insert({ ...form, orden: Number(form.orden), activo: true })
      showMsg('Récord creado ✓')
    }
    setGuardando(false)
    setShowForm(false)
    setEditando(null)
    setForm(formVacio)
    fetchRecords()
  }

  async function handleToggle(r) {
    await supabase.from('records_historicos').update({ activo: !r.activo }).eq('id', r.id)
    fetchRecords()
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este récord?')) return
    await supabase.from('records_historicos').delete().eq('id', id)
    showMsg('Récord eliminado')
    fetchRecords()
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>
              {editando ? 'Editar récord' : 'Nuevo récord histórico'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Título del récord *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: 42 GOLES EN 12 PARTIDOS" style={inp}/>
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Nombre del poseedor *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: SEBASTIAN HOYOS" style={inp}/>
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Subtítulo</label>
                <input value={form.subtitulo} onChange={e => setForm(f => ({ ...f, subtitulo: e.target.value }))} placeholder="Ej: SANTANDER K-4" style={inp}/>
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: LIGA 2022" style={inp}/>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Ícono</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {ICONOS.map(ic => (
                      <div key={ic} onClick={() => setForm(f => ({ ...f, icono: ic }))}
                        style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', cursor: 'pointer', border: form.icono === ic ? '2px solid #1a73e8' : '1px solid #e8eaed', background: form.icono === ic ? '#e8f0fe' : '#f8f9fa' }}>
                        {ic}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Color</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {COLORES.map(c => (
                      <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #202124' : '2px solid transparent' }}/>
                    ))}
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #dadce0', padding: '1px', cursor: 'pointer' }}/>
                  </div>
                  {/* Preview */}
                  <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '10px', background: `${form.color}22`, border: `1.5px solid ${form.color}55`, borderLeft: `3px solid ${form.color}` }}>
                    <div style={{ fontSize: '.6rem', color: form.color, fontWeight: '800' }}>{form.icono} {form.titulo || 'TÍTULO'}</div>
                    <div style={{ fontSize: '.75rem', fontWeight: '900', color: '#202124', marginTop: '2px' }}>{form.nombre || 'NOMBRE'}</div>
                    {form.subtitulo && <div style={{ fontSize: '.65rem', color: form.color }}>{form.subtitulo}</div>}
                    {form.descripcion && <div style={{ fontSize: '.6rem', color: '#5f6368' }}>{form.descripcion}</div>}
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Orden (menor = primero)</label>
                <input type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} style={{ ...inp, width: '80px' }}/>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={handleGuardar} disabled={guardando}
                  style={{ flex: 1, padding: '11px', background: guardando ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: guardando ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.9rem' }}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear récord'}
                </button>
                <button onClick={() => { setShowForm(false); setEditando(null); setForm(formVacio) }}
                  style={{ padding: '11px 20px', background: '#f1f3f4', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#5f6368', fontWeight: '600', fontSize: '.9rem' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Récords automáticos: se calculan solos, aquí solo se decide si se muestran */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px' }}>Récords automáticos</h1>
        <p style={{ color: '#5f6368', margin: '0 0 14px', fontSize: '.875rem' }}>Se calculan solos con los datos de la liga. Apágalos si no quieres que salgan en la página pública (sin borrar nada).</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {RECORDS_AUTOMATICOS.map(r => {
            const activo = !autoOcultos.has(r.id)
            const dato = autoDatos[r.id]
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', opacity: activo ? 1 : .55 }}>
                <div style={{ fontSize: '1.05rem', flexShrink: 0 }}>{r.icono}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.85rem', fontWeight: '600', color: '#202124' }}>{r.nombre}</div>
                  {loadingAuto ? (
                    <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>Cargando dato...</div>
                  ) : dato ? (
                    <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '2px' }}>
                      Se mostraría: <strong style={{ color: '#202124' }}>{dato.nombre}</strong> — {dato.titulo}
                      {dato.subtitulo && <span> · {dato.subtitulo}</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px', fontStyle: 'italic' }}>Sin datos todavía — no se mostraría nada</div>
                  )}
                </div>
                <button onClick={() => handleToggleAuto(r.id)}
                  style={{ padding: '5px 10px', background: activo ? '#e6f4ea' : '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer', color: activo ? '#1e8e3e' : '#9aa0a6', fontSize: '.72rem', fontWeight: '600', flexShrink: 0 }}>
                  {activo ? '✓ Visible' : 'Oculto'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px' }}>Récords históricos</h1>
          <p style={{ color: '#5f6368', margin: 0, fontSize: '.875rem' }}>Gestiona los récords que aparecen en la página pública</p>
        </div>
        <button onClick={handleNuevo}
          style={{ padding: '9px 18px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '600', fontSize: '.85rem' }}>
          + Nuevo récord
        </button>
      </div>

      {records.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏆</div>
          <div style={{ fontSize: '.875rem' }}>No hay récords históricos aún</div>
          <div style={{ fontSize: '.78rem', marginTop: '4px' }}>Crea el primero con el botón de arriba</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {records.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', opacity: r.activo ? 1 : .5 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${r.color}22`, border: `1px solid ${r.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>{r.icono}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.68rem', fontWeight: '700', color: r.color, letterSpacing: '.06em' }}>{r.titulo}</div>
                <div style={{ fontWeight: '700', color: '#202124', fontSize: '.88rem' }}>{r.nombre}</div>
                {r.subtitulo && <div style={{ fontSize: '.72rem', color: '#5f6368' }}>{r.subtitulo}</div>}
                {r.descripcion && <div style={{ fontSize: '.68rem', color: '#9aa0a6' }}>{r.descripcion}</div>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => handleToggle(r)}
                  style={{ padding: '5px 10px', background: r.activo ? '#e6f4ea' : '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer', color: r.activo ? '#1e8e3e' : '#9aa0a6', fontSize: '.72rem', fontWeight: '600' }}>
                  {r.activo ? '✓ Activo' : 'Oculto'}
                </button>
                <button onClick={() => handleEditar(r)}
                  style={{ padding: '5px 10px', background: '#e8f0fe', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#1a73e8', fontSize: '.72rem', fontWeight: '600' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => handleEliminar(r.id)}
                  style={{ padding: '5px 10px', background: '#fce8e6', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#d93025', fontSize: '.72rem', fontWeight: '600' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
