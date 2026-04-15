/**
 * pdfProcessor.js
 *
 * Flusso:
 *   PDF → PDF.js identifica le pagine prodotto
 *       → ogni pagina renderizzata come JPEG
 *       → Gemini Vision estrae [{code, description, price}]
 *       → (opzionale) crop immagine prodotto 192×192
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const RENDER_SCALE = 0.7; // 417px wide - low token cost, full page visible
const JPEG_QUALITY   = 0.70;
const YIELD_EVERY  = 5;
const API_DELAY    = 4200; // ms — free tier: 15 req/min = 4s min between calls

const yieldToMain = () => new Promise(r => setTimeout(r, 0));
const sleep       = ms => new Promise(r => setTimeout(r, ms));

// ─── PDF rendering ───────────────────────────────────────────────────────────

async function renderPage(page) {
  const vp     = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width  = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  return canvas;
}

function toJpegBase64(canvas, q = 0.70) {
  return canvas.toDataURL('image/jpeg', q).split(',')[1];
}

/** Send full page to Gemini at low resolution. Full context = better extraction. */
function cropRightForVision(canvas, q = 0.65) {
  // Send full page - model name headers are top-left, codes+prices bottom-right
  // At RENDER_SCALE=0.7, canvas is ~417×590px = ~300KB JPEG = ~600 tokens
  return canvas.toDataURL('image/jpeg', q).split(',')[1];
}

function cropProductImage(canvas, size = 192) {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const sx = 0, sy = Math.floor(canvas.height * 0.07);
  const sw = Math.floor(canvas.width * 0.48);
  const sh = Math.floor(canvas.height * 0.63);
  const sc = Math.min(size / sw, size / sh);
  ctx.drawImage(canvas, sx, sy, sw, sh,
    (size - sw * sc) / 2, (size - sh * sc) / 2, sw * sc, sh * sc);
  return out.toDataURL('image/png').split(',')[1];
}

// ─── Pre-filtro: pagine con prodotti ─────────────────────────────────────────

async function getPageText(page) {
  const c = await page.getTextContent();
  return c.items.map(i => i.str).join(' ');
}

const HAS_CODE  = /\b\d{8}\b/;
const HAS_PRICE = /\d{1,3}(?:\.\d{3})*,\d{2}/; // no € required - PDF.js may not extract it

// ─── Gemini Vision API ────────────────────────────────────────────────────────

const GEMINI_PROMPT = `Sei un assistente preciso che estrae dati da listini prezzi Cormach (attrezzatura per officine: equilibratrici, smontagomme, sollevatori, assetti).

COMPITO: Trova TUTTI i prodotti in questa pagina con codice articolo E prezzo visibili.

Un prodotto ha:
- Codice: numero esatto a 8 cifre (es: 01100313, 00100208, 20100376)
- Prezzo: importo in euro (es: 9.500,00 € → 9500)
- Descrizione: nome del modello

OUTPUT: Solo JSON array, nessun testo, nessun markdown:
[{"code":"01100313","description":"Touch MEC 2000S","price":9500}, ...]

REGOLE DESCRIZIONE:
- Usa il nome del modello come intestazione di pagina (es "TOUCH mec 2000S", "CM 1200BB", "F 536S")
- Aggiungi le varianti: "con NLS", "LIFT", "con Sollevatore", "SONAR", "GT", "con Laser", ecc.
- NON includere: tensione (230V/400V), fase (1ph/3ph), frequenza (Hz/50Hz/60Hz)
- Se un codice ha più varianti nella stessa pagina, includi TUTTE con descrizioni distinte

REGOLE CODICE:
- Solo numeri, esattamente 8 cifre
- Ignorare codici di accessori standard in piccolo (foto accessori)

REGOLE PREZZO:
- Converti in intero: "9.500,00 €" → 9500, "22.950,00 €" → 22950
- Ignorare prezzi senza codice associato

Se nessun prodotto con codice+prezzo: []`;

/**
 * Singola chiamata Gemini Vision.
 */
async function geminiCall(base64Jpeg, apiKey, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
        { text: GEMINI_PROMPT }
      ]
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (resp.status === 429) throw Object.assign(new Error('rate_limit'), { is429: true });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Gemini ${resp.status}: ${err.error?.message || resp.statusText}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';

  try {
    const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const arr   = JSON.parse(clean);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(p => p.code && /^\d{8}$/.test(String(p.code)) && Number(p.price) > 0)
      .map(p => ({
        code:        String(p.code).trim(),
        description: String(p.description || '').trim(),
        price:       Math.round(Number(p.price))
      }));
  } catch {
    return [];
  }
}

/**
 * Retry automatico su 429 con backoff esponenziale.
 * Piano gratuito Gemini: 15 req/min → delay minimo 4s tra chiamate.
 * Su 429: aspetta 10s, 20s, 40s prima di riprovare.
 */
