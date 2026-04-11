import * as XLSX from 'xlsx';
import type { HistoricoRow, MallaRow, ImportResult } from './types';

const HISTORICO_COLUMNS: Record<string, keyof HistoricoRow> = {
  'Código Plan Estudio': 'codigoPlanEstudio',
  'Plan Estudio': 'planEstudio',
  'Código Gestión': 'codigoGestion',
  'Gestión': 'gestion',
  'Turno': 'turno',
  'Grupo': 'grupo',
  'Código Materia': 'codigoMateria',
  'Materia': 'materia',
  'Sigla': 'sigla',
  'Abandono': 'abandono',
  'Reprobados': 'reprobados',
  'Aprobados': 'aprobados',
  'Total Alumnos': 'totalAlumnos',
};

export function parseHistorico(buffer: Buffer): ImportResult<HistoricoRow> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { rows: [], omitidas: 0, resumen: '', errores: ['Archivo no válido o formato no soportado. Use .xlsx o .xls'] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], omitidas: 0, resumen: '', errores: ['El archivo está vacío o no contiene hojas'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rawRows.length === 0) {
    return { rows: [], omitidas: 0, resumen: 'Sin registros', errores: [] };
  }

  // Detect missing columns
  const firstRow = rawRows[0];
  const missingCols = Object.keys(HISTORICO_COLUMNS).filter(col => !(col in firstRow));
  if (missingCols.length > 0) {
    return { rows: [], omitidas: 0, resumen: '', errores: [`Columnas faltantes: ${missingCols.join(', ')}`] };
  }

  const rows: HistoricoRow[] = [];
  let omitidas = 0;

  for (const raw of rawRows) {
    const sigla = raw['Sigla'];
    const gestion = raw['Gestión'];
    const codigoPlan = raw['Código Plan Estudio'];

    if (!sigla || !gestion || !codigoPlan) {
      omitidas++;
      continue;
    }

    rows.push({
      codigoPlanEstudio: String(codigoPlan),
      planEstudio: String(raw['Plan Estudio'] ?? ''),
      codigoGestion: String(raw['Código Gestión'] ?? ''),
      gestion: String(gestion),
      turno: String(raw['Turno'] ?? ''),
      grupo: String(raw['Grupo'] ?? ''),
      codigoMateria: String(raw['Código Materia'] ?? ''),
      materia: String(raw['Materia'] ?? ''),
      sigla: String(sigla),
      abandono: Number(raw['Abandono'] ?? 0),
      reprobados: Number(raw['Reprobados'] ?? 0),
      aprobados: Number(raw['Aprobados'] ?? 0),
      totalAlumnos: Number(raw['Total Alumnos'] ?? 0),
    });
  }

  const carreras = new Set(rows.map(r => r.planEstudio));
  const gestiones = rows.map(r => r.gestion).sort();
  const gestionMin = gestiones[0] ?? '';
  const gestionMax = gestiones[gestiones.length - 1] ?? '';
  const resumen = `${rows.length} registros cargados, ${carreras.size} carrera(s), gestiones: ${gestionMin} – ${gestionMax}`;

  return { rows, omitidas, resumen, errores: [] };
}

const MALLA_REQUIRED_COLS = ['Carrera', 'Semestre', 'Sigla', 'Nombre Asignatura', 'Requisito'];

const NON_STRUCTURED_PATTERN = /\b(todas|todos|aprobadas|aprobados|hasta|completo|completa)\b/i;

export function parseMalla(buffer: Buffer): ImportResult<MallaRow> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { rows: [], omitidas: 0, resumen: '', errores: ['Archivo no válido o formato no soportado. Use .xlsx o .xls'] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], omitidas: 0, resumen: '', errores: ['El archivo está vacío o no contiene hojas'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rawRows.length === 0) {
    return { rows: [], omitidas: 0, resumen: 'Sin registros', errores: [] };
  }

  const firstRow = rawRows[0];
  const missingCols = MALLA_REQUIRED_COLS.filter(col => !(col in firstRow));
  if (missingCols.length > 0) {
    return { rows: [], omitidas: 0, resumen: '', errores: [`Columnas faltantes: ${missingCols.join(', ')}`] };
  }

  const rows: MallaRow[] = [];
  let omitidas = 0;

  for (const raw of rawRows) {
    const carrera = raw['Carrera'];
    const sigla = raw['Sigla'];
    const nombreAsignatura = raw['Nombre Asignatura'];
    const semestre = raw['Semestre'];

    if (!carrera || !sigla || !nombreAsignatura) {
      omitidas++;
      continue;
    }

    const requisitoRaw = raw['Requisito'];
    const requisitoStr = requisitoRaw != null ? String(requisitoRaw).trim() : '';

    if (!requisitoStr) {
      rows.push({
        carrera: String(carrera),
        semestre: Number(semestre ?? 1),
        sigla: String(sigla),
        nombreAsignatura: String(nombreAsignatura),
        requisito: 'ADMISIÓN',
        requiereIngresoManual: false,
      });
    } else if (NON_STRUCTURED_PATTERN.test(requisitoStr)) {
      rows.push({
        carrera: String(carrera),
        semestre: Number(semestre ?? 1),
        sigla: String(sigla),
        nombreAsignatura: String(nombreAsignatura),
        requisito: requisitoStr,
        requiereIngresoManual: true,
      });
    } else {
      const prereqs = requisitoStr.split(',').map(s => s.trim()).filter(Boolean);
      for (const prereq of prereqs) {
        rows.push({
          carrera: String(carrera),
          semestre: Number(semestre ?? 1),
          sigla: String(sigla),
          nombreAsignatura: String(nombreAsignatura),
          requisito: prereq,
          requiereIngresoManual: false,
        });
      }
    }
  }

  const carreras = new Set(rows.map(r => r.carrera));
  const resumen = `${rows.length} materias cargadas, ${carreras.size} carrera(s)`;

  return { rows, omitidas, resumen, errores: [] };
}
