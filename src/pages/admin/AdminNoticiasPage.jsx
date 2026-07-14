import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Newspaper, Zap, RefreshCw, Copy, Check, Send, X, MessageSquare, Flag, CalendarDays } from 'lucide-react'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function llamarIA(messages, maxTokens = 600) {
  if (!API_KEY) {
    throw new Error('Falta configurar la clave de IA en este sitio (VITE_ANTHROPIC_API_KEY). Avísale a quien administra el hosting.')
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    // Haiku en vez de Sonnet: mismo texto corto y estructurado, 3 veces más barato.
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages }),
  })
  let data
  try { data = await res.json() } catch { data = null }
  if (!res.ok) {
    const detalle = data?.error?.message || `${res.status} ${res.statusText}`
    throw new Error(`La IA no respondió (${detalle})`)
  }
  const texto = data?.content?.[0]?.text
  if (!texto) throw new Error('La IA devolvió una respuesta vacía, intenta de nuevo')
  return texto
}

// Bloque de contexto con cache_control: si el mismo texto se reenvía dentro
// de los ~5 minutos siguientes (abrir chat, preguntar algo, generar la
// noticia final), Anthropic lo cobra hasta 90% más barato en vez de cobrar
// el contexto completo cada vez.
function bloqueContexto(ctx) {
  return { type: 'text', text: `DATOS:\n${ctx}`, cache_control: { type: 'ephemeral' } }
}

function parseNoticia(texto) {
  const lines    = texto.split('\n').filter(l => l.trim())
  const titulo   = lines[0]?.replace(/^#+ /, '').trim() || 'Sin título'
  const resto    = lines.slice(1)
  let hashIdx = -1
  for (let i = resto.length - 1; i >= 0; i--) { if (resto[i].includes('#')) { hashIdx = i; break } }
  const hashtags = hashIdx >= 0 ? resto.slice(hashIdx).join(' ') : ''
  const cuerpo   = (hashIdx >= 0 ? resto.slice(0, hashIdx) : resto).join('\n').trim()
  return { titulo, cuerpo, hashtags }
}

const FASES_LABEL = {
  grupo: '🏟️ Grupo', octavos: '⚔️ Octavos', cuartos: '🔥 Cuartos', semifinal: '⚡ Semifinal', final: '🏆 Final',
}

// Recorta la tabla a lo esencial (top 3 + los equipos que importan para esta
// noticia) en vez de mandarle a la IA la liga completa — en torneos grandes
// eso son muchos tokens de más pagados en cada llamada, por nada.
function resumirTabla(tablaOrdenada, destacar = []) {
  if (!tablaOrdenada || tablaOrdenada.length === 0) return 'Sin datos'
  const filas = tablaOrdenada
    .map((t, i) => ({ ...t, pos: i + 1 }))
    .filter(t => t.pos <= 3 || destacar.includes(t.name))
  const texto = filas.map(t => `${t.pos}.${t.name} ${t.pts}pts`).join(' | ')
  const restantes = tablaOrdenada.length - filas.length
  return texto + (restantes > 0 ? ` (+${restantes} equipos más, ${tablaOrdenada.length} en total)` : '')
}

function buildContextoPre(partido, datos) {
  const esFaseElim = partido.fase && partido.fase !== 'grupo'
  const tablaStr = datos.tablaOrdenada.length > 0
    ? resumirTabla(datos.tablaOrdenada, [partido.home?.name, partido.away?.name])
    : 'Sin resultados aún'
  const histStr = datos.enfrentamientos.length === 0 ? 'Primer enfrentamiento' : datos.enfrentamientos.join(' | ')
  const golH = Object.entries(datos.golesHomeTorneo).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n,g])=>`${n}(${g})`).join(', ') || 'sin goles'
  const golA = Object.entries(datos.golesAwayTorneo).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n,g])=>`${n}(${g})`).join(', ') || 'sin goles'
  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleString('es-CO', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })
    : 'fecha por confirmar'
  return `PARTIDO: ${partido.home?.name} vs ${partido.away?.name}${esFaseElim ? ` | ${FASES_LABEL[partido.fase]} ⚡ELIMINATORIA` : ''}
FECHA: ${fecha}${partido.location ? ` · ${partido.location}` : ''}
TABLA: ${tablaStr}
HISTORIAL: ${histStr}
GOLES TORNEO — ${partido.home?.name}: ${golH} | ${partido.away?.name}: ${golA}
RÉCORDS ${partido.home?.name}: ${datos.resumenHome}
RÉCORDS ${partido.away?.name}: ${datos.resumenAway}
FASES ELIM ${partido.home?.name}: ${datos.fasesHomeStr}
FASES ELIM ${partido.away?.name}: ${datos.fasesAwayStr}`
}

function buildContextoPost(partido, datos) {
  const esFaseElim = partido.fase && partido.fase !== 'grupo'
  const ganador = partido.home_score > partido.away_score ? partido.home?.name
    : partido.away_score > partido.home_score ? partido.away?.name : 'Empate'
  const fecha = partido.played_at
    ? new Date(partido.played_at).toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })
    : 'fecha desconocida'

  // Tabla ANTES del partido (excluyendo este partido)
  const tablaAntes = datos.tablaOrdenadaAntes.length > 0
    ? resumirTabla(datos.tablaOrdenadaAntes, [partido.home?.name, partido.away?.name])
    : 'Sin datos previos'
  // Tabla DESPUÉS del partido
  const tablaDespues = datos.tablaOrdenadaDespues.length > 0
    ? resumirTabla(datos.tablaOrdenadaDespues, [partido.home?.name, partido.away?.name])
    : 'Sin datos'

  // Goleadores del partido
  const golesPartido = datos.golesPartido.length > 0
    ? datos.golesPartido.map(g => `${g.nombre}(${g.goles})`).join(', ')
    : 'Sin goles registrados'

  // Hat-tricks en este partido
  const hatsPartido = datos.golesPartido.filter(g => g.goles >= 3).map(g => `${g.nombre}(${g.goles} goles)`).join(', ')

  // Racha de resultados de cada equipo
  const rachaHome = datos.rachaHome
  const rachaAway = datos.rachaAway

  return `RESULTADO: ${partido.home?.name} ${partido.home_score} - ${partido.away_score} ${partido.away?.name}
GANADOR: ${ganador}${esFaseElim ? ` | ${FASES_LABEL[partido.fase]} ⚡ELIMINATORIA` : ''}
FECHA: ${fecha}${partido.location ? ` · ${partido.location}` : ''}
GOLEADORES DEL PARTIDO: ${golesPartido}${hatsPartido ? ` | 🎩 HAT-TRICK: ${hatsPartido}` : ''}
TABLA ANTES: ${tablaAntes}
TABLA DESPUÉS: ${tablaDespues}
RACHA ${partido.home?.name}: ${rachaHome}
RACHA ${partido.away?.name}: ${rachaAway}
HISTORIAL DIRECTO: ${datos.enfrentamientos.length === 0 ? 'Primer enfrentamiento' : datos.enfrentamientos.join(' | ')}
RÉCORDS HISTÓRICOS ${partido.home?.name}: ${datos.resumenHome}
RÉCORDS HISTÓRICOS ${partido.away?.name}: ${datos.resumenAway}
FASES ELIM ${partido.home?.name}: ${datos.fasesHomeStr}
FASES ELIM ${partido.away?.name}: ${datos.fasesAwayStr}`
}

