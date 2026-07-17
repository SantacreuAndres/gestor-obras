import { jsPDF } from 'jspdf'
import { fmtMoney, fmtDate } from './format'

const NOMBRE = 'Andrés Santacreu'
const ROL = 'Arquitecto'
const ALIAS = 'Santacreu.andres'

export interface ExportItem {
  fecha: string
  concepto: string
  monto: number
  /** Imagen del comprobante como data URL (data:image/...). */
  comprobanteDataUrl?: string
}

interface ExportOptions {
  /** Tipo de reporte, ej. "Viáticos" o "Gastos". */
  titulo: string
  /** Nombre de la obra. */
  obra?: string
  /** Comitente / cliente (opcional). */
  comitente?: string
  items: ExportItem[]
}

// -------- Layout constants (puntos PDF, A4)
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const USABLE_W = PAGE_W - MARGIN * 2

// Palette
const DARK: [number, number, number] = [31, 41, 55] // slate-800
const TEXT: [number, number, number] = [17, 24, 39] // gray-900
const MUTED: [number, number, number] = [107, 114, 128] // gray-500
const STRIPE: [number, number, number] = [243, 244, 246] // gray-100
const BORDER: [number, number, number] = [229, 231, 235] // gray-200

// -------- Helpers
function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = dataUrl
  })
}

function imageFormat(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

type SizedItem = ExportItem & {
  imgSize: { w: number; h: number } | null
  imgFormat: 'JPEG' | 'PNG' | 'WEBP' | null
}

async function resolveSizes(items: ExportItem[]): Promise<SizedItem[]> {
  return Promise.all(
    items.map(async (it) => {
      if (!it.comprobanteDataUrl) return { ...it, imgSize: null, imgFormat: null }
      try {
        const size = await imageSize(it.comprobanteDataUrl)
        return { ...it, imgSize: size, imgFormat: imageFormat(it.comprobanteDataUrl) }
      } catch {
        return { ...it, imgSize: null, imgFormat: null }
      }
    }),
  )
}

function setFill(doc: jsPDF, c: [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2])
}
function setDraw(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2])
}
function setText(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2])
}

