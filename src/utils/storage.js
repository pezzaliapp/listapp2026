/**
 * storage.js - Accumulate extracted products across multiple sessions.
 * Products are stored in localStorage keyed by PDF name.
 */

const KEY_PREFIX = 'listapp_products_';
const KEY_PAGES  = 'listapp_pages_';

function makeKey(pdfName) {
  return KEY_PREFIX + pdfName.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
}
function makePagesKey(pdfName) {
  return KEY_PAGES + pdfName.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
}

/** Load accumulated products for this PDF. Returns Map<code, product>. */
export function loadProducts(pdfName) {
  try {
    const raw = localStorage.getItem(makeKey(pdfName));
    if (!raw) return new Map();
    const arr = JSON.parse(raw);
    return new Map(arr.map(p => [p.code, p]));
  } catch { return new Map(); }
}

/** Save product map to localStorage. */
export function saveProducts(pdfName, productMap) {
  try {
    localStorage.setItem(makeKey(pdfName), JSON.stringify([...productMap.values()]));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

/** Track which page ranges have already been processed. */
export function loadProcessedPages(pdfName) {
  try {
    const raw = localStorage.getItem(makePagesKey(pdfName));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveProcessedPage(pdfName, pageNum) {
  try {
    const pages = loadProcessedPages(pdfName);
    if (!pages.includes(pageNum)) {
      pages.push(pageNum);
      localStorage.setItem(makePagesKey(pdfName), JSON.stringify(pages));
    }
  } catch {}
}

/** Clear all data for this PDF. */
export function clearProducts(pdfName) {
  localStorage.removeItem(makeKey(pdfName));
  localStorage.removeItem(makePagesKey(pdfName));
}

/** Get count of stored products. */
export function countProducts(pdfName) {
  return loadProducts(pdfName).size;
}
