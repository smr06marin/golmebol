// Aviso + guía paso a paso para instalar Golmebol en el celular.
// Cada paso trae un dibujo de la pantalla con una flecha que rebota y un círculo que late sobre el botón que hay que tocar.
// Solo sale en celulares, en el inicio de cada portal, y desaparece cuando ya está instalada.
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Share, MoreVertical, MoreHorizontal, Menu, ExternalLink, Smartphone, Copy, Compass, X, Lock,
  ChevronLeft, ChevronRight, BookOpen, Copy as Pestanas, Home, Plus, ArrowDown, ArrowUp, ArrowRight, Check,
} from 'lucide-react'
import { iniciarInstalacion, alCambiar, puedeInstalarDirecto, instalarDirecto, marcarInstalada, posponer, estaInstalada, fuePospuesta, detectarDispositivo, pasosParaInstalar } from '../lib/instalarApp'

const RUTAS = ['/', '/torneos', '/jugador/login', '/jugador', '/arbitro']
const ROJO = '#ff2d55'

const ICONOS_BARRA = {
  atras: ChevronLeft, adelante: ChevronRight, compartir: Share, libro: BookOpen, pestanas: Pestanas,
  inicio: Home, menu: Menu, mas: Plus, 'puntos-h': MoreHorizontal, 'puntos-v': MoreVertical,
}
const ICONOS_GRANDES = { copiar: Copy, safari: Compass, celular: Smartphone, externo: ExternalLink }

const CSS = `
@keyframes gmLate { 0% { box-shadow: 0 0 0 0 rgba(255,45,85,.7); } 70% { box-shadow: 0 0 0 14px rgba(255,45,85,0); } 100% { box-shadow: 0 0 0 0 rgba(255,45,85,0); } }
@keyframes gmReboteY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(9px); } }
@keyframes gmReboteYArriba { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes gmReboteX { 0%,100% { transform: translateX(0); } 50% { transform: translateX(9px); } }
.gm-late { animation: gmLate 1.3s ease-out infinite; }
.gm-flecha-abajo { animation: gmReboteY .8s ease-in-out infinite; }
.gm-flecha-arriba { animation: gmReboteYArriba .8s ease-in-out infinite; }
.gm-flecha-der { animation: gmReboteX .8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .gm-late, .gm-flecha-abajo, .gm-flecha-arriba, .gm-flecha-der { animation: none; } }
`

