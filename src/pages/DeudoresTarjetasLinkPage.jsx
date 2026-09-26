import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AlertTriangle, CheckCircle2, Lock, RefreshCw, Shield } from 'lucide-react'

// Entrada pública (con contraseña si el torneo la tiene puesta) para ver
// quién debe tarjeta en un torneo, filtrar por equipo y registrar el pago
// ahí mismo — el link es fijo por torneo (no vence, se genera UNA sola vez)
// y lo genera el organizador desde Finanzas del torneo ("Link deudores de
// tarjetas"), donde también le pone/cambia la contraseña. El árbitro ya NO
// puede desbloquear/cobrar tarjetas desde la planilla — esto reemplaza esa
// función para quien el organizador decida darle el link y la contraseña
// (él mismo, un colaborador, un capitán de equipo, etc).
//
// La contraseña se pide UNA vez por celular/navegador (queda guardada en
// localStorage de ESE dispositivo) — si se abre desde uno nuevo, se vuelve
// a pedir. Como el mismo link se reutiliza todo el torneo, cada vez que se
// abre (o se toca "Actualizar", o pasan 30s con la página abierta) se
// vuelve a calcular todo desde cero.
const S = {
  navy: '#07070e', card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', loss: '#d93025', green: '#22c55e', gold: '#f9a825',
}
const inp = { background: S.card2, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '9px 12px', color: S.text, fontSize: '.85rem', outline: 'none', fontFamily: 'system-ui,sans-serif' }
const iconoTipo = { Amarilla: '🟨', Azul: '🟦', Roja: '🟥' }

