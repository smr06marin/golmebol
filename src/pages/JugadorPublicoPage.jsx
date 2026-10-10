import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cargarJugadorPublico, posicionDeJugador } from '../lib/perfilPublico'
import { guardarCacheRapido, leerCacheRapido } from '../lib/cacheRapido'
import { esHostPropioGolmebol } from '../lib/marcaPagina'
import {
  C, useVolver, BotonVolver, BotonCompartir, Escudo, FotoJugador, Numero, Pestanas,
  Tarjeta, Vacio, PaginaCargando, NoEncontrado, fmtFecha,
} from '../components/PerfilPublicoUI'

// ── Perfil PÚBLICO de un jugador (/j/:id) ───────────────────────────────────
// Solo muestra lo deportivo: nombre, foto, posición, equipo y estadísticas.
// Los datos se piden a `players_publico` (vista segura): NUNCA se muestran ni
// se piden cédula, teléfono, fecha de nacimiento ni otros datos personales.
// El panel privado del jugador (con su historial completo) sigue en /jugador.

const TABS = [
  { id: 'resumen',  label: 'Resumen' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'logros',   label: 'Logros' },
]

const META_GOLES = [10, 25, 50, 100]

export default function JugadorPublicoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const volver = useVolver()
  const claveCache = `perfil_jugador_${id}`

  const [datos, setDatos] = useState(() => leerCacheRapido(claveCache))
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('resumen')

  useEffect(() => {
    let cancelado = false
    setError(false)
    const cache = leerCacheRapido(claveCache)
    setDatos(cache); setCargando(!cache)
    cargarJugadorPublico(id)
      .then(r => {
        if (cancelado) return
        setDatos(r); setCargando(false)
        if (r?.jugador) guardarCacheRapido(claveCache, r)
      })
      .catch(() => { if (!cancelado) { setCargando(false); if (!cache) setError(true) } })
    return () => { cancelado = true }
  }, [id])

  useEffect(() => { window.scrollTo?.(0, 0) }, [id])

  useEffect(() => {
    if (!datos?.jugador || !esHostPropioGolmebol()) return
    const anterior = document.title
    document.title = `${datos.jugador.name} · Golmebol`
    return () => { document.title = anterior }
  }, [datos?.jugador?.name])

  if (cargando && !datos) return <PaginaCargando/>
  if (error && !datos) return <NoEncontrado que="este jugador (revisa tu conexión e intenta de nuevo)"/>
  if (!datos?.jugador) return <NoEncontrado que="este jugador"/>

  const { jugador, totales, porTorneo, partidos, equipoActual, campeonatos } = datos
  const posicion = posicionDeJugador(jugador, partidos[0]?.tournaments?.modalidad)
  const promedio = totales.pj > 0 ? (totales.goles / totales.pj).toFixed(2) : '0.00'
  const proximaMeta = META_GOLES.find(m => totales.goles < m)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', paddingBottom: '70px' }}>
      <div style={{ background: 'linear-gradient(135deg, var(--color-secundario, #0d47a1) 0%, var(--color-primario, #1a73e8) 60%, #00bcd4 100%)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BotonVolver onClick={volver}/>
            <BotonCompartir titulo={jugador.name} ruta={`/j/${jugador.id}`}/>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ border: '3px solid rgba(255,255,255,.55)', borderRadius: '50%', flexShrink: 0, lineHeight: 0 }}>
              <FotoJugador url={jugador.photo_face_url || jugador.photo_url} nombre={jugador.name} size={82}/>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{jugador.name}</h1>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                {posicion && <span style={{ fontSize: '.74rem', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 20, padding: '3px 11px', fontWeight: 600 }}>{posicion}</span>}
                {equipoActual && (
                  <span role="link" tabIndex={0} onClick={() => navigate(`/e/${equipoActual.id}`)} onKeyDown={e => { if (e.key === 'Enter') navigate(`/e/${equipoActual.id}`) }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,.95)', borderRadius: 20, padding: '2px 11px 2px 3px', cursor: 'pointer', maxWidth: '100%' }}>
                    <Escudo url={equipoActual.logo_url} nombre={equipoActual.name} size={22} radio={11} fondo={C.soft}/>
                    <span style={{ fontSize: '.76rem', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{equipoActual.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', marginTop: '18px' }}>
            <Numero valor={totales.pj} etiqueta="Partidos" color="#fff"/>
            <Numero valor={totales.goles} etiqueta="Goles" color="#fde68a"/>
            <Numero valor={totales.amarillas} etiqueta="Amarillas" color="#fff"/>
            <Numero valor={totales.mvp} etiqueta="MVP" color="#a7f3d0"/>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px 16px 0' }}>
        <Pestanas tabs={TABS} activa={tab} onCambiar={setTab}/>

        {tab === 'resumen' && (
          <>
            {totales.pj === 0 ? (
              <Tarjeta><Vacio>Aún no tiene partidos registrados</Vacio></Tarjeta>
            ) : (
              <>
                <Tarjeta titulo="Rendimiento">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', textAlign: 'center' }}>
                    {[
                      { v: promedio, e: 'Goles por partido' },
                      { v: totales.hatTricks, e: 'Hat-tricks' },
                      { v: totales.rojas, e: 'Rojas' },
                    ].map((x, i) => (
                      <div key={x.e} style={{ padding: '14px 6px', borderLeft: i ? `1px solid ${C.soft}` : 'none' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: C.text }}>{x.v}</div>
                        <div style={{ fontSize: '.68rem', color: C.muted, fontWeight: 600 }}>{x.e}</div>
                      </div>
                    ))}
                  </div>
                  {(totales.g + totales.e + totales.p) > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.soft}`, fontSize: '.78rem', color: C.muted, textAlign: 'center' }}>
                      Con su equipo: <b style={{ color: C.win }}>{totales.g} ganados</b> · {totales.e} empatados · <b style={{ color: C.loss }}>{totales.p} perdidos</b>
                    </div>
                  )}
                </Tarjeta>

                <Tarjeta titulo="Por torneo">
                  {porTorneo.map((t, i) => (
                    <div key={t.torneo?.id || i} role="link" tabIndex={0} onClick={() => t.torneo?.id && navigate(`/t/${t.torneo.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: `1px solid ${C.soft}`, cursor: t.torneo?.id ? 'pointer' : 'default' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.86rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.torneo?.name || 'Torneo'}</div>
                        <div style={{ fontSize: '.72rem', color: C.muted }}>{t.equipo?.name || ''}{t.equipo?.name ? ' · ' : ''}{t.pj} {t.pj === 1 ? 'partido' : 'partidos'}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '.8rem', color: C.text2, whiteSpace: 'nowrap' }}>
                        <b style={{ color: C.text }}>{t.goles}</b> ⚽{t.amarillas > 0 ? <span style={{ color: C.gold }}> · {t.amarillas} 🟨</span> : null}{t.rojas > 0 ? <span style={{ color: C.loss }}> · {t.rojas} 🟥</span> : null}
                      </div>
                      <ChevronRight size={16} color={C.faint}/>
                    </div>
                  ))}
                </Tarjeta>
              </>
            )}
          </>
        )}

        {tab === 'partidos' && (
          <Tarjeta titulo={`Partidos · ${partidos.length}`}>
            {partidos.length === 0 ? <Vacio>Aún no tiene partidos registrados</Vacio> : partidos.map(s => {
              const m = s.matches
              const resultado = s.team_result === 'win' ? 'G' : s.team_result === 'loss' ? 'P' : s.team_result === 'draw' ? 'E' : null
              const color = resultado === 'G' ? [C.win, C.winBg] : resultado === 'P' ? [C.loss, C.lossBg] : [C.draw, C.drawBg]
              return (
                <div key={s.id} role="link" tabIndex={0} onClick={() => s.tournament_id && navigate(`/t/${s.tournament_id}`)}
                  style={{ padding: '11px 16px', borderBottom: `1px solid ${C.soft}`, cursor: s.tournament_id ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '.66rem', color: C.faint, fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tournaments?.name || 'Torneo'}</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{fmtFecha(m?.played_at || s.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {resultado && <span style={{ width: 24, height: 24, borderRadius: '50%', background: color[1], color: color[0], border: `1.5px solid ${color[0]}`, fontSize: '.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{resultado}</span>}
                    <div style={{ minWidth: 0, flex: 1, fontSize: '.82rem', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m?.home?.name && m?.away?.name ? <>{m.home.name} <b style={{ color: C.text }}>{m.home_score ?? 0} - {m.away_score ?? 0}</b> {m.away.name}</> : (s.teams?.name || '')}
                    </div>
                    <div style={{ fontSize: '.78rem', whiteSpace: 'nowrap', color: C.text2 }}>
                      {(s.goals_scored || 0) > 0 && <b style={{ color: C.text }}>{s.goals_scored} ⚽ </b>}
                      {(s.yellow_cards || 0) + (s.blue_cards || 0) > 0 && <span>🟨 </span>}
                      {(s.red_cards || 0) > 0 && <span>🟥 </span>}
                      {s.es_mvp && <span title="Jugador del partido">⭐</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </Tarjeta>
        )}

        {tab === 'logros' && (
          <>
            <Tarjeta titulo="Camino a los goles">
              <div style={{ padding: '14px 16px' }}>
                {META_GOLES.map(meta => {
                  const logrado = totales.goles >= meta
                  const pct = Math.min(100, Math.round((totales.goles / meta) * 100))
                  return (
                    <div key={meta} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', fontWeight: 700, color: logrado ? C.win : C.text2, marginBottom: '5px' }}>
                        <span>{logrado ? '✅' : '⚽'} {meta} goles</span><span>{Math.min(totales.goles, meta)}/{meta}</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 4, background: C.soft, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: logrado ? C.win : 'var(--color-primario, #1a73e8)', borderRadius: 4 }}/>
                      </div>
                    </div>
                  )
                })}
                {!proximaMeta && <div style={{ fontSize: '.78rem', color: C.muted, textAlign: 'center' }}>Superó todas las metas</div>}
              </div>
            </Tarjeta>
            <Tarjeta titulo="Reconocimientos">
              {totales.mvp === 0 && totales.hatTricks === 0 && campeonatos.length === 0
                ? <Vacio>Aún no tiene reconocimientos</Vacio>
                : (
                  <div style={{ padding: '6px 0' }}>
                    {totales.mvp > 0 && <div style={{ padding: '10px 16px', fontSize: '.85rem', color: C.text2 }}>⭐ <b>{totales.mvp}</b> {totales.mvp === 1 ? 'vez' : 'veces'} jugador del partido</div>}
                    {totales.hatTricks > 0 && <div style={{ padding: '10px 16px', fontSize: '.85rem', color: C.text2 }}>🎩 <b>{totales.hatTricks}</b> {totales.hatTricks === 1 ? 'hat-trick' : 'hat-tricks'}</div>}
                    {campeonatos.map(l => (
                      <div key={l.id} role="link" tabIndex={0} onClick={() => l.tournament_id && navigate(`/t/${l.tournament_id}`)} style={{ padding: '10px 16px', fontSize: '.85rem', color: C.text2, cursor: 'pointer' }}>
                        🏆 Campeón · <b>{l.tournaments?.name || 'Torneo'}</b>
                      </div>
                    ))}
                  </div>
                )}
            </Tarjeta>
          </>
        )}
      </div>
    </div>
  )
}
