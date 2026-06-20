import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Star, Upload, X, ExternalLink } from 'lucide-react'

const CARD_NOMBRES = {
  nivel1_verde:       'Inicio Verde',
  nivel1_azul:        'Inicio Azul',
  nivel1_bronce:      'Inicio Bronce',
  nivel1_plata:       'Inicio Plata',
  nivel1_oro:         'Inicio Oro',
  nivel2_inicio:      'Nivel 2 Inicio',
  nivel2_bronce:      'Nivel 2 Bronce',
  nivel2_plata:       'Nivel 2 Plata',
  nivel2_oro:         'Nivel 2 Oro',
  nivel2_legendario:  'Nivel 2 Legendario',
  nivel3_inicio:      'Nivel 3 Inicio',
  nivel3_bronce:      'Nivel 3 Bronce',
  nivel3_plata:       'Nivel 3 Plata',
  nivel3_oro:         'Nivel 3 Oro',
  nivel3_legendario:  'Nivel 3 Legendario',
  premium_inicio:     'Premium Inicio',
  premium_bronce:     'Premium Bronce',
  premium_plata:      'Premium Plata',
  premium_oro:        'Premium Oro',
  premium_legendario: 'Premium Legendario',
}

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

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { fetchSponsors() }, [])

  async function fetchSponsors() {
    setLoading(true)
    const { data } = await supabase.from('sponsors').select('*').order('card_id')
    setSponsors(data || [])
    setLoading(false)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave(sponsor) {
    setSaving(sponsor.id)
    const { error } = await supabase.from('sponsors').update({
      nombre: sponsor.nombre,
      url: sponsor.url,
      activo: sponsor.activo,
    }).eq('id', sponsor.id)
    setSaving(null)
    if (error) showMsg('Error al guardar', 'error')
    else showMsg('Guardado ✓')
  }

  async function handleLogo(sponsor, file) {
    if (!file) return
    setUploading(sponsor.id)
    const ext = file.name.split('.').pop()
    const path = `${sponsor.card_id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('sponsors').upload(path, file, { upsert: true })
    if (uploadError) { setUploading(null); showMsg('Error al subir imagen', 'error'); return }
    const { data: urlData } = supabase.storage.from('sponsors').getPublicUrl(path)
    const { error: updateError } = await supabase.from('sponsors').update({ logo_url: urlData.publicUrl }).eq('id', sponsor.id)
    if (updateError) { setUploading(null); showMsg('Error al guardar URL', 'error'); return }
    setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, logo_url: urlData.publicUrl } : s))
    setUploading(null)
    showMsg('Logo subido ✓')
  }

  async function handleDeleteLogo(sponsor) {
    const ext = sponsor.logo_url?.split('.').pop()
    const path = `${sponsor.card_id}.${ext}`
    await supabase.storage.from('sponsors').remove([path])
    await supabase.from('sponsors').update({ logo_url: null }).eq('id', sponsor.id)
    setSponsors(prev => prev.map(s => s.id === sponsor.id ? { ...s, logo_url: null } : s))
    showMsg('Logo eliminado')
  }

  function updateLocal(id, field, value) {
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Patrocinadores</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Gestiona los logos que aparecen antes de cada tarjeta</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', fontSize: '.875rem' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sponsors.map(sponsor => (
            <div key={sponsor.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>

              {/* Título tarjeta */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={16} color="#1a73e8"/>
                  <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>
                    {CARD_NOMBRES[sponsor.card_id] || sponsor.card_id}
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sponsor.activo} onChange={e => updateLocal(sponsor.id, 'activo', e.target.checked)} style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }}/>
                  <span style={{ fontSize: '.8rem', color: sponsor.activo ? '#1e8e3e' : '#9aa0a6', fontWeight: '500' }}>
                    {sponsor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'start' }}>
                {/* Logo */}
                <div>
                  <div style={{ width: '120px', height: '70px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '8px' }}>
                    {sponsor.logo_url ? (
                      <img src={sponsor.logo_url} alt={sponsor.nombre} style={{ maxWidth: '110px', maxHeight: '60px', objectFit: 'contain' }}/>
                    ) : (
                      <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>Sin logo</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '.75rem', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                      <Upload size={12}/> {uploading === sponsor.id ? 'Subiendo...' : 'Subir logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogo(sponsor, e.target.files[0])} disabled={uploading === sponsor.id}/>
                    </label>
                    {sponsor.logo_url && (
                      <button onClick={() => handleDeleteLogo(sponsor)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#d93025', fontSize: '.75rem' }}>
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Campos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Nombre del patrocinador</label>
                    <input value={sponsor.nombre || ''} onChange={e => updateLocal(sponsor.id, 'nombre', e.target.value)} style={inputStyle} placeholder="Nombre del patrocinador"/>
                  </div>
                  <div>
                    <label style={labelStyle}>URL (enlace al hacer clic)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={sponsor.url || ''} onChange={e => updateLocal(sponsor.id, 'url', e.target.value)} style={inputStyle} placeholder="https://..."/>
                      {sponsor.url && (
                        <a href={sponsor.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', padding: '8px', border: '1px solid #dadce0', borderRadius: '8px', color: '#5f6368' }}>
                          <ExternalLink size={16}/>
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => handleSave(sponsor)} disabled={saving === sponsor.id}
                      style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: saving === sponsor.id ? .7 : 1 }}>
                      {saving === sponsor.id ? 'Guardando...' : 'Guardar'}
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
