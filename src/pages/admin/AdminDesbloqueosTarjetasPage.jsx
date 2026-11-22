import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Gift, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { errorAmigable } from '../../lib/mensajesError'
import { confirmar } from '../../lib/confirmar'
import { notify } from '../../lib/notify'
import { urlMini, alFallarMini } from '../../lib/imagenMini'
import { CLAVE_VISTO_DESBLOQUEOS, PLAZO_PREMIO_MS, estadoPremio } from '../../lib/desbloqueosTarjetas'

// ─────────────────────────────────────────────────────────────────────────────
// DESBLOQUEO DE TARJETAS (solo el administrador de la plataforma)
//  · Quién desbloqueó qué tarjeta y CUÁNDO (fecha y hora).
//  · REGLA: con 3 de los 5 logros de una tarjeta se desbloquea la siguiente; con LOS 5 gana el premio de esa
//    tarjeta y tiene 3 días (72 h) para reclamarlo desde su tarjeta, mandando el pantallazo por el chat.
//    Aquí se ve si lo reclamó, si ya se le entregó o si se venció.
//  · "En qué va cada jugador": la tarjeta más alta de cada uno.
//  · Qué tarjetas dan premio (se prende / apaga por tarjeta).
//  · Al celular del administrador le llega un aviso cada vez que alguien desbloquea
//    (ver migracion_desbloqueo_tarjetas.sql y api/push-enviar.js, tipo 'tarjeta').
// ─────────────────────────────────────────────────────────────────────────────

const AZUL = '#1a73e8', VERDE = '#1e8e3e', ROJO = '#d93025', NARANJA = '#e37400', GRIS = '#5f6368'
const COLORES_TARJETA = {
  '11111111-0000-0000-0000-000000000001': '#00a63a',
  '11111111-0000-0000-0000-000000000002': '#2e6bff',
  '11111111-0000-0000-0000-000000000003': '#8a3ffc',
  '11111111-0000-0000-0000-000000000004': '#c98a00',
}
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const fmtFechaHora = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })
const fmtCorta = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })

// Lo último que pasó con esa tarjeta: la desbloqueó o rompió sus 5 logros
const ultimaNovedad = d => Math.max(Date.parse(d.fecha) || 0, Date.parse(d.completa) || 0)

function leerVisto() { try { return Number(window.localStorage.getItem(CLAVE_VISTO_DESBLOQUEOS)) || 0 } catch { return 0 } }

function quedaTexto(fecha, ahora) {
  const ms = (Date.parse(fecha) || 0) + PLAZO_PREMIO_MS - ahora
  if (ms <= 0) return 'se venció'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? `le quedan ${d} d ${h} h` : `le quedan ${Math.max(1, h)} h`
}

function Pastilla({ children, bg, color }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '.74rem', fontWeight: 800, padding: '5px 10px', borderRadius: '999px', background: bg, color, lineHeight: 1.25 }}>{children}</span>
}

function Foto({ url, nombre }) {
  const ini = (nombre || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: GRIS, fontWeight: 800 }}>
      {url ? <img src={urlMini(url, 46)} onError={alFallarMini} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : ini}
    </div>
  )
}

const FILTROS = [
  { id: 'atender',   texto: 'Por atender' },
  { id: 'todos',     texto: 'Todos' },
  { id: 'entregado', texto: 'Entregados' },
  { id: 'vencido',   texto: 'Vencidos' },
]

