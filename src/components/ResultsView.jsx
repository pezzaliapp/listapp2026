import { useState, useMemo } from 'react';
import { exportToExcel, exportToCsv } from '../utils/excelExporter';

export default function ResultsView({ products, onBack }) {
  const [search,    setSearch]    = useState('');
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState('code');
  const [sortDir,   setSortDir]   = useState('asc');

  const handleSort = f => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = products.filter(p =>
      p.code.includes(q) || p.description.toLowerCase().includes(q)
    );
    return list.sort((a, b) => {
      let va = sortField === 'price' ? Number(a[sortField]) : String(a[sortField]).toLowerCase();
      let vb = sortField === 'price' ? Number(b[sortField]) : String(b[sortField]).toLowerCase();
      return sortDir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [products, search, sortField, sortDir]);

  const withImages = products.filter(p => p.imageBase64).length;

  const handleExcel = async () => {
    setExporting(true);
    try { await exportToExcel(products); }
    catch (e) { alert('Errore Excel: ' + e.message); }
    finally { setExporting(false); }
  };

  const SortIcon = ({ f }) => sortField !== f
    ? <span className="sort-icon neutral">&#8597;</span>
    : <span className="sort-icon active">{sortDir === 'asc' ? '↑' : '↓'}</span>;

  return (
    <div className="results-view">
      <div className="results-topbar">
        <div className="results-stats">
          <span className="badge">{products.length} prodotti estratti</span>
          {withImages > 0 && <span className="badge success">{withImages} con immagine</span>}
        </div>
        <div className="results-actions">
          <input className="search-input" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="&#128269; Cerca codice o descrizione..." />
          <button className="btn-ghost" onClick={onBack}>&#8592; Nuovo</button>
          <button className="btn-primary" onClick={() => exportToCsv(products)}>
            &#128196; Scarica CSV
          </button>
          {withImages > 0 && (
            <button className="btn-secondary" onClick={handleExcel} disabled={exporting}>
              {exporting ? '&#9203; Export...' : '&#128202; Excel + Immagini'}
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="rtable">
          <thead>
            <tr>
              {products[0]?.imageBase64 !== undefined && products.some(p => p.imageBase64) && (
                <th className="th-img">Img</th>
              )}
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
                {products.some(x => x.imageBase64) && (
                  <td className="td-img">
                    {p.imageBase64
                      ? <img src={`data:image/png;base64,${p.imageBase64}`} alt={p.code} className="prod-thumb" />
                      : <div className="no-thumb" />}
                  </td>
                )}
                <td className="td-code">{p.code}</td>
                <td className="td-desc">{p.description}</td>
                <td className="td-price">
                  {p.price ? `\u20AC\u00A0${Number(p.price).toLocaleString('it-IT')}` : '\u2014'}
                </td>
                <td className="td-empty">\u2014</td>
                <td className="td-empty">\u2014</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="no-results">Nessun risultato per &ldquo;{search}&rdquo;</p>
        )}
      </div>
      <p className="table-footer">
        {filtered.length} di {products.length} prodotti
      </p>
    </div>
  );
}
