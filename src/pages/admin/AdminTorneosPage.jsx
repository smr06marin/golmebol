import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Plus, Pencil, Trash2, Trophy, Eye, Star } from 'lucide-react'


const EMPTY = { name: '', season: '', city: '', modalidad: '', categoria: '', genero: '', formato: '', fecha_inicio: '', fecha_fin: '' }
const FIN_EMPTY = {
  llevar_cuentas: false,
  precio_amarilla: '', precio_azul: '', precio_roja: '',
  arbitraje_equipo: '', valor_w_presenta: '', multa_no_presenta: '',
  inscripcion: '', pago_cancha_partido: '', pago_cancha_w: '',
  pago_arbitro_partido: '', pago_arbitro_w: '',
}
const MODALIDADES = ['Fútbol 5', 'Fútbol 7', 'Fútbol 11']
const GENEROS = ['Masculino', 'Femenino', 'Mixto']
const FORMATOS = ['Todos contra todos', 'Eliminación directa', 'Grupos + Eliminación']

const input = {
  width: '100%', background: '#fff', border: '1px solid #dadce0',
  borderRadius: '8px', padding: '8px 12px', color: '#202124',
  fontSize: '.875rem', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
}
const label = {
  fontSize: '.75rem', fontWeight: '500', color: '#5f6368',
  display: 'block', marginBottom: '4px',
}

