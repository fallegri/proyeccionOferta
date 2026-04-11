import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { parseMalla } from '../importer';

const MALLA_COLS = ['Carrera', 'Semestre', 'Sigla', 'Nombre Asignatura', 'Requisito'];

function makeMallaBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [Object.fromEntries(MALLA_COLS.map(h => [h, null]))],
    { header: MALLA_COLS }
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function makeMallaRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    Carrera: 'Ingeniería de Sistemas',
    Semestre: 1,
    Sigla: 'MAT101',
    'Nombre Asignatura': 'Matemáticas I',
    Requisito: null,
    ...overrides,
  };
}

// Simple sigla generator: uppercase letters + digits, no spaces
const siglaArb = fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,3}$/).filter(s => s.length >= 4);

describe('Feature: student-growth-estimator — Malla Property Tests', () => {
  /**
   * **Validates: Requirements 2.7**
   * Property 5: Soporte de múltiples prerrequisitos
   */
  it('Feature: student-growth-estimator, Property 5: Soporte de múltiples prerrequisitos', () => {
    fc.assert(
      fc.property(
        // 0 to 5 prerequisites
        fc.array(siglaArb, { minLength: 0, maxLength: 5 }),
        (prereqs) => {
          const requisitoStr = prereqs.join(', ');
          const row = makeMallaRow({ Sigla: 'MAT201', Requisito: requisitoStr || null });
          const buf = makeMallaBuffer([row]);
          const result = parseMalla(buf);

          expect(result.errores).toEqual([]);

          // Filter rows for this subject
          const subjectRows = result.rows.filter(r => r.sigla === 'MAT201');

          if (prereqs.length === 0) {
            // Should produce 1 row with ADMISIÓN
            expect(subjectRows.length).toBe(1);
            expect(subjectRows[0].requisito).toBe('ADMISIÓN');
          } else {
            // Should produce exactly N rows, one per prerequisite
            expect(subjectRows.length).toBe(prereqs.length);
            const resultReqs = subjectRows.map(r => r.requisito).sort();
            const expectedReqs = prereqs.map(p => p.trim()).sort();
            expect(resultReqs).toEqual(expectedReqs);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.8**
   * Property 6: Marcado de prerrequisitos no estructurados
   */
  it('Feature: student-growth-estimator, Property 6: Marcado de prerrequisitos no estructurados', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'todas hasta MAT101 aprobadas',
          'todos los cursos aprobados',
          'completo el primer año',
          'hasta MAT201 aprobadas',
          'todas aprobadas'
        ),
        (nonStructured) => {
          const row = makeMallaRow({ Sigla: 'MAT301', Requisito: nonStructured });
          const buf = makeMallaBuffer([row]);
          const result = parseMalla(buf);

          expect(result.errores).toEqual([]);
          const subjectRows = result.rows.filter(r => r.sigla === 'MAT301');
          expect(subjectRows.length).toBe(1);
          expect(subjectRows[0].requiereIngresoManual).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.8**
   * Property 6b: Prerrequisitos estructurados tienen requiereIngresoManual = false
   */
  it('Feature: student-growth-estimator, Property 6b: Prerrequisitos estructurados tienen requiereIngresoManual = false', () => {
    fc.assert(
      fc.property(
        siglaArb,
        (prereq) => {
          const row = makeMallaRow({ Sigla: 'MAT401', Requisito: prereq });
          const buf = makeMallaBuffer([row]);
          const result = parseMalla(buf);

          expect(result.errores).toEqual([]);
          const subjectRows = result.rows.filter(r => r.sigla === 'MAT401');
          expect(subjectRows.every(r => r.requiereIngresoManual === false)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