async function geminiExtract(base64Jpeg, apiKey, modelName) {
  const BACKOFF = [10000, 20000, 40000]; // ms di attesa dopo 429
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    try {
      return await geminiCall(base64Jpeg, apiKey, modelName);
    } catch (err) {
      if (err.is429 && attempt < BACKOFF.length) {
        console.warn(`Rate limit (429) — attendo ${BACKOFF[attempt]/1000}s...`);
        await sleep(BACKOFF[attempt]);
        continue;
      }
      throw err;
    }
  }
  return [];
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * @param {File}     pdfFile
 * @param {string}   geminiKey   - chiave API Google AI Studio
 * @param {boolean}  withImages  - se true, ritaglia immagini prodotto
 * @param {Function} onProgress
 * @returns {Promise<Array<{code,description,price,transport,installation,imageBase64}>>}
 */
/**
 * @param {File}     pdfFile
 * @param {string}   geminiKey
 * @param {boolean}  withImages
 * @param {Function} onProgress
 * @param {{from:number,to:number}|null} pageRange  - null = all pages
 */
export async function processPdf(pdfFile, geminiKey, withImages, onProgress, pageRange = null) {
  const MODEL = 'gemini-2.5-flash-lite';

  const buffer = await pdfFile.arrayBuffer();
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
  const nPages = pdf.numPages;

  const rangeFrom = pageRange ? Math.max(1, pageRange.from) : 1;
  const rangeTo   = pageRange ? Math.min(nPages, pageRange.to) : nPages;

  // ── Fase 1: identifica pagine con prodotti nel range selezionato ──
  onProgress({ current: 0, total: rangeTo - rangeFrom + 1, phase: 'scan',
    status: `Scansione pagine ${rangeFrom}–${rangeTo}...` });

  const productPages = [];
  for (let p = rangeFrom; p <= rangeTo; p++) {
    if (p % YIELD_EVERY === 0) await yieldToMain();
    const page = await pdf.getPage(p);
    const text = await getPageText(page);
    if (HAS_CODE.test(text) && HAS_PRICE.test(text)) productPages.push(p);
  }

  // ── Fase 2: Gemini Vision per ogni pagina ──
  const allProducts = new Map(); // code → product (first occurrence wins)
  const imageMap    = new Map(); // code → imageBase64
  const total       = productPages.length;
  let   done        = 0;

  for (const pageNum of productPages) {
    done++;
    onProgress({
      current: done, total,
      phase:   'vision',
      status:  `Analisi pagina ${pageNum} (${done}/${total})...`
    });

    await yieldToMain();

    try {
      const page   = await pdf.getPage(pageNum);
      const canvas = await renderPage(page);
      const jpeg   = cropRightForVision(canvas); // right side only = fewer tokens

      const products = await geminiExtract(jpeg, geminiKey, MODEL);

      for (const p of products) {
        if (!allProducts.has(p.code)) {
          allProducts.set(p.code, p);
          if (withImages) imageMap.set(p.code, cropProductImage(canvas));
          // Emit per-product event for live localStorage saving
          onProgress({
            current: done, total, phase: 'vision',
            status: `Pagina ${pageNum}: trovato ${p.code}`,
            savedCode: p.code, savedProduct: p
          });
        }
      }
      // Emit page-complete event for tracking processed pages
      onProgress({
        current: done, total, phase: 'vision',
        status: `Pagina ${pageNum} completata (${products.length} prodotti)`,
        pageProcessed: pageNum
      });

      // Libera memoria canvas
      canvas.width = canvas.height = 0;
      page.cleanup();

      if (done < total) await sleep(API_DELAY);
    } catch (err) {
      const msg = err.message || String(err);
      console.warn(`Pag. ${pageNum}:`, msg);

      // Detect daily quota exhaustion → stop processing early and return what we have
      const isQuotaExhausted = /quota|exceeded|RESOURCE_EXHAUSTED|429/i.test(msg);
      onProgress({
        current: done, total,
        phase: 'vision',
        status: isQuotaExhausted
          ? `Quota Gemini esaurita alla pag. ${pageNum}. Restituisco ${allProducts.size} prodotti estratti.`
          : `Pag. ${pageNum} saltata: ${msg.slice(0, 50)}`,
        error: isQuotaExhausted ? 'quota' : msg
      });

      if (isQuotaExhausted) break; // stop early, don't waste retries
      await sleep(1000);
    }
  }

  // ── Assembla risultato ──
  return [...allProducts.values()].map(p => ({
    code:        p.code,
    description: p.description,
    price:       p.price,
    transport:   '',
    installation: '',
    imageBase64: imageMap.get(p.code) ?? null
  }));
}
