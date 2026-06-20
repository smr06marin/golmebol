import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Users, Upload, X, Camera } from 'lucide-react'

const POSICIONES = {
  'Fútbol 5':  ['Portero', 'Cierre', 'Ala derecha', 'Ala izquierda', 'Pivot'],
  'Fútbol 7':  ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista', 'Extremo derecho', 'Extremo izquierdo', 'Delantero'],
  'Fútbol 11': ['Portero', 'Defensa central', 'Lateral derecho', 'Lateral izquierdo', 'Mediocampista defensivo', 'Mediocampista central', 'Mediocampista ofensivo', 'Extremo derecho', 'Extremo izquierdo', 'Delantero centro', 'Segunda punta'],
}

const GENEROS = ['Masculino', 'Femenino']

const EMPTY = {
  name: '', telefono: '', numero_cedula: '', city: '', genero: '',
  fecha_nacimiento: '',
  posicion_futbol5: '', posicion_futbol7: '', posicion_futbol11: '',
}

const input = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const label = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

export default function AdminJugadoresPage() {
  const [jugadores, setJugadores] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState({})
  const [msg, setMsg] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchJugadores() }, [])

  async function fetchJugadores() {
    const { data } = await supabase.from('players').select('*').order('name')
    setJugadores(data || [])
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave() {
    if (!form.name) return showMsg('El nombre es obligatorio', 'error')
    if (!form.telefono) return showMsg('El teléfono es obligatorio', 'error')
    if (!form.numero_cedula) return showMsg('El número de cédula es obligatorio', 'error')
    if (!form.city) return showMsg('La ciudad es obligatoria', 'error')
    if (!form.genero) return showMsg('El género es obligatorio', 'error')
    if (!form.fecha_nacimiento) return showMsg('La fecha de nacimiento es obligatoria', 'error')
    if (!form.posicion_futbol5 && !form.posicion_futbol7 && !form.posicion_futbol11) return showMsg('Debe seleccionar al menos una posición', 'error')
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('players').update(form).eq('id', editId)
      if (error) showMsg('Error al guardar', 'error')
      else { showMsg('Jugador actualizado ✓'); setEditId(null) }
    } else {
      const { error } = await supabase.from('players').insert(form)
      if (error) showMsg('Error al crear', 'error')
      else showMsg('Jugador creado ✓')
    }
    setForm(EMPTY)
    setShowForm(false)
    setLoading(false)
    fetchJugadores()
  }

  function handleEdit(j) {
    setForm({
      name: j.name || '', telefono: j.telefono || '',
      city: j.city || '', genero: j.genero || '',
      fecha_nacimiento: j.fecha_nacimiento || '',
      posicion_futbol5: j.posicion_futbol5 || '',
      posicion_futbol7: j.posicion_futbol7 || '',
      posicion_futbol11: j.posicion_futbol11 || '',
    })
    setEditId(j.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar jugador?')) return
    await supabase.from('players').delete().eq('id', id)
    fetchJugadores()
    showMsg('Eliminado')
  }

  async function handleFoto(jugador, file) {
    if (!file) return
    setUploading(u => ({ ...u, [jugador.id + '_foto']: true }))
    const ext = file.name.split('.').pop()
    const path = `fotos/${jugador.id}.${ext}`
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (error) { setUploading(u => ({ ...u, [jugador.id + '_foto']: false })); showMsg('Error al subir foto', 'error'); return }
    const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
    await supabase.from('players').update({ photo_url: urlData.publicUrl }).eq('id', jugador.id)
    setJugadores(prev => prev.map(j => j.id === jugador.id ? { ...j, photo_url: urlData.publicUrl } : j))
    setUploading(u => ({ ...u, [jugador.id + '_foto']: false }))
    showMsg('Foto subida ✓')
  }

  async function handleCedula(jugador, file, cara) {
    if (!file) return
    const key = jugador.id + '_' + cara
    setUploading(u => ({ ...u, [key]: true }))
    const ext = file.name.split('.').pop()
    const path = `${jugador.id}_${cara}.${ext}`
    const { error } = await supabase.storage.from('cedulas').upload(path, file, { upsert: true })
    if (error) { setUploading(u => ({ ...u, [key]: false })); showMsg('Error al subir cédula', 'error'); return }
    const { data: urlData } = supabase.storage.from('cedulas').getPublicUrl(path)
    const campo = cara === 'frontal' ? 'cedula_frontal_url' : 'cedula_trasera_url'
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', jugador.id)
    setJugadores(prev => prev.map(j => j.id === jugador.id ? { ...j, [campo]: urlData.publicUrl } : j))
    setUploading(u => ({ ...u, [key]: false }))
    showMsg('Cédula subida ✓')
  }

  const filtered = jugadores.filter(j => j.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Jugadores</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{jugadores.length} jugadores registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
          <Plus size={18}/> Nuevo jugador
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '20px' }}>
            {editId ? 'Editar jugador' : 'Nuevo jugador'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Datos personales */}
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>Datos personales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={label}>Nombre completo *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="Nombre completo"/>
              </div>
              <div>
                <label style={label}>Teléfono</label>
                <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} style={input} placeholder="300 000 0000"/>
              </div>
              <div>
  <label style={label}>Número de cédula</label>
  <input value={form.numero_cedula} onChange={e => setForm(f => ({ ...f, numero_cedula: e.target.value }))} style={input} placeholder="000000000"/>
