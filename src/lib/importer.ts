import * as XLSX from 'xlsx';
import type { HistoricoRow, MallaRow, ImportResult } from './types';

// Normaliza un nombre de columna: minúsculas, sin tildes, sin espacios extra
function normalizeCol(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Construye un mapa de columna normalizada -> clave real en el objeto raw
function buildColMap(firstRow: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(firstRow)) {
    map.set(normalizeCol(key), key);
  }
  return map;
}

// Semestre en texto -> número
const SEMESTRE_MAP: Record<string, number> = {
  'primer semestre': 1, 'primero': 1, '1': 1,
  'segundo semestre': 2, 'segundo': 2, '2': 2,
  'tercer semestre': 3, 'tercero': 3, '3': 3,
  'cuarto semestre': 4, 'cuarto': 4, '4': 4,
  'quinto semestre': 5, 'quinto': 5, '5': 5,
  'sexto semestre': 6, 'sexto': 6, '6': 6,
  'septimo semestre': 7, 'septimo': 7, '7': 7,
  'octavo semestre': 8, 'octavo': 8, '8': 8,
  'noveno semestre': 9, 'noveno': 9, '9': 9,
  'decimo semestre': 10, 'decimo': 10, '10': 10,
};

function parseSemestre(val: unknown): number {
  if (val == null) return 0;
  const n = Number(val);
  if (!isNaN(n) && n > 0) return n;
  const normalized = normalizeCol(String(val));
  return SEMESTRE_MAP[normalized] ?? 0;
}

// Columnas requeridas del histórico (normalizadas) — Grupo ya NO es requerida
const HISTORICO_REQUIRED_NORMALIZED = [
  'codigo plan estudio',
  'plan estudio',
  'gestion',
  'sigla',
  'abandono',
  'reprobados',
  'aprobados',
  'total alumnos',
];

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

  const colMap = buildColMap(rawRows[0]);

  // Detectar columnas faltantes (case-insensitive)
  const missingCols = HISTORICO_REQUIRED_NORMALIZED.filter(norm => !colMap.has(norm));
  if (missingCols.length > 0) {
    return { rows: [], omitidas: 0, resumen: '', errores: [`Columnas faltantes: ${missingCols.join(', ')}`] };
  }

  // Helper para leer un campo por nombre normalizado
  const get = (raw: Record<string, unknown>, norm: string) => {
    const key = colMap.get(norm);
    return key ? raw[key] : null;
  };

  const rows: HistoricoRow[] = [];
  let omitidas = 0;

  for (const raw of rawRows) {
    const sigla = get(raw, 'sigla');
    const gestion = get(raw, 'gestion');
    const codigoPlan = get(raw, 'codigo plan estudio');

    if (!sigla || !gestion || !codigoPlan) {
      omitidas++;
      continue;
    }

    rows.push({
      codigoPlanEstudio: String(codigoPlan),
      planEstudio: String(get(raw, 'plan estudio') ?? ''),
      codigoGestion: String(get(raw, 'codigo gestion') ?? ''),
      gestion: String(gestion),
      turno: String(get(raw, 'turno') ?? ''),
      grupo: String(get(raw, 'grupo') ?? ''),
      codigoMateria: String(get(raw, 'codigo materia') ?? ''),
      materia: String(get(raw, 'materia') ?? ''),
      sigla: String(sigla),
      abandono: Number(get(raw, 'abandono') ?? 0),
      reprobados: Number(get(raw, 'reprobados') ?? 0),
      aprobados: Number(get(raw, 'aprobados') ?? 0),
      totalAlumnos: Number(get(raw, 'total alumnos') ?? 0),
    });
  }

  const carreras = new Set(rows.map(r => r.planEstudio));
  const gestiones = rows.map(r => r.gestion).sort();
  const gestionMin = gestiones[0] ?? '';
  const gestionMax = gestiones[gestiones.length - 1] ?? '';
  const resumen = `${rows.length} registros cargados, ${carreras.size} carrera(s), gestiones: ${gestionMin} – ${gestionMax}`;

  return { rows, omitidas, resumen, errores: [] };
}

// Columnas requeridas de la malla (normalizadas)
const MALLA_REQUIRED_NORMALIZED = ['carrera', 'sigla', 'nombre asignatura', 'requisito', 'semestre'];

const NON_STRUCTURED_PATTERN = /\b(todas|todos|aprobadas|aprobados|hasta|completo|completa|sem\.|semestre)\b/i;

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

  const colMap = buildColMap(rawRows[0]);

  const missingCols = MALLA_REQUIRED_NORMALIZED.filter(norm => !colMap.has(norm));
  if (missingCols.length > 0) {
    return { rows: [], omitidas: 0, resumen: '', errores: [`Columnas faltantes: ${missingCols.join(', ')}`] };
  }

  const get = (raw: Record<string, unknown>, norm: string) => {
    const key = colMap.get(norm);
    return key ? raw[key] : null;
  };

  const rows: MallaRow[] = [];
  let omitidas = 0;

  for (const raw of rawRows) {
    const carrera = get(raw, 'carrera');
    const sigla = get(raw, 'sigla');
    const nombreAsignatura = get(raw, 'nombre asignatura');
    const semestreRaw = get(raw, 'semestre');

    if (!carrera || !sigla || !nombreAsignatura) {
      omitidas++;
      continue;
    }

    const semestre = parseSemestre(semestreRaw);
    const requisitoRaw = get(raw, 'requisito');
    const requisitoStr = requisitoRaw != null ? String(requisitoRaw).trim() : '';

    // "Admisión" / "ADMISIÓN" / vacío = sin prerrequisito
    const isAdmision = !requisitoStr || /^admisi[oó]n$/i.test(requisitoStr);

    if (isAdmision) {
      rows.push({
        carrera: String(carrera),
        semestre,
        sigla: String(sigla),
        nombreAsignatura: String(nombreAsignatura),
        requisito: 'ADMISIÓN',
        requiereIngresoManual: false,
      });
    } else if (NON_STRUCTURED_PATTERN.test(requisitoStr)) {
      rows.push({
        carrera: String(carrera),
        semestre,
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
          semestre,
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
