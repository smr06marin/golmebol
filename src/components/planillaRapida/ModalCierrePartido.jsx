import { useState, useRef, useEffect } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, VERDE, ROJO, btnPrimario, btnSecundario, ESTILO_RESALTE, ANIM_RESALTE, ANIM_RESALTE_ROJO, AMARILLO } from './estilosRapida'

// Último paso antes de guardar el resultado. Es una LISTA DE PASOS: cada paso
// pendiente se ilumina (amarillo parpadeante; rojo el informe cuando hubo
// tarjeta roja) y se pone verde al completarse. No se puede guardar hasta que
// estén todos: arquero de cada equipo, informe (solo si hubo roja) y MVP.

// ── Dictado por voz (informe) ────────────────────────────────────────────
// Se arma el texto de UNA sesión de dictado desde cero en cada evento (nunca
// "sumando" lo que llega), así Android no puede repetir frases: Chrome en
// Android a veces manda cada resultado final con TODO lo dicho hasta ahora.
const norm = t => (t || '').trim().toLowerCase()
function unir(a, b) { return `${(a || '').trim()} ${(b || '').trim()}`.trim() }
function textoDeSesion(results) {
  const finales = []
  let interino = ''
  for (let i = 0; i < results.length; i++) {
    const t = (results[i][0]?.transcript || '').trim()
    if (!t) continue
    if (results[i].isFinal) {
      const ult = finales[finales.length - 1]
      if (ult && norm(t).startsWith(norm(ult))) finales[finales.length - 1] = t // repite acumulando: se queda la versión más completa
      else if (ult && norm(ult).startsWith(norm(t))) { /* repetido y más corto: se ignora */ }
      else finales.push(t)
    } else {
      interino = t
    }
  }
  const fin = finales.join(' ')
  if (!interino) return fin
  return fin && norm(interino).startsWith(norm(fin)) ? interino : unir(fin, interino)
}

const MIN_INFORME = 10

