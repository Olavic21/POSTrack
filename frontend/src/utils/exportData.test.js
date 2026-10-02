import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildTableData,
  exportExcel,
  exportJSON,
  exportPDF,
  blobToArrayBuffer,
} from './exportData';

// Mock du moteur PDF : évite l'exécution réelle de doc.save dans jsdom.
// Une fonction standard (et non une arrow) est nécessaire : `exportData`
// instancie jsPDF via `new jsPDF(...)` (constructibilité).
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function MockJsPDF() {
    this.setFont = vi.fn();
    this.setFontSize = vi.fn();
    this.setTextColor = vi.fn();
    this.text = vi.fn();
    this.save = vi.fn();
  }),
}));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

const COLUMNS = [
  { label: 'Code', value: 'code' },
  { label: 'Nom', value: (r) => r.name?.toUpperCase() },
];

const ROWS = [
  { id: 1, code: 'POS-1', name: 'akwa centre', partenaire: { nom: 'MC' } },
  { id: 2, code: null, name: 'bonabéri', extra: { a: 1 } },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildTableData', () => {
  it('projette les colonnes avec accessoire chemin pointé ou fonction', () => {
    const [head, ...body] = buildTableData(ROWS, [
      { label: 'Code', value: 'code' },
      { label: 'Nom maj.', value: (r) => r.name.toUpperCase() },
      { label: 'Partenaire', value: 'partenaire.nom' },
    ]);
    expect(head).toEqual(['Code', 'Nom maj.', 'Partenaire']);
    expect(body[0]).toEqual(['POS-1', 'AKWA CENTRE', 'MC']);
    expect(body[1][0]).toBe('');
  });

  it('exporte toutes les proprietes scalaires si aucune colonne fournie', () => {
    const table = buildTableData([{ id: 7, statut: true }], []);
    expect(table[0]).toEqual(['id', 'statut']);
    expect(table[1]).toEqual([7, 'Oui']);
  });

  it('normalise les valeurs non supportees (objets -> JSON, dates -> texte)', () => {
    const d = new Date('2026-08-26T10:00:00');
    const table = buildTableData([{ o: { x: 2 }, when: d }], [
      { label: 'O', value: 'o' },
      { label: 'When', value: 'when' },
    ]);
    expect(table[1][0]).toBe('{"x":2}');
    expect(String(table[1][1])).toContain('2026');
  });
});

describe('exportJSON', () => {
  it('telecharge un blob JSON contenant les donnees brutes et metadonnees', async () => {
    let captures;
    const fakeDownload = (blob, fileName) => { captures = { blob, fileName }; };

    const res = exportJSON(ROWS, 'partenaires', { download: fakeDownload });
    // jsdom : Blob.text() peut manquer → helper dédié (FileReader/Response/arrayBuffer)
    const buf = await blobToArrayBuffer(captures.blob);
    const text = Buffer.from(buf).toString('utf-8');

    expect(captures.fileName).toMatch(/^partenaires_\d{4}-\d{2}-\d{2}\.json$/);
    expect(res.format).toBe('json');
    expect(res.count).toBe(2);
    expect(JSON.parse(text).data).toHaveLength(2);
  });

  it('exporte une liste vide sans planter', () => {
    const res = exportJSON([], 'pos', { download: (b, f) => f });
    expect(res.count).toBe(0);
  });
});

describe('exportExcel', () => {
  it('produit un classeur .xlsx valide (signature OOXML)', async () => {
    let captured;
    const res = exportExcel(ROWS, 'partenaires', COLUMNS, {
      download: (blob, fileName) => { captured = { blob, fileName }; },
    });
    // jsdom : Blob.arrayBuffer / slice(...).arrayBuffer peuvent manquer → helper dédié
    const buf = await blobToArrayBuffer(captured.blob.slice(0, 2));
    const bytes = new Uint8Array(buf);

    expect(res.format).toBe('excel');
    expect(res.count).toBe(2);
    expect(captured.fileName).toMatch(/\.xlsx$/);
    // Signature « PK » d'un conteneur OOXML
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe('exportPDF', () => {
  it('genere un rapport PDF et appelle doc.save avec le nom horodate', async () => {
    const res = exportPDF(ROWS, 'partenaires', COLUMNS, { title: 'Liste des partenaires' });
    const { jsPDF } = await import('jspdf');
    const instance = jsPDF.mock.results[jsPDF.mock.results.length - 1].value;

    expect(res.format).toBe('pdf');
    expect(res.count).toBe(2);
    expect(instance.save).toHaveBeenCalledWith(
      expect.stringMatching(/^partenaires_\d{4}-\d{2}-\d{2}\.pdf$/),
      expect.anything(),
    );
  });
});
