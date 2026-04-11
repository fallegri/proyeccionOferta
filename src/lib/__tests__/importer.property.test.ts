import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { parseHistorico } from '../importer';

const REQUIRED_COLS = [
  'Código Plan Estudio', 'Plan Estudio', 'Código Gestión', 'Gestión',
  'Turno', 'Grupo', 'Código Materia', 'Materia', 'Sigla',
  'Abandono', 'Reprobados', 'Aprobados', 'Total Alumnos',
];

function makeHistoricoBuffer(rows: Record<string, unknown>[], cols?: string[]): Buffer {
  const headers = cols ?? REQUIRED_COLS;
  const ws = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [Object.fromEntries(headers.map(h => [h, null]))],
    { header: headers }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function makeValidRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    'Código Plan Estudio': 'CP001',
    'Plan Estudio': 'Ingeniería de Sistemas',
    'Código Gestión': 'G001',
    'Gestión': '1/2024',
    'Turno': 'Mañana',
    'Grupo': 'A',
    'Código Materia': 'M001',
    'Materia': 'Matemáticas',
    'Sigla': 'MAT101',
    'Abandono': 5,
    'Reprobados': 10,
    'Aprobados': 30,
    'Total Alumnos': 45,
    ...overrides,
  };
}

describe('Feature: student-growth-estimator — Importer Property Tests', () => {
  // Property 1: Validación de formato de archivo
  it('Feature: student-growth-estimator, Property 1: Validación de formato de archivo — si errores no vacío, rows debe ser []', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 100 }),
        (bytes) => {
          const buf = Buffer.from(bytes);
          const result = parseHistorico(buf);
          // Invariant: whenever there are errors, rows must be empty
          if (result.errores.length > 0) {
            expect(result.rows).toEqual([]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 1b: Validación de formato de archivo — acepta buffers xlsx válidos sin error de formato', () => {
    const buf = makeHistoricoBuffer([makeValidRow()]);
    const result = parseHistorico(buf);
    const formatError = result.errores.some(
      e => e.toLowerCase().includes('formato') || e.toLowerCase().includes('válido')
    );
    expect(formatError).toBe(false);
  });

  // Property 2: Detección de columnas faltantes
  it('Feature: student-growth-estimator, Property 2: Detección de columnas faltantes — reporta columnas faltantes y rows vacío', () => {
    fc.assert(
      fc.property(
        fc.subarray(REQUIRED_COLS, { minLength: 1, maxLength: REQUIRED_COLS.length - 1 }),
        (presentCols) => {
          const missingCols = REQUIRED_COLS.filter(c => !presentCols.includes(c));
          if (missingCols.length === 0) return;

          const row = Object.fromEntries(presentCols.map(c => [c, 'val']));
          const buf = makeHistoricoBuffer([row], presentCols);
          const result = parseHistorico(buf);

          expect(result.rows).toEqual([]);
          expect(result.errores.length).toBeGreaterThan(0);

          const errorText = result.errores.join(' ');
          const mentionsMissing = missingCols.some(col => errorText.includes(col));
          expect(mentionsMissing).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 3: Omisión de filas con valores nulos en campos clave
  it('Feature: student-growth-estimator, Property 3: Omisión de filas con valores nulos en campos clave', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (validCount, nullCount) => {
          const validRows = Array.from({ length: validCount }, (_, i) =>
            makeValidRow({ Sigla: `SIG${i}`, Gestión: '1/2024', 'Código Plan Estudio': 'CP001' })
          );
          const nullRows = Array.from({ length: nullCount }, () =>
            makeValidRow({ Sigla: null, Gestión: null, 'Código Plan Estudio': null })
          );
          const allRows = [...validRows, ...nullRows];
          const buf = makeHistoricoBuffer(allRows);
          const result = parseHistorico(buf);

          expect(result.omitidas).toBe(nullCount);
          expect(result.rows.length).toBe(validCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 4: Corrección del resumen de importación
  it('Feature: student-growth-estimator, Property 4: Corrección del resumen de importación', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            carrera: fc.constantFrom('Sistemas', 'Civil', 'Industrial'),
            gestion: fc.constantFrom('1/2023', '2/2023', '1/2024'),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (entries) => {
          const rows = entries.map((e, i) =>
            makeValidRow({ 'Plan Estudio': e.carrera, Gestión: e.gestion, Sigla: `S${i}` })
          );
          const buf = makeHistoricoBuffer(rows);
          const result = parseHistorico(buf);

          expect(result.errores).toEqual([]);
          expect(result.rows.length).toBe(entries.length);

          // Resumen must mention the total record count
          expect(result.resumen).toContain(String(entries.length));

          // Resumen must mention the number of distinct carreras
          const distinctCarreras = new Set(entries.map(e => e.carrera)).size;
          expect(result.resumen).toContain(String(distinctCarreras));
        }
      ),
      { numRuns: 100 }
    );
  });
});
