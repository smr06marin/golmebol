import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../../components/MarcadorEnVivoOverlay'
import { derivarEnVivo } from '../../lib/liveMatch'
import { fmtHoraDate } from '../../lib/horaHelpers'

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
  const [partidos, setPartidos] = useState([]) // partidos elegibles para el marcador (no finalizados)

  // Partidos que se pueden elegir para el marcador: cualquiera que no haya
  // terminado (para poder elegirlo desde antes de que arranque). Se marcan
  // primero los que YA están en vivo (el árbitro ya empezó la planilla), así
  // el admin los ve de una sin tener que buscar entre partidos que todavía
  // no arrancan.
  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('id, played_at, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
      .neq('status', 'finished')
      .order('played_at', { ascending: true })
      .limit(100)
    const conVivo = (data || []).map(m => ({ ...m, enVivo: !!derivarEnVivo(m) }))
    conVivo.sort((a, b) => (b.enVivo === a.enVivo) ? 0 : (b.enVivo ? 1 : -1))
    setPartidos(conVivo)
  }

  useEffect(() => { fetchConfig(); fetchPartidos() }, [])

  async function fetchConfig() {
    setLoading(true)
    const { data, error } = await supabase.from('site_config').select('*').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    setConfig(data || { en_vivo_activo:false, en_vivo_url:'', en_vivo_titulo:'', en_vivo_match_id:null })
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true); setMsg(null)
    const payload = {
      id: true,
      en_vivo_activo: !!config.en_vivo_activo,
      en_vivo_url: (config.en_vivo_url || '').trim() || null,
      en_vivo_titulo: (config.en_vivo_titulo || '').trim() || null,
      en_vivo_match_id: config.en_vivo_match_id || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('site_config').upsert(payload, { onConflict: 'id' })
    setGuardando(false)
    if (error) {
      const msgError = /en_vivo_match_id/.test(error.message||'') || /column .* does not exist/.test(error.message||'')
        ? '⚠️ Falta correr migracion_site_config_en_vivo_match.sql en Supabase'
        : 'Error al guardar: ' + error.message
      setMsg({ text: msgError, type:'error' }); return
    }
    setMsg({ text: '✅ Guardado', type:'ok' })
    setTimeout(() => setMsg(null), 3000)
  }

  const partidoSeleccionado = partidos.find(p => p.id === config?.en_vivo_match_id) || null

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

        <div style={{ marginBottom:'18px' }}>
          <label style={lbl}>Marcador encima del video (opcional)</label>
          <select value={config.en_vivo_match_id || ''} onChange={e => setConfig(c => ({ ...c, en_vivo_match_id: e.target.value || null }))} style={inp}>
            <option value="">— Sin marcador (solo el video) —</option>
            {partidos.map(p => (
              <option key={p.id} value={p.id}>
                {p.enVivo ? '🔴 ' : ''}{p.tournaments?.name ? p.tournaments.name + ' — ' : ''}{p.home?.name || '?'} vs {p.away?.name || '?'}{p.played_at ? ' · ' + fmtHoraDate(p.played_at) : ''}
              </option>
            ))}
          </select>
          <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
            Si eliges el partido que estás transmitiendo, se muestra su marcador en vivo (el mismo que ya sube el árbitro desde la planilla) como una barra encima del video. Aparece solo, apenas el árbitro empieza a cargar el partido — si todavía no arrancó, el video se ve sin marcador.
          </div>
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
            <div style={{ position:'relative' }}>
              <LiveEmbed url={config.en_vivo_url} titulo={config.en_vivo_titulo} S={S}/>
              {partidoSeleccionado && (
                <MarcadorEnVivoOverlay partido={{
                  home: partidoSeleccionado.home, away: partidoSeleccionado.away,
                  tournaments: partidoSeleccionado.tournaments,
                  vivo: derivarEnVivo(partidoSeleccionado),
                }}/>
              )}
            </div>
            {config.en_vivo_match_id && !partidoSeleccionado?.enVivo && (
              <div style={{ fontSize:'.7rem', color:'#9aa0a6', marginTop:'10px', textAlign:'center' }}>
                Elegiste un partido para el marcador, pero todavía no está en vivo (el árbitro no ha empezado la planilla) — por eso no se ve acá. Apenas empiece, aparece solo.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
