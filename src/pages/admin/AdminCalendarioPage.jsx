import { useState, useEffect, useMemo, useRef, memo, useDeferredValue } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errorAmigable, avisoMigracion } from '../../lib/mensajesError'
import { useAuthStore } from '../../store/authStore'
import { Calendar, Check, Clock, Image, MapPin, Pencil, Shield, ChevronDown, ChevronUp, Link2, Search, Trophy, Watch } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'
import FlyerResultadoPartido from '../../components/FlyerResultadoPartido'
import { hydratePlayersPublico } from '../../lib/playersPublico'
import FlyerProgramacion from '../../components/FlyerProgramacion'
import PlanillaSegunPartido from '../../components/PlanillaSegunPartido'
import { recuperarPlanillaAbierta } from '../../lib/planillaRecovery'
import { fmtHoraDate } from '../../lib/horaHelpers'
import { notify } from '../../lib/notify'
import { useEstadoUI, useRestaurarScroll } from '../../hooks/useEstadoUI'

// ─────────────────────────────────────────────────────────────────────────────
// RENDIMIENTO — por qué esta página ya no es lenta
//  1) La lista pide SOLO las columnas que pinta (antes traía matches.* con las
//     planillas guardadas completas — live_state, planilla_papel, etc. — de
//     TODOS los partidos de TODOS los torneos). La planilla completa del
//     partido se pide únicamente al abrirla.
//  2) Se pide por páginas de 1000 y la primera ya se pinta (antes el tope de
//     1000 filas cortaba la lista en silencio y todo esperaba a la descarga).
//  3) Lo último que se cargó queda en memoria: al volver a la página aparece al
//     instante y se refresca por detrás.
//  4) Está organizada por TORNEO → JORNADA → PARTIDO y solo se dibujan los
//     partidos de lo que está abierto. Las filas no se re-dibujan al abrir o
//     cerrar otra sección, y las fechas usan un formateador creado una vez.
// ─────────────────────────────────────────────────────────────────────────────

// Intl se crea UNA vez (toLocaleDateString crea uno nuevo en cada llamada y con
// miles de partidos eso era lo que más tiempo se llevaba al agrupar).
const fmtDiaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })
const fmtDiaCorto = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })
const fmtFechaLarga = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

function etiquetaDia(iso) {
  return iso ? fmtDiaLargo.format(new Date(iso)) : 'Sin fecha'
}

// Solo lo que la lista pinta y lo que usan los flyers (FlyerPartido / FlyerProgramacion).
const COLUMNAS_LISTA = 'id,tournament_id,home_team_id,away_team_id,home_score,away_score,status,played_at,location,matchday,fase,ronda,'
  + 'tournaments(id,name,modalidad,logo_url,season,categoria,status),'
  + 'home:home_team_id(id,name,logo_url),away:away_team_id(id,name,logo_url)'
// Planilla: el partido completo, igual que cuando se abre desde ?planilla=
const COLUMNAS_COMPLETO = '*, tournaments(id,name,modalidad,logo_url,season,categoria), home:home_team_id(id,name,logo_url), away:away_team_id(id,name,logo_url)'
const PAGINA = 1000

// Lo último cargado, para pintar al instante al volver a la página.
let cacheCalendario = { clave: null, partidos: [] }

