import DesignEscudo from './DesignEscudo'

// Contorno de escudo propio del nivel Leyenda (premium).
// El resto del diseño (gradientes, alas, cristales, remaches, etc.) vive en
// DesignEscudo.jsx, compartido con DesignNivel3 — antes estaba copiado y
// pegado completo en los dos archivos.
const SHAPE = "M 20 110 C 28 110 38 105 50 95 C 62 82 70 58 88 48 C 105 38 120 36 127 32 C 134 40 141 45 153 40 C 159 36 164 32 170 28 C 176 32 181 36 187 40 C 199 45 206 40 213 32 C 220 36 235 38 252 48 C 270 58 278 82 290 95 C 302 105 312 110 320 110 L 320 440 Q 320 465 302 480 Q 275 494 242 500 Q 210 506 192 510 Q 181 516 170 522 Q 159 516 148 510 Q 130 506 98 500 Q 65 494 38 480 Q 20 465 20 440 Z"
const INNER = "M 26 110 C 33 110 42 106 53 96 C 65 83 72 60 89 50 C 106 40 120 38 127 34 C 134 42 141 47 153 42 C 159 38 164 34 170 31 C 176 34 181 38 187 42 C 199 47 206 42 213 34 C 220 38 234 40 251 50 C 268 60 275 83 287 96 C 298 106 307 110 314 110 L 314 438 Q 314 462 297 476 Q 271 489 239 495 Q 208 501 191 505 Q 181 510 170 516 Q 159 510 149 505 Q 132 501 101 495 Q 69 489 43 476 Q 26 462 26 438 Z"

export default function DesignPremium({ variant = 'inicio', clipId = 'activeCardClip' }) {
  return <DesignEscudo variant={variant} clipId={clipId} shape={SHAPE} inner={INNER} />
}