/** Rectángulo redondeado de brand mark con las iniciales del usuario. */
function drawBrandMark(doc: jsPDF, x: number, y: number, size = 46) {
  setFill(doc, DARK)
  doc.roundedRect(x, y, size, size, 8, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  setText(doc, [255, 255, 255])
  // Iniciales
  const iniciales = NOMBRE.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')
  doc.text(iniciales || 'AS', x + size / 2, y + size / 2 + 6, { align: 'center' })
}

/** Cabecera fija abajo de cada página con datos de contacto. */
function drawPageFooter(doc: jsPDF, texto: string) {
  const y = PAGE_H - 30
  setDraw(doc, BORDER)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y - 14, PAGE_W - MARGIN, y - 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setText(doc, MUTED)
  doc.text(texto, MARGIN, y)
  doc.text(`Alias: ${ALIAS}`, PAGE_W - MARGIN, y, { align: 'right' })
}

/** Página 1: resumen tipo factura. */
function drawInvoicePage(
  doc: jsPDF,
  opts: ExportOptions,
  items: SizedItem[],
  total: number,
  hoyTxt: string,
  nroReporte: string,
) {
  // ----- Header
  drawBrandMark(doc, MARGIN, 44)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  setText(doc, TEXT)
  doc.text(opts.titulo.toUpperCase(), PAGE_W - MARGIN, 76, { align: 'right' })

  // ----- Meta grid
  let y = 130
  const colGap = 20
  const leftX = MARGIN
  const rightX = MARGIN + USABLE_W / 2 + colGap

  const labelFontSize = 8
  const valueFontSize = 12
  const rowGap = 40

  // Fila 1: REPORTADO POR / N° REPORTE + FECHA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(labelFontSize)
  setText(doc, MUTED)
  doc.text('REPORTADO POR', leftX, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(valueFontSize + 2)
  setText(doc, TEXT)
  doc.text(NOMBRE, leftX, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setText(doc, MUTED)
  doc.text(ROL, leftX, y + 30)

  // Columna derecha con dos pares clave:valor
  const rightLabelW = 92
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, MUTED)
  doc.text('N° Reporte', rightX, y)
  doc.text('Fecha', rightX, y + 16)
  doc.text('Alias', rightX, y + 32)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setText(doc, TEXT)
  doc.text(': ' + nroReporte, rightX + rightLabelW - 30, y)
  doc.text(': ' + hoyTxt, rightX + rightLabelW - 30, y + 16)
  doc.text(': ' + ALIAS, rightX + rightLabelW - 30, y + 32)

  y += rowGap + 22

  // Fila 2: OBRA + COMITENTE (si hay)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(labelFontSize)
  setText(doc, MUTED)
  doc.text('OBRA', leftX, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setText(doc, TEXT)
  doc.text(opts.obra || '—', leftX, y + 16)

  if (opts.comitente) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(labelFontSize)
    setText(doc, MUTED)
    doc.text('COMITENTE', rightX, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    setText(doc, TEXT)
    doc.text(opts.comitente, rightX, y + 16)
  }
  y += rowGap

  // ----- Tabla
  const tblX = MARGIN
  const tblW = USABLE_W
  const cw = [30, 90, tblW - 30 - 90 - 100, 100] // #, FECHA, DESCRIPCIÓN, MONTO
  const headerH = 30

  setFill(doc, DARK)
  doc.rect(tblX, y, tblW, headerH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setText(doc, [255, 255, 255])
  const headers = ['#', 'FECHA', 'DESCRIPCIÓN', 'MONTO']
  const aligns: ('left' | 'center' | 'right')[] = ['center', 'left', 'left', 'right']
  {
    let cx = tblX
    headers.forEach((h, i) => {
      const w = cw[i]
      const tx =
        aligns[i] === 'center'
          ? cx + w / 2
          : aligns[i] === 'right'
            ? cx + w - 12
            : cx + 12
      doc.text(h, tx, y + 20, { align: aligns[i] })
      cx += w
    })
  }
  y += headerH

  // ----- Rows
  const rowH = 30
  items.forEach((it, i) => {
    if (i % 2 === 0) {
      setFill(doc, STRIPE)
      doc.rect(tblX, y, tblW, rowH, 'F')
    }
    setText(doc, TEXT)
    let cx = tblX
    const values = [
      String(i + 1).padStart(2, '0'),
      fmtDate(it.fecha),
      it.concepto,
      fmtMoney(it.monto),
    ]
    values.forEach((v, j) => {
      const w = cw[j]
      const tx =
        aligns[j] === 'center'
          ? cx + w / 2
          : aligns[j] === 'right'
            ? cx + w - 12
            : cx + 12
      doc.setFont('helvetica', j === 3 ? 'bold' : 'normal')
      doc.setFontSize(11)
      // Truncar descripción si es muy larga
      if (j === 2) {
        const lines = doc.splitTextToSize(v, w - 24) as string[]
        doc.text(lines[0] + (lines.length > 1 ? '…' : ''), tx, y + 20, {
          align: aligns[j],
        })
      } else {
        doc.text(v, tx, y + 20, { align: aligns[j] })
      }
      cx += w
    })
    y += rowH
  })

  // ----- Fila TOTAL (destacada)
  const totalRowH = 36
  // Sub-total con separador
  y += 8
  const sumRowW = cw[2] + cw[3]
  const sumRowX = tblX + cw[0] + cw[1]
  setFill(doc, DARK)
  doc.rect(sumRowX, y, sumRowW, totalRowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setText(doc, [255, 255, 255])
  doc.text('TOTAL', sumRowX + 16, y + 24)
  doc.text(fmtMoney(total), tblX + tblW - 12, y + 24, { align: 'right' })
  y += totalRowH + 30

  // ----- Total a recuperar (highlight box a la izquierda)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, MUTED)
  doc.text('TOTAL A RECUPERAR', MARGIN, y)
  y += 26
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  setText(doc, TEXT)
  doc.text(fmtMoney(total), MARGIN, y)
  y += 8
  setDraw(doc, DARK)
  doc.setLineWidth(1.6)
  doc.line(MARGIN, y, MARGIN + 200, y)
  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, MUTED)
  doc.text('Alias para transferencia', MARGIN, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  setText(doc, TEXT)
  doc.text(ALIAS, MARGIN, y)

  // Footer de página
  drawPageFooter(
    doc,
    `${NOMBRE} · ${opts.titulo} · Generado el ${hoyTxt}`,
  )
}

/** Cabecera chica para páginas de comprobantes. */
function drawComprobantesHeader(
  doc: jsPDF,
  opts: ExportOptions,
): number {
  const y = 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, TEXT)
  doc.text('COMPROBANTES', MARGIN, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setText(doc, MUTED)
  const subtitle = `${NOMBRE}${opts.obra ? ' · ' + opts.obra : ''} · ${opts.titulo}`
  doc.text(subtitle, PAGE_W - MARGIN, y, { align: 'right' })

  setDraw(doc, BORDER)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y + 8, PAGE_W - MARGIN, y + 8)
  return y + 24
}

/** Dibuja un comprobante (label bar + screenshot) dentro de un "slot" de la página. */
function drawComprobanteSlot(
  doc: jsPDF,
  it: SizedItem,
  num: number,
  slotY: number,
  slotH: number,
) {
  const labelH = 26
  // Label bar
  setFill(doc, STRIPE)
  doc.rect(MARGIN, slotY, USABLE_W, labelH, 'F')
  setDraw(doc, BORDER)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, slotY + labelH, PAGE_W - MARGIN, slotY + labelH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, TEXT)
  const izq = `${String(num).padStart(2, '0')}   ${fmtDate(it.fecha)}`
  doc.text(izq, MARGIN + 12, slotY + 17)

  // Concepto (limitado al espacio disponible entre fecha y monto)
  const montoTxt = fmtMoney(it.monto)
  const montoW = doc.getTextWidth(montoTxt)
  const conceptoX = MARGIN + 12 + doc.getTextWidth(izq) + 18
  const conceptoMaxW = PAGE_W - MARGIN - 12 - montoW - 24 - conceptoX
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const conceptoLines = doc.splitTextToSize(it.concepto, conceptoMaxW) as string[]
  const conceptoLine =
    conceptoLines[0] + (conceptoLines.length > 1 ? '…' : '')
  doc.text(conceptoLine, conceptoX, slotY + 17)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, TEXT)
  doc.text(montoTxt, PAGE_W - MARGIN - 12, slotY + 17, { align: 'right' })

  // Image area
  const imgTop = slotY + labelH + 12
  const imgBottom = slotY + slotH - 4
  const imgAreaH = imgBottom - imgTop
  const imgAreaW = USABLE_W

  if (it.imgSize && it.comprobanteDataUrl && it.imgFormat) {
    const { w: nw, h: nh } = it.imgSize
    const aspect = nw / nh
    let imgW = imgAreaW
    let imgH = imgW / aspect
    if (imgH > imgAreaH) {
      imgH = imgAreaH
      imgW = imgH * aspect
    }
    const imgX = MARGIN + (imgAreaW - imgW) / 2
    const imgY = imgTop + (imgAreaH - imgH) / 2
    // Subtle border around the shot for framing
    setDraw(doc, BORDER)
    doc.setLineWidth(0.5)
    doc.rect(imgX - 2, imgY - 2, imgW + 4, imgH + 4)
    try {
      doc.addImage(
        it.comprobanteDataUrl,
        it.imgFormat,
        imgX,
        imgY,
        imgW,
        imgH,
        undefined,
        'FAST',
      )
    } catch {
      // ignore
    }
  } else {
    // Placeholder "sin comprobante"
    setDraw(doc, BORDER)
    doc.setLineWidth(0.5)
    setFill(doc, [250, 250, 250])
    doc.roundedRect(MARGIN, imgTop, imgAreaW, imgAreaH, 8, 8, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setText(doc, MUTED)
    doc.text(
      'Sin comprobante',
      MARGIN + imgAreaW / 2,
      imgTop + imgAreaH / 2,
      { align: 'center' },
    )
  }
}

/** Páginas 2+: comprobantes. 2 por hoja, cada uno con un slot amplio. */
function drawComprobantesPages(
  doc: jsPDF,
  opts: ExportOptions,
  items: SizedItem[],
  hoyTxt: string,
) {
  const perPage = 2
  const headerBottom = 74 // approx after drawComprobantesHeader
  const footerReserve = 40
  const availableH = PAGE_H - headerBottom - footerReserve
  const slotGap = 16
  const slotH = (availableH - slotGap) / perPage

  items.forEach((it, i) => {
    const posOnPage = i % perPage
    if (posOnPage === 0) {
      if (i > 0) doc.addPage()
      drawComprobantesHeader(doc, opts)
      drawPageFooter(
        doc,
        `${NOMBRE} · ${opts.titulo} · Generado el ${hoyTxt}`,
      )
    }
    const slotY = headerBottom + posOnPage * (slotH + slotGap)
    drawComprobanteSlot(doc, it, i + 1, slotY, slotH)
  })
}

/** Formato "VIA-YYYYMMDD-HHmm" para el número de reporte. */
function formatReportNumber(prefix: string, d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export async function exportarPdf(opts: ExportOptions): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const now = new Date()
  const hoyTxt = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)

  const prefix = opts.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase()
  const nroReporte = formatReportNumber(prefix, now)

  const items = await resolveSizes(opts.items)
  const total = items.reduce((acc, it) => acc + it.monto, 0)

  // Página 1: resumen
  drawInvoicePage(doc, opts, items, total, hoyTxt, nroReporte)

  // Páginas 2+: comprobantes (solo los que tienen foto)
  const withPhotos = items.filter((it) => it.imgSize && it.comprobanteDataUrl)
  if (withPhotos.length > 0) {
    doc.addPage()
    drawComprobantesPages(doc, opts, withPhotos, hoyTxt)
  }

  // -------- Salida
  const slug = opts.titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const filename = `${slug}-${now.toISOString().slice(0, 10)}.pdf`
  const blob = doc.output('blob') as Blob

  type NavigatorWithShare = Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  const nav = navigator as NavigatorWithShare
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({
        files: [file],
        title: opts.titulo,
        text: `${opts.titulo}${opts.obra ? ' — ' + opts.obra : ''}`,
      })
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
