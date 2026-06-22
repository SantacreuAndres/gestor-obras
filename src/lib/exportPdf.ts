import { jsPDF } from 'jspdf'
import { fmtMoney, fmtDate } from './format'

const ALIAS = 'Santacreu.andres'

export interface ExportItem {
  fecha: string
  concepto: string
  monto: number
  /** Imagen del comprobante como data URL (data:image/...). Si está presente,
   *  se embebe en el PDF debajo del row del item. */
  comprobanteDataUrl?: string
}

interface ExportOptions {
  /** Título grande arriba del PDF, ej. "Viáticos" o "Gastos". */
  titulo: string
  /** Subtítulo (típicamente el nombre de la obra). */
  obra?: string
  items: ExportItem[]
}

const PAGE = { w: 595.28, h: 841.89 }
const MARGIN_X = 40
const MARGIN_BOTTOM = 60
const USABLE_W = PAGE.w - MARGIN_X * 2

/** Devuelve el ancho/alto natural de una imagen dataURL. */
function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = dataUrl
  })
}

/** Detecta el tipo de imagen desde el data URL para pasárselo a jsPDF. */
function imageFormat(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

/** Genera el PDF y dispara la descarga / share sheet del sistema. */
export async function exportarPdf(opts: ExportOptions): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 56

  // ---- Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(20)
  doc.text(opts.titulo, MARGIN_X, y)
  y += 24

  if (opts.obra) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.setTextColor(90)
    doc.text(opts.obra, MARGIN_X, y)
    y += 16
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(140)
  const hoy = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
  doc.text(`Exportado el ${hoy}`, MARGIN_X, y)
  y += 18

  doc.setDrawColor(220)
  doc.setLineWidth(0.5)
  doc.line(MARGIN_X, y, PAGE.w - MARGIN_X, y)
  y += 18

  // ---- Items
  let total = 0
  const rightX = PAGE.w - MARGIN_X

  for (const it of opts.items) {
    total += it.monto

    // Resolve image size & format up front so we can decide if the whole
    // block (header + image) fits in the current page.
    let imgW = 0
    let imgH = 0
    let fmt: 'JPEG' | 'PNG' | 'WEBP' = 'JPEG'
    if (it.comprobanteDataUrl) {
      try {
        const { w, h } = await imageSize(it.comprobanteDataUrl)
        const maxW = Math.min(USABLE_W, 420)
        const maxH = 360
        const aspect = w / h
        imgW = maxW
        imgH = imgW / aspect
        if (imgH > maxH) {
          imgH = maxH
          imgW = imgH * aspect
        }
        fmt = imageFormat(it.comprobanteDataUrl)
      } catch {
        // Si una imagen falla en cargar, seguimos sin ella.
        imgW = 0
        imgH = 0
      }
    }

    const headerRowH = 18
    const blockH = headerRowH + (imgH > 0 ? imgH + 14 : 0) + 14
    if (y + blockH > PAGE.h - MARGIN_BOTTOM) {
      doc.addPage()
      y = 56
    }

    // Item header: "DD/MM/YYYY · Concepto                    $ Monto"
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30)
    const fechaTxt = fmtDate(it.fecha)
    doc.text(fechaTxt, MARGIN_X, y)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60)
    const fechaW = doc.getTextWidth(fechaTxt + '   ')
    const conceptoX = MARGIN_X + fechaW
    const montoTxt = fmtMoney(it.monto)
    const montoW = doc.getTextWidth(montoTxt)
    const conceptoMax = rightX - conceptoX - montoW - 12
    const conceptoLines = doc.splitTextToSize(
      it.concepto,
      conceptoMax,
    ) as string[]
    doc.text(conceptoLines, conceptoX, y)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20)
    doc.text(montoTxt, rightX, y, { align: 'right' })
    y += Math.max(headerRowH, conceptoLines.length * 14)

    if (imgH > 0 && it.comprobanteDataUrl) {
      try {
        doc.addImage(
          it.comprobanteDataUrl,
          fmt,
          MARGIN_X,
          y,
          imgW,
          imgH,
          undefined,
          'FAST',
        )
        y += imgH + 14
      } catch {
        // Si jsPDF no acepta el formato, lo salteamos.
      }
    }

    // Soft separator between items
    doc.setDrawColor(235)
    doc.line(MARGIN_X, y, rightX, y)
    y += 14
  }

  // ---- Total + alias (en página propia si no entra)
  const footerH = 90
  if (y + footerH > PAGE.h - MARGIN_BOTTOM) {
    doc.addPage()
    y = 56
  }

  doc.setDrawColor(160)
  doc.setLineWidth(0.8)
  doc.line(MARGIN_X, y, rightX, y)
  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(15)
  doc.text('Total', MARGIN_X, y)
  doc.text(fmtMoney(total), rightX, y, { align: 'right' })
  y += 32

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('Alias para transferencia:', MARGIN_X, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(25)
  doc.text(ALIAS, MARGIN_X, y)

  // ---- Salida
  const slug = opts.titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.pdf`
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
