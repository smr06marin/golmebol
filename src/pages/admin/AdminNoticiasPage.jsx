import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Newspaper, Zap, RefreshCw, Copy, Check } from 'lucide-react'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function generarNoticia(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

function parseNoticia(texto) {
  const lines   = texto.split('\n').filter(l => l.trim())
  const titulo  = lines[0]?.replace(/^#+ /, '').trim() || 'Sin título'
  const resto   = lines.slice(1)
  const hashIdx = resto.findLastIndex(l => l.includes('#'))
  const hashtags = hashIdx >= 0 ? resto.slice(hashIdx).join(' ') : ''
  const cuerpo  = (hashIdx >= 0 ? resto.slice(0, hashIdx) : resto).join('\n').trim()
  return { titulo, cuerpo, hashtags }
}

export default function AdminNoticiasPage() {
  const [torneos,   setTorneos]   = useState([])
  const [torneoId,  setTorneoId]  = useState('')
  const [partidos,  setPartidos]  = useState([])
  const [noticias,  setNoticias]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [generando, setGenerando] = useState(null)
  const [msg,       setMsg]       = useState(null)
  const [copiado,   setCopiado]   = useState(null)
  const [expanded,  setExpanded]  = useState(null)

  // Esperar sesión antes de cargar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchTorneos()
    })
  }, [])

  useEffect(() => {
    if (torneoId) { fetchPartidos(); fetchNoticias() }
  }, [torneoId])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTorneos() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name')
      .order('created_at', { ascending: false })
    if (error) { showMsg('Error cargando torneos: ' + error.message, 'error'); return }
    setTorneos(data || [])
    if (data?.length) setTorneoId(data[0].id)
  }

  async function fetchPartidos() {
    const { data } = await supabase
      .from('matches')
      .select('*, home:home_team_id(id,name), away:away_team_id(id,name)')
      .eq('tournament_id', torneoId)
      .order('played_at', { ascending: true })
    setPartidos(data || [])
  }

  async function fetchNoticias() {
    setLoading(true)
    const { data } = await supabase
      .from('noticias')
      .select('*')
      .eq('tournament_id', torneoId)
      .order('creada_at', { ascending: false })
    setNoticias(data || [])
    setLoading(false)
  }

  async function handleGenerarPrePartido(partido) {
    setGenerando(partido.id + '_pre')

    // Historial de partidos jugados en el torneo
    const { data: histPartidos } = await supabase
      .from('matches')
      .select('home_score, away_score, status, home:home_team_id(name), away:away_team_id(name)')
      .eq('tournament_id', torneoId)
      .eq('status', 'finished')

    // Stats goleadores local
    const { data: statsHome } = await supabase
      .from('player_match_stats')
      .select('goals_scored, players(name)')
      .eq('team_id', partido.home_team_id)
      .gt('goals_scored', 0)

    // Stats goleadores visitante
    const { data: statsAway } = await supabase
      .from('player_match_stats')
      .select('goals_scored, players(name)')
      .eq('team_id', partido.away_team_id)
      .gt('goals_scored', 0)

    // Tabla de posiciones
    const tabla = {}
    partidos.filter(p => p.status === 'finished').forEach(p => {
      if (!tabla[p.home_team_id]) tabla[p.home_team_id] = { name: p.home?.name, pj: 0, pg: 0, pe: 0, pp: 0, pts: 0 }
      if (!tabla[p.away_team_id]) tabla[p.away_team_id] = { name: p.away?.name, pj: 0, pg: 0, pe: 0, pp: 0, pts: 0 }
      tabla[p.home_team_id].pj++; tabla[p.away_team_id].pj++
      if (p.home_score > p.away_score)       { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts += 3; tabla[p.away_team_id].pp++ }
      else if (p.home_score === p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts++; tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts++ }
      else                                    { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts += 3; tabla[p.home_team_id].pp++ }
    })
    const tablaOrdenada = Object.values(tabla).sort((a, b) => b.pts - a.pts)

    // Enfrentamientos directos
    const enfrentamientos = (histPartidos || []).filter(p =>
      (p.home?.name === partido.home?.name || p.away?.name === partido.home?.name) &&
      (p.home?.name === partido.away?.name || p.away?.name === partido.away?.name)
    )

    // Top goleadores
    const topHome = Object.entries(
      (statsHome || []).reduce((acc, s) => { const n = s.players?.name; if (n) acc[n] = (acc[n]||0) + s.goals_scored; return acc }, {})
    ).sort((a,b) => b[1]-a[1]).slice(0,3).map(([n,g]) => `${n} (${g} goles)`).join(', ') || 'Sin goles registrados'

    const topAway = Object.entries(
      (statsAway || []).reduce((acc, s) => { const n = s.players?.name; if (n) acc[n] = (acc[n]||0) + s.goals_scored; return acc }, {})
    ).sort((a,b) => b[1]-a[1]).slice(0,3).map(([n,g]) => `${n} (${g} goles)`).join(', ') || 'Sin goles registrados'

    const fecha = partido.played_at
      ? new Date(partido.played_at).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : 'fecha por confirmar'

    const prompt = `Eres el periodista deportivo del torneo amateur de fútbol GOLMEBOL en Armenia, Quindío, Colombia.
Escribe una noticia de PRE-PARTIDO emocionante, apasionada y en español colombiano para redes sociales (Instagram/WhatsApp).

PARTIDO: ${partido.home?.name} vs ${partido.away?.name}
FECHA: ${fecha}
${partido.location ? `CANCHA: ${partido.location}` : ''}

TABLA DE POSICIONES ACTUAL:
${tablaOrdenada.length > 0 ? tablaOrdenada.map((t, i) => `${i+1}. ${t.name} - ${t.pts} pts (${t.pg}G ${t.pe}E ${t.pp}P)`).join('\n') : 'Torneo recién iniciado, sin resultados aún'}

HISTORIAL DIRECTO ENTRE ESTOS EQUIPOS:
${enfrentamientos.length === 0 ? 'Primer enfrentamiento entre estos equipos en este torneo' : enfrentamientos.map(e => `${e.home?.name} ${e.home_score} - ${e.away_score} ${e.away?.name}`).join('\n')}

GOLEADORES DESTACADOS:
- ${partido.home?.name}: ${topHome}
- ${partido.away?.name}: ${topAway}

Escribe:
1. Un título llamativo en mayúsculas (máximo 10 palabras)
2. Una noticia de 3-4 párrafos con: contexto del partido, situación en la tabla, rivalidad o historial, jugadores a seguir, predicción dramática
3. Termina con 5 hashtags (#Golmebol #Armenia obligatorio)

Sé dramático, usa términos futboleros colombianos, crea expectativa. NO uses asteriscos ni markdown, solo texto plano con saltos de línea.`

    try {
      const texto = await generarNoticia(prompt)
      if (!texto) { showMsg('La IA no devolvió respuesta', 'error'); setGenerando(null); return }

      const { titulo, cuerpo, hashtags } = parseNoticia(texto)

      const { data: existente } = await supabase
        .from('noticias')
        .select('id')
        .eq('match_id', partido.id)
        .eq('tipo', 'pre_partido')
        .maybeSingle()

      if (existente) {
        await supabase.from('noticias').update({ titulo, cuerpo, hashtags }).eq('id', existente.id)
      } else {
        await supabase.from('noticias').insert({
          tournament_id: torneoId,
          match_id:      partido.id,
          tipo:          'pre_partido',
          titulo,
          cuerpo,
          hashtags,
        })
      }

      showMsg('✅ Noticia generada')
      fetchNoticias()
    } catch (e) {
      showMsg('Error al generar: ' + e.message, 'error')
    }
    setGenerando(null)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta noticia?')) return
    await supabase.from('noticias').delete().eq('id', id)
    fetchNoticias()
    showMsg('Noticia eliminada')
  }

  function copiarNoticia(n) {
    const texto = `${n.titulo}\n\n${n.cuerpo}\n\n${n.hashtags}`
    navigator.clipboard.writeText(texto)
    setCopiado(n.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const tipoLabel  = { pre_partido: '⚡ Pre-partido', post_partido: '🏁 Post-partido', semanal: '📋 Semanal' }
  const tipoColor  = { pre_partido: '#1a73e8', post_partido: '#1e8e3e', semanal: '#6c35de' }
  const tipoBg     = { pre_partido: '#e8f0fe', post_partido: '#e6f4ea', semanal: '#f3e8fd' }

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 9999, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)', whiteSpace: 'nowrap' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Newspaper size={20} color="#1a73e8"/> Noticias del Torneo
          </h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Generadas con IA · Listas para Instagram y WhatsApp</p>
        </div>
        <select value={torneoId} onChange={e => setTorneoId(e.target.value)}
          style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', color: '#202124', fontSize: '.875rem', outline: 'none', cursor: 'pointer' }}>
          {torneos.length === 0 && <option value="">Cargando...</option>}
          {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Panel izquierdo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="#1a73e8"/> Noticias Pre-partido
            </div>
            <div style={{ fontSize: '.75rem', color: '#5f6368', marginBottom: '12px' }}>Genera antes de cada partido</div>

            {torneos.length === 0 ? (
              <div style={{ fontSize: '.78rem', color: '#9aa0a6', textAlign: 'center', padding: '16px' }}>Cargando torneos...</div>
            ) : pendientes.length === 0 ? (
              <div style={{ fontSize: '.78rem', color: '#9aa0a6', textAlign: 'center', padding: '16px' }}>Sin partidos pendientes</div>
            ) : pendientes.map(p => {
              const yaGenerada = noticias.some(n => n.match_id === p.id && n.tipo === 'pre_partido')
              const cargando   = generando === p.id + '_pre'
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '6px', border: yaGenerada ? '1px solid #1e8e3e' : '1px solid #e8eaed' }}>
                  <div>
                    <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>{p.home?.name} vs {p.away?.name}</div>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '2px' }}>
                      {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : 'Sin fecha'}
                      {yaGenerada && <span style={{ color: '#1e8e3e', marginLeft: '6px' }}>✓ Generada</span>}
                    </div>
                  </div>
                  <button onClick={() => handleGenerarPrePartido(p)} disabled={cargando}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: cargando ? '#f1f3f4' : yaGenerada ? '#e6f4ea' : '#1a73e8', border: 'none', borderRadius: '8px', cursor: cargando ? 'not-allowed' : 'pointer', color: cargando ? '#9aa0a6' : yaGenerada ? '#1e8e3e' : '#fff', fontSize: '.72rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {cargando
                      ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }}/> Generando...</>
                      : yaGenerada ? '↻ Regenerar' : <><Zap size={12}/> Generar</>}
                  </button>
                </div>
              )
            })}
          </div>

          <div style={{ background: '#e8f0fe', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '.78rem', fontWeight: '600', color: '#1a73e8', marginBottom: '4px' }}>💡 Próximamente</div>
            <div style={{ fontSize: '.72rem', color: '#5f6368', lineHeight: 1.5 }}>
              · Post-partido al guardar resultado<br/>
              · Resumen semanal de jornada<br/>
              · Récords y estadísticas especiales
            </div>
          </div>
        </div>

        {/* Panel derecho — noticias */}
        <div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando noticias...</div>
          ) : noticias.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>
              <Newspaper size={40} style={{ opacity: .2, marginBottom: '12px', display: 'block', margin: '0 auto 12px' }}/>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>Sin noticias generadas aún</div>
              <div style={{ fontSize: '.78rem' }}>Genera la primera desde el panel izquierdo</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {noticias.map(n => {
                const partido  = partidos.find(p => p.id === n.match_id)
                const isExpand = expanded === n.id
                return (
                  <div key={n.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ padding: '14px 16px', borderBottom: isExpand ? '1px solid #f1f3f4' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '.68rem', fontWeight: '700', color: tipoColor[n.tipo], background: tipoBg[n.tipo], borderRadius: '20px', padding: '2px 8px' }}>
                              {tipoLabel[n.tipo]}
                            </span>
                            {partido && <span style={{ fontSize: '.68rem', color: '#9aa0a6' }}>{partido.home?.name} vs {partido.away?.name}</span>}
                            <span style={{ fontSize: '.65rem', color: '#9aa0a6' }}>
                              {new Date(n.creada_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', lineHeight: 1.3 }}>{n.titulo}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => copiarNoticia(n)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: copiado === n.id ? '#e6f4ea' : '#f1f3f4', border: 'none', borderRadius: '8px', cursor: 'pointer', color: copiado === n.id ? '#1e8e3e' : '#5f6368', fontSize: '.72rem', fontWeight: '600' }}>
                            {copiado === n.id ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar</>}
                          </button>
                          <button onClick={() => setExpanded(isExpand ? null : n.id)}
                            style={{ padding: '6px 10px', background: '#f1f3f4', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
                            {isExpand ? 'Ocultar' : 'Ver'}
                          </button>
                          <button onClick={() => handleEliminar(n.id)}
                            style={{ padding: '6px 8px', background: 'none', border: '1px solid #fad2cf', borderRadius: '8px', cursor: 'pointer', color: '#d93025', fontSize: '.72rem' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                    {isExpand && (
                      <div style={{ padding: '16px', background: '#fafafa' }}>
                        <div style={{ fontSize: '.85rem', color: '#202124', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                          {n.cuerpo}
                        </div>
                        {n.hashtags && (
                          <div style={{ fontSize: '.8rem', color: '#1a73e8', fontWeight: '500', marginBottom: '10px' }}>{n.hashtags}</div>
                        )}
                        <div style={{ padding: '10px', background: '#e8f0fe', borderRadius: '8px', fontSize: '.72rem', color: '#1a73e8' }}>
                          💡 Copia esta noticia y pégala directo en Instagram o WhatsApp
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
