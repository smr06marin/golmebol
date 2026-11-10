import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FONDO, PANEL, BORDE, TEXTO, TEXTO_TENUE, VERDE, ROJO, ORO, btnPrimario, btnSecundario } from './estilosRapida'

// Pantalla para subir SOLO el informe de un partido que ya está cerrado (sin tocar
// la planilla, el resultado ni las estadísticas). Se usa desde el link del árbitro:
// "Subir informe" aparece junto a cada partido jugado.
//
// Escribe en match_informes igual que la planilla (tipo + descripcion + creado_por).
// Las políticas de la tabla (gm_inf_*) dejan escribir a quien entró a planillar
// ese partido por el link, así que acá no hace falta nada extra.

const norm = t => (t || '').trim().toLowerCase()
const unir = (a, b) => `${(a || '').trim()} ${(b || '').trim()}`.trim()
// Mismo armado de texto de dictado que el cierre de la planilla: se rehace desde cero
// en cada evento, así Android no repite frases.
function textoDeSesion(results) {
  const finales = []
  let interino = ''
  for (let i = 0; i < results.length; i++) {
    const t = (results[i][0]?.transcript || '').trim()
    if (!t) continue
    if (results[i].isFinal) {
      const ult = finales[finales.length - 1]
      if (ult && norm(t).startsWith(norm(ult))) finales[finales.length - 1] = t
      else if (ult && norm(ult).startsWith(norm(t))) { /* repetido y más corto */ }
      else finales.push(t)
    } else interino = t
  }
  const fin = finales.join(' ')
  if (!interino) return fin
  return fin && norm(interino).startsWith(norm(fin)) ? interino : unir(fin, interino)
}

const MIN_INFORME = 10
const MOTIVOS = [
  { id: 'otro',            t: 'Otro / aclaración', d: 'Algo que pasó y quieres que quede escrito' },
  { id: 'roja',            t: 'Tarjeta roja',      d: 'Qué pasó con la expulsión' },
  { id: 'terminado_antes', t: 'Terminado antes',   d: 'Por qué no se jugó el tiempo completo' },
]
const NOMBRE_MOTIVO = Object.fromEntries(MOTIVOS.map(m => [m.id, m.t]))