async function traerPartidos(torneoIds, alPagina) {
  let desde = 0
  let todos = []
  for (;;) {
    let q = supabase.from('matches').select(COLUMNAS_LISTA)
      .order('played_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (torneoIds) q = q.in('tournament_id', torneoIds)
    const { data, error } = await q
    if (error) throw error
    const pagina = data || []
    todos = todos.concat(pagina)
    const hayMas = pagina.length === PAGINA
    alPagina(todos, hayMas)
    if (!hayMas) break
    desde += PAGINA
  }
  return todos
}

function TeamLogo({ logo_url, size = 32 }) {
  if (logo_url) return <img src={logo_url} loading="lazy" decoding="async" style={{ width: size, height: size, objectFit: 'contain' }}/>
  return <div style={{ width: size, height: size, background: '#e8f0fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={size * 0.5} color="#1a73e8"/></div>
}

const FASE_LABEL = {
  grupo: 'Fase de Grupos', octavos: 'Octavos de Final', cuartos: 'Cuartos de Final',
  semifinal: 'Semifinales', tercero: 'Tercer Puesto', final: 'Final', otra: 'Otra fase',
}

function sinTildes(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

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

function agruparPorJornada(partidos, prefijo) {
  const FASE_ORDEN = { octavos: 1, cuartos: 2, semifinal: 3, tercero: 4, final: 5 }
  const grupos = {}
  partidos.forEach(p => {
    // Clave de agrupación: fase especial primero, luego por jornada, luego por fecha
    let key, label, esFase = false, faseOrden = 0
    if (p.fase === 'otra') {
      // Fase con nombre propio (repechaje, sétette, amistoso…): un bloque por nombre
      const nombre = p.ronda || 'Otra fase'
      key = `otro_${nombre}`
      label = nombre
      esFase = true
      faseOrden = 0
    } else if (p.fase && p.fase !== 'grupo') {
      key = `fase_${p.fase}`
      label = FASE_LABEL[p.fase] || p.fase
      esFase = true
      faseOrden = FASE_ORDEN[p.fase] || 0
    } else if (p.matchday) {
      key = `jornada_${p.matchday}`
      label = `Jornada ${p.matchday}`
    } else {
      const fecha = p.played_at ? fmtFechaLarga.format(new Date(p.played_at)) : 'Sin fecha'
      key = `fecha_${fecha}`
      label = fecha
    }
    if (!grupos[key]) {
      grupos[key] = { key: `${prefijo}|${key}`, label, esFase, faseOrden, partidos: [], fechas: [], minTime: Infinity }
    }
    const g = grupos[key]
    g.partidos.push(p)
    if (p.played_at) {
      const d = new Date(p.played_at)
      const t = d.getTime()
      if (t < g.minTime) g.minTime = t
      const f = fmtDiaCorto.format(d)
      if (!g.fechas.includes(f)) g.fechas.push(f)
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

// Un bloque por torneo, con sus conteos y el próximo partido pendiente.
function agruparPorTorneo(partidos) {
  const mapa = new Map()
  partidos.forEach(p => {
    let g = mapa.get(p.tournament_id)
    if (!g) {
      g = { id: p.tournament_id, torneo: p.tournaments || { id: p.tournament_id, name: 'Torneo' }, partidos: [], jugados: 0, proximo: null }
      mapa.set(p.tournament_id, g)
    }
    g.partidos.push(p)
    if (p.status === 'finished') g.jugados++
    else if (p.played_at && (!g.proximo || new Date(p.played_at) < new Date(g.proximo))) g.proximo = p.played_at
  })
  const lista = [...mapa.values()]
  const activo = g => g.torneo?.status === 'active'
  // Activos primero (el de partido pendiente más cercano arriba), luego el resto
  return lista.sort((a, b) => {
    if (activo(a) !== activo(b)) return activo(a) ? -1 : 1
    const ta = a.proximo ? new Date(a.proximo).getTime() : Infinity
    const tb = b.proximo ? new Date(b.proximo).getTime() : Infinity
    if (ta !== tb) return ta - tb
    return String(a.torneo?.name || '').localeCompare(String(b.torneo?.name || ''), 'es')
  })
}

// Estilos del calendario (clases para poder adaptar el diseño a celular).
const ESTILOS_CAL = `
.gcal-row{border-top:1px solid #eef0f2;background:#fff}
.gcal-head{display:grid;grid-template-columns:50px minmax(0,1fr) 18px;align-items:center;gap:10px;padding:10px 14px;min-height:60px;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none}
.gcal-head:hover,.gcal-head:focus-visible{background:#f8f9fa}
.gcal-when{display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums}
.gcal-when b{font-size:.74rem;color:#3c4043;font-weight:700;white-space:nowrap}
.gcal-when span{font-size:.7rem;color:#80868b;white-space:nowrap}
.gcal-match{display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:8px;row-gap:6px;align-items:center;min-width:0}
.gcal-lg{width:22px;height:22px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px}
.gcal-tn{font-size:.86rem;font-weight:700;color:#202124;line-height:1.15;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-width:0}
.gcal-tn.lost{font-weight:500;color:#5f6368}
.gcal-n{font-size:.95rem;font-weight:800;color:#202124;min-width:24px;text-align:right;font-variant-numeric:tabular-nums}
.gcal-n.lost{color:#80868b;font-weight:600}
.gcal-pend{grid-row:1/3;grid-column:3;font-size:.68rem;font-weight:700;color:#b45309;background:#fef3e6;border-radius:999px;padding:3px 9px;white-space:nowrap}
.gcal-chev{color:#9aa0a6;transition:transform .15s}
.gcal-chev.on{transform:rotate(180deg)}
.gcal-more{padding:4px 14px 14px;display:flex;flex-direction:column;gap:12px;background:#f8f9fa;border-top:1px dashed #e3e6ea}
.gcal-info{display:flex;flex-direction:column;gap:6px;padding-top:10px;font-size:.78rem;color:#3c4043}
.gcal-info .l{display:flex;align-items:center;gap:7px}
.gcal-info .loc{color:#1a73e8;font-weight:600}
.gcal-pill{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;font-weight:700;border-radius:999px;padding:3px 10px 3px 8px;white-space:nowrap}
.gcal-pill i{width:7px;height:7px;border-radius:50%;display:block}
.gcal-pill.ok{background:#e6f4ea;color:#137333}.gcal-pill.ok i{background:#1e8e3e}
.gcal-pill.pend{background:#fef3e6;color:#b45309}.gcal-pill.pend i{background:#e8710a}
.gcal-actions{display:flex;flex-wrap:wrap;gap:8px}
.gcal-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:9px;border:1px solid #dadce0;background:#fff;color:#3c4043;font-size:.78rem;font-weight:600;font-family:inherit;cursor:pointer;white-space:nowrap}
.gcal-btn:disabled{opacity:.6;cursor:default}
.gcal-btn.primary{background:#1a73e8;border-color:#1a73e8;color:#fff}
.gcal-btn.dark{background:#fff;border-color:#202124;color:#202124}
.gcal-btn.danger{border-color:#fad2cf;color:#d93025}
.gcal-btn svg{flex-shrink:0}
.gcal-chip{display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:600;border-radius:999px;padding:2px 9px;background:#f1f3f4;color:#5f6368;white-space:nowrap}
.gcal-chip.ok{background:#e6f4ea;color:#137333}.gcal-chip.pend{background:#fef3e6;color:#b45309}
.gcal-chip.fase{background:rgba(255,255,255,.2);color:#fff}
.gcal-seg{display:flex;gap:4px;background:#fff;border:1px solid #e8eaed;border-radius:10px;padding:3px}
.gcal-seg button{padding:0 16px;min-height:36px;border-radius:8px;border:none;cursor:pointer;font-size:.82rem;font-weight:600;font-family:inherit}
@media (min-width:601px){
  .gcal-head{grid-template-columns:70px minmax(0,1fr) 18px;padding:10px 18px}
  .gcal-more{padding:4px 18px 14px 88px}
  .gcal-match{max-width:520px}
}
@media (max-width:600px){
  .gcal-actions .gcal-btn{flex:1 1 calc(50% - 4px);padding:0 8px}
  .gcal-actions .gcal-btn.primary,.gcal-actions .gcal-btn.dark{flex-basis:100%;min-height:42px}
  .gcal-seg{width:100%}.gcal-seg button{flex:1;padding:0 6px}
}
`

// Flyer de un partido YA JUGADO: es exactamente el mismo flyer de resultado que
// ven los equipos en la página pública (FlyerResultadoPartido), con los mismos
// datos (partido completo + eventos con nombres), no un diseño aparte.
const nombreDeEvento = e => e.players?.name || e.player_nombre || 'Jugador'
function FlyerResultadoAdmin({ partido, onClose }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let activo = true
    ;(async () => {
      try {
        const [r1, r2] = await Promise.all([
          supabase.from('matches').select(COLUMNAS_COMPLETO).eq('id', partido.id).single(),
          supabase.from('match_events').select('id, event_type, minute, periodo, team_id, player_id, player_nombre').eq('match_id', partido.id),
        ])
        if (r1.error || r2.error) throw (r1.error || r2.error)
        let filas = r2.data || []
        try { filas = await hydratePlayersPublico(filas, { columns: 'id, name' }) } catch { /* sin nombres: se muestra player_nombre o "Jugador" */ }
        if (activo) setDatos({ partido: r1.data, torneo: r1.data.tournaments || partido.tournaments, eventos: filas })
      } catch (e) {
        if (activo) setError(errorAmigable(e, 'No se pudo preparar el flyer'))
      }
    })()
    return () => { activo = false }
  }, [partido.id])

  if (datos) return <FlyerResultadoPartido partido={datos.partido} torneo={datos.torneo} eventos={datos.eventos} nombreDe={nombreDeEvento} onClose={onClose}/>
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '22px 26px', fontSize: '.88rem', fontWeight: '600', color: error ? '#d93025' : '#202124', textAlign: 'center', maxWidth: '320px' }}>
        {error || 'Preparando el flyer…'}
      </div>
    </div>
  )
}

// ── Una fila de partido (no se vuelve a dibujar al abrir/cerrar otras secciones) ──
const FilaPartido = memo(function FilaPartido({ p, abriendo, acc }) {
  const esJugado = p.status === 'finished'
  const [abierto, setAbierto] = useState(false)
  const gH = esJugado && p.home_score > p.away_score
  const gA = esJugado && p.away_score > p.home_score
  // "Sáb 29" y la hora, compactos; la fecha completa sale al abrir el partido.
  let dia = '', hora = ''
  if (p.played_at) {
    const partes = fmtDiaCorto.formatToParts(new Date(p.played_at))
    const get = t => (partes.find(x => x.type === t)?.value || '').replace('.', '')
    dia = `${cap(get('weekday'))} ${get('day')}`
    hora = fmtHoraDate(p.played_at)
  }
  const alternar = () => setAbierto(v => !v)
  return (
    <div className="gcal-row">
      <div className="gcal-head" role="button" tabIndex={0} aria-expanded={abierto}
        onClick={alternar} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar() } }}>
        <div className="gcal-when">
          {p.played_at ? <><b>{dia}</b><span>{hora}</span></> : <span>Por confirmar</span>}
        </div>
        <div className="gcal-match">
          <div className="gcal-lg"><TeamLogo logo_url={p.home?.logo_url} size={22}/></div>
          <span className={`gcal-tn ${gA ? 'lost' : ''}`}>{p.home?.name}</span>
          {esJugado ? <span className={`gcal-n ${gA ? 'lost' : ''}`}>{p.home_score}</span> : <span className="gcal-pend">Pendiente</span>}
          <div className="gcal-lg"><TeamLogo logo_url={p.away?.logo_url} size={22}/></div>
          <span className={`gcal-tn ${gH ? 'lost' : ''}`}>{p.away?.name}</span>
          {esJugado && <span className={`gcal-n ${gH ? 'lost' : ''}`}>{p.away_score}</span>}
        </div>
        <ChevronDown size={18} className={`gcal-chev ${abierto ? 'on' : ''}`}/>
      </div>

      {abierto && (
        <div className="gcal-more">
          <div className="gcal-info">
            {p.played_at && <div className="l"><Clock size={14}/> {cap(fmtDiaLargo.format(new Date(p.played_at)))} · {fmtHoraDate(p.played_at)}</div>}
            {p.location && <div className="l loc"><MapPin size={14}/> {p.location}</div>}
            <div><span className={`gcal-pill ${esJugado ? 'ok' : 'pend'}`}><i/>{esJugado ? 'Partido jugado' : 'Partido pendiente'}</span></div>
          </div>
          <div className="gcal-actions">
            <button className={`gcal-btn ${esJugado ? 'dark' : 'primary'}`} onClick={() => acc.planilla(p)} disabled={abriendo}>
              {abriendo ? 'Abriendo…' : esJugado ? <><Pencil size={14}/> Editar resultado</> : <><Check size={14}/> Registrar resultado</>}
            </button>
            <button className="gcal-btn" onClick={() => acc.flyer(p)}><Image size={14} color="#6c35de"/> Flyer</button>
            {!esJugado && (
              <button className="gcal-btn" onClick={() => acc.link(p)} title="Copia un link de 24h para que un árbitro sin cuenta planille este partido (puedes agregarle más partidos del mismo torneo)">
                <Link2 size={14} color="#00958c"/> Link árbitro
              </button>
            )}
            {!esJugado && (
              <button className="gcal-btn" onClick={() => acc.reloj(p)} title="Link aparte para registrar goles, tarjetas y cambios desde el navegador de un smartwatch">
                <Watch size={14} color="#6c35de"/> Link reloj
              </button>
            )}
            {acc.editar && !esJugado && (
              <button className="gcal-btn" onClick={() => acc.editar(p)}><Pencil size={14}/> Editar fecha y cancha</button>
            )}
            {acc.cargaRapida && (
              <button className="gcal-btn" onClick={() => acc.cargaRapida(p)} title="Cargar goles y tarjetas a mano, rápido — para cuando el árbitro no llenó planilla">⚡ Carga rápida</button>
            )}
            {acc.eliminar && (
              <button className="gcal-btn danger" onClick={() => acc.eliminar(p)}>Eliminar partido</button>
            )}
            {!acc.embebido && <button className="gcal-btn" onClick={() => acc.verTorneo(p.tournament_id)}>Ver torneo →</button>}
          </div>
        </div>
      )}
    </div>
  )
})

