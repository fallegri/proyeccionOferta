import { db } from '@/db';
import { proyecciones } from '@/db/schema';
import { sql } from 'drizzle-orm';
import type { FilaProyeccion } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { filas?: FilaProyeccion[]; gestion?: string };
    if (!body.filas || !body.gestion) {
      return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    for (const fila of body.filas) {
      await db.insert(proyecciones).values({
        gestionProyectada: body.gestion,
        carrera: fila.carrera,
        sigla: fila.sigla,
        nombreAsignatura: fila.nombreAsignatura,
        requisito: fila.requisito,
        codigoRequisito: fila.codigoRequisito,
        grupo: fila.grupo,
        totalInscritosRequisito: fila.totalInscritosRequisito,
        proyReprobadosRequisito: fila.proyeccionReprobadosRequisito,
        proyAbandonosRequisito: fila.proyeccionAbandonosRequisito,
        proyAlumnosPromueven: fila.proyeccionAlumnosPromueven,
        inscritosGestionAnterior: fila.inscritosAsignaturaGestionAnterior,
        reprobadosGestionAnterior: fila.reprobadosAsignaturaGestionAnterior,
        abandonosGestionAnterior: fila.abandonosAsignaturaGestionAnterior,
        totalRepitentesGestionAnt: fila.totalRepitentesGestionAnterior,
        proyeccionInscritos: fila.proyeccionInscritos,
        editadoManualmente: fila.editadoManualmente,
        estadoEspecial: fila.estadoEspecial,
      }).onConflictDoUpdate({
        target: [proyecciones.gestionProyectada, proyecciones.carrera, proyecciones.sigla],
        set: {
          proyeccionInscritos: sql`excluded.proyeccion_inscritos`,
          editadoManualmente: sql`excluded.editado_manualmente`,
          estadoEspecial: sql`excluded.estado_especial`,
        },
      });
    }
    return Response.json({ ok: true, guardadas: body.filas.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
