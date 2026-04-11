import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calcularTasas } from '../processor';
import type { HistoricoRow, ConfigCalculo } from '../types';

function makeConfig(overrides: Partial<ConfigCalculo> = {}): ConfigCalculo {
  return {
    gestionActual: '1/2024',
    gestionSiguiente: '2/2024',
    gestionesAtipicas: [],
    metodo: 'promedio_simple',
    ...overrides,
  };
}

function makeRow(overrides: Partial<HistoricoRow> = {}): HistoricoRow {
  return {
    codigoPlanEstudio: 'CP001',
    planEstudio: 'Sistemas',
    codigoGestion: 'G1',
    gestion: '1/2024',
    turno: 'M',
    grupo: 'A',
    codigoMateria: 'M1',
    materia: 'Matemáticas',
    sigla: 'MAT101',
    abandono: 5,
    reprobados: 10,
    aprobados: 30,
    totalAlumnos: 45,
    ...overrides,
  };
}

describe('Feature: student-growth-estimator — Processor Property Tests (calcularTasas)', () => {
  /**
   * **Validates: Requirements 4.6**
   * Property 11: Exclusión de gestiones atípicas del cálculo estadístico
   */
  it('Feature: student-growth-estimator, Property 11: Exclusión de gestiones atípicas del cálculo estadístico', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2020 }).map(y => `1/${y}`),
        fc.integer({ min: 2021, max: 2099 }).map(y => `2/${y}`),
        (atipicaGestion, normalGestion) => {
          // Atypical gestión has very high reprobation rate (0.9)
          const atipicaRow = makeRow({ gestion: atipicaGestion, reprobados: 90, abandono: 5, totalAlumnos: 100 });
          // Normal gestión has low reprobation rate (0.1)
          const normalRow1 = makeRow({ gestion: normalGestion, reprobados: 10, abandono: 5, totalAlumnos: 100 });
          const normalRow2 = makeRow({ gestion: `1/${parseInt(normalGestion.split('/')[1]) + 1}`, reprobados: 10, abandono: 5, totalAlumnos: 100 });

          const historico = [atipicaRow, normalRow1, normalRow2];

          // Without exclusion: atypical gestión is included
          const withAtipica = calcularTasas(historico, makeConfig({ gestionesAtipicas: [] }));
          // With exclusion: atypical gestión is excluded
          const withoutAtipica = calcularTasas(historico, makeConfig({ gestionesAtipicas: [atipicaGestion] }));

          const tasaWith = withAtipica.find(t => t.sigla === 'MAT101' && t.carrera === 'Sistemas');
          const tasaWithout = withoutAtipica.find(t => t.sigla === 'MAT101' && t.carrera === 'Sistemas');

          // When atypical gestión is excluded, the rate should be lower (closer to 0.1)
          if (tasaWith && tasaWithout && tasaWith.estado === 'ok' && tasaWithout.estado === 'ok') {
            expect(tasaWithout.tasaReprobacion).toBeLessThan(tasaWith.tasaReprobacion);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.7**
   * Property 12: Independencia de tasas por sigla y carrera
   */
  it('Feature: student-growth-estimator, Property 12: Independencia de tasas por sigla y carrera', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 50 }),
        (repA, repB) => {
          // Same sigla, different carreras
          const rowsA = [
            makeRow({ planEstudio: 'CarreraA', sigla: 'MAT101', gestion: '1/2023', reprobados: repA, totalAlumnos: 100 }),
            makeRow({ planEstudio: 'CarreraA', sigla: 'MAT101', gestion: '2/2023', reprobados: repA, totalAlumnos: 100 }),
          ];
          const rowsB = [
            makeRow({ planEstudio: 'CarreraB', sigla: 'MAT101', gestion: '1/2023', reprobados: repB, totalAlumnos: 100 }),
            makeRow({ planEstudio: 'CarreraB', sigla: 'MAT101', gestion: '2/2023', reprobados: repB, totalAlumnos: 100 }),
          ];

          const tasas = calcularTasas([...rowsA, ...rowsB], makeConfig());
          const tasaA = tasas.find(t => t.sigla === 'MAT101' && t.carrera === 'CarreraA');
          const tasaB = tasas.find(t => t.sigla === 'MAT101' && t.carrera === 'CarreraB');

          expect(tasaA).toBeDefined();
          expect(tasaB).toBeDefined();

          if (tasaA && tasaB && tasaA.estado === 'ok' && tasaB.estado === 'ok') {
            // Each carrera's rate should reflect its own data
            expect(tasaA.tasaReprobacion).toBeCloseTo(repA / 100, 5);
            expect(tasaB.tasaReprobacion).toBeCloseTo(repB / 100, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * Property 13: Marcado de datos insuficientes — < 2 gestiones → datos_insuficientes
   */
  it('Feature: student-growth-estimator, Property 13: Marcado de datos insuficientes — < 2 gestiones → datos_insuficientes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1 }),
        (numGestiones) => {
          const gestiones = ['1/2024', '2/2024'].slice(0, numGestiones);
          const historico = gestiones.map(g => makeRow({ gestion: g }));
          const tasas = calcularTasas(historico, makeConfig());
          const tasa = tasas.find(t => t.sigla === 'MAT101');
          if (tasa) {
            expect(tasa.estado).toBe('datos_insuficientes');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 4.8**
   * Property 13b: Marcado de datos insuficientes — ≥ 2 gestiones → ok
   */
  it('Feature: student-growth-estimator, Property 13b: Marcado de datos insuficientes — ≥ 2 gestiones → ok', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        (numGestiones) => {
          const gestiones = Array.from({ length: numGestiones }, (_, i) =>
            i % 2 === 0 ? `1/${2020 + Math.floor(i / 2)}` : `2/${2020 + Math.floor(i / 2)}`
          );
          const historico = gestiones.map(g => makeRow({ gestion: g, totalAlumnos: 50 }));
          const tasas = calcularTasas(historico, makeConfig());
          const tasa = tasas.find(t => t.sigla === 'MAT101');
          expect(tasa?.estado).toBe('ok');
        }
      ),
      { numRuns: 100 }
    );
  });
});