function fmt(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }
function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' }) + ' · ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
function diaKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtDia(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function DeudoresTarjetasLinkPage() {
  const { token } = useParams()
  const claveLocal = `deudores_pw_${token}`

  const [verificando, setVerificando] = useState(true)
  const [necesitaPassword, setNecesitaPassword] = useState(false)
  const [password, setPassword] = useState(null) // password ya validada (o null si el torneo no tiene)
  const [passwordInput, setPasswordInput] = useState('')
  const [errorPassword, setErrorPassword] = useState('')
  const [entrando, setEntrando] = useState(false)

  const [tab, setTab] = useState('deben')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [historial, setHistorial] = useState([])
  const [equipoFiltro, setEquipoFiltro] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagando, setPagando] = useState(null) // player_id en proceso
  const [msg, setMsg] = useState(null)
  const [actualizando, setActualizando] = useState(false)
  const primeraCarga = useRef(true)

  // ── Paso 1: ¿este torneo pide contraseña? ───────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: requiere, error: err } = await supabase.rpc('link_deudores_requiere_password', { p_token: token })
      if (err) { setError(err.message === 'Link inválido' ? 'Este link no es válido.' : 'No se pudo cargar la información.'); setVerificando(false); return }
      if (!requiere) { setVerificando(false); return } // sin contraseña, entra directo
      const guardada = (() => { try { return localStorage.getItem(claveLocal) } catch { return null } })()
      if (guardada) {
        // Ya se validó antes en este mismo celular — se usa directo, y si
        // resulta que cambiaron la contraseña mientras tanto, cargar() lo
        // detecta (error "Contraseña incorrecta") y manda de vuelta acá.
        setPassword(guardada)
      } else {
        setNecesitaPassword(true)
      }
      setVerificando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (verificando || necesitaPassword) return
    cargar()
    // Auto-refresco cada 30s mientras la página quede abierta — así, si un
    // partido termina y se registran tarjetas mientras alguien la tiene
    // abierta, no hace falta que la recargue a mano para verlo.
    const intervalo = setInterval(() => cargar(true), 30000)
    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificando, necesitaPassword, password])

  async function handleEntrarConPassword() {
    if (!passwordInput.trim()) return
    setEntrando(true); setErrorPassword('')
    const { data: ok, error: err } = await supabase.rpc('verificar_password_deudores', { p_token: token, p_password: passwordInput })
    setEntrando(false)
    if (err) { setErrorPassword(err.message === 'Link inválido' ? 'Este link no es válido.' : 'No se pudo verificar la contraseña.'); return }
    if (!ok) { setErrorPassword('Contraseña incorrecta.'); return }
    try { localStorage.setItem(claveLocal, passwordInput) } catch { /* si el navegador bloquea localStorage, vuelve a pedirla la próxima vez — no es grave */ }
    setPassword(passwordInput)
    setNecesitaPassword(false)
  }

  async function cargar(silencioso = false) {
    if (primeraCarga.current) setCargando(true)
    else if (silencioso) setActualizando(true)
    setError('')
    const [{ data: res, error: err }, { data: hist, error: errHist }] = await Promise.all([
      supabase.rpc('ver_deudores_por_link', { p_token: token, p_password: password }),
      supabase.rpc('ver_historial_pagos_tarjetas_por_link', { p_token: token, p_password: password }),
    ])
    const errContrasena = [err, errHist].find(e => e?.message === 'Contraseña incorrecta')
    if (errContrasena) {
      // La contraseña guardada en este celular ya no sirve (la cambiaron) —
      // se borra y se le vuelve a pedir.
      try { localStorage.removeItem(claveLocal) } catch { /* no hay nada que limpiar si ya fallaba */ }
      setPassword(null)
      setNecesitaPassword(true)
      setCargando(false); setActualizando(false)
      return
    }
    if (err || !res) {
      setError(err?.message === 'Link inválido' ? 'Este link no es válido.' : 'No se pudo cargar la información.')
      setData(null)
    } else {
      setData(res)
      setHistorial(hist || [])
    }
    setCargando(false)
    setActualizando(false)
    primeraCarga.current = false
  }

  function showMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo })
    setTimeout(() => setMsg(null), 3500)
  }

  async function pagar(deudor) {
    if (!confirm(`¿${deudor.nombre} ya pagó ${fmt(deudor.total)} en tarjetas? Esto lo desbloquea de una vez en la planilla.`)) return
    setPagando(deudor.player_id)
    const { data: res, error: err } = await supabase.rpc('pagar_tarjeta_por_link', { p_token: token, p_player_id: deudor.player_id, p_password: password })
    setPagando(null)
    if (err || !res) { showMsg(err?.message || 'No se pudo registrar el pago', 'error'); return }
    showMsg(`Pago de ${deudor.nombre} registrado ✓`)
    cargar()
  }

  const deudores = data?.deudores || []
  const equipos = data?.equipos || []
  const filtrados = equipoFiltro ? deudores.filter(d => d.team_id === equipoFiltro) : deudores
  const totalGeneral = useMemo(() => filtrados.reduce((a, d) => a + (d.total || 0), 0), [filtrados])

  const historialFiltrado = useMemo(() => historial.filter(h => {
    if (equipoFiltro && !(data?.equipos || []).some(e => e.id === equipoFiltro && e.nombre === h.equipo)) return false
    const dia = diaKey(h.fecha)
    if (desde && dia < desde) return false
    if (hasta && dia > hasta) return false
    return true
  }), [historial, equipoFiltro, desde, hasta, data])

  const totalPagado = useMemo(() => historialFiltrado.reduce((a, h) => a + (h.monto || 0), 0), [historialFiltrado])
  const totalTarjetas = useMemo(() => historialFiltrado.reduce((a, h) => a + (h.tarjetas || 1), 0), [historialFiltrado])

  // Cuadre día por día — para saber cuánta plata le toca entregar por día a
  // quien esté cobrando desde este link.
  const porDia = useMemo(() => {
    const mapa = {}
    historialFiltrado.forEach(h => {
      const key = diaKey(h.fecha)
      if (!mapa[key]) mapa[key] = { key, total: 0, pagos: 0, tarjetas: 0 }
      mapa[key].total += h.monto || 0
      mapa[key].pagos += 1
      mapa[key].tarjetas += h.tarjetas || 1
    })
    return Object.values(mapa).sort((a, b) => b.key.localeCompare(a.key))
  }, [historialFiltrado])

  const wrap = { minHeight: '100vh', background: S.navy, fontFamily: 'system-ui,sans-serif', color: S.text, padding: '20px 16px 60px' }

  if (verificando) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted }}>Cargando...</div>
    </div>
  )

  if (error) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '320px' }}>
        <AlertTriangle size={32} color={S.loss}/>
        <div style={{ marginTop: '10px', fontWeight: 700 }}>{error}</div>
      </div>
    </div>
  )

  if (necesitaPassword) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '320px', background: S.card, border: `1px solid ${S.border}`, borderRadius: '16px', padding: '26px', textAlign: 'center' }}>
        <Lock size={28} color={S.gold}/>
        <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '10px', marginBottom: '4px' }}>Este link es privado</div>
        <div style={{ fontSize: '.78rem', color: S.muted, marginBottom: '18px' }}>Escribe la contraseña que te dio el organizador.</div>
        <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus
          onKeyDown={e => e.key === 'Enter' && handleEntrarConPassword()}
          placeholder="Contraseña" style={{ ...inp, width: '100%', boxSizing: 'border-box', textAlign: 'center', marginBottom: '10px' }}/>
        {errorPassword && <div style={{ fontSize: '.76rem', color: '#ff6b5e', marginBottom: '10px' }}>{errorPassword}</div>}
        <button onClick={handleEntrarConPassword} disabled={entrando || !passwordInput.trim()}
          style={{ width: '100%', padding: '11px', background: S.gold, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#1a1a1a', fontWeight: 800, fontSize: '.85rem', opacity: entrando || !passwordInput.trim() ? .6 : 1 }}>
          {entrando ? 'Verificando...' : 'Entrar'}
        </button>
      </div>
    </div>
  )

  if (cargando) return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted }}>Cargando deudores de tarjetas...</div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: S.gold }}>
            <Shield size={18}/><span style={{ fontWeight: 800, fontSize: '.85rem' }}>Tarjetas del torneo</span>
          </div>
          <button onClick={() => cargar(true)} disabled={actualizando} title="Volver a calcular ahora mismo"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '5px 10px', color: S.text2, fontSize: '.72rem', fontWeight: '700', cursor: 'pointer' }}>
            <RefreshCw size={12} style={actualizando ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
        </div>
        <style>{'@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }'}</style>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: '16px' }}>{data.torneo}</div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={() => setTab('deben')}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '.78rem', background: tab === 'deben' ? S.loss : S.card2, color: tab === 'deben' ? '#fff' : S.text2 }}>
            ⚠️ Deben ({deudores.length})
          </button>
          <button onClick={() => setTab('historial')}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '.78rem', background: tab === 'historial' ? S.green : S.card2, color: tab === 'historial' ? '#07070e' : S.text2 }}>
            ✓ Historial y cuadre ({historial.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          <select value={equipoFiltro} onChange={e => setEquipoFiltro(e.target.value)} style={{ ...inp, flex: 1, minWidth: '160px' }}>
            <option value="">Todos los equipos</option>
            {equipos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          {tab === 'historial' && (
            <>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...inp, minWidth: '135px' }} title="Desde"/>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...inp, minWidth: '135px' }} title="Hasta"/>
            </>
          )}
        </div>

        <div style={{ fontSize: '.8rem', color: S.text2, marginBottom: '14px' }}>
          {tab === 'deben'
            ? <>{filtrados.length} jugador{filtrados.length !== 1 ? 'es' : ''} · Total que deben <b style={{ color: S.loss }}>{fmt(totalGeneral)}</b></>
            : <>{historialFiltrado.length} pago{historialFiltrado.length !== 1 ? 's' : ''} · {totalTarjetas} tarjeta{totalTarjetas !== 1 ? 's' : ''} · Total recogido <b style={{ color: S.green }}>{fmt(totalPagado)}</b></>}
        </div>

        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '.82rem', fontWeight: 700,
            background: msg.tipo === 'error' ? 'rgba(217,48,37,.15)' : 'rgba(34,197,94,.15)',
            color: msg.tipo === 'error' ? '#ff6b5e' : S.green, border: `1px solid ${msg.tipo === 'error' ? 'rgba(217,48,37,.4)' : 'rgba(34,197,94,.4)'}` }}>
            {msg.texto}
          </div>
        )}

        {tab === 'deben' ? (
          filtrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: S.muted }}>
              <CheckCircle2 size={32} color={S.green}/>
              <div style={{ marginTop: '10px', fontWeight: 700 }}>Nadie debe tarjetas{equipoFiltro ? ' en este equipo' : ''} 🎉</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtrados.map(d => (
                <div key={d.player_id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{d.nombre}</div>
                      <div style={{ fontSize: '.72rem', color: S.muted }}>{d.equipo || 'Sin equipo'}</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem', color: S.loss, whiteSpace: 'nowrap' }}>{fmt(d.total)}</div>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {(d.items || []).map((it, i) => (
                      <div key={i} style={{ fontSize: '.74rem', color: S.text2 }}>
                        {(it.tiposDelPartido || [it.tipo]).map(t => iconoTipo[t] || '🃏').join(' ')} {(it.tiposDelPartido || [it.tipo]).join(' + ')}
                        {(it.home || it.away) && <span style={{ color: S.muted }}> · {it.home || '?'} vs {it.away || '?'}</span>}
                        {it.cancha && <span style={{ color: S.muted }}> · cancha {it.cancha}</span>}
                        {it.fecha && <span style={{ color: S.muted }}> · {new Date(it.fecha).toLocaleDateString('es-CO')}</span>}
                        <span style={{ fontWeight: 700 }}> · {fmt(it.monto)}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => pagar(d)} disabled={pagando === d.player_id}
                    style={{ marginTop: '12px', width: '100%', padding: '10px', background: S.green, border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#07070e', fontWeight: 800, fontSize: '.82rem', opacity: pagando === d.player_id ? .6 : 1 }}>
                    {pagando === d.player_id ? 'Registrando...' : '✓ Ya pagó — Marcar como pagado'}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {porDia.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '.72rem', fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Cuadre por día</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {porDia.map(d => (
                    <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: S.card, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '10px 14px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '.82rem', textTransform: 'capitalize' }}>{fmtDia(d.key)}</div>
                        <div style={{ fontSize: '.7rem', color: S.muted }}>{d.pagos} pago{d.pagos !== 1 ? 's' : ''} · {d.tarjetas} tarjeta{d.tarjetas !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '.95rem', color: S.green, whiteSpace: 'nowrap' }}>{fmt(d.total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: '.72rem', fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Detalle de cada pago</div>
            {historialFiltrado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: S.muted }}>
                <div style={{ fontWeight: 700 }}>No hay pagos de tarjetas en este rango{equipoFiltro ? '/equipo' : ''}.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historialFiltrado.map(h => (
                  <div key={h.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '14px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{h.jugador}</div>
                        <div style={{ fontSize: '.72rem', color: S.muted }}>{h.equipo || 'Sin equipo'}</div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '1.05rem', color: S.green, whiteSpace: 'nowrap' }}>{fmt(h.monto)}</div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '.72rem', color: S.muted }}>📅 {fmtFechaHora(h.fecha)}</div>
                    {h.concepto && <div style={{ marginTop: '6px', fontSize: '.74rem', color: S.text2, lineHeight: 1.4 }}>{h.concepto}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
