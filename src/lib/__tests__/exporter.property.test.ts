import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { generarExcel } from '../exporter';
import type { FilaProyeccion } from '../types';

const REQUIRED_HEADERS = [
  'Carrera', 'Nombre Asignatura', 'Código', 'Requisito', 'Código Requisito', 'Grupo',
  'Total Inscritos en el Requisito', 'Proyección Reprobados Requisito',
  'Proyección Abandonos en el Requisito', 'Proyección Alumnos que Promueven',
  'Alumnos Inscritos en la Asignatura en Gestión Anterior',
  'Reprobados en la Asignatura en la Gestión Anterior',
  'Abandonos en la Asignatura en la Gestión Anterior',
  'Total Repitentes en la Asignatura de la Gestión Anterior',
  'Proyección de Inscritos',
];

function makeFila(overrides: Partial<FilaProyeccion> = {}): FilaProyeccion {
  return {
    carrera: 'Sistemas', nombreAsignatura: 'Matemáticas I', sigla: 'MAT101',
    requisito: 'ADMISIÓN', codigoRequisito: null, grupo: 'A',
    totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
    proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
    inscritosAsignaturaGestionAnterior: 50, reprobadosAsignaturaGestionAnterior: 10,
    abandonosAsignaturaGestionAnterior: 5, totalRepitentesGestionAnterior: 15,
    proyeccionInscritos: 60, editadoManualmente: false, estadoEspecial: null,
    ...overrides,
  };
}

function getSheetHeaders(ws: XLSX.WorkSheet): string[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    if (cell) headers.push(String(cell.v));
  }
  return headers;
}

describe('Feature: student-growth-estimator — Exporter Property Tests', () => {
  it('Feature: student-growth-estimator, Property 18: Filtrado de resultados por carrera', () => {
    // Validates: Requerimiento 6.2
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('Sistemas', 'Civil', 'Industrial', 'Electrónica'),
          { minLength: 1, maxLength: 20 }
        ),
        (carreras) => {
          const filas = carreras.map((c, i) => makeFila({ carrera: c, sigla: `MAT${i}` }));
          const { buffer } = generarExcel(filas, '2/2024');
          const wb = XLSX.read(buffer, { type: 'buffer' });

          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
            for (const row of rows) {
              expect(String(row['Carrera']).slice(0, 31)).toBe(sheetName);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 19: Excel contiene todas las columnas requeridas', () => {
    // Validates: Requerimiento 7.1
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('Sistemas', 'Civil'), { minLength: 1, maxLength: 10 }),
        (carreras) => {
          const filas = carreras.map((c, i) => makeFila({ carrera: c, sigla: `MAT${i}` }));
          const { buffer } = generarExcel(filas, '2/2024');
          const wb = XLSX.read(buffer, { type: 'buffer' });

          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const headers = getSheetHeaders(ws);
            for (const required of REQUIRED_HEADERS) {
              expect(headers).toContain(required);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 20: Excel incluye valores editados manualmente', () => {
    // Validates: Requerimiento 7.2
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (editedValue) => {
          const filas = [
            makeFila({ proyeccionInscritos: editedValue, editadoManualmente: true }),
          ];
          const { buffer } = generarExcel(filas, '2/2024');
          const wb = XLSX.read(buffer, { type: 'buffer' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
          expect(rows[0]['Proyección de Inscritos']).toBe(editedValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 21: Excel tiene una hoja por carrera', () => {
    // Validates: Requerimiento 7.3
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('Sistemas', 'Civil', 'Industrial', 'Electrónica', 'Mecánica'),
          { minLength: 1, maxLength: 5 }
        ),
        (carreras) => {
          const distinctCarreras = [...new Set(carreras)];
          const filas = carreras.map((c, i) => makeFila({ carrera: c, sigla: `MAT${i}` }));
          const { buffer } = generarExcel(filas, '2/2024');
          const wb = XLSX.read(buffer, { type: 'buffer' });
          expect(wb.SheetNames.length).toBe(distinctCarreras.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 22: Nombre del archivo sigue el formato correcto', () => {
    // Validates: Requerimiento 7.5
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 2000, max: 2099 }).map(y => `1/${y}`),
          fc.integer({ min: 2000, max: 2099 }).map(y => `2/${y}`)
        ),
        (gestion) => {
          const { filename } = generarExcel([], gestion);
          const expected = `proyeccion_${gestion.replace('/', '_')}.xlsx`;
          expect(filename).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
