import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calcularTasas, calcularProyecciones } from '../processor';
import type { HistoricoRow, MallaRow, ConfigCalculo, TasaMateria } from '../types';

function makeConfig(overrides: Partial<ConfigCalculo> = {}): ConfigCalculo {
  return {
    gestionActual: '1/2024',
    gestionSiguiente: '2/2024',
    gestionesAtipicas: [],
    metodo: 'promedio_simple',
    ...overrides,
  };
}

function makeHistoricoRow(overrides: Partial<HistoricoRow> = {}): HistoricoRow {
  return {
    codigoPlanEstudio: 'CP001', planEstudio: 'Sistemas', codigoGestion: 'G1',
    gestion: '1/2024', turno: 'M', grupo: 'A', codigoMateria: 'M1',
    materia: 'Matemáticas', sigla: 'MAT101', abandono: 5, reprobados: 10,
    aprobados: 30, totalAlumnos: 45, ...overrides,
  };
}

function makeMallaRow(overrides: Partial<MallaRow> = {}): MallaRow {
  return {
    carrera: 'Sistemas', semestre: 1, sigla: 'MAT101',
    nombreAsignatura: 'Matemáticas I', requisito: 'ADMISIÓN',
    requiereIngresoManual: false, ...overrides,
  };
}

// Build enough historico for calcularTasas to return 'ok' for a sigla
function makeHistoricoForTasas(sigla: string, carrera: string, gestiones: string[], repRate = 0.2, abaRate = 0.1): HistoricoRow[] {
  return gestiones.map(g => makeHistoricoRow({
    sigla, planEstudio: carrera, gestion: g,
    reprobados: Math.round(100 * repRate), abandono: Math.round(100 * abaRate),
    aprobados: Math.round(100 * (1 - repRate - abaRate)), totalAlumnos: 100,
  }));
}

