import * as XLSX from 'xlsx';
import type { FilaProyeccion } from './types';

// Columnas en el orden exacto del formato esperado
const COLUMNS = [
  { header: 'CARRERA',                                                          key: 'carrera' },
  { header: 'NOMBRE ASIGNATURA',                                                key: 'nombreAsignatura' },
  { header: 'CODIGO',                                                           key: 'sigla' },
  { header: 'Materia REQUISITO',                                                key: 'nombreRequisito' },
  { header: 'CODIGO REQUISITO',                                                 key: 'codigoRequisito' },
  { header: 'SEMESTRE NOMBRE ASIGNATURA EN LA MALLA',                           key: 'semestre' },
  { header: 'TURNO',                                                            key: 'turno' },
  { header: 'TOTAL INSCRITOS EN EL REQUISITO',                                  key: 'totalInscritosRequisito' },
  { header: 'PROYECCIÓN REPROBADOS REQUISITO',                                  key: 'proyeccionReprobadosRequisito' },
  { header: 'PROYECCIÓN ABANDONOS EN EL REQUISITO',                             key: 'proyeccionAbandonosRequisito' },
  { header: 'PROYECCIÓN ALUMNOS QUE PROMUEVEN',                                 key: 'proyeccionAlumnosPromueven' },
  { header: 'ALUMNOS INSCRITOS EN LA ASIGNATURA EN GESTIÓN ANTERIOR',           key: 'inscritosAsignaturaGestionAnterior' },
  { header: 'REPROBADOS EN LA ASIGNATURA EN LA GESTIÓN ANTERIOR',               key: 'reprobadosAsignaturaGestionAnterior' },
  { header: 'ABANDONOS EN LA ASIGNATURA EN LA GESTIÓN ANTERIOR',                key: 'abandonosAsignaturaGestionAnterior' },
  { header: 'TOTAL REPITENTES EN LA ASIGNATURA DE LA GESTIÓN ANTERIOR',         key: 'totalRepitentesGestionAnterior' },
  { header: 'PROYECCIÓN DE INSCRITOS',                                          key: 'proyeccionInscritos' },
] as const;

export function generarExcel(
  filas: FilaProyeccion[],
  gestionSiguiente: string
): { buffer: Buffer; filename: string } {
  const wb = XLSX.utils.book_new();

  // Group by carrera
  const byCarrera = new Map<string, FilaProyeccion[]>();
  for (const fila of filas) {
    if (!byCarrera.has(fila.carrera)) byCarrera.set(fila.carrera, []);
    byCarrera.get(fila.carrera)!.push(fila);
  }

  for (const [carrera, rows] of byCarrera) {
    const data = rows.map(fila => {
      const row: Record<string, unknown> = {};
      for (const col of COLUMNS) {
        if (col.key === 'codigoRequisito') {
          // CODIGO REQUISITO = sigla del prerrequisito (o ADMISIÓN)
          row[col.header] = fila.codigoRequisito ?? fila.requisito ?? null;
        } else {
          row[col.header] = (fila[col.key] as unknown) ?? null;
        }
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: COLUMNS.map(c => c.header) });
    const sheetName = carrera.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (byCarrera.size === 0) {
    const ws = XLSX.utils.json_to_sheet([], { header: COLUMNS.map(c => c.header) });
    XLSX.utils.book_append_sheet(wb, ws, 'Sin datos');
  }

  const filename = `proyeccion_${gestionSiguiente.replace('/', '_')}.xlsx`;
  const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  return { buffer, filename };
}
