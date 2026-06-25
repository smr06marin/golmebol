import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Newspaper } from 'lucide-react'

const S = {
  navy:    '#07070e',
  surface: '#0d1117',
  card:    '#111827',
  border:  '#1e2d3d',
  cyan:    '#00ddd0',
  text:    '#e8f4fd',
  text2:   '#b8d4e8',
  muted:   '#7a9ab5',
  gold:    '#f9a825',
}

export default function PlayerNoticiasPage() {
  const navigate  = useNavigate()
  const [noticias,  setNoticias]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(null)
  const [torneos,   setTorneos]   = useState([])
  const [torneoId,  setTorneoId]  = useState('')

  useEffect(() => { fetchTodo() }, [])
  useEffect(() => { if (torneoId) fetchNoticias() }, [torneoId])

  async function fetchTodo() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/jugador/login'); return }

    const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
    if (!player) { navigate('/jugador/login'); return }

    // Torneos donde está inscrito
    const { data: regs } = await supabase
      .from('tournament_player_registrations')
      .select('tournaments(id, name)')
      .eq('player_id', player.id)
      .eq('activo', true)

    const torneosData = (regs || []).map(r => r.tournaments).filter(Boolean)
    setTorneos(torneosData)

    if (torneosData.length > 0) {
      setTorneoId(torneosData[0].id)
    } else {
      // Si no está en torneos, mostrar todas las noticias
      const { data } = await supabase.from('noticias').select('*').order('creada_at', { ascending: false }).limit(20)
      setNoticias(data || [])
      setLoading(false)
    }
  }

  async function fetchNoticias() {
    setLoading(true)
    const { data } = await supabase
      .from('noticias')
      .select('*, matches(home:home_team_id(name), away:away_team_id(name))')
      .eq('tournament_id', torneoId)
      .order('creada_at', { ascending: false })
    setNoticias(data || [])
    setLoading(false)
  }

  const tipoLabel = { pre_partido: '⚡ Pre-partido', post_partido: '🏁 Post-partido', semanal: '📋 Semanal' }
  const tipoColor = { pre_partido: S.cyan, post_partido: '#4caf50', semanal: S.gold }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'system-ui, sans-serif', color: S.text }}>

      {/* Header */}
      <div style={{ background: S.card, borderBottom: `0.5px solid ${S.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => navigate('/jugador')}
          style={{ background: 'none', border: `1px solid ${S.border}`, borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: S.muted, display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '1rem', color: S.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Newspaper size={16} color={S.cyan}/> Noticias
          </div>
          <div style={{ fontSize: '.68rem', color: S.muted }}>Noticiero del torneo · IA</div>
        </div>
        {torneos.length > 1 && (
          <select value={torneoId} onChange={e => setTorneoId(e.target.value)}
            style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: '8px', padding: '6px 10px', color: S.text, fontSize: '.75rem', outline: 'none' }}>
            {torneos.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: S.muted }}>Cargando noticias...</div>
        ) : noticias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: S.muted }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📰</div>
            <div style={{ fontWeight: '600', color: S.text2, marginBottom: '6px' }}>Sin noticias aún</div>
            <div style={{ fontSize: '.8rem' }}>Las noticias aparecerán aquí antes y después de cada partido</div>
          </div>
        ) : noticias.map(n => {
          const isExpand = expanded === n.id
          const partido  = n.matches
          return (
            <div key={n.id} style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '12px' }}>
              {/* Franja de color por tipo */}
              <div style={{ height: '3px', background: tipoColor[n.tipo] || S.cyan }}/>

              <div style={{ padding: '14px 16px' }}>
                {/* Meta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.65rem', fontWeight: '700', color: tipoColor[n.tipo], background: `${tipoColor[n.tipo]}18`, borderRadius: '20px', padding: '2px 8px' }}>
                    {tipoLabel[n.tipo]}
                  </span>
                  {partido && (
                    <span style={{ fontSize: '.68rem', color: S.muted }}>
                      {partido.home?.name} vs {partido.away?.name}
                    </span>
                  )}
                  <span style={{ fontSize: '.65rem', color: S.muted, marginLeft: 'auto' }}>
                    {new Date(n.creada_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                {/* Título */}
                <div style={{ fontWeight: '800', fontSize: '1rem', color: S.text, lineHeight: 1.3, marginBottom: '10px' }}>
                  {n.titulo}
                </div>

                {/* Preview del cuerpo */}
                {!isExpand && (
                  <div style={{ fontSize: '.8rem', color: S.text2, lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {n.cuerpo}
                  </div>
                )}

                {/* Expandido */}
                {isExpand && (
                  <div>
                    <div style={{ fontSize: '.82rem', color: S.text2, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                      {n.cuerpo}
                    </div>
                    {n.hashtags && (
                      <div style={{ fontSize: '.78rem', color: S.cyan, fontWeight: '500', marginBottom: '8px' }}>{n.hashtags}</div>
                    )}
                  </div>
                )}

                {/* Botón leer más */}
                <button onClick={() => setExpanded(isExpand ? null : n.id)}
                  style={{ marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', color: S.cyan, fontSize: '.75rem', fontWeight: '600', padding: 0 }}>
                  {isExpand ? 'Leer menos ↑' : 'Leer más →'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
