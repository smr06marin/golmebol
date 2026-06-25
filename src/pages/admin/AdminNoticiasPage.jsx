import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Newspaper, Zap, RefreshCw, Copy, Check, Send, X, MessageSquare, Flag } from 'lucide-react'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function llamarIA(messages, maxTokens = 600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages }),
  })
  const data = await res.json()
  return data.content?.[0]?.text || ''
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

function buildContextoPre(partido, datos) {
  const esFaseElim = partido.fase && partido.fase !== 'grupo'
  const tablaStr = datos.tablaOrdenada.length > 0
    ? datos.tablaOrdenada.map((t,i) => `${i+1}.${t.name} ${t.pts}pts`).join(' | ')
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
    ? datos.tablaOrdenadaAntes.map((t,i) => `${i+1}.${t.name} ${t.pts}pts`).join(' | ')
    : 'Sin datos previos'
  // Tabla DESPUÉS del partido
  const tablaDespues = datos.tablaOrdenadaDespues.length > 0
    ? datos.tablaOrdenadaDespues.map((t,i) => `${i+1}.${t.name} ${t.pts}pts`).join(' | ')
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
  const [torneos,   setTorneos]   = useState([])
  const [torneoId,  setTorneoId]  = useState('')
  const [partidos,  setPartidos]  = useState([])
  const [noticias,  setNoticias]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [copiado,   setCopiado]   = useState(null)
  const [expanded,  setExpanded]  = useState(null)

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

  function showMsg(text, type = 'ok') { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500) }

  async function fetchTorneos() {
    const { data, error } = await supabase.from('tournaments').select('id, name').order('created_at', { ascending: false })
    if (error) { showMsg('Error cargando torneos', 'error'); return }
    setTorneos(data || [])
    if (data?.length) setTorneoId(data[0].id)
  }

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
    })

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
    })

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

    const promptInicial = `Analista deportivo GOLMEBOL. Datos del ${tipoTexto}:\n${ctx}\n\nDame máx 4 puntos con los datos MÁS INTERESANTES y picantes para la noticia${tipo==='post_partido' ? ' (prioriza: cambios en tabla, rachas, récords rotos, hat-tricks, primera victoria histórica entre estos equipos)' : ' (prioriza hitos ⚠️, hat-tricks, fases eliminatorias, historial)'}. Sé muy conciso. Luego pregunta si genero ya o quiero explorar algo.`

    const respuestaIA = await llamarIA([{ role: 'user', content: promptInicial }], 400)
    setChatMessages([{ role: 'assistant', content: respuestaIA }])
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
      { role: 'user', content: `Analista GOLMEBOL. Datos:\n${chatContexto}\n\n---\n${chatMessages[0]?.content || ''}` },
      { role: 'assistant', content: chatMessages[0]?.content || '' },
      ...nuevosMensajes.slice(1),
    ]

    const respuesta = await llamarIA(mensajesParaIA, 350)
    setChatMessages(prev => [...prev, { role: 'assistant', content: respuesta }])
    setChatLoading(false)
  }

  async function generarNoticiaDesdeChaT() {
    if (!chatDatos || !chatPartido) return
    setGenerandoFinal(true)

    const partido = chatPartido
    const esFaseElim = partido.fase && partido.fase !== 'grupo'
    const faseLabel  = FASES_LABEL[partido.fase||'grupo'] || ''
    const datoClave  = chatMessages[0]?.content?.split('\n').slice(0,4).join(' ') || ''
    const esPost     = chatTipo === 'post_partido'

    const prompt = esPost
      ? `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia POST-PARTIDO explosiva para Instagram/WhatsApp.

${chatContexto}

DATO CLAVE DEL ANÁLISIS: ${datoClave}

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras) — menciona el resultado${esFaseElim?' y la '+faseLabel:''}
2. Máx 3 líneas — arranca con el resultado, usa el dato más picante (cambio en tabla, racha, récord roto, hat-trick, primera victoria histórica). Termina con qué viene ahora.
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.`
      : `Periodista deportivo GOLMEBOL, Armenia, Colombia. Noticia PRE-PARTIDO explosiva para Instagram/WhatsApp.

${chatContexto}

DATO CLAVE DEL ANÁLISIS: ${datoClave}

Escribe:
1. Título IMPACTANTE mayúsculas (máx 8 palabras)${esFaseElim?' — incluye '+faseLabel:''}
2. Máx 3 líneas — usa el dato clave como gancho, termina generando expectativa
3. 4 hashtags (#Golmebol #Armenia obligatorio)

Texto plano, sin markdown. 10 segundos de lectura.`

    try {
      const texto = await llamarIA([{ role: 'user', content: prompt }], 500)
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

  const pendientes = partidos.filter(p => p.status !== 'finished')
  const jugados    = partidos.filter(p => p.status === 'finished')
  const tipoLabel  = { pre_partido: '⚡ Pre-partido', post_partido: '🏁 Post-partido', semanal: '📋 Semanal' }
  const tipoColor  = { pre_partido: '#1a73e8', post_partido: '#1e8e3e', semanal: '#6c35de' }
  const tipoBg     = { pre_partido: '#e8f0fe', post_partido: '#e6f4ea', semanal: '#f3e8fd' }

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
                  <MessageSquare size={16} color={chatTipo==='post_partido'?'#1e8e3e':'#1a73e8'}/>
                  {chatTipo==='post_partido' ? '🏁 Análisis Post-partido' : '⚡ Análisis Pre-partido'}
                </div>
                <div style={{ fontSize:'.75rem', color:'#5f6368', marginTop:'2px' }}>
                  {chatPartido.home?.name} {chatTipo==='post_partido'?`${chatPartido.home_score} - ${chatPartido.away_score}`:''} {chatPartido.away?.name}
                  {chatPartido.fase&&chatPartido.fase!=='grupo' && <span style={{ color:'#e8710a', fontWeight:'700', marginLeft:'6px' }}>{FASES_LABEL[chatPartido.fase]}</span>}
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
                style={{ width:'100%', padding:'11px', background:generandoFinal||chatMessages.length===0?'#f1f3f4':chatTipo==='post_partido'?'#1e8e3e':'#1a73e8', border:'none', borderRadius:'10px', cursor:generandoFinal||chatMessages.length===0?'not-allowed':'pointer', color:generandoFinal||chatMessages.length===0?'#9aa0a6':'#fff', fontWeight:'700', fontSize:'.875rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                {generandoFinal ? <><RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }}/> Generando...</> : <><Zap size={14}/> Generar noticia con este análisis</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
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

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:'20px', alignItems:'start' }}>
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
                  <button onClick={() => abrirChat(p, 'pre_partido')}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:esFaseElim?'#e8710a':'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.75rem', fontWeight:'600' }}>
                    <MessageSquare size={13}/> {yaGenerada?'Analizar y Regenerar':'Analizar y Generar'}
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
                  <button onClick={() => abrirChat(p, 'post_partido')}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'7px', background:'#1e8e3e', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.75rem', fontWeight:'600' }}>
                    <MessageSquare size={13}/> {yaGenerada?'Analizar y Regenerar':'Analizar y Generar'}
                  </button>
                </div>
              )
            })}
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