export default function AdminNoticiasPage() {
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const [tienePremium, setTienePremium] = useState(true)
  const isMobile = useIsMobile()

  const [torneos,   setTorneos]   = useState([])
  const [torneoId,  setTorneoId]  = useState('')
  const [partidos,  setPartidos]  = useState([])
  const [noticias,  setNoticias]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [copiado,   setCopiado]   = useState(null)
  const [expanded,  setExpanded]  = useState(null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [generandoDirecto, setGenerandoDirecto] = useState(null) // id de la tarjeta que está generando de una sola pasada
  const [indicaciones, setIndicaciones] = useState({}) // idKey -> texto que el admin escribió para guiar la noticia

  const [chatPartido,    setChatPartido]    = useState(null)
  const [chatTipo,       setChatTipo]       = useState('pre_partido') // 'pre_partido' | 'post_partido'
  const [chatMessages,   setChatMessages]   = useState([])
  const [chatInput,      setChatInput]      = useState('')
  const [chatLoading,    setChatLoading]    = useState(false)
  const [chatDatos,      setChatDatos]      = useState(null)
  const [chatContexto,   setChatContexto]   = useState('')
  const [generandoFinal, setGenerandoFinal] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) fetchTorneos() })
  }, [])
  useEffect(() => { if (torneoId) { fetchPartidos(); fetchNoticias() } }, [torneoId])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])
  useEffect(() => {
    const jornadas = [...new Set(
      partidos.filter(p => p.status==='finished' && p.matchday !== null && p.matchday !== undefined && p.matchday !== '').map(p => p.matchday)
    )].sort((a,b) => Number(a) - Number(b))
    if (jornadas.length && !jornadas.map(String).includes(String(fechaSeleccionada))) {
      setFechaSeleccionada(jornadas[jornadas.length - 1])
    } else if (!jornadas.length && fechaSeleccionada) {
      setFechaSeleccionada('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidos])
  useEffect(() => {
    if (!esOrganizador) { setTienePremium(true); return }
    supabase.from('tournaments').select('id').eq('organizador_id', user?.id).eq('premium', true).limit(1)
      .then(({ data }) => setTienePremium((data || []).length > 0))
  }, [esOrganizador, user?.id])

  function showMsg(text, type = 'ok') { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500) }

  // Evita gastar otra llamada a la IA por accidente sobre algo que ya se generó.
  function confirmarRegenerar(yaGenerada) {
    if (!yaGenerada) return true
    return confirm('Ya existe una noticia para esto. ¿Generar de nuevo? (gasta otra llamada a la IA)')
  }

  async function fetchTorneos() {
    let query = supabase.from('tournaments').select('id, name, organizador_id').order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) { showMsg('Error cargando torneos', 'error'); return }
    // Los organizadores solo ven sus propios torneos para hacer noticias
    const lista = esOrganizador ? (data || []).filter(t => t.organizador_id === user?.id) : (data || [])
    setTorneos(lista)
    if (lista?.length) setTorneoId(lista[0].id)
  }

  if (esOrganizador && !tienePremium) return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>💎</div>
      <div style={{ fontWeight: '700', color: '#202124', fontSize: '1.05rem', marginBottom: '6px' }}>Las noticias son una función Premium</div>
      <div style={{ fontSize: '.85rem', color: '#5f6368', maxWidth: '420px', margin: '0 auto' }}>
        Con el plan Premium de tu torneo puedes generar noticias con IA de tus partidos, llevar las cuentas de dinero y crear nuevas ediciones.
        Contacta a Golmebol para activarlo.
      </div>
    </div>
  )

  async function fetchPartidos() {
    const { data } = await supabase.from('matches')
      .select('*, home:home_team_id(id,name), away:away_team_id(id,name)')
      .eq('tournament_id', torneoId).order('played_at', { ascending: false })
    setPartidos(data || [])
  }

  async function fetchNoticias() {
    setLoading(true)
    const { data } = await supabase.from('noticias').select('*')
      .eq('tournament_id', torneoId).order('creada_at', { ascending: false })
    setNoticias(data || [])
    setLoading(false)
  }

  async function cargarDatosPre(partido) {
    const [
      { data: histPartidos }, { data: statsHome }, { data: statsAway },
      { data: histHome },     { data: histAway },  { data: hatTricksData },
      { data: fasesHome },    { data: fasesAway },
    ] = await Promise.all([
      supabase.from('matches').select('home_score,away_score,status,played_at,fase,home:home_team_id(name),away:away_team_id(name)').eq('tournament_id', torneoId).eq('status','finished'),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.home_team_id).gt('goals_scored',0),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.away_team_id).gt('goals_scored',0),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.home_team_id),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.away_team_id),
      supabase.from('player_match_stats').select('goals_scored,players(name)').in('team_id',[partido.home_team_id,partido.away_team_id]).gte('goals_scored',3),
      supabase.from('matches').select('fase,status,home_score,away_score,home:home_team_id(name),away:away_team_id(name)').or(`home_team_id.eq.${partido.home_team_id},away_team_id.eq.${partido.home_team_id}`).in('fase',['octavos','cuartos','semifinal','final']).eq('status','finished'),
      supabase.from('matches').select('fase,status,home_score,away_score,home:home_team_id(name),away:away_team_id(name)').or(`home_team_id.eq.${partido.away_team_id},away_team_id.eq.${partido.away_team_id}`).in('fase',['octavos','cuartos','semifinal','final']).eq('status','finished'),
    ])

    const tabla = {}
    partidos.filter(p => p.status==='finished' && p.fase==='grupo').forEach(p => {
      if (!tabla[p.home_team_id]) tabla[p.home_team_id] = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tabla[p.away_team_id]) tabla[p.away_team_id] = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      tabla[p.home_team_id].pj++; tabla[p.away_team_id].pj++
      if (p.home_score > p.away_score)      { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts+=3; tabla[p.away_team_id].pp++ }
      else if (p.home_score===p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts++; tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts++ }
      else                                  { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts+=3; tabla[p.home_team_id].pp++ }
    })

    const enfrentamientos = (histPartidos||[]).filter(p =>
      (p.home?.name===partido.home?.name||p.away?.name===partido.home?.name) &&
      (p.home?.name===partido.away?.name||p.away?.name===partido.away?.name)
    ).map(e => {
      const dias = e.played_at ? Math.floor((new Date()-new Date(e.played_at))/(1000*60*60*24)) : null
      const tiempo = dias ? dias>60 ? `hace ${Math.floor(dias/30)} meses` : `hace ${dias} días` : ''
      const fl = e.fase&&e.fase!=='grupo' ? ` [${FASES_LABEL[e.fase]}]` : ''
      return `${e.home?.name} ${e.home_score}-${e.away_score} ${e.away?.name}${fl} (${tiempo})`
    }).slice(-3)

    const golesHomeTorneo = (statsHome||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+s.goals_scored; return acc },{})
    const golesAwayTorneo = (statsAway||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+s.goals_scored; return acc },{})
    const golesHistHome   = (histHome||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+(s.goals_scored||0); return acc },{})
    const golesHistAway   = (histAway||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+(s.goals_scored||0); return acc },{})
    const hatTricks       = (hatTricksData||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+1; return acc },{})

    const formatRecords = (golesHist, golesTorneo) =>
      Object.entries(golesHist).filter(([,g])=>g>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,gTotal])=>{
        const gT=golesTorneo[n]||0; const hts=hatTricks[n]||0
        const hitos=[10,15,20,25,30,40,50,75,100].filter(j=>gTotal<j&&gTotal+4>=j).map(j=>`a ${j-gTotal} del hito ${j}`)
        return `${n}:${gTotal}g(${gT}t)${hts?` ${hts}HT`:''}${hitos.length?' ⚠️'+hitos.join(','):''}`
      }).join(' | ') || 'Sin registro'

    const formatFases = (fases, nombre) => {
      if (!fases||fases.length===0) return 'nunca en eliminatoria'
      const res={}
      fases.forEach(f=>{ if(!res[f.fase]) res[f.fase]={total:0,ganados:0}; res[f.fase].total++; const esH=f.home?.name===nombre; if((esH?f.home_score:f.away_score)>(esH?f.away_score:f.home_score)) res[f.fase].ganados++ })
      return Object.entries(res).map(([fase,r])=>`${FASES_LABEL[fase]}:${r.total}x(${r.ganados}adv)`).join(' ')
    }

    return {
      tablaOrdenada: Object.values(tabla).sort((a,b)=>b.pts-a.pts),
      enfrentamientos, golesHomeTorneo, golesAwayTorneo,
      resumenHome: formatRecords(golesHistHome, golesHomeTorneo),
      resumenAway: formatRecords(golesHistAway, golesAwayTorneo),
      fasesHomeStr: formatFases(fasesHome||[], partido.home?.name),
      fasesAwayStr: formatFases(fasesAway||[], partido.away?.name),
    }
  }

  async function cargarDatosPost(partido) {
    const [
      { data: statsPartido },
      { data: histHome }, { data: histAway },
      { data: hatTricksData },
      { data: fasesHome }, { data: fasesAway },
      { data: todosPartidos },
    ] = await Promise.all([
      // Stats de jugadores en este partido específico
      supabase.from('player_match_stats').select('goals_scored,players(name),team_id').eq('match_id', partido.id).gt('goals_scored',0),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.home_team_id),
      supabase.from('player_match_stats').select('goals_scored,players(name)').eq('team_id', partido.away_team_id),
      supabase.from('player_match_stats').select('goals_scored,players(name)').in('team_id',[partido.home_team_id,partido.away_team_id]).gte('goals_scored',3),
      supabase.from('matches').select('fase,status,home_score,away_score,home:home_team_id(name),away:away_team_id(name)').or(`home_team_id.eq.${partido.home_team_id},away_team_id.eq.${partido.home_team_id}`).in('fase',['octavos','cuartos','semifinal','final']).eq('status','finished'),
      supabase.from('matches').select('fase,status,home_score,away_score,home:home_team_id(name),away:away_team_id(name)').or(`home_team_id.eq.${partido.away_team_id},away_team_id.eq.${partido.away_team_id}`).in('fase',['octavos','cuartos','semifinal','final']).eq('status','finished'),
      supabase.from('matches').select('id,home_score,away_score,status,played_at,fase,home_team_id,away_team_id,home:home_team_id(name),away:away_team_id(name)').eq('tournament_id', torneoId).eq('status','finished').order('played_at', { ascending: true }),
    ])

    // Tabla ANTES (sin contar este partido)
    const tablaAntes = {}
    const tablaDespues = {}
    ;(todosPartidos||[]).forEach(p => {
      if (!tablaAntes[p.home_team_id]) tablaAntes[p.home_team_id] = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaAntes[p.away_team_id]) tablaAntes[p.away_team_id] = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaDespues[p.home_team_id]) tablaDespues[p.home_team_id] = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaDespues[p.away_team_id]) tablaDespues[p.away_team_id] = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }

      // En tablaAntes excluimos este partido
      if (p.id !== partido.id && p.fase === 'grupo') {
        tablaAntes[p.home_team_id].pj++; tablaAntes[p.away_team_id].pj++
        if (p.home_score > p.away_score)      { tablaAntes[p.home_team_id].pg++; tablaAntes[p.home_team_id].pts+=3; tablaAntes[p.away_team_id].pp++ }
        else if (p.home_score===p.away_score) { tablaAntes[p.home_team_id].pe++; tablaAntes[p.home_team_id].pts++; tablaAntes[p.away_team_id].pe++; tablaAntes[p.away_team_id].pts++ }
        else                                  { tablaAntes[p.away_team_id].pg++; tablaAntes[p.away_team_id].pts+=3; tablaAntes[p.home_team_id].pp++ }
      }
      // En tablaDespues incluimos todos
      if (p.fase === 'grupo') {
        tablaDespues[p.home_team_id].pj++; tablaDespues[p.away_team_id].pj++
        if (p.home_score > p.away_score)      { tablaDespues[p.home_team_id].pg++; tablaDespues[p.home_team_id].pts+=3; tablaDespues[p.away_team_id].pp++ }
        else if (p.home_score===p.away_score) { tablaDespues[p.home_team_id].pe++; tablaDespues[p.home_team_id].pts++; tablaDespues[p.away_team_id].pe++; tablaDespues[p.away_team_id].pts++ }
        else                                  { tablaDespues[p.away_team_id].pg++; tablaDespues[p.away_team_id].pts+=3; tablaDespues[p.home_team_id].pp++ }
      }
    })

    // Racha de resultados (últimos 5 partidos de cada equipo)
    const getRacha = (teamId, teamName) => {
      const partEquipo = (todosPartidos||[])
        .filter(p => (p.home_team_id===teamId||p.away_team_id===teamId) && p.id !== partido.id)
        .slice(-5)
      if (partEquipo.length === 0) return 'Sin partidos previos'
      const resultados = partEquipo.map(p => {
        const esHome = p.home_team_id === teamId
        const golesEq = esHome ? p.home_score : p.away_score
        const golesRiv = esHome ? p.away_score : p.home_score
        return golesEq > golesRiv ? 'G' : golesEq === golesRiv ? 'E' : 'P'
      })
      const rachaActual = resultados[resultados.length-1]
      let racha = 1
      for (let i = resultados.length-2; i >= 0; i--) {
        if (resultados[i] === rachaActual) racha++; else break
      }
      return `Últimos 5: ${resultados.join('-')} | Racha: ${racha} ${rachaActual==='G'?'victorias':rachaActual==='E'?'empates':'derrotas'} seguidas`
    }

    // Historial directo
    const enfrentamientos = (todosPartidos||[]).filter(p =>
      (p.home?.name===partido.home?.name||p.away?.name===partido.home?.name) &&
      (p.home?.name===partido.away?.name||p.away?.name===partido.away?.name)
    ).map(e => {
      const dias = e.played_at ? Math.floor((new Date()-new Date(e.played_at))/(1000*60*60*24)) : null
      const tiempo = dias ? dias>60 ? `hace ${Math.floor(dias/30)} meses` : `hace ${dias} días` : ''
      const fl = e.fase&&e.fase!=='grupo' ? ` [${FASES_LABEL[e.fase]}]` : ''
      return `${e.home?.name} ${e.home_score}-${e.away_score} ${e.away?.name}${fl} (${tiempo})`
    }).slice(-3)

    // Goleadores del partido
    const golesPartido = (statsPartido||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+s.goals_scored; return acc },{})
    const golesPartidoArr = Object.entries(golesPartido).map(([nombre,goles])=>({nombre,goles})).sort((a,b)=>b.goles-a.goles)

    // Récords históricos
    const golesHistHome = (histHome||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+(s.goals_scored||0); return acc },{})
    const golesHistAway = (histAway||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+(s.goals_scored||0); return acc },{})
    const hatTricks     = (hatTricksData||[]).reduce((acc,s)=>{ const n=s.players?.name; if(n) acc[n]=(acc[n]||0)+1; return acc },{})

    const formatRecords = (golesHist) =>
      Object.entries(golesHist).filter(([,g])=>g>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,gTotal])=>{
        const hts=hatTricks[n]||0
        const hitos=[10,15,20,25,30,40,50,75,100].filter(j=>gTotal<j&&gTotal+4>=j).map(j=>`a ${j-gTotal} del hito ${j}`)
        return `${n}:${gTotal}g hist${hts?` ${hts}HT`:''}${hitos.length?' ⚠️'+hitos.join(','):''}`
      }).join(' | ') || 'Sin registro'

    const formatFases = (fases, nombre) => {
      if (!fases||fases.length===0) return 'nunca en eliminatoria'
      const res={}
      fases.forEach(f=>{ if(!res[f.fase]) res[f.fase]={total:0,ganados:0}; res[f.fase].total++; const esH=f.home?.name===nombre; if((esH?f.home_score:f.away_score)>(esH?f.away_score:f.home_score)) res[f.fase].ganados++ })
      return Object.entries(res).map(([fase,r])=>`${FASES_LABEL[fase]}:${r.total}x(${r.ganados}adv)`).join(' ')
    }

    return {
      tablaOrdenadaAntes:   Object.values(tablaAntes).sort((a,b)=>b.pts-a.pts),
      tablaOrdenadaDespues: Object.values(tablaDespues).sort((a,b)=>b.pts-a.pts),
      enfrentamientos,
      golesPartido: golesPartidoArr,
      rachaHome: getRacha(partido.home_team_id, partido.home?.name),
      rachaAway: getRacha(partido.away_team_id, partido.away?.name),
      resumenHome: formatRecords(golesHistHome),
      resumenAway: formatRecords(golesHistAway),
      fasesHomeStr: formatFases(fasesHome||[], partido.home?.name),
      fasesAwayStr: formatFases(fasesAway||[], partido.away?.name),
    }
  }

  async function cargarDatosFecha(jornadaNum) {
    const partidosFecha = partidos.filter(p => p.status === 'finished' && String(p.matchday) === String(jornadaNum))
    const idsFecha = partidosFecha.map(p => p.id)

    const [{ data: statsFecha }, { data: todosPartidos }] = await Promise.all([
      idsFecha.length
        ? supabase.from('player_match_stats').select('goals_scored,players(name),team_id,match_id').in('match_id', idsFecha).gt('goals_scored', 0)
        : Promise.resolve({ data: [] }),
      supabase.from('matches').select('id,home_score,away_score,status,played_at,fase,matchday,home_team_id,away_team_id,home:home_team_id(name),away:away_team_id(name)')
        .eq('tournament_id', torneoId).eq('status', 'finished').eq('fase', 'grupo').order('played_at', { ascending: true }),
    ])

    // Tabla antes (excluyendo los partidos de esta fecha) y después (con todos)
    const tablaAntes = {}
    const tablaDespues = {}
    ;(todosPartidos || []).forEach(p => {
      if (!tablaAntes[p.home_team_id])   tablaAntes[p.home_team_id]   = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaAntes[p.away_team_id])   tablaAntes[p.away_team_id]   = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaDespues[p.home_team_id]) tablaDespues[p.home_team_id] = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tablaDespues[p.away_team_id]) tablaDespues[p.away_team_id] = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }

      const esDeEstaFecha = idsFecha.includes(p.id)
      if (!esDeEstaFecha) {
        tablaAntes[p.home_team_id].pj++; tablaAntes[p.away_team_id].pj++
        if (p.home_score > p.away_score)      { tablaAntes[p.home_team_id].pg++; tablaAntes[p.home_team_id].pts+=3; tablaAntes[p.away_team_id].pp++ }
        else if (p.home_score===p.away_score) { tablaAntes[p.home_team_id].pe++; tablaAntes[p.home_team_id].pts++; tablaAntes[p.away_team_id].pe++; tablaAntes[p.away_team_id].pts++ }
        else                                  { tablaAntes[p.away_team_id].pg++; tablaAntes[p.away_team_id].pts+=3; tablaAntes[p.home_team_id].pp++ }
      }
      tablaDespues[p.home_team_id].pj++; tablaDespues[p.away_team_id].pj++
      if (p.home_score > p.away_score)      { tablaDespues[p.home_team_id].pg++; tablaDespues[p.home_team_id].pts+=3; tablaDespues[p.away_team_id].pp++ }
      else if (p.home_score===p.away_score) { tablaDespues[p.home_team_id].pe++; tablaDespues[p.home_team_id].pts++; tablaDespues[p.away_team_id].pe++; tablaDespues[p.away_team_id].pts++ }
      else                                  { tablaDespues[p.away_team_id].pg++; tablaDespues[p.away_team_id].pts+=3; tablaDespues[p.home_team_id].pp++ }
    })

    const golesFecha = (statsFecha || []).reduce((acc,s) => { const n = s.players?.name; if (n) acc[n] = (acc[n]||0) + s.goals_scored; return acc }, {})
    const golesFechaArr = Object.entries(golesFecha).map(([nombre,goles]) => ({ nombre, goles })).sort((a,b) => b.goles - a.goles)
    const hatTricks = golesFechaArr.filter(g => g.goles >= 3)

    const golear = [...partidosFecha].sort((a,b) => Math.abs(b.home_score-b.away_score) - Math.abs(a.home_score-a.away_score))[0] || null

    return {
      partidosFecha,
      resultados: partidosFecha.map(p => `${p.home?.name} ${p.home_score}-${p.away_score} ${p.away?.name}${p.fase && p.fase!=='grupo' ? ` [${FASES_LABEL[p.fase]}]` : ''}`),
      tablaOrdenadaAntes:   Object.values(tablaAntes).sort((a,b)=>b.pts-a.pts),
      tablaOrdenadaDespues: Object.values(tablaDespues).sort((a,b)=>b.pts-a.pts),
      golesFecha: golesFechaArr,
      hatTricks,
      golear,
      cantidadPartidos: partidosFecha.length,
    }
  }

  function buildContextoFecha(jornadaNum, datos) {
    const equiposFecha = [...new Set((datos.partidosFecha||[]).flatMap(p => [p.home?.name, p.away?.name]).filter(Boolean))]
    const tablaAntesStr   = datos.tablaOrdenadaAntes.length   ? resumirTabla(datos.tablaOrdenadaAntes, equiposFecha)   : 'Sin datos previos'
    const tablaDespuesStr = datos.tablaOrdenadaDespues.length ? resumirTabla(datos.tablaOrdenadaDespues, equiposFecha) : 'Sin datos'
    const golesStr = datos.golesFecha.length ? datos.golesFecha.map(g=>`${g.nombre}(${g.goles})`).join(', ') : 'Sin goleadores registrados'
    const hatsStr  = datos.hatTricks.length ? datos.hatTricks.map(g=>`${g.nombre}(${g.goles} goles)`).join(', ') : 'Ninguno'
    const golearStr = datos.golear ? `${datos.golear.home?.name} ${datos.golear.home_score}-${datos.golear.away_score} ${datos.golear.away?.name}` : 'N/A'
    return `FECHA ${jornadaNum} — ${datos.cantidadPartidos} partido(s) jugado(s)
RESULTADOS DE LA FECHA: ${datos.resultados.join(' | ') || 'Sin resultados'}
TABLA ANTES DE LA FECHA: ${tablaAntesStr}
TABLA DESPUÉS DE LA FECHA: ${tablaDespuesStr}
GOLEADORES DE LA FECHA: ${golesStr}
HAT-TRICKS DE LA FECHA: ${hatsStr}
RESULTADO MÁS CONTUNDENTE: ${golearStr}`
  }

  // Ranking del torneo: goleador, valla menos vencida y tabla — sin depender
  // de un partido puntual (útil cuando no viste el partido y solo quieres
  // contenido con datos duros de la planilla).
  async function cargarDatosRanking() {
    const [{ data: goleadoresData }, { data: statsPorteros }, { data: partidosGrupo }] = await Promise.all([
      supabase.from('goleadores_por_torneo').select('*').eq('tournament_id', torneoId).gt('total_goals', 0).order('total_goals', { ascending: false }),
      supabase.from('player_match_stats').select('player_id, goals_conceded, players(name, posicion_futbol5, posicion_futbol7, posicion_futbol11), teams(name)').eq('tournament_id', torneoId),
      supabase.from('matches').select('home_score,away_score,status,fase,home_team_id,away_team_id,home:home_team_id(name),away:away_team_id(name)').eq('tournament_id', torneoId).eq('status','finished').eq('fase','grupo'),
    ])

    const goleadores = (goleadoresData || []).slice(0, 5)

    const mapPorteros = {}
    ;(statsPorteros || []).forEach(s => {
      const esPortero = s.players?.posicion_futbol5 === 'Portero' || s.players?.posicion_futbol7 === 'Portero' || s.players?.posicion_futbol11 === 'Portero'
      if (!esPortero) return
      if (!mapPorteros[s.player_id]) mapPorteros[s.player_id] = { nombre: s.players?.name, equipo: s.teams?.name, pj: 0, recibidos: 0 }
      mapPorteros[s.player_id].pj++
      mapPorteros[s.player_id].recibidos += s.goals_conceded || 0
    })
    const vallas = Object.values(mapPorteros).filter(p => p.pj > 0).sort((a,b) => a.recibidos - b.recibidos).slice(0, 3)

    const tabla = {}
    ;(partidosGrupo || []).forEach(p => {
      if (!tabla[p.home_team_id]) tabla[p.home_team_id] = { name: p.home?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      if (!tabla[p.away_team_id]) tabla[p.away_team_id] = { name: p.away?.name, pj:0,pg:0,pe:0,pp:0,pts:0 }
      tabla[p.home_team_id].pj++; tabla[p.away_team_id].pj++
      if (p.home_score > p.away_score)      { tabla[p.home_team_id].pg++; tabla[p.home_team_id].pts+=3; tabla[p.away_team_id].pp++ }
      else if (p.home_score===p.away_score) { tabla[p.home_team_id].pe++; tabla[p.home_team_id].pts++; tabla[p.away_team_id].pe++; tabla[p.away_team_id].pts++ }
      else                                  { tabla[p.away_team_id].pg++; tabla[p.away_team_id].pts+=3; tabla[p.home_team_id].pp++ }
    })

    return {
      goleadores,
      vallas,
      tablaOrdenada: Object.values(tabla).sort((a,b)=>b.pts-a.pts),
      cantidadPartidos: (partidosGrupo||[]).length,
    }
  }

  function buildContextoRanking(datos) {
    const golStr = datos.goleadores.length
      ? datos.goleadores.map((g,i) => `${i+1}.${g.player_name} (${g.team_name}) ${g.total_goals} goles`).join(' | ')
      : 'Sin goleadores registrados'
    const vallaStr = datos.vallas.length
      ? datos.vallas.map((v,i) => `${i+1}.${v.nombre} (${v.equipo}) ${v.recibidos} recibidos en ${v.pj} PJ`).join(' | ')
      : 'Sin datos de arqueros'
    const tablaStr = datos.tablaOrdenada.length
      ? datos.tablaOrdenada.slice(0,5).map((t,i)=>`${i+1}.${t.name} ${t.pts}pts`).join(' | ') + (datos.tablaOrdenada.length>5 ? ` (+${datos.tablaOrdenada.length-5} equipos más)` : '')
      : 'Sin datos'
    return `RANKING DEL TORNEO — ${datos.cantidadPartidos} partido(s) de grupo jugado(s)
TABLA DE POSICIONES: ${tablaStr}
GOLEADOR DEL TORNEO: ${golStr}
VALLA MENOS VENCIDA (arqueros con menos goles recibidos): ${vallaStr}`
  }

  async function generarNoticiaRankingDirecta() {
    const idKey = 'ranking'
    setGenerandoDirecto(idKey)
    try {
      const datos = await cargarDatosRanking()
      const ctx = buildContextoRanking(datos)
      const indicacion = (indicaciones[idKey] || '').trim()

      const instruccion = `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia de RANKING/ESTADÍSTICAS del torneo (no es sobre un partido puntual, es sobre los números acumulados) para Instagram/WhatsApp.

Escribe:
1. Título IMPACTANTE en mayúsculas (máx 8 palabras)
2. Máx 4 líneas — menciona quién lidera la tabla, quién es el goleador del torneo, y qué arquero/equipo tiene la valla menos vencida
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown.${indicacion ? `\n\nINDICACIÓN DEL ADMIN (tenla en cuenta por encima de lo demás): ${indicacion}` : ''}`

      const texto = await llamarIA([{ role: 'user', content: `DATOS:\n${ctx}\n\n${instruccion}` }], 500)
      const { titulo, cuerpo, hashtags } = parseNoticia(texto)
      await supabase.from('noticias').insert({ tournament_id: torneoId, match_id: null, tipo: 'ranking', titulo, cuerpo, hashtags })
      showMsg('✅ Ranking generado')
      fetchNoticias()
    } catch (e) {
      showMsg(e.message, 'error')
    }
    setGenerandoDirecto(null)
  }

  async function abrirChatFecha(jornadaNum) {
    if (!jornadaNum) return
    setChatPartido({ esFecha: true, matchday: jornadaNum })
    setChatTipo('semanal')
    setChatMessages([])
    setChatInput('')
    setChatLoading(true)

    const datos = await cargarDatosFecha(jornadaNum)
    setChatDatos(datos)
    const ctx = buildContextoFecha(jornadaNum, datos)
    setChatContexto(ctx)

    const instruccion = `Analista deportivo GOLMEBOL. Resumen de la FECHA ${jornadaNum} completa (todos los partidos de esa jornada).\n\nDame máx 4 puntos con los datos MÁS INTERESANTES de toda la fecha (equipo que más brilló, cambios en la tabla, goleador de la fecha, resultado más contundente, hat-tricks). Sé muy conciso. Luego pregunta si genero ya o quiero explorar algo.`

    try {
      const respuestaIA = await llamarIA([{ role: 'user', content: [bloqueContexto(ctx), { type: 'text', text: instruccion }] }], 400)
      setChatMessages([{ role: 'assistant', content: respuestaIA }])
    } catch (e) {
      setChatMessages([{ role: 'assistant', content: `⚠️ ${e.message}` }])
      showMsg(e.message, 'error')
    }
    setChatLoading(false)
  }

  async function abrirChat(partido, tipo) {
    setChatPartido(partido)
    setChatTipo(tipo)
    setChatMessages([])
    setChatInput('')
    setChatLoading(true)

    let ctx = ''
    if (tipo === 'pre_partido') {
      const datos = await cargarDatosPre(partido)
      setChatDatos(datos)
      ctx = buildContextoPre(partido, datos)
    } else {
      const datos = await cargarDatosPost(partido)
      setChatDatos(datos)
      ctx = buildContextoPost(partido, datos)
    }
    setChatContexto(ctx)

    const esFaseElim = partido.fase && partido.fase !== 'grupo'
    const tipoTexto = tipo === 'pre_partido' ? 'PRE-PARTIDO' : 'POST-PARTIDO'

    const instruccion = `Analista deportivo GOLMEBOL. Datos del ${tipoTexto}.\n\nDame máx 4 puntos con los datos MÁS INTERESANTES y picantes para la noticia${tipo==='post_partido' ? ' (prioriza: cambios en tabla, rachas, récords rotos, hat-tricks, primera victoria histórica entre estos equipos)' : ' (prioriza hitos ⚠️, hat-tricks, fases eliminatorias, historial)'}. Sé muy conciso. Luego pregunta si genero ya o quiero explorar algo.`

    try {
      const respuestaIA = await llamarIA([{ role: 'user', content: [bloqueContexto(ctx), { type: 'text', text: instruccion }] }], 400)
      setChatMessages([{ role: 'assistant', content: respuestaIA }])
    } catch (e) {
      setChatMessages([{ role: 'assistant', content: `⚠️ ${e.message}` }])
      showMsg(e.message, 'error')
    }
    setChatLoading(false)
  }

  async function enviarMensaje() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user', content: chatInput.trim() }
    const nuevosMensajes = [...chatMessages, userMsg]
    setChatMessages(nuevosMensajes)
    setChatInput('')
    setChatLoading(true)

    const mensajesParaIA = [
      { role: 'user', content: [bloqueContexto(chatContexto), { type: 'text', text: 'Analista GOLMEBOL.' }] },
      { role: 'assistant', content: chatMessages[0]?.content || '' },
      ...nuevosMensajes.slice(1),
    ]

    try {
      const respuesta = await llamarIA(mensajesParaIA, 350)
      setChatMessages(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message}` }])
      showMsg(e.message, 'error')
    }
    setChatLoading(false)
  }

  async function generarNoticiaDesdeChaT() {
    if (!chatDatos || !chatPartido) return
    setGenerandoFinal(true)

    if (chatPartido.esFecha) {
      const jornadaNum = chatPartido.matchday
      const datoClave = chatMessages[0]?.content?.split('\n').slice(0,4).join(' ') || ''
      const instruccion = `Periodista deportivo GOLMEBOL, Armenia, Colombia. Resumen de una FECHA completa del torneo (varios partidos) para Instagram/WhatsApp.

DATO CLAVE DEL ANÁLISIS: ${datoClave}

Escribe:
1. Título IMPACTANTE en mayúsculas (máx 8 palabras) sobre la Fecha ${jornadaNum}
2. Máx 5 líneas — cuenta la fecha como una historia: qué equipo brilló, quién se hundió, el resultado más contundente, goleador de la fecha, cómo quedó la tabla. No listes los resultados uno por uno, narra el conjunto.
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 15 segundos de lectura.`

      try {
        const texto = await llamarIA([{ role: 'user', content: [bloqueContexto(chatContexto), { type: 'text', text: instruccion }] }], 550)
        if (!texto) { showMsg('La IA no devolvió respuesta', 'error'); setGenerandoFinal(false); return }
        const { titulo, cuerpo, hashtags } = parseNoticia(texto)
        await supabase.from('noticias').insert({ tournament_id: torneoId, match_id: null, tipo: 'semanal', titulo, cuerpo, hashtags })
        showMsg('✅ Resumen de fecha generado')
        fetchNoticias()
        setChatPartido(null)
      } catch (e) {
        showMsg('Error: ' + e.message, 'error')
      }
      setGenerandoFinal(false)
      return
    }

    const partido = chatPartido
    const esFaseElim = partido.fase && partido.fase !== 'grupo'
    const faseLabel  = FASES_LABEL[partido.fase||'grupo'] || ''
    const datoClave  = chatMessages[0]?.content?.split('\n').slice(0,4).join(' ') || ''
    const esPost     = chatTipo === 'post_partido'

    const instruccion = esPost
      ? `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia POST-PARTIDO explosiva para Instagram/WhatsApp.

DATO CLAVE DEL ANÁLISIS: ${datoClave}

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras) — menciona el resultado${esFaseElim?' y la '+faseLabel:''}
2. Máx 3 líneas — arranca con el resultado, usa el dato más picante (cambio en tabla, racha, récord roto, hat-trick, primera victoria histórica). Termina con qué viene ahora.
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.`
      : `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia PRE-PARTIDO explosiva para Instagram/WhatsApp.

DATO CLAVE DEL ANÁLISIS: ${datoClave}

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras)${esFaseElim?' — incluye '+faseLabel:''}
2. Máx 3 líneas — usa el dato clave como gancho, termina generando expectativa
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.`

    try {
      const texto = await llamarIA([{ role: 'user', content: [bloqueContexto(chatContexto), { type: 'text', text: instruccion }] }], 500)
      if (!texto) { showMsg('La IA no devolvió respuesta', 'error'); setGenerandoFinal(false); return }
      const { titulo, cuerpo, hashtags } = parseNoticia(texto)

      const { data: existente } = await supabase.from('noticias').select('id')
        .eq('match_id', partido.id).eq('tipo', chatTipo).maybeSingle()
      if (existente) {
        await supabase.from('noticias').update({ titulo, cuerpo, hashtags }).eq('id', existente.id)
      } else {
        await supabase.from('noticias').insert({ tournament_id: torneoId, match_id: partido.id, tipo: chatTipo, titulo, cuerpo, hashtags })
      }
      showMsg('✅ Noticia generada')
      fetchNoticias()
      setChatPartido(null)
    } catch (e) {
      showMsg('Error: ' + e.message, 'error')
    }
    setGenerandoFinal(false)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta noticia?')) return
    await supabase.from('noticias').delete().eq('id', id)
    fetchNoticias()
    showMsg('Noticia eliminada')
  }

  function copiarNoticia(n) {
    navigator.clipboard.writeText(`${n.titulo}\n\n${n.cuerpo}\n\n${n.hashtags}`)
    setCopiado(n.id)
    setTimeout(() => setCopiado(null), 2000)
  }

  // Genera la noticia en UNA sola llamada a la IA (sin el paso de análisis/chat previo) — cuesta la mitad.
  async function generarNoticiaDirecta(partido, tipo) {
    const idKey = `${tipo}_${partido.id}`
    setGenerandoDirecto(idKey)
    try {
      const datos = tipo === 'pre_partido' ? await cargarDatosPre(partido) : await cargarDatosPost(partido)
      const ctx   = tipo === 'pre_partido' ? buildContextoPre(partido, datos) : buildContextoPost(partido, datos)
      const esFaseElim = partido.fase && partido.fase !== 'grupo'
      const faseLabel  = FASES_LABEL[partido.fase||'grupo'] || ''
      const esPost = tipo === 'post_partido'
      const indicacion = (indicaciones[idKey] || '').trim()

      const instruccion = esPost
        ? `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia POST-PARTIDO explosiva para Instagram/WhatsApp.

