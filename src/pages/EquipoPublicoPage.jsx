import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Trophy, ChevronRight } from 'lucide-react'
import { cargarEquipoPublico, posicionDeJugador, resultadoPara } from '../lib/perfilPublico'
import { guardarCacheRapido, leerCacheRapido } from '../lib/cacheRapido'
import { cargarUniverso, puestosEquipo, MIN_PJ_TASA } from '../lib/rankings'
import { useFavoritos } from '../lib/favoritos'
import { esHostPropioGolmebol } from '../lib/marcaPagina'
import BotonEstrella from '../components/BotonEstrella'
import {
  C, useVolver, BotonVolver, BotonCompartir, Escudo, FotoJugador, ChipForma, Numero, Pestanas,
  Tarjeta, Vacio, PaginaCargando, NoEncontrado, fmtFecha, fmtHora, ChipPuesto,
} from '../components/PerfilPublicoUI'

// ── Perfil PÚBLICO de un equipo (/e/:id) ────────────────────────────────────
// Lo ve cualquiera, sin iniciar sesión: escudo, forma reciente, próximos
// partidos, resultados, plantilla con goles, torneos y palmarés. Los datos de
// contacto del representante NUNCA se piden (ver lib/perfilPublico.js).
// La página de gestión (encargado del equipo) sigue siendo /equipos/:id.

