import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'

const S = {
  bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff',
}
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'9px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

const NOMBRE_PLATAFORMA = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', otro: 'Enlace genérico (se mostrará un botón "Ver en vivo")' }

export default function AdminConfigSitioPage() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { fetchConfig() }, [])

  async function fetchConfig() {
    setLoading(true)
    const { data, error } = await supabase.from('site_config').select('*').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    setConfig(data || { en_vivo_activo:false, en_vivo_url:'', en_vivo_titulo:'' })
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true); setMsg(null)
    const payload = {
      id: true,
      en_vivo_activo: !!config.en_vivo_activo,
      en_vivo_url: (config.en_vivo_url || '').trim() || null,
      en_vivo_titulo: (config.en_vivo_titulo || '').trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('site_config').upsert(payload, { onConflict: 'id' })
    setGuardando(false)
    if (error) { setMsg({ text: 'Error al guardar: ' + error.message, type:'error' }); return }
    setMsg({ text: '✅ Guardado', type:'ok' })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'#9aa0a6' }}>Cargando...</div>

  const plataforma = detectarPlataforma(config.en_vivo_url)

  return (
    <div style={{ maxWidth:'640px' }}>
      <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:'0 0 4px' }}>Configuración del sitio</h1>
      <p style={{ color:'#5f6368', margin:'0 0 24px', fontSize:'.875rem' }}>Lo que pongas acá se muestra en la página de inicio pública (golmebol.com).</p>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:'8px', marginBottom:'16px', fontSize:'.85rem', background: msg.type==='ok'?'#e6f4ea':'#fce8e6', color: msg.type==='ok'?'#1e8e3e':'#d93025' }}>
          {msg.text}
        </div>
      )}

      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'600', color:'#202124', marginBottom:'4px' }}>
          <Radio size={16} color={S.red}/> Transmisión en vivo
        </div>
        <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'16px' }}>
          Pega el link del video o transmisión en vivo puntual (no el del canal/perfil) — funciona con YouTube, Facebook o Instagram. Se detecta sola la plataforma según el link.
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px', cursor:'pointer' }}>
          <input type="checkbox" checked={!!config.en_vivo_activo} onChange={e => setConfig(c => ({ ...c, en_vivo_activo: e.target.checked }))}/>
          <span style={{ fontSize:'.85rem', color:'#202124', fontWeight:'600' }}>Mostrar en la página de inicio</span>
        </label>

        <div style={{ marginBottom:'12px' }}>
          <label style={lbl}>Link del video / transmisión</label>
          <input value={config.en_vivo_url || ''} onChange={e => setConfig(c => ({ ...c, en_vivo_url: e.target.value }))} style={inp}
            placeholder="Ej: https://www.youtube.com/watch?v=XXXXXXXXXXX"/>
          {config.en_vivo_url && <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>Detectado: {NOMBRE_PLATAFORMA[plataforma] || plataforma}</div>}
        </div>

        <div style={{ marginBottom:'18px' }}>
          <label style={lbl}>Título (opcional)</label>
          <input value={config.en_vivo_titulo || ''} onChange={e => setConfig(c => ({ ...c, en_vivo_titulo: e.target.value }))} style={inp}
            placeholder="Ej: Final del Torneo Relámpago"/>
        </div>

        <button onClick={guardar} disabled={guardando}
          style={{ padding:'10px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {config.en_vivo_activo && config.en_vivo_url && (
        <div style={{ marginTop:'24px' }}>
          <div style={{ fontSize:'.8rem', color:'#5f6368', fontWeight:'600', marginBottom:'10px' }}>Vista previa (así se ve en la página de inicio):</div>
          <div style={{ background:S.bg, borderRadius:'16px', padding:'16px' }}>
            <LiveEmbed url={config.en_vivo_url} titulo={config.en_vivo_titulo} S={S}/>
          </div>
        </div>
      )}
    </div>
  )
}
