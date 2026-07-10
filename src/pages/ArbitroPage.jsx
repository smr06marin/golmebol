import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlanillaPartido from '../components/PlanillaPartido'
import { recuperarPlanillaAbierta } from '../lib/planillaRecovery'
import { ArrowLeft, Trophy, MapPin, Check, Filter } from 'lucide-react'

function TeamLogo({ logo_url, name, size = 28 }) {
  const iniciales = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  if (logo_url) return <img src={logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a73e8, #6c35de)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: size * 0.32 + 'px', fontWeight: '800', color: '#fff' }}>{iniciales}</span>
    </div>
  )
}

export default function ArbitroPage() {
  const navigate = useNavigate()

  const [torneos,     setTorneos]     = useState([])
  const [torneoSel,   setTorneoSel]   = useState(null)
  const [canchas,     setCanchas]     = useState([])
  const [canchaSel,   setCanchaSel]   = useState('todas')
  const [partidos,    setPartidos]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [misPartidos, setMisPartidos] = useState([]) // ids seleccionados por el árbitro
  const [soloMios,    setSoloMios]    = useState(false)
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [msg,         setMsg]         = useState(null)

  useEffect(() => { fetchTorneos() }, [])
  // Si había una planilla abierta cuando el navegador recargó/mató la pestaña, reabrirla
  useEffect(() => { recuperarPlanillaAbierta().then(p => { if (p) setPlanillaPartido(p) }) }, [])

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3000)
  }

  async function fetchTorneos() {
    setLoading(true)
    const { data } = await supabase.from('tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false })
    setTorneos(data || [])
    setLoading(false)
  }

  async function abrirTorneo(t) {
    setTorneoSel(t)
    setCanchaSel('todas')
    setSoloMios(false)
    setLoading(true)
    try { setMisPartidos(JSON.parse(localStorage.getItem(`golmebol_arbitro_${t.id}`) || '[]')) } catch { setMisPartidos([]) }
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from('canchas').select('*').eq('tournament_id', t.id),
      supabase.from('matches')
        .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('tournament_id', t.id)
        .eq('status', 'scheduled')
        .order('played_at', { ascending: true }),
    ])
    setCanchas(cs || [])
    setPartidos(ps || [])
    setLoading(false)
  }

  function toggleMio(pid) {
    setMisPartidos(prev => {
      const nueva = prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]
      try { localStorage.setItem(`golmebol_arbitro_${torneoSel.id}`, JSON.stringify(nueva)) } catch { /* sin storage */ }
      return nueva
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const partidosFiltrados = partidos
    .filter(p => canchaSel === 'todas' || (p.location || '').toLowerCase() === canchaSel.toLowerCase())
    .filter(p => !soloMios || misPartidos.includes(p.id))

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui, sans-serif' }}>

      {msg && (
        <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: msg.type === 'error' ? '#d93025' : '#1e8e3e', color: '#fff', borderRadius: '8px', padding: '10px 24px', zIndex: 300, fontSize: '.875rem', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
          {msg.text}
        </div>
      )}

      {planillaPartido && (
        <PlanillaPartido
          partido={planillaPartido}
          onClose={() => setPlanillaPartido(null)}
          onGuardarResultado={async (local, visitante) => {
            const { error } = await supabase.from('matches').update({ home_score: local, away_score: visitante, status: 'finished' }).eq('id', planillaPartido.id)
            if (!error) {
              const ganador = local > visitante ? 'home' : local < visitante ? 'away' : 'draw'
              const { data: preds } = await supabase.from('predicciones').select('*').eq('match_id', planillaPartido.id).eq('resuelta', false)
              if (preds && preds.length > 0) {
                for (const pred of preds) {
                  let pts = 0
                  if (pred.ganador === ganador) pts += ganador === 'draw' ? 5 : 3
                  if (pred.goles_home === local)     pts += 3
                  if (pred.goles_away === visitante) pts += 3
                  if (pred.goles_home === local && pred.goles_away === visitante) pts += 10
                  await supabase.from('predicciones').update({ puntos_ganados: pts, resuelta: true }).eq('id', pred.id)
                }
              }
              showMsg('Resultado guardado ✓')
              setPlanillaPartido(null)
              abrirTorneo(torneoSel)
            }
          }}
        />
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a237e 0%, #1a73e8 100%)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
        {torneoSel && (
          <button onClick={() => { setTorneoSel(null); setPartidos([]) }}
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <ArrowLeft size={17}/>
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: '800', fontSize: '1rem', letterSpacing: '.03em' }}>🧑‍⚖️ PORTAL DE ÁRBITROS</div>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: '.72rem' }}>{torneoSel ? torneoSel.name : 'Elige el torneo que vas a pitar'}</div>
        </div>
        <button onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: '.78rem' }}>
          Salir
        </button>
      </div>

      <div style={{ padding: '16px', maxWidth: '760px', margin: '0 auto' }}>

        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>}

        {/* Paso 1: torneos */}
        {!loading && !torneoSel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {torneos.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>No hay torneos activos</div>}
            {torneos.map(t => (
              <div key={t.id} onClick={() => abrirTorneo(t)}
                style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#e8f0fe', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <Trophy size={20} color="#1a73e8"/>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', color: '#202124', fontSize: '.95rem' }}>{t.name}</div>
                  <div style={{ fontSize: '.75rem', color: '#9aa0a6', marginTop: '2px' }}>{[t.modalidad, t.city, t.season].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ color: '#1a73e8', fontSize: '.8rem', fontWeight: '600', flexShrink: 0 }}>Pitar aquí →</span>
              </div>
            ))}
          </div>
        )}

        {/* Paso 2: canchas + partidos */}
        {!loading && torneoSel && (
          <div>
            {/* Canchas */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <MapPin size={15} color="#5f6368"/>
              <button onClick={() => setCanchaSel('todas')}
                style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${canchaSel === 'todas' ? '#1a73e8' : '#dadce0'}`, background: canchaSel === 'todas' ? '#1a73e8' : '#fff', color: canchaSel === 'todas' ? '#fff' : '#5f6368', fontSize: '.78rem', fontWeight: '600', cursor: 'pointer' }}>
                Todas las canchas
              </button>
              {canchas.map(c => (
                <button key={c.id} onClick={() => setCanchaSel(c.nombre)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${canchaSel === c.nombre ? '#1a73e8' : '#dadce0'}`, background: canchaSel === c.nombre ? '#1a73e8' : '#fff', color: canchaSel === c.nombre ? '#fff' : '#5f6368', fontSize: '.78rem', fontWeight: '600', cursor: 'pointer' }}>
                  📍 {c.nombre}
                </button>
              ))}
            </div>

            {/* Filtro mis partidos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '.78rem', color: '#5f6368' }}>
                Marca ✓ los partidos que vas a pitar y filtra para ver solo los tuyos
              </div>
              <button onClick={() => setSoloMios(!soloMios)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: `1px solid ${soloMios ? '#1e8e3e' : '#dadce0'}`, background: soloMios ? '#1e8e3e' : '#fff', color: soloMios ? '#fff' : '#5f6368', fontSize: '.8rem', fontWeight: '600', cursor: 'pointer' }}>
                <Filter size={14}/> {soloMios ? `Mis partidos (${misPartidos.length})` : 'Filtrar: solo mis partidos'}
              </button>
            </div>

            {/* Partidos */}
            {partidosFiltrados.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6', background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed' }}>
                {soloMios ? 'No has marcado partidos — quita el filtro y marca los que vas a pitar' : 'No hay partidos programados con este filtro'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {partidosFiltrados.map(p => {
                  const esMio = misPartidos.includes(p.id)
                  return (
                    <div key={p.id} style={{ background: '#fff', border: esMio ? '2px solid #1e8e3e' : '1px solid #e8eaed', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {p.played_at && (
                          <span style={{ fontSize: '.75rem', color: '#1a73e8', background: '#e8f0fe', borderRadius: '10px', padding: '2px 10px', fontWeight: '600' }}>
                            📅 {new Date(p.played_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })} · 🕐 {new Date(p.played_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {p.location && <span style={{ fontSize: '.75rem', color: '#5f6368', background: '#f1f3f4', borderRadius: '10px', padding: '2px 10px' }}>📍 {p.location}</span>}
                        {p.matchday && <span style={{ fontSize: '.72rem', color: '#9aa0a6' }}>J{p.matchday}</span>}
                        {p.ronda && <span style={{ fontSize: '.72rem', color: '#e8710a', fontWeight: '700' }}>{p.ronda}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <span style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem', textAlign: 'right' }}>{p.home?.name}</span>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.home?.logo_url} name={p.home?.name} size={30}/></div>
                        </div>
                        <span style={{ fontWeight: '800', color: '#9aa0a6', fontSize: '.8rem', flexShrink: 0 }}>VS</span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}><TeamLogo logo_url={p.away?.logo_url} name={p.away?.name} size={30}/></div>
                          <span style={{ fontWeight: '700', color: '#202124', fontSize: '.9rem' }}>{p.away?.name}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => toggleMio(p.id)}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '8px', border: `1px solid ${esMio ? '#1e8e3e' : '#dadce0'}`, background: esMio ? '#e6f4ea' : '#fff', color: esMio ? '#1e8e3e' : '#5f6368', fontSize: '.8rem', fontWeight: '700', cursor: 'pointer' }}>
                          <Check size={14}/> {esMio ? 'Lo pito yo ✓' : 'Yo pito este partido'}
                        </button>
                        <button onClick={() => setPlanillaPartido(p)}
                          style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: '#1a73e8', color: '#fff', fontSize: '.8rem', fontWeight: '700', cursor: 'pointer' }}>
                          📋 Abrir planilla
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
