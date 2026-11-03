import { useEffect, useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Panel del ORGANIZADOR para el "Link de finanzas para los equipos":
//  · genera (una sola vez, no vence) y copia/comparte el link del torneo;
//  · muestra, equipo por equipo, si ya entró, cuándo fue su último ingreso, cuántas veces entró,
//    y quiénes NUNCA han entrado. Los equipos sin cédula del representante salen marcados (no pueden entrar).
// Las funciones de la base de datos son las de migracion_link_finanzas_equipos.sql.

const TZ = 'America/Bogota'
function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }) + ' · ' + d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: TZ })
}

export default function LinkFinanzasEquipos({ torneoId, torneoNombre, onClose }) {
  const [link, setLink] = useState('')
  const [accesos, setAccesos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [soloNunca, setSoloNunca] = useState(false)
  const [abierto, setAbierto] = useState(null) // team_id con el historial de ingresos desplegado

  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.rpc('generar_link_finanzas', { p_tournament_id: torneoId }),
      supabase.rpc('finanzas_accesos_resumen', { p_tournament_id: torneoId }),
    ]).then(([{ data: g, error: e1 }, { data: a, error: e2 }]) => {
      if (!vivo) return
      if (e1 || e2) throw (e1 || e2)
      setLink(`${window.location.origin}/finanzas/${g.token}`)
      setAccesos(Array.isArray(a) ? a : [])
    }).catch(e => {
      if (!vivo) return
      const msg = String(e?.message || '')
      setError(/function .* does not exist|schema cache|Could not find the function/i.test(msg)
        ? 'Falta ejecutar migracion_link_finanzas_equipos.sql en Supabase (SQL Editor → pegar → RUN).'
        : 'No se pudo cargar. Revisa tu conexión e intenta de nuevo.')
    }).finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [torneoId, recarga])

  const refrescar = () => { setCargando(true); setError(''); setRecarga(n => n + 1) }

  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2500) } catch { /* sin permiso de portapapeles */ }
  }
  const textoWhatsApp = `Hola 👋 Aquí puedes ver los movimientos de plata de tu equipo en ${torneoNombre || 'el torneo'}: ${link}\n\nPara entrar, busca tu equipo y escribe como contraseña la cédula del representante (dueño) del equipo.`

  const nuncaEntraron = accesos.filter(a => a.ingresos === 0)
  const lista = soloNunca ? nuncaEntraron : accesos
  const btn = { minHeight: 40, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '.8rem', fontWeight: 700 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontWeight: 700, color: '#202124', fontSize: '.95rem' }}>🔗 Link de finanzas para los equipos</div>
          <button onClick={onClose} style={{ ...btn, background: '#fff', border: '1px solid #dadce0', color: '#5f6368', display: 'flex', alignItems: 'center', gap: 6 }}><X size={15}/> Cerrar</button>
        </div>

        <div style={{ padding: '16px 20px 20px', overflowY: 'auto' }}>
          {error && <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', borderRadius: 10, padding: '12px 14px', color: '#a50e0e', fontSize: '.82rem', lineHeight: 1.5, marginBottom: 12 }}>{error}</div>}

          <div style={{ fontSize: '.8rem', color: '#5f6368', lineHeight: 1.5, marginBottom: 12 }}>
            Un solo link para <b>todos los equipos</b> (no vence). Cada equipo ve la lista, pero solo entra al suyo escribiendo como contraseña la <b>cédula del representante (dueño)</b> de su equipo.
          </div>

          <label style={{ display: 'block', fontSize: '.74rem', fontWeight: 700, color: '#5f6368', marginBottom: 4 }}>Link (siempre el mismo)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <input readOnly value={link || (cargando ? 'Generando…' : '')} onFocus={e => e.target.select()}
              style={{ flex: '1 1 220px', minWidth: 0, boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #dadce0', borderRadius: 8, fontSize: '.78rem', color: '#5f6368' }}/>
            <button onClick={copiar} disabled={!link} style={{ ...btn, background: copiado ? '#1e8e3e' : '#1a73e8', border: 'none', color: '#fff' }}>{copiado ? '¡Copiado! ✓' : 'Copiar'}</button>
            <a href={link ? `https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}` : undefined} target="_blank" rel="noreferrer"
              style={{ ...btn, background: '#25d366', border: 'none', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', opacity: link ? 1 : .5, pointerEvents: link ? 'auto' : 'none' }}>
              Enviar por WhatsApp
            </a>
          </div>

          <div style={{ background: '#fff8e1', border: '1px solid #f9e29d', borderRadius: 10, padding: '10px 14px', fontSize: '.76rem', color: '#8a6d00', lineHeight: 1.5, margin: '10px 0 16px' }}>
            📌 En el link, los equipos ven esta nota: <i>si hicieron el pago el mismo día del partido y no aparece registrado, que revisen el martes después de la 1:00 p. m.</i>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: '#202124', fontSize: '.9rem' }}>¿Quién ha entrado?</div>
            <button onClick={refrescar} disabled={cargando} style={{ ...btn, background: '#fff', border: '1px solid #dadce0', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14}/> {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {!cargando && accesos.length > 0 && (
            <>
              <div style={{ fontSize: '.8rem', color: '#5f6368', marginBottom: 10 }}>
                <b style={{ color: '#1e8e3e' }}>{accesos.length - nuncaEntraron.length}</b> de {accesos.length} equipos ya entraron · <b style={{ color: nuncaEntraron.length ? '#d93025' : '#1e8e3e' }}>{nuncaEntraron.length}</b> nunca han entrado
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setSoloNunca(false)} aria-pressed={!soloNunca}
                  style={{ ...btn, borderRadius: 999, border: !soloNunca ? '1px solid #1a73e8' : '1px solid #dadce0', background: !soloNunca ? '#e8f0fe' : '#fff', color: !soloNunca ? '#1a73e8' : '#5f6368' }}>
                  Todos ({accesos.length})
                </button>
                <button onClick={() => setSoloNunca(true)} aria-pressed={soloNunca}
                  style={{ ...btn, borderRadius: 999, border: soloNunca ? '1px solid #d93025' : '1px solid #dadce0', background: soloNunca ? '#fce8e6' : '#fff', color: soloNunca ? '#d93025' : '#5f6368' }}>
                  Solo los que nunca han entrado ({nuncaEntraron.length})
                </button>
              </div>
            </>
          )}

          {cargando && accesos.length === 0 && <div style={{ color: '#9aa0a6', textAlign: 'center', padding: 24, fontSize: '.85rem' }}>Cargando…</div>}
          {!cargando && accesos.length === 0 && !error && <div style={{ color: '#9aa0a6', textAlign: 'center', padding: 24, fontSize: '.85rem' }}>Este torneo todavía no tiene equipos.</div>}
          {!cargando && soloNunca && lista.length === 0 && <div style={{ background: '#e6f4ea', borderRadius: 10, padding: 14, color: '#137333', fontWeight: 700, fontSize: '.85rem', textAlign: 'center' }}>Todos los equipos ya entraron al menos una vez ✓</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lista.map(a => {
              const nunca = a.ingresos === 0
              const desplegable = !nunca && (a.recientes || []).length > 0
              const abiertoAhora = abierto === a.team_id
              return (
                <div key={a.team_id} style={{ border: '1px solid #e8eaed', borderRadius: 12, background: '#fff', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#202124', fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                      {a.representante && <div style={{ fontSize: '.72rem', color: '#80868b' }}>Representante: {a.representante}</div>}
                    </div>
                    {!a.tiene_cedula
                      ? <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#b45309', background: '#fef3c7', borderRadius: 8, padding: '4px 10px' }}>⚠️ Sin cédula del representante</span>
                      : nunca
                        ? <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#d93025', background: '#fce8e6', borderRadius: 8, padding: '4px 10px' }}>Nunca ha entrado</span>
                        : <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#137333', background: '#e6f4ea', borderRadius: 8, padding: '4px 10px' }}>Entró {a.ingresos} {a.ingresos === 1 ? 'vez' : 'veces'}</span>}
                  </div>
                  {!a.tiene_cedula && <div style={{ fontSize: '.72rem', color: '#8a6d00', marginTop: 6, lineHeight: 1.4 }}>Este equipo no puede entrar hasta que se registre la cédula de su representante.</div>}
                  {!nunca && <div style={{ fontSize: '.76rem', color: '#5f6368', marginTop: 6 }}>Último ingreso: <b style={{ color: '#202124' }}>{fmtFechaHora(a.ultimo)}</b></div>}
                  {a.fallidos_24h > 0 && <div style={{ fontSize: '.72rem', color: '#d93025', marginTop: 4 }}>⚠️ {a.fallidos_24h} intento{a.fallidos_24h === 1 ? '' : 's'} con contraseña incorrecta en las últimas 24 horas</div>}
                  {desplegable && (
                    <>
                      <button onClick={() => setAbierto(abiertoAhora ? null : a.team_id)} aria-expanded={abiertoAhora}
                        style={{ background: 'none', border: 'none', padding: '8px 0 0', minHeight: 36, cursor: 'pointer', color: '#1a73e8', fontSize: '.76rem', fontWeight: 700 }}>
                        {abiertoAhora ? 'Ocultar ingresos ▴' : 'Ver todos los ingresos ▾'}
                      </button>
                      {abiertoAhora && (
                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {a.recientes.map((t, i) => <div key={i} style={{ fontSize: '.76rem', color: '#3c4043' }}>🕐 {fmtFechaHora(t)}</div>)}
                          {a.ingresos > a.recientes.length && <div style={{ fontSize: '.7rem', color: '#9aa0a6' }}>Se muestran los {a.recientes.length} más recientes. Un ingreso nuevo se anota si pasaron más de 10 minutos desde el anterior.</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <button onClick={onClose} style={{ ...btn, width: '100%', marginTop: 16, background: '#fff', border: '1px solid #dadce0', color: '#5f6368' }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