// ── Una jornada (acordeón). Los partidos solo se dibujan cuando está abierta ──
const JornadaBloque = memo(function JornadaBloque({ jornada, abierto, defaultAbierto, abriendoId, acc }) {
  const jugados = jornada.partidos.filter(p => p.status === 'finished').length
  const pendientes = jornada.partidos.length - jugados
  const esFase = jornada.key.includes('|fase_')
  const headerColor = esFase ? '#fff' : '#202124'
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div onClick={() => acc.toggle(jornada.key, defaultAbierto)}
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', background: esFase ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#fff' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '1rem', color: headerColor }}>{jornada.label}</div>
          {jornada.fechas.length > 0 && (
            <div style={{ fontSize: '.76rem', color: esFase ? 'rgba(255,255,255,.8)' : '#5f6368', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar size={13} style={{ flexShrink: 0 }}/>
              <span>{jornada.fechas.slice(0, 3).join(' · ')}{jornada.fechas.length > 3 ? ` · +${jornada.fechas.length - 3}` : ''}</span>
            </div>
          )}
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className={`gcal-chip ${esFase ? 'fase' : ''}`}>{jornada.partidos.length} partido{jornada.partidos.length !== 1 ? 's' : ''}</span>
            {jugados > 0 && <span className={`gcal-chip ${esFase ? 'fase' : 'ok'}`}>{jugados} jugado{jugados !== 1 ? 's' : ''}</span>}
            {pendientes > 0 && <span className={`gcal-chip ${esFase ? 'fase' : 'pend'}`}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); acc.flyerGrupo(jornada.partidos) }}
          style={{ background: esFase ? 'rgba(255,255,255,.18)' : '#f3ecfd', border: 'none', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', color: esFase ? '#fff' : '#6c35de', fontSize: '.74rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, minHeight: '34px' }}>
          <Image size={13}/> Flyer
        </button>
        <span style={{ display: 'flex', alignItems: 'center', minHeight: '34px' }}>{abierto
          ? <ChevronUp size={18} color={esFase ? 'rgba(255,255,255,.8)' : '#9aa0a6'}/>
          : <ChevronDown size={18} color={esFase ? 'rgba(255,255,255,.8)' : '#9aa0a6'}/>}</span>
      </div>
      {abierto && (
        <div>
          {jornada.partidos.map(p => <FilaPartido key={p.id} p={p} abriendo={abriendoId === p.id} acc={acc}/>)}
        </div>
      )}
    </div>
  )
})

