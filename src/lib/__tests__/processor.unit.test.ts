import { describe, it, expect } from 'vitest';
import { calcularTasas, calcularProyecciones } from '../processor';
import type { HistoricoRow, MallaRow, ConfigCalculo } from '../types';

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
    codigoPlanEstudio: 'CP001', planEstudio: 'Sistemas', codigoGestion: 'G1',
    gestion: '1/2024', turno: 'M', grupo: 'A', codigoMateria: 'M1',
    materia: 'Matemáticas', sigla: 'MAT101',
    abandono: 5, reprobados: 10, aprobados: 30, totalAlumnos: 45,
    ...overrides,
  };
}

function makeMalla(overrides: Partial<MallaRow> = {}): MallaRow {
  return {
    carrera: 'Sistemas', semestre: 1, sigla: 'MAT101',
    nombreAsignatura: 'Matemáticas I', requisito: 'ADMISIÓN',
    requiereIngresoManual: false, ...overrides,
  };
}

describe('calcularTasas — unit tests', () => {
  it('concrete example: correct tasa values with 2 gestiones', () => {
    const historico = [
      makeRow({ gestion: '1/2023', reprobados: 20, abandono: 10, totalAlumnos: 100 }),
      makeRow({ gestion: '2/2023', reprobados: 30, abandono: 5, totalAlumnos: 100 }),
    ];
    const tasas = calcularTasas(historico, makeConfig());
    const tasa = tasas.find(t => t.sigla === 'MAT101');
    expect(tasa?.estado).toBe('ok');
    // Average reprobacion: (0.2 + 0.3) / 2 = 0.25
    expect(tasa?.tasaReprobacion).toBeCloseTo(0.25, 5);
    // Average abandono: (0.1 + 0.05) / 2 = 0.075
    expect(tasa?.tasaAbandono).toBeCloseTo(0.075, 5);
    // tasaPromocion = 1 - 0.25 - 0.075 = 0.675
    expect(tasa?.tasaPromocion).toBeCloseTo(0.675, 5);
  });

  it('single gestión → datos_insuficientes', () => {
    const historico = [makeRow({ gestion: '1/2024' })];
    const tasas = calcularTasas(historico, makeConfig());
    expect(tasas[0].estado).toBe('datos_insuficientes');
  });

  it('corrupt data: reprobados > totalAlumnos → rate clamped to 1', () => {
    const historico = [
      makeRow({ gestion: '1/2023', reprobados: 150, abandono: 0, totalAlumnos: 100 }),
      makeRow({ gestion: '2/2023', reprobados: 150, abandono: 0, totalAlumnos: 100 }),
    ];
    const tasas = calcularTasas(historico, makeConfig());
    const tasa = tasas.find(t => t.sigla === 'MAT101');
    expect(tasa?.tasaReprobacion).toBeLessThanOrEqual(1);
    expect(tasa?.tasaReprobacion).toBeGreaterThanOrEqual(0);
  });

  it('division by zero: totalAlumnos = 0 → rate = 0, no crash', () => {
    const historico = [
      makeRow({ gestion: '1/2023', reprobados: 0, abandono: 0, totalAlumnos: 0 }),
      makeRow({ gestion: '2/2023', reprobados: 0, abandono: 0, totalAlumnos: 0 }),
    ];
    expect(() => calcularTasas(historico, makeConfig())).not.toThrow();
    const tasas = calcularTasas(historico, makeConfig());
    const tasa = tasas.find(t => t.sigla === 'MAT101');
    expect(tasa?.tasaReprobacion).toBe(0);
    expect(tasa?.tasaAbandono).toBe(0);
  });

  it('promedio_simple uses last 4 gestiones only', () => {
    // 5 gestiones: first has high rate, last 4 have low rate
    const historico = [
      makeRow({ gestion: '1/2020', reprobados: 90, abandono: 5, totalAlumnos: 100 }),
      makeRow({ gestion: '2/2020', reprobados: 10, abandono: 5, totalAlumnos: 100 }),
      makeRow({ gestion: '1/2021', reprobados: 10, abandono: 5, totalAlumnos: 100 }),
      makeRow({ gestion: '2/2021', reprobados: 10, abandono: 5, totalAlumnos: 100 }),
      makeRow({ gestion: '1/2022', reprobados: 10, abandono: 5, totalAlumnos: 100 }),
    ];
    const tasas = calcularTasas(historico, makeConfig());
    const tasa = tasas.find(t => t.sigla === 'MAT101');
    // Should use last 4: 2/2020, 1/2021, 2/2021, 1/2022 → avg = 0.1
    expect(tasa?.tasaReprobacion).toBeCloseTo(0.1, 5);
  });
});

