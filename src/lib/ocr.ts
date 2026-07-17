/**
 * OCR on-device usando Tesseract.js. Se carga por dinamic import para NO inflar
 * el bundle inicial — el peso (el worker + traineddata en español) se paga la
 * primera vez que el usuario dispara una lectura de comprobante.
 *
 * El worker se cachea en memoria a nivel de módulo, así lecturas sucesivas son
 * mucho más rápidas: solo se paga la inicialización una vez por sesión.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let workerPromise: Promise<any> | null = null

async function getWorker() {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const { createWorker } = await import('tesseract.js')
    // 'spa' = español. Tesseract descarga el traineddata desde el CDN por
    // default y lo cachea en IndexedDB del navegador, así solo hace el fetch
    // la primera vez.
    return createWorker('spa')
  })()
  return workerPromise
}

/** Corre OCR sobre una imagen (File o Blob) y devuelve el texto plano. */
export async function runOcr(file: File | Blob): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(file)
  return data.text as string
}
