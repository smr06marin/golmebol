import DesignEscudo from './DesignEscudo'

// Contorno de escudo propio del nivel Élite (nivel 3).
// El resto del diseño (gradientes, alas, cristales, remaches, etc.) vive en
// DesignEscudo.jsx, compartido con DesignPremium — antes estaba copiado y
// pegado completo en los dos archivos.
const SHAPE = "M 170 0 Q 140 30 100 45 Q 60 58 20 60 L 20 130 Q 20 165 0 170 L 0 440 Q 0 465 38 480 Q 65 494 98 500 Q 130 506 148 510 Q 159 516 170 522 Q 181 516 192 510 Q 210 506 242 500 Q 275 494 302 480 Q 340 465 340 440 L 340 170 Q 320 165 320 130 L 320 60 Q 280 58 240 45 Q 200 30 170 0 Z"
const INNER = "M 42 4 Q 24 4 24 22 L 24 50 Q 24 68 6 68 L 6 438 Q 6 462 42 476 Q 68 489 100 495 Q 131 501 149 505 Q 159 510 170 516 Q 181 510 191 505 Q 209 501 240 495 Q 272 489 298 476 Q 334 462 334 438 L 334 68 Q 316 68 316 50 L 316 22 Q 316 4 298 4 Z"

export default function DesignNivel3({ variant = 'inicio', clipId = 'activeCardClip' }) {
  return <DesignEscudo variant={variant} clipId={clipId} shape={SHAPE} inner={INNER} />
}
