import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

// Solo el administrador PRINCIPAL ve las analíticas del sitio
const ADMINS_PRINCIPALES = ['golmebol@gmail.com', 'smr06marin@gmail.com']
const PAGINAS_LABEL = { inicio: 'Página de inicio', tabla_torneo: 'Tabla de torneo', torneo_publico: 'Página pública de torneo' }

function AnaliticasSitio() {
  const { user } = useAuthStore()
  const [an, setAn] = useState(null)
  const esPrincipal = ADMINS_PRINCIPALES.includes((user?.email || '').toLowerCase())

  useEffect(() => { if (esPrincipal) cargar() }, [esPrincipal])

  async function cargar() {
    try {
      const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0)
      const hace7    = new Date(Date.now() - 7  * 864e5).toISOString()
      const hace30   = new Date(Date.now() - 30 * 864e5).toISOString()
      const hace5min = new Date(Date.now() - 5 * 60000).toISOString()
      const [{ count: total }, { count: mes }, { count: semana }, { count: hoyC }, { data: rows }, { data: recientes }] = await Promise.all([
        supabase.from('site_visitas').select('id', { count: 'exact', head: true }),
        supabase.from('site_visitas').select('id', { count: 'exact', head: true }).gte('created_at', hace30),
        supabase.from('site_visitas').select('id', { count: 'exact', head: true }).gte('created_at', hace7),
        supabase.from('site_visitas').select('id', { count: 'exact', head: true }).gte('created_at', hoy0.toISOString()),
        supabase.from('site_visitas').select('pagina, torneo_id, session_id, dispositivo, created_at').gte('created_at', hace30).limit(5000),
        supabase.from('site_visitas').select('session_id').gte('created_at', hace5min),
      ])
      const disp = { movil: 0, pc: 0 }, pags = {}, tors = {}, ses = {}
      ;(rows || []).forEach(r => {
        disp[r.dispositivo === 'movil' ? 'movil' : 'pc']++
        pags[r.pagina] = (pags[r.pagina] || 0) + 1
        if (r.torneo_id) tors[r.torneo_id] = (tors[r.torneo_id] || 0) + 1
        if (r.session_id) {
          if (!ses[r.session_id]) ses[r.session_id] = { min: r.created_at, max: r.created_at }
          else {
            if (r.created_at < ses[r.session_id].min) ses[r.session_id].min = r.created_at
            if (r.created_at > ses[r.session_id].max) ses[r.session_id].max = r.created_at
          }
        }
      })
      const topPag   = Object.entries(pags).sort((a, b) => b[1] - a[1])[0]
      const topTorId = Object.entries(tors).sort((a, b) => b[1] - a[1])[0]?.[0]
      let topTorNombre = null
      if (topTorId) {
        const { data: t } = await supabase.from('tournaments').select('name').eq('id', topTorId).maybeSingle()
        topTorNombre = t?.name || null
      }
      const duraciones = Object.values(ses).map(s => (new Date(s.max) - new Date(s.min)) / 1000).filter(d => d > 5)
      const promSeg = duraciones.length ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0
      const conectados = new Set((recientes || []).map(c => c.session_id)).size
      setAn({ total: total || 0, mes: mes || 0, semana: semana || 0, hoy: hoyC || 0, disp, topPag, topTorNombre, promSeg, conectados, visitantes30: Object.keys(ses).length })
    } catch (e) { console.error('Analíticas:', e) }
  }

  if (!esPrincipal || !an) return null

  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
  const totalDisp = an.disp.movil + an.disp.pc

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ fontSize: '.95rem', fontWeight: '700', color: '#202124', marginBottom: '4px' }}>📊 Analíticas del sitio</div>
      <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginBottom: '12px' }}>Visitas de la página pública — solo tú puedes ver esto</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        {[
          { l: '👁️ Visitas hoy',        v: an.hoy,            c: '#1a73e8' },
          { l: '📅 Esta semana',        v: an.semana,         c: '#1e8e3e' },
          { l: '🗓️ Este mes',           v: an.mes,            c: '#6c35de' },
          { l: '∑ Totales',             v: an.total,          c: '#e8710a' },
          { l: '🟢 Conectados ahora',   v: an.conectados,     c: '#00a896' },
          { l: '👥 Visitantes (30 días)', v: an.visitantes30, c: '#d93025' },
        ].map(c => (
          <div key={c.l} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: '.65rem', color: '#9aa0a6', fontWeight: '600', marginBottom: '4px' }}>{c.l}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: c.c }}>{c.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', gap: '22px', flexWrap: 'wrap', fontSize: '.78rem', color: '#5f6368' }}>
        <span>📱 Móvil: <b style={{ color: '#202124' }}>{totalDisp ? Math.round((an.disp.movil / totalDisp) * 100) : 0}%</b> · 💻 PC: <b style={{ color: '#202124' }}>{totalDisp ? Math.round((an.disp.pc / totalDisp) * 100) : 0}%</b></span>
        {an.topTorNombre && <span>🏆 Torneo más consultado: <b style={{ color: '#202124' }}>{an.topTorNombre}</b></span>}
        {an.topPag && <span>⭐ Página más visitada: <b style={{ color: '#202124' }}>{PAGINAS_LABEL[an.topPag[0]] || an.topPag[0]} ({an.topPag[1]})</b></span>}
        {an.promSeg > 0 && <span>⏱️ Tiempo promedio: <b style={{ color: '#202124' }}>{fmtDur(an.promSeg)}</b></span>}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: '12px',
      padding: '18px 20px', border: '1px solid #e8eaed',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow .2s',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)' }}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
          {icon}
        </div>
        <span style={{ fontSize: '.72rem', fontWeight: '600', color: '#5f6368', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#202124', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function Section({ title, action, onAction, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e8eaed', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem' }}>{title}</span>
        {action && <button onClick={onAction} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '.8rem', fontWeight: '500' }}>{action}</button>}
      </div>
      {children}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate  = useNavigate()
  const { user, rol } = useAuthStore()
  const esOrganizador = rol?.rol === 'organizador'
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchTodo() }, [rol])

  async function fetchTodo() {
    try {
    const hoy   = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    const en7   = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // ── Organizador: solo ve lo que pasa dentro de SUS propios torneos ──
    if (esOrganizador) {
      const { data: misTorneos } = await supabase.from('tournaments')
        .select('id, name, logo_url, modalidad, season, created_at')
        .eq('organizador_id', user?.id)
        .order('created_at', { ascending: false })
      const torneoIds = (misTorneos || []).map(t => t.id)

      if (torneoIds.length === 0) {
        setData({ esOrganizador: true, misTorneos: [], totalEquipos: 0, partidosHoy: 0, partidosJugados: 0, ultimosPartidos: [], finalizados: new Set() })
        setLoading(false)
        return
      }

      const [
        { count: totalEquipos },
        { count: partidosHoy },
        { count: partidosJugados },
        { data: ultimosPartidos },
        { data: logrosCampeon },
      ] = await Promise.all([
        supabase.from('tournament_teams').select('id', { count: 'exact', head: true }).in('tournament_id', torneoIds),
        supabase.from('matches').select('id', { count: 'exact', head: true }).in('tournament_id', torneoIds)
          .gte('played_at', hoyStr + 'T00:00:00').lte('played_at', hoyStr + 'T23:59:59'),
        supabase.from('matches').select('id', { count: 'exact', head: true }).in('tournament_id', torneoIds).eq('status', 'finished'),
        supabase.from('matches')
          .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
          .in('tournament_id', torneoIds).eq('status', 'finished')
          .order('played_at', { ascending: false }).limit(5),
        supabase.from('tournament_logros').select('tournament_id').in('tournament_id', torneoIds).eq('tipo', 'campeon'),
      ])

      setData({
        esOrganizador: true,
        misTorneos: misTorneos || [],
        totalEquipos: totalEquipos || 0,
        partidosHoy: partidosHoy || 0,
        partidosJugados: partidosJugados || 0,
        ultimosPartidos: ultimosPartidos || [],
        finalizados: new Set((logrosCampeon || []).map(l => l.tournament_id)),
      })
      setLoading(false)
      return
    }

    const [
      { count: totalJugadores },
      { count: jugadoresActivos },
      { count: jugadoresSinCuenta },
      { count: totalTorneos },
      { count: totalEquipos },
      { count: partidosHoy },
      { count: partidosJugados },
      { data: porVencer },
      { data: ultimosPartidos },
      { data: torneosActivos },
      { data: membresiasVencidas },
    ] = await Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('activo_membresia', true),
      supabase.from('players').select('id', { count: 'exact', head: true }).is('user_id', null),
      supabase.from('tournaments').select('id', { count: 'exact', head: true }),
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('matches').select('id', { count: 'exact', head: true })
        .gte('played_at', hoyStr + 'T00:00:00')
        .lte('played_at', hoyStr + 'T23:59:59'),
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
      supabase.from('players')
        .select('id, name, fecha_vencimiento, telefono')
        .eq('activo_membresia', true)
        .lte('fecha_vencimiento', en7)
        .gte('fecha_vencimiento', hoy.toISOString())
        .order('fecha_vencimiento'),
      supabase.from('matches')
        .select('*, home:home_team_id(name,logo_url), away:away_team_id(name,logo_url), tournaments(name)')
        .eq('status', 'finished')
        .order('played_at', { ascending: false })
        .limit(5),
      supabase.from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase.from('players')
        .select('id, name, fecha_vencimiento, telefono')
        .eq('activo_membresia', false)
        .not('user_id', 'is', null)
        .order('fecha_vencimiento', { ascending: false })
        .limit(3),
    ])

    const torneoIdsRecientes = (torneosActivos || []).map(t => t.id)
    const { data: logrosCampeon } = torneoIdsRecientes.length
      ? await supabase.from('tournament_logros').select('tournament_id').in('tournament_id', torneoIdsRecientes).eq('tipo', 'campeon')
      : { data: [] }

    setData({
      esOrganizador: false,
      totalJugadores:    totalJugadores    || 0,
      jugadoresActivos:  jugadoresActivos  || 0,
      jugadoresSinCuenta: jugadoresSinCuenta || 0,
      totalTorneos:      totalTorneos      || 0,
      totalEquipos:      totalEquipos      || 0,
      partidosHoy:       partidosHoy       || 0,
      partidosJugados:   partidosJugados   || 0,
      porVencer:         porVencer         || [],
      ultimosPartidos:   ultimosPartidos   || [],
      torneosActivos:    torneosActivos    || [],
      membresiasVencidas: membresiasVencidas || [],
      finalizados: new Set((logrosCampeon || []).map(l => l.tournament_id)),
    })
    setLoading(false)
    } catch(e) {
      console.error('Dashboard error:', e)
      setData({ esOrganizador, totalJugadores: 0, jugadoresActivos: 0, jugadoresSinCuenta: 0, totalTorneos: 0, totalEquipos: 0, partidosHoy: 0, partidosJugados: 0, porVencer: [], ultimosPartidos: [], torneosActivos: [], misTorneos: [], membresiasVencidas: [], finalizados: new Set() })
      setLoading(false)
    }
  }

  function diasRestantes(fecha) {
    if (!fecha) return null
    return Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24))
  }

  function abrirWhatsApp(jugador, vencida) {
    const nombre   = jugador.name?.split(' ')[0] || 'jugador'
    const telefono = jugador.telefono?.replace(/\D/g, '')
    const dias     = diasRestantes(jugador.fecha_vencimiento)
    const texto    = vencida
      ? `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* ya venció. Renueva para seguir disfrutando tu tarjeta. ⚽🏆`
      : `Hola ${nombre} 👋, tu membresía de *GOLMEBOL* vence en *${dias} día${dias !== 1 ? 's' : ''}*. ¡Renueva a tiempo! ⚽🏆`
    window.open(`https://wa.me/57${telefono}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  if (loading || !data) return <div style={{ padding: '40px', textAlign: 'center', color: '#9aa0a6' }}>Cargando...</div>

  // ── Vista del organizador: solo su(s) torneo(s) ──
  if (data.esOrganizador) {
    const { misTorneos, totalEquipos, partidosHoy, partidosJugados, ultimosPartidos, finalizados } = data
    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: '0 0 4px' }}>Mi torneo</h1>
          <p style={{ color: '#5f6368', margin: 0, fontSize: '.85rem' }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {misTorneos.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', color: '#9aa0a6', fontSize: '.9rem' }}>
            Todavía no tienes un torneo creado. <button onClick={() => navigate('/admin/torneos')} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontWeight: '600', fontSize: '.9rem' }}>Crear mi primer torneo →</button>
          </div>
        ) : (
          <>
            <div className="gm-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <StatCard icon="🏆" label="Mis torneos"      value={misTorneos.length} sub={`${misTorneos.filter(t => !finalizados.has(t.id)).length} activos`} color="#6c35de" onClick={() => navigate('/admin/torneos')}/>
              <StatCard icon="⚽" label="Equipos"          value={totalEquipos}     sub="Inscritos en mis torneos"                    color="#1a73e8" onClick={() => navigate('/admin/torneos')}/>
              <StatCard icon="📅" label="Partidos hoy"     value={partidosHoy}      sub="Programados hoy"                              color="#e8710a" onClick={() => navigate('/admin/calendario')}/>
              <StatCard icon="✅" label="Partidos jugados" value={partidosJugados}  sub="Finalizados"                                   color="#1e8e3e" onClick={() => navigate('/admin/calendario')}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              <Section title="⚽ Últimos partidos" action="Ver calendario" onAction={() => navigate('/admin/calendario')}>
                {ultimosPartidos.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Sin partidos jugados aún</div>
                ) : ultimosPartidos.map((p, i) => (
                  <div key={p.id} style={{ padding: '10px 16px', borderBottom: i < ultimosPartidos.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '.8rem', color: '#202124', fontWeight: '500', flex: 1, textAlign: 'right', paddingRight: '8px' }}>{p.home?.name}</div>
                      <div style={{ fontWeight: '700', color: '#202124', background: '#f1f3f4', borderRadius: '6px', padding: '2px 10px', fontSize: '.85rem', flexShrink: 0 }}>
                        {p.home_score} - {p.away_score}
                      </div>
                      <div style={{ fontSize: '.8rem', color: '#202124', fontWeight: '500', flex: 1, paddingLeft: '8px' }}>{p.away?.name}</div>
                    </div>
                    <div style={{ fontSize: '.68rem', color: '#9aa0a6', textAlign: 'center', marginTop: '2px' }}>
                      {p.tournaments?.name} · {p.played_at && new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="🏆 Mis torneos" action="Ver todos" onAction={() => navigate('/admin/torneos')}>
                {misTorneos.map((t, i) => {
                  const fin = finalizados.has(t.id)
                  return (
                    <div key={t.id}
                      onClick={() => navigate(`/admin/torneos/${t.id}`)}
                      style={{ padding: '12px 16px', borderBottom: i < misTorneos.length - 1 ? '1px solid #f1f3f4' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <span>🏆</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{[t.modalidad, t.season].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span style={{ fontSize: '.7rem', color: fin ? '#5f6368' : '#1e8e3e', background: fin ? '#f1f3f4' : '#e6f4ea', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>{fin ? 'Finalizado' : 'Activo'}</span>
                    </div>
                  )
                })}
              </Section>
            </div>
          </>
        )}

        <div>
          <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '12px' }}>Acciones rápidas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Mi torneo',   icon: '🏆', ruta: '/admin/torneos' },
              { label: 'Calendario',  icon: '📅', ruta: '/admin/calendario' },
              { label: 'Noticias',    icon: '📰', ruta: '/admin/noticias' },
            ].map(a => (
              <button key={a.label} onClick={() => navigate(a.ruta)}
                style={{
                  background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px',
                  padding: '12px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: '8px', fontSize: '.8rem',
                  color: '#202124', fontWeight: '500', transition: 'all .15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'}
              >
                <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Vista del admin principal: todo Golmebol ──
  const { totalJugadores, jugadoresActivos, jugadoresSinCuenta, totalTorneos, totalEquipos, partidosHoy, partidosJugados, porVencer, ultimosPartidos, torneosActivos, membresiasVencidas, finalizados } = data

  return (
    <div>
      {/* Bienvenida */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#202124', margin: '0 0 4px' }}>Panel de Administración</h1>
        <p style={{ color: '#5f6368', margin: 0, fontSize: '.85rem' }}>
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats principales */}
      <div className="gm-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon="👥" label="Jugadores"        value={totalJugadores}   sub={`${jugadoresActivos} con membresía activa`}  color="#1a73e8" onClick={() => navigate('/admin/jugadores')}/>
        <StatCard icon="✅" label="Membresías activas" value={jugadoresActivos} sub={`${totalJugadores - jugadoresActivos} inactivos`} color="#1e8e3e" onClick={() => navigate('/admin/jugadores')}/>
        <StatCard icon="⚠️" label="Por activar"      value={jugadoresSinCuenta} sub="Sin cuenta creada"                          color="#e8710a" onClick={() => navigate('/admin/jugadores')}/>
        <StatCard icon="🏆" label="Torneos"          value={totalTorneos}     sub={`${totalEquipos} equipos registrados`}        color="#6c35de" onClick={() => navigate('/admin/torneos')}/>
        <StatCard icon="⚽" label="Partidos jugados"  value={partidosJugados}  sub={`${partidosHoy} programados hoy`}            color="#1a73e8" onClick={() => navigate('/admin/calendario')}/>
      </div>

      {/* Alertas membresías */}
      {(porVencer.length > 0 || membresiasVencidas.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          {/* Por vencer */}
          {porVencer.length > 0 && (
            <Section title={`⚠️ Membresías por vencer (${porVencer.length})`} action="Ver jugadores" onAction={() => navigate('/admin/jugadores')}>
              {porVencer.map((j, i) => {
                const dias = diasRestantes(j.fecha_vencimiento)
                return (
                  <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < porVencer.length - 1 ? '1px solid #f1f3f4' : 'none', background: dias <= 2 ? '#fffbf0' : '#fff' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#202124', fontSize: '.85rem' }}>{j.name}</div>
                      <div style={{ fontSize: '.72rem', color: dias <= 2 ? '#d93025' : '#e8710a', fontWeight: '500' }}>
                        Vence en {dias} día{dias !== 1 ? 's' : ''} — {new Date(j.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    {j.telefono && (
                      <button onClick={() => abrirWhatsApp(j, false)}
                        style={{ background: '#25D366', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        💬 WhatsApp
                      </button>
                    )}
                  </div>
                )
              })}
            </Section>
          )}

          {/* Vencidas */}
          {membresiasVencidas.length > 0 && (
            <Section title={`❌ Membresías vencidas recientes (${membresiasVencidas.length})`} action="Ver jugadores" onAction={() => navigate('/admin/jugadores')}>
              {membresiasVencidas.map((j, i) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: i < membresiasVencidas.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#202124', fontSize: '.85rem' }}>{j.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#d93025', fontWeight: '500' }}>
                      Venció el {j.fecha_vencimiento ? new Date(j.fecha_vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' }) : '—'}
                    </div>
                  </div>
                  {j.telefono && (
                    <button onClick={() => abrirWhatsApp(j, true)}
                      style={{ background: '#25D366', border: 'none', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '.72rem', fontWeight: '600' }}>
                      💬 WhatsApp
                    </button>
                  )}
                </div>
              ))}
            </Section>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>

        {/* Últimos partidos */}
        <Section title="⚽ Últimos partidos" action="Ver todos" onAction={() => navigate('/admin/calendario')}>
          {ultimosPartidos.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Sin partidos jugados aún</div>
          ) : ultimosPartidos.map((p, i) => (
            <div key={p.id} style={{ padding: '10px 16px', borderBottom: i < ultimosPartidos.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '.8rem', color: '#202124', fontWeight: '500', flex: 1, textAlign: 'right', paddingRight: '8px' }}>{p.home?.name}</div>
                <div style={{ fontWeight: '700', color: '#202124', background: '#f1f3f4', borderRadius: '6px', padding: '2px 10px', fontSize: '.85rem', flexShrink: 0 }}>
                  {p.home_score} - {p.away_score}
                </div>
                <div style={{ fontSize: '.8rem', color: '#202124', fontWeight: '500', flex: 1, paddingLeft: '8px' }}>{p.away?.name}</div>
              </div>
              <div style={{ fontSize: '.68rem', color: '#9aa0a6', textAlign: 'center', marginTop: '2px' }}>
                {p.tournaments?.name} · {p.played_at && new Date(p.played_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </div>
            </div>
          ))}
        </Section>

        {/* Torneos */}
        <Section title="🏆 Torneos" action="Ver todos" onAction={() => navigate('/admin/torneos')}>
          {torneosActivos.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9aa0a6', fontSize: '.85rem' }}>Sin torneos aún</div>
          ) : torneosActivos.map((t, i) => {
            const fin = finalizados?.has(t.id)
            return (
              <div key={t.id}
                onClick={() => navigate(`/admin/torneos/${t.id}`)}
                style={{ padding: '12px 16px', borderBottom: i < torneosActivos.length - 1 ? '1px solid #f1f3f4' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f3f4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {t.logo_url ? <img src={t.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}/> : <span>🏆</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: '#202124', fontSize: '.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#9aa0a6', marginTop: '2px' }}>{[t.modalidad, t.season].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ fontSize: '.7rem', color: fin ? '#5f6368' : '#1e8e3e', background: fin ? '#f1f3f4' : '#e6f4ea', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>{fin ? 'Finalizado' : 'Activo'}</span>
              </div>
            )
          })}
        </Section>
      </div>

      {/* Acciones rápidas */}
      <div>
        <div style={{ fontWeight: '600', color: '#202124', fontSize: '.875rem', marginBottom: '12px' }}>Acciones rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          {[
            { label: 'Nuevo Torneo',  icon: '🏆', ruta: '/admin/torneos' },
            { label: 'Nuevo Equipo',  icon: '⚽', ruta: '/admin/equipos' },
            { label: 'Nuevo Jugador', icon: '👤', ruta: '/admin/jugadores' },
            { label: 'Tarjetas',      icon: '🃏', ruta: '/admin/tarjetas' },
            { label: 'Sponsors',      icon: '⭐', ruta: '/admin/sponsors' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.ruta)}
              style={{
                background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px',
                padding: '12px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: '8px', fontSize: '.8rem',
                color: '#202124', fontWeight: '500', transition: 'all .15s',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'}
            >
              <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analíticas del sitio público — solo administrador principal */}
      <AnaliticasSitio/>
    </div>
  )
}
