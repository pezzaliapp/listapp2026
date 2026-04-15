import { useState, useCallback } from 'react';
import SetupView from './components/SetupView';
import ProcessingView from './components/ProcessingView';
import ResultsView from './components/ResultsView';
import { processPdf } from './utils/pdfProcessor';
import { loadProducts, saveProducts, saveProcessedPage } from './utils/storage';

export default function App() {
  const [step,     setStep]     = useState('setup');
  const [products, setProducts] = useState([]);
  const [progress, setProgress] = useState({ current:0, total:0, phase:'scan', status:'' });
  const [error,    setError]    = useState('');
  const [pdfName,  setPdfName]  = useState('');

  const handleProcess = useCallback(async (pdfFile, apiKey, pageRange) => {
    setStep('processing');
    setError('');
    setPdfName(pdfFile.name);

    try {
      // Load previously accumulated products
      const accumulated = loadProducts(pdfFile.name);

      const newProducts = await processPdf(
        pdfFile, apiKey, false, // no images in vision mode
        (prog) => {
          setProgress(prog);
          // Save each page result as it comes in
          if (prog.savedCode) {
            accumulated.set(prog.savedCode, prog.savedProduct);
            saveProducts(pdfFile.name, accumulated);
          }
          if (prog.pageProcessed) {
            saveProcessedPage(pdfFile.name, prog.pageProcessed);
          }
        },
        pageRange
      );

      // Merge new results into accumulated
      for (const p of newProducts) {
        if (!accumulated.has(p.code)) accumulated.set(p.code, p);
      }
      saveProducts(pdfFile.name, accumulated);

      // Show ALL accumulated products (past + current batch)
      setProducts([...accumulated.values()]);
      setStep('results');
    } catch (err) {
      setError(err.message || 'Errore durante l\'elaborazione.');
      setStep('setup');
    }
  }, []);

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
        {step === 'setup'      && <SetupView      onProcess={handleProcess} />}
        {step === 'processing' && <ProcessingView progress={progress} />}
        {step === 'results'    && (
          <ResultsView
            products={products}
            pdfName={pdfName}
            onBack={() => setStep('setup')}
          />
        )}
      </main>

      <footer className="app-footer">
        ListApp 2026 &copy; PezzaliApp &mdash; Gemini Vision + PDF.js + ExcelJS
      </footer>
    </div>
  );
}