describe('calcularProyecciones — unit tests', () => {
  it('ADMISIÓN: proyeccion = round(avg of last 4 gestiones)', () => {
    const historico = [
      makeRow({ gestion: '1/2022', totalAlumnos: 40, reprobados: 5, abandono: 3, aprobados: 32 }),
      makeRow({ gestion: '2/2022', totalAlumnos: 50, reprobados: 5, abandono: 3, aprobados: 42 }),
      makeRow({ gestion: '1/2023', totalAlumnos: 60, reprobados: 5, abandono: 3, aprobados: 52 }),
      makeRow({ gestion: '2/2023', totalAlumnos: 70, reprobados: 5, abandono: 3, aprobados: 62 }),
    ];
    const malla = [makeMalla({ requisito: 'ADMISIÓN' })];
    const tasas = calcularTasas(historico, makeConfig());
    const result = calcularProyecciones(historico, malla, tasas, makeConfig());
    const fila = result[0];
    // avg(40, 50, 60, 70) = 55
    expect(fila.proyeccionInscritos).toBe(55);
  });

  it('with prerequisite: proyeccion = floor(inscritosPrereq × tasaPromocion) + reprobadosAnt + abandonosAnt', () => {
    // Use gestionActual = '2/2024' so gestionAnterior = '1/2024'
    // Mark '2/2024' as atipica so the current-period row is excluded from tasa calculation
    const cfg = makeConfig({ gestionActual: '2/2024', gestionSiguiente: '1/2025', gestionesAtipicas: ['2/2024'] });

    // MAT101 tasa history: 4 gestiones, all 20% reprobacion, 10% abandono → tasaPromocion = 0.7
    const historicoPrereq = [
      makeRow({ sigla: 'MAT101', gestion: '1/2022', reprobados: 20, abandono: 10, totalAlumnos: 100 }),
      makeRow({ sigla: 'MAT101', gestion: '2/2022', reprobados: 20, abandono: 10, totalAlumnos: 100 }),
      makeRow({ sigla: 'MAT101', gestion: '1/2023', reprobados: 20, abandono: 10, totalAlumnos: 100 }),
      makeRow({ sigla: 'MAT101', gestion: '2/2023', reprobados: 20, abandono: 10, totalAlumnos: 100 }),
    ];
    // prereq in gestionActual (2/2024): 100 inscritos — used for projection only (excluded from tasa via atipica)
    const prereqActual = makeRow({ sigla: 'MAT101', gestion: '2/2024', totalAlumnos: 100, reprobados: 0, abandono: 0, aprobados: 100 });
    // MAT201 in gestionAnterior (1/2024): 8 reprobados, 3 abandonos
    const materiaAnt = makeRow({ sigla: 'MAT201', gestion: '1/2024', reprobados: 8, abandono: 3, totalAlumnos: 50, aprobados: 39 });
    // second MAT201 row so it has >= 2 gestiones (valid tasa)
    const materiaAnt2 = makeRow({ sigla: 'MAT201', gestion: '2/2023', reprobados: 5, abandono: 2, totalAlumnos: 50, aprobados: 43 });

    const historico = [...historicoPrereq, prereqActual, materiaAnt, materiaAnt2];
    const malla = [makeMalla({ sigla: 'MAT201', requisito: 'MAT101', semestre: 2 })];
    const tasas = calcularTasas(historico, cfg);
    const result = calcularProyecciones(historico, malla, tasas, cfg);

    const fila = result.find(r => r.sigla === 'MAT201');
    expect(fila).toBeDefined();
    // tasaPromocion = 1 - 0.2 - 0.1 = 0.7, inscritosPrereq = 100 → promueven = floor(100 * 0.7) = 70
    // reprobadosAnt = 8, abandonosAnt = 3 → proyeccion = 70 + 8 + 3 = 81
    expect(fila?.proyeccionAlumnosPromueven).toBe(70);
    expect(fila?.proyeccionInscritos).toBe(81);
  });

  it('requiereIngresoManual → proyeccionInscritos null, estadoEspecial set', () => {
    const malla = [makeMalla({ requiereIngresoManual: true })];
    const tasas = calcularTasas([], makeConfig());
    const result = calcularProyecciones([], malla, tasas, makeConfig());
    expect(result[0].proyeccionInscritos).toBeNull();
    expect(result[0].estadoEspecial).toBe('requiere_ingreso_manual');
  });

  it('datos_insuficientes → proyeccionInscritos null, estadoEspecial set', () => {
    const historico = [makeRow({ gestion: '1/2024' })]; // only 1 gestión
    const malla = [makeMalla()];
    const tasas = calcularTasas(historico, makeConfig());
    const result = calcularProyecciones(historico, malla, tasas, makeConfig());
    expect(result[0].proyeccionInscritos).toBeNull();
    expect(result[0].estadoEspecial).toBe('datos_insuficientes');
  });
});
