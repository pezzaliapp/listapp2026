import ExcelJS from 'exceljs';

const DATE_STR = new Date().toISOString().slice(0, 10);

/**
 * Export products to XLSX with embedded product images.
 * Column layout: Codice | Descrizione | Prezzo Lordo | Trasporto | Installazione | Immagine
 */
export async function exportToExcel(products) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ListApp 2026 - PezzaliApp';
  wb.created = new Date();

  const ws = wb.addWorksheet('Listino 2026', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  });

  // Column definitions
  // numFmt '@' forces Codice to be treated as TEXT in Excel/Numbers (preserves leading zeros)
  ws.columns = [
    { header: 'Codice Articolo', key: 'code',         width: 18, style: { numFmt: '@' } },
    { header: 'Descrizione',     key: 'description',  width: 50 },
    { header: 'Prezzo Lordo',    key: 'price',         width: 16 },
    { header: 'Trasporto',       key: 'transport',     width: 16 },
    { header: 'Installazione',   key: 'installation',  width: 16 },
    { header: 'Immagine',        key: 'image',         width: 28 },
  ];

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  ['A1','B1','C1','D1','E1','F1'].forEach(addr => {
    const cell = ws.getCell(addr);
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } };
    cell.font   = { bold: true, color: { argb: 'FF00B894' }, size: 11, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF00B894' } }
    };
  });

  // Data rows
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const rowNum = i + 2; // row 1 is header

    const row = ws.addRow({
      code:         String(p.code),   // explicit string – preserves leading zeros
      description:  p.description,
      price:        p.price || 0,
      transport:    p.transport || '',
      installation: p.installation || '',
      image:        ''
    });

    // Belt-and-suspenders: mark the code cell explicitly as text
    row.getCell('code').value = String(p.code);

    row.height = 100; // tall enough for 192px image

    // Cell styling
    const codeCell  = row.getCell('code');
    const priceCell = row.getCell('price');

    codeCell.font = { bold: true, color: { argb: 'FF00B894' }, name: 'Courier New', size: 10 };
    priceCell.numFmt = '#.##0 "EUR"';
    priceCell.alignment = { horizontal: 'right', vertical: 'middle' };

    row.eachCell({ includeEmpty: true }, cell => {
      if (!cell.alignment) cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } }
      };
    });

    // Zebra striping
    if (i % 2 === 0) {
      row.eachCell({ includeEmpty: true }, cell => {
        // Only fill if no color already set (code cell has color)
        if (!cell.fill || cell.fill.pattern === 'none') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FBF9' } };
        }
      });
    }

    // Embed image
    if (p.imageBase64) {
      try {
        const imgId = wb.addImage({ base64: p.imageBase64, extension: 'png' });
        ws.addImage(imgId, {
          tl: { col: 5, row: rowNum - 1 }, // col 5 = F (0-indexed), row 0-indexed
          br: { col: 6, row: rowNum },
          editAs: 'oneCell'
        });
      } catch (imgErr) {
        console.warn('Immagine non incorporata per', p.code, imgErr);
      }
    }
  }

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];

  // Auto filter
  ws.autoFilter = 'A1:F1';

  // Generate file and trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  triggerDownload(blob, `listino_cormach_${DATE_STR}.xlsx`);
}

/**
 * Export products to CSV (UTF-8 BOM, semicolon separator).
 *
 * Codice column uses ="VALUE" notation so Excel, Numbers, and LibreOffice
 * treat it as text and preserve leading zeros (e.g. 01100313 stays 01100313).
 * Images are not included in CSV.
 */
export function exportToCsv(products) {
  const SEP = ';';
  const lines = [
    ['Codice Articolo', 'Descrizione', 'Prezzo Lordo', 'Trasporto', 'Installazione'].join(SEP)
  ];

  for (const p of products) {
    // Wrap fields that may contain the separator
    const escStr = v => {
      const s = String(v ?? '');
      return s.includes(SEP) || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    // ="CODE" forces text interpretation in all major spreadsheet apps
    // This preserves leading zeros (01100313 → stays 01100313, not 1100313)
    const codeCell = `="${String(p.code).replace(/"/g, '""')}"`;

    lines.push([
      codeCell,
      escStr(p.description),
      escStr(p.price),
      escStr(p.transport),
      escStr(p.installation)
    ].join(SEP));
  }

  const csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel auto-encoding detection
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `listino_cormach_${DATE_STR}.csv`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
