import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Lock, RefreshCw, Search } from 'lucide-react'
import { armarCuentaEquipo } from '../lib/finanzasEquipo'

// LINK DE FINANZAS PARA LOS EQUIPOS (público, sin login, no vence).
// El organizador lo genera UNA vez en Finanzas del torneo ("Link para equipos") y se lo manda a todos.
// Cualquiera ve la lista de equipos, pero para entrar a UNO hay que escribir la cédula del representante
// (dueño) de ESE equipo: esa es la contraseña. La cédula se compara en la base de datos (nunca llega al
// celular) y cada ingreso queda anotado para que el organizador vea quién entró y cuándo.
// La cédula se recuerda en ESE celular para no pedirla cada vez (botón "Salir" la olvida).

const S = {
  navy: '#07070e', card: '#111827', card2: '#1a2234', border: '#1e2d3d',
  text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5', red: '#ff6b61', green: '#22c55e', gold: '#f9a825',
}
const NOTA_PAGO = 'Si hiciste el pago el mismo día de tu partido y todavía no aparece registrado, revisa de nuevo el martes después de la 1:00 p. m. Ahí ya aparece el registro del pago, porque se hizo el día que jugaste.'
const TZ = 'America/Bogota'

const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CO')
function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }) + ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}
function fmtSoloDia(iso) {
  if (!iso) return 'Sin fecha'
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })
}
function claveDia(iso) {
  if (!iso) return 'sin'
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}

const MENSAJES = {
  incorrecta: 'Cédula incorrecta. Escribe la cédula del representante (dueño) del equipo, solo números.',
  bloqueado: 'Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentar.',
  sin_cedula: 'Este equipo no tiene la cédula del representante registrada. Pídele al organizador que la agregue.',
  equipo: 'No encontramos ese equipo en el torneo.',
}