// ── Jornadas de un torneo (se calculan solo cuando el torneo está abierto) ──
function ListaJornadas({ partidos, prefijo, abiertos, forzarAbierto, abriendoId, acc }) {
  const jornadas = useMemo(() => agruparPorJornada(partidos, prefijo), [partidos, prefijo])
  // Sin nada guardado, se abre solo la jornada del próximo partido pendiente
  const sugerida = jornadas.find(j => j.partidos.some(p => p.status !== 'finished'))?.key
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {jornadas.map(j => {
        const def = forzarAbierto || j.key === sugerida
        return <JornadaBloque key={j.key} jornada={j} abierto={abiertos[j.key] ?? def} defaultAbierto={def} abriendoId={abriendoId} acc={acc}/>
      })}
    </div>
  )
}

// ── Un torneo (acordeón de jornadas) para la vista "todos los torneos" ──
const TorneoBloque = memo(function TorneoBloque({ grupo, abierto, defaultAbierto, abiertos, forzarAbierto, abriendoId, acc }) {
  const { torneo, partidos, jugados, proximo } = grupo
  const pendientes = partidos.length - jugados
  const claveTorneo = `t_${grupo.id}`
  const activo = torneo?.status === 'active'
  return (
    <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
      <div onClick={() => acc.toggle(claveTorneo, defaultAbierto)}
        style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: abierto ? '#f8f9fa' : '#fff' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {torneo?.logo_url
            ? <img src={torneo.logo_url} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            : <Trophy size={20} color="#9aa0a6"/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '1.02rem', color: '#202124', lineHeight: 1.25 }}>{torneo?.name}</span>
            {!activo && <span style={{ fontSize: '.6rem', fontWeight: '700', color: '#5f6368', background: '#f1f3f4', borderRadius: '5px', padding: '1px 6px' }}>NO ACTIVO</span>}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className="gcal-chip">{partidos.length} partido{partidos.length !== 1 ? 's' : ''}</span>
            {jugados > 0 && <span className="gcal-chip ok">{jugados} jugado{jugados !== 1 ? 's' : ''}</span>}
            {pendientes > 0 && <span className="gcal-chip pend">{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
          </div>
          {proximo && (
            <div style={{ marginTop: '8px', fontSize: '.76rem', color: '#1a73e8', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} style={{ flexShrink: 0 }}/> Próximo partido: {cap(fmtDiaCorto.format(new Date(proximo)))} · {fmtHoraDate(proximo)}
            </div>
          )}
        </div>
        {abierto ? <ChevronUp size={20} color="#9aa0a6"/> : <ChevronDown size={20} color="#9aa0a6"/>}
      </div>
      {abierto && (
        <div style={{ padding: '12px', borderTop: '1px solid #f1f3f4', background: '#f4f6f8' }}>
          <ListaJornadas partidos={partidos} prefijo={grupo.id} abiertos={abiertos} forzarAbierto={forzarAbierto} abriendoId={abriendoId} acc={acc}/>
        </div>
      )}
    </div>
  )
})

function Esqueleto() {
  const barra = (w, h = 12) => <div className="gcal-sk" style={{ width: w, height: h, borderRadius: '6px', background: '#e8eaed' }}/>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <style>{'@keyframes gcal-pulso{0%,100%{opacity:1}50%{opacity:.45}}.gcal-sk{animation:gcal-pulso 1.2s ease-in-out infinite}'}</style>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="gcal-sk" style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e8eaed', flexShrink: 0 }}/>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {barra('55%', 14)}
            {barra('80%', 10)}
          </div>
        </div>
      ))}
    </div>
  )
}

