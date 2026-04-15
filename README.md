# ListApp 2026

**PWA per estrarre dati e immagini dal listino figurativo PDF Cormach e generare un Excel con immagini prodotto integrate.**

[![Deploy](https://img.shields.io/badge/Deploy-GitHub_Pages-00b894)](https://pezzaliapp.github.io/listapp2026/)
[![PezzaliApp](https://img.shields.io/badge/by-PezzaliApp-00b894)](https://pezzaliapp.com)

---

## Funzionalità

- **Carica PDF** – listino figurativo Cormach (any year)
- **Carica CSV** *(consigliato)* – lista completa prodotti con prezzi
- **Estrae automaticamente** – codici, descrizioni, prezzi dal testo PDF
- **Estrae immagini prodotto** – 192×192 px, ritaglia la zona sinistra di ogni pagina
- **Export Excel** – colonne: Codice | Descrizione | Prezzo Lordo | Trasporto | Installazione | Immagine (embedded)
- **Export CSV** – stesso contenuto senza immagini
- **100% browser** – nessun dato inviato a server, funziona offline (PWA)

---

## Modalità operative

### Modalità completa (CSV + PDF)
- CSV = fonte dati (498 prodotti con prezzi ufficiali)
- PDF = fonte immagini (~68% dei prodotti riceve una foto)
- **Consigliata** per output completo e accurato

### Modalità solo PDF
- PDF.js estrae testo e immagini
- ~150 prodotti estratti (quelli con prezzo visibile nel testo)
- Utile per test rapidi o PDF senza CSV corrispondente

---

## Stack tecnico

| Libreria | Uso |
|---|---|
| [PDF.js](https://mozilla.github.io/pdf.js/) | Estrazione testo + rendering pagine |
| [ExcelJS](https://github.com/exceljs/exceljs) | Generazione XLSX con immagini embedded |
| React 18 + Vite 5 | Framework + bundler |

---

## Setup locale

```bash
git clone https://github.com/pezzaliapp/listapp2026.git
cd listapp2026
npm install
npm run dev        # http://localhost:5173
```

---

## Build e Deploy (GitHub Pages)

```bash
npm run build

# Copia assets pubblici nella root (necessario con outDir: '.')
cp -r public/icons ./
cp public/manifest.json .
cp public/sw.js .

touch .nojekyll
git add -A
git commit -m "build: listapp2026 $(date +%Y-%m-%d)"
git push origin main
```

Su GitHub: **Settings → Pages → Source: Deploy from branch → main → / (root)**

---

## Struttura progetto

```
listapp2026/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── style.css
│   ├── components/
│   │   ├── SetupView.jsx       # Upload CSV + PDF, selezione modalità
│   │   ├── ProcessingView.jsx  # Progress bar a due fasi
│   │   └── ResultsView.jsx     # Tabella prodotti + export
│   └── utils/
│       ├── pdfProcessor.js     # Motore estrazione (PDF.js, due fasi)
│       └── excelExporter.js    # Export Excel + CSV (ExcelJS)
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── index.html
├── package.json
├── vite.config.js
└── .nojekyll
```

---

## Logica estrazione immagini

Il listino Cormach ha un layout fisso:
- **Immagine prodotto** → zona sinistra ~48% della pagina, verticalmente 8%–70%
- **Specifiche tecniche** → zona destra
- **Codici + prezzi** → area in fondo

L'app esegue **due fasi**:
1. **Scansione testo** (tutte le pagine, istantanea) → raccoglie codici 8 cifre per pagina
2. **Rendering + crop** (solo pagine con prodotti rilevanti) → taglia e ridimensiona a 192×192

Ogni codice riceve l'immagine dalla **prima pagina** in cui compare.

---

## Autore

**Alessandro Pezzali** · [PezzaliApp](https://pezzaliapp.com) · [alessandropezzali.it](https://alessandropezzali.it)