// Flecha grande con la palabra AQUÍ
function Flecha({ dir, estilo }) {
  const Ic = dir === 'abajo' ? ArrowDown : dir === 'arriba' ? ArrowUp : ArrowRight
  const cls = dir === 'abajo' ? 'gm-flecha-abajo' : dir === 'arriba' ? 'gm-flecha-arriba' : 'gm-flecha-der'
  const pill = <span style={{ background: ROJO, color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em', borderRadius: 8, padding: '2px 8px', lineHeight: 1.3 }}>AQUÍ</span>
  return (
    <div className={cls} style={{ position: 'absolute', display: 'flex', flexDirection: dir === 'derecha' ? 'row' : 'column', alignItems: 'center', gap: 0, pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))', ...estilo }}>
      {dir === 'abajo' && pill}
      <Ic size={40} strokeWidth={3.4} color={ROJO}/>
      {dir === 'arriba' && pill}
    </div>
  )
}

const pantalla = { position: 'relative', width: '100%', height: 200, borderRadius: 18, overflow: 'hidden', background: '#e9edf3', border: '3px solid #2a3347', boxSizing: 'border-box' }
const pagina = (
  <div style={{ position: 'absolute', inset: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img src="/icon-192.png" alt="" width={26} height={26} style={{ borderRadius: 7 }}/>
      <div style={{ height: 10, flex: 1, background: '#c9d1de', borderRadius: 5 }}/>
    </div>
    <div style={{ height: 52, background: '#d3dae6', borderRadius: 10 }}/>
    <div style={{ height: 10, width: '80%', background: '#c9d1de', borderRadius: 5 }}/>
    <div style={{ height: 10, width: '60%', background: '#c9d1de', borderRadius: 5 }}/>
  </div>
)

function Objetivo({ children, redondo = true, estilo }) {
  return (
    <div className="gm-late" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: redondo ? '50%' : 10, ...estilo }}>
      {children}
    </div>
  )
}

function Escena({ e }) {
  if (e.tipo === 'barra-abajo') {
    const n = e.iconos.length
    return (
      <div style={pantalla}>
        {pagina}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, background: '#fff', borderTop: '1px solid #cfd6e2', display: 'flex' }}>
          {e.iconos.map((nombre, i) => {
            const Ic = ICONOS_BARRA[nombre] || Menu
            const esObj = i === e.objetivo
            return (
              <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {esObj ? (
                  <>
                    <Objetivo estilo={{ width: 44, height: 44, background: 'rgba(255,45,85,.12)', border: `2px solid ${ROJO}` }}><Ic size={24} color="#1c1c1e"/></Objetivo>
                    <Flecha dir="abajo" estilo={{ bottom: 62, left: i === n - 1 ? 'auto' : '50%', right: i === n - 1 ? -2 : 'auto', transform: i === n - 1 ? 'none' : 'translateX(-50%)' }}/>
                  </>
                ) : <Ic size={22} color="#8a8f99"/>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  if (e.tipo === 'barra-arriba') {
    const Ic = ICONOS_BARRA[e.objetivo] || MoreVertical
    const dentro = e.objetivo === 'compartir' // en Chrome de iPhone el botón va dentro de la dirección
    return (
      <div style={pantalla}>
        {pagina}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 58, background: '#fff', borderBottom: '1px solid #cfd6e2', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 10px' }}>
          <div style={{ flex: 1, height: 36, borderRadius: 18, background: '#eef1f6', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', color: '#555', fontSize: 14, fontWeight: 600 }}>
            <Lock size={13}/> golmebol.com
            {dentro && <span style={{ marginLeft: 'auto', position: 'relative', display: 'flex' }}>
              <Objetivo estilo={{ width: 34, height: 34, margin: -4, background: 'rgba(255,45,85,.12)', border: `2px solid ${ROJO}` }}><Ic size={20} color="#1c1c1e"/></Objetivo>
              <Flecha dir="arriba" estilo={{ top: 38, right: -10 }}/>
            </span>}
          </div>
          {!dentro && (
            <div style={{ position: 'relative', width: 40, display: 'flex', justifyContent: 'center' }}>
              <Objetivo estilo={{ width: 38, height: 38, background: 'rgba(255,45,85,.12)', border: `2px solid ${ROJO}` }}><Ic size={22} color="#1c1c1e"/></Objetivo>
              <Flecha dir="arriba" estilo={{ top: 44, right: -6 }}/>
            </div>
          )}
        </div>
      </div>
    )
  }
  if (e.tipo === 'menu') {
    return (
      <div style={pantalla}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)' }}/>
        <div style={{ position: 'absolute', left: 52, right: 12, top: 12, bottom: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 6px 18px rgba(0,0,0,.25)', padding: 5 }}>
            {e.filas.map((f, i) => {
              const obj = i === e.objetivo
              return (
                <div key={i} className={obj ? 'gm-late' : undefined}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, height: 42, padding: '0 10px', borderRadius: 10, background: obj ? 'rgba(255,45,85,.12)' : 'transparent', border: obj ? `2px solid ${ROJO}` : '2px solid transparent', color: obj ? '#111' : '#9aa0ab', fontWeight: obj ? 800 : 600, fontSize: 14.5, lineHeight: 1.1 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: obj ? ROJO : '#d7dce5' }}/>
                  <span style={{ minWidth: 0 }}>{f}</span>
                  {obj && <Flecha dir="derecha" estilo={{ left: -50, top: '50%', marginTop: -20 }}/>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }
  if (e.tipo === 'dialogo-ios') {
    return (
      <div style={pantalla}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)' }}/>
        <div style={{ position: 'absolute', left: 8, right: 8, top: 12, background: '#f7f7fa', borderRadius: 16, boxShadow: '0 6px 18px rgba(0,0,0,.25)', padding: '10px 12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, marginBottom: 12 }}>
            <span style={{ color: '#2a7cf6' }}>Cancelar</span>
            <b style={{ color: '#111', fontSize: 13 }}>Agregar a inicio</b>
            <span style={{ position: 'relative', display: 'flex' }}>
              <Objetivo redondo={false} estilo={{ padding: '4px 10px', margin: '-4px -6px', background: 'rgba(255,45,85,.12)', border: `2px solid ${ROJO}` }}><b style={{ color: '#2a7cf6', fontSize: 14.5 }}>{e.boton}</b></Objetivo>
              <Flecha dir="arriba" estilo={{ top: 38, right: -2 }}/>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: 8 }}>
            <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 9 }}/>
            <div><div style={{ fontWeight: 800, color: '#111', fontSize: 15 }}>Golmebol</div><div style={{ color: '#8a8f99', fontSize: 12 }}>golmebol.com</div></div>
          </div>
        </div>
      </div>
    )
  }
  if (e.tipo === 'dialogo-android') {
    return (
      <div style={pantalla}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.28)' }}/>
        <div style={{ position: 'absolute', left: 18, right: 18, top: 22, background: '#fff', borderRadius: 18, boxShadow: '0 8px 22px rgba(0,0,0,.3)', padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 9 }}/>
            <div><div style={{ fontWeight: 800, color: '#111', fontSize: 15 }}>Golmebol</div><div style={{ color: '#8a8f99', fontSize: 12 }}>golmebol.com</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#1a73e8', fontWeight: 700, fontSize: 14 }}>Cancelar</span>
            <span style={{ position: 'relative', display: 'flex' }}>
              <Objetivo redondo={false} estilo={{ padding: '5px 12px', margin: '-5px -4px', background: 'rgba(255,45,85,.12)', border: `2px solid ${ROJO}` }}><b style={{ color: '#1a73e8', fontSize: 14.5 }}>{e.boton}</b></Objetivo>
              <Flecha dir="abajo" estilo={{ bottom: 36, right: -2 }}/>
            </span>
          </div>
        </div>
      </div>
    )
  }
  if (e.tipo === 'inicio') {
    const casillas = Array.from({ length: 12 }, (_, i) => i)
    return (
      <div style={{ ...pantalla, background: 'linear-gradient(160deg,#1b3a6b,#2b1d5c)' }}>
        <div style={{ position: 'absolute', inset: 0, padding: '22px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 10, justifyItems: 'center', alignItems: 'center' }}>
          {casillas.map(i => i === 5 ? (
            <div key={i} style={{ position: 'relative' }}>
              <div className="gm-late" style={{ borderRadius: 14, border: `2px solid ${ROJO}`, padding: 2, display: 'flex' }}><img src="/icon-192.png" alt="" width={46} height={46} style={{ borderRadius: 11 }}/></div>
              <Flecha dir="arriba" estilo={{ top: 56, left: '50%', marginLeft: -26 }}/>
            </div>
          ) : <div key={i} style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.16)' }}/>)}
        </div>
      </div>
    )
  }
  const Ic = ICONOS_GRANDES[e.nombre] || Smartphone
  return (
    <div style={{ ...pantalla, background: '#121827', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 96, height: 96, borderRadius: 26, background: 'rgba(0,221,208,.1)', border: '1px solid rgba(0,221,208,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ddd0' }}><Ic size={48}/></div>
    </div>
  )
}

export default function InstalarApp() {
  const { pathname } = useLocation()
  const [, forzar] = useState(0)
  const [visible, setVisible] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [paso, setPaso] = useState(0)

  useEffect(() => { iniciarInstalacion(); return alCambiar(() => forzar(n => n + 1)) }, [])
  // Sale unos segundos después de entrar, para no tapar la carga de la pantalla
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3500)
    return () => clearTimeout(t)
  }, [])

  const d = detectarDispositivo()
  if (!d.movil || !RUTAS.includes(pathname) || estaInstalada()) return null
  if (!abierta && (!visible || fuePospuesta())) return null

  const directo = puedeInstalarDirecto()
  const guia = pasosParaInstalar(d, directo)
  const pasos = guia.pasos
  const actual = pasos[Math.min(paso, pasos.length - 1)]
  const ultimo = paso >= pasos.length - 1
  const cerrar = () => { setAbierta(false); setPaso(0) }

  if (!abierta) {
    return (
      <div role="dialog" aria-label="Instalar Golmebol" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 9000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 440, background: '#10141f', border: '1px solid rgba(0,221,208,.35)', borderRadius: 16, padding: '12px 12px 12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,.55)', fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}>
          <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.1 }}>Instala Golmebol</div>
            <div style={{ color: '#9aa6bd', fontSize: '.86rem', lineHeight: 1.2, marginTop: 2 }}>Entra directo desde tu pantalla.</div>
          </div>
          <button onClick={() => { setPaso(0); setAbierta(true) }}
            style={{ flexShrink: 0, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 10, padding: '11px 14px', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
            Ver cómo
          </button>
          <button onClick={posponer} aria-label="Cerrar" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#7c879d', cursor: 'pointer', width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <X size={18}/>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <style>{CSS}</style>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 480, maxHeight: '96vh', overflowY: 'auto', background: '#0d111b', borderRadius: '20px 20px 0 0', border: '1px solid #1f2738', borderBottom: 'none', padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', fontFamily: "'Barlow Condensed', system-ui, sans-serif", color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.png" alt="" width={34} height={34} style={{ borderRadius: 9 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.1 }}>Instalar Golmebol</div>
            <div style={{ color: '#00ddd0', fontSize: '.85rem', fontWeight: 700 }}>{guia.titulo}</div>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#8a95ab', cursor: 'pointer', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={22}/></button>
        </div>

        {directo && !d.enApp && (
          <button onClick={async () => { const ok = await instalarDirecto(); if (ok) cerrar() }}
            style={{ width: '100%', marginTop: 12, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 50 }}>
            Instalar ahora con un toque
          </button>
        )}
        {directo && !d.enApp && <div style={{ color: '#7c879d', fontSize: '.85rem', textAlign: 'center', margin: '8px 0 0' }}>o mira cómo hacerlo tú:</div>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '14px 0 10px' }}>
          {pasos.map((_, i) => <span key={i} style={{ width: i === paso ? 22 : 8, height: 8, borderRadius: 4, background: i <= paso ? '#00ddd0' : '#2a3347', transition: 'all .2s' }}/>)}
        </div>

        <div style={{ color: '#7c879d', fontSize: '.85rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', textAlign: 'center' }}>Paso {paso + 1} de {pasos.length}</div>
        <div style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.12, margin: '4px 4px 12px', textAlign: 'center' }}>{actual.titulo}</div>

        <Escena key={paso} e={actual.escena}/>

        {actual.texto ? <div style={{ color: '#b4bed2', fontSize: '1.05rem', lineHeight: 1.3, textAlign: 'center', margin: '12px 6px 0' }}>{actual.texto}</div> : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {paso > 0 && (
            <button onClick={() => setPaso(p => p - 1)}
              style={{ flex: 1, background: 'transparent', color: '#cbd5e6', border: '1px solid #2a3347', borderRadius: 12, padding: '13px', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 52 }}>
              Anterior
            </button>
          )}
          {!ultimo ? (
            <button onClick={() => setPaso(p => p + 1)}
              style={{ flex: 2, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 52 }}>
              Siguiente
            </button>
          ) : (
            <button onClick={() => { marcarInstalada(); cerrar() }}
              style={{ flex: 2, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Check size={20}/> ¡Ya la instalé!
            </button>
          )}
        </div>
        <button onClick={() => { posponer(); cerrar() }}
          style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: '#7c879d', fontSize: '.95rem', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px' }}>
          Ahora no
        </button>
      </div>
    </div>
  )
}
