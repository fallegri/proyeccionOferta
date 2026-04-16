import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { generarExcel } from '../exporter';
import type { FilaProyeccion } from '../types';

function makeFila(overrides: Partial<FilaProyeccion> = {}): FilaProyeccion {
  return {
    carrera: 'Sistemas', nombreAsignatura: 'Matemáticas I', sigla: 'MAT101',
    requisito: 'ADMISIÓN', nombreRequisito: 'ADMISIÓN', codigoRequisito: null,
    semestre: 1, grupo: 'A',
    totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
    proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
    inscritosAsignaturaGestionAnterior: 50, reprobadosAsignaturaGestionAnterior: 10,
    abandonosAsignaturaGestionAnterior: 5, totalRepitentesGestionAnterior: 15,
    proyeccionInscritos: 60, editadoManualmente: false, estadoEspecial: null,
    ...overrides,
  };
}

describe('generarExcel — unit tests', () => {
  it('empty filas → workbook with one sheet', () => {
    const { buffer, filename } = generarExcel([], '2/2024');
    expect(filename).toBe('proyeccion_2_2024.xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames.length).toBe(1);
  });

  it('single carrera → one sheet with correct data', () => {
    const filas = [makeFila({ proyeccionInscritos: 75 })];
    const { buffer } = generarExcel(filas, '2/2024');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Sistemas']);
    const ws = wb.Sheets['Sistemas'];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    expect(rows.length).toBe(1);
    expect(rows[0]['PROYECCIÓN DE INSCRITOS']).toBe(75);
  });

  it('two carreras → two sheets', () => {
    const filas = [
      makeFila({ carrera: 'Sistemas', sigla: 'MAT101' }),
      makeFila({ carrera: 'Civil', sigla: 'MAT201' }),
    ];
    const { buffer } = generarExcel(filas, '1/2025');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames.sort()).toEqual(['Civil', 'Sistemas']);
  });

  it('edited value is preserved in Excel', () => {
    const filas = [makeFila({ proyeccionInscritos: 99, editadoManualmente: true })];
    const { buffer } = generarExcel(filas, '2/2024');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    expect(rows[0]['PROYECCIÓN DE INSCRITOS']).toBe(99);
  });

  it('CODIGO REQUISITO is filled with requisito value when codigoRequisito is null', () => {
    const filas = [makeFila({ requisito: 'MAT101', codigoRequisito: null })];
    const { buffer } = generarExcel(filas, '2/2024');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    expect(rows[0]['CODIGO REQUISITO']).toBe('MAT101');
  });

  it('no Grupo column in output', () => {
    const filas = [makeFila()];
    const { buffer } = generarExcel(filas, '2/2024');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    expect(rows[0]).not.toHaveProperty('Grupo');
    expect(rows[0]).not.toHaveProperty('GRUPO');
  });

  it('filename format: 1/2026 → proyeccion_1_2026.xlsx', () => {
    const { filename } = generarExcel([], '1/2026');
    expect(filename).toBe('proyeccion_1_2026.xlsx');
  });

  it('filename format: 2/2025 → proyeccion_2_2025.xlsx', () => {
    const { filename } = generarExcel([], '2/2025');
    expect(filename).toBe('proyeccion_2_2025.xlsx');
  });
});
