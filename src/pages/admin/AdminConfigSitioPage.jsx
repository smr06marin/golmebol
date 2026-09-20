import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio, Plus, Trash2 } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../../components/MarcadorEnVivoOverlay'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas } from '../../lib/liveMatch'
import { fmtHoraDate } from '../../lib/horaHelpers'

const S = {
  bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff',
}
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'9px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

const NOMBRE_PLATAFORMA = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', otro: 'Enlace genérico (se mostrará un botón "Ver en vivo")' }

function streamVacio() {
  return { id: crypto.randomUUID(), url: '', titulo: '', match_id: null, activo: true }
}

export default function AdminConfigSitioPage() {
  const [streams, setStreams] = useState([]) // [{id, url, titulo, match_id, activo}] — uno por transmisión
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [partidos, setPartidos] = useState([]) // partidos elegibles para el marcador (no finalizados)

  // Partidos que se pueden elegir para el marcador: cualquiera que no haya
  // terminado (para poder elegirlo desde antes de que arranque). Se marcan
  // primero los que YA están en vivo (el árbitro ya empezó la planilla), así
  // el admin los ve de una sin tener que buscar entre partidos que todavía
  // no arrancan. La misma lista sirve para el selector de CADA transmisión.
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
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    const lista = Array.isArray(data?.en_vivo_streams) ? data.en_vivo_streams : []
    setStreams(lista.map(s => ({ ...s, id: s.id || crypto.randomUUID() })))
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true); setMsg(null)
    const payload = {
      id: true,
      en_vivo_streams: streams.map(s => ({
        id: s.id,
        url: (s.url || '').trim() || null,
        titulo: (s.titulo || '').trim() || null,
        match_id: s.match_id || null,
        activo: !!s.activo,
      })),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('site_config').upsert(payload, { onConflict: 'id' })
    setGuardando(false)
    if (error) {
      const msgError = /en_vivo_streams/.test(error.message||'') || /column .* does not exist/.test(error.message||'')
        ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql en Supabase'
        : 'Error al guardar: ' + error.message
      setMsg({ text: msgError, type:'error' }); return
    }
    setMsg({ text: '✅ Guardado', type:'ok' })
    setTimeout(() => setMsg(null), 3000)
  }

  function agregarStream() {
    setStreams(s => [...s, streamVacio()])
  }
  function quitarStream(id) {
    setStreams(s => s.filter(x => x.id !== id))
  }
  function actualizarStream(id, campo, valor) {
    setStreams(s => s.map(x => x.id === id ? { ...x, [campo]: valor } : x))
  }

  const streamsPreview = streams.filter(s => s.activo && (s.url || '').trim())

  if (loading) return <div style={{ padding:'40px', textAlign:'center', color:'#9aa0a6' }}>Cargando...</div>

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
          <Radio size={16} color={S.red}/> Transmisiones en vivo
        </div>
        <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'16px' }}>
          Agrega el link del video o transmisión en vivo puntual (no el del canal/perfil) — funciona con YouTube, Facebook o Instagram. Si hay varios partidos jugándose a la misma hora, agrega una transmisión por cada uno y todas se muestran juntas en la página de inicio.
        </div>

        {streams.length === 0 && (
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', padding:'14px 0', textAlign:'center' }}>
            Todavía no has agregado ninguna transmisión.
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {streams.map((s, i) => {
            const plataforma = detectarPlataforma(s.url)
            return (
              <div key={s.id} style={{ border:'1px solid #e8eaed', borderRadius:'10px', padding:'14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#5f6368' }}>Transmisión {i + 1}</span>
                  <button onClick={() => quitarStream(s.id)} aria-label="Quitar transmisión"
                    style={{ display:'flex', alignItems:'center', gap:'4px', background:'none', border:'none', color:'#d93025', fontSize:'.75rem', fontWeight:'600', cursor:'pointer', padding:'4px' }}>
                    <Trash2 size={13}/> Quitar
                  </button>
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', cursor:'pointer' }}>
                  <input type="checkbox" checked={!!s.activo} onChange={e => actualizarStream(s.id, 'activo', e.target.checked)}/>
                  <span style={{ fontSize:'.85rem', color:'#202124', fontWeight:'600' }}>Mostrar en la página de inicio</span>
                </label>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Link del video / transmisión</label>
                  <input value={s.url || ''} onChange={e => actualizarStream(s.id, 'url', e.target.value)} style={inp}
                    placeholder="Ej: https://www.youtube.com/watch?v=XXXXXXXXXXX"/>
                  {s.url && <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>Detectado: {NOMBRE_PLATAFORMA[plataforma] || plataforma}</div>}
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Título (opcional)</label>
                  <input value={s.titulo || ''} onChange={e => actualizarStream(s.id, 'titulo', e.target.value)} style={inp}
                    placeholder="Ej: Cancha 1 · Final del Torneo Relámpago"/>
                </div>

                <div>
                  <label style={lbl}>Marcador encima del video (opcional)</label>
                  <select value={s.match_id || ''} onChange={e => actualizarStream(s.id, 'match_id', e.target.value || null)} style={inp}>
                    <option value="">— Sin marcador (solo el video) —</option>
                    {partidos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.enVivo ? '🔴 ' : ''}{p.tournaments?.name ? p.tournaments.name + ' — ' : ''}{p.home?.name || '?'} vs {p.away?.name || '?'}{p.played_at ? ' · ' + fmtHoraDate(p.played_at) : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Si eliges el partido que se transmite acá, se muestra su marcador en vivo (el mismo que ya sube el árbitro desde la planilla) como una barra encima del video. Aparece solo, apenas el árbitro empieza a cargar el partido.
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={agregarStream}
          style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'14px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor:'pointer', color:'#1a73e8', fontSize:'.8rem', fontWeight:'600' }}>
          <Plus size={14}/> Agregar otra transmisión
        </button>

        <button onClick={guardar} disabled={guardando}
          style={{ display:'block', marginTop:'20px', padding:'10px 20px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.875rem', fontWeight:'600', opacity:guardando?.7:1 }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {streamsPreview.length > 0 && (
        <div style={{ marginTop:'24px' }}>
          <div style={{ fontSize:'.8rem', color:'#5f6368', fontWeight:'600', marginBottom:'10px' }}>Vista previa (así se ve en la página de inicio):</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            {streamsPreview.map(s => {
              const partidoSeleccionado = partidos.find(p => p.id === s.match_id) || null
              return (
                <div key={s.id} style={{ background:S.bg, borderRadius:'16px', padding:'16px' }}>
                  {s.titulo && <div style={{ color:'#9aa0a6', fontWeight:'700', fontSize:'.8rem', marginBottom:'10px' }}>{s.titulo}</div>}
                  <LiveEmbed url={s.url} titulo={s.titulo} S={S}
                    overlay={partidoSeleccionado ? (
                      <MarcadorEnVivoOverlay partido={{
                        home: partidoSeleccionado.home, away: partidoSeleccionado.away,
                        tournaments: partidoSeleccionado.tournaments,
                        vivo: derivarEnVivo(partidoSeleccionado),
                        colores: derivarColoresUniforme(partidoSeleccionado),
                        detalle: derivarFaltasYTarjetas(partidoSeleccionado),
                      }}/>
                    ) : null}/>
                  {s.match_id && !partidoSeleccionado?.enVivo && (
                    <div style={{ fontSize:'.7rem', color:'#9aa0a6', marginTop:'10px', textAlign:'center' }}>
                      Elegiste un partido para el marcador, pero todavía no está en vivo (el árbitro no ha empezado la planilla) — por eso no se ve acá. Apenas empiece, aparece solo.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
