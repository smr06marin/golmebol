// Dueños de un equipo: el principal (el representante de siempre) y los ADICIONALES.
// Todos tienen los mismos permisos: inscribir y sacar jugadores, mandar el link de inscripción, desactivar
// jugadores desde el link, descargar la planilla y ver las finanzas del equipo.
// Pueden agregar o quitar dueños adicionales: el admin, el organizador de un torneo donde juega el equipo y los
// propios dueños (lo revisa el servidor). Diseñado para fondos oscuros (ficha del equipo en el panel y página del equipo).
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { confirmar } from '../lib/confirmar'

const faltaMigracion = e => e && (e.code === 'PGRST202' || /could not find the function|equipo_duenos/i.test(e.message || ''))
const limpiarError = (e, porDefecto) => {
  const m = String(e?.message || '').trim()
  if (!m || /row-level security|permission denied|violates|function .* does not exist/i.test(m) || m.length > 200) return porDefecto
  return m
}

export default function DuenosEquipo({ teamId, abiertoInicial = false, puedeEditar = true, alCambiar }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const [lista, setLista] = useState(null) // null = cargando
  const [error, setError] = useState('')
  const [sinMigracion, setSinMigracion] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [pedirNombre, setPedirNombre] = useState(false)

  useEffect(() => {
    if (!teamId) return
    let vivo = true
    supabase.rpc('equipo_duenos_lista', { p_team_id: teamId }).then(({ data, error: e }) => {
      if (!vivo) return
      if (e) { if (faltaMigracion(e)) setSinMigracion(true); else setError(limpiarError(e, 'No se pudo cargar la lista de dueños')); setLista([]); return }
      setLista(Array.isArray(data) ? data : [])
    })
    return () => { vivo = false }
  }, [teamId])

  async function agregar() {
    const c = cedula.replace(/\D/g, '')
    if (c.length < 5) return setError('Escribe la cédula del nuevo dueño (solo números)')
    setGuardando(true); setError('')
    const { data, error: e } = await supabase.rpc('equipo_dueno_agregar', { p_team_id: teamId, p_cedula: c, p_nombre: nombre.trim() || null })
    setGuardando(false)
    if (e) {
      if (/no está en Golmebol/i.test(e.message || '')) setPedirNombre(true)
      return setError(faltaMigracion(e) ? 'Falta correr migracion_varios_duenos.sql en Supabase' : limpiarError(e, 'No se pudo agregar el dueño'))
    }
    setLista(Array.isArray(data) ? data : lista)
    setCedula(''); setNombre(''); setPedirNombre(false); setAgregando(false)
    alCambiar?.()
  }

  async function quitar(d) {
    if (!(await confirmar(`¿Quitar a ${d.nombre || 'esta persona'} como dueño del equipo? Ya no podrá inscribir ni sacar jugadores.`))) return
    setError('')
    const { data, error: e } = await supabase.rpc('equipo_dueno_quitar', { p_team_id: teamId, p_cedula: d.cedula })
    if (e) return setError(limpiarError(e, 'No se pudo quitar el dueño'))
    setLista(Array.isArray(data) ? data : lista)
    alCambiar?.()
  }

  if (!teamId || sinMigracion) return null
  const n = lista?.length || 0
  const caja = { marginTop: '10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: '14px', padding: '12px', textAlign: 'left', color: '#e8f4fd' }
  const campo = { width: '100%', boxSizing: 'border-box', minHeight: '44px', background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.22)', borderRadius: '10px', padding: '0 12px', color: '#fff', fontSize: '16px', outline: 'none', fontFamily: 'inherit' }
  const btn = (fondo, color = '#fff') => ({ minHeight: '44px', padding: '0 16px', borderRadius: '10px', border: 'none', background: fondo, color, fontSize: '.86rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' })

  return (
    <div style={caja}>
      <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '40px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ fontWeight: '800', fontSize: '.92rem' }}>👥 Dueños del equipo{lista ? ` (${n})` : ''}</span>
        <span style={{ fontSize: '.8rem', color: '#9cc8ff', fontWeight: '700' }}>{abierto ? 'Cerrar ▲' : 'Ver ▼'}</span>
      </button>

      {abierto && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '.78rem', color: '#b8d4e8', lineHeight: 1.45 }}>
            Todos los dueños pueden inscribir y sacar jugadores, mandar el link de inscripción y descargar la planilla. Cada uno entra a Golmebol como jugador con <b>su propia cédula</b>.
          </div>

          {lista === null && <div style={{ fontSize: '.8rem', color: '#9aa0a6' }}>Cargando…</div>}
          {lista && n === 0 && <div style={{ fontSize: '.8rem', color: '#ffb4ae' }}>Este equipo todavía no tiene dueño registrado.</div>}
          {(lista || []).map(d => (
            <div key={d.cedula} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,.05)', borderRadius: '10px', padding: '8px 10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '800', fontSize: '.9rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre || 'Sin nombre'}</div>
                <div style={{ fontSize: '.74rem', color: '#9cb3c9', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span>🪪 {d.cedula}</span>
                  {d.principal && <span style={{ color: '#ffd43b', fontWeight: '800' }}>⭐ Principal</span>}
                  {!d.tiene_cuenta && <span style={{ color: '#ffb36b', fontWeight: '700' }}>Aún no ha entrado a Golmebol</span>}
                </div>
              </div>
              {!d.principal && puedeEditar && (
                <button type="button" onClick={() => quitar(d)} style={{ ...btn('rgba(255,90,82,.16)', '#ff9b94'), minHeight: '40px', padding: '0 12px', fontSize: '.78rem' }}>Quitar</button>
              )}
            </div>
          ))}

          {puedeEditar && lista && !agregando && (
            <button type="button" onClick={() => { setAgregando(true); setError('') }} style={{ ...btn('#1a73e8'), width: '100%' }}>
              + Agregar otro dueño
            </button>
          )}

          {puedeEditar && agregando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,.18)', borderRadius: '12px', padding: '10px' }}>
              <div style={{ fontSize: '.8rem', color: '#e8f4fd', fontWeight: '700' }}>1. Escribe la cédula del nuevo dueño</div>
              <input value={cedula} onChange={e => { setCedula(e.target.value); setError('') }} inputMode="numeric" placeholder="Cédula" style={campo} autoFocus/>
              <div style={{ fontSize: '.8rem', color: '#e8f4fd', fontWeight: '700' }}>2. Su nombre completo {pedirNombre ? '' : '(si ya está en Golmebol, no hace falta)'}</div>
              <input value={nombre} onChange={e => { setNombre(e.target.value); setError('') }} placeholder="Nombre completo" maxLength={80} style={{ ...campo, borderColor: pedirNombre ? '#ffb36b' : 'rgba(255,255,255,.22)' }}/>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={agregar} disabled={guardando} style={{ ...btn('#1e8e3e'), flex: 1, opacity: guardando ? .7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar dueño'}</button>
                <button type="button" onClick={() => { setAgregando(false); setCedula(''); setNombre(''); setPedirNombre(false); setError('') }} style={btn('rgba(255,255,255,.12)')}>Cancelar</button>
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: '.8rem', color: '#ffb4ae', background: 'rgba(255,90,82,.12)', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.4 }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
