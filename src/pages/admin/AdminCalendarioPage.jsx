import { useState, useEffect, useMemo, useRef, memo, useDeferredValue } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { Calendar, Check, Image, Shield, ChevronDown, ChevronUp, Link2, Search, Trophy } from 'lucide-react'
import FlyerPartido from '../../components/FlyerPartido'
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
const COLUMNAS_LISTA = 'id,tournament_id,home_team_id,away_team_id,home_score,away_score,status,played_at,location,matchday,fase,'
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
  semifinal: 'Semifinales', tercero: 'Tercer Puesto', final: 'Final',
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
    if (p.fase && p.fase !== 'grupo') {
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

// ── Una fila de partido (no se vuelve a dibujar al abrir/cerrar otras secciones) ──
const FilaPartido = memo(function FilaPartido({ p, abriendo, acc }) {
  const esJugado = p.status === 'finished'
  return (
    <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f3f4', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Fecha y hora */}
        <div style={{ minWidth: '64px', flexShrink: 0 }}>
          {p.played_at && (
            <>
              <div style={{ fontSize: '.68rem', color: '#5f6368', fontWeight: '600' }}>{fmtDiaCorto.format(new Date(p.played_at))}</div>
              <div style={{ fontSize: '.68rem', color: '#9aa0a6' }}>{fmtHoraDate(p.played_at)}</div>
            </>
          )}
          {p.location && <div style={{ fontSize: '.62rem', color: '#1a73e8', marginTop: '2px' }}>📍 {p.location}</div>}
        </div>

        {/* Partido */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', textAlign: 'right', lineHeight: 1.2, wordBreak: 'break-word' }}>{p.home?.name}</span>
            <div style={{ width: '26px', height: '26px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0 }}>
              <TeamLogo logo_url={p.home?.logo_url} size={26}/>
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
              <TeamLogo logo_url={p.away?.logo_url} size={26}/>
            </div>
            <span style={{ fontWeight: '600', color: '#202124', fontSize: '.82rem', lineHeight: 1.2, wordBreak: 'break-word' }}>{p.away?.name}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '.65rem', fontWeight: '600', color: esJugado ? '#1e8e3e' : '#e8710a', background: esJugado ? '#e6f4ea' : '#fce8d9', borderRadius: '6px', padding: '1px 6px', flexShrink: 0 }}>
          {esJugado ? '✓ Jugado' : '⏳ Pendiente'}
        </span>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => acc.flyer(p)}
            style={{ background: '#6c35de', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#fff', fontSize: '.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Image size={11}/> Flyer
          </button>
          {!esJugado && (
            <button onClick={() => acc.link(p)} title="Copia un link de 24h para que un árbitro sin cuenta planille este partido (puedes agregarle más partidos del mismo torneo)"
              style={{ background: '#fff', border: '1px solid #00b8ad', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#00958c', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Link2 size={11}/> Link árbitro
            </button>
          )}
          <button onClick={() => acc.planilla(p)} disabled={abriendo}
            style={{ background: esJugado ? 'none' : '#1a73e8', border: esJugado ? '1px solid #dadce0' : 'none', borderRadius: '6px', padding: '5px 8px', cursor: abriendo ? 'default' : 'pointer', color: esJugado ? '#5f6368' : '#fff', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', opacity: abriendo ? 0.6 : 1 }}>
            {abriendo ? 'Abriendo…' : esJugado ? '✏️ Editar' : <><Check size={11}/> Resultado</>}
          </button>
          <button onClick={() => acc.verTorneo(p.tournament_id)}
            style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: '.7rem' }}>Ver torneo →</button>
        </div>
      </div>
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
        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: esFase ? 'linear-gradient(135deg,#1a73e8,#6c35de)' : '#fff' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '.92rem', color: headerColor }}>{jornada.label}</div>
          <div style={{ fontSize: '.72rem', color: esFase ? 'rgba(255,255,255,.75)' : '#9aa0a6', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {jornada.fechas.length > 0 && <span>📅 {jornada.fechas.slice(0, 3).join(' · ')}{jornada.fechas.length > 3 ? ` · +${jornada.fechas.length - 3}` : ''}</span>}
            <span>{jornada.partidos.length} partido{jornada.partidos.length !== 1 ? 's' : ''}</span>
            {jugados > 0 && <span style={{ color: esFase ? 'rgba(255,255,255,.85)' : '#1e8e3e' }}>✓ {jugados} jugado{jugados !== 1 ? 's' : ''}</span>}
            {pendientes > 0 && <span style={{ color: esFase ? 'rgba(255,255,255,.85)' : '#e8710a' }}>⏳ {pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); acc.flyerGrupo(jornada.partidos) }}
          style={{ background: esFase ? 'rgba(255,255,255,.18)' : '#f3ecfd', border: 'none', borderRadius: '6px', padding: '5px 9px', cursor: 'pointer', color: esFase ? '#fff' : '#6c35de', fontSize: '.7rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Image size={12}/> Flyer
        </button>
        {abierto
          ? <ChevronUp size={18} color={esFase ? 'rgba(255,255,255,.8)' : '#9aa0a6'}/>
          : <ChevronDown size={18} color={esFase ? 'rgba(255,255,255,.8)' : '#9aa0a6'}/>}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', background: abierto ? '#f8f9fa' : '#fff' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {torneo?.logo_url
            ? <img src={torneo.logo_url} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
            : <Trophy size={20} color="#9aa0a6"/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '.98rem', color: '#202124' }}>{torneo?.name}</span>
            {!activo && <span style={{ fontSize: '.6rem', fontWeight: '700', color: '#5f6368', background: '#f1f3f4', borderRadius: '5px', padding: '1px 6px' }}>NO ACTIVO</span>}
          </div>
          <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>{partidos.length} partido{partidos.length !== 1 ? 's' : ''}</span>
            {jugados > 0 && <span style={{ color: '#1e8e3e' }}>✓ {jugados} jugado{jugados !== 1 ? 's' : ''}</span>}
            {pendientes > 0 && <span style={{ color: '#e8710a' }}>⏳ {pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
            {proximo && <span style={{ color: '#1a73e8' }}>Próximo: {fmtDiaCorto.format(new Date(proximo))} · {fmtHoraDate(proximo)}</span>}
          </div>
        </div>
        {abierto ? <ChevronUp size={20} color="#9aa0a6"/> : <ChevronDown size={20} color="#9aa0a6"/>}
      </div>
      {abierto && (
        <div style={{ padding: '10px', borderTop: '1px solid #f1f3f4', background: '#fafbfc' }}>
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
                  <span style={{ fontSize: '.72rem', fontWeight: '700', color: '#5f6368' }}>{cap(g.dia)}</span>
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

function linkGrupoVigente(m) {
  return m.link_planilla_grupo && m.link_planilla_expira && new Date(m.link_planilla_expira) > new Date()
    ? m.link_planilla_grupo : null
}

const porHora = (a, b) => (a.played_at ? new Date(a.played_at).getTime() : Infinity) - (b.played_at ? new Date(b.played_at).getTime() : Infinity)

export default function AdminCalendarioPage() {
  const navigate = useNavigate()
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const claveCache = esOrganizador ? `org:${user?.id}` : 'admin'
  const hayCache = cacheCalendario.clave === claveCache
  const [searchParams, setSearchParams] = useSearchParams()
  const [partidos,        setPartidos]        = useState(() => hayCache ? cacheCalendario.partidos : [])
  const [loading,         setLoading]         = useState(!hayCache)
  const [cargandoMas,     setCargandoMas]     = useState(false)
  const [errorCarga,      setErrorCarga]      = useState('')
  // Lo que la persona dejó puesto (Pendientes/Jugados, torneo, secciones
  // abiertas y hasta dónde bajó) se recuerda: si el celular recarga la página
  // al volver de WhatsApp (o de copiar un link), todo queda donde estaba en
  // vez de tener que escoger el torneo y buscar el partido otra vez.
  const [filtro,          setFiltro]          = useEstadoUI('gm_ui_calendario_filtro', 'todos')
  const [torneoFiltro,    setTorneoFiltro]    = useEstadoUI('gm_ui_calendario_torneo', '')
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
  const reqId = useRef(0)
  const ocupado = useRef(false)

  useEffect(() => { fetchTodo(hayCache) }, [esOrganizador, user?.id])
  // La planilla abierta queda marcada en la URL (?planilla=<id>): así, sin
  // importar qué haga el navegador al volver (recargar, matar la pestaña,
  // etc.), se reabre exactamente la misma planilla. Solo el botón "Salir"
  // (cerrarPlanilla) puede sacar de la planilla.
  useEffect(() => {
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
        const faltaMigracion = error.code === 'PGRST202' || (/generar_link_planilla_grupo/.test(error.message || '') && /not find|does not exist|schema cache/i.test(error.message || ''))
        notify(faltaMigracion
          ? 'Falta correr migracion_link_arbitro_grupo.sql en Supabase'
          : 'Error al generar el link: ' + error.message, 'error')
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

  function toggleSel(id) {
    setLinkModal(m => m && ({ ...m, sel: m.sel.includes(id) ? m.sel.filter(x => x !== id) : [...m.sel, id] }))
  }
  function toggleDia(ids, marcar) {
    setLinkModal(m => m && ({ ...m, sel: marcar ? [...new Set([...m.sel, ...ids])] : m.sel.filter(x => !ids.includes(x)) }))
  }

  // Acciones estables para las filas (así React no las vuelve a dibujar todas
  // cada vez que cambia algo de la pantalla): siempre llaman a la versión más reciente.
  const ultimo = useRef({})
  useEffect(() => { ultimo.current = { handleLinkArbitro, abrirPlanilla, navigate } })
  const acc = useMemo(() => ({
    flyer: p => setFlyerPartido(p),
    link: p => ultimo.current.handleLinkArbitro(p),
    planilla: p => ultimo.current.abrirPlanilla(p),
    verTorneo: id => ultimo.current.navigate(`/admin/torneos/${id}`),
    flyerGrupo: ps => setFlyerGrupo({ torneo: construirTorneoFlyer(ps), partidos: ps }),
    toggle: (key, def) => setAbiertos(prev => ({ ...prev, [key]: !(prev[key] ?? def) })),
  }), [setAbiertos])

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
    if (!loading && !cargandoMas && torneoFiltro && !torneosTodos.some(g => g.id === torneoFiltro)) setTorneoFiltro('')
  }, [loading, cargandoMas, torneoFiltro, torneosTodos, setTorneoFiltro])

  // Vuelve a la misma altura donde estaba cuando la lista ya cargó
  useRestaurarScroll('gm_ui_calendario_scroll', !loading && partidos.length > 0)

  const buscando = termino.length > 0
  const activos = torneosTodos.filter(g => g.torneo?.status === 'active')
  const otros = torneosTodos.filter(g => g.torneo?.status !== 'active')

  return (
    <div>
      {flyerPartido    && <FlyerPartido    partido={flyerPartido}    onClose={() => setFlyerPartido(null)}/>}
      {flyerGrupo      && <FlyerProgramacion torneo={flyerGrupo.torneo} partidos={flyerGrupo.partidos} onClose={() => setFlyerGrupo(null)}/>}
      {planillaPartido && <PlanillaSegunPartido partido={planillaPartido} onClose={cerrarPlanilla}/>}
      {linkModal && <ModalLinkArbitro modal={linkModal} linkGrupoVigente={linkGrupoVigente}
        generando={generandoLink} onToggle={toggleSel} onToggleDia={toggleDia}
        onConfirmar={confirmarLinkModal} onClose={() => !generandoLink && setLinkModal(null)}/>}

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>{esOrganizador ? 'Mi calendario' : 'Calendario Global'}</h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{esOrganizador ? 'Partidos de mis torneos' : 'Todos los partidos de todos los torneos'}</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '8px', padding: '3px' }}>
          {[{ id: 'todos', label: 'Todos' }, { id: 'pendientes', label: 'Pendientes' }, { id: 'jugados', label: 'Jugados' }].map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', background: filtro === f.id ? '#1a73e8' : 'transparent', color: filtro === f.id ? '#fff' : '#5f6368' }}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={torneoFiltro} onChange={e => setTorneoFiltro(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff', maxWidth: '100%' }}>
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
        </select>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '160px', maxWidth: '320px' }}>
          <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar equipo o cancha…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 12px 7px 30px', border: '1px solid #dadce0', borderRadius: '8px', fontSize: '.875rem', color: '#202124', outline: 'none', background: '#fff' }}/>
        </div>
        {torneoFiltro && filtrados.length > 0 && (
          <button onClick={() => setFlyerGrupo({ torneo: construirTorneoFlyer(filtrados), partidos: filtrados })}
            style={{ background: '#6c35de', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Image size={13}/> Crear flyer (todos)
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: '.8rem', color: '#9aa0a6', textAlign: 'right' }}>
          {torneosVista.length > 1 && <span>{torneosVista.length} torneos · </span>}
          {filtrados.length} partido{filtrados.length !== 1 ? 's' : ''}
          {pendientesTotal > 0 && filtro === 'todos' && <span> · ⏳ {pendientesTotal}</span>}
          {cargandoMas && <span> · cargando más…</span>}
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
