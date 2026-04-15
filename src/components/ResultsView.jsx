import { useState, useMemo } from 'react';
import { exportToExcel, exportToCsv } from '../utils/excelExporter';

export default function ResultsView({ products, processedPages, nPages, onContinue }) {
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState('code');
  const [sortDir,   setSortDir]   = useState('asc');

  const allDone = nPages && processedPages.length >= nPages;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = products.filter(p =>
      p.code.includes(q) || (p.description||'').toLowerCase().includes(q)
    );
    return list.sort((a, b) => {
      const va = sortField === 'price' ? Number(a[sortField]) : String(a[sortField]||'').toLowerCase();
      const vb = sortField === 'price' ? Number(b[sortField]) : String(b[sortField]||'').toLowerCase();
      return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [products, search, sortField, sortDir]);

  const handleExcel = async () => {
    setExporting(true);
    try { await exportToExcel(products); }
    catch (e) { alert('Errore Excel: ' + e.message); }
    finally { setExporting(false); }
  };

  const SortIcon = ({ f }) => sortField !== f
    ? <span className="sort-icon neutral">&#8597;</span>
    : <span className="sort-icon active">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const handleSort = f => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  return (
    <div className="results-view">

      {/* Progress strip */}
      {nPages && (
        <div className={`results-progress-bar ${allDone ? 'all-done' : ''}`}>
          <span>
            {allDone
              ? `✅ Tutte le ${nPages} pagine elaborate — ${products.length} prodotti totali`
              : `📄 ${processedPages.length} / ${nPages} pagine elaborate — ${products.length} prodotti`}
          </span>
          {!allDone && (
            <button className="btn-ghost" onClick={onContinue}>
              &#8594; Continua con le prossime pagine
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="results-topbar">
        <div className="results-stats">
          <span className="badge">{products.length} prodotti</span>
        </div>
        <div className="results-actions">
          <input className="search-input" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="&#128269; Cerca codice o descrizione..." />
          {!allDone && (
            <button className="btn-ghost" onClick={onContinue}>
              &#8592; Altre pagine
            </button>
          )}
          <button className="btn-primary" onClick={() => exportToCsv(products)}>
            &#128196; Scarica CSV
          </button>
          <button className="btn-secondary" onClick={handleExcel} disabled={exporting}>
            {exporting ? '⏳' : '&#128202; Excel'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="rtable">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('code')}>
                Codice <SortIcon f="code" />
              </th>
              <th className="sortable desc-col" onClick={() => handleSort('description')}>
                Descrizione <SortIcon f="description" />
              </th>
              <th className="sortable num-col" onClick={() => handleSort('price')}>
                Prezzo Lordo <SortIcon f="price" />
              </th>
              <th className="num-col">Trasporto</th>
              <th className="num-col">Installazione</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.code}>
                <td className="td-code">{p.code}</td>
                <td className="td-desc">{p.description}</td>
                <td className="td-price">
                  {p.price ? `€ ${Number(p.price).toLocaleString('it-IT')}` : '—'}
                </td>
                <td className="td-empty">—</td>
                <td className="td-empty">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="no-results">Nessun risultato per &ldquo;{search}&rdquo;</p>
        )}
      </div>
      <p className="table-footer">{filtered.length} di {products.length} prodotti</p>
    </div>
  );
}
