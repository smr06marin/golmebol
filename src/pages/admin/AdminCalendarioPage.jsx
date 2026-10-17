import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Calendar, Check, Image, Shield, ChevronDown, ChevronUp, Link2 } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'
import FlyerProgramacion from '../../components/FlyerProgramacion'
import PlanillaSegunPartido from '../../components/PlanillaSegunPartido'
import { recuperarPlanillaAbierta } from '../../lib/planillaRecovery'
import { fmtHoraDate } from '../../lib/horaHelpers'
import { notify } from '../../lib/notify'
import { useEstadoUI, useRestaurarScroll } from '../../hooks/useEstadoUI'

function TeamLogo({ logo_url, name, size = 32 }) {
  if (logo_url) return <img src={logo_url} style={{ width: size, height: size, objectFit: 'contain' }}/>
  return <div style={{ width: size, height: size, background: '#e8f0fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={size * 0.5} color="#1a73e8"/></div>
}

const FASE_LABEL = {
  grupo: 'Fase de Grupos', octavos: 'Octavos de Final', cuartos: 'Cuartos de Final',
  semifinal: 'Semifinales', tercero: 'Tercer Puesto', final: 'Final',
}

function agruparPorJornada(partidos) {
  const FASE_ORDEN = { octavos: 1, cuartos: 2, semifinal: 3, tercero: 4, final: 5 }
  const grupos = {}
  partidos.forEach(p => {
    // Clave de agrupación: fase especial primero, luego por jornada, luego por fecha
    let key, label, esFase = false, faseOrden = 0
    if (p.fase && p.fase !== 'grupo') {
      key = `fase_${p.fase}`
      label = FASE_LABEL[p.fase] || p.fase
      esFase = true
      faseOrden = FASE_ORDEN[p.fase] || 0
    } else if (p.matchday) {
      key = `jornada_${p.matchday}`
      label = `Jornada ${p.matchday}`
    } else {
      const fecha = p.played_at ? new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sin fecha'
      key = `fecha_${fecha}`
      label = fecha
    }
    if (!grupos[key]) {
      const fechas = []
      grupos[key] = { key, label, esFase, faseOrden, partidos: [], fechas, minTime: Infinity }
    }
    grupos[key].partidos.push(p)
    if (p.played_at) {
      const t = new Date(p.played_at).getTime()
      if (t < grupos[key].minTime) grupos[key].minTime = t
      const f = new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
      if (!grupos[key].fechas.includes(f)) grupos[key].fechas.push(f)
    }
  })
  // Se ordena por la fecha/hora real del partido más temprano de cada
  // jornada (no por el número de jornada), así una reprogramación se
  // refleja correctamente en el orden. Las eliminatorias van al final.
  return Object.values(grupos).sort((a, b) => {
    if (a.esFase !== b.esFase) return a.esFase ? 1 : -1
    if (a.esFase && b.esFase) return a.faseOrden - b.faseOrden
    return a.minTime - b.minTime
  })
}

// Ventana del botón "Link árbitro": pregunta si se quieren agregar más
// partidos al link y lista SOLO los pendientes del mismo torneo, por día.
function ModalLinkArbitro({ modal, etiquetaDia, linkGrupoVigente, generando, onToggle, onToggleDia, onConfirmar, onClose }) {
  const { partido, sel, candidatos } = modal
  const grupoDeP = linkGrupoVigente(partido)
  const total = sel.length
  const dias = []
  candidatos.forEach(m => {
    const dia = etiquetaDia(m.played_at)
    let g = dias.find(x => x.dia === dia)
    if (!g) { g = { dia, items: [] }; dias.push(g) }
    g.items.push(m)
  })
  const nombre = m => `${m.home?.name || 'Por definir'} vs ${m.away?.name || 'Por definir'}`

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(32,33,36,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e8eaed' }}>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#202124' }}>¿Quieres agregar más partidos a este link?</div>
          <div style={{ fontSize: '.78rem', color: '#5f6368', marginTop: '4px', lineHeight: 1.4 }}>
            Aquí salen solo los partidos pendientes de <b>{partido.tournaments?.name}</b>. El árbitro recibirá un único link con todos los que marques.
          </div>
          <div style={{ marginTop: '10px', background: '#e6f7f6', border: '1px solid #b6e6e2', borderRadius: '8px', padding: '8px 10px', fontSize: '.8rem', color: '#00695f', fontWeight: '600' }}>
            ✓ {nombre(partido)}
            <span style={{ fontWeight: '500', color: '#4a8a84' }}> · {partido.played_at ? `${etiquetaDia(partido.played_at)} ${fmtHoraDate(partido.played_at)}` : 'Por confirmar'}</span>
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 8px', flex: 1 }}>
          {dias.map(g => {
            const ids = g.items.map(m => m.id)
            const todos = ids.every(id => sel.includes(id))
            return (
              <div key={g.dia} style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: '700', color: '#5f6368', textTransform: 'capitalize' }}>{g.dia}</span>
                  <button type="button" onClick={() => onToggleDia(ids, !todos)}
                    style={{ border: 'none', background: 'none', color: '#1a73e8', fontSize: '.72rem', fontWeight: '600', cursor: 'pointer', padding: '2px 0' }}>
                    {todos ? 'Quitar el día' : 'Marcar el día'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {g.items.map(m => {
                    const marcado = sel.includes(m.id)
                    const otroGrupo = linkGrupoVigente(m) && linkGrupoVigente(m) !== grupoDeP
                    return (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: `1.5px solid ${marcado ? '#1a73e8' : '#e8eaed'}`, background: marcado ? '#f3f8ff' : '#fff', borderRadius: '10px', padding: '9px 10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={marcado} onChange={() => onToggle(m.id)} style={{ width: '18px', height: '18px', accentColor: '#1a73e8', flexShrink: 0 }}/>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '.82rem', fontWeight: '600', color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(m)}</div>
                          <div style={{ fontSize: '.7rem', color: '#80868b', marginTop: '1px' }}>
                            {m.played_at ? fmtHoraDate(m.played_at) : 'Por confirmar'}{m.location ? ` · ${m.location}` : ''}{m.matchday ? ` · Jornada ${m.matchday}` : ''}
                          </div>
                          {otroGrupo && marcado && <div style={{ fontSize: '.66rem', color: '#e8710a', marginTop: '2px' }}>Ya está en otro link — pasará a este</div>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8eaed', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button type="button" onClick={() => onConfirmar(false)} disabled={generando}
            style={{ border: 'none', borderRadius: '10px', padding: '12px', fontSize: '.9rem', fontWeight: '700', cursor: generando ? 'default' : 'pointer', background: '#1a73e8', color: '#fff', opacity: generando ? 0.7 : 1 }}>
            {generando ? 'Generando…' : total > 1 ? `Copiar link con ${total} partidos` : 'Copiar link de este partido'}
          </button>
          <button type="button" onClick={() => onConfirmar(true)} disabled={generando}
            style={{ border: '1px solid #dadce0', borderRadius: '10px', padding: '10px', fontSize: '.82rem', fontWeight: '600', cursor: 'pointer', background: '#fff', color: '#5f6368' }}>
            No, solo este partido
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCalendarioPage() {
  const navigate = useNavigate()
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const [searchParams, setSearchParams] = useSearchParams()
  const [partidos,        setPartidos]        = useState([])
  const [loading,         setLoading]         = useState(true)
  // Lo que la persona dejó puesto (Pendientes/Jugados, torneo, jornadas
  // abiertas y hasta dónde bajó) se recuerda: si el celular recarga la página
  // al volver de WhatsApp (o de copiar un link), todo queda donde estaba en
  // vez de tener que escoger el torneo y buscar el partido otra vez.
  const [filtro,          setFiltro]          = useEstadoUI('gm_ui_calendario_filtro', 'todos')
  const [torneoFiltro,    setTorneoFiltro]    = useEstadoUI('gm_ui_calendario_torneo', '')
  const [torneos,         setTorneos]         = useState([])
  const [flyerPartido,    setFlyerPartido]    = useState(null)
  const [flyerGrupo,      setFlyerGrupo]      = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  // Ventana "¿Quieres agregar más partidos a este link?" del botón Link árbitro:
  // { partido, sel: [ids marcados], candidatos: [partidos del mismo torneo] }
  const [linkModal,       setLinkModal]       = useState(null)
  const [generandoLink,   setGenerandoLink]   = useState(false)
  const [abiertos,        setAbiertos]        = useEstadoUI('gm_ui_calendario_abiertos', {})

  // Arma el "torneo" que se le pasa al flyer de programación: si todos los
  // partidos del grupo son del mismo torneo, usa su nombre/escudo/etc (así
  // el flyer sale con la identidad del torneo, que es de quien organiza).
  // Golmebol solo presta la app — nunca debe aparecer como encabezado
  // principal del flyer, así que si el grupo mezcla varios torneos (sin un
  // nombre propio claro) se deja sin torneo (el flyer cae a un título
  // neutro genérico, no a "Golmebol").
  function construirTorneoFlyer(subset) {
    const ids = [...new Set(subset.map(p => p.tournament_id))]
    return ids.length === 1 ? (subset[0]?.tournaments || null) : null
  }

  useEffect(() => { fetchTodo() }, [rol])
  // La planilla abierta queda marcada en la URL (?planilla=<id>): así, sin
  // importar qué haga el navegador al volver (recargar, matar la pestaña,
  // etc.), se reabre exactamente la misma planilla. Solo el botón "Salir"
  // (cerrarPlanilla) puede sacar de la planilla.
  useEffect(() => {
    const matchId = searchParams.get('planilla')
    if (matchId) {
      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad,logo_url,season,categoria), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .eq('id', matchId).single()
        .then(({ data }) => { if (data) setPlanillaPartido(data) })
    } else {
      recuperarPlanillaAbierta().then(p => { if (p) abrirPlanilla(p) })
    }
  }, [])

  function abrirPlanilla(p) {
    setPlanillaPartido(p)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); return n }, { replace: true })
  }
  function cerrarPlanilla() {
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace: true })
    fetchTodo(true)
  }

  // silencioso = true: refresca la lista SIN la pantalla de "Cargando..." (que
  // encoge la página y te manda arriba del todo).
  async function fetchTodo(silencioso = false) {
    if (!silencioso) setLoading(true)

    // El organizador solo ve el calendario de sus propios torneos
    if (esOrganizador) {
      const { data: misTorneos } = await supabase.from('tournaments').select('id,name').eq('organizador_id', user?.id)
      const torneoIds = (misTorneos || []).map(t => t.id)
      if (torneoIds.length === 0) {
        setPartidos([]); setTorneos([]); setTorneoFiltro(''); setLoading(false); return
      }
      const { data: pts } = await supabase.from('matches')
        .select('*, tournaments(id,name,modalidad,logo_url,season,categoria), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .in('tournament_id', torneoIds)
        .order('played_at', { ascending: true })
      setPartidos(pts || [])
      setTorneos(misTorneos || [])
      setTorneoFiltro(f => (f && !(misTorneos || []).some(t => t.id === f)) ? '' : f) // el torneo recordado ya no existe/no es mío
      setLoading(false)
      return
    }

    const [{ data: pts }, { data: trs }] = await Promise.all([
      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad,logo_url,season,categoria), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)')
        .order('played_at', { ascending: true }),
      supabase.from('tournaments').select('id,name').eq('status', 'active'),
    ])
    setPartidos(pts || [])
    setTorneos(trs || [])
    setTorneoFiltro(f => (f && !(trs || []).some(t => t.id === f)) ? '' : f) // el torneo recordado ya no está activo
    setLoading(false)
  }

  function toggleAbierto(key) {
    setAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Link de 24h para que un árbitro sin cuenta entre directo a planillar
  // (ver PlanillarLinkPage.jsx). Al tocar "Link árbitro", si el torneo tiene
  // más partidos pendientes, se pregunta "¿Quieres agregar más partidos a este
  // link?" y se muestran SOLO los del mismo torneo: así el árbitro recibe un
  // único link con todos los partidos que va a dirigir, en vez de uno por uno.
  // Si no hay otros partidos, se copia directo el link de ese partido.
  function etiquetaDia(iso) {
    return iso
      ? new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })
      : 'Sin fecha'
  }

  function linkGrupoVigente(m) {
    return m.link_planilla_grupo && m.link_planilla_expira && new Date(m.link_planilla_expira) > new Date()
      ? m.link_planilla_grupo : null
  }

  function handleLinkArbitro(p) {
    const grupoDeP = linkGrupoVigente(p)
    const candidatos = partidos
      .filter(m => m.tournament_id === p.tournament_id && m.id !== p.id && m.status !== 'finished')
      .sort((a, b) => (a.played_at ? new Date(a.played_at).getTime() : Infinity) - (b.played_at ? new Date(b.played_at).getTime() : Infinity))
    if (candidatos.length === 0) { copiarLinkUnico(p); return }
    // Si este partido ya tenía un link de grupo vigente, sus partidos van marcados
    const marcados = grupoDeP ? candidatos.filter(m => linkGrupoVigente(m) === grupoDeP).map(m => m.id) : []
    setLinkModal({ partido: p, sel: [p.id, ...marcados], candidatos })
  }

  function mensajeUnico(p, link) {
    const cuando = p.played_at
      ? `${etiquetaDia(p.played_at)} · ${fmtHoraDate(p.played_at)}`
      : 'Por confirmar'
    return `🟡 Planilla del partido — ${p.home?.name || 'Por definir'} vs ${p.away?.name || 'Por definir'}\n\n📅 ${cuando}${p.location ? `\n📍 ${p.location}` : ''}\n\n⏰ Este link dura 24 horas.\n\n👉 ${link}`
  }

  function mensajeGrupo(lista, link) {
    const porDia = []
    lista.forEach(m => {
      const dia = etiquetaDia(m.played_at)
      let g = porDia.find(x => x.dia === dia)
      if (!g) { g = { dia, items: [] }; porDia.push(g) }
      g.items.push(m)
    })
    const torneo = lista[0]?.tournaments?.name || 'Torneo'
    const bloques = porDia.map(g =>
      `📅 ${g.dia}\n` + g.items.map(m =>
        `• ${m.played_at ? fmtHoraDate(m.played_at) : 'Por confirmar'} — ${m.home?.name || 'Por definir'} vs ${m.away?.name || 'Por definir'}${m.location ? ` (📍 ${m.location})` : ''}`
      ).join('\n')
    ).join('\n\n')
    return `🟡 Planilla de tus partidos — ${torneo}\n\n${bloques}\n\n⏰ Este link dura 24 horas y sirve para todos estos partidos.\n\n👉 ${link}`
  }

  async function copiarLinkUnico(p) {
    const { data, error } = await supabase.rpc('generar_link_planilla', { p_match_id: p.id })
    if (error) { notify('Error al generar el link: ' + error.message, 'error'); return false }
    navigator.clipboard.writeText(mensajeUnico(p, `${window.location.origin}/planillar/${data.token}`))
    notify('Link copiado con la descripción ✓')
    return true
  }

  async function confirmarLinkModal(soloEste) {
    if (!linkModal || generandoLink) return
    const { partido, sel, candidatos } = linkModal
    setGenerandoLink(true)
    try {
      if (soloEste || sel.length <= 1) {
        if (await copiarLinkUnico(partido)) setLinkModal(null)
        return
      }
      const orden = [partido, ...candidatos.filter(m => sel.includes(m.id))]
      const { data, error } = await supabase.rpc('generar_link_planilla_grupo', { p_match_ids: orden.map(m => m.id) })
      if (error) {
        const faltaMigracion = error.code === 'PGRST202' || /generar_link_planilla_grupo/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || '')
        notify(faltaMigracion
          ? 'Falta correr migracion_link_arbitro_grupo.sql en Supabase'
          : 'Error al generar el link: ' + error.message, 'error')
        return
      }
      const ordenados = [...orden].sort((a, b) => (a.played_at ? new Date(a.played_at).getTime() : Infinity) - (b.played_at ? new Date(b.played_at).getTime() : Infinity))
      navigator.clipboard.writeText(mensajeGrupo(ordenados, `${window.location.origin}/planillar/${data.token}`))
      notify(`Link con ${data.total || ordenados.length} partidos copiado ✓`)
      setLinkModal(null)
      fetchTodo(true)
    } finally {
      setGenerandoLink(false)
    }
  }

  function toggleSel(id) {
    setLinkModal(m => m && ({ ...m, sel: m.sel.includes(id) ? m.sel.filter(x => x !== id) : [...m.sel, id] }))
  }
  function toggleDia(ids, marcar) {
    setLinkModal(m => m && ({ ...m, sel: marcar ? [...new Set([...m.sel, ...ids])] : m.sel.filter(x => !ids.includes(x)) }))
  }

  const filtrados = partidos
    .filter(p => filtro === 'todos' ? true : filtro === 'pendientes' ? p.status !== 'finished' : p.status === 'finished')
    .filter(p => torneoFiltro ? p.tournament_id === torneoFiltro : true)

  const jornadas = agruparPorJornada(filtrados)
  // Vuelve a la misma altura donde estaba cuando la lista ya cargó
  useRestaurarScroll('gm_ui_calendario_scroll', !loading && jornadas.length > 0)

  return (
    <div>
      {flyerPartido    && <FlyerPartido    partido={flyerPartido}    onClose={() => setFlyerPartido(null)}/>}
      {flyerGrupo      && <FlyerProgramacion torneo={flyerGrupo.torneo} partidos={flyerGrupo.partidos} onClose={() => setFlyerGrupo(null)}/>}
      {planillaPartido && <PlanillaSegunPartido partido={planillaPartido} onClose={cerrarPlanilla}/>}
      {linkModal && <ModalLinkArbitro modal={linkModal} etiquetaDia={etiquetaDia} linkGrupoVigente={linkGrupoVigente}
        generando={generandoLink} onToggle={toggleSel} onToggleDia={toggleDia}
        onConfirmar={confirmarLinkModal} onClose={() => !generandoLink && setLinkModal(null)}/>}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>{esOrganizador ? 'Mi calendario' : 'Calendario Global'}</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{esOrganizador ? 'Partidos de mis torneos' : 'Todos los partidos de todos los torneos'}</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '8px', padding: '3px' }}>
          {[{ id:'todos', label:'Todos' }, { id:'pendientes', label:'Pendientes' }, { id:'jugados', label:'Jugados' }].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', background: filtro===f.id?'#1a73e8':'transparent', color: filtro===f.id?'#fff':'#5f6368' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff' }}>
          <option value="">Todos los torneos</option>
          {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {filtrados.length > 0 && (
          <button onClick={() => setFlyerGrupo({ torneo: construirTorneoFlyer(filtrados), partidos: filtrados })}
            style={{ background: '#6c35de', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Image size={13}/> Crear flyer (todos)
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: '.8rem', color: '#9aa0a6' }}>{filtrados.length} partido{filtrados.length!==1?'s':''}</div>
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>
      ) : jornadas.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Calendar size={36} style={{ opacity:.3, marginBottom:'8px' }}/>
          <div style={{ fontSize: '.875rem' }}>No hay partidos</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {jornadas.map(jornada => {
            const isOpen    = !!abiertos[jornada.key]
            const jugados   = jornada.partidos.filter(p => p.status === 'finished').length
            const pendientes= jornada.partidos.length - jugados
            const esFase    = jornada.key.startsWith('fase_')
            const headerBg  = esFase ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#fff'
            const headerColor = esFase ? '#fff' : '#202124'
            return (
              <div key={jornada.key} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                {/* Header acordeón */}
                <div onClick={() => toggleAbierto(jornada.key)}
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: headerBg, transition: 'background .15s' }}
                  onMouseEnter={e => !esFase && (e.currentTarget.style.background = '#f8f9fa')}
                  onMouseLeave={e => !esFase && (e.currentTarget.style.background = '#fff')}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '.95rem', color: headerColor }}>{jornada.label}</div>
                    <div style={{ fontSize: '.72rem', color: esFase ? 'rgba(255,255,255,.75)' : '#9aa0a6', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {jornada.fechas.length > 0 && <span>📅 {jornada.fechas.join(' · ')}</span>}
                      <span>{jornada.partidos.length} partido{jornada.partidos.length!==1?'s':''}</span>
                      {jugados > 0    && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#1e8e3e' }}>✓ {jugados} jugado{jugados!==1?'s':''}</span>}
                      {pendientes > 0 && <span style={{ color: esFase?'rgba(255,255,255,.85)':'#e8710a' }}>⏳ {pendientes} pendiente{pendientes!==1?'s':''}</span>}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFlyerGrupo({ torneo: construirTorneoFlyer(jornada.partidos), partidos: jornada.partidos }) }}
                    style={{ background: esFase ? 'rgba(255,255,255,.18)' : '#f3ecfd', border: 'none', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', color: esFase ? '#fff' : '#6c35de', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <Image size={12}/> Flyer
                  </button>
                  {isOpen
                    ? <ChevronUp  size={18} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/>
                    : <ChevronDown size={18} color={esFase?'rgba(255,255,255,.8)':'#9aa0a6'}/>}
                </div>

                {/* Partidos desplegados */}
                {isOpen && (
                  <div>
                    {jornada.partidos.map((p, i) => {
                      const esJugado = p.status === 'finished'
                      return (
                        <div key={p.id} style={{ padding: '12px 18px', borderTop: '1px solid #f1f3f4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Fecha y hora */}
                            <div style={{ minWidth: '64px', flexShrink: 0 }}>
                              {p.played_at && (
                                <>
                                  <div style={{ fontSize: '.68rem', color: '#5f6368', fontWeight: '600' }}>
                                    {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                                  </div>
                                  <div style={{ fontSize: '.68rem', color: '#9aa0a6' }}>
                                    {fmtHoraDate(p.played_at)}
                                  </div>
                                </>
                              )}
                              {p.location && <div style={{ fontSize: '.62rem', color: '#1a73e8', marginTop: '2px' }}>📍 {p.location}</div>}
                            </div>

                            {/* Partido */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.home?.name}</span>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                                  <TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={26}/>
                                </div>
                              </div>
                              {esJugado ? (
                                <div style={{ fontWeight: '800', fontSize: '.92rem', color: '#202124', background: '#f1f3f4', padding: '3px 10px', borderRadius: '8px', flexShrink: 0, minWidth: '50px', textAlign: 'center' }}>
                                  {p.home_score} - {p.away_score}
                                </div>
                              ) : (
                                <div style={{ fontWeight: '700', fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', padding: '3px 9px', borderRadius: '8px', flexShrink: 0 }}>VS</div>
                              )}
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
                                  <TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={26}/>
                                </div>
                                <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.away?.name}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Torneo + estado */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ fontSize: '.65rem', color: '#9aa0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tournaments?.name}</span>
                              <span style={{ fontSize: '.65rem', fontWeight: '600', color: esJugado?'#1e8e3e':'#e8710a', background: esJugado?'#e6f4ea':'#fce8d9', borderRadius: '6px', padding: '1px 6px', flexShrink: 0 }}>
                                {esJugado ? '✓ Jugado' : '⏳ Pendiente'}
                              </span>
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexWrap: 'wrap' }}>
                              <button onClick={() => setFlyerPartido(p)}
                                style={{ background: '#6c35de', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Image size={11}/> Flyer
                              </button>
                              {!esJugado && (
                                <button onClick={() => handleLinkArbitro(p)} title="Copia un link de 24h para que un árbitro sin cuenta planille este partido (puedes agregarle más partidos del mismo torneo)"
                                  style={{ background: '#fff', border: '1px solid #00b8ad', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#00958c', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Link2 size={11}/> Link árbitro
                                </button>
                              )}
                              <button onClick={() => abrirPlanilla(p)}
                                style={{ background: esJugado?'none':'#1a73e8', border: esJugado?'1px solid #dadce0':'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: esJugado?'#5f6368':'#fff', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {esJugado ? '✏️ Editar' : <><Check size={11}/> Resultado</>}
                              </button>
                              <button onClick={() => navigate(`/admin/torneos/${p.tournament_id}`)}
                                style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.7rem' }}>Ver torneo →</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
