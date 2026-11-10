import { useEffect, useState, useRef } from 'react'
import { PantallaCargando } from '../components/PantallaCargando'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, Shield, Download, Check, MapPin, Printer, X, AlertTriangle, ClipboardList, CheckCircle, Trophy, Calendar, Clock, Lock, FileText, Key, Circle } from 'lucide-react'
import PlanillaSegunPartido from '../components/PlanillaSegunPartido'
import InformeSolo from '../components/planillaRapida/InformeSolo'
import BannerCaja, { BotonCuentaDelDia } from '../components/CajaDelDia'
import { PaginaPanel, CuerpoPanel, EncabezadoPanel, Saludo, TarjetaPanel, CifrasPanel, BarraPanel, BotonVerde, FilaPanel, AvisoPanel, MasOpciones, G } from '../components/PanelUI'
import { fmtHoraDate } from '../lib/horaHelpers'
import { aplicarAliasMultiTorneo } from '../lib/nombresTorneo'
import { useAuthStore } from '../store/authStore'
import { leerCopia, guardarCopia } from '../lib/perfilPrevio'

function ModalCambiarContrasena({ onClose }) {
  const [actual,  setActual]  = useState('')
  const [nueva,   setNueva]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  async function handleCambiar() {
    if (nueva !== confirm) return setMsg('Las contraseñas no coinciden')
    if (nueva.length < 6)  return setMsg('Mínimo 6 caracteres')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('OK|Contraseña cambiada'); setTimeout(onClose, 1500) }
    setLoading(false)
  }

  const inp = { width:'100%', background:'#2a2a2a', border:'1px solid #2a3a4a', borderRadius:'8px', padding:'8px 12px', color:'#ffffff', fontSize:'.875rem', outline:'none', boxSizing:'border-box' }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#161616', borderRadius:'16px', padding:'28px', width:'360px', border:'1px solid #2a2a2a' }}>
        <div style={{ fontWeight:'700', color:'#ffffff', marginBottom:'20px' }}>Cambiar contraseña</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
          <input type="password" value={nueva}   onChange={e=>setNueva(e.target.value)}   style={inp} placeholder="Nueva contraseña"/>
          <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} style={inp} placeholder="Confirmar contraseña"/>
        </div>
        {msg && <div style={{ fontSize:'.8rem', color: msg.startsWith('OK|')?'#1e8e3e':'#d93025', marginBottom:'10px' }}>{msg.replace('OK|','')}</div>}
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={handleCambiar} disabled={loading} style={{ flex:1, padding:'10px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontWeight:'700', opacity:loading?.7:1 }}>
            {loading?'Guardando...':'Cambiar'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px', background:'none', border:'1px solid #2a2a2a', borderRadius:'8px', cursor:'pointer', color:'#8a8a8a' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function FlyerPartidos({ arbitro, partidos, onClose }) {
  const ref = useRef()

  const pendientes = partidos.filter(p => p.status !== 'finished')
    .sort((a,b) => new Date(a.played_at) - new Date(b.played_at))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflow:'auto' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'480px', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8eaed', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:'700', color:'#202124' }}>Mis partidos asignados</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={() => window.print()} style={{ padding:'5px 12px', background:'#1a73e8', border:'none', borderRadius:'8px', cursor:'pointer', color:'#fff', fontSize:'.78rem', display:'flex', alignItems:'center', gap:'5px' }}><Printer size={12}/> Imprimir</button>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9aa0a6', fontSize:'1.2rem', display:'flex', alignItems:'center' }}><X size={18}/></button>
          </div>
        </div>

        {/* Poster imprimible */}
        <div ref={ref} style={{ padding:'24px', background:'#0a0a0a', minHeight:'400px' }}>
          <div style={{ textAlign:'center', marginBottom:'20px' }}>
            <div style={{ fontSize:'.65rem', letterSpacing:'.3em', color:'#8a8a8a', textTransform:'uppercase', marginBottom:'8px' }}>GOLMEBOL · ARMENIA</div>
            {arbitro?.photo_face_url || arbitro?.photo_url ? (
              <div style={{ width:'60px', height:'60px', borderRadius:'50%', overflow:'hidden', margin:'0 auto 10px', border:'2px solid #f9a825' }}>
                <img src={arbitro.photo_face_url||arbitro.photo_url} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              </div>
            ) : <div style={{ marginBottom:'8px', display:'flex', justifyContent:'center' }}><Circle size={32} color="#f9a825" fill="#f9a825"/></div>}
            <div style={{ fontSize:'1.1rem', fontWeight:'900', color:'#fff', textTransform:'uppercase' }}>{arbitro?.name}</div>
            <div style={{ fontSize:'.7rem', color:'#f9a825', fontWeight:'700', marginTop:'2px' }}>ÁRBITRO</div>
          </div>

          <div style={{ width:'100%', height:'1px', background:'linear-gradient(90deg,transparent,#f9a825,transparent)', marginBottom:'16px' }}/>

          {pendientes.length === 0 ? (
            <div style={{ textAlign:'center', color:'#8a8a8a', padding:'24px', fontSize:'.85rem' }}>Sin partidos pendientes asignados</div>
          ) : pendientes.map((p, i) => (
            <div key={p.id} style={{ padding:'10px 12px', marginBottom:'6px', background:'rgba(255,255,255,.04)', borderRadius:'10px', border:'0.5px solid rgba(255,255,255,.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ fontSize:'.65rem', color:'#f9a825', fontWeight:'700' }}>{p.tournaments?.name}</span>
                <span style={{ fontSize:'.65rem', color:'#8a8a8a' }}>
                  {p.played_at && new Date(p.played_at).toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})}
                  {p.played_at && ` ${fmtHoraDate(p.played_at)}`}
                </span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  {p.home?.logo_url && <img src={p.home.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#ffffff' }}>{p.home?.name}</span>
                </div>
                <span style={{ fontSize:'.72rem', fontWeight:'800', color:'#8a8a8a', background:'#2a2a2a', padding:'2px 8px', borderRadius:'5px' }}>VS</span>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'.78rem', fontWeight:'700', color:'#ffffff' }}>{p.away?.name}</span>
                  {p.away?.logo_url && <img src={p.away.logo_url} style={{ width:'18px', height:'18px', objectFit:'contain' }}/>}
                </div>
              </div>
              {p.location && <div style={{ fontSize:'.62rem', color:'#8a8a8a', marginTop:'4px', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:'3px' }}><MapPin size={9}/> {p.location}</div>}
            </div>
          ))}

          <div style={{ textAlign:'center', marginTop:'16px', fontSize:'.6rem', color:'#3a4a5a', letterSpacing:'.1em' }}>
            GOLMEBOL.COM · ARMENIA, QUINDÍO
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ArbitroHomePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Lo último que vio este árbitro se pinta de inmediato (partidos incluidos) y los datos nuevos llegan detrás
  const uid = useAuthStore.getState().user?.id
  const [copia] = useState(() => leerCopia(uid, 'arbitro_home', 6 * 60 * 60 * 1000))
  const [arbitro,   setArbitro]   = useState(copia?.arbitro || null)
  const [partidos,  setPartidos]  = useState(copia?.partidos || [])
  const [stats,     setStats]     = useState(copia?.stats || { total:0, jugados:0, torneos:0 })
  const [loading,   setLoading]   = useState(!copia)
  const [tab,       setTab]       = useState('proximos')
  const [showPass,  setShowPass]  = useState(false)
  const [showFlyer, setShowFlyer] = useState(false)
  const [notifs,    setNotifs]    = useState(copia?.notifs || [])
  const [planillaPartido, setPlanillaPartido] = useState(null)
  const [informePartido, setInformePartido] = useState(null)   // partido ya cerrado al que se le sube SOLO el informe
  const [cierreOk, setCierreOk] = useState(null)               // partido recién cerrado: ofrece 'Subir informe' / 'Volver a abrir'
  const arbitroRef = useRef(null) // para refrescar en segundo plano sin depender del closure del efecto

  function abrirPlanilla(p) {
    setPlanillaPartido(p)
    // Se guarda una copia liviana del partido (nombres, ids, modalidad) para
    // poder reabrir la planilla DE INMEDIATO si el celular recarga la página
    // (se apagó, se cerró la app, etc.) sin tener que esperar esta consulta
    // de nuevo — la planilla misma ya trae su propio borrador guardado.
    try { localStorage.setItem(`planilla_partido_shell_${p.id}`, JSON.stringify(p)) } catch (e) {}
    // Partido ya cerrado que se vuelve a abrir (corregir algo): se marca en la URL para que, si el celular recarga,
    // la restauración no la cierre sola por estar "finished".
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('planilla', p.id); if (p.status === 'finished') n.set('reabierta', '1'); else n.delete('reabierta'); return n }, { replace: true })
  }
  async function reabrirPlanilla(p) {
    if (!window.confirm('Vas a volver a abrir una planilla que ya estaba cerrada.\n\nSolo hazlo para corregir un error. El resultado guardado se mantiene hasta que guardes los cambios, y queda registrado que se editó después del cierre.\n\n¿Abrir la planilla?')) return
    setCierreOk(null)
    // Se trae el partido tal como quedó guardado (marcador, estado) para abrir la planilla con datos frescos.
    let fresco = null
    try {
      const { data } = await supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('id', p.id).single()
      fresco = data ? (await aplicarAliasMultiTorneo([data]))[0] : data
    } catch (e) {}
    abrirPlanilla({ ...(fresco || p), status: 'finished' })
  }
  function cerrarPlanilla() {
    if (planillaPartido) { try { localStorage.removeItem(`planilla_partido_shell_${planillaPartido.id}`) } catch (e) {} }
    setPlanillaPartido(null)
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); n.delete('reabierta'); return n }, { replace: true })
    fetchTodo()
  }

  useEffect(() => {
    // Si hay una planilla abierta reflejada en la URL (?planilla=id), recuperarla
    // primero — así nunca se pierde aunque el navegador recargue la página.
    const matchId = searchParams.get('planilla')
    if (matchId) {
      // Restauro INSTANTÁNEO desde la copia liviana guardada localmente, sin
      // esperar la red — la planilla se abre ya mismo con su propio borrador.
      // La consulta de abajo solo reconfirma en 2do plano (por si el partido
      // ya se cerró desde otro lado, o cambiaron nombres/logos de equipos).
      try {
        const cached = localStorage.getItem(`planilla_partido_shell_${matchId}`)
        if (cached) setPlanillaPartido(JSON.parse(cached))
      } catch (e) {}

      supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('id', matchId).single()
        .then(async ({ data: dataBruta }) => {
          const data = dataBruta ? (await aplicarAliasMultiTorneo([dataBruta]))[0] : dataBruta
          // Una planilla ya cerrada solo se restaura si el árbitro la volvió a abrir a propósito
          // ("Volver a abrir planilla" deja ?reabierta=1 en la URL); si no, se cierra sola.
          if (data && (data.status !== 'finished' || searchParams.get('reabierta') === '1')) {
            setPlanillaPartido(data)
            try { localStorage.setItem(`planilla_partido_shell_${matchId}`, JSON.stringify(data)) } catch (e) {}
          } else if (data) {
            try { localStorage.removeItem(`planilla_partido_shell_${matchId}`) } catch (e) {}
            setPlanillaPartido(null)
            setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('planilla'); return n }, { replace:true })
          }
        })
    }
    fetchTodo()
    // Si el celular restaura la página desde memoria (bfcache) al volver de otra
    // app/pestaña, o simplemente vuelve a quedar visible, refrescamos los datos
    // para que un partido recién asignado por el coordinador aparezca sin
    // necesidad de recargar manualmente. IMPORTANTE: esto NO debe mostrar la
    // pantalla de carga completa ni revalidar sesión por red (ver
    // refrescarSilencioso) — si no, cada vez que el árbitro vuelve de WhatsApp
    // se le borra lo que tenía abierto (p.ej. una planilla) o, peor, se le
    // saca al login si esa llamada de red falla justo al reconectar.
    function onPageShow(e) { if (e.persisted) refrescarSilencioso() }
    function onVisibility() { if (document.visibilityState === 'visible') refrescarSilencioso() }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function fetchTodo() {
    if (!copia) setLoading(true)
    // La sesión se lee del propio teléfono (getSession): getUser() iba a la red en cada entrada.
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { navigate('/jugador/login'); return }
    const { data: p } = await supabase.from('players').select('*').eq('user_id', user.id).or('rol.eq.arbitro,es_arbitro.eq.true').single()
    if (!p) { navigate('/jugador/login'); return }
    // Golmebol es gratis — ya no se saca al árbitro por membresía inactiva.
    setArbitro(p)
    arbitroRef.current = p
    await cargarPartidos(p)
    setLoading(false)
  }

  async function cargarPartidos(p) {
    const selectCols = '*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)'
    // Se separan en consultas independientes (en vez de un solo .or() con el
    // nombre metido en el filtro) para que un nombre con caracteres raros no
    // rompa el filtro entero y haga desaparecer TODOS los partidos asignados.
    // Las notificaciones salen a la vez que los partidos (antes esperaban a que terminaran).
    const pNots = supabase.from('notificaciones').select('*').eq('player_id', p.id).eq('leida', false).order('created_at',{ascending:false})
    const [porId, porNombre1, porNombre2] = await Promise.all([
      supabase.from('matches').select(selectCols)
        .or(`arbitro1_id.eq.${p.id},arbitro2_id.eq.${p.id},arbitro3_id.eq.${p.id}`),
      p.name ? supabase.from('matches').select(selectCols).eq('arbitro1', p.name) : Promise.resolve({ data: [] }),
      p.name ? supabase.from('matches').select(selectCols).eq('arbitro2', p.name) : Promise.resolve({ data: [] }),
    ])
    if (porId.error) console.error('Error cargando partidos por id de árbitro:', porId.error)
    if (porNombre1.error) console.error('Error cargando partidos por arbitro1:', porNombre1.error)
    if (porNombre2.error) console.error('Error cargando partidos por arbitro2:', porNombre2.error)

    const vistos = new Set()
    const lista = await aplicarAliasMultiTorneo([...(porId.data||[]), ...(porNombre1.data||[]), ...(porNombre2.data||[])]
      .filter(m => { if (vistos.has(m.id)) return false; vistos.add(m.id); return true })
      .sort((a,b) => new Date(b.played_at||0) - new Date(a.played_at||0)))
    setPartidos(lista)
    const statsNuevas = { total:lista.length, jugados:lista.filter(m=>m.status==='finished').length, torneos:new Set(lista.map(m=>m.tournament_id)).size }
    setStats(statsNuevas)
    // Notificaciones no leídas
    const { data: nots } = await pNots
    setNotifs(nots||[])
    guardarCopia(uid, 'arbitro_home', { arbitro: p, partidos: lista, stats: statsNuevas, notifs: nots || [] })
  }

  // Refresco en segundo plano (al volver de otra app): sin pantalla de carga
  // y sin revalidar sesión por red, para no borrar ni cerrar nada que el
  // árbitro tuviera abierto por una falla transitoria de conexión.
  async function refrescarSilencioso() {
    if (!arbitroRef.current) return
    await cargarPartidos(arbitroRef.current)
  }

  if (loading) return <PantallaCargando/>

  // "partidos" viene del más reciente al más antiguo (para que jugados
  // muestre el último resultado primero). Próximos necesita el orden
  // inverso: el que se juega más pronto, arriba.
  const proximos = partidos.filter(p => p.status !== 'finished')
    .sort((a, b) => {
      if (!a.played_at && !b.played_at) return 0
      if (!a.played_at) return 1
      if (!b.played_at) return -1
      return new Date(a.played_at) - new Date(b.played_at)
    })
  const jugados  = partidos.filter(p => p.status === 'finished')
  const lista    = tab === 'proximos' ? proximos : jugados

  return (
    <PaginaPanel>
      {showPass  && <ModalCambiarContrasena onClose={()=>setShowPass(false)}/>}
      {showFlyer && <FlyerPartidos arbitro={arbitro} partidos={partidos} onClose={()=>setShowFlyer(false)}/>}
      {planillaPartido && (
        // Fútbol de salón (profesional) por defecto en cuentas de árbitro; Fútbol 11 (hoja de papel) si el coordinador la eligió
        <PlanillaSegunPartido
          contexto="arbitro"
          partido={planillaPartido}
          onClose={cerrarPlanilla}
          onGuardarResultado={() => setCierreOk(planillaPartido)}
        />
      )}

      {informePartido && (
        <div style={{ position:'fixed', inset:0, zIndex:9600, overflowY:'auto', background:'#0a0a0a' }}>
          <InformeSolo partido={informePartido} onVolver={() => setInformePartido(null)}/>
        </div>
      )}

      {cierreOk && !planillaPartido && !informePartido && (
        <div onClick={() => setCierreOk(null)} style={{ position:'fixed', inset:0, zIndex:9500, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:'18px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:'16px', padding:'22px 18px', width:'100%', maxWidth:'340px', textAlign:'center', color:'#ffffff' }}>
            <div style={{ fontSize:'2.2rem', marginBottom:'6px' }}>✓</div>
            <div style={{ fontSize:'1.05rem', fontWeight:'800' }}>Planilla cerrada</div>
            <div style={{ fontSize:'.78rem', color:'#8a8a8a', marginTop:'4px' }}>{cierreOk.home?.name} vs {cierreOk.away?.name}</div>
            <div style={{ fontSize:'.75rem', color:'#8a8a8a', marginTop:'16px' }}>¿Te faltó algo?</div>
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button onClick={() => { setInformePartido(cierreOk); setCierreOk(null) }}
                style={{ flex:1, padding:'12px 6px', borderRadius:'10px', border:'1px solid rgba(249,168,37,.5)', background:'rgba(249,168,37,.1)', color:'#f9a825', fontWeight:'800', fontSize:'.8rem', cursor:'pointer' }}>📝 Subir informe</button>
              <button onClick={() => reabrirPlanilla(cierreOk)}
                style={{ flex:1, padding:'12px 6px', borderRadius:'10px', border:'1px solid #2a2a2a', background:'transparent', color:'#ffffff', fontWeight:'800', fontSize:'.8rem', cursor:'pointer' }}>↩ Volver a abrir planilla</button>
            </div>
            <BotonCuentaDelDia partido={cierreOk} onAntes={() => setCierreOk(null)}/>
            <button onClick={() => setCierreOk(null)} style={{ marginTop:'10px', width:'100%', padding:'11px', borderRadius:'10px', border:'none', background:'#1a73e8', color:'#fff', fontWeight:'800', fontSize:'.85rem', cursor:'pointer' }}>Listo</button>
          </div>
        </div>
      )}

      <EncabezadoPanel nombre={arbitro?.name} rol="Árbitro" avatarUrl={arbitro?.photo_face_url||arbitro?.photo_url} forma="redonda"
        usuario={arbitro} actual="arbitro" avisoMenu={0}
        onLogout={async()=>{ await supabase.auth.signOut(); navigate('/jugador/login') }}/>

      <CuerpoPanel ancho={560}>
        <Saludo nombre={arbitro?.name?.split(' ')[0] || ''} texto="¿Qué partido vas a pitar hoy?"/>

        {/* Reclamos sin leer: lo más urgente va primero */}
        {notifs.length>0 && (
          <div style={{ marginBottom:'14px' }}>
            <AvisoPanel icono={AlertTriangle} color={G.loss}
              titulo={`${notifs.length} reclamo${notifs.length>1?'s':''} sin leer`} sub="Toca para marcarlos como leídos"
              onClick={async()=>{
                await supabase.from('notificaciones').update({leida:true}).eq('player_id',arbitro.id).eq('leida',false)
                setNotifs([])
              }}/>
            {notifs.map(n=>(
              <div key={n.id} style={{ fontSize:'.9rem', color:G.text2, lineHeight:1.45, margin:'0 4px 6px' }}>
                <b style={{ color:'#ff7b72' }}>{n.titulo}</b> — {n.mensaje}
              </div>
            ))}
          </div>
        )}

        {/* Lo principal de todos los días: cuántos faltan por pitar y a un toque la planilla del siguiente */}
        <TarjetaPanel icono={ClipboardList} titulo="Mis partidos" derecha={new Date().toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})}>
          <CifrasPanel cifras={[
            { valor:proximos.length, etiqueta:'Por pitar', color:G.gold },
            { valor:jugados.length,  etiqueta:'Pitados',  color:G.green },
          ]}/>
          <BarraPanel pct={stats.total ? Math.round((jugados.length/stats.total)*100) : 0}/>
          {proximos[0] && (
            <div style={{ background:G.card2, border:`1px solid ${G.border}`, borderRadius:'14px', padding:'12px 14px', marginBottom:'12px' }}>
              <div style={{ fontSize:'.74rem', fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:G.muted, marginBottom:'4px' }}>Siguiente partido</div>
              <div style={{ fontWeight:800, fontSize:'1.05rem', lineHeight:1.3 }}>{proximos[0].home?.name} <span style={{ color:G.muted }}>vs</span> {proximos[0].away?.name}</div>
              <div style={{ fontSize:'.86rem', color:G.muted, marginTop:'3px' }}>
                {proximos[0].tournaments?.name}{proximos[0].played_at ? ` · ${new Date(proximos[0].played_at).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})} ${fmtHoraDate(proximos[0].played_at)}` : ''}{proximos[0].location ? ` · ${proximos[0].location}` : ''}
              </div>
            </div>
          )}
          {proximos[0]
            ? <BotonVerde onClick={()=>abrirPlanilla(proximos[0])}>Llenar planilla del siguiente</BotonVerde>
            : <BotonVerde onClick={()=>setTab('jugados')} flecha>Ver mis partidos pitados</BotonVerde>}
        </TarjetaPanel>

        {/* Mi caja: cobros del día (solo torneos que cobran en cancha) */}
        <BannerCaja partidos={partidos}/>

        <div style={{ fontSize:'.76rem', fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase', color:G.muted, margin:'6px 4px 8px' }}>Todos mis partidos</div>
        {/* Tabs */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'16px', background:'#161616', borderRadius:'10px', padding:'4px' }}>
          {[{id:'proximos',label:`Próximos (${proximos.length})`},{id:'jugados',label:`Pitados (${jugados.length})`}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'.78rem', fontWeight:'700', background:tab===t.id?'#6fcf3d':'transparent', color:tab===t.id?'#0a1a05':'#8a8a8a' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {lista.length===0 ? (
          <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'48px', textAlign:'center', color:'#8a8a8a' }}>
            <div style={{ marginBottom:'8px', display:'flex', justifyContent:'center' }}>{tab==='proximos'?<Calendar size={26}/>:<CheckCircle size={26}/>}</div>
            <div style={{ fontSize:'.875rem' }}>{tab==='proximos'?'Sin partidos asignados':'Sin partidos pitados'}</div>
          </div>
        ) : lista.map(p=>{
          const esJugado = p.status==='finished'
          return (
            <div key={p.id} style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:'12px', padding:'14px 16px', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'.7rem', color:'#6fcf3d', background:'rgba(111,207,61,.13)', borderRadius:'6px', padding:'2px 8px' }}>{p.tournaments?.name}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  {p.matchday && <span style={{ fontSize:'.68rem', color:'#8a8a8a' }}>J{p.matchday}</span>}
                  {p.played_at && <span style={{ fontSize:'.68rem', color:'#8a8a8a', display:'inline-flex', alignItems:'center', gap:'3px' }}><Calendar size={10}/> {new Date(p.played_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span>}
                  <span style={{ fontSize:'.65rem', fontWeight:'700', color:esJugado?'#1e8e3e':'#e8710a', background:esJugado?'rgba(30,142,62,.1)':'rgba(232,113,10,.1)', borderRadius:'6px', padding:'1px 6px' }}>
                    {esJugado?'✓ Pitado':'Pendiente'}
                  </span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px', justifyContent:'flex-end' }}>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#ffffff', textAlign:'right' }}>{p.home?.name}</span>
                  <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'#2a2a2a', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.home?.logo_url?<img src={p.home.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>:<Shield size={11} color="#8a8a8a"/>}
                  </div>
                </div>
                <div style={{ fontWeight:'900', fontSize:esJugado?'1rem':'.85rem', color:esJugado?'#ffffff':'#8a8a8a', background:'#2a2a2a', padding:'4px 12px', borderRadius:'7px', flexShrink:0, minWidth:'52px', textAlign:'center' }}>
                  {esJugado?`${p.home_score}-${p.away_score}`:'VS'}
                </div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'#2a2a2a', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.away?.logo_url?<img src={p.away.logo_url} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>:<Shield size={11} color="#8a8a8a"/>}
                  </div>
                  <span style={{ fontWeight:'700', fontSize:'.9rem', color:'#ffffff' }}>{p.away?.name}</span>
                </div>
              </div>
              {(p.played_at||p.location) && (
                <div style={{ marginTop:'6px', display:'flex', gap:'12px', fontSize:'.68rem', color:'#8a8a8a' }}>
                  {p.played_at && <span style={{display:'inline-flex',alignItems:'center',gap:'3px'}}><Clock size={10}/> {fmtHoraDate(p.played_at)}</span>}
                  {p.location  && <span style={{display:'inline-flex',alignItems:'center',gap:'3px'}}><MapPin size={10}/> {p.location}</span>}
                </div>
              )}
              {esJugado ? (
                <div style={{ marginTop:'10px', display:'flex', gap:'8px' }}>
                  <button onClick={()=>setInformePartido(p)}
                    style={{ flex:1, padding:'10px 6px', borderRadius:'8px', border:'1px solid rgba(249,168,37,.5)', background:'rgba(249,168,37,.1)', color:'#f9a825', fontSize:'.78rem', fontWeight:'800', cursor:'pointer' }}>
                    📝 Subir informe
                  </button>
                  <button onClick={()=>reabrirPlanilla(p)}
                    style={{ flex:1, padding:'10px 6px', borderRadius:'8px', border:'1px solid #2a2a2a', background:'none', color:'#ffffff', fontSize:'.78rem', fontWeight:'800', cursor:'pointer' }}>
                    ↩ Volver a abrir planilla
                  </button>
                </div>
              ) : (
                <button onClick={()=>abrirPlanilla(p)}
                  style={{ marginTop:'10px', width:'100%', padding:'9px', borderRadius:'8px', border:'none', cursor:'pointer', background: '#6fcf3d', color:'#0a0a0a', fontSize:'.78rem', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  <><Check size={14}/> Llenar planilla</>
                </button>
              )}
            </div>
          )
        })}
        <div style={{ height:'6px' }}/>
        {/* Más opciones: cerradas para no abrumar */}
        <MasOpciones>
          <FilaPanel icono={Printer} titulo="Mis partidos para imprimir" sub="Un cartel con todos tus partidos pendientes" onClick={()=>setShowFlyer(true)}/>
          <FilaPanel icono={FileText} titulo="Encuestas" sub="Cuéntanos cómo te fue en los partidos" onClick={()=>navigate('/arbitro/encuestas')}/>
          <FilaPanel icono={Key} titulo="Cambiar mi contraseña" sub="Pon una clave nueva para entrar" onClick={()=>setShowPass(true)}/>
        </MasOpciones>
      </CuerpoPanel>
    </PaginaPanel>
  )
}
