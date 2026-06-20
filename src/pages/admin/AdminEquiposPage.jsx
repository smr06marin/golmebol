import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Shield, Upload, X, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EMPTY = { name: '', city: '', genero: '', modalidad: '' }
const MODALIDADES = ['Fútbol 5', 'Fútbol 7', 'Fútbol 11']
const GENEROS = ['Masculino', 'Femenino', 'Mixto']

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

export default function AdminEquiposPage() {
    const navigate = useNavigate()
  const [equipos, setEquipos] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [msg, setMsg] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchEquipos() }, [])

  async function fetchEquipos() {
    const { data } = await supabase.from('teams').select('*').order('name')
    setEquipos(data || [])
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave() {
    if (!form.name) return showMsg('El nombre es obligatorio', 'error')
    setLoading(true)
    if (editId) {
      const { error } = await supabase.from('teams').update(form).eq('id', editId)
      if (error) showMsg('Error al guardar', 'error')
      else { showMsg('Equipo actualizado ✓'); setEditId(null) }
    } else {
      const { error } = await supabase.from('teams').insert(form)
      if (error) showMsg('Error al crear', 'error')
      else showMsg('Equipo creado ✓')
    }
    setForm(EMPTY)
    setShowForm(false)
    setLoading(false)
    fetchEquipos()
  }

  function handleEdit(e) {
    setForm({ name: e.name || '', city: e.city || '', genero: e.genero || '', modalidad: e.modalidad || '' })
    setEditId(e.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar equipo?')) return
    await supabase.from('teams').delete().eq('id', id)
    fetchEquipos()
    showMsg('Eliminado')
  }

  async function handleEscudo(equipo, file) {
    if (!file) return
    setUploading(equipo.id)
    const ext = file.name.split('.').pop()
    const path = `escudos/${equipo.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('teams').upload(path, file, { upsert: true })
    if (upErr) { setUploading(null); showMsg('Error al subir escudo', 'error'); return }
    const { data: urlData } = supabase.storage.from('teams').getPublicUrl(path)
    await supabase.from('teams').update({ logo_url: urlData.publicUrl }).eq('id', equipo.id)
    setEquipos(prev => prev.map(e => e.id === equipo.id ? { ...e, logo_url: urlData.publicUrl } : e))
    setUploading(null)
    showMsg('Escudo subido ✓')
  }

  async function handleDeleteEscudo(equipo) {
    await supabase.from('teams').update({ logo_url: null }).eq('id', equipo.id)
    setEquipos(prev => prev.map(e => e.id === equipo.id ? { ...e, logo_url: null } : e))
    showMsg('Escudo eliminado')
  }

  const filtered = equipos.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {/* Mensaje */}
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Equipos</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{equipos.length} equipos registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
          <Plus size={18}/> Nuevo equipo
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '20px' }}>
            {editId ? 'Editar equipo' : 'Nuevo equipo'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={label}>Nombre *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="Nombre del equipo"/>
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
                <label style={label}>Modalidad</label>
                <select value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))} style={input}>
                  <option value="">Seleccionar</option>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando...' : editId ? 'Actualizar' : 'Crear equipo'}
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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar equipo..." style={{ ...input, maxWidth: '320px' }}/>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
            <Shield size={40} style={{ opacity: .3, marginBottom: '12px' }}/>
            <div style={{ fontSize: '.875rem' }}>No hay equipos aún</div>
          </div>
        ) : (
          filtered.map((e, i) => (
            <div key={e.id} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < filtered.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Escudo */}
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#f1f3f4', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {e.logo_url
                    ? <img src={e.logo_url} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                    : <Shield size={22} color="#9aa0a6"/>
                  }
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{e.name}</div>
                  <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '3px', display: 'flex', gap: '8px' }}>
                    {e.city && <span>📍 {e.city}</span>}
                    {e.modalidad && <span>· {e.modalidad}</span>}
                    {e.genero && <span>· {e.genero}</span>}
                  </div>
                  {/* Subir escudo */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.72rem', color: '#1a73e8', cursor: 'pointer', padding: '2px 8px', border: '1px solid #1a73e8', borderRadius: '4px' }}>
                      <Upload size={12}/> {uploading === e.id ? 'Subiendo...' : 'Escudo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => handleEscudo(e, ev.target.files[0])} disabled={uploading === e.id}/>
                    </label>
                    {e.logo_url && (
                      <button onClick={() => handleDeleteEscudo(e)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #fad2cf', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', color: '#d93025', fontSize: '.72rem' }}>
                        <X size={12}/> Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => navigate(`/admin/equipos/${e.id}`)}
  style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#1a73e8', display: 'flex', alignItems: 'center' }}>
  <TrendingUp size={15}/>
</button>
<button onClick={() => navigate(`/admin/equipos/${e.id}`)}
  style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#1a73e8', display: 'flex', alignItems: 'center' }}>
  <TrendingUp size={15}/>
</button>
<button onClick={() => handleEdit(e)}
  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
  <Pencil size={15}/>
</button>
                <button onClick={() => handleDelete(e.id)}
                  style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
