import { useRef, useEffect, useState } from 'react';
import { clearProducts } from '../utils/storage';

const BATCH = 5;

export default function SetupView({
  pdfFile, apiKey, nPages, processedPages, storedCount,
  onPdfLoaded, onApiKeyChange, onProcess
}) {
  const [dragging,  setDragging]  = useState(false);
  const [rangeFrom, setFrom]      = useState(1);
  const [rangeTo,   setTo]        = useState(BATCH);
  const pdfRef = useRef();

  // When nPages changes, suggest next unprocessed batch
  useEffect(() => {
    if (!nPages) return;
    suggestNext();
  }, [nPages, processedPages.length]);

  const suggestNext = () => {
    if (!nPages) return;
    let start = 1;
    while (processedPages.includes(start) && start <= nPages) start++;
    if (start > nPages) return; // all done
    const end = Math.min(start + BATCH - 1, nPages);
    setFrom(start);
    setTo(end);
  };

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return;
    const { getDocument } = await import('pdfjs-dist');
    const buf = await file.arrayBuffer();
    const pdf = await getDocument({ data: buf }).promise;
    onPdfLoaded(file, pdf.numPages);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const allDone = nPages && processedPages.length >= nPages;
  const canGo   = pdfFile && apiKey.trim().length > 10 && nPages && !allDone;
  const pagesInBatch = rangeTo - rangeFrom + 1;

  return (
    <div className="setup-view">

      {/* Hero */}
      <div className="hero-box">
        <h2>Estrai dati dal listino PDF</h2>
        <p>
          Carica il PDF, seleziona le pagine da elaborare (es. 5 alla volta)
          e ripeti fino a completare il listino. I risultati si accumulano
          e puoi scaricare il CSV in qualsiasi momento.
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
          style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
        {pdfFile ? (
          <div className="drop-ok">
            <span className="drop-ok-icon">&#128196;</span>
            <div>
              <strong>{pdfFile.name}</strong>
              <span className="drop-meta">
                {(pdfFile.size/1024/1024).toFixed(1)} MB
                {nPages ? ` — ${nPages} pagine` : ''}
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

      {/* Accumulated progress */}
      {storedCount > 0 && pdfFile && (
        <div className="stored-banner">
          <div>
            <strong>&#128190; {storedCount} prodotti gi&agrave; estratti</strong>
            <span className="hint">
              &nbsp;&mdash; pagine elaborate: {[...processedPages].sort((a,b)=>a-b).slice(0,20).join(', ')}
              {processedPages.length > 20 ? '...' : ''}
            </span>
          </div>
          <button className="btn-ghost" style={{color:'#e17055',borderColor:'#e17055'}}
            onClick={() => { clearProducts(pdfFile.name); onPdfLoaded(pdfFile, nPages); }}>
            &#128465; Azzera
          </button>
        </div>
      )}

      {/* Page range */}
      {nPages && (
        <div className="upload-card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h3>Pagine da elaborare ora</h3>
            {!allDone && (
              <button className="btn-ghost" onClick={suggestNext}>
                &#8594; Prossimo batch
              </button>
            )}
          </div>

          {allDone ? (
            <p style={{ color:'var(--accent)', fontSize:13 }}>
              &#10003; Tutte le {nPages} pagine sono state elaborate. Vai ai risultati per scaricare il CSV.
            </p>
          ) : (
            <>
              <div className="range-row">
                <label>Da</label>
                <input type="number" className="range-input" min={1} max={nPages}
                  value={rangeFrom} onChange={e => setFrom(Math.max(1,Math.min(nPages,+e.target.value)))} />
                <label>a</label>
                <input type="number" className="range-input" min={1} max={nPages}
                  value={rangeTo} onChange={e => setTo(Math.max(rangeFrom,Math.min(nPages,+e.target.value)))} />
                <span className="range-count">
                  {pagesInBatch} pag. &asymp; {Math.ceil(pagesInBatch * 4.5 / 60)} min
                </span>
              </div>
              <div className="page-grid">
                {Array.from({length: nPages}, (_,i) => i+1).map(p => (
                  <div key={p}
                    className={`page-dot${processedPages.includes(p)?' done':''}${(p>=rangeFrom&&p<=rangeTo)?' selected':''}`}
                    title={`Pag. ${p}${processedPages.includes(p)?' ✓':''}`}
                  />
                ))}
              </div>
              <div className="page-legend">
                <span className="dot done"/> elaborate &nbsp;
                <span className="dot selected"/> selezionate &nbsp;
                <span className="dot"/> da fare
              </div>
            </>
          )}
        </div>
      )}

      {/* API Key */}
      <div className="upload-card">
        <h3>Chiave API Google (Gemini)</h3>
        <p className="hint" style={{marginBottom:8}}>
          Gratuita su{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank"
            rel="noopener noreferrer" className="link">aistudio.google.com</a>.
          Salvata solo nel browser.
        </p>
        <input type="password" className="api-input" value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)} placeholder="AIza..." spellCheck={false} />
      </div>

      <button
        className="btn-primary btn-go"
        disabled={!canGo}
        onClick={() => onProcess({ from: rangeFrom, to: rangeTo })}
      >
        &#128269; Analizza pagine {rangeFrom}&ndash;{rangeTo}
      </button>
    </div>
  );
}
