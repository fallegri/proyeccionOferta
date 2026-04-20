import { calcularTasas, calcularProyecciones } from '@/lib/processor';
import type { HistoricoRow, MallaRow, ConfigCalculo, OfertaActualRow } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      historico?: HistoricoRow[];
      malla?: MallaRow[];
      config?: ConfigCalculo;
      ofertaActual?: OfertaActualRow[];
    };
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
    const proyecciones = calcularProyecciones(
      body.historico,
      body.malla,
      tasas,
      body.config,
      body.ofertaActual ?? []
    );
    return Response.json(proyecciones);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
