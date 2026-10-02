import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Utilitaires d'export des données affichées sur une page, au format
 * PDF (.pdf), Excel (.xlsx) ou JSON (.json).
 *
 * Chaque page liste des « rows » (objets API) et décrit ses colonnes via :
 *   [
 *     { label: 'Code POS', value: (r) => r.code_pos },
 *     { label: 'Partenaire', value: 'partenaire.name' }, // chemin pointé accepté
 *   ]
 * `label` devient le nom de colonne dans le fichier exporté ; `value` est
 * soit une fonction, soit un chemin d'accès (« a.b ») vers la donnée.
 */

/** Format du jour : YYYY-MM-DD (suffixe anti-collision des fichiers). */
const todayStamp = () => new Date().toISOString().slice(0, 10);

const resolveValue = (row, accessor) => {
  if (typeof accessor === 'function') return accessor(row);
  if (typeof accessor === 'string') {
    return accessor.split('.').reduce((acc, key) => {
      if (acc == null || typeof acc !== 'object') return undefined;
      return acc[key];
    }, row);
  }
  return accessor;
};

/**
 * Convertit les lignes API en tableaux [header, ...valeurs] prêts à être
 * sérialisés dans un fichier. Si aucune colonne n'est fournie, toutes les
 * propriétés « scalaires » des lignes sont exportées telles quelles.
 */
export function buildTableData(rows, columns) {
  const safeRows = Array.isArray(rows) ? rows.filter((r) => r != null) : [];
  if (!Array.isArray(columns) || columns.length === 0) {
    const headers = Array.from(
      new Set(safeRows.flatMap((row) => Object.keys(row ?? {}))),
    );
    const body = safeRows.map((row) =>
      headers.map((h) => formatCell(row?.[h])),
    );
    return [headers, ...body];
  }
  const headers = columns.map((c) => c.label);
  const body = safeRows.map((row) => headers.map((_, i) => formatCell(resolveValue(row, columns[i].value))));
  return [headers, ...body];
}

const formatCell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toLocaleString('fr-FR');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
};

export const blobToArrayBuffer = async (blob) => {
  if (blob && typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  // Repli jsdom : Blob/FileReader sans arrayBuffer()
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsArrayBuffer(blob);
    });
  }
  if (typeof Response !== 'undefined' && typeof new Response(blob).arrayBuffer === 'function') {
    return new Response(blob).arrayBuffer();
  }
  throw new Error('Blob.arrayBuffer indisponible dans cet environnement');
};

/** Déclenche le téléchargement d'un Blob côté navigateur. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const injectDownloader = (options, fallback) => ({
  ...(options || {}),
  download: options?.download || fallback,
});

/**
 * Export JSON : les données brutes (data) + métadonnées de génération.
 */
export function exportJSON(rows, baseName, options = {}) {
  const o = injectDownloader(options, downloadBlob);
  const payload = {
    generated_at: new Date().toISOString(),
    source: 'POSTrack',
    nombre_lignes: Array.isArray(rows) ? rows.length : 0,
    data: Array.isArray(rows) ? rows : [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  o.download(blob, `${baseName}_${todayStamp()}.json`);
  return { format: 'json', fileName: `${baseName}_${todayStamp()}.json`, count: payload.nombre_lignes };
}

/**
 * Export Excel : vrai classeur .xlsx (SheetJS), onglet nommé d'après la page.
 */
export function exportExcel(rows, baseName, columns, options = {}) {
  const o = injectDownloader(options, downloadBlob);
  const table = buildTableData(rows, columns);
  const sheet = XLSX.utils.aoa_to_sheet(table);

  // Largeurs de colonnes raisonnables à partir de la première ligne (en-têtes).
  sheet['!cols'] = (table[0] || []).map((header, i) => {
    const maxLen = Math.max(
      String(header ?? '').length,
      ...table.slice(1, Math.min(table.length, 201)).map((r) => String(r?.[i] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, String(baseName).slice(0, 30));
  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const fileName = `${baseName}_${todayStamp()}.xlsx`;
  o.download(new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  return { format: 'excel', fileName, count: Math.max(0, table.length - 1) };
}

/**
 * Export PDF : rapport paginé en paysage (jsPDF + jspdf-autotable),
 * avec titre de page et horodatage.
 */
export function exportPDF(rows, baseName, columns, options = {}) {
  const o = injectDownloader(options, downloadBlob);
  const { title = baseName, subtitle } = options;
  const table = buildTableData(rows, columns);
  const headers = table[0] || [];
  const body = table.slice(1);

  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'pt' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(String(title), 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  const stamp = new Date().toLocaleString('fr-FR');
  doc.text(`${subtitle ? `${subtitle} — ` : ''}Généré le ${stamp} · ${body.length} ligne(s)`, 40, 52);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 64,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    margin: { left: 40, right: 40 },
  });

  const fileName = `${baseName}_${todayStamp()}.pdf`;
  doc.save(fileName, { returnPromise: false });
  // doc.save ne passe pas par downloadBlob ; il déclenche lui-même le téléchargement.
  return { format: 'pdf', fileName, count: body.length };
}
