import { db } from '@/db';
import { proyecciones } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gestion: string }> }
) {
  try {
    const { gestion } = await params;
    const gestionDecoded = decodeURIComponent(gestion);
    const rows = await db.select().from(proyecciones).where(eq(proyecciones.gestionProyectada, gestionDecoded));
    if (rows.length === 0) {
      return Response.json({ error: 'No se encontraron proyecciones para esta gestión' }, { status: 404 });
    }
    const filas = rows.map(r => ({
      carrera: r.carrera,
      nombreAsignatura: r.nombreAsignatura,
      sigla: r.sigla,
      requisito: r.requisito ?? 'ADMISIÓN',
      codigoRequisito: r.codigoRequisito,
      grupo: r.grupo ?? '',
      totalInscritosRequisito: r.totalInscritosRequisito,
      proyeccionReprobadosRequisito: r.proyReprobadosRequisito,
      proyeccionAbandonosRequisito: r.proyAbandonosRequisito,
      proyeccionAlumnosPromueven: r.proyAlumnosPromueven,
      inscritosAsignaturaGestionAnterior: r.inscritosGestionAnterior,
      reprobadosAsignaturaGestionAnterior: r.reprobadosGestionAnterior,
      abandonosAsignaturaGestionAnterior: r.abandonosGestionAnterior,
      totalRepitentesGestionAnterior: r.totalRepitentesGestionAnt,
      proyeccionInscritos: r.proyeccionInscritos,
      editadoManualmente: r.editadoManualmente,
      estadoEspecial: r.estadoEspecial,
    }));
    return Response.json(filas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