export default function AdminDesbloqueosTarjetasPage() {
  const navigate = useNavigate()
  const [filas, setFilas] = useState(null)
  const [tarjetas, setTarjetas] = useState([])
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('atender')
  const [vista, setVista] = useState('desbloqueos') // 'desbloqueos' | 'jugadores' | 'premios'
  const [buscar, setBuscar] = useState('')
  const [guardando, setGuardando] = useState(null)
  const [vistoAntes] = useState(leerVisto) // para marcar "NUEVO" lo que llegó desde la última visita
  const [ahora, setAhora] = useState(() => Date.now())

  async function cargar() {
    setError('')
    const [r, c] = await Promise.all([
      supabase.rpc('admin_desbloqueos_tarjetas'),
      supabase.from('cards').select('*').order('orden'),
    ])
    if (r.error) {
      const falta = r.error.code === 'PGRST202' || r.error.code === '42883' || /could not find the function|does not exist/i.test(r.error.message || '')
      setError(falta ? 'Falta activar esta pestaña: corre el archivo migracion_desbloqueo_tarjetas.sql en Supabase → SQL Editor.' : errorAmigable(r.error, 'No se pudieron cargar los desbloqueos'))
      setFilas([])
      return
    }
    setFilas(Array.isArray(r.data) ? r.data : [])
    setTarjetas(c.data || [])
    setAhora(Date.now())
  }

  useEffect(() => {
    const t = setTimeout(cargar, 0)
    // Ya se vio: el número rojo del menú se baja (lo que sigue "por entregar" sigue contando)
    try { window.localStorage.setItem(CLAVE_VISTO_DESBLOQUEOS, String(Date.now())) } catch { /* modo privado */ }
    window.dispatchEvent(new Event('gm-desbloqueos-visto'))
    return () => clearTimeout(t)
  }, [])

  const lista = useMemo(() => filas || [], [filas])
  const conteo = useMemo(() => {
    const c = { nuevos: 0, en_plazo: 0, reclamado: 0, entregado: 0, vencido: 0 }
    lista.forEach(d => {
      const e = estadoPremio(d, ahora)
      if (c[e] != null) c[e]++
      if (ultimaNovedad(d) > vistoAntes) c.nuevos++
    })
    return c
  }, [lista, ahora, vistoAntes])

  const visibles = useMemo(() => {
    const q = sinTildes(buscar.trim())
    return lista.filter(d => {
      if (q && !sinTildes(`${d.jugador} ${d.tarjeta} ${d.nivel}`).includes(q)) return false
      const e = estadoPremio(d, ahora)
      if (filtro === 'atender') return e === 'reclamado' || e === 'en_plazo' || ultimaNovedad(d) > vistoAntes
      if (filtro === 'entregado') return e === 'entregado'
      if (filtro === 'vencido') return e === 'vencido'
      return true
    })
  }, [lista, filtro, buscar, ahora, vistoAntes])

  // En qué va cada jugador: su tarjeta más alta (por orden de tarjeta y subnivel)
  const porJugador = useMemo(() => {
    const m = new Map()
    lista.forEach(d => {
      const peso = (Number(d.orden) || 0) * 100 + (Number(d.subnivel) || 0)
      const a = m.get(d.player_id)
      if (!a) m.set(d.player_id, { ...d, peso, total: 1 })
      else if (peso > a.peso) m.set(d.player_id, { ...d, peso, total: a.total + 1 })
      else a.total++
    })
    const q = sinTildes(buscar.trim())
    return [...m.values()].filter(j => !q || sinTildes(j.jugador).includes(q))
      .sort((a, b) => b.peso - a.peso || (Date.parse(a.fecha) || 0) - (Date.parse(b.fecha) || 0))
  }, [lista, buscar])

  async function marcarEntregado(d, entregado) {
    if (entregado && !(await confirmar(`¿Ya le entregaste el premio a ${d.jugador} por la tarjeta ${d.tarjeta} · ${d.nivel}?`))) return
    setGuardando(d.player_id + d.card_level_id)
    const { error: e } = await supabase.rpc('admin_marcar_premio_tarjeta', { p_player_id: d.player_id, p_card_level_id: d.card_level_id, p_entregado: entregado })
    setGuardando(null)
    if (e) return notify(errorAmigable(e, 'No se pudo guardar'), 'error')
    notify(entregado ? 'Premio marcado como entregado ✓' : 'Se quitó la marca de entregado')
    cargar()
  }

  async function cambiarPremio(card, valor) {
    setGuardando('card' + card.id)
    const { error: e } = await supabase.rpc('admin_tarjeta_da_premio', { p_card_id: String(card.id), p_da_premio: valor })
    setGuardando(null)
    if (e) return notify(errorAmigable(e, 'No se pudo guardar'), 'error')
    notify(valor ? `${card.nombre} ahora da premio ✓` : `${card.nombre} ya no da premio`)
    cargar()
  }

  const boton = activo => ({ flex: '1 1 0', minHeight: '46px', padding: '4px 8px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontSize: '.8rem', fontWeight: 800, lineHeight: 1.2, background: activo ? '#fff' : 'transparent', color: activo ? AZUL : GRIS, boxShadow: activo ? '0 1px 4px rgba(0,0,0,.12)' : 'none', fontFamily: 'inherit' })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 14px 90px', color: '#202124' }}>
      <button type="button" onClick={() => navigate('/admin')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '42px', padding: '0 14px', border: '1.5px solid #dadce0', borderRadius: '10px', background: '#fff', color: '#3c4043', fontWeight: 800, fontSize: '.88rem', cursor: 'pointer', marginBottom: '12px', fontFamily: 'inherit' }}>
        <ArrowLeft size={16}/> Volver
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Gift size={26} color={AZUL}/>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900 }}>Desbloqueo de tarjetas</h1>
        <button type="button" onClick={cargar} title="Actualizar" aria-label="Actualizar"
          style={{ marginLeft: 'auto', width: 42, height: 42, borderRadius: 10, border: '1.5px solid #dadce0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={16} color={GRIS}/>
        </button>
      </div>
      <p style={{ margin: '6px 0 14px', color: GRIS, fontSize: '.88rem', lineHeight: 1.45 }}>
        Con <b>3 de 5 logros</b> el jugador desbloquea la tarjeta siguiente. Con <b>los 5 logros</b> gana el premio de esa tarjeta
        y tiene <b>3 días</b> para reclamarlo mandando el pantallazo por el chat. Cuando se lo entregues, toca <b>Marcar entregado</b>.
      </p>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginBottom: '14px' }}>
        {[
          { t: 'Nuevos desde tu última visita', n: conteo.nuevos, c: AZUL },
          { t: 'Reclamaron: por entregar', n: conteo.reclamado, c: VERDE },
          { t: 'Ganaron premio, sin reclamar', n: conteo.en_plazo, c: NARANJA },
          { t: 'Premios vencidos', n: conteo.vencido, c: ROJO },
        ].map(x => (
          <div key={x.t} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '10px 12px' }}>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: x.c, lineHeight: 1 }}>{filas === null ? '–' : x.n}</div>
            <div style={{ fontSize: '.74rem', color: GRIS, fontWeight: 700, marginTop: '4px', lineHeight: 1.25 }}>{x.t}</div>
          </div>
        ))}
      </div>

      {/* Qué ver */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f3f4', borderRadius: '14px', padding: '4px', marginBottom: '12px' }}>
        <button type="button" onClick={() => setVista('desbloqueos')} style={boton(vista === 'desbloqueos')}>Desbloqueos</button>
        <button type="button" onClick={() => setVista('jugadores')} style={boton(vista === 'jugadores')}>En qué va cada jugador</button>
        <button type="button" onClick={() => setVista('premios')} style={boton(vista === 'premios')}>Qué tarjetas dan premio</button>
      </div>

      {vista !== 'premios' && (
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search size={16} color="#9aa0a6" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}/>
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar jugador o tarjeta"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: '48px', padding: '0 14px 0 36px', border: '1.5px solid #dadce0', borderRadius: '12px', fontSize: '1rem', outline: 'none', fontFamily: 'inherit' }}/>
        </div>
      )}

      {error && <div style={{ background: '#fce8e6', color: ROJO, borderRadius: '12px', padding: '12px 14px', fontWeight: 700, fontSize: '.86rem', marginBottom: '12px' }}>{error}</div>}
      {filas === null && <div style={{ textAlign: 'center', color: GRIS, padding: '30px' }}>Cargando…</div>}

      {/* ── DESBLOQUEOS ── */}
      {vista === 'desbloqueos' && filas !== null && (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {FILTROS.map(f => (
              <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
                style={{ minHeight: '40px', padding: '0 14px', borderRadius: '999px', border: `1.5px solid ${filtro === f.id ? AZUL : '#dadce0'}`, background: filtro === f.id ? '#e8f0fe' : '#fff', color: filtro === f.id ? AZUL : '#3c4043', fontWeight: 800, fontSize: '.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                {f.texto}
              </button>
            ))}
          </div>
          {visibles.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '26px', textAlign: 'center', color: GRIS, fontSize: '.9rem' }}>
              {filtro === 'atender' ? 'No hay nada pendiente por ahora ✓' : 'No hay desbloqueos para mostrar.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibles.map(d => {
              const e = estadoPremio(d, ahora)
              const nuevo = ultimaNovedad(d) > vistoAntes
              const color = COLORES_TARJETA[d.card_id] || AZUL
              const ocupado = guardando === d.player_id + d.card_level_id
              return (
                <div key={d.player_id + d.card_level_id} style={{ background: '#fff', border: `1px solid ${nuevo ? AZUL : '#e8eaed'}`, borderRadius: '14px', padding: '12px', boxShadow: nuevo ? '0 0 0 2px #e8f0fe' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Foto url={d.foto} nombre={d.jugador}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '.98rem' }}>{d.jugador}</span>
                        {nuevo && <Pastilla bg={AZUL} color="#fff">NUEVO</Pastilla>}
                      </div>
                      <div style={{ fontSize: '.84rem', fontWeight: 800, color }}>{d.tarjeta} · {d.nivel}</div>
                      <div style={{ fontSize: '.76rem', color: GRIS, marginTop: '2px' }}>Desbloqueó: {d.fecha ? fmtFechaHora.format(new Date(d.fecha)) : 'desde el inicio'}</div>
                      {d.completa && <div style={{ fontSize: '.76rem', color: '#b06000', fontWeight: 700 }}>Rompió los 5 logros: {fmtFechaHora.format(new Date(d.completa))}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {e === 'sin_premio' && <Pastilla bg="#f1f3f4" color={GRIS}>Esta tarjeta no da premio</Pastilla>}
                    {e === 'entregado' && <Pastilla bg="#e6f4ea" color={VERDE}>✓ Premio entregado el {fmtCorta.format(new Date(d.entregado))}</Pastilla>}
                    {e === 'reclamado' && <Pastilla bg="#e6f4ea" color={VERDE}>📸 Reclamó el {fmtCorta.format(new Date(d.reclamado))} · revisa el chat</Pastilla>}
                    {e === 'sin_completar' && <Pastilla bg="#f1f3f4" color={GRIS}>🔓 Lleva {Math.min(5, Number(d.logros) || 0)} de 5 logros · el premio es con los 5</Pastilla>}
                    {e === 'en_plazo' && <Pastilla bg="#fef7e0" color={NARANJA}>🎁 Ganó el premio · no ha reclamado · {quedaTexto(d.completa, ahora)}</Pastilla>}
                    {e === 'vencido' && <Pastilla bg="#fce8e6" color={ROJO}>⌛ Se venció: no reclamó en 3 días</Pastilla>}
                    {(e === 'reclamado' || e === 'en_plazo') && (
                      <button type="button" disabled={ocupado} onClick={() => marcarEntregado(d, true)}
                        style={{ marginLeft: 'auto', minHeight: '44px', padding: '0 16px', border: 'none', borderRadius: '10px', background: VERDE, color: '#fff', fontWeight: 800, fontSize: '.84rem', cursor: 'pointer', opacity: ocupado ? .6 : 1, fontFamily: 'inherit' }}>
                        {ocupado ? 'Guardando…' : '✓ Marcar entregado'}
                      </button>
                    )}
                    {e === 'entregado' && (
                      <button type="button" disabled={ocupado} onClick={() => marcarEntregado(d, false)}
                        style={{ marginLeft: 'auto', minHeight: '40px', padding: '0 12px', border: '1.5px solid #dadce0', borderRadius: '10px', background: '#fff', color: GRIS, fontWeight: 700, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Quitar entregado
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── EN QUÉ VA CADA JUGADOR ── */}
      {vista === 'jugadores' && filas !== null && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden' }}>
          {porJugador.length === 0 && <div style={{ padding: '26px', textAlign: 'center', color: GRIS }}>Todavía nadie ha desbloqueado tarjetas.</div>}
          {porJugador.map((j, i) => (
            <div key={j.player_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderTop: i ? '1px solid #f1f3f4' : 'none' }}>
              <div style={{ width: 24, textAlign: 'center', fontWeight: 800, color: '#9aa0a6', fontSize: '.82rem' }}>{i + 1}</div>
              <Foto url={j.foto} nombre={j.jugador}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.92rem' }}>{j.jugador}</div>
                <div style={{ fontSize: '.82rem', fontWeight: 800, color: COLORES_TARJETA[j.card_id] || AZUL }}>Va en: {j.tarjeta} · {j.nivel}</div>
                <div style={{ fontSize: '.74rem', color: GRIS }}>{j.total} tarjeta{j.total === 1 ? '' : 's'} desbloqueada{j.total === 1 ? '' : 's'} · la más alta el {j.fecha ? fmtCorta.format(new Date(j.fecha)) : '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── QUÉ TARJETAS DAN PREMIO ── */}
      {vista === 'premios' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', fontSize: '.84rem', color: GRIS, lineHeight: 1.45, borderBottom: '1px solid #f1f3f4' }}>
            Si una tarjeta <b>da premio</b>, cuando el jugador rompe sus 5 logros le sale en su perfil <b>"Reclama tu premio"</b> con 3 días de plazo.
          </div>
          {tarjetas.map((c, i) => {
            const da = c.da_premio !== false
            const ocupado = guardando === 'card' + c.id
            const sinColumna = c.da_premio === undefined
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderTop: i ? '1px solid #f1f3f4' : 'none' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLORES_TARJETA[c.id] || c.color || AZUL, flexShrink: 0 }}/>
                <span style={{ flex: 1, fontWeight: 800 }}>{c.nombre}</span>
                <button type="button" disabled={ocupado || sinColumna} onClick={() => cambiarPremio(c, !da)} aria-pressed={da}
                  title={sinColumna ? 'Primero corre migracion_desbloqueo_tarjetas.sql en Supabase' : undefined}
                  style={{ minHeight: '42px', minWidth: '124px', padding: '0 12px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '.82rem', background: da ? '#e6f4ea' : '#f1f3f4', color: da ? VERDE : GRIS, opacity: ocupado ? .6 : 1, fontFamily: 'inherit' }}>
                  {da ? '🎁 Da premio' : 'Sin premio'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