export default function AdminTorneosPage() {
  const navigate = useNavigate()
  const { user, rol } = useAuthStore()
  const esAdmin       = rol?.rol === 'admin'
  const esOrganizador = rol?.rol === 'organizador'
  const isMobile      = useIsMobile()
  const cols2 = isMobile ? '1fr' : '1fr 1fr'
  const cols3 = isMobile ? '1fr' : '1fr 1fr 1fr'

  const [torneos, setTorneos] = useState([])
  const [organizadores, setOrganizadores] = useState({}) // user_id -> email
  const [form, setForm] = useState(EMPTY)
  const [fin, setFin] = useState(FIN_EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchTorneos() }, [])

  async function fetchTorneos() {
    let query = supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    if (esOrganizador) query = query.eq('organizador_id', user?.id)
    const { data } = await query
    setTorneos(data || [])
    // Para el admin: mapa de organizadores (id de cuenta -> correo)
    if (esAdmin) {
      try {
        const { data: roles } = await supabase.from('roles_plataforma').select('email, user_id').not('user_id', 'is', null)
        const map = {}
        ;(roles || []).forEach(r => { map[r.user_id] = r.email })
        setOrganizadores(map)
      } catch { /* columna user_id aún no creada */ }
    }
  }

  async function handleTogglePremium(t) {
    if (!esAdmin) return
    if (!confirm(t.premium
      ? `¿Quitar Premium a "${t.name}"? El organizador perderá noticias, cuentas de dinero y ediciones.`
      : `¿Marcar "${t.name}" como Premium (pago recibido)? Habilita noticias, cuentas de dinero, ediciones y le permite al organizador crear otro torneo.`)) return
    const { error } = await supabase.from('tournaments').update({ premium: !t.premium }).eq('id', t.id)
    if (error) return showMsg(error.message?.includes('premium') ? 'Falta ejecutar migracion_roles.sql en Supabase' : 'Error al actualizar', 'error')
    showMsg(t.premium ? 'Premium desactivado' : 'Torneo marcado como Premium ⭐')
    fetchTorneos()
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function handleSave() {
    if (!form.name) return showMsg('El nombre del torneo es obligatorio', 'error')
    if (!form.season) return showMsg('La temporada es obligatoria', 'error')
    if (!form.city) return showMsg('La ciudad es obligatoria', 'error')
    if (!form.modalidad) return showMsg('La modalidad es obligatoria (Fútbol 5, 7 u 11)', 'error')
    if (!form.genero) return showMsg('El género es obligatorio', 'error')
    if (!form.categoria) return showMsg('La categoría es obligatoria (ej: Senior, Sub-20)', 'error')
    if (!form.formato) return showMsg('El formato es obligatorio', 'error')
    if (!form.fecha_inicio) return showMsg('La fecha de inicio es obligatoria', 'error')
    // Plan gratuito de organizador: 1 torneo (cada torneo Premium pagado libera otro cupo)
    if (!editId && esOrganizador) {
      const sinPremium = torneos.filter(t => !t.premium).length
      if (sinPremium >= 1) return showMsg('Tu plan gratuito permite 1 torneo. Para crear otro, contacta a Golmebol y activa el plan Premium 💎', 'error')
    }
    setLoading(true)
    const num = v => (v === '' || v === null || v === undefined) ? 0 : (parseFloat(v) || 0)
    const finanzasConfig = {
      llevar_cuentas:       !!fin.llevar_cuentas,
      precio_amarilla:      num(fin.precio_amarilla),
      precio_azul:          num(fin.precio_azul),
      precio_roja:          num(fin.precio_roja),
      arbitraje_equipo:     num(fin.arbitraje_equipo),
      valor_w_presenta:     num(fin.valor_w_presenta),
      multa_no_presenta:    num(fin.multa_no_presenta),
      inscripcion:          num(fin.inscripcion),
      pago_cancha_partido:  num(fin.pago_cancha_partido),
      pago_cancha_w:        num(fin.pago_cancha_w),
      pago_arbitro_partido: num(fin.pago_arbitro_partido),
      pago_arbitro_w:       num(fin.pago_arbitro_w),
    }
    if (editId) {
      let { error } = await supabase.from('tournaments').update({ ...form, finanzas_config: finanzasConfig }).eq('id', editId)
      if (error && error.message?.includes('finanzas_config')) {
        // La columna aún no existe: guardar sin finanzas y avisar
        ;({ error } = await supabase.from('tournaments').update(form).eq('id', editId))
        if (!error) showMsg('Torneo actualizado, pero los precios NO se guardaron: ejecuta migracion_finanzas.sql en Supabase', 'error')
      } else if (error) showMsg('Error al guardar', 'error')
      else { showMsg('Torneo actualizado ✓'); setEditId(null) }
    } else {
        const cleanForm = {
  ...form,
  status: 'active',
  fecha_inicio: form.fecha_inicio || null,
  fecha_fin: form.fecha_fin || null,
  organizador_id: esOrganizador ? user?.id : null,
}
let { error } = await supabase.from('tournaments').insert({ ...cleanForm, finanzas_config: finanzasConfig })
        if (error && error.message?.includes('finanzas_config')) {
          ;({ error } = await supabase.from('tournaments').insert(cleanForm))
          if (!error) showMsg('Torneo creado, pero los precios NO se guardaron: ejecuta migracion_finanzas.sql en Supabase', 'error')
        } else if (error) { console.log('ERROR DETALLE:', error); showMsg('Error al crear', 'error') }
      else showMsg('Torneo creado ✓')
    }
    setForm(EMPTY)
    setFin(FIN_EMPTY)
    setShowForm(false)
    setLoading(false)
    fetchTorneos()
  }

  function handleEdit(t) {
    setForm({ name: t.name || '', season: t.season || '', city: t.city || '', modalidad: t.modalidad || '', categoria: t.categoria || '', genero: t.genero || '', formato: t.formato || '', fecha_inicio: t.fecha_inicio || '', fecha_fin: t.fecha_fin || '' })
    const fc = t.finanzas_config || {}
    setFin({
      llevar_cuentas:       !!fc.llevar_cuentas,
      precio_amarilla:      fc.precio_amarilla || '',
      precio_azul:          fc.precio_azul || '',
      precio_roja:          fc.precio_roja || '',
      arbitraje_equipo:     fc.arbitraje_equipo || '',
      valor_w_presenta:     fc.valor_w_presenta || '',
      multa_no_presenta:    fc.multa_no_presenta || '',
      inscripcion:          fc.inscripcion || '',
      pago_cancha_partido:  fc.pago_cancha_partido || '',
      pago_cancha_w:        fc.pago_cancha_w || '',
      pago_arbitro_partido: fc.pago_arbitro_partido || '',
      pago_arbitro_w:       fc.pago_arbitro_w || '',
    })
    setEditId(t.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar torneo?')) return
    await supabase.from('tournaments').delete().eq('id', id)
    fetchTorneos()
    showMsg('Eliminado')
  }

  const filtered = torneos.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      {/* Mensaje */}
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: 0 }}>Torneos</h1>
          <p style={{ color: '#5f6368', margin: '4px 0 0', fontSize: '.875rem' }}>{torneos.length} torneos registrados</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setFin(FIN_EMPTY); setEditId(null); setShowForm(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1a73e8', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500' }}>
          <Plus size={18}/> Nuevo torneo
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: '#202124', marginBottom: '20px' }}>
            {editId ? 'Editar torneo' : 'Nuevo torneo'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={label}>Nombre *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="Nombre del torneo"/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
              <div>
                <label style={label}>Temporada</label>
                <input value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} style={input} placeholder="2025"/>
              </div>
              <div>
                <label style={label}>Ciudad</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={input} placeholder="Ciudad"/>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '16px' }}>
              <div>
                <label style={label}>Modalidad</label>
                <select value={form.modalidad} onChange={e => setForm(f => ({ ...f, modalidad: e.target.value }))} style={input}>
                  <option value="">Seleccionar</option>
                  {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Género</label>
                <select value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))} style={input}>
                  <option value="">Seleccionar</option>
                  {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Categoría</label>
                <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={input} placeholder="Sub-20, Senior..."/>
              </div>
            </div>
            <div>
              <label style={label}>Formato</label>
              <select value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))} style={input}>
                <option value="">Seleccionar</option>
                {FORMATOS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
              <div>
                <label style={label}>Fecha inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={input}/>
              </div>
              <div>
              <label style={label}>Fecha fin <span style={{ color: '#9aa0a6', fontWeight: '400' }}>(opcional — puede definirse después)</span></label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} style={input}/>
              </div>
            </div>

            {/* Precios de tarjetas */}
            <div style={{ borderTop: '1px solid #e8eaed', paddingTop: '16px' }}>
              <div style={{ fontSize: '.8rem', fontWeight: '700', color: '#202124', marginBottom: '10px' }}>💳 Precio de las tarjetas</div>
              <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '16px' }}>
                <div><label style={label}>🟨 Amarilla ($)</label><input type="number" min="0" value={fin.precio_amarilla} onChange={e => setFin(f => ({ ...f, precio_amarilla: e.target.value }))} style={input} placeholder="0"/></div>
                <div><label style={label}>🟦 Azul ($)</label><input type="number" min="0" value={fin.precio_azul} onChange={e => setFin(f => ({ ...f, precio_azul: e.target.value }))} style={input} placeholder="0"/></div>
                <div><label style={label}>🟥 Roja ($)</label><input type="number" min="0" value={fin.precio_roja} onChange={e => setFin(f => ({ ...f, precio_roja: e.target.value }))} style={input} placeholder="0"/></div>
              </div>
              <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginTop: '6px' }}>Se cobran automáticamente al equipo según las planillas. Un equipo con tarjetas sin pagar no avanza a eliminatorias.</div>
            </div>

            {/* Cuentas del torneo */}
            <div style={{ borderTop: '1px solid #e8eaed', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={fin.llevar_cuentas} onChange={e => setFin(f => ({ ...f, llevar_cuentas: e.target.checked }))} style={{ width: '17px', height: '17px', cursor: 'pointer' }}/>
                <span style={{ fontSize: '.85rem', fontWeight: '700', color: '#202124' }}>💰 Quiero llevar las cuentas de dinero del torneo (ingresos, gastos y ganancias)</span>
              </label>
              {fin.llevar_cuentas && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8f9fa', border: '1px solid #e8eaed', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
                    <div><label style={label}>Inscripción por equipo ($)</label><input type="number" min="0" value={fin.inscripcion} onChange={e => setFin(f => ({ ...f, inscripcion: e.target.value }))} style={input} placeholder="0"/></div>
                    <div><label style={label}>Arbitraje que paga cada equipo por partido ($)</label><input type="number" min="0" value={fin.arbitraje_equipo} onChange={e => setFin(f => ({ ...f, arbitraje_equipo: e.target.value }))} style={input} placeholder="0"/></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
                    <div><label style={label}>Partido W: paga el equipo que se presenta ($)</label><input type="number" min="0" value={fin.valor_w_presenta} onChange={e => setFin(f => ({ ...f, valor_w_presenta: e.target.value }))} style={input} placeholder="0"/></div>
                    <div><label style={label}>Multa al equipo que NO se presenta ($ — 0 si no hay)</label><input type="number" min="0" value={fin.multa_no_presenta} onChange={e => setFin(f => ({ ...f, multa_no_presenta: e.target.value }))} style={input} placeholder="0"/></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
                    <div><label style={label}>Pago a la cancha por partido jugado ($)</label><input type="number" min="0" value={fin.pago_cancha_partido} onChange={e => setFin(f => ({ ...f, pago_cancha_partido: e.target.value }))} style={input} placeholder="0"/></div>
                    <div><label style={label}>Pago a la cancha por partido W ($)</label><input type="number" min="0" value={fin.pago_cancha_w} onChange={e => setFin(f => ({ ...f, pago_cancha_w: e.target.value }))} style={input} placeholder="0"/></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: '16px' }}>
                    <div><label style={label}>Pago a árbitros por partido jugado ($)</label><input type="number" min="0" value={fin.pago_arbitro_partido} onChange={e => setFin(f => ({ ...f, pago_arbitro_partido: e.target.value }))} style={input} placeholder="0"/></div>
                    <div><label style={label}>Pago a árbitros por partido W ($)</label><input type="number" min="0" value={fin.pago_arbitro_w} onChange={e => setFin(f => ({ ...f, pago_arbitro_w: e.target.value }))} style={input} placeholder="0"/></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: '8px 20px', background: '#1a73e8', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#fff', fontSize: '.875rem', fontWeight: '500', opacity: loading ? .7 : 1 }}>
              {loading ? 'Guardando...' : editId ? 'Actualizar' : 'Crear torneo'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); setFin(FIN_EMPTY); setEditId(null) }}
              style={{ padding: '8px 20px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div style={{ marginBottom: '16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar torneo..." style={{ ...input, maxWidth: '320px' }}/>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6' }}>
            <Trophy size={40} style={{ opacity: .3, marginBottom: '12px' }}/>
            <div style={{ fontSize: '.875rem' }}>No hay torneos aún</div>
          </div>
        ) : (
          filtered.map((t, i) => (
            <div key={t.id} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < filtered.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={20} color="#1a73e8"/>
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem' }}>{t.name}</div>
                  <div style={{ color: '#9aa0a6', fontSize: '.75rem', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {t.city && <span>📍 {t.city}</span>}
                    {t.season && <span>· {t.season}</span>}
                    {t.modalidad && <span>· {t.modalidad}</span>}
                    {t.formato && <span>· {t.formato}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {esAdmin && t.organizador_id && (
                  <span title={organizadores[t.organizador_id] ? `Torneo de ${organizadores[t.organizador_id]}` : 'Torneo de un organizador'}
                    style={{ fontSize: '.72rem', color: '#6c35de', background: '#f3e8fd', borderRadius: '12px', padding: '3px 10px', fontWeight: '600' }}>
                    🏢 {organizadores[t.organizador_id] || 'Organizador'}
                  </span>
                )}
                {t.premium && <span style={{ fontSize: '.75rem', color: '#e8710a', background: '#fff4e5', borderRadius: '12px', padding: '3px 10px', fontWeight: '700' }}>⭐ Premium</span>}
                {t.genero && <span style={{ fontSize: '.75rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '12px', padding: '3px 10px' }}>{t.genero}</span>}
                {t.categoria && <span style={{ fontSize: '.75rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '12px', padding: '3px 10px' }}>{t.categoria}</span>}
                <span style={{ fontSize: '.75rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '12px', padding: '3px 10px' }}>Activo</span>
                {esAdmin && (
                  <button onClick={() => handleTogglePremium(t)} title={t.premium ? 'Quitar Premium' : 'Marcar como Premium (pago recibido)'}
                    style={{ background: t.premium ? '#fff4e5' : 'none', border: `1px solid ${t.premium ? '#ffd8a8' : '#dadce0'}`, borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: t.premium ? '#e8710a' : '#9aa0a6', display: 'flex', alignItems: 'center' }}>
                    <Star size={15} fill={t.premium ? '#e8710a' : 'none'}/>
                  </button>
                )}
                <button onClick={() => navigate(`/admin/torneos/${t.id}`)}
  style={{ background: 'none', border: '1px solid #1a73e8', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#1a73e8', display: 'flex', alignItems: 'center' }}>
  <Eye size={15}/>
</button>
                <button onClick={() => handleEdit(t)}
                  style={{ background: 'none', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                  <Pencil size={15}/>
                </button>
                <button onClick={() => handleDelete(t.id)}
                  style={{ background: 'none', border: '1px solid #fad2cf', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#d93025', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
