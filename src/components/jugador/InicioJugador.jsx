import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Trophy, ChevronRight, LayoutGrid, MapPin, CalendarDays, Target, Sparkles, Medal, Camera, Crown, Bell } from 'lucide-react'
import PlayerCard from '../card/PlayerCard'
import MisPuestos from '../card/MisPuestos'
import MiCarrera from './MiCarrera'
import MejoresSemana from './MejoresSemana'
import SubidaFotoJugador, { EjemploFotoPerfil, EjemploFotoTarjeta } from '../SubidaFotoJugador'
import { CARD_DESIGNS } from '../card/designs/cardDesigns'
import { arteDe, NOMBRE_NIVEL } from '../card/designs/cardArte'
import { STAT_CONFIG, armarLista, rankingGlobal, obtenerAgregado, leerAgregadoGuardado } from '../../lib/rankingsJugadores'
import { fmtHoraDate } from '../../lib/horaHelpers'
import { J, FD, FT, CSS_JUEGO, abrirSeccion } from './juegoEstilo'
import { Panel, Desplegable, BotonJuego, Escudo, IconoHex, Carrusel } from './juegoUI'

// Inicio del jugador con estilo de videojuego, LIMPIO:
//  · Arriba, siempre a la vista: su tarjeta (pequeña, flotando), su nivel y cuánto le falta para la siguiente.
//  · Debajo, todo lo demás en secciones DESPLEGABLES: cerradas se ve solo el título y un resumen corto;
//    el jugador toca la que quiera ver y se abre; al salir y volver, todo aparece cerrado otra vez.
//    Novedades · Próximos partidos (carrusel si tiene varios) · Lo mejor de la semana (Top 5) · Mi carrera · Últimos partidos · Mis torneos · Reto del día · Mis puestos · Mis fotos.
//  · Avisos importantes (de Golmebol o del organizador) y, si es DUEÑO de un equipo, el acceso a su equipo:
//    siempre a la vista debajo de la tarjeta, porque son cosas que tiene que atender.
//  · Mis fotos: el botón de cámara sobre la tarjeta abre esa sección. Si le falta una foto (o el admin pidió
//    cambiarla) la sección sube justo debajo de la tarjeta, con aviso; si todo está bien, queda al final.
// Los textos van con la letra normal del celular (fácil de leer); la letra de marcador es solo para números grandes.

const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mayus = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)
const nombreNivel = arte => mayus((NOMBRE_NIVEL[arte.n] || '').toLowerCase()) + (arte.p ? ` ${ROMANO[arte.p] || arte.p}` : '')
const nombreBonito = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase())

function cuantoFalta(fecha) {
  const ahora = new Date()
  const ms = fecha - ahora
  const diaDe = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dias = Math.round((diaDe(fecha) - diaDe(ahora)) / 86400000)
  if (ms <= 0) return 'Ya empezó'
  if (dias === 0) { const h = Math.floor(ms / 3600000); return h >= 1 ? `Hoy, en ${h} h` : `Hoy, en ${Math.max(1, Math.floor(ms / 60000))} min` }
  if (dias === 1) return 'Mañana'
  return `Faltan ${dias} días`
}

