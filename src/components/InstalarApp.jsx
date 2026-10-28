// Aviso + guía paso a paso para instalar Golmebol en el celular.
// Solo sale en celulares, en el inicio de cada portal, y desaparece cuando ya está instalada.
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Share, PlusSquare, MoreVertical, MoreHorizontal, Menu, Download, ExternalLink, Smartphone, Check, Copy, Compass, X } from 'lucide-react'
import { iniciarInstalacion, alCambiar, puedeInstalarDirecto, instalarDirecto, marcarInstalada, posponer, estaInstalada, fuePospuesta, detectarDispositivo, pasosParaInstalar } from '../lib/instalarApp'

const RUTAS = ['/', '/torneos', '/jugador/login', '/jugador', '/arbitro']
const ICONOS = {
  compartir: Share, agregar: PlusSquare, 'puntos-v': MoreVertical, 'puntos-h': MoreHorizontal, menu: Menu,
  descargar: Download, externo: ExternalLink, celular: Smartphone, ok: Check, copiar: Copy, safari: Compass,
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
  const Icono = ICONOS[actual.icono] || Smartphone
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
    <div onClick={cerrar} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', background: '#0d111b', borderRadius: '20px 20px 0 0', border: '1px solid #1f2738', borderBottom: 'none', padding: '18px 18px calc(18px + env(safe-area-inset-bottom, 0px))', fontFamily: "'Barlow Condensed', system-ui, sans-serif", color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>Instalar Golmebol</div>
            <div style={{ color: '#00ddd0', fontSize: '.85rem', fontWeight: 700 }}>{guia.titulo}</div>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: '#8a95ab', cursor: 'pointer', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={22}/></button>
        </div>

        {directo && !d.enApp && (
          <button onClick={async () => { const ok = await instalarDirecto(); if (ok) cerrar() }}
            style={{ width: '100%', marginTop: 12, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '14px', fontWeight: 800, fontSize: '1.05rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
            Instalar ahora con un toque
          </button>
        )}
        {directo && !d.enApp && <div style={{ color: '#7c879d', fontSize: '.8rem', textAlign: 'center', margin: '8px 0 2px' }}>o sigue los pasos:</div>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '16px 0 12px' }}>
          {pasos.map((_, i) => <span key={i} style={{ width: i === paso ? 22 : 8, height: 8, borderRadius: 4, background: i <= paso ? '#00ddd0' : '#2a3347', transition: 'all .2s' }}/>)}
        </div>

        <div style={{ background: '#121827', border: '1px solid #1f2738', borderRadius: 16, padding: '22px 18px', textAlign: 'center', minHeight: 210 }}>
          <div style={{ width: 76, height: 76, margin: '0 auto 14px', borderRadius: 20, background: 'rgba(0,221,208,.1)', border: '1px solid rgba(0,221,208,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ddd0' }}>
            <Icono size={38} strokeWidth={2}/>
          </div>
          <div style={{ color: '#7c879d', fontSize: '.8rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Paso {paso + 1} de {pasos.length}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1.15, margin: '4px 0 8px' }}>{actual.titulo}</div>
          <div style={{ color: '#b4bed2', fontSize: '1rem', lineHeight: 1.3 }}>{actual.texto}</div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {paso > 0 && (
            <button onClick={() => setPaso(p => p - 1)}
              style={{ flex: 1, background: 'transparent', color: '#cbd5e6', border: '1px solid #2a3347', borderRadius: 12, padding: '13px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
              Anterior
            </button>
          )}
          {!ultimo ? (
            <button onClick={() => setPaso(p => p + 1)}
              style={{ flex: 2, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
              Siguiente
            </button>
          ) : (
            <button onClick={() => { marcarInstalada(); cerrar() }}
              style={{ flex: 2, background: '#00ddd0', color: '#04211f', border: 'none', borderRadius: 12, padding: '13px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
              ¡Ya la instalé!
            </button>
          )}
        </div>
        <button onClick={() => { posponer(); cerrar() }}
          style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none', color: '#7c879d', fontSize: '.9rem', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px' }}>
          Ahora no
        </button>
      </div>
    </div>
  )
}
