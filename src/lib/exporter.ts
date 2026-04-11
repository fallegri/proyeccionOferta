import * as XLSX from 'xlsx';
import type { FilaProyeccion } from './types';

const COLUMNS = [
  { header: 'Carrera', key: 'carrera' },
  { header: 'Nombre Asignatura', key: 'nombreAsignatura' },
  { header: 'Código', key: 'sigla' },
  { header: 'Requisito', key: 'requisito' },
  { header: 'Código Requisito', key: 'codigoRequisito' },
  { header: 'Grupo', key: 'grupo' },
  { header: 'Total Inscritos en el Requisito', key: 'totalInscritosRequisito' },
  { header: 'Proyección Reprobados Requisito', key: 'proyeccionReprobadosRequisito' },
  { header: 'Proyección Abandonos en el Requisito', key: 'proyeccionAbandonosRequisito' },
  { header: 'Proyección Alumnos que Promueven', key: 'proyeccionAlumnosPromueven' },
  { header: 'Alumnos Inscritos en la Asignatura en Gestión Anterior', key: 'inscritosAsignaturaGestionAnterior' },
  { header: 'Reprobados en la Asignatura en la Gestión Anterior', key: 'reprobadosAsignaturaGestionAnterior' },
  { header: 'Abandonos en la Asignatura en la Gestión Anterior', key: 'abandonosAsignaturaGestionAnterior' },
  { header: 'Total Repitentes en la Asignatura de la Gestión Anterior', key: 'totalRepitentesGestionAnterior' },
  { header: 'Proyección de Inscritos', key: 'proyeccionInscritos' },
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
    const data = rows.map(fila =>
      Object.fromEntries(COLUMNS.map(col => [col.header, fila[col.key] ?? null]))
    );
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