// Ventana del botón "Link reloj": link aparte para el smartwatch del árbitro.
// Antes de generarlo se pregunta si el reloj también marca FALTAS (5 botones
// en la torta) o no (4 botones: gol, cambio, amarilla y roja).
function ModalLinkReloj({ modal, generando, onCambiar, onConfirmar, onClose }) {
  const { partido, conFaltas } = modal
  const opcion = (valor, titulo, sub) => (
    <button type="button" onClick={() => onCambiar(valor)}
      style={{ flex: 1, textAlign: 'left', border: `2px solid ${conFaltas === valor ? '#6c35de' : '#dadce0'}`, background: conFaltas === valor ? '#f3ecfd' : '#fff', borderRadius: '12px', padding: '10px 12px', cursor: 'pointer' }}>
      <div style={{ fontWeight: '800', fontSize: '.9rem', color: conFaltas === valor ? '#6c35de' : '#202124' }}>{conFaltas === valor ? '✓ ' : ''}{titulo}</div>
      <div style={{ fontSize: '.7rem', color: '#5f6368', marginTop: '2px' }}>{sub}</div>
    </button>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}>
        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#202124', marginBottom: '2px' }}>⌚ Link para el reloj</div>
        <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '14px' }}>{partido.home?.name || 'Por definir'} vs {partido.away?.name || 'Por definir'}</div>
        <div style={{ fontWeight: '700', fontSize: '.85rem', color: '#202124', marginBottom: '8px' }}>¿Quieres también marcar faltas?</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {opcion(false, 'No', '4 botones: Gol, Cambio, Amarilla y Roja')}
          {opcion(true, 'Sí', '5 botones: se suma Falta')}
        </div>
        <div style={{ fontSize: '.72rem', color: '#5f6368', background: '#f8f9fa', borderRadius: '10px', padding: '8px 10px', marginBottom: '14px', lineHeight: 1.45 }}>
          El link dura 24 horas y es solo para el reloj. Los goles, tarjetas y faltas entran solos a la planilla del partido; los cambios se ven en la planilla en una franja aparte.
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={generando} style={{ flex: 1, background: '#fff', border: '1px solid #dadce0', borderRadius: '10px', padding: '11px', cursor: 'pointer', fontWeight: '700', color: '#5f6368' }}>Cancelar</button>
          <button onClick={onConfirmar} disabled={generando} style={{ flex: 2, background: '#6c35de', border: 'none', borderRadius: '10px', padding: '11px', cursor: generando ? 'default' : 'pointer', fontWeight: '800', color: '#fff', opacity: generando ? .7 : 1 }}>
            {generando ? 'Generando…' : 'Generar y copiar link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Ventana del botón "Link árbitro": pregunta si se quieren agregar más
// partidos al link y lista SOLO los pendientes del mismo torneo, por día.
function ModalLinkArbitro({ modal, linkGrupoVigente, generando, onToggle, onToggleDia, onConfirmar, onClose }) {
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

  // Escenarios (cancha/sede): dentro de cada día se pueden marcar todos los
  // partidos de un mismo escenario (solo de ESE día, no de todos los días).
  const escenarioDe = m => (m.location && m.location.trim()) || 'Sin escenario'
  const porEscenario = lista => {
    const mapa = new Map()
    lista.forEach(m => {
      const e = escenarioDe(m)
      if (!mapa.has(e)) mapa.set(e, [])
      mapa.get(e).push(m.id)
    })
    return [...mapa.entries()].map(([nombreEsc, ids]) => ({ nombre: nombreEsc, ids }))
  }
  // Botón-chip: marcado (azul), a medias (borde azul) o vacío
  const chip = (ids, etiqueta, clave) => {
    const n = ids.filter(id => sel.includes(id)).length
    const todos = n === ids.length
    const parcial = n > 0 && !todos
    return (
      <button key={clave} type="button" onClick={() => onToggleDia(ids, !todos)}
        style={{ border: `1.5px solid ${todos || parcial ? '#1a73e8' : '#dadce0'}`, background: todos ? '#1a73e8' : parcial ? '#f3f8ff' : '#fff', color: todos ? '#fff' : parcial ? '#1a73e8' : '#3c4043', borderRadius: '999px', padding: '5px 11px', fontSize: '.74rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', maxWidth: '100%' }}>
        {todos && <span>✓</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etiqueta}</span>
        <span style={{ opacity: .75, fontWeight: '500' }}>{parcial ? `${n}/${ids.length}` : ids.length}</span>
      </button>
    )
  }

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
            const escDelDia = porEscenario(g.items)
            return (
              <div key={g.dia} style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '.72rem', fontWeight: '700', color: '#5f6368' }}>{cap(g.dia)}</span>
                  <button type="button" onClick={() => onToggleDia(ids, !todos)}
                    style={{ border: 'none', background: 'none', color: '#1a73e8', fontSize: '.72rem', fontWeight: '600', cursor: 'pointer', padding: '2px 0' }}>
                    {todos ? 'Quitar el día' : 'Marcar el día'}
                  </button>
                </div>
                {escDelDia.length > 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {escDelDia.map(e => chip(e.ids, e.nombre, `${g.dia}_${e.nombre}`))}
                  </div>
                )}
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

function linkGrupoVigente(m) {
  return m.link_planilla_grupo && m.link_planilla_expira && new Date(m.link_planilla_expira) > new Date()
    ? m.link_planilla_grupo : null
}

const porHora = (a, b) => (a.played_at ? new Date(a.played_at).getTime() : Infinity) - (b.played_at ? new Date(b.played_at).getTime() : Infinity)

