import { useState } from 'react'
import PlanillaPartido from './PlanillaPartido'
import PlanillaPapel from './planillaPapel/PlanillaPapel'
import { usaPlanillaCompleta } from '../lib/tipoPlanilla'

// Punto único de entrada a "llenar planilla": decide cuál planilla abrir
// (ver src/lib/tipoPlanilla.js). Se decide UNA vez por partido al abrirla:
// aunque la planilla empiece a guardar borradores, no cambia de tipo a mitad.
export default function PlanillaSegunPartido(props) {
  const idActual = props.partido?.id
  const [decision, setDecision] = useState(() => ({ id: idActual, completa: usaPlanillaCompleta(props.partido) }))
  let vigente = decision
  if (decision.id !== idActual) {
    vigente = { id: idActual, completa: usaPlanillaCompleta(props.partido) }
    setDecision(vigente)
  }
  return vigente.completa ? <PlanillaPartido {...props}/> : <PlanillaPapel {...props}/>
}
