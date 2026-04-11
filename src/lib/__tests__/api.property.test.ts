import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as XLSX from 'xlsx';
import { parseHistorico, parseMalla } from '../importer';
import { POST } from '../../app/api/proyeccion/calcular/route';
import type { HistoricoRow, MallaRow, ConfigCalculo } from '../types';

function makeValidHistoricoRow(overrides: Partial<HistoricoRow> = {}): HistoricoRow {
  return {
    codigoPlanEstudio: 'CP001', planEstudio: 'Sistemas', codigoGestion: 'G1',
    gestion: '1/2024', turno: 'M', grupo: 'A', codigoMateria: 'M1',
    materia: 'Matemáticas', sigla: 'MAT101', abandono: 5, reprobados: 10,
    aprobados: 30, totalAlumnos: 45, ...overrides,
  };
}

function makeValidMallaRow(overrides: Partial<MallaRow> = {}): MallaRow {
  return {
    carrera: 'Sistemas', semestre: 1, sigla: 'MAT101',
    nombreAsignatura: 'Matemáticas I', requisito: 'ADMISIÓN',
    requiereIngresoManual: false, ...overrides,
  };
}

function makeValidConfig(overrides: Partial<ConfigCalculo> = {}): ConfigCalculo {
  return {
    gestionActual: '1/2024', gestionSiguiente: '2/2024',
    gestionesAtipicas: [], metodo: 'promedio_simple', ...overrides,
  };
}

async function callCalcular(body: unknown): Promise<{ status: number; data: unknown }> {
  const request = new Request('http://localhost/api/proyeccion/calcular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  const data = await response.json();
  return { status: response.status, data };
}

describe('Feature: student-growth-estimator — API Property Tests', () => {
  it('Feature: student-growth-estimator, Property 23: Validación de precondiciones — falta historico → 400', async () => {
    const { status, data } = await callCalcular({
      malla: [makeValidMallaRow()],
      config: makeValidConfig(),
    });
    expect(status).toBe(400);
    expect((data as { error: string }).error).toBeTruthy();
  });

  it('Feature: student-growth-estimator, Property 23b: Validación de precondiciones — falta malla → 400', async () => {
    const { status, data } = await callCalcular({
      historico: [makeValidHistoricoRow()],
      config: makeValidConfig(),
    });
    expect(status).toBe(400);
    expect((data as { error: string }).error).toBeTruthy();
  });

  it('Feature: student-growth-estimator, Property 23c: Validación de precondiciones — falta gestionActual → 400', async () => {
    const { status, data } = await callCalcular({
      historico: [makeValidHistoricoRow()],
      malla: [makeValidMallaRow()],
      config: { gestionSiguiente: '2/2024', gestionesAtipicas: [], metodo: 'promedio_simple' },
    });
    expect(status).toBe(400);
    expect((data as { error: string }).error).toBeTruthy();
  });

  it('Feature: student-growth-estimator, Property 23d: Validación de precondiciones — datos completos → 200', async () => {
    const { status } = await callCalcular({
      historico: [makeValidHistoricoRow(), makeValidHistoricoRow({ gestion: '2/2023' })],
      malla: [makeValidMallaRow()],
      config: makeValidConfig(),
    });
    expect(status).toBe(200);
  });

  it('Feature: student-growth-estimator, Property 24: Errores de procesamiento son descriptivos — parseHistorico', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 50 }),
        (bytes) => {
          const buf = Buffer.from(bytes);
          const result = parseHistorico(buf);
          // If there are errors, each must be a non-empty string
          for (const err of result.errores) {
            expect(typeof err).toBe('string');
            expect(err.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 24b: Errores de procesamiento son descriptivos — parseMalla con columnas faltantes', () => {
    // Create xlsx with missing required columns
    const ws = XLSX.utils.json_to_sheet([{ Carrera: 'Sistemas' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const result = parseMalla(buf);
    expect(result.errores.length).toBeGreaterThan(0);
    expect(result.errores[0].length).toBeGreaterThan(0);
    expect(result.rows).toEqual([]);
  });
});
