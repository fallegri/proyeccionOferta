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

    // Temporary diagnostics — remove after debugging
    const oferta = body.ofertaActual ?? [];
    const primerOferta = oferta[0];
    const nsemValues = [...new Set(oferta.map(o => o.nsem))].sort((a, b) => a - b);
    const semestresProyectados = [...new Set(nsemValues.map(s => s + 1))].sort((a, b) => a - b);
    const semestresEnProyeccion = [...new Set(proyecciones.map(p => p.semestre))].sort((a, b) => (a ?? 0) - (b ?? 0));

    return Response.json({
      proyecciones,
      _diag: {
        ofertaRows: oferta.length,
        primerOferta,
        nsemEnOferta: nsemValues,
        semestresProyectadosEsperados: semestresProyectados,
        semestresEnProyeccion,
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return Response.json({ error: msg }, { status: 500 });
  }
}
