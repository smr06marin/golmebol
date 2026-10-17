import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Shield, MapPin, Clock, Trophy, AlertTriangle } from 'lucide-react'
import PlanillaRapida from '../components/planillaRapida/PlanillaRapida'
import { fmtHoraDate } from '../lib/horaHelpers'

// Entrada pública (sin cuenta ni login) para que cualquiera que tenga el
// link entre directo a planillar — el link es de 24h y lo genera el
// organizador (ver botón "Link árbitro" en /admin/calendario).
//
// El link puede ser de UN partido (se muestra el partido grande y un botón
// para entrar) o de VARIOS partidos del mismo torneo (link de grupo: se
// muestra la lista y el árbitro entra al que le toca; al guardar el
// resultado vuelve a la lista con ese partido marcado como jugado).
//
// A propósito NO pide nombre ni crea ningún "jugador árbitro" por sesión:
// cada link es simplemente la puerta a ESE partido puntual, y todos los que
// entren por ahí (uno o varios celulares, a la vez o en momentos distintos)
// ven y editan la MISMA planilla — PlanillaRapida ya sabe fusionar lo que
// hay guardado (roster, goles, cronómetro) sin borrar nada, así que entrar
// de nuevo — incluso a un partido ya jugado o que se está jugando ahora
// mismo desde otro celular — nunca pisa lo que ya está cargado.
//
// Pasos:
//  1) Se valida el token con ver_partido_por_link() (público, solo lectura)
//     y se muestra bien grande el partido — para confirmar que es el que
//     toca antes de entrar.
//  2) Al tocar "Entrar a planillar": si el celular no tiene sesión, se hace
//     un login anónimo de Supabase (requiere "Allow anonymous sign-ins"
//     activado en el proyecto) — solo para poder guardar, no identifica a
//     nadie ni crea un jugador.
//  3) Se abre PlanillaRapida (la Planilla Rápida normal, sin ningún cambio)
//     ya cargada con ese partido.
export default function PlanillarLinkPage() {
  const { token } = useParams()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [entrando, setEntrando] = useState(false)
  const [partido, setPartido] = useState(null)
  const [terminado, setTerminado] = useState(false)
  const [lista, setLista] = useState(null)          // partidos del link (null hasta cargar)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const esGrupo = !!lista && lista.length > 1

  useEffect(() => { cargarPreview() }, [token])

  async function cargarPreview(silencioso = false) {
    if (!silencioso) setCargando(true)
    // Una sola llamada sirve para link de grupo y de un solo partido.
    const { data: dg, error: errG } = await supabase.rpc('ver_partidos_por_link', { p_token: token })
    let partidos = null
    let vencido = false
    let invalido = false
    if (!errG && dg && Array.isArray(dg.partidos) && dg.partidos.length) {
      partidos = dg.partidos
      vencido = !!dg.vencido
    } else if (errG && errG.message === 'Link inválido') {
      invalido = true
    } else {
      // Si todavía no se corrió la migración del link de grupo (o falló la
      // red) se intenta como link de un solo partido, igual que siempre.
      const { data, error: err } = await supabase.rpc('ver_partido_por_link', { p_token: token })
      if (err || !data) invalido = err?.message === 'Link inválido' || !err
      else { partidos = [data]; vencido = !!data.vencido }
      if (!partidos && !invalido) vencido = true
    }

    if (silencioso) {
      // Al volver de una planilla solo se refresca la lista; si falla, se deja la que había
      if (partidos) setLista(partidos)
      return
    }
    if (!partidos) {
      setError(invalido ? 'Este link no es válido.' : 'Este link ya venció (los links duran 24 horas).')
    } else if (vencido) {
      setError('Este link ya venció (los links duran 24 horas).')
    } else {
      setLista(partidos)
      setPreview(partidos.length === 1 ? partidos[0] : null)
    }
    setCargando(false)
  }

  async function handleEntrar(matchId) {
    setEntrando(matchId || true)
    setGuardadoOk(false)
    setError('')
    try {
      // Solo hace falta ALGUNA sesión para poder guardar (así sea anónima) —
      // no identifica a la persona ni crea ningún jugador. Si el celular ya
      // tiene cualquier sesión (anónima de antes, o una cuenta real), se
      // respeta tal cual: no hace falta una nueva por cada link.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { error: errAnon } = await supabase.auth.signInAnonymously()
        if (errAnon) throw new Error('No se pudo entrar: ' + errAnon.message)
      }

      const { data: match, error: errMatch } = await supabase.from('matches')
        .select('*, tournaments(id,name,modalidad), home:home_team_id(name,logo_url), away:away_team_id(name,logo_url)')
        .eq('id', matchId).single()
      if (errMatch || !match) throw new Error('No se pudo cargar el partido')

      setPartido(match)
    } catch (e) {
      setError(e.message || 'Error al entrar')
    } finally {
      setEntrando(false)
    }
  }

  const wrap = { minHeight: '100vh', background: '#07070e', fontFamily: 'system-ui,sans-serif', color: '#e8f4fd', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }

  // "Guardado" (resultado final ya guardado) va ANTES que "partido": si no,
  // como PlanillaRapida llama primero a onGuardarResultado y luego a
  // onClose, pero partido nunca se limpiaba, se seguía mostrando la
  // planilla de nuevo en vez de la pantalla de "listo". Al pausar
  // (Suspender) SOLO se llama a onClose (sin onGuardarResultado) — ahí no
  // se marca terminado, se limpia partido y vuelve a la pantalla de
  // "Entrar a planillar" para poder seguir el partido después por el mismo link.
  if (terminado) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>✓</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>Resultado guardado</div>
          <div style={{ fontSize: '.85rem', color: '#7a9ab5', marginTop: '6px' }}>Ya puedes salir — cierra esta página.</div>
        </div>
      </div>
    )
  }

  if (partido) {
    return (
      <PlanillaRapida
        partido={partido}
        onClose={() => { setPartido(null); if (esGrupo) cargarPreview(true) }}
        onGuardarResultado={() => { if (esGrupo) setGuardadoOk(true); else setTerminado(true) }}
      />
    )
  }

  if (cargando) {
    return <div style={wrap}><div style={{ color: '#00ddd0', fontSize: '.9rem' }}>Cargando...</div></div>
  }

  if (error && !preview && !lista) {
    return (
      <div style={wrap}>
        <div style={{ textAlign: 'center', maxWidth: '340px' }}>
          <AlertTriangle size={36} color="#e8710a" style={{ marginBottom: '10px' }}/>
          <div style={{ fontSize: '1rem', fontWeight: '800' }}>{error}</div>
          <div style={{ fontSize: '.8rem', color: '#7a9ab5', marginTop: '8px' }}>Pídele al organizador que te mande un link nuevo.</div>
        </div>
      </div>
    )
  }

  // Link de grupo: lista de los partidos que le tocan a este árbitro
  if (esGrupo) {
    const pendientes = lista.filter(m => m.status !== 'finished').length
    return (
      <div style={{ ...wrap, alignItems: 'flex-start' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '.65rem', letterSpacing: '.3em', color: '#7a9ab5', textTransform: 'uppercase' }}>GOLMEBOL · PLANILLA</div>
            <div style={{ fontSize: '.8rem', color: '#f9a825', fontWeight: '700', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <Trophy size={13}/> {lista[0].torneo}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', marginTop: '6px' }}>Tus partidos ({lista.length})</div>
            <div style={{ fontSize: '.75rem', color: '#7a9ab5', marginTop: '3px' }}>
              {pendientes > 0 ? `Toca el partido que vas a planillar · faltan ${pendientes}` : 'Ya están todos los partidos jugados'}
            </div>
          </div>

          {guardadoOk && (
            <div style={{ background: 'rgba(52,168,83,.12)', border: '1px solid rgba(52,168,83,.4)', color: '#7ee0a0', borderRadius: '10px', padding: '10px 12px', fontSize: '.8rem', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>
              ✓ Resultado guardado
            </div>
          )}
          {error && <div style={{ fontSize: '.78rem', color: '#ff6b6b', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '24px' }}>
            {lista.map(m => {
              const jugado = m.status === 'finished'
              const cargandoEste = entrando === m.id
              return (
                <div key={m.id} style={{ background: '#111827', border: `1px solid ${jugado ? '#1f3d2b' : '#1e2d3d'}`, borderRadius: '14px', padding: '14px', opacity: jugado ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00ddd0', fontSize: '.78rem', fontWeight: '800' }}>
                      <Clock size={12}/> {m.hora ? fmtHoraDate(m.hora) : '—'}
                    </span>
                    {m.hora && <span style={{ fontSize: '.68rem', color: '#7a9ab5' }}>{new Date(m.hora).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}</span>}
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: '#f9a825', fontSize: '.7rem', fontWeight: '700' }}>
                      <MapPin size={11}/> {m.cancha || 'Por confirmar'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {[{ n: m.home, l: m.home_logo }, { n: m.away, l: m.away_logo }].map((e, i) => (
                      <div key={i} style={{ display: 'contents' }}>
                        {i === 1 && <div style={{ fontWeight: '900', fontSize: '.7rem', color: '#7a9ab5' }}>VS</div>}
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                          {e.l
                            ? <img src={e.l} style={{ width: '36px', height: '36px', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}/>
                            : <div style={{ width: '36px', height: '36px', margin: '0 auto 4px', borderRadius: '9px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={18} color="#7a9ab5"/></div>}
                          <div style={{ fontWeight: '800', fontSize: '.8rem', color: '#e8f4fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.n || 'Por definir'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {jugado ? (
                    <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '.78rem', fontWeight: '800', color: '#7ee0a0' }}>✓ Jugado</div>
                  ) : (
                    <button onClick={() => handleEntrar(m.id)} disabled={!!entrando}
                      style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '10px', border: 'none', cursor: entrando ? 'default' : 'pointer', background: 'linear-gradient(135deg,#1a73e8,#00ddd0)', color: '#07070e', fontSize: '.88rem', fontWeight: '800', opacity: entrando && !cargandoEste ? 0.5 : 1 }}>
                      {cargandoEste ? 'Entrando...' : 'Planillar este partido'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '.65rem', letterSpacing: '.3em', color: '#7a9ab5', textTransform: 'uppercase' }}>GOLMEBOL · PLANILLA</div>
        </div>

        {/* Partido bien grande y claro — esto es lo primero que confirma quien entra */}
        <div style={{ background: '#111827', border: '1px solid #1e2d3d', borderRadius: '16px', padding: '22px 18px', marginBottom: '18px' }}>
          <div style={{ textAlign: 'center', fontSize: '.75rem', color: '#f9a825', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Trophy size={13}/> {preview.torneo}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {preview.home_logo
                ? <img src={preview.home_logo} style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 6px' }}/>
                : <div style={{ width: '44px', height: '44px', margin: '0 auto 6px', borderRadius: '10px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} color="#7a9ab5"/></div>}
              <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#e8f4fd' }}>{preview.home || 'Por definir'}</div>
            </div>
            <div style={{ fontWeight: '900', fontSize: '.8rem', color: '#7a9ab5' }}>VS</div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              {preview.away_logo
                ? <img src={preview.away_logo} style={{ width: '44px', height: '44px', objectFit: 'contain', margin: '0 auto 6px' }}/>
                : <div style={{ width: '44px', height: '44px', margin: '0 auto 6px', borderRadius: '10px', background: '#1e2d3d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} color="#7a9ab5"/></div>}
              <div style={{ fontWeight: '800', fontSize: '.85rem', color: '#e8f4fd' }}>{preview.away || 'Por definir'}</div>
            </div>
          </div>

          {/* Hora y cancha — GRANDE, para que no haya duda de cuál partido es */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, background: 'rgba(0,221,208,.08)', border: '1px solid rgba(0,221,208,.25)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#00ddd0', fontSize: '.65rem', fontWeight: '700', marginBottom: '3px' }}><Clock size={11}/> HORA</div>
              <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#fff' }}>{preview.hora ? fmtHoraDate(preview.hora) : '—'}</div>
              {preview.hora && <div style={{ fontSize: '.65rem', color: '#7a9ab5', marginTop: '2px' }}>{new Date(preview.hora).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })}</div>}
            </div>
            <div style={{ flex: 1, background: 'rgba(249,168,37,.08)', border: '1px solid rgba(249,168,37,.25)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#f9a825', fontSize: '.65rem', fontWeight: '700', marginBottom: '3px' }}><MapPin size={11}/> CANCHA</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', lineHeight: 1.2 }}>{preview.cancha || 'Por confirmar'}</div>
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: '.78rem', color: '#ff6b6b', marginBottom: '10px' }}>{error}</div>}

        <button onClick={() => handleEntrar(preview.id)} disabled={!!entrando}
          style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a73e8,#00ddd0)', color: '#07070e', fontSize: '.9rem', fontWeight: '800', opacity: entrando ? .6 : 1 }}>
          {entrando ? 'Entrando...' : 'Entrar a planillar'}
        </button>
      </div>
    </div>
  )
}
