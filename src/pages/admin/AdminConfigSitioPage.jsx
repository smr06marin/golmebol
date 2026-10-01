import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Radio, Plus, Trash2, Upload, Repeat, X, PlayCircle, Gauge, Table2, ListOrdered, Ban } from 'lucide-react'
import LiveEmbed, { detectarPlataforma } from '../../components/LiveEmbed'
import MarcadorEnVivoOverlay from '../../components/MarcadorEnVivoOverlay'
import GolesEnVivoOverlay from '../../components/GolesEnVivoOverlay'
import TablaEnVivoOverlay from '../../components/TablaEnVivoOverlay'
import { derivarEnVivo, derivarColoresUniforme, derivarFaltasYTarjetas } from '../../lib/liveMatch'
import { computeTablaGeneral } from '../../lib/torneoTablas'
import { fmtHoraDate } from '../../lib/horaHelpers'

const S = {
  bg: '#0a0a0a', card: '#161616', border: '#2a2a2a', red: '#e5433d', green: '#6fcf3d', text: '#fff',
}
const inp = { width:'100%', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'9px 12px', color:'#202124', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
const lbl = { fontSize:'.75rem', fontWeight:'500', color:'#5f6368', display:'block', marginBottom:'4px' }

const NOMBRE_PLATAFORMA = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', otro: 'Enlace genérico (se mostrará un botón "Ver en vivo")' }

function streamVacio() {
  return { id: crypto.randomUUID(), url: '', titulo: '', match_id: null, activo: true, retraso_segundos: 20, segundos_repeticion: 28 }
}

export default function AdminConfigSitioPage() {
  const [streams, setStreams] = useState([]) // [{id, url, titulo, match_id, activo}] — uno por transmisión
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [partidos, setPartidos] = useState([]) // partidos elegibles para el marcador (no finalizados)
  const [imagenesRepeticion, setImagenesRepeticion] = useState([]) // [{id, url}] — rotan en la repetición del gol
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  // Panel de control en vivo: qué gráfica extra (tabla/goles) se muestra por
  // transmisión y el disparador de la repetición manual — ver
  // migracion_en_vivo_control.sql. { [streamId]: { overlay, overlay_tournament_id, repeticion_ts, repeticion_camara_lenta } }
  const [control, setControl] = useState({})
  // Tablas de posiciones ya calculadas, en caché por torneo, para no volver a
  // pedirlas cada vez que se prende/apaga el overlay del mismo torneo.
  const [tablas, setTablas] = useState({})

  // Partidos que se pueden elegir para el marcador: cualquiera que no haya
  // terminado (para poder elegirlo desde antes de que arranque). Se marcan
  // primero los que YA están en vivo (el árbitro ya empezó la planilla), así
  // el admin los ve de una sin tener que buscar entre partidos que todavía
  // no arrancan. La misma lista sirve para el selector de CADA transmisión.
  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('id, tournament_id, played_at, live_state, live_state_updated_at, live_state_rapida, live_state_rapida_updated_at, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
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
    const { data, error } = await supabase.from('site_config').select('en_vivo_streams, en_vivo_repeticion_imagenes, en_vivo_control').eq('id', true).maybeSingle()
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_en_vivo_streams.sql y migracion_site_config_repeticion_imagenes.sql en Supabase' : error.message, type:'error' })
      setLoading(false)
      return
    }
    const lista = Array.isArray(data?.en_vivo_streams) ? data.en_vivo_streams : []
    setStreams(lista.map(s => ({ ...s, id: s.id || crypto.randomUUID(), retraso_segundos: s.retraso_segundos ?? 20, segundos_repeticion: s.segundos_repeticion ?? 28 })))
    setImagenesRepeticion(Array.isArray(data?.en_vivo_repeticion_imagenes) ? data.en_vivo_repeticion_imagenes : [])
    setControl((data?.en_vivo_control && typeof data.en_vivo_control === 'object') ? data.en_vivo_control : {})
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
        retraso_segundos: Number(s.retraso_segundos) || 20,
        segundos_repeticion: Number(s.segundos_repeticion) || 28,
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

  // Imágenes para la repetición del gol: se suben y se borran de una vez
  // (no esperan al botón "Guardar" de arriba, igual que el logo de un
  // patrocinador), y se guardan aparte del arreglo de transmisiones para no
  // pisar cambios sin guardar que el admin tenga a medias en esa sección.
  async function subirImagenRepeticion(file) {
    if (!file) return
    setSubiendoImagen(true)
    const id = crypto.randomUUID()
    const ext = file.name.split('.').pop()
    const path = `repeticion/${id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('patrocinadores').upload(path, file, { upsert: true })
    if (uploadError) { setSubiendoImagen(false); setMsg({ text:'Error al subir imagen', type:'error' }); return }
    const { data: urlData } = supabase.storage.from('patrocinadores').getPublicUrl(path)
    const url = `${urlData.publicUrl}?t=${Date.now()}`
    const nuevaLista = [...imagenesRepeticion, { id, url }]
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_repeticion_imagenes: nuevaLista, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setSubiendoImagen(false)
    if (error) {
      setMsg({ text: /does not exist|column/.test(error.message||'') ? '⚠️ Falta correr migracion_site_config_repeticion_imagenes.sql en Supabase' : 'Error al guardar la imagen', type:'error' })
      return
    }
    setImagenesRepeticion(nuevaLista)
    setMsg({ text:'✅ Imagen agregada', type:'ok' })
    setTimeout(() => setMsg(null), 3000)
  }

  async function quitarImagenRepeticion(img) {
    const nuevaLista = imagenesRepeticion.filter(x => x.id !== img.id)
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_repeticion_imagenes: nuevaLista, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setMsg({ text:'Error al quitar la imagen', type:'error' }); return }
    setImagenesRepeticion(nuevaLista)
    const path = (img.url || '').split('/patrocinadores/')[1]?.split('?')[0]
    if (path) await supabase.storage.from('patrocinadores').remove([path])
  }

  // Panel de control en vivo: a diferencia de "Guardar" (que sube TODO el
  // arreglo de transmisiones de una), cada acción del panel se guarda sola,
  // al toque — igual que las imágenes de repetición — porque esto se usa
  // EN VIVO, durante el partido, y no tiene sentido que quien transmite
  // tenga que acordarse de apretar "Guardar" para que el botón surta efecto.
  // Se actualiza el estado local primero (optimista) para que el botón se
  // sienta instantáneo, y después se manda a Supabase.
  async function actualizarControl(streamId, cambios) {
    const next = { ...control, [streamId]: { ...control[streamId], ...cambios } }
    setControl(next)
    const { error } = await supabase.from('site_config').upsert({ id: true, en_vivo_control: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) {
      setMsg({ text: /en_vivo_control|column .* does not exist/.test(error.message||'') ? '⚠️ Falta correr migracion_en_vivo_control.sql en Supabase' : 'Error al actualizar el panel de control', type:'error' })
    }
  }

  // Dispara una repetición manual (botón del panel) — a diferencia de la
  // automática (que espera el retraso configurado de la transmisión porque
  // reacciona sola a un gol), esta la aprieta a propósito quien está viendo
  // el video, así que en la portada se dispara de una, sin esperar nada.
  function dispararRepeticion(streamId, camaraLenta) {
    actualizarControl(streamId, { repeticion_ts: Date.now(), repeticion_camara_lenta: camaraLenta })
  }

  // Prende/apaga la gráfica de tabla de posiciones o goles encima del video.
  // Para la tabla hace falta saber de qué torneo — se usa el del partido que
  // ya tiene elegido esa transmisión (si tiene uno).
  function cambiarOverlay(streamId, overlay, tournamentId) {
    actualizarControl(streamId, { overlay, overlay_tournament_id: overlay === 'tabla' ? (tournamentId || null) : null })
    if (overlay === 'tabla' && tournamentId) cargarTabla(tournamentId)
  }

  // Trae equipos + partidos de un torneo y calcula su tabla general una sola
  // vez (se guarda en caché) — misma función que usa la tabla de posiciones
  // real del torneo (AdminTorneoDetallePage/TorneoPublicoPage), para que la
  // gráfica en vivo muestre exactamente lo mismo.
  async function cargarTabla(tournamentId) {
    if (!tournamentId || tablas[tournamentId]) return
    const [{ data: torneo }, { data: equiposData }, { data: partidosT }] = await Promise.all([
      supabase.from('tournaments').select('pts_victoria, pts_empate, pts_derrota').eq('id', tournamentId).maybeSingle(),
      supabase.from('tournament_teams').select('teams(id, name, logo_url)').eq('tournament_id', tournamentId),
      supabase.from('matches').select('status, fase, home_team_id, away_team_id, home_score, away_score').eq('tournament_id', tournamentId),
    ])
    const equipos = (equiposData || []).map(d => d.teams).filter(Boolean)
    setTablas(t => ({ ...t, [tournamentId]: computeTablaGeneral(equipos, partidosT || [], torneo || {}) }))
  }

  // Si al entrar a esta página ya había una tabla de posiciones prendida de
  // antes (de una sesión anterior del panel de control), la trae de una vez
  // — si no, la vista previa de abajo se queda esperando sin mostrar nada
  // hasta que alguien vuelva a tocar el botón.
  useEffect(() => {
    Object.values(control).forEach(c => { if (c?.overlay === 'tabla' && c.overlay_tournament_id) cargarTabla(c.overlay_tournament_id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cargarTabla ya revisa su propia caché, no hace falta re-correr por eso
  }, [control])

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

  // Arma lo que va ENCIMA del video para una transmisión: el marcador (si
  // tiene partido elegido) siempre va; debajo de todo, la gráfica de tabla o
  // de goles si el panel de control la tiene prendida para esta transmisión.
  // Misma composición que arma la página de inicio pública — así esta vista
  // previa muestra EXACTAMENTE lo que ve quien está viendo la transmisión.
  function overlayDe(s, partidoSeleccionado) {
    const c = control[s.id]
    // La gráfica de goles necesita que el partido esté REALMENTE en vivo
    // (igual que ya exige el marcador) — si no, acá en la vista previa se
    // vería una gráfica con datos viejos/de prueba que en la página pública
    // nunca aparece (ahí si no está en vivo, directamente no se pinta nada),
    // y eso es justo lo que confundía: se veía acá pero no allá.
    const vivo = partidoSeleccionado ? derivarEnVivo(partidoSeleccionado) : null
    return (
      <>
        {partidoSeleccionado && vivo && (
          <MarcadorEnVivoOverlay partido={{
            home: partidoSeleccionado.home, away: partidoSeleccionado.away,
            tournaments: partidoSeleccionado.tournaments,
            vivo,
            colores: derivarColoresUniforme(partidoSeleccionado),
            detalle: derivarFaltasYTarjetas(partidoSeleccionado),
          }}/>
        )}
        {c?.overlay === 'goles' && partidoSeleccionado && vivo && <GolesEnVivoOverlay partido={partidoSeleccionado}/>}
        {c?.overlay === 'tabla' && <TablaEnVivoOverlay filas={tablas[c.overlay_tournament_id]}/>}
      </>
    )
  }

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

      {streamsPreview.length > 0 && (
        <div style={{ background:S.bg, border:`1px solid ${S.border}`, borderRadius:'12px', padding:'20px', marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'700', color:'#fff', marginBottom:'4px' }}>
            <PlayCircle size={16} color={S.green}/> Panel de control en vivo
          </div>
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', marginBottom:'16px' }}>
            Para usar DURANTE el partido: cada botón actúa al toque, sin tener que tocar "Guardar". Repetición dispara de una (no espera el retraso de la transmisión, porque acá lo aprietas vos mismo viendo el video).
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {streamsPreview.map(s => {
              const partidoSeleccionado = partidos.find(p => p.id === s.match_id) || null
              const c = control[s.id] || {}
              const tieneTorneo = !!partidoSeleccionado?.tournament_id
              return (
                <div key={s.id} style={{ border:`1px solid ${S.border}`, borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'.78rem', fontWeight:'700', color:'#fff', marginBottom:'10px' }}>
                    {s.titulo || (partidoSeleccionado ? `${partidoSeleccionado.home?.name || '?'} vs ${partidoSeleccionado.away?.name || '?'}` : 'Transmisión sin título')}
                  </div>

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>REPETICIÓN</div>
                  <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
                    <button onClick={() => dispararRepeticion(s.id, false)}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:S.green, border:'none', borderRadius:'8px', cursor:'pointer', color:'#0a0a0a', fontSize:'.8rem', fontWeight:'700' }}>
                      <PlayCircle size={15}/> Repetición
                    </button>
                    <button onClick={() => dispararRepeticion(s.id, true)}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', background:'#2a2a2a', border:`1px solid ${S.green}`, borderRadius:'8px', cursor:'pointer', color:S.green, fontSize:'.8rem', fontWeight:'700' }}>
                      <Gauge size={15}/> Cámara lenta
                    </button>
                  </div>

                  <div style={{ fontSize:'.68rem', color:'#9aa0a6', fontWeight:'600', marginBottom:'6px' }}>GRÁFICA ENCIMA DEL VIDEO</div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    <button onClick={() => cambiarOverlay(s.id, null, null)}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: !c.overlay ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.76rem', fontWeight:'700' }}>
                      <Ban size={13}/> Ninguna
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'tabla', partidoSeleccionado?.tournament_id)}
                      disabled={!tieneTorneo} title={tieneTorneo ? '' : 'Elige un partido para esta transmisión, así se sabe de qué torneo mostrar la tabla'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'tabla' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: tieneTorneo ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: tieneTorneo ? 1 : .45 }}>
                      <Table2 size={13}/> Tabla de posiciones
                    </button>
                    <button onClick={() => cambiarOverlay(s.id, 'goles', null)}
                      disabled={!partidoSeleccionado} title={partidoSeleccionado ? '' : 'Elige un partido para esta transmisión, así se sabe de quién mostrar los goles'}
                      style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', background: c.overlay === 'goles' ? S.red : '#2a2a2a', border:'none', borderRadius:'8px', cursor: partidoSeleccionado ? 'pointer' : 'not-allowed', color:'#fff', fontSize:'.76rem', fontWeight:'700', opacity: partidoSeleccionado ? 1 : .45 }}>
                      <ListOrdered size={13}/> Goles del partido
                    </button>
                  </div>
                  {partidoSeleccionado && !partidoSeleccionado.enVivo && (
                    <div style={{ fontSize:'.68rem', color:'#f5a623', marginTop:'10px' }}>
                      ⚠️ Este partido todavía no está en vivo (el árbitro no ha empezado la planilla) — la gráfica de goles no se ve hasta que empiece, aunque la dejes prendida de una vez.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Retraso de esta transmisión (segundos)</label>
                  <input type="number" min="0" step="1" value={s.retraso_segundos ?? 20}
                    onChange={e => actualizarStream(s.id, 'retraso_segundos', e.target.value)} style={{ ...inp, maxWidth:'120px' }}/>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Cuánto va atrasada esta transmisión respecto al partido real (todo "en vivo" tiene algo de retraso). Se usa para esperar ese tiempo antes de disparar la repetición del gol — si no, el video rebobina a un momento en el que el gol todavía no había pasado. Para calcularlo: mira algo que pase en la cancha y cuenta cuántos segundos tarda en aparecer en la transmisión.
                  </div>
                </div>

                <div style={{ marginBottom:'12px' }}>
                  <label style={lbl}>Cuánto rebobina la repetición del gol (segundos)</label>
                  <input type="number" min="0" step="1" value={s.segundos_repeticion ?? 28}
                    onChange={e => actualizarStream(s.id, 'segundos_repeticion', e.target.value)} style={{ ...inp, maxWidth:'120px' }}/>
                  <div style={{ fontSize:'.72rem', color:'#5f6368', marginTop:'5px' }}>
                    Si al ver la repetición el gol ya pasó (se ve la celebración pero no la jugada), sube este número — significa que el gol está más atrás de lo que se está rebobinando. Si en cambio se ve mucho relleno antes del gol, bájalo. No tiene relación con el número de arriba: ese es cuánto ESPERAR antes de disparar la repetición, este es hacia dónde atrás SALTA el video una vez que dispara.
                  </div>
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

      <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,.06)', marginTop:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontWeight:'600', color:'#202124', marginBottom:'4px' }}>
          <Repeat size={16} color={S.red}/> Imágenes para la repetición del gol
        </div>
        <div style={{ fontSize:'.8rem', color:'#5f6368', marginBottom:'16px' }}>
          Cuando el árbitro anota un gol, el video se tapa unos segundos con una de estas imágenes (con una transición de entrada y salida, y tiempo de sobra para leerla) antes de mostrar otra vez la jugada — como el "cortesía de" de una transmisión deportiva. Puedes subir varias: van rotando en orden, una por cada gol. Ideal horizontal (16:9), igual de ancha que el video.
        </div>

        {imagenesRepeticion.length === 0 && (
          <div style={{ fontSize:'.8rem', color:'#9aa0a6', padding:'14px 0', textAlign:'center' }}>
            Todavía no has agregado ninguna imagen.
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginBottom: imagenesRepeticion.length ? '16px' : 0 }}>
          {imagenesRepeticion.map(img => (
            <div key={img.id} style={{ position:'relative', width:'140px' }}>
              <img src={img.url} alt="Imagen de repetición" style={{ width:'140px', height:'79px', objectFit:'cover', borderRadius:'8px', border:'1px solid #e8eaed', display:'block' }}/>
              <button onClick={() => quitarImagenRepeticion(img)} aria-label="Quitar imagen"
                style={{ position:'absolute', top:'-6px', right:'-6px', width:'22px', height:'22px', borderRadius:'50%', border:'none', background:'#d93025', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}>
                <X size={13}/>
              </button>
            </div>
          ))}
        </div>

        <label style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 14px', background:'#fff', border:'1px dashed #1a73e8', borderRadius:'8px', cursor: subiendoImagen ? 'not-allowed' : 'pointer', color:'#1a73e8', fontSize:'.8rem', fontWeight:'600' }}>
          <Upload size={14}/> {subiendoImagen ? 'Subiendo...' : 'Agregar imagen'}
          <input type="file" accept="image/*" style={{ display:'none' }} disabled={subiendoImagen}
            onChange={e => { subirImagenRepeticion(e.target.files[0]); e.target.value = '' }}/>
        </label>
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
                  <LiveEmbed url={s.url} titulo={s.titulo} S={S} overlay={overlayDe(s, partidoSeleccionado)}/>
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
