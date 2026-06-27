import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CARD_DESIGNS } from '../../components/card/designs/cardDesigns'
import PlayerCard from '../../components/card/PlayerCard'

const inp = {
  background: '#fff', border: '1px solid #dadce0', borderRadius: '8px',
  padding: '8px 12px', color: '#202124', fontSize: '.85rem', outline: 'none',
  fontFamily: 'system-ui, sans-serif', width: '100%', boxSizing: 'border-box',
}

const STAT_KEYS = [
  { value: 'pj',                       label: 'Partidos jugados' },
  { value: 'victorias',                 label: 'Victorias' },
  { value: 'goles',                     label: 'Goles' },
  { value: 'dobletes',                  label: 'Dobletes' },
  { value: 'hat_tricks',                label: 'Hat-tricks' },
  { value: 'racha_goles_actual',        label: 'Racha de goles consecutivos' },
  { value: 'racha_victorias_actual',    label: 'Racha de victorias consecutivas' },
  { value: 'arcos_cero',               label: 'Arcos en cero (portero)' },
  { value: 'partidos_sin_tarjetas',     label: 'Partidos sin tarjetas' },
  { value: 'campeonatos',               label: 'Campeonatos' },
  { value: 'mejor_arquero_count',       label: 'Premio Mejor Arquero' },
  { value: 'valla_menos_vencida_count', label: 'Premio Valla Menos Vencida' },
  { value: 'goleador_torneo_count',     label: 'Premio Goleador del torneo' },
]

const TIPOS_POSICION = [
  { value: 'universal', label: 'Universal (todos)' },
  { value: 'campo',     label: 'Solo campo' },
  { value: 'defensa',   label: 'Solo defensa' },
  { value: 'arquero',   label: 'Solo arquero' },
]

const COLORES = ['#00ee55','#0099ff','#dd8833','#cccccc','#ffcc00','#4488FF','#CC6622','#AAAACC','#FFCC00','#00CC66','#9955ff','#f9a825','#d93025','#00ddd0','#e8710a']

const GRUPOS_EXISTENTES = [
  { label: 'Iniciación',  ids: ['nivel1_verde','nivel1_azul','nivel1_bronce','nivel1_plata','nivel1_oro'],               color: '#00ee55' },
  { label: 'Competidor',  ids: ['nivel2_inicio','nivel2_bronce','nivel2_plata','nivel2_oro','nivel2_legendario'],         color: '#4488FF' },
  { label: 'Élite',       ids: ['nivel3_inicio','nivel3_bronce','nivel3_plata','nivel3_oro','nivel3_legendario'],         color: '#9955ff' },
  { label: 'Leyenda',     ids: ['premium_inicio','premium_bronce','premium_plata','premium_oro','premium_legendario'],    color: '#f9a825' },
]

