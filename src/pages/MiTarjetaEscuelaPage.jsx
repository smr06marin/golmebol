import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TarjetaEscuelaJugador from '../components/TarjetaEscuelaJugador'
import FichaEvolucion from '../components/FichaEvolucion'
import PlayerCard from '../components/card/PlayerCard'
import { CARD_DESIGNS } from '../components/card/designs/cardDesigns'

const S = {
  navy: '#07070e', surface: '#0d1117', card: '#111827', card2: '#1a2234',
  border: '#1e2d3d', cyan: '#00ddd0', cyanDim: 'rgba(0,221,208,.12)',
  gold: '#f9a825', text: '#e8f4fd', text2: '#b8d4e8', muted: '#7a9ab5',
}

// Portal del jugador de escuela (el niño/a) cuando entra con su propia
// tarjeta de identidad — ve su propia tarjeta, en modo solo lectura.
export default function MiTarjetaEscuelaPage() {
  const navigate = useNavigate()
  const [jugador, setJugador] = useState(null)
  const [escuelaId, setEscuelaId] = useState(null)
  const [escuelaNombre, setEscuelaNombre] = useState('')
  const [escuelaLogo, setEscuelaLogo] = useState(null)
  const [premios, setPremios] = useState([])
  const [premiosTorneo, setPremiosTorneo] = useState([])
  const [promTecnico, setPromTecnico] = useState(null)
  const [estatura, setEstatura] = useState(null)
  const [tarjetasDesbloqueadas, setTarjetasDesbloqueadas] = useState(['normal_teal'])
  const [loading, setLoading] = useState(true)
  const [errorCuenta, setErrorCuenta] = useState(false)
  const [vistaCard, setVistaCard] = useState('fifa') // 'fifa' | 'clasica'

  useEffect(() => { fetchTodo() }, [])

  async function fetchTodo() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }
    // maybeSingle (no single): si por algún motivo hay más de una fila o
    // ninguna con este user_id, no explota — se muestra un aviso en vez de
    // devolver en silencio a la pantalla de la cédula.
    const { data: p, error: errP } = await supabase.from('players').select('*').eq('user_id', user.id).maybeSingle()
    if (errP || !p) { setLoading(false); setErrorCuenta(true); return }
    if (!p.es_jugador_escuela) { navigate('/jugador'); return }
    setJugador(p)

    const { data: tp } = await supabase.from('team_players').select('team_id, teams(name, categoria, logo_url)').eq('player_id', p.id).maybeSingle()
    setEscuelaNombre(tp?.teams?.name || '')
    setEscuelaLogo(tp?.teams?.logo_url || null)
    const escId = tp?.team_id || null
    setEscuelaId(escId)
    if (escId) {
      const { data: prem } = await supabase.from('escuela_premios').select('*').eq('escuela_id', escId).order('umbral', { ascending:true })
      setPremios(prem || [])
      // Diseños de tarjeta que la escuela dejó atados a un premio (card_type):
      // se desbloquean cuando el jugador alcanza el umbral de ese premio.
      const desbloqueadas = (prem || [])
        .filter(pr => pr.card_type && (p[pr.tipo_stat] || 0) >= pr.umbral)
        .map(pr => pr.card_type)
      setTarjetasDesbloqueadas(Array.from(new Set(['normal_teal', ...desbloqueadas])))
    }
    const { data: premTorneo } = await supabase.from('escuela_torneo_premios').select('*, torneo:torneo_id(nombre)').eq('jugador_id', p.id).order('created_at', { ascending:false })
    setPremiosTorneo(premTorneo || [])

    // Datos para la tarjeta FIFA: promedio de la última evaluación técnica y
    // la última estatura registrada en la ficha de evolución.
    const { data: tec } = await supabase.from('escuela_tecnica').select('*').eq('jugador_id', p.id).order('created_at', { ascending:false }).limit(1).maybeSingle()
    if (tec) {
      const campos = ['control','pase_corto','pase_largo','conduccion','regate','remate','cabeceo','ambas_piernas']
      const valores = campos.map(c => tec[c]).filter(v => v !== null && v !== undefined)
      if (valores.length > 0) setPromTecnico((valores.reduce((a,b) => a+b, 0) / valores.length).toFixed(1))
    }
    const { data: med } = await supabase.from('escuela_medidas').select('estatura_cm').eq('jugador_id', p.id).order('created_at', { ascending:false }).limit(1).maybeSingle()
    if (med?.estatura_cm) setEstatura(med.estatura_cm)

    setLoading(false)
  }

  async function handleCambiarDiseno(cardTypeId) {
    if (!jugador) return
    setJugador(j => ({ ...j, card_type: cardTypeId }))
    await supabase.from('players').update({ card_type: cardTypeId }).eq('id', jugador.id)
  }

  async function handleLogout() {
    await supabase.auth.signOut(); navigate('/jugador/login')
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', color:S.cyan, fontSize:'.9rem' }}>Cargando...</div>
  )
  if (errorCuenta) return (
    <div style={{ minHeight:'100vh', background:S.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ maxWidth:'380px', textAlign:'center', color:S.text }}>
        <div style={{ fontSize:'2.2rem', marginBottom:'10px' }}>⚠️</div>
        <div style={{ fontWeight:'700', marginBottom:'8px' }}>No pudimos cargar tu tarjeta</div>
        <div style={{ fontSize:'.85rem', color:S.text2, marginBottom:'20px', lineHeight:1.5 }}>
          Tu cuenta no quedó bien vinculada. Escríbenos por WhatsApp con tu número de documento para arreglarlo.
        </div>
        <a href={`https://wa.me/573226490055?text=${encodeURIComponent('Hola, no puedo ver mi tarjeta de jugador de escuela')}`} target="_blank" rel="noreferrer"
          style={{ display:'inline-block', padding:'10px 20px', background:S.cyan, color:'#07070e', borderRadius:'10px', textDecoration:'none', fontWeight:'700', fontSize:'.85rem' }}>
          💬 Escribir por WhatsApp
        </a>
      </div>
    </div>
  )
  if (!jugador) return null

  return (
    <div style={{ minHeight:'100vh', background:S.navy, fontFamily:'system-ui,sans-serif', color:S.text, paddingBottom:'40px' }}>
      <div style={{ background:S.surface, borderBottom:`0.5px solid ${S.border}`, padding:'16px 20px' }}>
        <div style={{ maxWidth:'500px', margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.1em' }}>⚽ Mi tarjeta · Golmebol</div>
            <div style={{ fontWeight:'800', fontSize:'1.1rem' }}>{jugador.name}</div>
          </div>
          <button onClick={handleLogout} style={{ background:'none', border:`1px solid ${S.border}`, borderRadius:'8px', padding:'7px 14px', cursor:'pointer', color:S.muted, fontSize:'.78rem', fontWeight:'600' }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:'500px', margin:'0 auto', padding:'24px 16px' }}>
        {escuelaNombre && <div style={{ fontSize:'.72rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10, textAlign:'center' }}>{escuelaNombre}</div>}

        <div style={{ display:'flex', justifyContent:'center', gap:'8px', marginBottom:'18px' }}>
          <button onClick={() => setVistaCard('fifa')}
            style={{ padding:'7px 16px', borderRadius:'20px', border:`1px solid ${vistaCard==='fifa'?S.cyan:S.border}`, background: vistaCard==='fifa'?S.cyanDim:'transparent', color: vistaCard==='fifa'?S.cyan:S.muted, fontSize:'.78rem', fontWeight:'700', cursor:'pointer' }}>
            🎴 Tarjeta FIFA
          </button>
          <button onClick={() => setVistaCard('clasica')}
            style={{ padding:'7px 16px', borderRadius:'20px', border:`1px solid ${vistaCard==='clasica'?S.cyan:S.border}`, background: vistaCard==='clasica'?S.cyanDim:'transparent', color: vistaCard==='clasica'?S.cyan:S.muted, fontSize:'.78rem', fontWeight:'700', cursor:'pointer' }}>
            📋 Tarjeta clásica
          </button>
        </div>

        {vistaCard === 'fifa' ? (
          <div style={{ marginBottom:'20px' }}>
            <PlayerCard
              playerName={(jugador.name || '').toUpperCase()}
              photoUrlExterno={jugador.photo_face_url || jugador.photo_url || null}
              cardType={jugador.card_type || 'normal_teal'}
              modoEscuela
              esPortero={jugador.posicion === 'Portero'}
              equiposData={escuelaId ? [{ id: escuelaId, nombre: escuelaNombre, logo_url: escuelaLogo }] : null}
              stats={{
                pj: jugador.partidos_escuela || 0,
                golesEscuela: jugador.goles_escuela || 0,
                asistencias: jugador.asistencias_escuela || 0,
                promTecnico: promTecnico ?? '—',
                estatura,
                mvp: jugador.mvp_escuela || 0,
                amarillas: jugador.amarillas_escuela || 0,
                rojas: jugador.rojas_escuela || 0,
              }}
              onStatClick={(id) => { if (escuelaId && id === escuelaId) navigate(`/escuela/historia/${escuelaId}`) }}
            />
            <div style={{ textAlign:'center', fontSize:'.68rem', color:S.muted, marginTop:'8px' }}>Toca el escudo para ver el recorrido de tu escuela</div>

            {tarjetasDesbloqueadas.length > 1 && (
              <div style={{ marginTop:'18px' }}>
                <div style={{ fontSize:'.68rem', color:S.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px', textAlign:'center' }}>
                  🔓 Diseños desbloqueados
                </div>
                <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px' }}>
                  {tarjetasDesbloqueadas.map(id => {
                    const d = CARD_DESIGNS.find(x => x.id === id)
                    if (!d) return null
                    const activo = (jugador.card_type || 'normal_teal') === id
                    return (
                      <button key={id} onClick={() => handleCambiarDiseno(id)}
                        style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', padding:'8px 10px', borderRadius:'10px', border:`1px solid ${activo ? d.color : S.border}`, background: activo ? `${d.color}22` : S.card, cursor:'pointer' }}>
                        <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:d.color, border:`1.5px solid ${d.colorSecundario||d.color}` }}/>
                        <span style={{ fontSize:'.6rem', color: activo ? d.color : S.muted, fontWeight:'700', whiteSpace:'nowrap' }}>{d.nombre}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <TarjetaEscuelaJugador jugador={jugador} premios={premios} premiosTorneo={premiosTorneo}/>
        )}

        <FichaEvolucion jugadorId={jugador.id}/>
      </div>
    </div>
  )
}