// Si recibe `torneo` + `partidosExternos`, funciona "embebido" dentro de la
// pestaña Calendario del torneo: usa los partidos que ya tiene esa pantalla,
// no abre su propia planilla (usa la de la pantalla) y suma Editar / Carga
// rápida / Eliminar a cada partido. Sin props es el calendario global de siempre.
export default function AdminCalendarioPage({ torneo = null, partidosExternos = null, acciones = null }) {
  const embebido = !!(torneo && partidosExternos)
  const navigate = useNavigate()
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const claveCache = esOrganizador ? `org:${user?.id}` : 'admin'
  const hayCache = !embebido && cacheCalendario.clave === claveCache
  const [searchParams, setSearchParams] = useSearchParams()
  const [partidosFetch,    setPartidos]        = useState(() => hayCache ? cacheCalendario.partidos : [])
  const [loading,         setLoading]         = useState(!hayCache && !embebido)
  const [cargandoMas,     setCargandoMas]     = useState(false)
  const [errorCarga,      setErrorCarga]      = useState('')
  // Lo que la persona dejó puesto (Pendientes/Jugados, torneo, secciones
  // abiertas y hasta dónde bajó) se recuerda: si el celular recarga la página
  // al volver de WhatsApp (o de copiar un link), todo queda donde estaba en
  // vez de tener que escoger el torneo y buscar el partido otra vez.
  const [filtro,          setFiltro]          = useEstadoUI('gm_ui_calendario_filtro', 'todos')
  const [torneoFiltroUI,  setTorneoFiltro]    = useEstadoUI('gm_ui_calendario_torneo', '')
  const torneoFiltro = embebido ? torneo.id : torneoFiltroUI
  const [abiertos,        setAbiertos]        = useEstadoUI('gm_ui_calendario_abiertos', {})
  const [busqueda,        setBusqueda]        = useState('')
  const [flyerPartido,    setFlyerPartido]    = useState(null)
  const [flyerGrupo,      setFlyerGrupo]      = useState(null)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [abriendoId,      setAbriendoId]      = useState(null)
  // Ventana "¿Quieres agregar más partidos a este link?" del botón Link árbitro:
  // { partido, sel: [ids marcados], candidatos: [partidos del mismo torneo] }
  const [linkModal,       setLinkModal]       = useState(null)
  const [generandoLink,   setGenerandoLink]   = useState(false)
  // Ventana del botón Link reloj: { partido, conFaltas }
  const [relojModal,      setRelojModal]      = useState(null)
  const partidosExt = useMemo(() => embebido ? partidosExternos.map(p => ({ ...p, tournaments: torneo })) : null, [embebido, partidosExternos, torneo])
  const partidos = embebido ? partidosExt : partidosFetch
  const reqId = useRef(0)
  const ocupado = useRef(false)

  useEffect(() => { if (!embebido) fetchTodo(hayCache) }, [esOrganizador, user?.id])
  // La planilla abierta queda marcada en la URL (?planilla=<id>): así, sin
  // importar qué haga el navegador al volver (recargar, matar la pestaña,
  // etc.), se reabre exactamente la misma planilla. Solo el botón "Salir"
  // (cerrarPlanilla) puede sacar de la planilla.
  useEffect(() => {
    if (embebido) return
    const matchId = searchParams.get('planilla')
    if (matchId) {
      supabase.from('matches')
        .select(COLUMNAS_COMPLETO)
        .eq('id', matchId).single()
        .then(({ data }) => { if (data) setPlanillaPartido(data) })
    } else {
      recuperarPlanillaAbierta().then(p => { if (p) abrirPlanilla(p, true) })
    }
  }, [])

  // La lista es "liviana" (sin las planillas guardadas), así que al abrir una
  // planilla se pide el partido completo. Si esa petición falla NO se abre con
  // la fila liviana: una planilla abierta sin sus datos podría guardar en blanco.
  async function abrirPlanilla(p, esCompleto = false) {
    if (ocupado.current) return
    ocupado.current = true
    setAbriendoId(p.id)
    try {
      const { data, error } = await supabase.from('matches').select(COLUMNAS_COMPLETO).eq('id', p.id).single()
      let completo = data
      if (error || !data) {
        if (!esCompleto) { notify('No se pudo abrir la planilla, revisa tu conexión e intenta de nuevo', 'error'); return }
        completo = p
      }
      setPlanillaPartido(completo)
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); return n }, { replace: true })
    } finally {
      ocupado.current = false
      setAbriendoId(null)
    }
  }
  function cerrarPlanilla() {
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace: true })
    fetchTodo(true)
  }

  // silencioso = true: refresca la lista SIN la pantalla de carga (que
  // encoge la página y te manda arriba del todo) y la cambia de una sola vez
  // al final, para que no parpadee.
  async function fetchTodo(silencioso = false) {
    const id = ++reqId.current
    const vigente = () => id === reqId.current
    if (!silencioso) setLoading(true)
    setErrorCarga('')
    try {
      let torneoIds = null
      // El organizador solo ve el calendario de sus propios torneos
      if (esOrganizador) {
        const { data: mis, error } = await supabase.from('tournaments').select('id').eq('organizador_id', user?.id)
        if (error) throw error
        torneoIds = (mis || []).map(t => t.id)
        if (torneoIds.length === 0) {
          if (!vigente()) return
          cacheCalendario = { clave: claveCache, partidos: [] }
          setPartidos([]); setCargandoMas(false); setLoading(false)
          return
        }
      }
      const todos = await traerPartidos(torneoIds, (parcial, hayMas) => {
        if (!vigente() || silencioso) return
        setPartidos(parcial)      // la primera página ya se pinta mientras llegan las demás
        setLoading(false)
        setCargandoMas(hayMas)
      })
      if (!vigente()) return
      cacheCalendario = { clave: claveCache, partidos: todos }
      setPartidos(todos)
      setCargandoMas(false)
      setLoading(false)
    } catch (e) {
      if (!vigente()) return
      setCargandoMas(false)
      setLoading(false)
      if (!silencioso) setErrorCarga(e?.message || 'No se pudo cargar el calendario')
    }
  }

  // Link de 24h para que un árbitro sin cuenta entre directo a planillar
  // (ver PlanillarLinkPage.jsx). Al tocar "Link árbitro", si el torneo tiene
  // más partidos pendientes, se pregunta "¿Quieres agregar más partidos a este
  // link?" y se muestran SOLO los del mismo torneo: así el árbitro recibe un
  // único link con todos los partidos que va a dirigir, en vez de uno por uno.
  // Si no hay otros partidos, se copia directo el link de ese partido.
  async function handleLinkArbitro(p) {
    if (ocupado.current) return
    ocupado.current = true
    try {
      const candidatos0 = partidos
        .filter(m => m.tournament_id === p.tournament_id && m.id !== p.id && m.status !== 'finished')
        .sort(porHora)
      if (candidatos0.length === 0) { await copiarLinkUnico(p); return }

      // Qué partidos del torneo ya están en un link de grupo vigente (se pide
      // aparte, solo de este torneo — la lista general no trae esas columnas).
      // Si todavía no se corrió migracion_link_arbitro_grupo.sql, esto falla y
      // simplemente se sigue sin esa información.
      const info = new Map()
      try {
        const { data } = await supabase.from('matches')
          .select('id,link_planilla_grupo,link_planilla_expira')
          .eq('tournament_id', p.tournament_id)
          .not('link_planilla_grupo', 'is', null)
        ;(data || []).forEach(r => info.set(r.id, r))
      } catch { /* sin migración: sin info de grupos */ }
      const conGrupo = m => ({ ...m, link_planilla_grupo: info.get(m.id)?.link_planilla_grupo || null, link_planilla_expira: info.get(m.id)?.link_planilla_expira || null })
      const origen = conGrupo(p)
      const candidatos = candidatos0.map(conGrupo)
      const grupoDeP = linkGrupoVigente(origen)
      // Si este partido ya tenía un link de grupo vigente, sus partidos van marcados
      const marcados = grupoDeP ? candidatos.filter(m => linkGrupoVigente(m) === grupoDeP).map(m => m.id) : []
      setLinkModal({ partido: origen, sel: [p.id, ...marcados], candidatos })
    } finally {
      ocupado.current = false
    }
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
    if (error) { notify(errorAmigable(error, 'Error al generar el link'), 'error'); return false }
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
        const faltaMigracion = error.code === 'PGRST202' || (/generar_link_planilla_grupo/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || ''))
        notify(faltaMigracion
          ? avisoMigracion('migracion_link_arbitro_grupo.sql')
          : errorAmigable(error, 'Error al generar el link'), 'error')
        return
      }
      const ordenados = [...orden].sort(porHora)
      navigator.clipboard.writeText(mensajeGrupo(ordenados, `${window.location.origin}/planillar/${data.token}`))
      notify(`Link con ${data.total || ordenados.length} partidos copiado ✓`)
      setLinkModal(null)
    } finally {
      setGenerandoLink(false)
    }
  }

  async function confirmarLinkReloj() {
    if (!relojModal || generandoLink) return
    const { partido, conFaltas } = relojModal
    setGenerandoLink(true)
    try {
      const { data, error } = await supabase.rpc('generar_link_reloj', { p_match_id: partido.id, p_con_faltas: !!conFaltas })
      if (error) {
        const falta = error.code === 'PGRST202' || (/generar_link_reloj/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || ''))
        notify(falta ? avisoMigracion('migracion_reloj.sql') : errorAmigable(error, 'Error al generar el link'), 'error')
        return
      }
      const link = `${window.location.origin}/reloj/${data.token}`
      const txt = `⌚ Reloj del partido — ${partido.home?.name || 'Por definir'} vs ${partido.away?.name || 'Por definir'}\n\nÁbrelo en el navegador del reloj. ${conFaltas ? 'Marca goles, cambios, amarillas, rojas y faltas.' : 'Marca goles, cambios, amarillas y rojas.'}\n\n⏰ Este link dura 24 horas.\n\n👉 ${link}`
      try { await navigator.clipboard.writeText(txt) } catch { /* el navegador no dejó copiar */ }
      notify('Link del reloj copiado ✓')
      setRelojModal(null)
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

  // Acciones estables para las filas (así React no las vuelve a dibujar todas
  // cada vez que cambia algo de la pantalla): siempre llaman a la versión más reciente.
  const ultimo = useRef({})
  useEffect(() => { ultimo.current = { handleLinkArbitro, abrirPlanilla, navigate, acciones } })
  const acc = useMemo(() => ({
    flyer: p => setFlyerPartido(p),
    link: p => ultimo.current.handleLinkArbitro(p),
    reloj: p => setRelojModal({ partido: p, conFaltas: false }),
    planilla: p => ultimo.current.acciones?.planilla ? ultimo.current.acciones.planilla(p) : ultimo.current.abrirPlanilla(p),
    verTorneo: id => ultimo.current.navigate(`/admin/torneos/${id}`),
    flyerGrupo: ps => setFlyerGrupo({ torneo: construirTorneoFlyer(ps), partidos: ps }),
    toggle: (key, def) => setAbiertos(prev => ({ ...prev, [key]: !(prev[key] ?? def) })),
    embebido,
    editar: embebido && acciones?.editar ? p => ultimo.current.acciones.editar(p) : null,
    cargaRapida: embebido && acciones?.cargaRapida ? p => ultimo.current.acciones.cargaRapida(p) : null,
    eliminar: embebido && acciones?.eliminar ? p => ultimo.current.acciones.eliminar(p) : null,
  }), [setAbiertos, embebido, !!acciones?.editar, !!acciones?.cargaRapida, !!acciones?.eliminar])

  // ── Datos derivados (se recalculan solo cuando cambian de verdad) ──
  const torneosTodos = useMemo(() => agruparPorTorneo(partidos), [partidos])
  const indice = useMemo(() => partidos.map(p => ({ p, txt: sinTildes(`${p.home?.name || ''} ${p.away?.name || ''} ${p.location || ''}`) })), [partidos])
  const busquedaDiferida = useDeferredValue(busqueda)
  const termino = sinTildes(busquedaDiferida.trim())

  const filtrados = useMemo(() => indice
    .filter(({ p, txt }) => (
      (filtro === 'todos' ? true : filtro === 'pendientes' ? p.status !== 'finished' : p.status === 'finished')
      && (torneoFiltro ? p.tournament_id === torneoFiltro : true)
      && (termino ? txt.includes(termino) : true)
    ))
    .map(({ p }) => p), [indice, filtro, torneoFiltro, termino])

  const torneosVista = useMemo(() => agruparPorTorneo(filtrados), [filtrados])
  const pendientesTotal = useMemo(() => filtrados.reduce((n, p) => n + (p.status !== 'finished' ? 1 : 0), 0), [filtrados])

  // El torneo recordado ya no existe / no es mío: se limpia el filtro
  useEffect(() => {
    if (!embebido && !loading && !cargandoMas && torneoFiltro && !torneosTodos.some(g => g.id === torneoFiltro)) setTorneoFiltro('')
  }, [loading, cargandoMas, torneoFiltro, torneosTodos, setTorneoFiltro])

  // Vuelve a la misma altura donde estaba cuando la lista ya cargó
  useRestaurarScroll('gm_ui_calendario_scroll', !embebido && !loading && partidos.length > 0)

  const buscando = termino.length > 0
  const activos = torneosTodos.filter(g => g.torneo?.status === 'active')
  const otros = torneosTodos.filter(g => g.torneo?.status !== 'active')

  return (
    <div>
      <style>{ESTILOS_CAL}</style>
      {flyerPartido && (flyerPartido.status === 'finished'
        ? <FlyerResultadoAdmin partido={flyerPartido} onClose={() => setFlyerPartido(null)}/>
        : <FlyerPartido partido={flyerPartido} onClose={() => setFlyerPartido(null)}/>)}
      {flyerGrupo      && <FlyerProgramacion torneo={flyerGrupo.torneo} partidos={flyerGrupo.partidos} onClose={() => setFlyerGrupo(null)}/>}
      {!embebido && planillaPartido && <PlanillaSegunPartido partido={planillaPartido} onClose={cerrarPlanilla}/>}
      {relojModal && <ModalLinkReloj modal={relojModal} generando={generandoLink}
        onCambiar={v => setRelojModal(m => m && ({ ...m, conFaltas: v }))}
        onConfirmar={confirmarLinkReloj} onClose={() => !generandoLink && setRelojModal(null)}/>}
      {linkModal && <ModalLinkArbitro modal={linkModal} linkGrupoVigente={linkGrupoVigente}
        generando={generandoLink} onToggle={toggleSel} onToggleDia={toggleDia}
        onConfirmar={confirmarLinkModal} onClose={() => !generandoLink && setLinkModal(null)}/>}

      {!embebido && <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>{esOrganizador ? 'Mi calendario' : 'Calendario Global'}</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{esOrganizador ? 'Partidos de mis torneos' : 'Todos los partidos de todos los torneos'}</p>
      </div>}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="gcal-seg">
          {[{ id: 'todos', label: 'Todos' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'jugados', label: 'Jugados' }].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ background: filtro === f.id ? '#1a73e8' : 'transparent', color: filtro === f.id ? '#fff' : '#5f6368' }}>
              {f.label}
            </button>
          ))}
        </div>
        {!embebido && <select value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 0, minHeight: '40px', padding: '7px 12px', border: '1px solid #dadce0', borderRadius: '10px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff', maxWidth: '100%' }}>
          <option value="">Todos los torneos</option>
          {activos.length > 0 && (
            <optgroup label="Activos">
              {activos.map(g => <option key={g.id} value={g.id}>{g.torneo?.name}</option>)}
            </optgroup>
          )}
          {otros.length > 0 && (
            <optgroup label="Otros torneos">
              {otros.map(g => <option key={g.id} value={g.id}>{g.torneo?.name}</option>)}
            </optgroup>
          )}
        </select>}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, maxWidth: '360px' }}>
          <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar equipo o cancha…"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: '40px', padding: '7px 12px 7px 32px', border: '1px solid #dadce0', borderRadius: '10px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff' }}/>
        </div>
        {!embebido && torneoFiltro && filtrados.length > 0 && (
          <button onClick={() => setFlyerGrupo({ torneo: construirTorneoFlyer(filtrados), partidos: filtrados })}
            style={{ background: '#6c35de', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Image size={13}/> Crear flyer (todos)
          </button>
        )}
        <div style={{ flexBasis: '100%', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {torneosVista.length > 1 && <span className="gcal-chip">{torneosVista.length} torneos</span>}
          <span className="gcal-chip">{filtrados.length} partido{filtrados.length !== 1 ? 's' : ''}</span>
          {pendientesTotal > 0 && filtro === 'todos' && <span className="gcal-chip pend">{pendientesTotal} pendiente{pendientesTotal !== 1 ? 's' : ''}</span>}
          {cargandoMas && <span style={{ fontSize: '.74rem', color: '#9aa0a6' }}>cargando más…</span>}
        </div>
      </div>

      {errorCarga ? (
        <div style={{ padding: '32px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #f4c7c3' }}>
          <div style={{ fontSize: '.9rem', color: '#d93025', fontWeight: '600', marginBottom: '4px' }}>No se pudo cargar el calendario</div>
          <div style={{ fontSize: '.78rem', color: '#80868b', marginBottom: '12px' }}>{errorCarga}</div>
          <button onClick={() => fetchTodo(false)} style={{ background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '.82rem', fontWeight: '600', cursor: 'pointer' }}>Reintentar</button>
        </div>
      ) : loading ? (
        <Esqueleto/>
      ) : torneosVista.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <Calendar size={36} style={{ opacity: .3, marginBottom: '8px' }}/>
          <div style={{ fontSize: '.875rem' }}>No hay partidos</div>
        </div>
      ) : torneoFiltro ? (
        // Un solo torneo: directo sus jornadas
        <ListaJornadas partidos={torneosVista[0].partidos} prefijo={torneoFiltro} abiertos={abiertos} forzarAbierto={buscando} abriendoId={abriendoId} acc={acc}/>
      ) : (
        // Todos los torneos: un bloque por torneo
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {torneosVista.map((g, i) => {
            const def = buscando || i === 0 || torneosVista.length === 1
            const eraActivo = i > 0 && torneosVista[i - 1].torneo?.status === 'active' && g.torneo?.status !== 'active'
            return (
              <div key={g.id}>
                {eraActivo && <div style={{ fontSize: '.7rem', fontWeight: '700', color: '#9aa0a6', letterSpacing: '.06em', textTransform: 'uppercase', margin: '12px 2px 8px' }}>Otros torneos</div>}
                <TorneoBloque grupo={g} abierto={abiertos[`t_${g.id}`] ?? def} defaultAbierto={def}
                  abiertos={abiertos} forzarAbierto={buscando} abriendoId={abriendoId} acc={acc}/>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
