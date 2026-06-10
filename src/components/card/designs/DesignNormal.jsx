export default function DesignNormal({ children }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }} viewBox="0 0 340 492" fill="none">
      <defs>
        <linearGradient id="brdN" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00e4d4" stopOpacity=".88"/>
          <stop offset="45%" stopColor="#2299ee" stopOpacity=".65"/>
          <stop offset="100%" stopColor="#9933ee" stopOpacity=".75"/>
        </linearGradient>
        <linearGradient id="bgN" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#00e8d8"/>
          <stop offset="12%" stopColor="#009ecc"/>
          <stop offset="40%" stopColor="#1558e2"/>
          <stop offset="68%" stopColor="#200c86"/>
          <stop offset="100%" stopColor="#110450"/>
        </linearGradient>
        <clipPath id="activeCardClip" clipPathUnits="objectBoundingBox" transform="scale(0.002941,0.002033)">
          <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z"/>
        </clipPath>
      </defs>
      <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z" fill="url(#bgN)"/>
      <path d="M 20 0 L 120 0 L 134 10 L 154 2 L 170 0 L 186 2 L 206 10 L 220 0 L 320 0 Q 338 0 340 17 L 340 380 Q 340 422 305 448 Q 278 466 244 476 Q 218 485 170 486 Q 122 485 96 476 Q 62 466 35 448 Q 0 422 0 380 L 0 17 Q 2 0 20 0 Z" fill="none" stroke="url(#brdN)" strokeWidth="3.5"/>
      <path d="M 23 4 L 121 4 L 134 13 L 153 5.5 L 170 4 L 187 5.5 L 206 13 L 217 4 L 317 4 Q 333 4 335 20 L 335 379 Q 335 417 302 442 Q 276 459 242 469 Q 217 477 170 478 Q 123 477 98 469 Q 64 459 38 442 Q 5 417 5 379 L 5 20 Q 7 4 23 4 Z" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1"/>
      <line x1="170" y1="0" x2="170" y2="29" stroke="rgba(0,215,205,.72)" strokeWidth="1.5"/>
      <line x1="134" y1="10" x2="134" y2="27" stroke="rgba(0,215,205,.48)" strokeWidth="1"/>
      <line x1="206" y1="10" x2="206" y2="27" stroke="rgba(0,215,205,.48)" strokeWidth="1"/>
      <path d="M 96 476 Q 133 490 170 492 Q 207 490 244 476" fill="none" stroke="rgba(0,195,185,.25)" strokeWidth="1.2"/>
    </svg>
  )
}