export default function ModalCierrePartido({
  nombreLocal, nombreVis, arqueroLocal, arqueroVis, hayRoja,
  jugadoresLocal, jugadoresVisitante, guardando, onFinalizar, onCerrar, onSeleccionarArquero,
}) {
  const [informeTexto, setInformeTexto] = useState('')
  const [mvpId, setMvpId] = useState(null)
  const [pickerArquero, setPickerArquero] = useState(null) // null | 'local' | 'visitante'

  // ── Informe por voz ────────────────────────────────────────────────────
  const [escuchando, setEscuchando] = useState(false)
  const [errorVoz, setErrorVoz] = useState('')
  const recRef = useRef(null)
  const manualRef = useRef(true)      // true = la persona lo detuvo (o aún no empezó): no se reinicia solo
  const baseRef = useRef('')          // texto ya confirmado antes de la sesión en curso
  const sesionRef = useRef('')        // lo que va dicho en la sesión en curso
  const huboTextoRef = useRef(false)  // la sesión en curso captó algo
  const sinTextoSeguidasRef = useRef(0)
  const reinicioTimerRef = useRef(null)
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const vozDisponible = !!SR

  useEffect(() => () => {
    manualRef.current = true
    clearTimeout(reinicioTimerRef.current)
    const r = recRef.current
    if (r) { r.onend = null; r.onerror = null; r.onresult = null; try { r.abort() } catch { /* ya estaba parado */ } }
  }, [])

  function detener(mensaje = '') {
    manualRef.current = true
    clearTimeout(reinicioTimerRef.current)
    try { recRef.current?.stop() } catch { /* ya estaba parado */ }
    setEscuchando(false)
    if (mensaje) setErrorVoz(mensaje)
  }

  function toggleVoz() {
    if (escuchando) { detener(); return }
    if (!SR) return
    setErrorVoz('')
    manualRef.current = false
    sinTextoSeguidasRef.current = 0
    baseRef.current = informeTexto.trim()
    sesionRef.current = ''
    const rec = new SR()
    const idioma = (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('es')) ? navigator.language : 'es-CO'
    rec.lang = idioma
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      huboTextoRef.current = true
      sinTextoSeguidasRef.current = 0
      sesionRef.current = textoDeSesion(e.results)
      setInformeTexto(unir(baseRef.current, sesionRef.current))
    }
    rec.onerror = (e) => {
      const c = e.error
      if (c === 'not-allowed' || c === 'service-not-allowed') detener('El navegador no tiene permiso para usar el micrófono. Tócalo en el candado 🔒 de la barra de direcciones, permite el micrófono y vuelve a tocar Dictar.')
      else if (c === 'audio-capture') detener('No se encontró un micrófono en este celular.')
      else if (c === 'language-not-supported') detener('Este navegador no entiende el dictado en español. Escribe el informe con el teclado.')
      else if (c === 'network') detener('El dictado necesita internet. Revisa la señal y vuelve a tocar Dictar (o escribe el informe).')
      // 'no-speech' y 'aborted': no son fallas, onend decide si se reinicia
    }
    rec.onend = () => {
      // El navegador corta solo tras un silencio: lo dicho en esta sesión queda confirmado.
      baseRef.current = unir(baseRef.current, sesionRef.current)
      sesionRef.current = ''
      if (!huboTextoRef.current) sinTextoSeguidasRef.current += 1
      huboTextoRef.current = false
      if (manualRef.current) { setEscuchando(false); return }
      if (sinTextoSeguidasRef.current >= 4) { detener('No se está escuchando nada. Acerca el celular a la boca y revisa que el micrófono funcione, o escribe el informe.'); return }
      clearTimeout(reinicioTimerRef.current)
      reinicioTimerRef.current = setTimeout(() => {
        if (manualRef.current) return
        try { rec.start() } catch { setEscuchando(false); manualRef.current = true }
      }, 250)
    }
    recRef.current = rec
    huboTextoRef.current = false
    try { rec.start(); setEscuchando(true) } catch { manualRef.current = true; setErrorVoz('No se pudo activar el micrófono. Intenta de nuevo.') }
  }

  // Si escriben/corrigen a mano mientras se dicta: lo escrito pasa a ser la base
  // y la sesión de voz se reinicia limpia (así no se pisa ni se duplica nada).
  function onEditar(v) {
    setInformeTexto(v)
    if (escuchando) {
      baseRef.current = v.trim()
      sesionRef.current = ''
      try { recRef.current?.abort() } catch { /* nada */ }
    }
  }
  function borrarInforme() {
    baseRef.current = ''; sesionRef.current = ''
    setInformeTexto('')
    if (escuchando) { try { recRef.current?.abort() } catch { /* nada */ } }
  }

  const numerados = [
    ...jugadoresLocal.filter(j => (j.numero || '').trim() && j.id).map(j => ({ ...j, equipo: nombreLocal })),
    ...jugadoresVisitante.filter(j => (j.numero || '').trim() && j.id).map(j => ({ ...j, equipo: nombreVis })),
  ]
  const candidatosArquero = team => (team === 'local' ? jugadoresLocal : jugadoresVisitante).filter(j => (j.numero || '').trim())

  const largoInforme = informeTexto.trim().length
  const informeOk = !hayRoja || largoInforme >= MIN_INFORME
  const arqOk = !!arqueroLocal && !!arqueroVis
  const mvpOk = !!mvpId
  const puedeFinalizar = arqOk && informeOk && mvpOk && !guardando

  // Primer paso incompleto: es el que se ilumina más y al que se baja solo.
  const pendiente = !arqOk ? 'arqueros' : !informeOk ? 'informe' : !mvpOk ? 'mvp' : null
  const faltan = []
  if (!arqueroLocal) faltan.push(`arquero de ${nombreLocal}`)
  if (!arqueroVis) faltan.push(`arquero de ${nombreVis}`)
  if (!informeOk) faltan.push('informe de la roja')
  if (!mvpOk) faltan.push('MVP')

  const refPaso = useRef({})
  useEffect(() => {
    const el = pendiente ? refPaso.current[pendiente] : null
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) } catch { /* nada */ } }
  }, [pendiente])

  const caja = (id, ok, rojo) => ({
    marginBottom: '14px', borderRadius: '12px', padding: '10px',
    border: `2px solid ${ok ? VERDE : (rojo ? ROJO : AMARILLO)}`,
    background: ok ? 'rgba(30,142,62,.08)' : (rojo ? 'rgba(217,48,37,.1)' : 'rgba(249,196,0,.08)'),
    animation: !ok && pendiente === id ? (rojo ? ANIM_RESALTE_ROJO : ANIM_RESALTE) : 'none',
  })
  const titulo = (n, txt, ok, rojo) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: '900', background: ok ? VERDE : (rojo ? ROJO : AMARILLO), color: ok || rojo ? '#fff' : '#1a1a1a' }}>{ok ? '✓' : n}</span>
      <span style={{ fontSize: '.8rem', fontWeight: '800', color: TEXTO }}>{txt}</span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <style>{ESTILO_RESALTE}</style>
      <div style={{ background: PANEL, borderRadius: '18px 18px 0 0', padding: '18px 16px 16px', width: '100%', maxWidth: '480px', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '1rem', fontWeight: '800', color: TEXTO, textAlign: 'center' }}>🏁 Finalizar partido</div>
        <div style={{ fontSize: '.72rem', fontWeight: '700', textAlign: 'center', margin: '4px 0 12px', color: puedeFinalizar ? '#7CFFB2' : '#ffe066' }}>
          {puedeFinalizar ? '✓ Todo listo: ya puedes guardar el resultado' : `Para guardar falta: ${faltan.join(' · ')}`}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: '4px' }}>
          {/* Paso 1 — Arqueros */}
          <div ref={el => { refPaso.current.arqueros = el }} style={caja('arqueros', arqOk, false)}>
            {titulo('1', 'Arquero de cada equipo', arqOk, false)}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ team: 'local', nombre: nombreLocal, arq: arqueroLocal }, { team: 'visitante', nombre: nombreVis, arq: arqueroVis }].map(e => (
                <button key={e.team} type="button" onClick={() => setPickerArquero(p => (p === e.team ? null : e.team))}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', background: e.arq ? 'rgba(30,142,62,.12)' : AMARILLO, border: `1px solid ${e.arq ? VERDE : AMARILLO}`, borderRadius: '10px', padding: '8px 10px', fontSize: '.72rem', color: e.arq ? TEXTO : '#1a1a1a' }}>
                  <div style={{ color: e.arq ? TEXTO_TENUE : '#3a3000', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</div>
                  <div style={{ fontWeight: '800', color: e.arq ? '#7CFFB2' : '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.arq ? `🧤 ${e.arq.nombre}` : '👆 Elegir arquero'}</div>
                </button>
              ))}
            </div>
            {pickerArquero && (
              <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', border: `1px solid ${BORDE}`, borderRadius: '10px', background: '#0d1117' }}>
                {candidatosArquero(pickerArquero).length === 0 ? (
                  <div style={{ padding: '10px', fontSize: '.72rem', color: TEXTO_TENUE }}>Este equipo aún no tiene jugadores con número. Vuelve al partido y asigna camisetas en “Jugadores”.</div>
                ) : candidatosArquero(pickerArquero).map((j, i) => (
                  <button key={j.id || j.nombre + i} type="button" onClick={() => { onSeleccionarArquero && onSeleccionarArquero(pickerArquero, j); setPickerArquero(null) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', borderBottom: `1px solid ${BORDE}`, cursor: 'pointer', color: TEXTO, fontSize: '.82rem', fontWeight: '600' }}>
                    #{j.numero} · {j.nombre || 'Sin nombre'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Paso 2 — Informe (solo si hubo tarjeta roja) */}
          {hayRoja && (
            <div ref={el => { refPaso.current.informe = el }} style={caja('informe', informeOk, true)}>
              {titulo('2', '🟥 Informe de la expulsión (obligatorio)', informeOk, true)}
              <div style={{ fontSize: '.7rem', color: TEXTO_TENUE, marginBottom: '8px', lineHeight: 1.3 }}>
                Escribe o dicta: <b style={{ color: TEXTO }}>quién fue expulsado</b> (número y equipo), <b style={{ color: TEXTO }}>en qué minuto</b> y <b style={{ color: TEXTO }}>por qué</b>.
              </div>
              {vozDisponible ? (
                <button type="button" onClick={toggleVoz}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', padding: '11px', border: 'none', borderRadius: '12px', cursor: 'pointer', color: '#fff', fontSize: '.88rem', fontWeight: '800', background: escuchando ? ROJO : '#1a73e8', animation: escuchando ? 'gmMicPulso 1.3s infinite' : 'none' }}>
                  {escuchando ? '⏹ Terminar dictado' : '🎙️ Dictar informe (hablar)'}
                </button>
              ) : (
                <div style={{ fontSize: '.7rem', color: '#ffe066', marginBottom: '8px', fontWeight: '700', lineHeight: 1.3 }}>
                  Este navegador no permite dictar. Escribe el informe con el teclado (en el teclado también puedes tocar el micrófono 🎤).
                </div>
              )}
              {escuchando && (
                <div style={{ fontSize: '.72rem', color: '#ff8a80', marginBottom: '6px', fontWeight: '800' }}>
                  🎙️ Escuchando… habla normal y con pausas; el texto se escribe solo. Toca “Terminar dictado” al acabar.
                </div>
              )}
              {errorVoz && <div style={{ fontSize: '.72rem', color: '#ffb4ab', background: 'rgba(217,48,37,.15)', borderRadius: '8px', padding: '7px 9px', marginBottom: '8px', fontWeight: '700', lineHeight: 1.3 }}>⚠️ {errorVoz}</div>}
              <textarea value={informeTexto} onChange={e => onEditar(e.target.value)} rows={4}
                placeholder="Ej.: Expulsado el #7 de Los Tigres, minuto 14, por agredir a un rival."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: `1px solid ${escuchando ? ROJO : BORDE}`, background: '#0d1117', color: TEXTO, fontSize: '.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px', gap: '8px' }}>
                <span style={{ fontSize: '.68rem', fontWeight: '800', color: informeOk ? '#7CFFB2' : '#ffe066' }}>
                  {informeOk ? '✓ Informe completo' : `Faltan ${MIN_INFORME - largoInforme} letras como mínimo`}
                </span>
                {largoInforme > 0 && (
                  <button type="button" onClick={borrarInforme} style={{ background: 'none', border: 'none', color: TEXTO_TENUE, fontSize: '.68rem', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}>Borrar todo</button>
                )}
              </div>
            </div>
          )}

          {/* Paso final — MVP */}
          <div ref={el => { refPaso.current.mvp = el }} style={caja('mvp', mvpOk, false)}>
            {titulo(hayRoja ? '3' : '2', '⭐ MVP del partido (obligatorio)', mvpOk, false)}
            {numerados.length === 0 ? (
              <div style={{ fontSize: '.72rem', color: TEXTO_TENUE }}>Aún no hay jugadores con número asignado.</div>
            ) : (
              <div style={{ maxHeight: '190px', overflowY: 'auto', border: `1px solid ${BORDE}`, borderRadius: '10px', background: '#0d1117' }}>
                {numerados.map(j => (
                  <button key={j.id} type="button" onClick={() => setMvpId(j.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '10px', background: mvpId === j.id ? 'rgba(249,168,37,.15)' : 'none', border: 'none', borderBottom: `1px solid ${BORDE}`, cursor: 'pointer', color: mvpId === j.id ? '#f9a825' : TEXTO, fontSize: '.8rem', fontWeight: mvpId === j.id ? '800' : '500' }}>
                    <span style={{ fontWeight: '900' }}>#{j.numero}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
                    <span style={{ fontSize: '.65rem', color: TEXTO_TENUE }}>{j.equipo}</span>
                    {mvpId === j.id && <span>⭐</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', paddingTop: '10px', flexShrink: 0 }}>
          <button onClick={onCerrar} disabled={guardando} style={{ ...btnSecundario, flex: 1 }}>‹ Seguir jugando</button>
          <button onClick={() => { if (escuchando) detener(); onFinalizar({ informeTexto: informeTexto.trim(), mvpId }) }} disabled={!puedeFinalizar}
            style={{ ...btnPrimario, flex: 2, opacity: puedeFinalizar ? 1 : .5 }}>
            {guardando ? 'Guardando...' : (puedeFinalizar ? '💾 Guardar resultado' : '🔒 Completa los pasos')}
          </button>
        </div>
      </div>
    </div>
  )
}