export default function InformeSolo({ partido, onVolver }) {
  const [tipo, setTipo] = useState('otro')
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [previos, setPrevios] = useState(null) // informes que ya tiene el partido

  // ── Dictado por voz ──
  const [escuchando, setEscuchando] = useState(false)
  const [errorVoz, setErrorVoz] = useState('')
  const recRef = useRef(null)
  const manualRef = useRef(true)
  const baseRef = useRef('')
  const sesionRef = useRef('')
  const huboTextoRef = useRef(false)
  const sinTextoRef = useRef(0)
  const timerRef = useRef(null)
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

  useEffect(() => () => {
    manualRef.current = true
    clearTimeout(timerRef.current)
    const r = recRef.current
    if (r) { r.onend = null; r.onerror = null; r.onresult = null; try { r.abort() } catch { /* ya parado */ } }
  }, [])

  useEffect(() => { cargarPrevios() }, [partido.id])
  async function cargarPrevios() {
    const { data } = await supabase.from('match_informes')
      .select('id, tipo, descripcion, creado_por, created_at')
      .eq('match_id', partido.id).order('created_at', { ascending: false })
    setPrevios(data || [])
  }

  function detener(msg = '') {
    manualRef.current = true
    clearTimeout(timerRef.current)
    try { recRef.current?.stop() } catch { /* ya parado */ }
    setEscuchando(false)
    if (msg) setErrorVoz(msg)
  }
  function toggleVoz() {
    if (escuchando) { detener(); return }
    if (!SR) return
    setErrorVoz('')
    manualRef.current = false
    sinTextoRef.current = 0
    baseRef.current = texto.trim()
    sesionRef.current = ''
    const rec = new SR()
    rec.lang = (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('es')) ? navigator.language : 'es-CO'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = e => {
      huboTextoRef.current = true
      sinTextoRef.current = 0
      sesionRef.current = textoDeSesion(e.results)
      setTexto(unir(baseRef.current, sesionRef.current))
    }
    rec.onerror = e => {
      const c = e.error
      if (c === 'not-allowed' || c === 'service-not-allowed') detener('El navegador no tiene permiso para el micrófono. Tócalo en el candado 🔒 de la barra de direcciones, permítelo y vuelve a tocar Dictar.')
      else if (c === 'audio-capture') detener('No se encontró un micrófono en este celular.')
      else if (c === 'language-not-supported') detener('Este navegador no entiende el dictado en español. Escribe el informe con el teclado.')
      else if (c === 'network') detener('El dictado necesita internet. Revisa la señal o escribe el informe.')
    }
    rec.onend = () => {
      baseRef.current = unir(baseRef.current, sesionRef.current)
      sesionRef.current = ''
      if (!huboTextoRef.current) sinTextoRef.current += 1
      huboTextoRef.current = false
      if (manualRef.current) { setEscuchando(false); return }
      if (sinTextoRef.current >= 4) { detener('No se está escuchando nada. Acerca el celular a la boca o escribe el informe.'); return }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (manualRef.current) return
        try { rec.start() } catch { setEscuchando(false); manualRef.current = true }
      }, 250)
    }
    recRef.current = rec
    huboTextoRef.current = false
    try { rec.start(); setEscuchando(true) } catch { manualRef.current = true; setErrorVoz('No se pudo activar el micrófono. Intenta de nuevo.') }
  }
  function onEditar(v) {
    setTexto(v)
    if (escuchando) { baseRef.current = v.trim(); sesionRef.current = ''; try { recRef.current?.abort() } catch { /* nada */ } }
  }

  async function guardar() {
    setError('')
    if (texto.trim().length < MIN_INFORME) { setError(`Escribe o dicta el informe (mínimo ${MIN_INFORME} letras).`); return }
    detener()
    setGuardando(true)
    let creadoPor = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      creadoPor = user?.email || null
      if (user?.id) {
        const { data: p } = await supabase.from('players').select('name').eq('user_id', user.id).maybeSingle()
        if (p?.name) creadoPor = p.name
      }
    } catch { /* sin nombre */ }
    const { error: err } = await supabase.from('match_informes').insert({
      match_id: partido.id, tournament_id: partido.tournament_id,
      tipo, descripcion: texto.trim(), creado_por: creadoPor || 'Árbitro (por link)',
    })
    setGuardando(false)
    if (err) { console.error('[Golmebol] informe solo', err); setError('No se pudo guardar el informe. Revisa la señal e intenta de nuevo.'); return }
    setGuardadoOk(true)
    setTexto('')
    baseRef.current = ''; sesionRef.current = ''
    cargarPrevios()
  }

  const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''

  return (
    <div style={{ minHeight: '100vh', background: FONDO, color: TEXTO, fontFamily: 'system-ui,sans-serif', padding: '16px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <button onClick={onVolver} style={{ ...btnSecundario, padding: '9px 14px', marginBottom: '14px', fontSize: '.8rem' }}>← Volver</button>

        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '.65rem', letterSpacing: '.3em', color: TEXTO_TENUE, textTransform: 'uppercase' }}>GOLMEBOL · INFORME</div>
          <div style={{ fontSize: '1.05rem', fontWeight: '800', marginTop: '8px' }}>{partido.home?.name || 'Local'} vs {partido.away?.name || 'Visitante'}</div>
          <div style={{ fontSize: '.75rem', color: TEXTO_TENUE, marginTop: '3px' }}>El resultado y la planilla no se tocan: solo se agrega el informe.</div>
        </div>

        {guardadoOk && (
          <div style={{ background: 'rgba(52,168,83,.12)', border: '1px solid rgba(52,168,83,.4)', color: '#7ee0a0', borderRadius: '10px', padding: '10px 12px', fontSize: '.82rem', fontWeight: '700', marginBottom: '12px', textAlign: 'center' }}>
            ✓ Informe guardado. Ya puedes salir, o escribir otro.
          </div>
        )}

        <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '.78rem', fontWeight: '800', color: ORO, marginBottom: '8px' }}>1 · ¿De qué es el informe?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {MOTIVOS.map(m => (
              <button key={m.id} onClick={() => setTipo(m.id)}
                style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `2px solid ${tipo === m.id ? '#1a73e8' : BORDE}`, background: tipo === m.id ? 'rgba(26,115,232,.15)' : 'transparent', color: TEXTO }}>
                <div style={{ fontWeight: '800', fontSize: '.85rem' }}>{m.t}</div>
                <div style={{ fontSize: '.7rem', color: TEXTO_TENUE, marginTop: '1px' }}>{m.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '.78rem', fontWeight: '800', color: ORO, marginBottom: '8px' }}>2 · Escribe o dicta lo que pasó</div>
          {SR && (
            <button onClick={toggleVoz}
              style={{ ...btnSecundario, width: '100%', marginBottom: '8px', color: escuchando ? '#fff' : TEXTO, background: escuchando ? ROJO : 'transparent', borderColor: escuchando ? ROJO : BORDE }}>
              {escuchando ? '⏹ Terminar dictado' : '🎙️ Dictar informe (hablar)'}
            </button>
          )}
          {errorVoz && <div style={{ fontSize: '.72rem', color: '#ff8a80', marginBottom: '8px' }}>{errorVoz}</div>}
          <textarea value={texto} onChange={e => onEditar(e.target.value)} rows={7} placeholder="Escribe aquí el informe del partido…"
            style={{ width: '100%', boxSizing: 'border-box', background: '#0b1220', color: TEXTO, border: `1px solid ${BORDE}`, borderRadius: '10px', padding: '10px', fontSize: '.9rem', fontFamily: 'inherit', resize: 'vertical' }}/>
        </div>

        {error && <div style={{ fontSize: '.78rem', color: '#ff6b6b', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}

        <button onClick={guardar} disabled={guardando}
          style={{ ...btnPrimario, width: '100%', background: VERDE, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando…' : '3 · Guardar informe'}
        </button>

        {previos && previos.length > 0 && (
          <div style={{ marginTop: '18px', paddingBottom: '24px' }}>
            <div style={{ fontSize: '.72rem', fontWeight: '800', color: TEXTO_TENUE, marginBottom: '6px' }}>Informes que ya tiene este partido</div>
            {previos.map(p => (
              <div key={p.id} style={{ background: PANEL, border: `1px solid ${BORDE}`, borderRadius: '10px', padding: '9px 11px', marginBottom: '6px' }}>
                <div style={{ fontSize: '.68rem', color: TEXTO_TENUE, marginBottom: '3px' }}>{NOMBRE_MOTIVO[p.tipo] || 'Informe'} · {fechaHora(p.created_at)}</div>
                <div style={{ fontSize: '.8rem', whiteSpace: 'pre-wrap' }}>{p.descripcion}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