Primero identifica tú mismo, de los datos, el dato más picante (cambio en tabla, racha, récord roto, hat-trick, primera victoria histórica) y úsalo como eje de la noticia.

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras) — menciona el resultado${esFaseElim?' y la '+faseLabel:''}
2. Máx 3 líneas — arranca con el resultado, usa el dato más picante que identificaste. Termina con qué viene ahora.
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.${indicacion ? `\n\nINDICACIÓN DEL ADMIN (tenla en cuenta por encima de lo demás): ${indicacion}` : ''}`
        : `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia PRE-PARTIDO explosiva para Instagram/WhatsApp.

Primero identifica tú mismo, de los datos, el dato más interesante (hitos, hat-tricks, fases eliminatorias, historial) y úsalo como gancho.

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras)${esFaseElim?' — incluye '+faseLabel:''}
2. Máx 3 líneas — usa el dato clave como gancho, termina generando expectativa
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.${indicacion ? `\n\nINDICACIÓN DEL ADMIN (tenla en cuenta por encima de lo demás): ${indicacion}` : ''}`

      // Sin cache_control aquí: es una sola llamada, nunca se reusa este texto,
      // así que "cachearlo" solo pagaría el 25% extra de escritura sin beneficio.
      const texto = await llamarIA([{ role: 'user', content: `DATOS:\n${ctx}\n\n${instruccion}` }], 500)
      const { titulo, cuerpo, hashtags } = parseNoticia(texto)

      const { data: existente } = await supabase.from('noticias').select('id')
        .eq('match_id', partido.id).eq('tipo', tipo).maybeSingle()
      if (existente) {
        await supabase.from('noticias').update({ titulo, cuerpo, hashtags }).eq('id', existente.id)
      } else {
        await supabase.from('noticias').insert({ tournament_id: torneoId, match_id: partido.id, tipo, titulo, cuerpo, hashtags })
      }
      showMsg('✅ Noticia generada')
      fetchNoticias()
    } catch (e) {
      showMsg(e.message, 'error')
    }
    setGenerandoDirecto(null)
  }

  async function generarNoticiaFechaDirecta(jornadaNum) {
    if (!jornadaNum) return
    const idKey = `fecha_${jornadaNum}`
    setGenerandoDirecto(idKey)
    try {
      const datos = await cargarDatosFecha(jornadaNum)
      const ctx   = buildContextoFecha(jornadaNum, datos)
      const indicacion = (indicaciones[idKey] || '').trim()

      const instruccion = `Periodista deportivo GOLMEBOL, Armenia, Colombia. Resumen de una FECHA completa del torneo (varios partidos) para Instagram/WhatsApp.

