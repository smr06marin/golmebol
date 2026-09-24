import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Megaphone, Upload, X, Plus, Trash2 } from 'lucide-react'
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa'

const inputStyle = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const labelStyle = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

export default function AdminPatrocinadoresPage() {
  const [patrocinadores, setPatrocinadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [msg, setMsg] = useState(null)
  const guardandoRef = useRef({}) // { [id]: bool } — bloqueo inmediato por fila, evita doble clic en "Guardar"
  const creandoRef = useRef(false) // bloqueo inmediato para "Agregar patrocinador"

  useEffect(() => { fetchPatrocinadores() }, [])

  async function fetchPatrocinadores() {
    setLoading(true)
    const { data, error } = await supabase.from('patrocinadores_golmebol').select('*').order('orden').order('created_at')
    if (error) showMsg('Falta ejecutar migracion_patrocinadores_golmebol.sql en Supabase', 'error')
    setPatrocinadores(data || [])
    setLoading(false)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), type === 'error' ? 6000 : 3000)
  }

  async function handleAgregar() {
    if (creandoRef.current) return // ya se está creando — evita doble clic
    creandoRef.current = true
    try {
      const maxOrden = patrocinadores.reduce((m, p) => Math.max(m, p.orden || 0), 0)
      const { data, error } = await supabase.from('patrocinadores_golmebol')
        .insert({ nombre: 'Nuevo patrocinador', orden: maxOrden + 1, activo: true }).select().single()
      if (error) { showMsg('Error al crear', 'error'); return }
      setPatrocinadores(prev => [...prev, data])
      showMsg('Patrocinador agregado ✓')
    } finally {
      creandoRef.current = false
    }
  }

  async function handleSave(patro) {
    if (guardandoRef.current[patro.id]) return // ya se está guardando — evita doble clic
    guardandoRef.current[patro.id] = true
    setSaving(patro.id)
    try {
      const { error } = await supabase.from('patrocinadores_golmebol').update({
        nombre: patro.nombre, whatsapp: patro.whatsapp, direccion: patro.direccion,
        facebook: patro.facebook, instagram: patro.instagram, tiktok: patro.tiktok,
        orden: patro.orden, activo: patro.activo,
      }).eq('id', patro.id)
      if (error) showMsg('Error al guardar', 'error')
      else showMsg('Guardado ✓')
    } finally {
      guardandoRef.current[patro.id] = false
      setSaving(null)
    }
  }

  async function handleEliminar(patro) {
    if (!confirm(`¿Eliminar "${patro.nombre}"? Esto no se puede deshacer.`)) return
    const { error } = await supabase.from('patrocinadores_golmebol').delete().eq('id', patro.id)
    if (error) { showMsg('Error al eliminar', 'error'); return }
    if (patro.logo_url) {
      const path = `${patro.id}.${patro.logo_url.split('.').pop().split('?')[0]}`
      await supabase.storage.from('patrocinadores').remove([path])
    }
    setPatrocinadores(prev => prev.filter(p => p.id !== patro.id))
    showMsg('Patrocinador eliminado')
  }

  async function handleLogo(patro, file) {
    if (!file) return
    setUploading(patro.id)
    const ext = file.name.split('.').pop()
    const path = `${patro.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('patrocinadores').upload(path, file, { upsert: true })
    if (uploadError) { setUploading(null); showMsg('Error al subir imagen', 'error'); return }
    const { data: urlData } = supabase.storage.from('patrocinadores').getPublicUrl(path)
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}` // cache-bust: si reemplazan el logo, que se vea el nuevo de una
    const { error: updateError } = await supabase.from('patrocinadores_golmebol').update({ logo_url: logoUrl }).eq('id', patro.id)
    if (updateError) { setUploading(null); showMsg('Error al guardar URL', 'error'); return }
    setPatrocinadores(prev => prev.map(p => p.id === patro.id ? { ...p, logo_url: logoUrl } : p))
    setUploading(null)
    showMsg('Logo subido ✓')
  }

  function updateLocal(id, field, value) {
    setPatrocinadores(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)', textAlign: 'center', maxWidth: '90vw' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Patrocinadores oficiales</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>El banner que rota cada 5 segundos en la página de inicio pública. Al hacer clic en uno, la gente ve su info y puede escribirle por WhatsApp.</p>
        </div>
        <button onClick={handleAgregar} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '600' }}>
          <Plus size={16}/> Agregar patrocinador
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', fontSize: '.875rem' }}>Cargando...</div>
      ) : patrocinadores.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px' }}>
          <Megaphone size={32} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div>Todavía no hay patrocinadores. Agrega el primero arriba.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {patrocinadores.map(patro => (
            <div key={patro.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Megaphone size={16} color="#1a73e8"/>
                  <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{patro.nombre || 'Sin nombre'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={patro.activo} onChange={e => updateLocal(patro.id, 'activo', e.target.checked)} style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }}/>
                    <span style={{ fontSize: '.8rem', color: patro.activo ? '#1e8e3e' : '#9aa0a6', fontWeight: '500' }}>
                      {patro.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                  <button onClick={() => handleEliminar(patro)} title="Eliminar" style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: '#d93025' }}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start' }}>
                <div>
                  <div style={{ width: '120px', height: '70px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px' }}>
                    {patro.logo_url ? (
                      <img src={patro.logo_url} alt={patro.nombre} style={{ maxWidth: '110px', maxHeight: '60px', objectFit: 'contain' }}/>
                    ) : (
                      <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Sin logo</span>
                    )}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                    <Upload size={12}/> {uploading === patro.id ? 'Subiendo...' : 'Subir logo'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogo(patro, e.target.files[0])} disabled={uploading === patro.id}/>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Nombre del patrocinador</label>
                      <input value={patro.nombre || ''} onChange={e => updateLocal(patro.id, 'nombre', e.target.value)} style={inputStyle} placeholder="Ej: Tienda Deportiva El Gol"/>
                    </div>
                    <div>
                      <label style={labelStyle}>Orden</label>
                      <input type="number" value={patro.orden ?? 0} onChange={e => updateLocal(patro.id, 'orden', parseInt(e.target.value, 10) || 0)} style={{ ...inputStyle, width: '80px' }}/>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}><FaWhatsapp style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#25d366"/>WhatsApp (con indicativo, ej: 573001234567)</label>
                    <input value={patro.whatsapp || ''} onChange={e => updateLocal(patro.id, 'whatsapp', e.target.value)} style={inputStyle} placeholder="573001234567"/>
                  </div>

                  <div>
                    <label style={labelStyle}>Dirección</label>
                    <input value={patro.direccion || ''} onChange={e => updateLocal(patro.id, 'direccion', e.target.value)} style={inputStyle} placeholder="Ej: Cra 14 # 5-30, Armenia"/>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}><FaFacebook style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#1877f2"/>Facebook</label>
                      <input value={patro.facebook || ''} onChange={e => updateLocal(patro.id, 'facebook', e.target.value)} style={inputStyle} placeholder="https://facebook.com/..."/>
                    </div>
                    <div>
                      <label style={labelStyle}><FaInstagram style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#e1306c"/>Instagram</label>
                      <input value={patro.instagram || ''} onChange={e => updateLocal(patro.id, 'instagram', e.target.value)} style={inputStyle} placeholder="https://instagram.com/..."/>
                    </div>
                    <div>
                      <label style={labelStyle}><FaTiktok style={{ verticalAlign: '-2px', marginRight: '3px' }}/>TikTok</label>
                      <input value={patro.tiktok || ''} onChange={e => updateLocal(patro.id, 'tiktok', e.target.value)} style={inputStyle} placeholder="https://tiktok.com/@..."/>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleSave(patro)} disabled={saving === patro.id}
                      style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: saving === patro.id ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: saving === patro.id ? .7 : 1 }}>
                      {saving === patro.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