// Reto del día: cada día toca una estadística distinta y dice cuánto falta para pasar al de arriba
function RetoDeHoy({ playerId, userId, esPortero, pj, onAbrir }) {
  const [agregado, setAgregado] = useState(() => leerAgregadoGuardado(userId))
  useEffect(() => {
    if (!pj) return
    let vivo = true
    obtenerAgregado(userId).then(a => { if (vivo) setAgregado(a) }).catch(() => {})
    return () => { vivo = false }
  }, [pj, userId])
  if (!pj || !agregado) return null

  const id = String(playerId)
  const lista = armarLista(agregado)
  const opciones = esPortero ? ['pj', 'pg', 'efic'] : ['gc', 'pj', 'pg', 'efic']
  const d = new Date()
  const diaDelAnio = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
  // Se empieza por la estadística que toca hoy; si en esa no hay reto posible, se prueba la siguiente
  for (let n = 0; n < opciones.length; n++) {
    const k = opciones[(diaDelAnio + n) % opciones.length]
    const cfg = STAT_CONFIG[k]
    const r = rankingGlobal(lista, k, esPortero)
    const i = r.findIndex(j => j.id === id)
    if (i < 0) continue
    const yo = r[i]
    let texto
    if (yo.puesto === 1) {
      texto = `Vas de líder en ${cfg.corto.toLowerCase()}. Defiende el #1.`
    } else {
      const arriba = [...r].reverse().find(j => j.puesto < yo.puesto)
      const falta = (arriba?.[cfg.campo] ?? 0) - (yo[cfg.campo] ?? 0)
      if (!arriba || falta <= 0) continue
      const cuanto = k === 'efic' ? `${falta} ${falta === 1 ? 'punto' : 'puntos'} de eficacia` : `${falta} ${cfg.unidad}${falta === 1 ? '' : (cfg.unidad.endsWith('l') ? 'es' : 's')}`
      texto = `Te ${falta === 1 ? 'falta' : 'faltan'} ${cuanto} para pasar a ${String(arriba.nombre).split(' ')[0]} y subir al #${arriba.puesto}.`
    }
    return (
      <Desplegable id="reto" icono={<Target size={22} color={J.gold} strokeWidth={2.5}/>} color={J.gold} titulo="Reto del día" resumen={`${cfg.corto} · Hoy eres #${yo.puesto} de ${r.length}`} retraso={.3}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.4, color: J.text }}>{texto}</div>
        <div style={{ fontSize: '.95rem', color: J.text2, marginTop: 6 }}>Mañana toca otro reto.</div>
        <div style={{ marginTop: 12 }}>
          <BotonJuego variante="contorno" onClick={() => onAbrir(k)}>Ver el ranking de {cfg.corto.toLowerCase()} <ChevronRight size={20} color={J.gold} strokeWidth={3}/></BotonJuego>
        </div>
      </Desplegable>
    )
  }
  return null
}

