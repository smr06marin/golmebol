// Generador de PDF mínimo, SIN dependencias: texto (Helvetica), líneas, recuadros y tablas
// con salto de página automático. Sirve para entregar documentos (liquidaciones, cuentas…)
// que se descargan directo, también en celular. Solo admite texto latino (tildes y ñ).

const PW = 595.28
const PH = 841.89

// Anchos de Helvetica (por 1000) para los caracteres 32..126; sirven para partir líneas y alinear a la derecha.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  334, 260, 334, 584]

const ESPECIALES = { 0x2014: 0x97, 0x2013: 0x96, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2026: 0x85, 0x20AC: 0x80 }

// Deja solo caracteres que el PDF (WinAnsi) entiende: lo demás (emojis, símbolos) se quita.
function limpiar(t) {
  let r = ''
  for (const ch of String(t ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0)
    if (c < 32) r += ' '
    else if (c <= 126 || (c >= 128 && c <= 255)) r += ch
    else if (ESPECIALES[c]) r += String.fromCharCode(ESPECIALES[c])
  }
  return r
}

function anchoCaracter(ch) {
  const c = ch.charCodeAt(0)
  return c >= 32 && c <= 126 ? W[c - 32] : 600
}

function colorPdf(hex) {
  const h = String(hex || '#000000').replace('#', '')
  const n = h.length === 3 ? h.split('').map(x => x + x).join('') : h.padEnd(6, '0')
  return [0, 2, 4].map(i => (parseInt(n.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ')
}

const esc = t => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export function nuevoPdf({ pie = '', margen = 40 } = {}) {
  const paginas = []
  let cmds = null
  let y = 0
  const anchoUtil = PW - margen * 2
  const limiteY = PH - margen - 22

  const nuevaPagina = () => { cmds = []; paginas.push(cmds); y = margen }
  nuevaPagina()

  const ancho = (t, size, bold) => {
    let s = 0
    for (const ch of limpiar(t)) s += anchoCaracter(ch)
    return (s * size / 1000) * (bold ? 1.06 : 1)
  }

  // Parte un texto en líneas que quepan en `max` puntos.
  function partir(t, max, size, bold) {
    const lineas = []
    for (const parrafo of limpiar(t).split('\n')) {
      let actual = ''
      for (const palabra of parrafo.split(' ')) {
        const prueba = actual ? actual + ' ' + palabra : palabra
        if (ancho(prueba, size, bold) <= max || !actual) {
          if (ancho(prueba, size, bold) > max) {
            let trozo = ''
            for (const ch of palabra) {
              if (ancho(trozo + ch, size, bold) > max && trozo) { lineas.push(trozo); trozo = '' }
              trozo += ch
            }
            actual = trozo
          } else actual = prueba
        } else { lineas.push(actual); actual = palabra }
      }
      lineas.push(actual)
    }
    return lineas
  }

  function pintar(t, x, base, { size = 10, bold = false, color = '#202124', align = 'left', anchoCol = 0 } = {}) {
    const txt = limpiar(t)
    if (!txt) return
    let px = x
    if (align === 'right') px = x + anchoCol - ancho(txt, size, bold)
    else if (align === 'center') px = x + (anchoCol - ancho(txt, size, bold)) / 2
    cmds.push(`BT ${colorPdf(color)} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${px.toFixed(2)} ${(PH - base).toFixed(2)} Td (${esc(txt)}) Tj ET`)
  }

  const rect = (x, top, w, h, fill) => cmds.push(`${colorPdf(fill)} rg ${x.toFixed(2)} ${(PH - top - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`)
  const linea = (x1, yy, x2, color = '#dadce0', grosor = 0.6) =>
    cmds.push(`${colorPdf(color)} RG ${grosor} w ${x1.toFixed(2)} ${(PH - yy).toFixed(2)} m ${x2.toFixed(2)} ${(PH - yy).toFixed(2)} l S`)
  const asegurar = h => { if (y + h > limiteY) nuevaPagina() }

  const api = {
    espacio(h = 8) { y += h },
    regla() { asegurar(8); linea(margen, y + 3, PW - margen); y += 8 },
    parrafo(t, { size = 10, bold = false, color = '#3c4043', align = 'left', gap = 4, sangria = 0 } = {}) {
      const alto = size * 1.4
      const ls = partir(t, anchoUtil - sangria, size, bold)
      ls.forEach(l => {
        asegurar(alto)
        pintar(l, margen + sangria, y + size, { size, bold, color, align, anchoCol: anchoUtil - sangria })
        y += alto
      })
      y += gap
    },
    titulo(t, { size = 18, color = '#202124' } = {}) { api.parrafo(t, { size, bold: true, color, gap: 2 }) },
    // Fila "etiqueta ........ valor" (resúmenes y totales).
    par(etiqueta, valor, { bold = false, color = '#202124', fondo = null, size = 10 } = {}) {
      const alto = size * 1.4 + 8
      asegurar(alto)
      if (fondo) rect(margen, y, anchoUtil, alto, fondo)
      pintar(etiqueta, margen + 8, y + alto / 2 + size * 0.35, { size, bold, color })
      pintar(valor, margen, y + alto / 2 + size * 0.35, { size, bold: true, color, align: 'right', anchoCol: anchoUtil - 8 })
      y += alto
    },
    // cols: [{ t: 'Fecha', w: 2, align: 'left'|'right'|'center' }]; filas: arrays de texto, o { celdas, bold, fondo }.
    tabla(cols, filas, { size = 8.5 } = {}) {
      const total = cols.reduce((a, c) => a + (c.w || 1), 0)
      const anchos = cols.map(c => anchoUtil * (c.w || 1) / total)
      const pad = 4
      const alto = size * 1.3
      const encabezado = () => {
        asegurar(alto + pad * 2 + 20)
        rect(margen, y, anchoUtil, alto + pad * 2, '#f1f3f4')
        let x = margen
        cols.forEach((c, i) => { pintar(c.t, x + pad, y + pad + size, { size, bold: true, color: '#5f6368', align: c.align, anchoCol: anchos[i] - pad * 2 }); x += anchos[i] })
        y += alto + pad * 2
      }
      encabezado()
      filas.forEach(f => {
        const celdas = Array.isArray(f) ? f : f.celdas
        const bold = !Array.isArray(f) && f.bold
        const lineasCol = celdas.map((c, i) => partir(c, anchos[i] - pad * 2, size, bold))
        const n = Math.max(...lineasCol.map(l => l.length), 1)
        const h = n * alto + pad * 2
        if (y + h > limiteY) { nuevaPagina(); encabezado() }
        if (!Array.isArray(f) && f.fondo) rect(margen, y, anchoUtil, h, f.fondo)
        let x = margen
        lineasCol.forEach((ls, i) => {
          ls.forEach((l, k) => pintar(l, x + pad, y + pad + size + k * alto, { size, bold, align: cols[i].align, anchoCol: anchos[i] - pad * 2 }))
          x += anchos[i]
        })
        y += h
        linea(margen, y, PW - margen)
      })
    },
    firma(etiqueta, x = margen, w = 200) {
      asegurar(40)
      const yy = y + 28
      linea(x, yy, x + w, '#5f6368', 0.8)
      pintar(etiqueta, x, yy + 12, { size: 8.5, color: '#5f6368' })
    },
    saltoFirmas(etiquetas) {
      asegurar(58)
      const w = (anchoUtil - 30 * (etiquetas.length - 1)) / etiquetas.length
      const yy = y + 34
      etiquetas.forEach((e, i) => {
        const x = margen + i * (w + 30)
        linea(x, yy, x + w, '#5f6368', 0.8)
        pintar(e, x, yy + 12, { size: 8.5, color: '#5f6368' })
      })
      y += 56
    },
    bytes() {
      const n = paginas.length
      const contenidos = paginas.map((c, i) => {
        const pieTxt = `${pie}${pie ? '   ·   ' : ''}Página ${i + 1} de ${n}`
        const extra = [`BT ${colorPdf('#9aa0a6')} rg /F1 8 Tf ${margen} ${margen - 14} Td (${esc(limpiar(pieTxt))}) Tj ET`]
        return [...c, ...extra].join('\n')
      })
      let out = '%PDF-1.4\n'
      const offs = []
      const obj = s => { offs.push(out.length); out += `${offs.length} 0 obj\n${s}\nendobj\n` }
      obj('<< /Type /Catalog /Pages 2 0 R >>')
      obj(`<< /Type /Pages /Kids [${contenidos.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`)
      obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
      obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
      contenidos.forEach((c, i) => {
        obj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`)
        obj(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`)
      })
      const xref = out.length
      out += `xref\n0 ${offs.length + 1}\n0000000000 65535 f \n`
      offs.forEach(o => { out += `${String(o).padStart(10, '0')} 00000 n \n` })
      out += `trailer\n<< /Size ${offs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
      const bytes = new Uint8Array(out.length)
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255
      return bytes
    },
    descargar(nombre) {
      const url = URL.createObjectURL(new Blob([api.bytes()], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = nombre
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    },
  }
  return api
}