describe('Feature: student-growth-estimator — Proyecciones Property Tests', () => {
  it('Feature: student-growth-estimator, Property 9: Validación de gestión anterior — no crash cuando falta', () => {
    // Validates: Requirements 1.9
    fc.assert(
      fc.property(
        fc.boolean(),
        (includeGestionAnterior) => {
          const malla = [makeMallaRow({ requisito: 'ADMISIÓN' })];
          const historico: HistoricoRow[] = [
            ...makeHistoricoForTasas('MAT101', 'Sistemas', ['1/2023', '2/2023', '1/2024', '2/2024']),
          ];
          if (!includeGestionAnterior) {
            // Remove gestion anterior (2/2023 for gestionActual=1/2024)
            const filtered = historico.filter(r => r.gestion !== '2/2023');
            const tasas = calcularTasas(filtered, makeConfig());
            expect(() => calcularProyecciones(filtered, malla, tasas, makeConfig())).not.toThrow();
          } else {
            const tasas = calcularTasas(historico, makeConfig());
            const result = calcularProyecciones(historico, malla, tasas, makeConfig());
            expect(result.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 14: Corrección de la fórmula de proyección con prerrequisito', () => {
    // Validates: Requirements 1.14
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 200 }),  // inscritosPrereq
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.3) }),  // repRate
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.2) }),  // abaRate
        (inscritosPrereq, repRate, abaRate) => {
          const carrera = 'Sistemas';
          const prereqSigla = 'MAT101';
          const sigla = 'MAT201';

          // Build historico for prereq tasa calculation
          const historicoPrereq = makeHistoricoForTasas(prereqSigla, carrera, ['1/2022', '2/2022', '1/2023', '2/2023'], repRate, abaRate);
          // Add prereq in gestionActual
          const prereqActual = makeHistoricoRow({ sigla: prereqSigla, planEstudio: carrera, gestion: '1/2024', totalAlumnos: inscritosPrereq, reprobados: 0, abandono: 0, aprobados: inscritosPrereq });
          // Add materia in gestion anterior (2/2023)
          const reprobadosAnt = 8;
          const abandonosAnt = 3;
          const materiaAnt = makeHistoricoRow({ sigla, planEstudio: carrera, gestion: '2/2023', reprobados: reprobadosAnt, abandono: abandonosAnt, totalAlumnos: 50 });

          const historico = [...historicoPrereq, prereqActual, materiaAnt];
          const malla = [makeMallaRow({ sigla, requisito: prereqSigla, semestre: 2 })];

          const tasas = calcularTasas(historico, makeConfig());
          const result = calcularProyecciones(historico, malla, tasas, makeConfig());

          const fila = result.find(r => r.sigla === sigla);
          if (!fila || fila.estadoEspecial) return; // skip if special state

          const tasaPrereq = tasas.find(t => t.sigla === prereqSigla && t.carrera === carrera);
          if (!tasaPrereq || tasaPrereq.estado !== 'ok') return;

          const expectedPromueven = Math.floor(inscritosPrereq * tasaPrereq.tasaPromocion);
          const expectedProyeccion = expectedPromueven + reprobadosAnt + abandonosAnt;

          expect(fila.proyeccionInscritos).toBe(expectedProyeccion);
          expect(fila.proyeccionAlumnosPromueven).toBe(expectedPromueven);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 15: Base de proyección para materias sin prerrequisito', () => {
    // Validates: Requirements 1.15
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 20, max: 100 }), { minLength: 2, maxLength: 6 }),
        (totalAlumnosList) => {
          const carrera = 'Sistemas';
          const sigla = 'MAT101';
          const gestiones = totalAlumnosList.map((_, i) =>
            i % 2 === 0 ? `1/${2020 + Math.floor(i / 2)}` : `2/${2020 + Math.floor(i / 2)}`
          );

          const historico = totalAlumnosList.map((total, i) =>
            makeHistoricoRow({ sigla, planEstudio: carrera, gestion: gestiones[i], totalAlumnos: total, reprobados: 5, abandono: 3, aprobados: total - 8 })
          );

          const malla = [makeMallaRow({ sigla, requisito: 'ADMISIÓN' })];
          const tasas = calcularTasas(historico, makeConfig());
          const result = calcularProyecciones(historico, malla, tasas, makeConfig());

          const fila = result.find(r => r.sigla === sigla);
          if (!fila || fila.estadoEspecial) return;

          // Expected: average of last 4 non-atypical gestiones, rounded
          const sorted = [...gestiones].sort((a, b) => {
            const [na, ya] = a.split('/').map(Number);
            const [nb, yb] = b.split('/').map(Number);
            return ya !== yb ? ya - yb : na - nb;
          });
          const last4 = sorted.slice(-4);
          const byGestion = new Map(gestiones.map((g, i) => [g, totalAlumnosList[i]]));
          const expected = Math.round(last4.reduce((s, g) => s + byGestion.get(g)!, 0) / last4.length);

          expect(fila.proyeccionInscritos).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 16: Materias con estado especial tienen proyección vacía', () => {
    // Validates: Requirements 1.16
    fc.assert(
      fc.property(
        fc.constantFrom('requiere_ingreso_manual' as const, 'datos_insuficientes' as const),
        (estadoEspecial) => {
          const malla = [makeMallaRow({
            requiereIngresoManual: estadoEspecial === 'requiere_ingreso_manual',
          })];

          let tasas: TasaMateria[];
          let historico: HistoricoRow[];

          if (estadoEspecial === 'datos_insuficientes') {
            // Only 1 gestión → datos_insuficientes
            historico = [makeHistoricoRow({ gestion: '1/2024' })];
            tasas = calcularTasas(historico, makeConfig());
          } else {
            historico = makeHistoricoForTasas('MAT101', 'Sistemas', ['1/2023', '2/2023', '1/2024', '2/2024']);
            tasas = calcularTasas(historico, makeConfig());
          }

          const result = calcularProyecciones(historico, malla, tasas, makeConfig());
          const fila = result.find(r => r.sigla === 'MAT101');

          expect(fila).toBeDefined();
          expect(fila!.proyeccionInscritos).toBeNull();
          expect(fila!.estadoEspecial).toBe(estadoEspecial);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Feature: student-growth-estimator, Property 17: Estructura completa de FilaProyeccion', () => {
    // Validates: Requirements 1.17
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (numMaterias) => {
          const malla = Array.from({ length: numMaterias }, (_, i) =>
            makeMallaRow({ sigla: `MAT${100 + i}`, nombreAsignatura: `Materia ${i}` })
          );
          const historico = malla.flatMap(m =>
            makeHistoricoForTasas(m.sigla, m.carrera, ['1/2022', '2/2022', '1/2023', '2/2023'])
          );
          const tasas = calcularTasas(historico, makeConfig());
          const result = calcularProyecciones(historico, malla, tasas, makeConfig());

          const requiredFields: (keyof import('../types').FilaProyeccion)[] = [
            'carrera', 'nombreAsignatura', 'sigla', 'requisito',
            'codigoRequisito', 'grupo', 'totalInscritosRequisito',
            'proyeccionReprobadosRequisito', 'proyeccionAbandonosRequisito',
            'proyeccionAlumnosPromueven', 'inscritosAsignaturaGestionAnterior',
            'reprobadosAsignaturaGestionAnterior', 'abandonosAsignaturaGestionAnterior',
            'totalRepitentesGestionAnterior', 'proyeccionInscritos',
            'editadoManualmente', 'estadoEspecial',
          ];

          for (const fila of result) {
            for (const field of requiredFields) {
              expect(fila).toHaveProperty(field);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
