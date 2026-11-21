import { useEffect, useMemo, useState } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { aplicarAliasMultiTorneo } from '../lib/nombresTorneo'
import { fmtHoraDate } from '../lib/horaHelpers'
import { leerCacheRapido, guardarCacheRapido } from '../lib/cacheRapido'
import { TarjetaPanel, G } from './PanelUI'

// TODAS las canchas con partidos programados (no solo los asignados al árbitro), para que no tenga que esperar a
// que lo designen: ordenado por ESCENARIO → CANCHA → partidos por hora. Desde aquí puede planillar cualquier
// partido que todavía no se haya jugado (la base ya lo permite a cualquier árbitro mientras el partido no se cierre).

const TZ = 'America/Bogota'
const diaDe = d => (d ? new Date(d) : new Date()).toLocaleDateString('en-CA', { timeZone: TZ })
const sumarDias = (dia, n) => { const d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const tituloDia = dia => {
  const hoy = diaDe()
  if (dia === hoy) return 'Hoy'
  if (dia === sumarDias(hoy, 1)) return 'Mañana'
  if (dia === sumarDias(hoy, -1)) return 'Ayer'
  const t = new Date(dia + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const natural = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

const COLUMNAS = 'id, tournament_id, played_at, location, cancha_id, status, tipo_resultado, home_score, away_score, matchday, arbitro1, arbitro1_id, arbitro2_id, '
  + 'tournaments(id, name, modalidad, status), home:home_team_id(name, logo_url), away:away_team_id(name, logo_url)'

// Escenario y cancha de un partido: de la tabla de canchas; si no tiene, del texto «Escenario · Cancha»
function ubicar(p, canchas) {
  const c = p.cancha_id != null ? canchas[String(p.cancha_id)] : null
  if (c) return { escenario: (c.escenario || '').trim(), cancha: (c.nombre || '').trim() || 'Cancha' }
  const txt = (p.location || '').trim()
  if (!txt) return { escenario: SIN_CANCHA, cancha: 'Por definir' }
  const partes = txt.split(/\s+·\s+/)
  return partes.length > 1 ? { escenario: partes[0], cancha: partes.slice(1).join(' · ') } : { escenario: '', cancha: txt }
}

const SIN_CANCHA = 'Sin cancha asignada'
const OTRAS = 'Otras canchas'
// Mismo escenario / misma cancha aunque cada torneo lo haya escrito distinto («GUADUALES» y «Guaduales», con o sin tilde)
const claveTexto = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
// De las formas en que lo escribieron, la más bonita: la que no está toda en mayúsculas; si todas lo están, se pasa a «Tipo Título»
function nombreBonito(formas) {
  const lista = [...formas]
  const conMinusculas = lista.filter(t => /[a-záéíóúñ]/.test(t))
  if (conMinusculas.length) return conMinusculas.sort((a, b) => b.length - a.length)[0]
  const t = lista[0] || ''
  return t.toLowerCase().replace(/(^|\s)(\S)/g, (m, e, l) => e + l.toUpperCase())
}

function FilaPartido({ p, miId, onPlanillar }) {
  const jugado = p.status === 'finished'
  const mio = miId && [p.arbitro1_id, p.arbitro2_id].includes(miId)
  const arbitro = (p.arbitro1 || '').trim()
  let chip
  if (jugado) chip = { t: p.tipo_resultado === 'w' ? '✓ Por W' : `✓ ${p.home_score ?? 0} - ${p.away_score ?? 0}`, c: G.muted, bg: G.soft }
  else if (mio) chip = { t: 'Tú', c: G.greenDk, bg: G.green }
  else if (arbitro || p.arbitro1_id) chip = { t: arbitro ? arbitro.split(/\s+/).slice(0, 2).join(' ') : 'Con árbitro', c: G.text2, bg: G.soft }
  else chip = { t: 'Sin árbitro', c: G.gold, bg: G.goldBg }
  // Tres renglones para que los nombres se lean completos en el celular: hora y torneo · equipos · estado y botón
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${G.border}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
        <span style={{ fontWeight: 900, fontSize: '1rem', color: jugado ? G.muted : G.text, whiteSpace: 'nowrap' }}>{p.played_at ? fmtHoraDate(p.played_at) : '—'}</span>
        <span style={{ fontSize: '.8rem', color: G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>· {p.tournaments?.name}</span>
      </div>
      <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.3, marginTop: '3px', color: jugado ? G.text2 : G.text }}>
        {p.home?.name || '?'} <span style={{ color: G.muted, fontWeight: 600 }}>vs</span> {p.away?.name || '?'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '8px' }}>
        <span style={{ fontSize: '.78rem', fontWeight: 800, color: chip.c, background: chip.bg, borderRadius: '6px', padding: '3px 9px' }}>{chip.t}</span>
        {!jugado && (
          <button onClick={() => onPlanillar(p)}
            style={{ flexShrink: 0, minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: G.green, color: G.greenDk, fontWeight: 900, fontSize: '.88rem', cursor: 'pointer' }}>
            Planillar
          </button>
        )}
      </div>
    </div>
  )
}

function Escenario({ e, abiertoInicial, miId, onPlanillar }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  // Se ven los NOMBRES de las canchas; al tocar una se abren sus partidos (una a la vez). Con una sola cancha, ya abierta.
  const [canchaAbierta, setCanchaAbierta] = useState(e.canchas.length === 1 ? e.canchas[0].clave : null)
  const total = e.canchas.reduce((n, c) => n + c.partidos.length, 0)
  const sinArbitro = e.canchas.reduce((n, c) => n + c.partidos.filter(p => p.status !== 'finished' && !p.arbitro1_id && !(p.arbitro1 || '').trim()).length, 0)
  return (
    <div style={{ background: G.card2, border: `1px solid ${G.border}`, borderRadius: '16px', marginBottom: '12px', overflow: 'hidden' }}>
      <button onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'transparent', border: 'none', color: G.text, cursor: 'pointer', textAlign: 'left', minHeight: '64px' }}>
        <span style={{ fontSize: '1.4rem' }} aria-hidden="true">🏟️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 900, fontSize: '1.08rem', lineHeight: 1.25 }}>{e.nombre}</span>
          <span style={{ display: 'block', fontSize: '.84rem', color: G.muted, marginTop: '2px' }}>
            {plural(e.canchas.length, 'cancha', 'canchas')} · {plural(total, 'partido', 'partidos')}
            {sinArbitro > 0 && <> · <b style={{ color: G.gold }}>{sinArbitro} sin árbitro</b></>}
          </span>
        </span>
        <ChevronDown size={22} color={G.muted} style={{ flexShrink: 0, transition: 'transform .15s', transform: abierto ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {abierto && (
        <div style={{ padding: '0 14px 6px' }}>
          {e.canchas.map(c => {
            const abiertaC = canchaAbierta === c.clave
            const sinArb = c.partidos.filter(p => p.status !== 'finished' && !p.arbitro1_id && !(p.arbitro1 || '').trim()).length
            return (
              <div key={c.clave} style={{ background: G.card, border: `1.5px solid ${abiertaC ? G.green : G.border}`, borderRadius: '14px', marginBottom: '10px', overflow: 'hidden' }}>
                <button onClick={() => setCanchaAbierta(k => (k === c.clave ? null : c.clave))} aria-expanded={abiertaC}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', minHeight: '58px', background: 'transparent', border: 'none', color: G.text, cursor: 'pointer', textAlign: 'left' }}>
                  <MapPin size={18} color={G.green} style={{ flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 900, fontSize: '1rem', lineHeight: 1.25 }}>{c.nombre}</span>
                    <span style={{ display: 'block', fontSize: '.8rem', color: G.muted, marginTop: '2px' }}>
                      {plural(c.partidos.length, 'partido', 'partidos')}{sinArb > 0 && <> · <b style={{ color: G.gold }}>{sinArb} sin árbitro</b></>}
                    </span>
                  </span>
                  <ChevronDown size={20} color={G.muted} style={{ flexShrink: 0, transition: 'transform .15s', transform: abiertaC ? 'rotate(180deg)' : 'none' }}/>
                </button>
                {abiertaC && (
                  <div style={{ padding: '0 14px 2px' }}>
                    {c.partidos.map(p => <FilaPartido key={p.id} p={p} miId={miId} onPlanillar={onPlanillar}/>)}
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

export default function CanchasProgramadas({ miId, onPlanillar }) {
  const [dia, setDia] = useState(diaDe())
  const clave = `arbitro_canchas_${dia}`
  const [datos, setDatos] = useState(() => leerCacheRapido(`arbitro_canchas_${diaDe()}`, 30 * 60 * 1000) || null) // { partidos, canchas }
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    let vivo = true
    setDatos(leerCacheRapido(clave, 30 * 60 * 1000) || null)
    setCargando(true)
    ;(async () => {
      const { data, error } = await supabase.from('matches').select(COLUMNAS)
        .gte('played_at', new Date(`${dia}T00:00:00-05:00`).toISOString())
        .lt('played_at', new Date(`${sumarDias(dia, 1)}T00:00:00-05:00`).toISOString())
        .order('played_at', { ascending: true })
      if (!vivo) return
      if (error) { setCargando(false); return }
      const activos = (data || []).filter(p => !p.tournaments || p.tournaments.status !== 'finished')
      const partidos = await aplicarAliasMultiTorneo(activos).catch(() => activos)
      const ids = [...new Set(partidos.map(p => p.cancha_id).filter(v => v != null && v !== ''))].map(String)
      let canchas = {}
      if (ids.length) {
        const r = await supabase.from('canchas').select('id, nombre, escenario').in('id', ids)
        ;(r.data || []).forEach(c => { canchas[String(c.id)] = c })
      }
      if (!vivo) return
      const nuevo = { partidos, canchas }
      setDatos(nuevo)
      setCargando(false)
      guardarCacheRapido(clave, nuevo)
    })()
    return () => { vivo = false }
  }, [dia]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escenario → cancha → partidos (por hora). Se agrupa sin importar mayúsculas ni tildes, así la misma cancha usada por
  // dos torneos sale junta. Una cancha que un torneo dejó SIN escenario se pone en el escenario donde otro torneo tiene
  // una cancha con ese mismo nombre (si hay uno solo); si no, va a «Otras canchas».
  const escenarios = useMemo(() => {
    const esc = new Map() // claveEsc → { formas:Set, canchas: Map(claveCancha → { formas:Set, partidos:[] }) }
    const sinEscenario = []
    ;(datos?.partidos || []).forEach(p => {
      const u = ubicar(p, datos.canchas || {})
      if (!u.escenario) { sinEscenario.push({ p, u }); return }
      const ke = u.escenario === SIN_CANCHA ? '~sin' : claveTexto(u.escenario)
      if (!esc.has(ke)) esc.set(ke, { formas: new Set(), canchas: new Map() })
      const e = esc.get(ke); e.formas.add(u.escenario)
      const kc = claveTexto(u.cancha)
      if (!e.canchas.has(kc)) e.canchas.set(kc, { formas: new Set(), partidos: [] })
      const c = e.canchas.get(kc); c.formas.add(u.cancha); c.partidos.push(p)
    })
    sinEscenario.forEach(({ p, u }) => {
      const kc = claveTexto(u.cancha)
      const donde = [...esc.entries()].filter(([ke, e]) => ke !== '~sin' && e.canchas.has(kc))
      let e
      if (donde.length === 1) e = donde[0][1]
      else {
        if (!esc.has('~otras')) esc.set('~otras', { formas: new Set([OTRAS]), canchas: new Map() })
        e = esc.get('~otras')
      }
      if (!e.canchas.has(kc)) e.canchas.set(kc, { formas: new Set(), partidos: [] })
      const c = e.canchas.get(kc); c.formas.add(u.cancha); c.partidos.push(p)
    })
    const orden = ke => (ke === '~sin' ? 2 : ke === '~otras' ? 1 : 0)
    return [...esc.entries()]
      .sort(([a, ea], [b, eb]) => orden(a) - orden(b) || natural(nombreBonito(ea.formas), nombreBonito(eb.formas)))
      .map(([ke, e]) => ({
        clave: ke,
        nombre: nombreBonito(e.formas),
        canchas: [...e.canchas.entries()]
          .map(([kc, c]) => ({ clave: kc, nombre: nombreBonito(c.formas), partidos: c.partidos.sort((a, b) => new Date(a.played_at) - new Date(b.played_at)) }))
          .sort((a, b) => natural(a.nombre, b.nombre)),
      }))
  }, [datos])

  const totalCanchas = escenarios.reduce((n, e) => n + e.canchas.length, 0)
  const totalPartidos = escenarios.reduce((n, e) => n + e.canchas.reduce((m, c) => m + c.partidos.length, 0), 0)
  const flecha = { width: '48px', height: '48px', borderRadius: '12px', border: `1px solid ${G.border}`, background: G.card2, color: G.text, fontSize: '1.3rem', cursor: 'pointer', flexShrink: 0 }

  return (
    <TarjetaPanel icono={MapPin} titulo="Canchas programadas" derecha={cargando ? 'Actualizando…' : null}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <button onClick={() => setDia(d => sumarDias(d, -1))} aria-label="Día anterior" style={flecha}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>{tituloDia(dia)}</div>
          <div style={{ fontSize: '.82rem', color: G.muted, marginTop: '2px' }}>
            {datos ? (totalPartidos ? `${plural(escenarios.length, 'escenario', 'escenarios')} · ${plural(totalCanchas, 'cancha', 'canchas')} · ${plural(totalPartidos, 'partido', 'partidos')}` : 'Sin partidos programados') : 'Cargando…'}
          </div>
        </div>
        <button onClick={() => setDia(d => sumarDias(d, 1))} aria-label="Día siguiente" style={flecha}>›</button>
      </div>
      {escenarios.map((e, i) => <Escenario key={`${dia}_${e.clave}`} e={e} abiertoInicial={escenarios.length <= 2 || i === 0} miId={miId} onPlanillar={onPlanillar}/>)}
      {datos && totalPartidos === 0 && (
        <div style={{ textAlign: 'center', color: G.muted, fontSize: '.92rem', padding: '18px 8px' }}>No hay partidos programados este día. Usa las flechas para ver otro día.</div>
      )}
    </TarjetaPanel>
  )
}
