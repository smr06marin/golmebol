import { useState } from 'react'
import { PANEL, BORDE, TEXTO, TEXTO_TENUE, VERDE, ROJO, btnPrimario, btnSecundario } from '../planillaRapida/estilosRapida'

// Último paso de la planilla de papel antes de guardar el resultado. Mismas
// reglas de siempre: arquero de cada equipo, informe si hubo tarjeta roja y
// MVP del partido. (El arquero se elige en la franja amarilla de arriba y el
// informe se escribe en el recuadro "INFORME ARBITRAL" de la hoja.)
export default function ModalCierrePapel({
  nombreLocal, nombreVis, arqueroLocal, arqueroVis, hayRoja, informe,
  jugadoresLocal, jugadoresVisitante, guardando, avisoPenales, onFinalizar, onCerrar,
}) {
  const [mvpId, setMvpId] = useState(null)

  const numerados = [
    ...jugadoresLocal.filter(j => (j.numero || '').trim() && j.id).map(j => ({ ...j, equipo: nombreLocal })),
    ...jugadoresVisitante.filter(j => (j.numero || '').trim() && j.id).map(j => ({ ...j, equipo: nombreVis })),
  ]

  const informeOk = !hayRoja || (informe || '').trim().length >= 10
  const puedeFinalizar = !!arqueroLocal && !!arqueroVis && informeOk && !!mvpId && !guardando && !avisoPenales

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: PANEL, borderRadius: '18px 18px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '88dvh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '1rem', fontWeight: '800', color: TEXTO, marginBottom: '14px', textAlign: 'center' }}>💾 Guardar resultado</div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {[{ nombre: nombreLocal, arq: arqueroLocal }, { nombre: nombreVis, arq: arqueroVis }].map((e, i) => (
            <div key={i} style={{ flex: 1, background: e.arq ? 'rgba(30,142,62,.1)' : 'rgba(217,48,37,.1)', border: `1px solid ${e.arq ? VERDE : ROJO}`, borderRadius: '10px', padding: '8px 10px', fontSize: '.72rem' }}>
              <div style={{ color: TEXTO_TENUE, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</div>
              <div style={{ fontWeight: '700', color: e.arq ? VERDE : ROJO }}>{e.arq ? `🧤 ${e.arq.nombre}` : '⚠️ Falta arquero (elígelo arriba en la franja amarilla)'}</div>
            </div>
          ))}
        </div>

        {hayRoja && !informeOk && (
          <div style={{ background: 'rgba(217,48,37,.1)', border: `1px solid ${ROJO}`, borderRadius: '10px', padding: '9px 12px', marginBottom: '14px', fontSize: '.74rem', color: '#ff8a80', fontWeight: '700' }}>
            📋 Hubo tarjeta roja: escribe el informe arbitral en la hoja (mínimo unas palabras) antes de guardar.
          </div>
        )}

        {avisoPenales && (
          <div style={{ background: 'rgba(232,113,10,.12)', border: '1px solid #e8710a', borderRadius: '10px', padding: '9px 12px', marginBottom: '14px', fontSize: '.74rem', color: '#ffa94d', fontWeight: '700' }}>
            ⚽ {avisoPenales}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '.75rem', fontWeight: '700', color: TEXTO, marginBottom: '6px' }}>⭐ MVP del partido (obligatorio)</div>
          {numerados.length === 0 ? (
            <div style={{ fontSize: '.72rem', color: TEXTO_TENUE }}>Aún no hay jugadores con número asignado.</div>
          ) : (
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: `1px solid ${BORDE}`, borderRadius: '10px' }}>
              {numerados.map(j => (
                <button key={j.id} type="button" onClick={() => setMvpId(j.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '8px 10px', background: mvpId === j.id ? 'rgba(249,168,37,.12)' : 'none', border: 'none', borderBottom: `1px solid ${BORDE}`, cursor: 'pointer', color: mvpId === j.id ? '#f9a825' : TEXTO, fontSize: '.78rem', fontWeight: mvpId === j.id ? '800' : '500' }}>
                  <span style={{ fontWeight: '900' }}>#{j.numero}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.nombre}</span>
                  <span style={{ fontSize: '.65rem', color: TEXTO_TENUE }}>{j.equipo}</span>
                  {mvpId === j.id && <span>⭐</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={onCerrar} disabled={guardando} style={{ ...btnSecundario, flex: 1 }}>‹ Seguir</button>
          <button type="button" onClick={() => onFinalizar({ mvpId })} disabled={!puedeFinalizar}
            style={{ ...btnPrimario, flex: 2, opacity: puedeFinalizar ? 1 : .5 }}>
            {guardando ? 'Guardando...' : '💾 Guardar resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}
