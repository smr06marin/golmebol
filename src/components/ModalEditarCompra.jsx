import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const S = {
  card2: '#1a2234', border: '#1e2d3d', cyan: '#00ddd0', gold: '#f9a825',
  text: '#e8f4fd', muted: '#7a9ab5', loss: '#d93025',
}
const inp = { width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: '10px', padding: '10px 13px', color: S.text, fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' }
const lbl = { fontSize: '.7rem', color: S.muted, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.05em' }

// Corregir una compra ya registrada — pensado para el caso típico: se
// registró el producto equivocado ("entraron 12 Natuchips" cuando en
// realidad eran 12 Mr Tea) y esto quedó viviendo en el cuadre de un día ya
// cerrado. Se puede abrir directo desde el informe (cualquier fecha, no
// solo la de hoy), sin tener que ir a otra pantalla.
//
// Lo delicado acá es el STOCK: cuando se registró la compra, la cantidad ya
// se sumó al producto que se eligió en su momento (ver EscenarioComprasPage
// → registrarCompraInner). Si ahora se cambia de producto o de cantidad,
// hay que devolverle esa cantidad vieja al producto viejo y sumarle la
// cantidad nueva al producto nuevo — si no, el stock del sistema queda mal
// para los DOS productos (el viejo con de más, el nuevo con de menos).
export default function ModalEditarCompra({ compra, productos, onClose, onGuardado }) {
  const [productoId, setProductoId] = useState(compra.product_id || '')
  const [cantidad, setCantidad] = useState(String(compra.cantidad ?? ''))
  const [costo, setCosto] = useState(String(compra.costo ?? ''))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const guardandoRef = useRef(false)

  async function guardar() {
    if (guardandoRef.current) return
    const cantidadNum = Number(cantidad)
    const costoNum = Number(costo) || 0
    if (!productoId) { setError('Elegí a qué producto corresponde'); return }
    if (!cantidadNum || cantidadNum <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    guardandoRef.current = true
    setGuardando(true)
    setError('')
    try {
      const productoNuevo = productos.find(p => p.id === productoId)
      const cantidadVieja = Number(compra.cantidad || 0)
      const productoIdViejo = compra.product_id

      // 1) Devolver la cantidad vieja al producto viejo (si tenía uno
      //    enlazado — compras muy antiguas pueden no tenerlo).
      if (productoIdViejo) {
        const { data: pViejo } = await supabase.from('escenario_productos').select('cantidad').eq('id', productoIdViejo).single()
        if (pViejo) {
          await supabase.from('escenario_productos').update({ cantidad: Math.max(0, Number(pViejo.cantidad || 0) - cantidadVieja) }).eq('id', productoIdViejo)
        }
      }

      // 2) Sumarle la cantidad nueva al producto nuevo (que puede ser el
      //    mismo de antes, si solo se corrigió la cantidad o el costo — en
      //    ese caso este SELECT ya lee el stock recién devuelto en el paso
      //    1, así que el resultado neto es sumar/restar solo la diferencia).
      const { data: pNuevo } = await supabase.from('escenario_productos').select('cantidad').eq('id', productoId).single()
      await supabase.from('escenario_productos').update({ cantidad: Number(pNuevo?.cantidad || 0) + cantidadNum }).eq('id', productoId)

      // 3) Corregir la fila de la compra en sí.
      const { error: errCompra } = await supabase.from('escenario_compras').update({
        product_id: productoId, nombre: productoNuevo?.nombre || compra.nombre,
        cantidad: cantidadNum, costo: costoNum,
      }).eq('id', compra.id)
      if (errCompra) { setError(errCompra.message); return }

      onGuardado && onGuardado()
      onClose && onClose()
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div style={{ background: '#111827', border: `1px solid ${S.border}`, borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', fontFamily: 'system-ui, sans-serif' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: S.text }}>✏️ Corregir compra</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: '.72rem', color: S.muted, marginBottom: '16px' }}>
          {compra.fecha} · {compra.proveedor} — quedó registrada como <b>{compra.nombre}</b> x{compra.cantidad}
        </div>

        <label style={lbl}>Producto correcto</label>
        <select value={productoId} onChange={e => setProductoId(e.target.value)} style={{ ...inp, marginBottom: '12px' }}>
          <option value="">— Elegir producto —</option>
          {productos.map(p => <option key={p.id} value={p.id}>{p.emoji || '📦'} {p.nombre}</option>)}
        </select>

        <label style={lbl}>Cantidad</label>
        <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)} style={{ ...inp, marginBottom: '12px' }} />

        <label style={lbl}>Costo unitario</label>
        <input type="number" min="0" value={costo} onChange={e => setCosto(e.target.value)} style={{ ...inp, marginBottom: '4px' }} />
        <div style={{ fontSize: '.68rem', color: S.muted, marginBottom: '16px' }}>El stock del producto viejo y del nuevo se ajusta solo — no hace falta corregirlo aparte.</div>

        {error && <div style={{ color: S.loss, fontSize: '.78rem', marginBottom: '10px' }}>{error}</div>}

        <button onClick={guardar} disabled={guardando} style={{ width: '100%', padding: '12px', background: guardando ? '#3a4a5c' : S.cyan, border: 'none', borderRadius: '10px', color: '#07070e', fontWeight: '800', fontSize: '.88rem', cursor: guardando ? 'default' : 'pointer' }}>
          {guardando ? 'Guardando...' : '✓ Guardar corrección'}
        </button>
      </div>
    </div>
  )
}
