import { parseMalla } from '@/lib/importer';
import { db } from '@/db';
import { mallas } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return Response.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = parseMalla(buffer);
    if (result.errores.length > 0) {
      return Response.json({ error: result.errores[0], details: result.errores }, { status: 400 });
    }
    if (result.rows.length > 0) {
      for (const row of result.rows) {
        await db.insert(mallas).values({
          carrera: row.carrera,
          semestre: row.semestre,
          sigla: row.sigla,
          nombre: row.nombreAsignatura,
          requisito: row.requisito === 'ADMISIÓN' ? null : row.requisito,
          requiereIngresoManual: row.requiereIngresoManual,
        }).onConflictDoUpdate({
          target: [mallas.carrera, mallas.sigla],
          set: {
            semestre: sql`excluded.semestre`,
            nombre: sql`excluded.nombre`,
            requisito: sql`excluded.requisito`,
            requiereIngresoManual: sql`excluded.requiere_ingreso_manual`,
          },
        });
      }
    }
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