Primero identifica tú mismo, de los datos, el dato más interesante de toda la fecha (equipo que más brilló, cambios en la tabla, goleador de la fecha, resultado más contundente, hat-tricks) y úsalo como eje.

Escribe:
1. Título IMPACTANTE en mayúsculas (máx 8 palabras) sobre la Fecha ${jornadaNum}
2. Máx 5 líneas — cuenta la fecha como una historia: qué equipo brilló, quién se hundió, el resultado más contundente, goleador de la fecha, cómo quedó la tabla. No listes los resultados uno por uno, narra el conjunto.
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 15 segundos de lectura.${indicacion ? `\n\nINDICACIÓN DEL ADMIN (tenla en cuenta por encima de lo demás): ${indicacion}` : ''}`

      // Sin cache_control aquí tampoco, por la misma razón: es una sola llamada.
      const texto = await llamarIA([{ role: 'user', content: `DATOS:\n${ctx}\n\n${instruccion}` }], 550)
      const { titulo, cuerpo, hashtags } = parseNoticia(texto)
      await supabase.from('noticias').insert({ tournament_id: torneoId, match_id: null, tipo: 'semanal', titulo, cuerpo, hashtags })
      showMsg('✅ Resumen de fecha generado')
      fetchNoticias()
    } catch (e) {
      showMsg(e.message, 'error')
    }
    setGenerandoDirecto(null)
  }

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const jugados    = partidos.filter(p => p.status === 'finished')
  const tipoLabel  = { pre_partido: '⚡ Pre-partido', post_partido: '🏁 Post-partido', semanal: '📋 Resumen de fecha', ranking: '🏆 Ranking' }
  const tipoColor  = { pre_partido: '#1a73e8', post_partido: '#1e8e3e', semanal: '#6c35de', ranking: '#e8710a' }
  const tipoBg     = { pre_partido: '#e8f0fe', post_partido: '#e6f4ea', semanal: '#f3e8fd', ranking: '#fce8d9' }

  const jornadasConPartidos = [...new Set(
    jugados.filter(p => p.matchday !== null && p.matchday !== undefined && p.matchday !== '').map(p => p.matchday)
  )].sort((a,b) => Number(a) - Number(b))

  return (
    <div>
      {msg && (
        <div style={{ position:'fixed', top:'1rem', left:'50%', transform:'translateX(-50%)', background:msg.type==='error'?'#d93025':'#1e8e3e', color:'#fff', borderRadius:'8px', padding:'10px 24px', zIndex:9999, fontSize:'.875rem', boxShadow:'0 4px 12px rgba(0,0,0,.2)', whiteSpace:'nowrap' }}>
          {msg.text}
        </div>
      )}

      {/* CHAT MODAL */}
      {chatPartido && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'580px', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:'700', color:'#202124', fontSize:'.95rem', display:'flex', alignItems:'center', gap:'6px' }}>
                  <MessageSquare size={16} color={chatPartido.esFecha?'#6c35de':chatTipo==='post_partido'?'#1e8e3e':'#1a73e8'}/>
                  {chatPartido.esFecha ? `📋 Resumen de la Fecha ${chatPartido.matchday}` : chatTipo==='post_partido' ? '🏁 Análisis Post-partido' : '⚡ Análisis Pre-partido'}
                </div>
                <div style={{ fontSize:'.75rem', color:'#5f6368', marginTop:'2px' }}>
                  {chatPartido.esFecha
                    ? `${chatDatos?.cantidadPartidos ?? 0} partido(s) de esa fecha`
                    : <>{chatPartido.home?.name} {chatTipo==='post_partido'?`${chatPartido.home_score} - ${chatPartido.away_score}`:''} {chatPartido.away?.name}
                      {chatPartido.fase&&chatPartido.fase!=='grupo' && <span style={{ color:'#e8710a', fontWeight:'700', marginLeft:'6px' }}>{FASES_LABEL[chatPartido.fase]}</span>}</>}
                </div>
              </div>
              <button onClick={() => setChatPartido(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6', padding:'4px' }}><X size={20}/></button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px' }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
                  <div style={{ maxWidth:'85%', padding:'10px 14px', borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px', background:m.role==='user'?'#1a73e8':'#f1f3f4', color:m.role==='user'?'#fff':'#202124', fontSize:'.82rem', lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display:'flex', justifyContent:'flex-start' }}>
                  <div style={{ background:'#f1f3f4', borderRadius:'12px 12px 12px 2px', padding:'10px 16px', fontSize:'.82rem', color:'#9aa0a6', display:'flex', alignItems:'center', gap:'8px' }}>
                    <RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Analizando...
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>

            <div style={{ padding:'12px 16px', borderTop:'1px solid #e8eaed', flexShrink:0 }}>
              <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key==='Enter'&&!e.shiftKey&&enviarMensaje()}
                  placeholder={chatTipo==='post_partido' ? 'Pregunta... ¿cómo cambió la tabla? ¿quién marcó?' : 'Pregunta... ¿cuántos goles lleva X? ¿cuál es el historial?'}
                  style={{ flex:1, background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'10px', padding:'9px 14px', fontSize:'.82rem', outline:'none', color:'#202124' }}
                  disabled={chatLoading}/>
                <button onClick={enviarMensaje} disabled={chatLoading||!chatInput.trim()}
                  style={{ padding:'9px 14px', background:chatInput.trim()?'#1a73e8':'#f1f3f4', border:'none', borderRadius:'10px', cursor:chatInput.trim()?'pointer':'not-allowed', color:chatInput.trim()?'#fff':'#9aa0a6', display:'flex', alignItems:'center' }}>
                  <Send size={16}/>
                </button>
              </div>
              <button onClick={generarNoticiaDesdeChaT} disabled={generandoFinal||chatLoading||chatMessages.length===0}
                style={{ width:'100%', padding:'11px', background:generandoFinal||chatMessages.length===0?'#f1f3f4':chatPartido?.esFecha?'#6c35de':chatTipo==='post_partido'?'#1e8e3e':'#1a73e8', border:'none', borderRadius:'10px', cursor:generandoFinal||chatMessages.length===0?'not-allowed':'pointer', color:generandoFinal||chatMessages.length===0?'#9aa0a6':'#fff', fontWeight:'700', fontSize:'.875rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                {generandoFinal ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <><Zap size={14}/> Generar noticia con este análisis</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:isMobile?'flex-start':'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'1.25rem', fontWeight:'600', color:'#202124', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
            <Newspaper size={20} color="#1a73e8"/> Noticias del Torneo
          </h1>
          <p style={{ color:'#5f6368', margin:'4px 0 0', fontSize:'.875rem' }}>Con IA · Datos históricos reales · Listos para Instagram y WhatsApp</p>
        </div>
        <select value={torneoId} onChange={e => setTorneoId(e.target.value)}
          style={{ background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'8px 12px', color:'#202124', fontSize:'.875rem', outline:'none', cursor:'pointer' }}>
          {torneos.length===0 && <option value="">Cargando...</option>}
          {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'320px 1fr', gap:'20px', alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Pre-partido */}
          <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:'600', color:'#202124', fontSize:'.9rem', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
              <Zap size={16} color="#1a73e8"/> Pre-partido
            </div>
            <div style={{ fontSize:'.75rem', color:'#5f6368', marginBottom:'10px' }}>Partidos pendientes</div>
            {pendientes.length===0 ? (
              <div style={{ fontSize:'.78rem', color:'#9aa0a6', textAlign:'center', padding:'12px' }}>Sin partidos pendientes</div>
            ) : pendientes.map(p => {
              const yaGenerada = noticias.some(n => n.match_id===p.id && n.tipo==='pre_partido')
              const esFaseElim = p.fase && p.fase !== 'grupo'
              return (
                <div key={p.id} style={{ padding:'10px 12px', background:esFaseElim?'#fff8f0':'#f8f9fa', borderRadius:'8px', marginBottom:'6px', border:yaGenerada?'1px solid #1e8e3e':esFaseElim?'1px solid #e8710a':'1px solid #e8eaed' }}>
                  <div style={{ marginBottom:'6px' }}>
                    <div style={{ fontSize:'.8rem', fontWeight:'600', color:'#202124' }}>{p.home?.name} vs {p.away?.name}</div>
                    <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginTop:'2px', display:'flex', gap:'6px', alignItems:'center' }}>
                      {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : 'Sin fecha'}
                      {esFaseElim && <span style={{ color:'#e8710a', fontWeight:'700' }}>{FASES_LABEL[p.fase]}</span>}
                      {yaGenerada && <span style={{ color:'#1e8e3e' }}>✓</span>}
                    </div>
                  </div>
                  <button onClick={() => { if (confirmarRegenerar(yaGenerada)) abrirChat(p, 'pre_partido') }}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:esFaseElim?'#e8710a':'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.75rem', fontWeight:'600', marginBottom:'6px' }}>
                    <MessageSquare size={13}/> {yaGenerada?'Analizar y Regenerar':'Analizar y Generar'}
                  </button>
                  <input value={indicaciones[`pre_partido_${p.id}`] || ''}
                    onChange={e => setIndicaciones(prev => ({ ...prev, [`pre_partido_${p.id}`]: e.target.value }))}
                    placeholder="¿Qué quieres que diga? (opcional)"
                    style={{ width:'100%', boxSizing:'border-box', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'8px', padding:'6px 8px', fontSize:'.72rem', color:'#202124', outline:'none', marginBottom:'6px' }}/>
                  <button onClick={() => { if (confirmarRegenerar(yaGenerada)) generarNoticiaDirecta(p, 'pre_partido') }} disabled={generandoDirecto===`pre_partido_${p.id}`}
                    title="Genera de una sola vez, sin chat previo — más barato"
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'6px', background:'#fff', border:'1px solid '+(esFaseElim?'#e8710a':'#1a73e8'), borderRadius:'8px', cursor:generandoDirecto?'not-allowed':'pointer', color:esFaseElim?'#e8710a':'#1a73e8', fontSize:'.72rem', fontWeight:'600', opacity:generandoDirecto&&generandoDirecto!==`pre_partido_${p.id}`?.5:1 }}>
                    {generandoDirecto===`pre_partido_${p.id}` ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <>⚡ Generar directo</>}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Post-partido */}
          <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:'600', color:'#202124', fontSize:'.9rem', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
              <Flag size={16} color="#1e8e3e"/> Post-partido
            </div>
            <div style={{ fontSize:'.75rem', color:'#5f6368', marginBottom:'10px' }}>Partidos ya jugados</div>
            {jugados.length===0 ? (
              <div style={{ fontSize:'.78rem', color:'#9aa0a6', textAlign:'center', padding:'12px' }}>Sin partidos jugados</div>
            ) : jugados.slice(0,5).map(p => {
              const yaGenerada = noticias.some(n => n.match_id===p.id && n.tipo==='post_partido')
              const esFaseElim = p.fase && p.fase !== 'grupo'
              return (
                <div key={p.id} style={{ padding:'10px 12px', background:esFaseElim?'#fff8f0':'#f8f9fa', borderRadius:'8px', marginBottom:'6px', border:yaGenerada?'1px solid #1e8e3e':esFaseElim?'1px solid #e8710a':'1px solid #e8eaed' }}>
                  <div style={{ marginBottom:'6px' }}>
                    <div style={{ fontSize:'.8rem', fontWeight:'600', color:'#202124' }}>
                      {p.home?.name} <span style={{ color:'#1e8e3e' }}>{p.home_score} - {p.away_score}</span> {p.away?.name}
                    </div>
                    <div style={{ fontSize:'.68rem', color:'#9aa0a6', marginTop:'2px', display:'flex', gap:'6px', alignItems:'center' }}>
                      {p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : ''}
                      {esFaseElim && <span style={{ color:'#e8710a', fontWeight:'700' }}>{FASES_LABEL[p.fase]}</span>}
                      {yaGenerada && <span style={{ color:'#1e8e3e' }}>✓</span>}
                    </div>
                  </div>
                  <button onClick={() => { if (confirmarRegenerar(yaGenerada)) abrirChat(p, 'post_partido') }}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:'#1e8e3e', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.75rem', fontWeight:'600', marginBottom:'6px' }}>
                    <MessageSquare size={13}/> {yaGenerada?'Analizar y Regenerar':'Analizar y Generar'}
                  </button>
                  <input value={indicaciones[`post_partido_${p.id}`] || ''}
                    onChange={e => setIndicaciones(prev => ({ ...prev, [`post_partido_${p.id}`]: e.target.value }))}
                    placeholder="¿Qué quieres que diga? (opcional)"
                    style={{ width:'100%', boxSizing:'border-box', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'8px', padding:'6px 8px', fontSize:'.72rem', color:'#202124', outline:'none', marginBottom:'6px' }}/>
                  <button onClick={() => { if (confirmarRegenerar(yaGenerada)) generarNoticiaDirecta(p, 'post_partido') }} disabled={generandoDirecto===`post_partido_${p.id}`}
                    title="Genera de una sola vez, sin chat previo — más barato"
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'6px', background:'#fff', border:'1px solid #1e8e3e', borderRadius:'8px', cursor:generandoDirecto?'not-allowed':'pointer', color:'#1e8e3e', fontSize:'.72rem', fontWeight:'600', opacity:generandoDirecto&&generandoDirecto!==`post_partido_${p.id}`?.5:1 }}>
                    {generandoDirecto===`post_partido_${p.id}` ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <>⚡ Generar directo</>}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Resumen de fecha (jornada completa) */}
          <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:'600', color:'#202124', fontSize:'.9rem', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
              <CalendarDays size={16} color="#6c35de"/> Resumen de fecha
            </div>
            <div style={{ fontSize:'.75rem', color:'#5f6368', marginBottom:'10px' }}>Recap de toda una jornada, no solo un partido</div>
            {jornadasConPartidos.length === 0 ? (
              <div style={{ fontSize:'.78rem', color:'#9aa0a6', textAlign:'center', padding:'12px' }}>Sin fechas jugadas todavía</div>
            ) : (
              <div style={{ padding:'10px 12px', background:'#f8f9fa', borderRadius:'8px', border:'1px solid #e8eaed' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <span style={{ fontSize:'.75rem', color:'#5f6368', flexShrink:0 }}>Fecha</span>
                  <select value={fechaSeleccionada} onChange={e => setFechaSeleccionada(e.target.value)}
                    style={{ flex:1, background:'#fff', border:'1px solid #dadce0', borderRadius:'6px', padding:'6px 8px', fontSize:'.8rem', color:'#202124', outline:'none' }}>
                    {jornadasConPartidos.map(j => (
                      <option key={j} value={j}>Fecha {j} ({jugados.filter(p=>String(p.matchday)===String(j)).length} partidos)</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => abrirChatFecha(fechaSeleccionada)} disabled={!fechaSeleccionada}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:'#6c35de', border:'none', borderRadius:'8px', cursor:fechaSeleccionada?'pointer':'not-allowed', color:'#fff', fontSize:'.75rem', fontWeight:'600', marginBottom:'6px', opacity:fechaSeleccionada?1:.6 }}>
                  <MessageSquare size={13}/> Analizar y Generar
                </button>
                <input value={indicaciones[`fecha_${fechaSeleccionada}`] || ''}
                  onChange={e => setIndicaciones(prev => ({ ...prev, [`fecha_${fechaSeleccionada}`]: e.target.value }))}
                  placeholder="¿Qué quieres que diga? (opcional)"
                  style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:'1px solid #dadce0', borderRadius:'8px', padding:'6px 8px', fontSize:'.72rem', color:'#202124', outline:'none', marginBottom:'6px' }}/>
                <button onClick={() => generarNoticiaFechaDirecta(fechaSeleccionada)} disabled={!fechaSeleccionada || generandoDirecto===`fecha_${fechaSeleccionada}`}
                  title="Genera de una sola vez, sin chat previo — más barato"
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'6px', background:'#fff', border:'1px solid #6c35de', borderRadius:'8px', cursor:fechaSeleccionada&&!generandoDirecto?'pointer':'not-allowed', color:'#6c35de', fontSize:'.72rem', fontWeight:'600', opacity:!fechaSeleccionada||(generandoDirecto&&generandoDirecto!==`fecha_${fechaSeleccionada}`)?.5:1 }}>
                  {generandoDirecto===`fecha_${fechaSeleccionada}` ? <><RefreshCw size={12} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <>⚡ Generar directo</>}
                </button>
              </div>
            )}
          </div>

          {/* Ranking del torneo — goleador, valla menos vencida, tabla */}
          <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:'600', color:'#202124', fontSize:'.9rem', marginBottom:'4px', display:'flex', alignItems:'center', gap:'6px' }}>
              🏆 Ranking del torneo
            </div>
            <div style={{ fontSize:'.75rem', color:'#5f6368', marginBottom:'10px' }}>Goleador, valla menos vencida y tabla — sin partido puntual</div>
            <input value={indicaciones['ranking'] || ''}
              onChange={e => setIndicaciones(prev => ({ ...prev, ranking: e.target.value }))}
              placeholder="¿Qué quieres que diga? (opcional)"
              style={{ width:'100%', boxSizing:'border-box', background:'#f8f9fa', border:'1px solid #e8eaed', borderRadius:'8px', padding:'6px 8px', fontSize:'.72rem', color:'#202124', outline:'none', marginBottom:'6px' }}/>
            <button onClick={generarNoticiaRankingDirecta} disabled={generandoDirecto==='ranking'}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:'#e8710a', border:'none', borderRadius:'8px', cursor:generandoDirecto?'not-allowed':'pointer', color:'#fff', fontSize:'.75rem', fontWeight:'600', opacity:generandoDirecto&&generandoDirecto!=='ranking'?.5:1 }}>
              {generandoDirecto==='ranking' ? <><RefreshCw size={13} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <>⚡ Generar ranking</>}
            </button>
          </div>

          <div style={{ background:'#e8f0fe', borderRadius:'10px', padding:'12px 14px' }}>
            <div style={{ fontSize:'.78rem', fontWeight:'600', color:'#1a73e8', marginBottom:'6px' }}>🧠 La IA usa datos reales</div>
            <div style={{ fontSize:'.72rem', color:'#5f6368', lineHeight:1.6 }}>
              · Cambio en tabla antes/después<br/>
              · Racha de resultados (últimos 5)<br/>
              · Hat-tricks en el partido<br/>
              · Récords históricos y hitos<br/>
              · Historial directo con fechas<br/>
              · Historial en semifinales/finales
            </div>
          </div>
        </div>

        {/* Panel derecho — noticias */}
        <div>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9aa0a6' }}>Cargando noticias...</div>
          ) : noticias.length===0 ? (
            <div style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', padding:'60px', textAlign:'center', color:'#9aa0a6' }}>
              <Newspaper size={40} style={{ opacity:.2, marginBottom:'12px', display:'block', margin:'0 auto 12px' }}/>
              <div style={{ fontWeight:'500', marginBottom:'4px' }}>Sin noticias generadas aún</div>
              <div style={{ fontSize:'.78rem' }}>Haz click en "Analizar y Generar" para comenzar</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {noticias.map(n => {
                const partido  = partidos.find(p => p.id===n.match_id)
                const isExpand = expanded===n.id
                return (
                  <div key={n.id} style={{ background:'#fff', border:'1px solid #e8eaed', borderRadius:'12px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ padding:'14px 16px', borderBottom:isExpand?'1px solid #f1f3f4':'none' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'5px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'.68rem', fontWeight:'700', color:tipoColor[n.tipo], background:tipoBg[n.tipo], borderRadius:'20px', padding:'2px 8px' }}>{tipoLabel[n.tipo]}</span>
                            {partido?.fase&&partido.fase!=='grupo' && <span style={{ fontSize:'.68rem', fontWeight:'700', color:'#e8710a', background:'#fce8d9', borderRadius:'20px', padding:'2px 8px' }}>{FASES_LABEL[partido.fase]}</span>}
                            {partido && <span style={{ fontSize:'.68rem', color:'#9aa0a6' }}>
                              {partido.home?.name}{n.tipo==='post_partido'?` ${partido.home_score}-${partido.away_score}`:' vs'} {partido.away?.name}
                            </span>}
                            <span style={{ fontSize:'.65rem', color:'#9aa0a6' }}>{new Date(n.creada_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                          </div>
                          <div style={{ fontWeight:'700', color:'#202124', fontSize:'.9rem', lineHeight:1.3 }}>{n.titulo}</div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                          <button onClick={() => copiarNoticia(n)}
                            style={{ display:'flex', alignItems:'center', gap:'4px', padding:'6px 10px', background:copiado===n.id?'#e6f4ea':'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:copiado===n.id?'#1e8e3e':'#5f6368', fontSize:'.72rem', fontWeight:'600' }}>
                            {copiado===n.id?<><Check size={12}/> Copiado</>:<><Copy size={12}/> Copiar</>}
                          </button>
                          <button onClick={() => setExpanded(isExpand?null:n.id)}
                            style={{ padding:'6px 10px', background:'#f1f3f4', border:'none', borderRadius:'8px', cursor:'pointer', color:'#5f6368', fontSize:'.72rem' }}>
                            {isExpand?'Ocultar':'Ver'}
                          </button>
                          <button onClick={() => handleEliminar(n.id)}
                            style={{ padding:'6px 8px', background:'none', border:'1px solid #fad2cf', borderRadius:'8px', cursor:'pointer', color:'#d93025', fontSize:'.72rem' }}>✕</button>
                        </div>
                      </div>
                    </div>
                    {isExpand && (
                      <div style={{ padding:'16px', background:'#fafafa' }}>
                        <div style={{ fontSize:'.85rem', color:'#202124', lineHeight:1.7, whiteSpace:'pre-wrap', marginBottom:'12px' }}>{n.cuerpo}</div>
                        {n.hashtags && <div style={{ fontSize:'.8rem', color:'#1a73e8', fontWeight:'500', marginBottom:'10px' }}>{n.hashtags}</div>}
                        <div style={{ padding:'10px', background:'#e8f0fe', borderRadius:'8px', fontSize:'.72rem', color:'#1a73e8' }}>
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
