import { calcularTasas, calcularProyecciones } from '@/lib/processor';
import type { HistoricoRow, MallaRow, ConfigCalculo } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { historico?: HistoricoRow[]; malla?: MallaRow[]; config?: ConfigCalculo };
    if (!body.historico || body.historico.length === 0) {
      return Response.json({ error: 'Falta el archivo histórico' }, { status: 400 });
    }
    if (!body.malla || body.malla.length === 0) {
      return Response.json({ error: 'Falta el archivo de malla curricular' }, { status: 400 });
    }
    if (!body.config?.gestionActual) {
      return Response.json({ error: 'Falta la gestión actual' }, { status: 400 });
    }

    const tasas = calcularTasas(body.historico, body.config);
    const proyecciones = calcularProyecciones(body.historico, body.malla, tasas, body.config);

    // Attach diagnostics in response header for debugging
    const planEstudios = [...new Set(body.historico.map(r => r.planEstudio))];
    const carreras = [...new Set(body.malla.map(r => r.carrera))];
    const gestiones = [...new Set(body.historico.map(r => r.gestion))].sort();
    const tasasOk = tasas.filter(t => t.estado === 'ok').length;
    const conValor = proyecciones.filter(p => p.proyeccionInscritos !== null && (p.proyeccionInscritos as number) > 0).length;

    const diag = {
      historicoRows: body.historico.length,
      mallaRows: body.malla.length,
      planEstudiosEnHistorico: planEstudios,
      carrerasEnMalla: carreras,
      gestionesEnHistorico: gestiones,
      gestionActual: body.config.gestionActual,
      tasasTotal: tasas.length,
      tasasOk,
      tasasInsuficientes: tasas.length - tasasOk,
      proyeccionesConValor: conValor,
      proyeccionesTotal: proyecciones.length,
      primerHistorico: body.historico[0],
      primerMalla: body.malla[0],
    };

    return Response.json({ proyecciones, diag });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
