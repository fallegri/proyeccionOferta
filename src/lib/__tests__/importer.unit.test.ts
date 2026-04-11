import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseHistorico, parseMalla } from '../importer';

const HISTORICO_COLS = [
  'Código Plan Estudio', 'Plan Estudio', 'Código Gestión', 'Gestión',
  'Turno', 'Grupo', 'Código Materia', 'Materia', 'Sigla',
  'Abandono', 'Reprobados', 'Aprobados', 'Total Alumnos',
];

const MALLA_COLS = ['Carrera', 'Semestre', 'Sigla', 'Nombre Asignatura', 'Requisito'];

function makeBuffer(rows: Record<string, unknown>[], cols: string[]): Buffer {
  // Only keep keys that are in cols, so missing-column tests work correctly
  const filteredRows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? null])));
  const data = filteredRows.length > 0
    ? filteredRows
    : [Object.fromEntries(cols.map(h => [h, null]))];
  const ws = XLSX.utils.json_to_sheet(data, { header: cols });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function makeHistoricoBuffer(rows: Record<string, unknown>[], cols = HISTORICO_COLS): Buffer {
  return makeBuffer(rows, cols);
}

function makeMallaBuffer(rows: Record<string, unknown>[], cols = MALLA_COLS): Buffer {
  return makeBuffer(rows, cols);
}

function validHistoricoRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    'Código Plan Estudio': 'CP001', 'Plan Estudio': 'Sistemas', 'Código Gestión': 'G1',
    'Gestión': '1/2024', 'Turno': 'M', 'Grupo': 'A', 'Código Materia': 'M1',
    'Materia': 'Matemáticas', 'Sigla': 'MAT101', 'Abandono': 2, 'Reprobados': 5,
    'Aprobados': 20, 'Total Alumnos': 27, ...overrides,
  };
}

function validMallaRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    Carrera: 'Sistemas', Semestre: 1, Sigla: 'MAT101',
    'Nombre Asignatura': 'Matemáticas I', Requisito: null, ...overrides,
  };
}

describe('parseHistorico — unit tests', () => {
  it('empty file returns no rows and no errors', () => {
    const ws = XLSX.utils.aoa_to_sheet([HISTORICO_COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const result = parseHistorico(buf);
    expect(result.rows).toEqual([]);
    expect(result.errores).toEqual([]);
    expect(result.omitidas).toBe(0);
  });

  it('single valid row is parsed correctly', () => {
    const buf = makeHistoricoBuffer([validHistoricoRow()]);
    const result = parseHistorico(buf);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].sigla).toBe('MAT101');
    expect(result.rows[0].gestion).toBe('1/2024');
    expect(result.errores).toEqual([]);
  });

  it('all rows omitted when all have null key fields', () => {
    const rows = [
      validHistoricoRow({ Sigla: null }),
      validHistoricoRow({ 'Gestión': null }),
      validHistoricoRow({ 'Código Plan Estudio': null }),
    ];
    const buf = makeHistoricoBuffer(rows);
    const result = parseHistorico(buf);
    expect(result.rows).toEqual([]);
    expect(result.omitidas).toBe(3);
  });

  it('columns in different order still parse correctly', () => {
    const shuffledCols = [...HISTORICO_COLS].reverse();
    const row = validHistoricoRow();
    const buf = makeHistoricoBuffer([row], shuffledCols);
    const result = parseHistorico(buf);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].sigla).toBe('MAT101');
  });

  it('missing required column returns error with column name', () => {
    const colsWithoutSigla = HISTORICO_COLS.filter(c => c !== 'Sigla');
    const row = validHistoricoRow();
    const buf = makeHistoricoBuffer([row], colsWithoutSigla);
    const result = parseHistorico(buf);
    expect(result.rows).toEqual([]);
    expect(result.errores.some(e => e.includes('Sigla'))).toBe(true);
  });

  it('invalid buffer returns empty rows (xlsx is permissive with unknown formats)', () => {
    // xlsx silently parses unrecognized buffers as empty sheets rather than throwing
    const result = parseHistorico(Buffer.from('not an excel file'));
    expect(result.rows).toEqual([]);
  });
});

describe('parseMalla — unit tests', () => {
  it('no prerequisite → ADMISIÓN', () => {
    const buf = makeMallaBuffer([validMallaRow({ Requisito: null })]);
    const result = parseMalla(buf);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].requisito).toBe('ADMISIÓN');
    expect(result.rows[0].requiereIngresoManual).toBe(false);
  });

  it('single prerequisite → one row', () => {
    const buf = makeMallaBuffer([validMallaRow({ Requisito: 'MAT101' })]);
    const result = parseMalla(buf);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].requisito).toBe('MAT101');
    expect(result.rows[0].requiereIngresoManual).toBe(false);
  });

  it('multiple comma-separated prerequisites → one row per prereq', () => {
    const buf = makeMallaBuffer([validMallaRow({ Sigla: 'MAT201', Requisito: 'MAT101, FIS101, QUI101' })]);
    const result = parseMalla(buf);
    const rows = result.rows.filter(r => r.sigla === 'MAT201');
    expect(rows.length).toBe(3);
    expect(rows.map(r => r.requisito).sort()).toEqual(['FIS101', 'MAT101', 'QUI101']);
  });

  it('non-structured prerequisite → requiereIngresoManual = true', () => {
    const buf = makeMallaBuffer([validMallaRow({ Sigla: 'MAT301', Requisito: 'todas hasta MAT201 aprobadas' })]);
    const result = parseMalla(buf);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].requiereIngresoManual).toBe(true);
  });

  it('missing required column returns error', () => {
    const colsWithoutCarrera = MALLA_COLS.filter(c => c !== 'Carrera');
    const buf = makeMallaBuffer([validMallaRow()], colsWithoutCarrera);
    const result = parseMalla(buf);
    expect(result.rows).toEqual([]);
    expect(result.errores.some(e => e.includes('Carrera'))).toBe(true);
  });

  it('empty file returns no rows', () => {
    const ws = XLSX.utils.aoa_to_sheet([MALLA_COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const result = parseMalla(buf);
    expect(result.rows).toEqual([]);
    expect(result.errores).toEqual([]);
  });
});
