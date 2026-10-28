import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PlanillaPartido from './PlanillaPartido'
import PlanillaPapel from './planillaPapel/PlanillaPapel'
import { usaPlanillaCompleta } from '../lib/tipoPlanilla'

// Punto único de entrada a "llenar planilla": decide cuál planilla abrir
// (ver src/lib/tipoPlanilla.js). Se decide UNA vez por partido al abrirla:
// aunque la planilla empiece a guardar borradores, no cambia de tipo a mitad.
// contexto: 'arbitro' (cuenta de árbitro/coordinador) o nada (admin/organizador); ver tipoPlanilla.js
//
// Para admin/organizador, si el partido no tiene planilla propia se consulta la
// que se escogió para el torneo (tournaments.planilla_tipo). Se consulta cada
// vez que se abre (sin caché): si el admin la cambia, vale desde ya.
async function tipoDelTorneo(torneoId) {
  try {
    const { data, error } = await supabase.from('tournaments').select('planilla_tipo').eq('id', torneoId).maybeSingle()
    if (error) return null // sin la columna / sin permiso: comportamiento de siempre
    return data?.planilla_tipo === 'salon' || data?.planilla_tipo === 'futbol11' ? data.planilla_tipo : null
  } catch {
    return null
  }
}

function PlanillaDecidida({ contexto, tipoTorneo, ...props }) {
  // Se decide una sola vez (el padre la vuelve a montar con `key` si cambia el partido).
  const [completa] = useState(() => usaPlanillaCompleta(props.partido, contexto, tipoTorneo))
  return completa ? <PlanillaPartido {...props}/> : <PlanillaPapel {...props}/>
}

export default function PlanillaSegunPartido({ contexto, ...props }) {
  const p = props.partido
  const idActual = p?.id
  const torneoId = contexto !== 'arbitro' && p ? (p.tournament_id || null) : null
  const [resuelto, setResuelto] = useState({ torneoId: null, tipo: null })

  useEffect(() => {
    if (!torneoId) return undefined
    let vivo = true
    tipoDelTorneo(torneoId).then(tipo => { if (vivo) setResuelto({ torneoId, tipo }) })
    return () => { vivo = false }
  }, [torneoId])

  // undefined = todavía consultando; null = el torneo no tiene planilla escogida
  let tipoTorneo = null
  if (torneoId) tipoTorneo = resuelto.torneoId === torneoId ? resuelto.tipo : undefined

  if (tipoTorneo === undefined) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5f6368', fontSize: '1rem', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div>Cargando planilla…</div>
          {props.onClose && <button onClick={props.onClose} style={{ marginTop: '18px', padding: '10px 18px', borderRadius: '10px', border: '1px solid #9aa0a6', background: '#fff', color: '#202124', fontWeight: '800', fontSize: '.9rem', cursor: 'pointer' }}>‹ Atrás</button>}
        </div>
      </div>
    )
  }
  return <PlanillaDecidida key={idActual} contexto={contexto} tipoTorneo={tipoTorneo} {...props}/>
}