const TABS = [
  { id: 'resumen',  label: 'Resumen' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'plantilla', label: 'Plantilla' },
  { id: 'torneos',  label: 'Torneos' },
]
const FASES = { octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final' }

function FilaPartido({ p, equipoId, navigate }) {
  const jugado = p.status === 'finished'
  const r = jugado ? resultadoPara(p, equipoId) : null
  const nombreEquipo = (eq) => eq.id === equipoId
    ? <span style={{ fontWeight: 800, color: C.text }}>{eq.name}</span>
    : <span onClick={e => { e.stopPropagation(); navigate(`/e/${eq.id}`) }} style={{ fontWeight: 600, color: C.text2, cursor: 'pointer' }}>{eq.name}</span>
  return (
    <div role="link" tabIndex={0} onClick={() => p.tournament_id && navigate(`/t/${p.tournament_id}`)}
      onKeyDown={e => { if (e.key === 'Enter' && p.tournament_id) navigate(`/t/${p.tournament_id}`) }}
      style={{ padding: '11px 14px', borderBottom: `1px solid ${C.soft}`, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '.66rem', color: C.faint, fontWeight: 600, marginBottom: '7px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.tournaments?.name || 'Torneo'}{FASES[p.fase] ? ` · ${FASES[p.fase]}` : ''}
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>{fmtFecha(p.played_at)}{!jugado && p.played_at ? ` · ${fmtHora(p.played_at)}` : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px minmax(0,1fr)', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, justifyContent: 'flex-end', textAlign: 'right', fontSize: '.8rem' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreEquipo(p.home)}</span>
          <Escudo url={p.home.logo_url} nombre={p.home.name} size={26} radio={6} fondo={C.soft}/>
        </div>
        <div style={{ textAlign: 'center' }}>
          {jugado
            ? <span style={{ display: 'inline-block', minWidth: '52px', padding: '4px 0', borderRadius: '8px', fontWeight: 800, fontSize: '.92rem', color: C.text, background: r === 'G' ? C.winBg : r === 'P' ? C.lossBg : C.drawBg }}>{p.home_score ?? 0} - {p.away_score ?? 0}</span>
            : <span style={{ fontSize: '.72rem', fontWeight: 700, color: C.muted }}>vs</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, fontSize: '.8rem' }}>
          <Escudo url={p.away.logo_url} nombre={p.away.name} size={26} radio={6} fondo={C.soft}/>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreEquipo(p.away)}</span>
        </div>
      </div>
    </div>
  )
}

function Palmares({ campeonatos, subcampeonatos, terceros, navigate }) {
  const items = [
    ...campeonatos.map(l => ({ ...l, icono: '🏆', texto: 'Campeón' })),
    ...subcampeonatos.map(l => ({ ...l, icono: '🥈', texto: 'Subcampeón' })),
    ...terceros.map(l => ({ ...l, icono: '🥉', texto: 'Tercer puesto' })),
  ]
  if (items.length === 0) return <Vacio>Aún no tiene títulos registrados</Vacio>
  return items.map(l => (
    <div key={l.id} role="link" tabIndex={0} onClick={() => l.tournament_id && navigate(`/t/${l.tournament_id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: `1px solid ${C.soft}`, cursor: 'pointer' }}>
      <span style={{ fontSize: '1.4rem' }}>{l.icono}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '.86rem', color: C.text }}>{l.texto}</div>
        <div style={{ fontSize: '.74rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.tournaments?.name || 'Torneo'}</div>
      </div>
      <ChevronRight size={16} color={C.faint}/>
    </div>
  ))
}

export default function EquipoPublicoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const volver = useVolver()
  const { esFavorito, alternar } = useFavoritos()
  const claveCache = `perfil_equipo_${id}`

  const [datos, setDatos] = useState(() => leerCacheRapido(claveCache))
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('resumen')
  // Puestos ("top") frente a los demás equipos: de toda la plataforma y de cada torneo.
  const claveP = `puestos_equipo_${id}`
  const [puestos, setPuestos] = useState(() => leerCacheRapido(claveP))
  const hayEquipo = !!datos?.equipo

  useEffect(() => {
    let cancelado = false
    setPuestos(leerCacheRapido(claveP))
    if (!hayEquipo) return
    cargarUniverso()
      .then(u => {
        if (cancelado) return
        const p = puestosEquipo(u, id)
        if (p) { setPuestos(p); guardarCacheRapido(claveP, p) }
      })
      .catch(() => { /* sin puestos: el perfil se ve igual */ })
    return () => { cancelado = true }
  }, [id, hayEquipo])

  useEffect(() => {
    let cancelado = false
    setError(false)
    const cache = leerCacheRapido(claveCache)
    setDatos(cache); setCargando(!cache)
    cargarEquipoPublico(id)
      .then(r => {
        if (cancelado) return
        setDatos(r); setCargando(false)
        if (r?.equipo) guardarCacheRapido(claveCache, r)
      })
      .catch(() => { if (!cancelado) { setCargando(false); if (!cache) setError(true) } })
    return () => { cancelado = true }
  }, [id])

  useEffect(() => { window.scrollTo?.(0, 0) }, [id])

  useEffect(() => {
    if (!datos?.equipo || !esHostPropioGolmebol()) return
    const anterior = document.title
    document.title = `${datos.equipo.name} · Golmebol`
    return () => { document.title = anterior }
  }, [datos?.equipo?.name])

  const proximo = datos?.proximos?.[0] || null
  const tabs = useMemo(() => TABS, [])

  if (cargando && !datos) return <PaginaCargando/>
  if (error && !datos) return <NoEncontrado que="este equipo (revisa tu conexión e intenta de nuevo)"/>
  if (!datos?.equipo) return <NoEncontrado que="este equipo"/>

  const { equipo, totales, forma, jugados, proximos, torneos, plantilla, campeonatos, subcampeonatos, terceros } = datos
  const titulos = campeonatos.length
  const dif = totales.gf - totales.gc
  const PL = puestos?.plataforma || {}            // puestos entre todos los equipos
  const PT = tid => puestos?.torneos?.[tid] || {}  // puestos en un torneo

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', paddingBottom: '70px' }}>
      <div style={{ background: 'linear-gradient(135deg, var(--color-secundario, #0d47a1) 0%, var(--color-primario, #1a73e8) 60%, #00bcd4 100%)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '20px 16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BotonVolver onClick={volver}/>
            <BotonCompartir titulo={equipo.name} ruta={`/e/${equipo.id}`}/>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 76, height: 76, borderRadius: 18, background: 'rgba(255,255,255,.18)', border: '2px solid rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              <Escudo url={equipo.logo_url} nombre={equipo.name} size={72} radio={16} fondo="transparent"/>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, overflowWrap: 'anywhere' }}>{equipo.name}</h1>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                {equipo.modalidad && <span style={{ fontSize: '.74rem', background: 'rgba(255,255,255,.22)', color: '#fff', borderRadius: 20, padding: '3px 11px', fontWeight: 600 }}>{equipo.modalidad}</span>}
                {equipo.genero && <span style={{ fontSize: '.74rem', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 20, padding: '3px 11px' }}>{equipo.genero}</span>}
                {equipo.city && <span style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.85)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/>{equipo.city}</span>}
              </div>
            </div>
            <BotonEstrella activo={esFavorito(equipo.id)} onClick={() => alternar(equipo.id)} nombre={equipo.name} size={24} area={44} colorOff="rgba(255,255,255,.8)" colorOn="#ffd54f"/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '8px', marginTop: '18px' }}>
            <Numero valor={totales.pj} etiqueta="PJ" color="#fff" puesto={PL.pj}/>
            <Numero valor={totales.g} etiqueta="G" color="#a7f3d0" puesto={PL.g}/>
            <Numero valor={totales.e} etiqueta="E" color="#fff"/>
            <Numero valor={totales.p} etiqueta="P" color="#fecaca" puesto={PL.p}/>
            <Numero valor={`${dif > 0 ? '+' : ''}${dif}`} etiqueta="DG" color="#fde68a" puesto={PL.dg}/>
          </div>
          {forma.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
              <span style={{ fontSize: '.64rem', fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Forma</span>
              <div style={{ display: 'flex', gap: '5px' }}>{forma.map((l, i) => <ChipForma key={i} letra={l}/>)}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '16px 16px 0' }}>
        <Pestanas tabs={tabs} activa={tab} onCambiar={setTab}/>

        {tab === 'resumen' && (
          <>
            {proximo && (
              <Tarjeta titulo="Próximo partido">
                <FilaPartido p={proximo} equipoId={equipo.id} navigate={navigate}/>
              </Tarjeta>
            )}
            <Tarjeta titulo={`Palmarés${titulos ? ` · ${titulos} ${titulos === 1 ? 'título' : 'títulos'}` : ''}`} aside={<ChipPuesto p={PL.camp}/>}>
              <Palmares campeonatos={campeonatos} subcampeonatos={subcampeonatos} terceros={terceros} navigate={navigate}/>
            </Tarjeta>
            <Tarjeta titulo="Últimos resultados" aside={jugados.length > 5 ? <button onClick={() => setTab('partidos')} style={{ border: 'none', background: 'none', color: 'var(--color-primario, #1a73e8)', fontWeight: 700, fontSize: '.72rem', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'none' }}>Ver todos</button> : null}>
              {jugados.length === 0 ? <Vacio>Aún no ha jugado partidos</Vacio> : jugados.slice(0, 5).map(p => <FilaPartido key={p.id} p={p} equipoId={equipo.id} navigate={navigate}/>)}
            </Tarjeta>
            {totales.pj > 0 && (
              <Tarjeta titulo="Goles y puntos">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' }}>
                  <div style={{ padding: '14px 8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: C.win }}>{totales.gf}</div>
                    <div style={{ fontSize: '.7rem', color: C.muted, fontWeight: 600 }}>A favor · {(totales.gf / totales.pj).toFixed(1)} por partido</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '7px' }}>
                      <ChipPuesto p={PL.gf} etiqueta="Total"/><ChipPuesto p={PL.gfpp} etiqueta="Por partido"/>
                    </div>
                  </div>
                  <div style={{ padding: '14px 8px', borderLeft: `1px solid ${C.soft}` }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: C.loss }}>{totales.gc}</div>
                    <div style={{ fontSize: '.7rem', color: C.muted, fontWeight: 600 }}>En contra · {(totales.gc / totales.pj).toFixed(1)} por partido</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '7px' }}>
                      <ChipPuesto p={PL.gc} etiqueta="Total"/><ChipPuesto p={PL.gcpp} etiqueta="Por partido"/>
                    </div>
                  </div>
                </div>
                {PL.pts && (
                  <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.soft}`, fontSize: '.78rem', color: C.muted, textAlign: 'center' }}>
                    Puntos (3 por victoria, 1 por empate): <b style={{ color: C.text }}>{totales.g * 3 + totales.e}</b> <ChipPuesto p={PL.pts}/>
                  </div>
                )}
              </Tarjeta>
            )}
            {Object.keys(PL).length > 0 && (
              <div style={{ fontSize: '.68rem', color: C.faint, lineHeight: 1.5, padding: '0 4px 16px' }}>
                <b>Puestos:</b> en la cabecera y en goles se compara con todos los equipos de Golmebol; en cada torneo (pestaña Torneos), con los de ese torneo. En derrotas y goles en contra el #1 es quien menos tiene. Los promedios cuentan desde {MIN_PJ_TASA} partidos.
              </div>
            )}
          </>
        )}

        {tab === 'partidos' && (
          <>
            {proximos.length > 0 && <Tarjeta titulo="Próximos">{proximos.map(p => <FilaPartido key={p.id} p={p} equipoId={equipo.id} navigate={navigate}/>)}</Tarjeta>}
            <Tarjeta titulo="Resultados">
              {jugados.length === 0 ? <Vacio>Aún no ha jugado partidos</Vacio> : jugados.map(p => <FilaPartido key={p.id} p={p} equipoId={equipo.id} navigate={navigate}/>)}
            </Tarjeta>
          </>
        )}

        {tab === 'plantilla' && (
          <Tarjeta titulo={`Plantilla · ${plantilla.length}`}>
            {plantilla.length === 0 ? <Vacio>Aún no hay jugadores inscritos</Vacio> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 38px 38px 38px', gap: '4px', padding: '8px 16px', fontSize: '.62rem', fontWeight: 800, color: C.faint, letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: `1px solid ${C.soft}` }}>
                  <span>Jugador</span><span style={{ textAlign: 'center' }}>PJ</span><span style={{ textAlign: 'center' }}>⚽</span><span style={{ textAlign: 'center' }}>🟨</span>
                </div>
                {plantilla.map(j => (
                  <div key={j.id} role="link" tabIndex={0} onClick={() => navigate(`/j/${j.id}`)} onKeyDown={e => { if (e.key === 'Enter') navigate(`/j/${j.id}`) }}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 38px 38px 38px', gap: '4px', alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid ${C.soft}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <FotoJugador url={j.photo_face_url || j.photo_url} nombre={j.name} size={38}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '.84rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</div>
                        {posicionDeJugador(j, equipo.modalidad) && <div style={{ fontSize: '.68rem', color: C.muted }}>{posicionDeJugador(j, equipo.modalidad)}</div>}
                      </div>
                    </div>
                    <span style={{ textAlign: 'center', fontSize: '.8rem', color: C.text2 }}>{j.pj}</span>
                    <span style={{ textAlign: 'center', fontSize: '.84rem', fontWeight: 800, color: j.goles > 0 ? C.text : C.faint }}>{j.goles}</span>
                    <span style={{ textAlign: 'center', fontSize: '.8rem', color: j.amarillas > 0 ? C.gold : C.faint }}>{j.amarillas}</span>
                  </div>
                ))}
                <div style={{ padding: '10px 16px', fontSize: '.68rem', color: C.faint, lineHeight: 1.4 }}>
                  PJ = partidos en los que quedó anotado en la planilla. Estar en la plantilla sin jugar no suma partido.
                </div>
              </>
            )}
          </Tarjeta>
        )}

        {tab === 'torneos' && (
          <Tarjeta titulo={`Torneos · ${torneos.length}`}>
            {torneos.length === 0 ? <Vacio>Aún no está inscrito en torneos</Vacio> : torneos.map(t => (
              <div key={t.id} role="link" tabIndex={0} onClick={() => navigate(`/t/${t.id}`)} onKeyDown={e => { if (e.key === 'Enter') navigate(`/t/${t.id}`) }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: `1px solid ${C.soft}`, cursor: 'pointer' }}>
                <Escudo url={t.logo_url} nombre={t.name} size={38} radio={9} fondo={C.soft}/>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.86rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize: '.72rem', color: C.muted }}>
                    {t.pj > 0 ? `${t.pj} PJ · ${t.g}G ${t.e}E ${t.p}P · ${t.gf}-${t.gc}` : 'Sin partidos jugados'}
                  </div>
                  {t.pj > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
                      {[['pts', 'Puntos'], ['gf', 'Goles a favor'], ['gc', 'Goles en contra']].map(([k, et]) => PT(t.id)[k] ? <ChipPuesto key={k} p={PT(t.id)[k]} etiqueta={et}/> : null)}
                    </div>
                  )}
                </div>
                {campeonatos.some(l => l.tournament_id === t.id) && <Trophy size={16} color="#f9a825"/>}
                <ChevronRight size={16} color={C.faint}/>
              </div>
            ))}
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