function Escudo({ url, nombre, size = 44 }) {
  const [falla, setFalla] = useState(false)
  if (url && !falla) return <img src={url} alt="" onError={() => setFalla(true)} style={{ width: size, height: size, borderRadius: size / 4, objectFit: 'contain', background: '#fff', padding: 3, boxSizing: 'border-box', flexShrink: 0 }}/>
  return <div style={{ width: size, height: size, borderRadius: size / 4, background: S.card2, border: `1px solid ${S.border}`, color: S.muted, fontWeight: 800, fontSize: size * 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(nombre || '?').trim().charAt(0).toUpperCase()}</div>
}

function NotaPago() {
  return (
    <div style={{ background: 'rgba(249,168,37,.12)', border: `1px solid ${S.gold}`, borderRadius: 12, padding: '12px 14px', color: '#ffe3a3', fontSize: '.8rem', lineHeight: 1.5 }}>
      📌 <b>Nota:</b> {NOTA_PAGO}
    </div>
  )
}

export default function FinanzasEquiposLinkPage() {
  const { token } = useParams()
  const claveLocal = equipoId => `finanzas_ced_${token}_${equipoId}`

  const [info, setInfo] = useState(null) // { torneo, equipos }
  const [errorLink, setErrorLink] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [equipo, setEquipo] = useState(null)       // equipo elegido en la lista
  const [cedula, setCedula] = useState('')
  const [errorCedula, setErrorCedula] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [datos, setDatos] = useState(null)         // respuesta de finanzas_equipo_ver
  const [actualizando, setActualizando] = useState(false)
  const [filtro, setFiltro] = useState('todos')    // todos | cargos | pagos

  useEffect(() => {
    document.title = 'Finanzas del torneo · Golmebol'
    let vivo = true
    supabase.rpc('finanzas_link_info', { p_token: token }).then(({ data, error }) => {
      if (!vivo) return
      if (error || !data) setErrorLink('Este link no es válido o ya no está disponible. Pídele uno nuevo al organizador.')
      else setInfo(data)
    })
    return () => { vivo = false }
  }, [token])

  const entrar = useCallback(async (eq, ced, { silencioso = false } = {}) => {
    if (!silencioso) { setEntrando(true); setErrorCedula('') }
    try {
      const { data, error } = await supabase.rpc('finanzas_equipo_ver', { p_token: token, p_team_id: eq.id, p_cedula: ced })
      if (error) throw error
      if (!data?.ok) {
        try { localStorage.removeItem(claveLocal(eq.id)) } catch { /* sin almacenamiento */ }
        setDatos(null)
        setErrorCedula(MENSAJES[data?.error] || 'No se pudo entrar. Intenta de nuevo.')
        return false
      }
      try { localStorage.setItem(claveLocal(eq.id), ced) } catch { /* sin almacenamiento */ }
      setDatos(data)
      return true
    } catch {
      setErrorCedula('No se pudo conectar. Revisa tu internet e intenta de nuevo.')
      return false
    } finally {
      if (!silencioso) setEntrando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function elegirEquipo(eq) {
    setEquipo(eq); setCedula(''); setErrorCedula(''); setDatos(null); setFiltro('todos')
    let guardada = ''
    try { guardada = localStorage.getItem(claveLocal(eq.id)) || '' } catch { /* sin almacenamiento */ }
    if (guardada) entrar(eq, guardada) // ya había entrado desde este celular: entra directo
  }

  function volver() {
    setEquipo(null); setDatos(null); setCedula(''); setErrorCedula('')
  }
  function salir() {
    if (equipo) { try { localStorage.removeItem(claveLocal(equipo.id)) } catch { /* sin almacenamiento */ } }
    volver()
  }
  async function actualizar() {
    if (!equipo || actualizando) return
    let ced = ''
    try { ced = localStorage.getItem(claveLocal(equipo.id)) || '' } catch { /* sin almacenamiento */ }
    if (!ced) return
    setActualizando(true)
    await entrar(equipo, ced, { silencioso: true })
    setActualizando(false)
  }

  const cuenta = useMemo(() => (datos ? armarCuentaEquipo(datos) : null), [datos])
  const equiposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const lista = info?.equipos || []
    return q ? lista.filter(e => (e.name || '').toLowerCase().includes(q)) : lista
  }, [info, busqueda])

  const wrap = { minHeight: '100vh', background: S.navy, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: S.text, padding: '18px 14px 60px' }
  const caja = { maxWidth: 560, margin: '0 auto' }
  const btnVolver = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', minHeight: 40, color: S.text2, cursor: 'pointer', fontSize: '.82rem', fontWeight: 700 }

  if (errorLink) {
    return (
      <div style={wrap}><div style={{ ...caja, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>🔗</div>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 8 }}>Link no disponible</div>
        <div style={{ color: S.muted, fontSize: '.88rem', lineHeight: 1.5 }}>{errorLink}</div>
      </div></div>
    )
  }
  if (!info) {
    return <div style={wrap}><div style={{ ...caja, textAlign: 'center', paddingTop: 90, color: S.muted }}>Cargando…</div></div>
  }

  const encabezado = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <Escudo url={info.torneo?.logo_url} nombre={info.torneo?.name} size={48}/>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '.7rem', color: S.muted, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Finanzas del torneo</div>
        <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.2 }}>{info.torneo?.name}</div>
      </div>
    </div>
  )

  // ── 1) Lista de equipos ──
  if (!equipo) {
    return (
      <div style={wrap}><div style={caja}>
        {encabezado}
        <div style={{ color: S.text2, fontSize: '.88rem', lineHeight: 1.5, marginBottom: 14 }}>
          Busca tu equipo y entra con la <b>cédula del representante (dueño)</b> del equipo. Cada equipo solo puede ver sus propios movimientos.
        </div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} color={S.muted} style={{ position: 'absolute', left: 12, top: 14 }}/>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar mi equipo…"
            style={{ width: '100%', boxSizing: 'border-box', background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '12px 12px 12px 36px', color: S.text, fontSize: '1rem', outline: 'none' }}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {equiposFiltrados.map(e => (
            <button key={e.id} onClick={() => elegirEquipo(e)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '10px 14px', minHeight: 60, cursor: 'pointer', color: S.text, fontSize: '.95rem', fontWeight: 700 }}>
              <Escudo url={e.logo_url} nombre={e.name} size={40}/>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
              <Lock size={15} color={S.muted}/>
            </button>
          ))}
          {equiposFiltrados.length === 0 && <div style={{ color: S.muted, textAlign: 'center', padding: 24, fontSize: '.88rem' }}>No hay equipos con ese nombre.</div>}
        </div>
        <NotaPago/>
      </div></div>
    )
  }

  // ── 2) Pedir la cédula ──
  if (!datos) {
    return (
      <div style={wrap}><div style={caja}>
        <button onClick={volver} style={btnVolver}><ArrowLeft size={15}/> Volver a los equipos</button>
        <div style={{ textAlign: 'center', margin: '28px 0 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Escudo url={equipo.logo_url} nombre={equipo.name} size={72}/></div>
          <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{equipo.name}</div>
          <div style={{ color: S.muted, fontSize: '.85rem', marginTop: 6 }}>{info.torneo?.name}</div>
        </div>
        {entrando ? (
          <div style={{ textAlign: 'center', color: S.muted, padding: 20 }}>Entrando…</div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (cedula.trim()) entrar(equipo, cedula.trim()) }}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: 20 }}>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '.9rem', marginBottom: 4 }}>🔒 Contraseña</label>
            <div style={{ color: S.muted, fontSize: '.78rem', lineHeight: 1.45, marginBottom: 12 }}>Es la <b>cédula del representante (dueño)</b> del equipo. Escríbela solo con números, sin puntos.</div>
            <input value={cedula} onChange={e => setCedula(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="Número de cédula" autoFocus
              style={{ width: '100%', boxSizing: 'border-box', background: S.card2, border: `1px solid ${errorCedula ? S.red : S.border}`, borderRadius: 12, padding: '14px', color: S.text, fontSize: '1.1rem', letterSpacing: '.05em', outline: 'none' }}/>
            {errorCedula && <div style={{ color: S.red, fontSize: '.8rem', lineHeight: 1.45, marginTop: 10 }}>{errorCedula}</div>}
            <button type="submit" disabled={!cedula.trim()}
              style={{ width: '100%', marginTop: 14, padding: 14, minHeight: 48, background: cedula.trim() ? S.gold : S.card2, border: 'none', borderRadius: 12, color: cedula.trim() ? '#1a1a1a' : S.muted, fontWeight: 900, fontSize: '.95rem', cursor: cedula.trim() ? 'pointer' : 'default' }}>
              Entrar
            </button>
          </form>
        )}
      </div></div>
    )
  }

  // ── 3) Cuenta del equipo ──
  // "Lo que debo": solo cargos que siguen sin pagar (por el valor que falta). "Mis pagos": pagos + lo ya pagado en cancha (arbitraje).
  const lineasVista = cuenta.lineas.filter(l => filtro === 'todos' ? true : filtro === 'pagos' ? (l.tipo === 'pago' || l.tipo === 'info') : (l.tipo === 'cargo' && l.pendiente > 0))
  const porDia = []
  lineasVista.forEach(l => {
    const k = claveDia(l.fecha)
    let g = porDia[porDia.length - 1]
    if (!g || g.k !== k) { g = { k, fecha: l.fecha, lineas: [] }; porDia.push(g) }
    g.lineas.push(l)
  })
  const alDia = cuenta.totalDebe <= 0

  return (
    <div style={wrap}><div style={caja}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={volver} style={btnVolver}><ArrowLeft size={15}/> Equipos</button>
        <button onClick={actualizar} disabled={actualizando} style={btnVolver}><RefreshCw size={14}/> {actualizando ? 'Actualizando…' : 'Actualizar'}</button>
        <button onClick={salir} style={{ ...btnVolver, marginLeft: 'auto' }}>Salir</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Escudo url={datos.equipo?.logo_url} nombre={datos.equipo?.name} size={56}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: '1.2rem', lineHeight: 1.2 }}>{datos.equipo?.name}</div>
          <div style={{ color: S.muted, fontSize: '.8rem' }}>{datos.torneo?.name}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ background: alDia ? 'rgba(34,197,94,.12)' : 'rgba(255,107,97,.12)', border: `1px solid ${alDia ? S.green : S.red}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: '.74rem', fontWeight: 700, color: alDia ? S.green : S.red }}>{alDia ? 'Estás al día ✓' : 'Debes'}</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: 2 }}>{fmt(cuenta.totalDebe)}</div>
        </div>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: '.74rem', fontWeight: 700, color: S.muted }}>Has pagado</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, marginTop: 2, color: S.green }}>{fmt(cuenta.totalPagado)}</div>
        </div>
      </div>

      {cuenta.grupos.length > 0 && (
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '6px 16px', marginBottom: 12 }}>
          {cuenta.grupos.map((g, i) => (
            <div key={g.clave} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: i > 0 ? `1px solid ${S.border}` : 'none' }}>
              <span style={{ fontSize: '1.2rem' }}>{g.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '.88rem' }}>{g.etiqueta}</div>
                <div style={{ color: S.muted, fontSize: '.72rem' }}>
                  {g.clave === 'arbitraje' ? `${fmt(g.informativo)} · pagado en efectivo en la cancha el día del partido` : `Cobrado ${fmt(g.cargos)} · Pagado ${fmt(g.pagos)}`}
                </div>
              </div>
              {g.clave === 'arbitraje'
                ? <span style={{ fontSize: '.72rem', fontWeight: 800, color: S.green, background: 'rgba(34,197,94,.12)', borderRadius: 999, padding: '4px 10px' }}>Pagado en cancha</span>
                : g.saldo > 0
                  ? <b style={{ color: S.red, fontSize: '.95rem' }}>{fmt(g.saldo)}</b>
                  : <span style={{ fontSize: '.72rem', fontWeight: 800, color: S.green, background: 'rgba(34,197,94,.12)', borderRadius: 999, padding: '4px 10px' }}>{g.saldo < 0 ? `A favor ${fmt(-g.saldo)}` : 'Al día'}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 14 }}><NotaPago/></div>

      <div style={{ fontWeight: 900, fontSize: '1rem', margin: '4px 0 10px' }}>Movimientos</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['todos', 'Todos'], ['cargos', 'Lo que debo'], ['pagos', 'Mis pagos']].map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k}
            style={{ minHeight: 40, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', fontSize: '.8rem', fontWeight: 800, border: filtro === k ? `1px solid ${S.gold}` : `1px solid ${S.border}`, background: filtro === k ? 'rgba(249,168,37,.15)' : 'transparent', color: filtro === k ? S.gold : S.text2 }}>
            {t}
          </button>
        ))}
      </div>

      {porDia.length === 0 && <div style={{ color: S.muted, textAlign: 'center', padding: 26, fontSize: '.88rem', background: S.card, border: `1px solid ${S.border}`, borderRadius: 14 }}>No hay movimientos para mostrar.</div>}
      {porDia.map(g => (
        <div key={g.k} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '.74rem', fontWeight: 800, color: S.muted, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 2px 6px' }}>{g.fecha ? fmtSoloDia(g.fecha) : 'Sin fecha'}</div>
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {g.lineas.map((l, i) => {
              const esPago = l.tipo === 'pago', esInfo = l.tipo === 'info'
              const cubierto = l.tipo === 'cargo' && !(l.pendiente > 0) // cargo que ya quedó pago con los abonos
              const parcial = l.tipo === 'cargo' && l.pendiente > 0 && l.pendiente < l.monto
              const verde = esPago || esInfo || cubierto
              const valor = filtro === 'cargos' && parcial ? l.pendiente : l.monto
              const nota = esInfo ? 'Pagado' : cubierto ? 'Pagado' : parcial ? `Falta ${fmt(l.pendiente)} de ${fmt(l.monto)}` : null
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: i > 0 ? `1px solid ${S.border}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.88rem', lineHeight: 1.3, wordBreak: 'break-word' }}>{l.titulo}</div>
                    {(l.detalle || l.fecha) && <div style={{ color: S.muted, fontSize: '.72rem', marginTop: 2, lineHeight: 1.35 }}>{[nota, l.detalle, l.fecha && esPago ? fmtFecha(l.fecha) : null].filter(Boolean).join(' · ')}</div>}
                  </div>
                  <b style={{ fontSize: '.95rem', whiteSpace: 'nowrap', color: verde ? S.green : S.red }}>
                    {esPago ? '+' : verde ? '✓ ' : '−'}{fmt(valor)}
                  </b>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div></div>
  )
}