// Mis fotos: perfil y tarjeta, cada una con su botón para subir o cambiar
function SeccionFotos({ player, onFotoSubida, pendiente, retraso }) {
  const faltaTarjeta = !player.photo_url || player.foto_cambiar_tarjeta
  const faltaPerfil = !player.photo_face_url || player.foto_cambiar_perfil
  const cambiar = player.foto_cambiar_tarjeta || player.foto_cambiar_perfil
  const resumen = cambiar ? <b style={{ color: J.red }}>Tienes que subir una foto de nuevo</b>
    : faltaTarjeta ? <b style={{ color: J.gold }}>Te falta la foto de tu tarjeta</b>
    : faltaPerfil ? <b style={{ color: J.gold }}>Te falta tu foto de perfil</b>
    : 'Tus fotos están listas ✓'
  const color = cambiar ? J.red : pendiente ? J.gold : J.green
  return (
    <Desplegable id="fotos" icono={<Camera size={22} color={color} strokeWidth={2.5}/>} color={color} titulo="Mis fotos" resumen={resumen} retraso={retraso}
      derecha={pendiente ? <span style={{ width: 24, height: 24, borderRadius: '50%', background: color, color: '#1a0f00', fontWeight: 900, fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>!</span> : null}>
      <div style={{ display: 'grid', gap: 10 }}>
        {(player.foto_cambiar_cedula_frontal || player.foto_cambiar_cedula_trasera) && (
          <div style={{ background: 'rgba(255,90,82,.12)', border: `1px solid ${J.red}66`, borderRadius: 12, padding: '10px 12px', fontSize: '.95rem', color: '#ff9a92', fontWeight: 700, lineHeight: 1.4 }}>
            Tu foto de cédula no sirvió. Acércate con el administrador para tomarte una nueva.
          </div>
        )}
        <SubidaFotoJugador
          playerId={player.id} campo="photo_url" url={player.photo_url || null}
          flagged={!!player.foto_cambiar_tarjeta} bloqueada={false}
          titulo="Foto de tu tarjeta 🃏" recomendacion="La que sale en tu tarjeta de jugador. Con el uniforme puesto, de las rodillas para arriba."
          ejemplo={<EjemploFotoTarjeta/>}
          onSubido={url => onFotoSubida?.('photo_url', url)}
        />
        <SubidaFotoJugador
          playerId={player.id} campo="photo_face_url" url={player.photo_face_url || null}
          flagged={!!player.foto_cambiar_perfil} bloqueada={false}
          titulo="Foto de perfil" recomendacion="Del pecho para arriba, de frente y con buena luz."
          ejemplo={<EjemploFotoPerfil/>}
          onSubido={url => onFotoSubida?.('photo_face_url', url)}
        />
      </div>
    </Desplegable>
  )
}

// Equipos de los que es dueño: un recuadro por equipo con el escudo en grande y el botón para administrarlo.
// Con varios equipos se deslizan de lado (carrusel).
function MisEquiposDueno({ equipos, onAbrir }) {
  const varios = equipos.length > 1
  return (
    <div className="gj-entra" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem', fontWeight: 800, color: J.gold, margin: '2px 2px 8px' }}>
        <Crown size={18} color={J.gold} strokeWidth={2.6}/> {varios ? `Mis equipos (${equipos.length})` : 'Mi equipo'}
        {varios && <span style={{ marginLeft: 'auto', fontSize: '.88rem', fontWeight: 600, color: J.muted }}>Desliza 👉</span>}
      </div>
      <Carrusel color={J.gold} nombres={equipos.map(e => e.name)}>
        {equipos.map(eq => (
          <Panel key={eq.id || eq.name} style={{ marginBottom: 0 }} borde={`linear-gradient(150deg, ${J.goldLuz}, ${J.gold}33 40%, rgba(255,255,255,.07) 75%, ${J.gold}88)`}
            fondo={`radial-gradient(70% 55% at 50% 30%, rgba(245,182,35,.22), transparent 70%), repeating-linear-gradient(135deg, rgba(255,255,255,.022) 0 2px, transparent 2px 14px), ${J.panel}`}>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.82rem', fontWeight: 900, letterSpacing: '.08em', color: '#2a1a00', background: `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})`, padding: '3px 12px', borderRadius: 999 }}>
                <Crown size={14} color="#2a1a00" strokeWidth={2.8}/> DUEÑO
              </span>
              <div style={{ position: 'relative', marginTop: 16 }}>
                <span aria-hidden="true" style={{ position: 'absolute', inset: -18, borderRadius: '50%', background: `radial-gradient(closest-side, ${J.gold}55, transparent)` }}/>
                <span className="gj-anim" style={{ position: 'relative', display: 'block', animation: 'gjFlota 5s ease-in-out infinite' }}>
                  <Escudo url={eq.logo_url} nombre={eq.name} size={124}/>
                </span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, lineHeight: 1.15, marginTop: 16, wordBreak: 'break-word' }}>{eq.name}</div>
              {eq.id && (
                <div style={{ width: '100%', marginTop: 14 }}>
                  <BotonJuego variante="oro" onClick={() => onAbrir?.(eq.id)}>Administrar mi equipo <ChevronRight size={20} strokeWidth={3}/></BotonJuego>
                </div>
              )}
              <div style={{ fontSize: '.9rem', color: J.text2, marginTop: 10, lineHeight: 1.35 }}>Inscribe a tus jugadores y mira los partidos de tu equipo.</div>
            </div>
          </Panel>
        ))}
      </Carrusel>
    </div>
  )
}

// Un partido programado, en pantalla de "VS": escudos frente a frente, cuánto falta, día, hora y cancha
// Fase del partido (si no es de la fase de grupos)
const NOMBRE_FASE = { octavos: 'Octavos de final', cuartos: 'Cuartos de final', semifinal: 'Semifinal', final: 'Final', tercer_puesto: 'Tercer puesto' }
// Partido que se pasó de fecha sin jugarse (el organizador todavía no le cambia la fecha)
const esPendiente = p => new Date(p.played_at).getTime() < Date.now() - 3 * 60 * 60 * 1000

