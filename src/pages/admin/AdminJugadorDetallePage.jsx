import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Trophy, Target, AlertTriangle, TrendingUp, Camera, Pencil, Check, X, User } from 'lucide-react'
import PlayerCard from '../../components/card/PlayerCard'

function calcEdad(fecha) {
  if (!fecha) return null
  const hoy = new Date(), nac = new Date(fecha)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function getCardType(pj) {
  if (pj < 10) return 'nivel1_verde'
  if (pj < 25) return 'nivel2_inicio'
  return 'nivel3_inicio'
}

const POSICIONES = {
  'Fútbol 5':  ['Portero','Cierre','Ala derecha','Ala izquierda','Pivot'],
  'Fútbol 7':  ['Portero','Defensa central','Lateral derecho','Lateral izquierdo','Mediocampista','Extremo derecho','Extremo izquierdo','Delantero'],
  'Fútbol 11': ['Portero','Defensa central','Lateral derecho','Lateral izquierdo','Mediocampista defensivo','Mediocampista central','Mediocampista ofensivo','Extremo derecho','Extremo izquierdo','Delantero centro','Segunda punta'],
}
const GENEROS = ['Masculino','Femenino']

export default function AdminJugadorDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [jugador, setJugador]     = useState(null)
  const [stats, setStats]         = useState(null)
  const [historial, setHistorial] = useState([])
  const [torneos, setTorneos]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('resumen')
  const [msg, setMsg]             = useState(null)
  const [editando, setEditando]   = useState(false)
  const [form, setForm]           = useState({})
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo]   = useState({})

  useEffect(() => { fetchTodo() }, [id])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTodo() {
    setLoading(true)
    const [jugRes, statsRes, torneosRes] = await Promise.all([
      supabase.from('players').select('*').eq('id', id).single(),
      supabase.from('player_match_stats')
        .select('*, matches(id,played_at,home_score,away_score,home:home_team_id(name,logo_url),away:away_team_id(name,logo_url)), teams(id,name,logo_url), tournaments(id,name,modalidad)')
        .eq('player_id', id),
      supabase.from('tournament_player_registrations')
        .select('*, teams(id,name,logo_url), tournaments(id,name,modalidad,season)')
        .eq('player_id', id).eq('activo', true),
    ])
    setJugador(jugRes.data)
    const raw       = statsRes.data || []
    const pj        = raw.length
    const goles     = raw.reduce((s,r) => s + (r.goals_scored || 0), 0)
    const amarillas = raw.reduce((s,r) => s + (r.yellow_cards || 0), 0)
    const azules    = raw.reduce((s,r) => s + (r.blue_cards   || 0), 0)
    const rojas     = raw.reduce((s,r) => s + (r.red_cards    || 0), 0)
    const faltas    = raw.reduce((s,r) => s + (r.fouls        || 0), 0)
    const pg        = raw.filter(r => r.team_result === 'win').length
    const pe        = raw.filter(r => r.team_result === 'draw').length
    const pp        = raw.filter(r => r.team_result === 'loss').length
    const eficacia  = pj > 0 ? Math.round((pg/pj)*100) : 0
    const promedio  = pj > 0 ? parseFloat((goles/pj).toFixed(2)) : 0
    setStats({ pj, goles, amarillas, azules, rojas, faltas, pg, pe, pp, eficacia, promedio })
    setHistorial(raw.filter(r => r.matches).sort((a,b) => new Date(b.matches?.played_at||0) - new Date(a.matches?.played_at||0)))
    setTorneos(torneosRes.data || [])
    setLoading(false)
  }

  function handleEditar() {
    setForm({
      name: jugador.name||'', telefono: jugador.telefono||'',
      numero_cedula: jugador.numero_cedula||'', city: jugador.city||'',
      genero: jugador.genero||'', fecha_nacimiento: jugador.fecha_nacimiento||'',
      posicion_futbol5: jugador.posicion_futbol5||'',
      posicion_futbol7: jugador.posicion_futbol7||'',
      posicion_futbol11: jugador.posicion_futbol11||'',
    })
    setEditando(true)
  }

  async function handleGuardar() {
    if (!form.name) return showMsg('El nombre es obligatorio', 'error')
    setGuardando(true)
    const { error } = await supabase.from('players').update(form).eq('id', id)
    if (error) showMsg('Error al guardar', 'error')
    else { showMsg('Guardado ✓'); setEditando(false); fetchTodo() }
    setGuardando(false)
  }

  async function handleSubirFoto(file, tipo) {
    if (!file) return
    setSubiendo(s => ({ ...s, [tipo]: true }))
    const ext   = file.name.split('.').pop()
    const path  = `fotos/${id}_${tipo}.${ext}`
    const campo = tipo === 'tarjeta' ? 'photo_url' : 'photo_face_url'
    const { error } = await supabase.storage.from('players').upload(path, file, { upsert: true })
    if (error) { showMsg('Error al subir foto', 'error'); setSubiendo(s => ({ ...s, [tipo]: false })); return }
    const { data: urlData } = supabase.storage.from('players').getPublicUrl(path)
    await supabase.from('players').update({ [campo]: urlData.publicUrl }).eq('id', id)
    setJugador(prev => ({ ...prev, [campo]: urlData.publicUrl }))
    showMsg(`Foto ${tipo === 'tarjeta' ? 'de tarjeta' : 'de perfil'} actualizada ✓`)
    setSubiendo(s => ({ ...s, [tipo]: false }))
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#9aa0a6' }}>Cargando perfil...</div>
  if (!jugador) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Jugador no encontrado</div>

  const edad       = calcEdad(jugador.fecha_nacimiento)
  const cardType   = getCardType(stats?.pj || 0)
  const nivelLabel = cardType.startsWith('nivel3') ? 'NIVEL 3' : cardType.startsWith('nivel2') ? 'NIVEL 2' : 'NIVEL 1'

  // Es portero si en cualquier modalidad tiene la posición Portero
  const esPortero =
    jugador.posicion_futbol5  === 'Portero' ||
    jugador.posicion_futbol7  === 'Portero' ||
    jugador.posicion_futbol11 === 'Portero'

  const cardStats = {
    pj:          stats?.pj       || 0,
    golesContra: stats?.goles    || 0,  // portero: goles recibidos / campo: goles anotados
    promedio:    stats?.promedio || 0,
    eficacia:    stats?.eficacia || 0,
    pg:          stats?.pg       || 0,
    pe:          stats?.pe       || 0,
    pp:          stats?.pp       || 0,
  }

  // Escala: la tarjeta renderiza en 420px (tamaño real idéntico a HomePage)
  const CARD_REAL_W = 420
  const SCALE       = 0.62
  const CARD_REAL_H = CARD_REAL_W * 1.55
  const visibleW    = CARD_REAL_W * SCALE
  const visibleH    = CARD_REAL_H * SCALE

  const inp = { width: '100%', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '8px 12px', color: '#202124', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: '.75rem', fontWeight: '500', color: '#5f6368', display: 'block', marginBottom: '4px' }

  const TABS = [
    { id: 'resumen',   label: 'Resumen'  },
    { id: 'historial', label: 'Partidos' },
    { id: 'torneos',   label: 'Torneos'  },
  ]

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 200, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      <button onClick={() => navigate('/admin/jugadores')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#5f6368', fontSize: '.875rem', marginBottom: '24px' }}>
        <ArrowLeft size={16}/> Volver a jugadores
      </button>

      {/* ── HERO ── */}
      <div style={{ display: 'flex', gap: '32px', marginBottom: '28px', alignItems: 'flex-start' }}>

        {/* Columna izquierda: tarjeta escalada + slots de foto */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>

          {/* Wrapper que reserva espacio visual exacto */}
          <div style={{ width: visibleW, height: visibleH, position: 'relative', borderRadius: '18px', overflow: 'hidden' }}>
            {/* Fondo oscuro igual a HomePage */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 85% 50% at 50% -5%,rgba(0,35,110,.38) 0%,transparent 62%), #07070e',
            }}/>
            {/* Tarjeta en tamaño real, reducida con transform — proporciones y fuentes idénticas */}
            <div style={{
              width: CARD_REAL_W,
              transformOrigin: 'top left',
              transform: `scale(${SCALE})`,
              padding: '20px 12px',
              position: 'absolute',
              top: 0, left: 0,
            }}>
              <PlayerCard
                playerName={jugador.name?.toUpperCase().split(' ')[0] || 'JUGADOR'}
                stats={cardStats}
                cardType={cardType}
                hideShields={true}
                photoUrlExterno={jugador.photo_url || null}
                esPortero={esPortero}
              />
            </div>
          </div>

          {/* Badge portero / jugador de campo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '.72rem', fontWeight: '600', padding: '3px 10px', borderRadius: '10px',
              background: esPortero ? '#e8f0fe' : '#e6f4ea',
              color: esPortero ? '#1a73e8' : '#1e8e3e',
              border: esPortero ? '1px solid #1a73e8aa' : '1px solid #1e8e3eaa',
            }}>
              {esPortero ? '🧤 Portero' : '⚽ Jugador de campo'}
            </span>
          </div>

          {/* Slots de foto */}
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {/* Foto tarjeta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '10px', background: '#f1f3f4', border: '2px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {jugador.photo_url
                  ? <img src={jugador.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                  : <Camera size={22} color="#9aa0a6"/>}
              </div>
              <span style={{ fontSize: '.65rem', color: '#5f6368', textAlign: 'center' }}>Foto tarjeta</span>
              <label style={{ fontSize: '.68rem', color: '#1a73e8', cursor: 'pointer', border: '1px solid #1a73e8', borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap' }}>
                {subiendo.tarjeta ? 'Subiendo...' : jugador.photo_url ? 'Cambiar' : '+ Subir'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSubirFoto(e.target.files[0], 'tarjeta')} disabled={subiendo.tarjeta}/>
              </label>
            </div>

            {/* Foto cara */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f1f3f4', border: '2px solid #e8eaed', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {jugador.photo_face_url
                  ? <img src={jugador.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <User size={22} color="#9aa0a6"/>}
              </div>
              <span style={{ fontSize: '.65rem', color: '#5f6368', textAlign: 'center' }}>Foto perfil</span>
              <label style={{ fontSize: '.68rem', color: '#1e8e3e', cursor: 'pointer', border: '1px solid #1e8e3e', borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap' }}>
                {subiendo.cara ? 'Subiendo...' : jugador.photo_face_url ? 'Cambiar' : '+ Subir'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleSubirFoto(e.target.files[0], 'cara')} disabled={subiendo.cara}/>
              </label>
            </div>
          </div>
        </div>

        {/* Columna derecha: datos */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Header nombre + editar */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f3f4', border: '2px solid #e8eaed', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {jugador.photo_face_url
                    ? <img src={jugador.photo_face_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : jugador.photo_url
                    ? <img src={jugador.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
                    : <User size={20} color="#9aa0a6"/>}
                </div>
                <div>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#202124', margin: '0 0 5px' }}>{jugador.name}</h1>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {jugador.posicion_futbol5  && <span style={{ fontSize: '.72rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 8px', fontWeight: '500' }}>F5: {jugador.posicion_futbol5}</span>}
                    {jugador.posicion_futbol7  && <span style={{ fontSize: '.72rem', color: '#1e8e3e', background: '#e6f4ea', borderRadius: '10px', padding: '2px 8px', fontWeight: '500' }}>F7: {jugador.posicion_futbol7}</span>}
                    {jugador.posicion_futbol11 && <span style={{ fontSize: '.72rem', color: '#e8710a', background: '#fce8d9', borderRadius: '10px', padding: '2px 8px', fontWeight: '500' }}>F11: {jugador.posicion_futbol11}</span>}
                    <span style={{ fontSize: '.72rem', color: '#fff', background: '#1a73e8', borderRadius: '10px', padding: '2px 8px', fontWeight: '600' }}>{nivelLabel}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {!editando ? (
                  <button onClick={handleEditar}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f1f3f4', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem', fontWeight: '500' }}>
                    <Pencil size={14}/> Editar datos
                  </button>
                ) : (
                  <>
                    <button onClick={handleGuardar} disabled={guardando}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#1e8e3e', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: '.8rem', fontWeight: '500', opacity: guardando ? .7 : 1 }}>
                      <Check size={14}/> {guardando ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditando(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#5f6368', fontSize: '.8rem' }}>
                      <X size={14}/> Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            {!editando ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { l: 'Ciudad',           v: jugador.city || '—' },
                  { l: 'Género',           v: jugador.genero || '—' },
                  { l: 'Edad',             v: edad ? `${edad} años` : '—' },
                  { l: 'Cédula',           v: jugador.numero_cedula || '—' },
                  { l: 'Teléfono',         v: jugador.telefono || '—' },
                  { l: 'Fecha nacimiento', v: jugador.fecha_nacimiento ? new Date(jugador.fecha_nacimiento+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : '—' },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <div style={{ fontSize: '.7rem', color: '#9aa0a6', fontWeight: '500' }}>{l}</div>
                    <div style={{ fontSize: '.875rem', color: '#202124', fontWeight: '500', marginTop: '1px' }}>{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div><label style={lbl}>Nombre *</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp}/></div>
                  <div><label style={lbl}>Teléfono</label><input value={form.telefono} onChange={e => setForm(f=>({...f,telefono:e.target.value}))} style={inp}/></div>
                  <div><label style={lbl}>Cédula</label><input value={form.numero_cedula} onChange={e => setForm(f=>({...f,numero_cedula:e.target.value}))} style={inp}/></div>
                  <div><label style={lbl}>Ciudad</label><input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} style={inp}/></div>
                  <div>
                    <label style={lbl}>Género</label>
                    <select value={form.genero} onChange={e => setForm(f=>({...f,genero:e.target.value}))} style={inp}>
                      <option value="">Seleccionar</option>
                      {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Fecha nacimiento</label><input type="date" value={form.fecha_nacimiento} onChange={e => setForm(f=>({...f,fecha_nacimiento:e.target.value}))} style={inp}/></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {Object.entries(POSICIONES).map(([modalidad, posiciones]) => {
                    const key = `posicion_${modalidad.toLowerCase().replace('ú','u').replace(' ','')}`
                    return (
                      <div key={modalidad}>
                        <label style={lbl}>{modalidad}</label>
                        <select value={form[key]||''} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} style={inp}>
                          <option value="">No juega</option>
                          {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Stats rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { icon: <Trophy size={18} color="#f9a825"/>,        label: esPortero ? 'Goles rec.' : 'Goles',  value: stats?.goles    ?? 0,                        color: '#f9a825', bg: '#fffde7' },
              { icon: <Target size={18} color="#1a73e8"/>,        label: 'Partidos', value: stats?.pj       ?? 0,                        color: '#1a73e8', bg: '#e8f0fe' },
              { icon: <TrendingUp size={18} color="#1e8e3e"/>,    label: 'Victorias',value: stats?.pg       ?? 0,                        color: '#1e8e3e', bg: '#e6f4ea' },
              { icon: <AlertTriangle size={18} color="#d93025"/>, label: 'Tarjetas', value: (stats?.amarillas??0)+(stats?.rojas??0),     color: '#d93025', bg: '#fce8e6' },
            ].map(({ icon, label, value, color, bg }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{icon}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '.65rem', color, opacity: .7, fontWeight: '600', marginTop: '2px' }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Progreso de nivel */}
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>Progreso de nivel</span>
              <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>{stats?.pj || 0} PJ jugados</span>
            </div>
            {(() => {
              const pj       = stats?.pj || 0
              const meta     = pj < 10 ? 10 : pj < 25 ? 25 : 100
              const base     = pj < 10 ?  0 : pj < 25 ? 10 : 25
              const progreso = Math.min(((pj-base)/(meta-base))*100, 100)
              const siguiente = pj < 10 ? 'Nivel 2' : pj < 25 ? 'Nivel 3' : '¡Máximo!'
              return (
                <>
                  <div style={{ background: '#f1f3f4', borderRadius: '6px', height: '8px', marginBottom: '6px' }}>
                    <div style={{ height: '100%', borderRadius: '6px', width: `${progreso}%`, background: 'linear-gradient(90deg,#1a73e8,#9955ff)', transition: 'width .5s' }}/>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '.7rem', color: '#9aa0a6' }}>{nivelLabel}</span>
                    <span style={{ fontSize: '.7rem', color: '#1a73e8', fontWeight: '500' }}>{siguiente} — {Math.max(0,meta-pj)} PJ restantes</span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px', padding: '4px', width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500', transition: 'all .15s', background: tab === t.id ? '#1a73e8' : 'transparent', color: tab === t.id ? '#fff' : '#5f6368' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB RESUMEN */}
      {tab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>Rendimiento general</div>
            {(stats?.pj||0) === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#9aa0a6', fontSize: '.875rem' }}>Sin partidos registrados</div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '.75rem', color: '#5f6368' }}>Resultados ({stats.pj} PJ)</span>
                    <span style={{ fontSize: '.75rem', color: '#9aa0a6' }}>{stats.eficacia}% efectividad</span>
                  </div>
                  <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '12px' }}>
                    <div style={{ width: `${(stats.pg/stats.pj)*100}%`, background: '#1e8e3e' }}/>
                    <div style={{ width: `${(stats.pe/stats.pj)*100}%`, background: '#f9a825' }}/>
                    <div style={{ width: `${(stats.pp/stats.pj)*100}%`, background: '#d93025' }}/>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    {[{l:`${stats.pg} V`,c:'#1e8e3e'},{l:`${stats.pe} E`,c:'#f9a825'},{l:`${stats.pp} D`,c:'#d93025'}].map(({l,c}) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }}/>
                        <span style={{ fontSize: '.7rem', color: '#5f6368' }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {[
                  { l: esPortero ? 'Goles recibidos' : 'Goles anotados', v: stats.goles    },
                  { l: esPortero ? 'Promedio recibidos/PJ' : 'Goles por partido', v: stats.promedio },
                  { l: 'Faltas totales',    v: stats.faltas   },
                ].map(({l,v},i,arr) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i<arr.length-1?'1px solid #f1f3f4':'none' }}>
                    <span style={{ fontSize: '.8rem', color: '#5f6368' }}>{l}</span>
                    <span style={{ fontSize: '.875rem', fontWeight: '600', color: '#202124' }}>{v}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>Disciplina</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {l:'Tarjetas amarillas',v:stats?.amarillas??0,color:'#f9a825',bg:'#fffde7'},
                {l:'Tarjetas azules',   v:stats?.azules??0,   color:'#4488ff',bg:'#e8f0fe'},
                {l:'Tarjetas rojas',    v:stats?.rojas??0,    color:'#d93025',bg:'#fce8e6'},
              ].map(({l,v,color,bg}) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: bg, borderRadius: '8px' }}>
                  <span style={{ fontSize: '.8rem', color: '#5f6368', fontWeight: '500' }}>{l}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', gridColumn: '1 / -1' }}>
            <div style={{ fontWeight: '600', color: '#202124', fontSize: '.9rem', marginBottom: '16px' }}>Posiciones por modalidad</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                {mod:'Fútbol 5', pos:jugador.posicion_futbol5, color:'#1a73e8',bg:'#e8f0fe'},
                {mod:'Fútbol 7', pos:jugador.posicion_futbol7, color:'#1e8e3e',bg:'#e6f4ea'},
                {mod:'Fútbol 11',pos:jugador.posicion_futbol11,color:'#e8710a',bg:'#fce8d9'},
              ].map(({mod,pos,color,bg}) => (
                <div key={mod} style={{ background: pos?bg:'#f8f9fa', borderRadius: '10px', padding: '14px', textAlign: 'center', border: pos?`1px solid ${color}22`:'1px solid #e8eaed' }}>
                  <div style={{ fontSize: '.7rem', color: pos?color:'#9aa0a6', fontWeight: '600', marginBottom: '4px' }}>{mod}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: '700', color: pos?color:'#dadce0' }}>{pos||'No juega'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB HISTORIAL */}
      {tab === 'historial' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 60px 44px 44px 44px 44px', padding: '10px 16px', background: '#f8f9fa', borderBottom: '1px solid #e8eaed', fontSize: '.72rem', fontWeight: '600', color: '#5f6368' }}>
            <div>PARTIDO</div>
            <div style={{textAlign:'center'}}>EQUIPO</div>
            <div style={{textAlign:'center'}}>RES</div>
            <div style={{textAlign:'center',color:'#f9a825'}}>⚽</div>
            <div style={{textAlign:'center',color:'#f9a825'}}>🟨</div>
            <div style={{textAlign:'center',color:'#4488ff'}}>🟦</div>
            <div style={{textAlign:'center',color:'#d93025'}}>🟥</div>
          </div>
          {historial.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>Sin partidos registrados</div>
          ) : historial.map((h,i) => {
            const m  = h.matches
            const rc = h.team_result==='win'?'#1e8e3e':h.team_result==='draw'?'#f9a825':'#d93025'
            const rl = h.team_result==='win'?'V':h.team_result==='draw'?'E':'D'
            const fecha = m?.played_at ? new Date(m.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : '—'
            return (
              <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 60px 44px 44px 44px 44px', padding: '12px 16px', borderBottom: i<historial.length-1?'1px solid #f1f3f4':'none', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '.8rem', fontWeight: '600', color: '#202124' }}>{m?.home?.name} vs {m?.away?.name}</div>
                  <div style={{ fontSize: '.7rem', color: '#9aa0a6', marginTop: '2px' }}>{fecha} · {h.tournaments?.name||'—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  {h.teams?.logo_url && <img src={h.teams.logo_url} style={{ width: '16px', height: '16px', objectFit: 'contain' }}/>}
                  <span style={{ fontSize: '.72rem', color: '#5f6368' }}>{h.teams?.name||'—'}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '.8rem', fontWeight: '700', color: rc, background: `${rc}18`, borderRadius: '6px', padding: '2px 10px' }}>{rl}</span>
                </div>
                <div style={{ textAlign: 'center', fontWeight: '700', color: '#f9a825', fontSize: '.875rem' }}>{h.goals_scored||'—'}</div>
                <div style={{ textAlign: 'center', fontWeight: '700', color: '#f9a825', fontSize: '.875rem' }}>{h.yellow_cards||'—'}</div>
                <div style={{ textAlign: 'center', fontWeight: '700', color: '#4488ff', fontSize: '.875rem' }}>{h.blue_cards  ||'—'}</div>
                <div style={{ textAlign: 'center', fontWeight: '700', color: '#d93025', fontSize: '.875rem' }}>{h.red_cards   ||'—'}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* TAB TORNEOS */}
      {tab === 'torneos' && (
        <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          {torneos.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9aa0a6', fontSize: '.875rem' }}>
              <Trophy size={36} style={{ opacity: .3, display: 'block', margin: '0 auto 8px' }}/>
              Sin torneos registrados
            </div>
          ) : torneos.map((t,i) => {
            const sT  = historial.filter(h => h.tournament_id === t.tournament_id)
            const gT  = sT.reduce((s,h) => s+(h.goals_scored||0), 0)
            const pjT = sT.length
            const pgT = sT.filter(h => h.team_result==='win').length
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i<torneos.length-1?'1px solid #f1f3f4':'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trophy size={18} color="#1a73e8"/>
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{t.tournaments?.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {t.tournaments?.modalidad && <span style={{ color: '#1a73e8', background: '#e8f0fe', borderRadius: '8px', padding: '1px 6px' }}>{t.tournaments.modalidad}</span>}
                      {t.tournaments?.season && <span>{t.tournaments.season}</span>}
                      {t.teams?.name && <span>· {t.teams.name}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '20px', textAlign: 'center', flexShrink: 0 }}>
                  {[{l:'PJ',v:pjT,c:'#1a73e8'},{l:esPortero?'REC':'GOL',v:gT,c:'#f9a825'},{l:'V',v:pgT,c:'#1e8e3e'}].map(({l,v,c}) => (
                    <div key={l}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: c }}>{v}</div>
                      <div style={{ fontSize: '.65rem', color: '#9aa0a6', fontWeight: '500' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
