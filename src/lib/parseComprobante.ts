/**
 * Parser de texto crudo de OCR sobre comprobantes de pago argentinos
 * (transferencias bancarias, Mercado Pago, Naranja, tarjetas, etc.).
 *
 * Es best-effort a base de regex. Si no matchea algún campo, devuelve
 * undefined y la UI simplemente no toca ese input.
 */

export interface ParsedComprobante {
  /** ISO date YYYY-MM-DD, si se detectó. */
  fecha?: string
  /** Monto en pesos (número decimal). */
  monto?: number
  /** Concepto sugerido: nombre del beneficiario / comercio / motivo. */
  concepto?: string
  /** N° de operación / referencia de la transacción. */
  referencia?: string
}

// ---------- Helpers

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** Parsea "25.000,50" (AR) → 25000.5. También soporta "25,000.50" (US)
 *  como fallback si detecta el patrón alternativo. */
function parseMontoAr(raw: string): number | undefined {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return undefined
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    // El separador decimal es el que aparece más a la derecha.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato AR: 25.000,50
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato US: 25,000.50
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Solo coma: si tiene 3 dígitos después es separador de miles ("25,000"),
    // si tiene 1-2 dígitos es decimal ("25,50").
    const parts = s.split(',')
    if (parts[parts.length - 1].length === 3) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  }
  // Con solo puntos, asumimos separador de miles: "25.000"
  else if (hasDot) {
    const parts = s.split('.')
    if (parts[parts.length - 1].length === 3) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return isFinite(n) ? n : undefined
}

// ---------- Extractores

function extraerFecha(text: string): string | undefined {
  // Formato numérico: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY
  const num = text.match(
    /\b(0?[1-9]|[12]\d|3[01])[\/\-.](0?[1-9]|1[0-2])[\/\-.](20\d{2}|\d{2})\b/,
  )
  if (num) {
    const d = parseInt(num[1], 10)
    const m = parseInt(num[2], 10)
    let y = parseInt(num[3], 10)
    if (y < 100) y += 2000
    return `${y}-${pad2(m)}-${pad2(d)}`
  }

  // Formato "17 jul 2026" / "17 de julio de 2026"
  const abbr = text.match(
    /\b(0?[1-9]|[12]\d|3[01])\s*(?:de\s+)?([a-záéíóú]{3,10})\.?(?:\s+de)?\s*(20\d{2})?\b/i,
  )
  if (abbr) {
    const d = parseInt(abbr[1], 10)
    const key = abbr[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    const m = MESES[key] ?? MESES[key.slice(0, 3)]
    if (m) {
      const y = abbr[3] ? parseInt(abbr[3], 10) : new Date().getFullYear()
      return `${y}-${pad2(m)}-${pad2(d)}`
    }
  }
  return undefined
}

function extraerMonto(text: string): number | undefined {
  // Prioridad 1: línea "Importe" / "Total" / "Monto" seguida del valor.
  const conLabel = text.match(
    /(?:importe|monto|total(?:\s+a\s+pagar)?|valor)\s*:?\s*\$?\s*([\d.,]+)/i,
  )
  if (conLabel) {
    const v = parseMontoAr(conLabel[1])
    if (v && v > 0) return v
  }

  // Prioridad 2: valor precedido por $. Nos quedamos con el mayor porque
  // suele ser el importe principal (los otros $ son de comisión, saldo, etc.).
  const candidatos = [...text.matchAll(/\$\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g)]
  let max = 0
  for (const m of candidatos) {
    const v = parseMontoAr(m[1])
    if (v && v > max) max = v
  }
  if (max > 0) return max

  return undefined
}

function extraerReferencia(text: string): string | undefined {
  const m = text.match(
    /(?:N[°ºo]\.?\s*(?:de\s+)?(?:operaci[oó]n|referencia|transacci[oó]n|ticket|comprobante|transferencia)|Ref(?:erencia)?\.?|Operaci[oó]n\.?)\s*:?\s*([A-Z0-9\-]{6,})/i,
  )
  return m?.[1]
}

function extraerConcepto(text: string): string | undefined {
  // Beneficiario / destinatario / comercio: nombre después del label.
  const labels = [
    'Para',
    'Beneficiario',
    'Destinatario',
    'Nombre del titular',
    'Titular',
    'Comercio',
    'Concepto',
    'Motivo',
    'Descripci[oó]n',
    'Enviado a',
    'Pagado a',
  ]
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n]+)`, 'i')
    const m = text.match(re)
    if (m) {
      const val = m[1].trim()
      // Descartar labels muy cortos o basura obvia
      if (val.length >= 3 && val.length <= 80) {
        return val.replace(/\s+/g, ' ')
      }
    }
  }
  return undefined
}

// ---------- Entry point

export function parseComprobante(rawText: string): ParsedComprobante {
  // Normalizamos: colapsamos espacios múltiples pero preservamos saltos de
  // línea (los usa el extractor de concepto para no cruzar renglones).
  const text = rawText.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n')

  return {
    fecha: extraerFecha(text),
    monto: extraerMonto(text),
    concepto: extraerConcepto(text),
    referencia: extraerReferencia(text),
  }
}