function PartidoVS({ p, numero, total }) {
  const f = new Date(p.played_at)
  const mismoDia = f.toDateString() === new Date().toDateString()
  const pendiente = esPendiente(p)
  const fase = p.fase && p.fase !== 'grupo' ? NOMBRE_FASE[p.fase] : null
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', padding: '12px 12px 14px', borderRadius: 14, border: `1px solid ${pendiente ? J.gold + '66' : numero === 1 ? J.green + '66' : J.linea}`,
      background: `radial-gradient(80% 70% at 0% 40%, rgba(111,207,61,.10), transparent 60%), radial-gradient(80% 70% at 100% 40%, rgba(255,90,82,.08), transparent 60%), rgba(0,0,0,.28)` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '.85rem', fontWeight: 700, color: J.muted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {total > 1 ? `Partido ${numero} de ${total}` : 'Tu próximo partido'}
        </span>
        {pendiente ? (
          <span style={{ flexShrink: 0, fontSize: '.85rem', fontWeight: 800, color: J.gold, background: 'rgba(245,182,35,.12)', border: '1px solid rgba(245,182,35,.4)', borderRadius: 999, padding: '2px 9px' }}>⏳ Por confirmar</span>
        ) : (
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.85rem', fontWeight: 800, color: J.green, background: 'rgba(111,207,61,.12)', border: '1px solid rgba(111,207,61,.35)', borderRadius: 999, padding: '2px 9px' }}>
            {numero === 1 && <span className="gj-anim" style={{ width: 7, height: 7, borderRadius: '50%', background: J.green, animation: 'gjPulso 1.4s ease-in-out infinite' }}/>}
            {cuantoFalta(f)}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 6, marginTop: 12 }}>
        {[p.home, null, p.away].map((eq, i) => i === 1 ? (
          <span key="vs" style={{ fontFamily: FD, fontSize: '2.4rem', lineHeight: 1, letterSpacing: '.02em', background: `linear-gradient(180deg, #fff, ${J.gold})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', padding: '0 2px' }}>VS</span>
        ) : (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <Escudo url={eq?.logo_url} nombre={eq?.name} size={56}/>
            <span style={{ fontWeight: 800, fontSize: '.95rem', lineHeight: 1.2, textAlign: 'center', wordBreak: 'break-word' }}>{eq?.name || 'Por definir'}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        {fase && <div style={{ display: 'inline-block', fontSize: '.85rem', fontWeight: 900, letterSpacing: '.05em', textTransform: 'uppercase', color: '#2a1a00', background: `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})`, padding: '2px 12px', borderRadius: 999, marginBottom: 6 }}>🏆 {fase}</div>}
        {pendiente ? (
          <>
            <div style={{ fontSize: '1.08rem', fontWeight: 800, color: J.gold }}>Pendiente por jugar</div>
            <div style={{ fontSize: '.92rem', color: J.text2, marginTop: 3, lineHeight: 1.35 }}>Estaba para el {DIAS[f.getDay()]} {f.getDate()} de {MESES[f.getMonth()]}. Apenas el organizador ponga la nueva fecha, aparece aquí.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '1.02rem', fontWeight: 800 }}>{mismoDia ? 'Hoy' : `${mayus(DIAS[f.getDay()])} ${f.getDate()} de ${MESES[f.getMonth()]}`}</div>
            <div style={{ fontFamily: FD, fontSize: '1.9rem', lineHeight: 1, color: J.green, marginTop: 3, letterSpacing: '.03em' }}>{fmtHoraDate(f)}</div>
          </>
        )}
        {p.location && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.95rem', fontWeight: 600, color: J.text2, marginTop: 3 }}>
            <MapPin size={15} color={J.green}/> {p.location}
          </div>
        )}
        {p.tournaments?.name && <div style={{ fontSize: '.88rem', fontWeight: 600, color: J.muted, marginTop: 4, lineHeight: 1.3 }}>🏆 {p.tournaments.name}</div>}
      </div>
    </div>
  )
}

export default function InicioJugador({
  player, userId, nombre, stats, cardStats, cardType, esPortero, esDefensa, torneosData, equiposData,
  novedades = [], proximo, proximos, historial = [], logros = [], cargandoHistorial = false, siguiente, desbloqueadas = 0, totalTarjetas = 0,
  onVerTarjeta, onVerColeccion, onVerHistorial, onVerHistorialCompleto, onAbrirRanking, onFotoSubida,
  equiposDueno = [], onAbrirEquipo, avisos = [],
}) {
  const design = CARD_DESIGNS.find(d => d.id === cardType) || CARD_DESIGNS[0]
  const arte = arteDe(design)
  const luz = arte.clara ? '#e9c75e' : arte.a      // color de la tarjeta: tiñe los rayos y el brillo
  const pj = stats?.pj || 0
  // Próximos partidos programados (el primero es el más cercano); si solo llega uno, se usa ese
  const listaProx = (proximos?.length ? proximos : proximo ? [proximo] : []).filter(p => p?.played_at)
  const fechaProx = listaProx[0] ? new Date(listaProx[0].played_at) : null
  const prog = siguiente?.prog
  const metaSeg = Math.max(1, Math.min(10, prog?.meta || 3))
  const listo = prog && prog.actual >= prog.meta
  const sinFotoTarjeta = !player.photo_url
  const fotosPendientes = sinFotoTarjeta || !player.photo_face_url || !!player.foto_cambiar_tarjeta || !!player.foto_cambiar_perfil

  return (
    <div style={{ fontFamily: FT }}>
      <style>{CSS_JUEGO}</style>

      {/* ── Siempre a la vista: MI TARJETA ── */}
      <Panel borde={`linear-gradient(160deg, ${luz}cc, ${luz}22 40%, rgba(255,255,255,.06) 75%, ${luz}55)`}
        fondo={`radial-gradient(70% 90% at 22% 40%, ${luz}33, transparent 65%), repeating-linear-gradient(135deg, rgba(255,255,255,.022) 0 2px, transparent 2px 14px), ${J.panel}`}
        style={{ marginBottom: 14 }}>
        <div style={{ padding: '14px 14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* La tarjeta, flotando, con rayos de luz detrás y el botón de cámara para cambiar la foto */}
            <div style={{ position: 'relative', width: '40%', maxWidth: 170, flexShrink: 0 }}>
            <button type="button" onClick={onVerTarjeta} aria-label="Ver mi tarjeta y mis logros"
              style={{ position: 'relative', display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
              <span aria-hidden="true" className="gj-anim" style={{ position: 'absolute', left: '50%', top: '50%', width: '210%', aspectRatio: '1', transform: 'translate(-50%,-50%)',
                background: `repeating-conic-gradient(from 0deg, ${luz}30 0deg 9deg, transparent 9deg 24deg)`,
                WebkitMaskImage: 'radial-gradient(circle, #000 15%, transparent 58%)', maskImage: 'radial-gradient(circle, #000 15%, transparent 58%)',
                animation: 'gjRayos 40s linear infinite', pointerEvents: 'none' }}/>
              <span className="gj-anim" style={{ position: 'relative', display: 'block', animation: 'gjFlota 4.5s ease-in-out infinite', filter: `drop-shadow(0 10px 16px rgba(0,0,0,.7)) drop-shadow(0 0 14px ${luz}55)` }}>
                <PlayerCard mini playerName={nombre} stats={cardStats} cardType={cardType} esPortero={esPortero} esDefensa={esDefensa}
                  photoUrlExterno={player.photo_url || null} torneosData={torneosData} equiposData={equiposData}/>
              </span>
            </button>
            <button type="button" onClick={() => abrirSeccion('fotos')} aria-label={sinFotoTarjeta ? 'Ponle tu foto a la tarjeta' : 'Cambiar mis fotos'} className="gj-boton"
              style={{ position: 'absolute', right: -6, bottom: sinFotoTarjeta ? 30 : 4, width: 42, height: 42, borderRadius: '50%', border: `3px solid #0c0e0d`, cursor: 'pointer', padding: 0,
                background: `linear-gradient(180deg, ${J.greenLuz}, ${J.green})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: sinFotoTarjeta ? 'gjAro 1.6s ease-out infinite' : 'none' }}>
              <Camera size={20} color={J.greenDk} strokeWidth={2.6}/>
            </button>
            {sinFotoTarjeta && (
              <button type="button" onClick={() => abrirSeccion('fotos')} className="gj-boton"
                style={{ display: 'block', width: '100%', marginTop: 8, padding: '5px 4px', borderRadius: 999, border: `1px solid ${J.green}66`, background: 'rgba(111,207,61,.14)', color: J.green, fontFamily: FT, fontWeight: 800, fontSize: '.82rem', cursor: 'pointer' }}>
                📷 Ponle tu foto
              </button>
            )}
            </div>

            {/* Nivel, nombre de la tarjeta y avance hacia la siguiente */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: J.text2 }}>Hola, {mayus(String(nombre || '').toLowerCase())} 👋</div>
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: '.85rem', fontWeight: 800, letterSpacing: '.04em', color: J.greenDk, background: `linear-gradient(180deg, ${J.greenLuz}, ${J.green})`, padding: '3px 12px', borderRadius: 999 }}>
                {nombreNivel(arte)}
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, lineHeight: 1.1, marginTop: 6, color: J.text, textShadow: `0 0 20px ${luz}66`, wordBreak: 'break-word' }}>{nombreBonito(design.nombre)}</div>

              {siguiente && prog ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: '.92rem', color: J.text2, lineHeight: 1.3 }}>
                    Siguiente: <b style={{ color: J.text }}>{nombreBonito(siguiente.design.nombre)}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 7, padding: '0 3px' }} aria-hidden="true">
                    {Array.from({ length: metaSeg }, (_, i) => {
                      const lleno = i < Math.min(prog.actual, prog.meta)
                      return (
                        <span key={i} className="gj-anim" style={{ flex: 1, height: 11, transform: 'skewX(-20deg)', borderRadius: 2,
                          background: lleno ? `linear-gradient(180deg, ${J.goldLuz}, ${J.gold})` : 'rgba(255,255,255,.1)',
                          boxShadow: lleno ? `0 0 10px ${J.gold}aa` : 'none', animation: lleno ? `gjEntra .4s ease-out ${.3 + i * .15}s both` : 'none' }}/>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: '.95rem', fontWeight: 800, color: listo ? J.green : J.gold, marginTop: 6 }}>
                    {listo ? '✅ ¡Se está desbloqueando!' : `${prog.actual} de ${prog.meta} logros`}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '.95rem', fontWeight: 800, color: J.gold, marginTop: 10 }}>🏆 ¡Tienes todas las tarjetas!</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 8, marginTop: 14 }}>
            <BotonJuego onClick={onVerTarjeta}>Ver mis logros <ChevronRight size={20} strokeWidth={3}/></BotonJuego>
            <BotonJuego variante="contorno" onClick={onVerColeccion} style={{ minHeight: 50 }}><LayoutGrid size={17} color={J.gold}/> Tarjetas {desbloqueadas}/{totalTarjetas}</BotonJuego>
          </div>
        </div>
      </Panel>

      {/* ── Avisos importantes: siempre a la vista ── */}
      {avisos.map(a => (
        <button key={a.id} type="button" onClick={a.onClick} className="gj-boton"
          style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FT, color: J.text }}>
          <Panel borde={`linear-gradient(120deg, ${J.gold}cc, ${J.gold}22 50%, rgba(255,255,255,.07))`} fondo={`linear-gradient(120deg, rgba(245,182,35,.12), transparent 60%), ${J.panel}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <IconoHex color={J.gold}><Bell size={22} color={J.gold} strokeWidth={2.5}/></IconoHex>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.25 }}>{a.titulo}</span>
                {a.texto && <span style={{ display: 'block', fontSize: '.95rem', color: J.text2, marginTop: 3, lineHeight: 1.35 }}>{a.texto}</span>}
              </span>
              <ChevronRight size={22} color={J.gold} style={{ flexShrink: 0 }}/>
            </div>
          </Panel>
        </button>
      ))}

      {/* ── Dueño de equipo: recuadro con el escudo grande; si tiene varios, carrusel ── */}
      {equiposDueno.length > 0 && <MisEquiposDueno equipos={equiposDueno} onAbrir={onAbrirEquipo}/>}

      {/* ── Todo lo demás: secciones desplegables ── */}

      {/* Si le falta una foto, la sección de fotos va primero (con aviso) */}
      {fotosPendientes && <SeccionFotos player={player} onFotoSubida={onFotoSubida} pendiente/>}

      {novedades.length > 0 && (
        <Desplegable id="novedades" icono={<Sparkles size={22} color={J.green} strokeWidth={2.5}/>} color={J.green} titulo="Novedades"
          resumen={`${novedades.length} ${novedades.length === 1 ? 'cosa nueva' : 'cosas nuevas'} desde tu última visita`}
          derecha={<span style={{ minWidth: 26, height: 26, borderRadius: 999, background: J.green, color: J.greenDk, fontWeight: 900, fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px' }}>{novedades.length}</span>}>
          <div style={{ display: 'grid', gap: 6 }}>
            {novedades.map((n, i) => {
              const Icono = n.tono === 'baja' ? TrendingDown : n.tono === 'oro' ? Trophy : TrendingUp
              const color = n.tono === 'baja' || n.tono === 'oro' ? J.gold : J.green
              const fila = (
                <>
                  <Icono size={20} color={color} style={{ flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '1.02rem', fontWeight: 600, lineHeight: 1.35 }}>{n.texto}</span>
                  {n.stat && <ChevronRight size={20} color={J.muted} style={{ flexShrink: 0 }}/>}
                </>
              )
              return n.stat
                ? <button key={i} type="button" onClick={() => onAbrirRanking(n.stat)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: J.text, fontFamily: FT }}>{fila}</button>
                : <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>{fila}</div>
            })}
          </div>
        </Desplegable>
      )}

      {proximo !== undefined && (
        <Desplegable id="proximo" icono={<CalendarDays size={22} color={J.green} strokeWidth={2.5}/>} color={J.green} retraso={.05}
          titulo={listaProx.length > 1 ? `Próximos partidos (${listaProx.length})` : 'Mi próximo partido'}
          resumen={fechaProx && esPendiente(listaProx[0]) ? (
            <b style={{ color: J.gold }}>⏳ Partido pendiente · fecha por confirmar</b>
          ) : fechaProx ? (
            <span>
              <span className="gj-anim" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: J.green, boxShadow: `0 0 8px ${J.green}`, animation: 'gjPulso 1.4s ease-in-out infinite', marginRight: 6, verticalAlign: 'middle' }}/>
              <b style={{ color: J.green }}>{cuantoFalta(fechaProx)}</b> · {fechaProx.toDateString() === new Date().toDateString() ? fmtHoraDate(fechaProx) : `${DIAS[fechaProx.getDay()]} ${fechaProx.getDate()}`}
            </span>
          ) : 'Todavía no tienes partido programado'}>
          {fechaProx ? (
            <>
              {listaProx.length > 1 && <div style={{ fontSize: '.92rem', fontWeight: 600, color: J.muted, margin: '0 2px 8px' }}>Desliza para ver los siguientes 👉</div>}
              <Carrusel color={J.green} nombres={listaProx.map(p => `${p.home?.name || ''} vs ${p.away?.name || ''}`)}>
                {listaProx.map((p, i) => <PartidoVS key={p.id || i} p={p} numero={i + 1} total={listaProx.length}/>)}
              </Carrusel>
            </>
          ) : (
            <div style={{ fontSize: '1.02rem', color: J.text2, lineHeight: 1.45 }}>Apenas lo programen aparece aquí con el día, la hora y la cancha.</div>
          )}
        </Desplegable>
      )}

      {/* Lo mejor de la semana: Top 5 de jugadores, arqueros, equipos y partidos */}
      <MejoresSemana playerId={player.id} misEquipos={[...new Set([...historial.map(h => h.team_id), ...equiposDueno.map(e => e.id)].filter(Boolean))]}/>

      {/* Mi carrera · Últimos partidos · Mis torneos */}
      <MiCarrera historial={historial} logros={logros} esPortero={esPortero} onVerTodos={onVerHistorialCompleto || onVerHistorial} cargando={cargandoHistorial}/>

      <RetoDeHoy playerId={player.id} userId={userId} esPortero={esPortero} pj={pj} onAbrir={onAbrirRanking}/>

      {pj > 0 && (
        <Desplegable id="puestos" icono={<Medal size={22} color={J.azul} strokeWidth={2.5}/>} color={J.azul} titulo="Mis rankings" resumen="Tu puesto frente a todos" retraso={.35}>
          <MisPuestos playerId={player.id} userId={userId} pj={pj} onAbrir={onAbrirRanking} enInicio/>
        </Desplegable>
      )}

      {/* Con las fotos al día, la sección queda al final */}
      {!fotosPendientes && <SeccionFotos player={player} onFotoSubida={onFotoSubida} retraso={.4}/>}
    </div>
  )
}
