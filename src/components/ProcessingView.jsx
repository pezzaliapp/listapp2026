export default function ProcessingView({ progress }) {
  const { current, total, phase, status, error } = progress;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const remaining = phase === 'vision' && total > 0 && current > 0
    ? Math.ceil(((total - current) * 4.5) / 60) : null;
  const isRetrying = status && status.includes('Rate limit');

  return (
    <div className="processing-view">
      <div className="processing-card">
        <div className="gear-anim">
          {isRetrying ? '\u23f3' : phase === 'vision' ? '\ud83d\udc41' : '\u2699\ufe0f'}
        </div>
        <h2>
          {isRetrying ? 'In attesa (rate limit)' :
           phase === 'vision' ? 'Analisi Vision AI' : 'Scansione PDF'}
        </h2>
        <p className="proc-status" style={{ color: error ? '#e17055' : undefined }}>
          {status}
        </p>
        {phase === 'vision' && (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="progress-label">
              {pct}% &mdash; pagina {current} di {total}
              {remaining !== null ? ` \u2014 ~${remaining} min rimanenti` : ''}
            </p>
          </>
        )}
        {phase === 'vision' && !error && (
          <p className="hint proc-hint">
            Piano gratuito Gemini: 15 req/min. Con {total} pagine il processo richiede circa{' '}
            <strong>{Math.ceil(total * 4.5 / 60)} minuti</strong>.
            {isRetrying ? ' Retry automatico in corso...' : ''}
          </p>
        )}
        {error && (
          <p className="hint proc-hint" style={{ color: '#e17055' }}>
            Verifica la chiave API Gemini (AIza...) e le quote disponibili.
          </p>
        )}
      </div>
    </div>
  );
}
