import { useState, useCallback, useRef } from 'react';
import SetupView from './components/SetupView';
import ProcessingView from './components/ProcessingView';
import ResultsView from './components/ResultsView';
import { processPdf } from './utils/pdfProcessor';
import { loadProducts, saveProducts, saveProcessedPage, loadProcessedPages } from './utils/storage';

export default function App() {
  const [step,       setStep]       = useState('setup');
  const [products,   setProducts]   = useState([]);
  const [progress,   setProgress]   = useState({ current:0, total:0, phase:'scan', status:'' });
  const [error,      setError]      = useState('');
  const [pdfFile,    setPdfFile]    = useState(null);   // persists across steps
  const [apiKey,     setApiKey]     = useState(() => localStorage.getItem('gmn_key') || '');
  const [nPages,     setNPages]     = useState(null);
  const [donePgs,    setDonePgs]    = useState([]);

  // Refresh accumulated state from localStorage
  const refreshAccumulated = useCallback((file) => {
    const name = file?.name || pdfFile?.name;
    if (!name) return;
    const map  = loadProducts(name);
    const done = loadProcessedPages(name);
    setProducts([...map.values()]);
    setDonePgs(done);
  }, [pdfFile]);

  const handlePdfLoaded = useCallback((file, pages) => {
    setPdfFile(file);
    setNPages(pages);
    refreshAccumulated(file);
  }, [refreshAccumulated]);

  const handleProcess = useCallback(async (pageRange) => {
    if (!pdfFile || !apiKey) return;
    setStep('processing');
    setError('');

    try {
      const accumulated = loadProducts(pdfFile.name);

      await processPdf(
        pdfFile, apiKey, false,
        (prog) => {
          setProgress(prog);
          if (prog.savedCode && prog.savedProduct) {
            accumulated.set(prog.savedCode, prog.savedProduct);
            saveProducts(pdfFile.name, accumulated);
          }
          if (prog.pageProcessed) {
            saveProcessedPage(pdfFile.name, prog.pageProcessed);
          }
        },
        pageRange
      );

      saveProducts(pdfFile.name, accumulated);
      const done = loadProcessedPages(pdfFile.name);
      setProducts([...accumulated.values()]);
      setDonePgs(done);
      setStep('results');
    } catch (err) {
      setError(err.message || 'Errore durante l\'elaborazione.');
      setStep('setup');
    }
  }, [pdfFile, apiKey]);

  // From results → go back to setup to pick next batch (PDF stays loaded)
  const handleContinue = useCallback(() => {
    refreshAccumulated(pdfFile);
    setStep('setup');
  }, [pdfFile, refreshAccumulated]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-mark">&#9633;</span>
          <div className="logo-text">
            <span className="logo-name">ListApp 2026</span>
            <span className="logo-sub">PDF Listino &#8594; CSV / Excel</span>
          </div>
        </div>
        <span className="brand-tag">PezzaliApp</span>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner" role="alert">
            <span>&#9888;&#65039; {error}</span>
            <button className="btn-close" onClick={() => setError('')}>&#10005;</button>
          </div>
        )}
        {step === 'setup' && (
          <SetupView
            pdfFile={pdfFile}
            apiKey={apiKey}
            nPages={nPages}
            processedPages={donePgs}
            storedCount={products.length}
            onPdfLoaded={handlePdfLoaded}
            onApiKeyChange={(k) => { setApiKey(k); localStorage.setItem('gmn_key', k); }}
            onProcess={handleProcess}
          />
        )}
        {step === 'processing' && <ProcessingView progress={progress} />}
        {step === 'results' && (
          <ResultsView
            products={products}
            processedPages={donePgs}
            nPages={nPages}
            onContinue={handleContinue}
          />
        )}
      </main>

      <footer className="app-footer">
        ListApp 2026 &copy; PezzaliApp &mdash; Gemini Vision + PDF.js + ExcelJS
      </footer>
    </div>
  );
}