export default function AdminTarjetasPage() {
  const [tab,              setTab]              = useState('sponsors')
  const [sponsors,         setSponsors]         = useState([])
  const [tarjetasCustom,   setTarjetasCustom]   = useState([])
  const [jugadores,        setJugadores]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [msg,              setMsg]              = useState(null)
  const [preview,          setPreview]          = useState(null)

  // Form nueva tarjeta
  const [formTarjeta, setFormTarjeta] = useState({
    nombre:      '',
    color:       '#00ee55',
    descripcion: '',
    sponsor:     '',
    sponsor_url: '',
    logros_requeridos: 3,
    logros: [{ nombre: '', tipo: 'universal', stat_key: 'pj', meta: 10 }],
  })
  const [creando, setCreando] = useState(false)

  // Notificacion
  const [notifMsg,    setNotifMsg]    = useState('')
  const [enviando,    setEnviando]    = useState(false)

  useEffect(() => { fetchTodo() }, [])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    const [{ data: spons }, { data: cards }, { data: jugs }] = await Promise.all([
      supabase.from('sponsors').select('*').order('card_id'),
      supabase.from('cards').select('*, card_levels(*)').order('orden'),
      supabase.from('players').select('id, name, activo_membresia').eq('activo_membresia', true),
    ])
    setSponsors(spons || [])
    // Solo tarjetas custom (orden > 4)
    setTarjetasCustom((cards || []).filter(c => c.orden > 4))
    setJugadores(jugs || [])
    setLoading(false)
  }

  // ── SPONSORS ──────────────────────────────────────────
  async function handleGuardarSponsor(cardId, data) {
    const existe = sponsors.find(s => s.card_id === cardId)
    if (existe) {
      await supabase.from('sponsors').update(data).eq('id', existe.id)
    } else {
      await supabase.from('sponsors').insert({ ...data, card_id: cardId, activo: true })
    }
    showMsg('Sponsor guardado ✓')
    fetchTodo()
  }

  async function handleSubirLogo(file, cardId) {
    const ext  = file.name.split('.').pop()
    const path = `sponsors/${cardId}.${ext}`
    await supabase.storage.from('players').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('players').getPublicUrl(path)
    return data.publicUrl
  }

  // ── CREAR TARJETA CUSTOM ──────────────────────────────
  function addLogro() {
    setFormTarjeta(f => ({ ...f, logros: [...f.logros, { nombre: '', tipo: 'universal', stat_key: 'pj', meta: 10 }] }))
  }

  function removeLogro(i) {
    setFormTarjeta(f => ({ ...f, logros: f.logros.filter((_, idx) => idx !== i) }))
  }

  function updateLogro(i, campo, valor) {
    setFormTarjeta(f => {
      const logros = [...f.logros]
      logros[i] = { ...logros[i], [campo]: valor }
      return { ...f, logros }
    })
  }

  async function handleCrearTarjeta() {
    if (!formTarjeta.nombre.trim()) { showMsg('Ingresa el nombre de la tarjeta', 'error'); return }
    if (formTarjeta.logros.length === 0) { showMsg('Agrega al menos 1 logro', 'error'); return }
    if (formTarjeta.logros.some(l => !l.nombre.trim())) { showMsg('Todos los logros deben tener nombre', 'error'); return }

    setCreando(true)

    // 1. Crear card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({ nombre: formTarjeta.nombre.trim(), orden: 99, color: formTarjeta.color, icono: '⭐', descripcion: formTarjeta.descripcion })
      .select().single()

    if (cardError) { showMsg('Error al crear tarjeta', 'error'); setCreando(false); return }

    // 2. Crear card_level único
    const { data: level, error: levelError } = await supabase
      .from('card_levels')
      .insert({ card_id: card.id, subnivel: 1, nombre: formTarjeta.nombre.trim(), card_design_id: `custom_${card.id}`, logros_requeridos: formTarjeta.logros_requeridos })
      .select().single()

    if (levelError) { showMsg('Error al crear nivel', 'error'); setCreando(false); return }

    // 3. Crear logros
    const logrosInsert = formTarjeta.logros.map((l, i) => ({
      card_level_id: level.id,
      nombre:        l.nombre.trim(),
      tipo:          l.tipo,
      stat_key:      l.stat_key,
      meta:          Number(l.meta),
      orden:         i + 1,
    }))
    await supabase.from('achievements').insert(logrosInsert)

    // 4. Crear sponsor si hay
    if (formTarjeta.sponsor.trim()) {
      await supabase.from('sponsors').insert({
        card_id:   `custom_${card.id}`,
        nombre:    formTarjeta.sponsor.trim(),
        url:       formTarjeta.sponsor_url,
        activo:    true,
      })
    }

    // 5. Notificar a todos los jugadores activos
    const notifs = jugadores.map(j => ({
      player_id: j.id,
      tipo:      'nueva_tarjeta',
      titulo:    '¡Nueva tarjeta disponible! ⭐',
      mensaje:   `${formTarjeta.sponsor ? formTarjeta.sponsor + ' presenta: ' : ''}La tarjeta "${formTarjeta.nombre}" ya está disponible. ¡Completa los logros y desbloquéala!`,
      data:      { card_id: card.id, card_nombre: formTarjeta.nombre, color: formTarjeta.color },
    }))
    if (notifs.length > 0) await supabase.from('player_notifications').insert(notifs)

    showMsg(`Tarjeta "${formTarjeta.nombre}" creada y ${jugadores.length} jugadores notificados ✓`)
    setFormTarjeta({ nombre: '', color: '#00ee55', descripcion: '', sponsor: '', sponsor_url: '', logros_requeridos: 3, logros: [{ nombre: '', tipo: 'universal', stat_key: 'pj', meta: 10 }] })
    setCreando(false)
    fetchTodo()
  }

  // ── NOTIFICACION MANUAL ───────────────────────────────
  async function handleEnviarNotif() {
    if (!notifMsg.trim()) { showMsg('Escribe un mensaje', 'error'); return }
    setEnviando(true)
    const notifs = jugadores.map(j => ({
      player_id: j.id,
      tipo:      'manual',
      titulo:    '📢 Mensaje de Golmebol',
      mensaje:   notifMsg.trim(),
    }))
    await supabase.from('player_notifications').insert(notifs)
    showMsg(`Notificación enviada a ${jugadores.length} jugadores ✓`)
    setNotifMsg('')
    setEnviando(false)
  }

  const statsDemo = { pj: 99, golesContra: 45, promedio: 2.1, eficacia: 88, pg: 70, pe: 10, pp: 19 }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setPreview(null)}>
          <div style={{ width: '100%', maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
            <PlayerCard playerName="JUGADOR" stats={statsDemo} cardType={preview} hideShields={true}/>
            <button onClick={() => setPreview(null)}
              style={{ display: 'block', margin: '16px auto 0', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '8px', padding: '8px 24px', cursor: 'pointer', color: '#fff', fontSize: '.85rem' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#202124', margin: '0 0 4px' }}>Tarjetas</h1>
        <p style={{ color: '#5f6368', margin: 0, fontSize: '.875rem' }}>Gestiona sponsors, crea tarjetas personalizadas y notifica jugadores</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f1f3f4', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {[
          { id: 'sponsors', label: '✦ Sponsors' },
          { id: 'crear',    label: '＋ Nueva tarjeta' },
          { id: 'notif',    label: '📢 Notificar' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '.82rem', fontWeight: '600', background: tab === t.id ? '#fff' : 'transparent', color: tab === t.id ? '#1a73e8' : '#5f6368', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB SPONSORS ── */}
      {tab === 'sponsors' && (
        <div>
          {GRUPOS_EXISTENTES.map(grupo => (
            <div key={grupo.label} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: grupo.color }}/>
                <span style={{ fontSize: '.9rem', fontWeight: '600', color: '#202124' }}>{grupo.label}</span>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden' }}>
                {grupo.ids.map((cardId, i) => {
                  const design   = CARD_DESIGNS.find(d => d.id === cardId)
                  const sponsor  = sponsors.find(s => s.card_id === cardId)
                  if (!design) return null
                  return (
                    <SponsorRow key={cardId} cardId={cardId} design={design} sponsor={sponsor}
                      borderBottom={i < grupo.ids.length - 1}
                      onSave={handleGuardarSponsor} onSubirLogo={handleSubirLogo}
                      onPreview={() => setPreview(cardId)}/>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Tarjetas custom */}
          {tarjetasCustom.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: '#e8710a' }}/>
                <span style={{ fontSize: '.9rem', fontWeight: '600', color: '#202124' }}>Tarjetas personalizadas</span>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden' }}>
                {tarjetasCustom.map((card, i) => (
                  <div key={card.id} style={{ padding: '14px 16px', borderBottom: i < tarjetasCustom.length - 1 ? '1px solid #f1f3f4' : 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.color || '#e8710a', flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{card.nombre}</div>
                      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>Tarjeta personalizada · {card.card_levels?.length || 0} nivel</div>
                    </div>
                    <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '20px', padding: '2px 10px' }}>Custom</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CREAR ── */}
      {tab === 'crear' && (
        <div style={{ maxWidth: '680px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '20px' }}>Nueva tarjeta personalizada</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Nombre */}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Nombre de la tarjeta *</label>
                <input value={formTarjeta.nombre} onChange={e => setFormTarjeta(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: LA BESTIA" style={inp}/>
              </div>

              {/* Descripción */}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Descripción</label>
                <input value={formTarjeta.descripcion} onChange={e => setFormTarjeta(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Tarjeta exclusiva del torneo de verano" style={inp}/>
              </div>

              {/* Color */}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '8px' }}>Color de la tarjeta</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {COLORES.map(c => (
                    <div key={c} onClick={() => setFormTarjeta(f => ({ ...f, color: c }))}
                      style={{ width: '32px', height: '32px', borderRadius: '8px', background: c, cursor: 'pointer', border: formTarjeta.color === c ? '3px solid #202124' : '2px solid transparent', transition: 'all .15s' }}/>
                  ))}
                  <input type="color" value={formTarjeta.color} onChange={e => setFormTarjeta(f => ({ ...f, color: e.target.value }))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #dadce0', padding: '2px' }}/>
                </div>
                {/* Preview color */}
                <div style={{ marginTop: '10px', width: '60px', height: '60px', borderRadius: '12px', background: `linear-gradient(135deg, ${formTarjeta.color}, ${formTarjeta.color}88)`, border: `2px solid ${formTarjeta.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', color: '#fff', fontWeight: '700' }}>
                  Preview
                </div>
              </div>

              {/* Sponsor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Patrocinador</label>
                  <input value={formTarjeta.sponsor} onChange={e => setFormTarjeta(f => ({ ...f, sponsor: e.target.value }))} placeholder="Ej: Nike" style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>URL del patrocinador</label>
                  <input value={formTarjeta.sponsor_url} onChange={e => setFormTarjeta(f => ({ ...f, sponsor_url: e.target.value }))} placeholder="https://..." style={inp}/>
                </div>
              </div>

              {/* Logros requeridos */}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Logros requeridos para desbloquear</label>
                <input type="number" min="1" max={formTarjeta.logros.length} value={formTarjeta.logros_requeridos}
                  onChange={e => setFormTarjeta(f => ({ ...f, logros_requeridos: parseInt(e.target.value) }))} style={{ ...inp, width: '80px' }}/>
                <span style={{ fontSize: '.72rem', color: '#9aa0a6', marginLeft: '8px' }}>de {formTarjeta.logros.length} logros totales</span>
              </div>

              {/* Logros */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368' }}>Logros *</label>
                  <button onClick={addLogro}
                    style={{ padding: '5px 12px', background: '#e8f0fe', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#1a73e8', fontSize: '.78rem', fontWeight: '600' }}>
                    + Agregar logro
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {formTarjeta.logros.map((logro, i) => (
                    <div key={i} style={{ background: '#f8f9fa', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e8eaed' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontSize: '.75rem', fontWeight: '700', color: '#5f6368' }}>Logro {i + 1}</span>
                        {formTarjeta.logros.length > 1 && (
                          <button onClick={() => removeLogro(i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d93025', fontSize: '.75rem' }}>✕ Eliminar</button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '.7rem', color: '#9aa0a6', display: 'block', marginBottom: '3px' }}>Nombre</label>
                          <input value={logro.nombre} onChange={e => updateLogro(i, 'nombre', e.target.value)} placeholder="Ej: Marcar 3 goles" style={inp}/>
                        </div>
                        <div>
                          <label style={{ fontSize: '.7rem', color: '#9aa0a6', display: 'block', marginBottom: '3px' }}>Posición</label>
                          <select value={logro.tipo} onChange={e => updateLogro(i, 'tipo', e.target.value)} style={inp}>
                            {TIPOS_POSICION.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '.7rem', color: '#9aa0a6', display: 'block', marginBottom: '3px' }}>Stat</label>
                          <select value={logro.stat_key} onChange={e => updateLogro(i, 'stat_key', e.target.value)} style={inp}>
                            {STAT_KEYS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '.7rem', color: '#9aa0a6', display: 'block', marginBottom: '3px' }}>Meta</label>
                          <input type="number" min="1" value={logro.meta} onChange={e => updateLogro(i, 'meta', e.target.value)} style={inp}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleCrearTarjeta} disabled={creando}
                style={{ padding: '12px', background: creando ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: creando ? 'not-allowed' : 'pointer', color: creando ? '#9aa0a6' : '#fff', fontWeight: '700', fontSize: '.95rem' }}>
                {creando ? 'Creando...' : '✅ Crear tarjeta y notificar jugadores'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB NOTIFICAR ── */}
      {tab === 'notif' && (
        <div style={{ maxWidth: '500px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '1rem', marginBottom: '6px' }}>Enviar notificación a jugadores</div>
            <div style={{ fontSize: '.78rem', color: '#5f6368', marginBottom: '20px' }}>
              Se enviará a <b>{jugadores.length}</b> jugadores con membresía activa
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '5px' }}>Mensaje</label>
                <textarea value={notifMsg} onChange={e => setNotifMsg(e.target.value)} placeholder="Ej: ¡Nueva tarjeta disponible! Entra y mira los logros que debes cumplir..."
                  rows={4} style={{ ...inp, resize: 'vertical' }}/>
              </div>
              <button onClick={handleEnviarNotif} disabled={enviando || !notifMsg.trim()}
                style={{ padding: '11px', background: enviando || !notifMsg.trim() ? '#dadce0' : '#1a73e8', border: 'none', borderRadius: '10px', cursor: enviando || !notifMsg.trim() ? 'not-allowed' : 'pointer', color: enviando || !notifMsg.trim() ? '#9aa0a6' : '#fff', fontWeight: '600', fontSize: '.9rem' }}>
                {enviando ? 'Enviando...' : `📢 Enviar a ${jugadores.length} jugadores`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente fila de sponsor ──────────────────────────
function SponsorRow({ cardId, design, sponsor, borderBottom, onSave, onSubirLogo, onPreview }) {
  const [nombre,     setNombre]     = useState(sponsor?.nombre    || '')
  const [url,        setUrl]        = useState(sponsor?.url       || '')
  const [logoUrl,    setLogoUrl]    = useState(sponsor?.logo_url  || '')
  const [activo,     setActivo]     = useState(sponsor?.activo    ?? true)
  const [uploading,  setUploading]  = useState(false)
  const [guardando,  setGuardando]  = useState(false)

  async function handleLogo(file) {
    if (!file) return
    setUploading(true)
    const url = await onSubirLogo(file, cardId)
    setLogoUrl(url)
    setUploading(false)
  }

  async function handleGuardar() {
    setGuardando(true)
    await onSave(cardId, { nombre, url, logo_url: logoUrl, activo })
    setGuardando(false)
  }

  return (
    <div style={{ borderBottom: borderBottom ? '1px solid #f1f3f4' : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
        {/* Color */}
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `linear-gradient(135deg, ${design.color}, ${design.colorSecundario || design.color})`, flexShrink: 0 }}/>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem' }}>{design.nombre}</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Logo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {logoUrl && <img src={logoUrl} style={{ height: '28px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e8eaed' }}/>}
              <label style={{ fontSize: '.7rem', color: '#1a73e8', cursor: 'pointer', padding: '4px 8px', border: '1px solid #1a73e8', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                {uploading ? 'Subiendo...' : logoUrl ? '↑ Cambiar logo' : '↑ Subir logo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogo(e.target.files[0])} disabled={uploading}/>
              </label>
            </div>
            {/* Nombre */}
            <div style={{ flex: 1, minWidth: '100px' }}>
              <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginBottom: '2px' }}>Patrocinador</div>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" style={{ ...{ background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', color: '#202124', fontSize: '.78rem', outline: 'none', width: '100%', boxSizing: 'border-box' } }}/>
            </div>
            {/* URL */}
            <div style={{ flex: 2, minWidth: '140px' }}>
              <div style={{ fontSize: '.68rem', color: '#9aa0a6', marginBottom: '2px' }}>URL</div>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={{ ...{ background: '#fff', border: '1px solid #dadce0', borderRadius: '6px', padding: '5px 8px', color: '#202124', fontSize: '.78rem', outline: 'none', width: '100%', boxSizing: 'border-box' } }}/>
            </div>
            {/* Activo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} id={`activo_${cardId}`}/>
              <label htmlFor={`activo_${cardId}`} style={{ fontSize: '.72rem', color: '#5f6368', cursor: 'pointer' }}>Activo</label>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
          <button onClick={onPreview}
            style={{ padding: '5px 10px', background: '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#5f6368', fontSize: '.72rem' }}>
            👁 Ver
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            style={{ padding: '5px 10px', background: '#e8f0fe', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#1a73e8', fontSize: '.72rem', fontWeight: '600' }}>
            {guardando ? '...' : '💾 Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
