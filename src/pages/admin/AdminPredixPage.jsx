import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, X, Ticket, Users, Search } from 'lucide-react'

const inp = { width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', color: '#202124', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }
const lbl = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

function fmtMoney(n) {
  return `$${Number(n || 0).toLocaleString('es-CO')}`
}

function estadoCalculado(s) {
  if (s.estado === 'cancelada') return 'cancelada'
  if (new Date(s.fecha_fin) < new Date(new Date().toDateString())) return 'vencida'
  return 'activa'
}

const ESTADO_STYLE = {
  activa:    { bg: '#e6f4ea', color: '#1e8e3e', label: '✅ Activa' },
  vencida:   { bg: '#f1f3f4', color: '#5f6368', label: '⏳ Vencida' },
  cancelada: { bg: '#fce8e6', color: '#d93025', label: '✕ Cancelada' },
}

// ── Modal: crear/editar plan ────────────────────────────────────────────
function ModalPlan({ plan, torneos, onClose, onGuardado }) {
  const [form, setForm] = useState(plan || {
    tipo: 'torneo', tournament_id: '', nombre: '', precio_min: 10000, precio_max: 50000,
    multiplicador_premio: 4, duracion_dias: 30, activo: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function setTipo(tipo) {
    setForm(f => ({
      ...f, tipo,
      tournament_id: tipo === 'completa' ? '' : f.tournament_id,
      precio_min: tipo === 'completa' ? 10000 : 10000,
      precio_max: tipo === 'completa' ? 30000 : 50000,
      multiplicador_premio: tipo === 'completa' ? 10 : 4,
    }))
  }

  async function handleGuardar() {
    setError('')
    if (form.tipo === 'torneo' && !form.tournament_id) return setError('Elige el torneo')
    if (!form.nombre.trim()) return setError('Ponle un nombre al plan')
    if (Number(form.precio_min) <= 0 || Number(form.precio_max) < Number(form.precio_min)) return setError('Revisa el rango de precio')

    setSaving(true)
    const data = {
      tipo: form.tipo,
      tournament_id: form.tipo === 'torneo' ? form.tournament_id : null,
      nombre: form.nombre.trim(),
      precio_min: Number(form.precio_min),
      precio_max: Number(form.precio_max),
      multiplicador_premio: Number(form.multiplicador_premio),
      duracion_dias: Number(form.duracion_dias),
      activo: form.activo,
    }
    const { error: err } = plan?.id
      ? await supabase.from('predix_planes').update(data).eq('id', plan.id)
      : await supabase.from('predix_planes').insert(data)
    setSaving(false)
    if (err) return setError('Error al guardar: ' + err.message)
    onGuardado()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '26px', width: '440px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>{plan?.id ? 'Editar plan' : 'Nuevo plan de Predix'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={lbl}>Tipo de plan</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ id: 'torneo', label: 'Por torneo' }, { id: 'completa', label: 'Completa (todos)' }].map(t => (
                <button key={t.id} onClick={() => setTipo(t.id)}
                  style={{ flex: 1, padding: '8px 4px', border: form.tipo === t.id ? '2px solid #1a73e8' : '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', background: form.tipo === t.id ? '#e8f0fe' : '#fff', color: form.tipo === t.id ? '#1a73e8' : '#5f6368', fontWeight: form.tipo === t.id ? '700' : '400', fontSize: '.8rem' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {form.tipo === 'torneo' && (
            <div>
              <label style={lbl}>Torneo</label>
              <select value={form.tournament_id} onChange={e => setForm(f => ({ ...f, tournament_id: e.target.value }))} style={inp}>
                <option value="">Selecciona un torneo...</option>
                {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={lbl}>Nombre del plan</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={inp} placeholder="Ej: Predix — Copa Armenia 2026"/>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Precio mínimo</label>
              <input type="number" value={form.precio_min} onChange={e => setForm(f => ({ ...f, precio_min: e.target.value }))} style={inp}/>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Precio máximo</label>
              <input type="number" value={form.precio_max} onChange={e => setForm(f => ({ ...f, precio_max: e.target.value }))} style={inp}/>
            </div>
          </div>
          <div style={{ fontSize: '.72rem', color: '#5f6368' }}>El jugador elige cuánto pagar dentro de ese rango.</div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Premio al 1er lugar (x veces lo pagado)</label>
              <input type="number" value={form.multiplicador_premio} onChange={e => setForm(f => ({ ...f, multiplicador_premio: e.target.value }))} style={inp}/>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Duración (días)</label>
              <input type="number" value={form.duracion_dias} onChange={e => setForm(f => ({ ...f, duracion_dias: e.target.value }))} style={inp}/>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} style={{ accentColor: '#1a73e8', width: '16px', height: '16px' }}/>
            <span style={{ fontSize: '.82rem', color: '#202124' }}>Plan activo (visible para suscribirse)</span>
          </label>

          {error && <div style={{ fontSize: '.8rem', color: '#d93025', background: '#fce8e6', borderRadius: '8px', padding: '8px 12px' }}>{error}</div>}

          <button onClick={handleGuardar} disabled={saving}
            style={{ padding: '10px', background: '#1a73e8', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: saving ? .7 : 1 }}>
            {saving ? 'Guardando...' : plan?.id ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: activar/renovar suscripción ──────────────────────────────────
function ModalSuscripcion({ jugadores, planes, suscripciones, presetPlayer, onClose, onGuardado }) {
  const [busq, setBusq]           = useState('')
  const [jugador, setJugador]     = useState(presetPlayer || null)
  const [planId, setPlanId]       = useState('')
  const [monto, setMonto]         = useState('')
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const plan = planes.find(p => p.id === planId)

  const resultadosJugador = useMemo(() => {
    if (!busq.trim()) return []
    const q = busq.toLowerCase()
    return jugadores.filter(j => j.name?.toLowerCase().includes(q) || j.numero_cedula?.includes(q)).slice(0, 8)
  }, [busq, jugadores])

  async function handleGuardar() {
    setError('')
    if (!jugador) return setError('Busca y elige un jugador')
    if (!plan) return setError('Elige un plan')
    const montoNum = Number(monto)
    if (!montoNum || montoNum < plan.precio_min || montoNum > plan.precio_max) {
      return setError(`El monto debe estar entre ${fmtMoney(plan.precio_min)} y ${fmtMoney(plan.precio_max)}`)
    }

    setSaving(true)
    const inicio = new Date(fechaInicio)
    const fin = new Date(inicio)
    fin.setDate(fin.getDate() + plan.duracion_dias)

    // Racha de meses seguidos: si la última suscripción de este jugador para
    // el mismo tipo/torneo terminó justo antes (con margen de ~35 días) de
    // este inicio, se suma a la racha; si no, arranca de nuevo en 1.
    const previas = suscripciones
      .filter(s => s.player_id === jugador.id && s.tournament_id === (plan.tipo === 'torneo' ? plan.tournament_id : null))
      .sort((a, b) => new Date(b.fecha_fin) - new Date(a.fecha_fin))
    const anterior = previas[0]
    let mesesSeguidos = 1
    if (anterior) {
      const diasDesdeVencio = (inicio - new Date(anterior.fecha_fin)) / (1000 * 60 * 60 * 24)
      if (diasDesdeVencio <= 35) mesesSeguidos = (anterior.meses_seguidos || 1) + 1
    }

    const { error: err } = await supabase.from('predix_suscripciones').insert({
      player_id: jugador.id,
      plan_id: plan.id,
      tournament_id: plan.tipo === 'torneo' ? plan.tournament_id : null,
      monto_pagado: montoNum,
      fecha_inicio: fechaInicio,
      fecha_fin: fin.toISOString().slice(0, 10),
      estado: 'activa',
      meses_seguidos: mesesSeguidos,
    })
    setSaving(false)
    if (err) return setError('Error al guardar: ' + err.message)
    onGuardado()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '26px', width: '460px', maxWidth: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontWeight: '700', color: '#202124', fontSize: '1rem' }}>Activar suscripción Predix</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9aa0a6' }}><X size={18}/></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!jugador ? (
            <div>
              <label style={lbl}>Buscar jugador (nombre o cédula)</label>
              <input value={busq} onChange={e => setBusq(e.target.value)} style={inp} placeholder="Escribe para buscar..." autoFocus/>
              {resultadosJugador.length > 0 && (
                <div style={{ marginTop: '6px', border: '1px solid #e8eaed', borderRadius: '8px', overflow: 'hidden' }}>
                  {resultadosJugador.map(j => (
                    <button key={j.id} onClick={() => { setJugador(j); setBusq('') }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f1f3f4', cursor: 'pointer' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: '#f1f3f4', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {j.photo_face_url || j.photo_url ? <img src={j.photo_face_url || j.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '👤'}
                      </div>
                      <div>
                        <div style={{ fontSize: '.82rem', color: '#202124', fontWeight: '600' }}>{j.name}</div>
                        <div style={{ fontSize: '.7rem', color: '#9aa0a6' }}>🪪 {j.numero_cedula}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e8f0fe', borderRadius: '10px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {jugador.photo_face_url || jugador.photo_url ? <img src={jugador.photo_face_url || jugador.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '👤'}
                </div>
                <div>
                  <div style={{ fontSize: '.85rem', fontWeight: '700', color: '#202124' }}>{jugador.name}</div>
                  <div style={{ fontSize: '.7rem', color: '#5f6368' }}>🪪 {jugador.numero_cedula}</div>
                </div>
              </div>
              {!presetPlayer && <button onClick={() => setJugador(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', fontSize: '.75rem', fontWeight: '600' }}>Cambiar</button>}
            </div>
          )}

          <div>
            <label style={lbl}>Plan</label>
            <select value={planId} onChange={e => { setPlanId(e.target.value); setMonto('') }} style={inp}>
              <option value="">Selecciona un plan...</option>
              {planes.filter(p => p.activo).map(p => (
                <option key={p.id} value={p.id}>{p.nombre} · {fmtMoney(p.precio_min)}–{fmtMoney(p.precio_max)}</option>
              ))}
            </select>
          </div>

          {plan && (
            <div>
              <label style={lbl}>Monto que pagó ({fmtMoney(plan.precio_min)} – {fmtMoney(plan.precio_max)})</label>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={inp} placeholder="Monto exacto pagado"/>
            </div>
          )}

          <div>
            <label style={lbl}>Fecha de inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={inp}/>
          </div>

          {plan && (
            <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '.78rem', color: '#202124', fontWeight: '600' }}>Resumen</div>
              <div style={{ fontSize: '.75rem', color: '#5f6368', marginTop: '4px' }}>
                {plan.duracion_dias} días de acceso · Vence el{' '}
                <b>{new Date(new Date(fechaInicio).getTime() + plan.duracion_dias * 86400000).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</b>
              </div>
              {monto && Number(monto) >= plan.precio_min && Number(monto) <= plan.precio_max && (
                <div style={{ fontSize: '.75rem', color: '#1e8e3e', marginTop: '4px', fontWeight: '600' }}>
                  Si queda 1° del ranking, gana {fmtMoney(Number(monto) * plan.multiplicador_premio)} ({plan.multiplicador_premio}x)
                </div>
              )}
            </div>
          )}

          {error && <div style={{ fontSize: '.8rem', color: '#d93025', background: '#fce8e6', borderRadius: '8px', padding: '8px 12px' }}>{error}</div>}

          <button onClick={handleGuardar} disabled={saving}
            style={{ padding: '10px', background: '#1e8e3e', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: '700', fontSize: '.875rem', opacity: saving ? .7 : 1 }}>
            {saving ? 'Procesando...' : '✅ Activar suscripción'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPredixPage() {
  const [tab, setTab]                 = useState('planes')
  const [planes, setPlanes]           = useState([])
  const [suscripciones, setSuscripciones] = useState([])
  const [jugadores, setJugadores]     = useState([])
  const [torneos, setTorneos]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [modalPlan, setModalPlan]     = useState(null) // null | {} (nuevo) | plan (editar)
  const [modalSusc, setModalSusc]     = useState(null) // null | { presetPlayer }
  const [busqSusc, setBusqSusc]       = useState('')
  const [msg, setMsg]                 = useState(null)

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const [{ data: p }, { data: s }, { data: j }, { data: t }] = await Promise.all([
      supabase.from('predix_planes').select('*, tournaments(name)').order('created_at', { ascending: false }),
      supabase.from('predix_suscripciones').select('*, players(name, numero_cedula, photo_url, photo_face_url), predix_planes(nombre, tipo), tournaments(name)').order('created_at', { ascending: false }),
      supabase.from('players').select('id, name, numero_cedula, photo_url, photo_face_url').order('name'),
      supabase.from('tournaments').select('id, name').order('created_at', { ascending: false }),
    ])
    setPlanes(p || [])
    setSuscripciones(s || [])
    setJugadores(j || [])
    setTorneos(t || [])
    setLoading(false)
  }

  function showMsg(text, type = 'ok') { setMsg({ text, type }); setTimeout(() => setMsg(null), 3000) }

  async function handleCancelar(s) {
    if (!confirm(`¿Cancelar la suscripción de ${s.players?.name}?`)) return
    await supabase.from('predix_suscripciones').update({ estado: 'cancelada' }).eq('id', s.id)
    showMsg('Suscripción cancelada')
    fetchTodo()
  }

  const suscripcionesFiltradas = suscripciones.filter(s => {
    if (!busqSusc.trim()) return true
    const q = busqSusc.toLowerCase()
    return s.players?.name?.toLowerCase().includes(q) || s.players?.numero_cedula?.includes(q)
  })

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}
      {modalPlan !== null && (
        <ModalPlan plan={modalPlan.id ? modalPlan : null} torneos={torneos}
          onClose={() => setModalPlan(null)}
          onGuardado={() => { setModalPlan(null); showMsg(modalPlan.id ? 'Plan actualizado ✓' : 'Plan creado ✓'); fetchTodo() }}/>
      )}
      {modalSusc !== null && (
        <ModalSuscripcion jugadores={jugadores} planes={planes} suscripciones={suscripciones} presetPlayer={modalSusc.presetPlayer}
          onClose={() => setModalSusc(null)}
          onGuardado={() => { setModalSusc(null); showMsg('Suscripción activada ✓'); fetchTodo() }}/>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Ticket size={20} color="#1a73e8"/> Predix Golmebol
        </h1>
        <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>Planes de suscripción y jugadores suscritos</p>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', borderBottom: '1px solid #e8eaed' }}>
        {[{ id: 'planes', label: 'Planes' }, { id: 'suscripciones', label: 'Suscripciones' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.85rem', fontWeight: tab === t.id ? '700' : '400', color: tab === t.id ? '#1a73e8' : '#5f6368', borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', padding: '48px', fontSize: '.875rem' }}>Cargando...</div>
      ) : tab === 'planes' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
            <button onClick={() => setModalPlan({})}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
              <Plus size={14}/> Nuevo plan
            </button>
          </div>

          {planes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', color: '#9aa0a6' }}>
              Aún no hay planes creados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {planes.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>{p.nombre}</span>
                      <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#1a73e8', background: '#e8f0fe', borderRadius: '20px', padding: '2px 8px' }}>
                        {p.tipo === 'torneo' ? (p.tournaments?.name || 'Torneo') : 'Completa'}
                      </span>
                      {!p.activo && <span style={{ fontSize: '.65rem', fontWeight: '700', color: '#9aa0a6', background: '#f1f3f4', borderRadius: '20px', padding: '2px 8px' }}>Inactivo</span>}
                    </div>
                    <div style={{ fontSize: '.78rem', color: '#5f6368' }}>
                      {fmtMoney(p.precio_min)} – {fmtMoney(p.precio_max)} · {p.duracion_dias} días · Premio 1°: {p.multiplicador_premio}x lo pagado
                    </div>
                  </div>
                  <button onClick={() => setModalPlan(p)}
                    style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.78rem', fontWeight: '600' }}>
                    Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '280px' }}>
              <Search size={14} color="#9aa0a6" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}/>
              <input value={busqSusc} onChange={e => setBusqSusc(e.target.value)} placeholder="Buscar jugador..."
                style={{ ...inp, paddingLeft: '30px' }}/>
            </div>
            <button onClick={() => setModalSusc({})}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.85rem', fontWeight: '700' }}>
              <Plus size={14}/> Nueva suscripción
            </button>
          </div>

          {suscripcionesFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', color: '#9aa0a6' }}>
              <Users size={28} style={{ marginBottom: '8px' }}/>
              <div>Sin suscripciones {busqSusc ? 'para esa búsqueda' : 'todavía'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {suscripcionesFiltradas.map(s => {
                const estado = estadoCalculado(s)
                const es = ESTADO_STYLE[estado]
                return (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: '#f1f3f4', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.players?.photo_face_url || s.players?.photo_url ? <img src={s.players.photo_face_url || s.players.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <div style={{ fontWeight: '700', color: '#202124', fontSize: '.85rem' }}>{s.players?.name}</div>
                      <div style={{ fontSize: '.72rem', color: '#5f6368', marginTop: '2px' }}>
                        {s.predix_planes?.nombre} · {s.tournaments?.name || 'Completa'} · pagó {fmtMoney(s.monto_pagado)}
                      </div>
                      <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '2px' }}>
                        {new Date(s.fecha_inicio).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} → {new Date(s.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {s.meses_seguidos > 1 && ` · 🔥 ${s.meses_seguidos} meses seguidos`}
                      </div>
                    </div>
                    <span style={{ fontSize: '.68rem', fontWeight: '700', color: es.color, background: es.bg, borderRadius: '20px', padding: '3px 10px', flexShrink: 0 }}>{es.label}</span>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {estado !== 'activa' && (
                        <button onClick={() => setModalSusc({ presetPlayer: s.players ? { ...s.players, id: s.player_id } : null })}
                          style={{ background: '#e8f0fe', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#1a73e8', fontSize: '.75rem', fontWeight: '700' }}>
                          Renovar
                        </button>
                      )}
                      {estado === 'activa' && (
                        <button onClick={() => handleCancelar(s)}
                          style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#d93025', fontSize: '.75rem', fontWeight: '600' }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
