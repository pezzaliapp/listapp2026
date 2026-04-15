import { useState, useRef, useEffect } from 'react';
import { loadProducts, clearProducts, countProducts, loadProcessedPages } from '../utils/storage';

const BATCH = 5; // pages per session (safe for free tier)

export default function SetupView({ onProcess }) {
  const [pdfFile,  setPdfFile]  = useState(null);
  const [apiKey,   setApiKey]   = useState(() => localStorage.getItem('gmn_key') || '');
  const [dragging, setDragging] = useState(false);
  const [nPages,   setNPages]   = useState(null);
  const [rangeFrom,setFrom]     = useState(1);
  const [rangeTo,  setTo]       = useState(BATCH);
  const [stored,   setStored]   = useState(0);
  const [processedPages, setProcessedPages] = useState([]);
  const pdfRef = useRef();

  // When PDF changes, count pages and load stored state
  useEffect(() => {
    if (!pdfFile) { setNPages(null); setStored(0); return; }
    (async () => {
      const { getDocument } = await import('pdfjs-dist');
      const buf = await pdfFile.arrayBuffer();
      const pdf = await getDocument({ data: buf }).promise;
      const n   = pdf.numPages;
      setNPages(n);
      setFrom(1);
      setTo(Math.min(BATCH, n));
      const cnt  = countProducts(pdfFile.name);
      const done = loadProcessedPages(pdfFile.name);
      setStored(cnt);
      setProcessedPages(done);
    })();
  }, [pdfFile]);

  const handleKey = e => {
    setApiKey(e.target.value);
    localStorage.setItem('gmn_key', e.target.value);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') setPdfFile(f);
  };

  const handleClear = () => {
    if (pdfFile) { clearProducts(pdfFile.name); setStored(0); setProcessedPages([]); }
  };

  // Suggest next unprocessed batch
  const suggestNext = () => {
    if (!nPages) return;
    // Find first page not yet processed
    let start = 1;
    while (processedPages.includes(start) && start <= nPages) start++;
    const end = Math.min(start + BATCH - 1, nPages);
    setFrom(start);
    setTo(end);
  };

  const canGo = pdfFile && apiKey.trim().length > 10 && nPages;
  const allDone = nPages && processedPages.length >= nPages;

  return (
    <div className="setup-view">

      {/* Hero */}
      <div className="hero-box">
        <h2>Estrai dati dal listino PDF</h2>
        <p>
          Carica il listino Cormach in PDF. L&apos;app lo analizza con Gemini Vision
          e crea un <strong>CSV con Codice, Descrizione e Prezzo Lordo</strong>.
          Elabora in batch da {BATCH} pagine per non saturare le API.
        </p>
      </div>

      {/* PDF drop */}
      <div
        className={`drop-zone big-drop ${dragging ? 'dragging' : ''} ${pdfFile ? 'has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => pdfRef.current.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && pdfRef.current.click()}
      >
        <input ref={pdfRef} type="file" accept="application/pdf"
          style={{ display: 'none' }} onChange={e => setPdfFile(e.target.files[0] || null)} />
        {pdfFile ? (
          <div className="drop-ok">
            <span className="drop-ok-icon">&#128196;</span>
            <div>
              <strong>{pdfFile.name}</strong>
              <span className="drop-meta">
                {(pdfFile.size/1024/1024).toFixed(1)} MB
                {nPages ? ` \u2014 ${nPages} pagine totali` : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="drop-empty">
            <span className="drop-big-icon">&#128196;</span>
            <strong>Trascina il PDF qui</strong>
            <span className="hint">oppure clicca per selezionarlo</span>
          </div>
        )}
      </div>

      {/* Accumulated results banner */}
      {stored > 0 && (
        <div className="stored-banner">
          <div>
            <strong>&#128190; {stored} prodotti gi&#224; estratti</strong>
            <span className="hint">
              &nbsp;(pagine elaborate: {processedPages.sort((a,b)=>a-b).join(', ')})
            </span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-ghost" onClick={handleClear}>
              &#128465; Azzera
            </button>
          </div>
        </div>
      )}

      {/* Page range selector */}
      {nPages && (
        <div className="upload-card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h3>Pagine da elaborare</h3>
            {!allDone && processedPages.length > 0 && (
              <button className="btn-ghost" onClick={suggestNext}>
                &#8594; Prossimo batch
              </button>
            )}
          </div>

          {allDone ? (
            <p className="hint" style={{ color:'var(--accent)' }}>
              &#10003; Tutte le {nPages} pagine sono state elaborate.
            </p>
          ) : (
            <>
              <div className="range-row">
                <label>Da pagina</label>
                <input type="number" className="range-input" min={1} max={nPages}
                  value={rangeFrom}
                  onChange={e => setFrom(Math.max(1, Math.min(nPages, +e.target.value)))} />
                <label>a pagina</label>
                <input type="number" className="range-input" min={1} max={nPages}
                  value={rangeTo}
                  onChange={e => setTo(Math.max(rangeFrom, Math.min(nPages, +e.target.value)))} />
                <span className="range-count">
                  ({rangeTo - rangeFrom + 1} pag. &asymp; {Math.ceil((rangeTo - rangeFrom + 1) * 4.5 / 60)} min)
                </span>
              </div>

              {/* Visual page grid */}
              <div className="page-grid">
                {Array.from({ length: nPages }, (_, i) => i + 1).map(p => {
                  const isDone    = processedPages.includes(p);
                  const isInRange = p >= rangeFrom && p <= rangeTo;
                  return (
                    <div key={p}
                      className={`page-dot ${isDone ? 'done' : ''} ${isInRange ? 'selected' : ''}`}
                      title={`Pag. ${p}${isDone ? ' (elaborata)' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="page-legend">
                <span className="dot done" /> elaborata &nbsp;
                <span className="dot selected" /> selezionata &nbsp;
                <span className="dot" /> da fare
              </div>
            </>
          )}
        </div>
      )}

      {/* API Key */}
      <div className="upload-card">
        <h3>Chiave API Google (Gemini)</h3>
        <p className="hint" style={{ marginBottom:8 }}>
          Gratis su{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank"
            rel="noopener noreferrer" className="link">aistudio.google.com</a>.
          Salvata solo nel browser.
        </p>
        <input type="password" className="api-input" value={apiKey}
          onChange={handleKey} placeholder="AIza..." spellCheck={false} />
      </div>

      <button
        className="btn-primary btn-go"
        disabled={!canGo || allDone}
        onClick={() => onProcess(pdfFile, apiKey.trim(), { from: rangeFrom, to: rangeTo })}
      >
        {allDone
          ? '&#10003; Elaborazione completa \u2014 scarica il CSV dai risultati'
          : `&#128269; Analizza pagine ${rangeFrom}\u2013${rangeTo}`}
      </button>
    </div>
  );
}