</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={label}>Ciudad</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={input} placeholder="Ciudad"/>
              </div>
              <div>
                <label style={label}>Género</label>
                <select value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))} style={input}>
                  <option value="">Seleccionar</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Fecha de nacimiento</label>
                <input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={input}/>
              </div>
            </div>

            {/* Posiciones */}
            <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#5f6368', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px', marginTop: '8px' }}>Posiciones</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {Object.entries(POSICIONES).map(([modalidad, posiciones]) => (
                <div key={modalidad}>
                  <label style={label}>{modalidad}</label>
                  <select
                    value={form[`posicion_${modalidad.toLowerCase().replace('ú','u').replace(' ','')}`]}
                    onChange={e => setForm(f => ({ ...f, [`posicion_${modalidad.toLowerCase().replace('ú','u').replace(' ','')}`]: e.target.value }))}
                    style={input}
                  >
                    <option value="">No juega</option>
                    {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando...' : editId ? 'Actualizar' : 'Crear jugador'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setEditId(null) }}
              style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar jugador..." style={{ ...input, maxWidth: '320px' }}/>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
            <Users size={40} style={{ opacity: .3, marginBottom: '12px' }}/>
            <div style={{ fontSize: '.875rem' }}>No hay jugadores aún</div>
          </div>
        ) : (
          filtered.map((j, i) => (
            <div key={j.id} style={{ padding: '16px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Foto */}
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {j.photo_url
                      ? <img src={j.photo_url} alt={j.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                      : <Users size={22} color="#9aa0a6"/>
                    }
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{j.name}</div>
                    <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '2px', display: 'flex', gap: '8px' }}>
                      {j.telefono && <span>📞 {j.telefono}</span>}
                      {j.city && <span>📍 {j.city}</span>}
                      {j.genero && <span>· {j.genero}</span>}
                    </div>
                    {/* Posiciones */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {j.posicion_futbol5 && <span style={{ fontSize: '.7rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px' }}>F5: {j.posicion_futbol5}</span>}
                      {j.posicion_futbol7 && <span style={{ fontSize: '.7rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '2px 8px' }}>F7: {j.posicion_futbol7}</span>}
                      {j.posicion_futbol11 && <span style={{ fontSize: '.7rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px' }}>F11: {j.posicion_futbol11}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => handleEdit(j)}
                    style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                    <Pencil size={15}/>
                  </button>
                  <button onClick={() => handleDelete(j.id)}
                    style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={15}/>
                  </button>
                </div>
              </div>

              {/* Subir archivos */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#1a73e8', cursor: 'pointer', padding: '4px 10px', border: '1px solid #1a73e8', borderRadius: '6px' }}>
                  <Camera size={13}/> {uploading[j.id + '_foto'] ? 'Subiendo...' : j.photo_url ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => handleFoto(j, ev.target.files[0])} disabled={uploading[j.id + '_foto']}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#5f6368', cursor: 'pointer', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '6px' }}>
                  <Upload size={13}/> {uploading[j.id + '_frontal'] ? 'Subiendo...' : j.cedula_frontal_url ? '✓ Cédula frontal' : 'Cédula frontal'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => handleCedula(j, ev.target.files[0], 'frontal')} disabled={uploading[j.id + '_frontal']}/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#5f6368', cursor: 'pointer', padding: '4px 10px', border: '1px solid #dadce0', borderRadius: '6px' }}>
                  <Upload size={13}/> {uploading[j.id + '_trasera'] ? 'Subiendo...' : j.cedula_trasera_url ? '✓ Cédula trasera' : 'Cédula trasera'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => handleCedula(j, ev.target.files[0], 'trasera')} disabled={uploading[j.id + '_trasera']}/>
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
