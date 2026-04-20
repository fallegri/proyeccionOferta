'use client';
import { useAppStore } from '@/store/appStore';
import { UploadPanel } from '@/components/UploadPanel';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ResultsTable } from '@/components/ResultsTable';
import { ExportButton } from '@/components/ExportButton';

export default function Home() {
  const { state, dispatch } = useAppStore();
  const { paso, historicoRows, mallaRows, ofertaActualRows, cargando, errores } = state;

  async function handleCalcular() {
    if (!state.config) return;
    dispatch({ type: 'SET_CARGANDO', payload: true });
    dispatch({ type: 'SET_ERRORES', payload: [] });
    try {
      const res = await fetch('/api/proyeccion/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historico: historicoRows,
          malla: mallaRows,
          config: state.config,
          ofertaActual: ofertaActualRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: 'SET_ERRORES', payload: [(data as { error: string }).error ?? 'Error al calcular'] });
      } else {
        const payload = data as { proyecciones?: unknown[]; _diag?: Record<string, unknown> } | unknown[];
        const proyecciones = Array.isArray(payload) ? payload : ((payload as { proyecciones?: unknown[] }).proyecciones ?? []);
        const diag = Array.isArray(payload) ? null : (payload as { _diag?: Record<string, unknown> })._diag;
        if (diag) {
          console.log('[DIAG semestres]', JSON.stringify(diag, null, 2));
          // Show in UI temporarily
          dispatch({ type: 'SET_ERRORES', payload: [
            `DIAG: ofertaRows=${diag.ofertaRows} | nsemEnOferta=${JSON.stringify(diag.nsemEnOferta)} | esperados=${JSON.stringify(diag.semestresProyectadosEsperados)} | enProyeccion=${JSON.stringify(diag.semestresEnProyeccion)} | primerOferta.nsem=${(diag.primerOferta as Record<string,unknown>)?.nsem}`
          ]});
        }
        dispatch({ type: 'SET_RESULTADOS', payload: proyecciones as import('@/lib/types').FilaProyeccion[] });
        dispatch({ type: 'SET_PASO', payload: 'resultados' });
      }
    } catch {
      dispatch({ type: 'SET_ERRORES', payload: ['Error de red al calcular proyecciones'] });
    } finally {
      dispatch({ type: 'SET_CARGANDO', payload: false });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Estimador de Crecimiento Estudiantil</h1>

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          {errores.map((e, i) => <p key={i} className="text-red-700 text-sm font-medium">{e}</p>)}
        </div>
      )}

      {/* Step 1: Upload */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <UploadPanel />
        {paso === 'carga' && historicoRows.length > 0 && mallaRows.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'SET_PASO', payload: 'config' })}
            className="mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Continuar a Configuración →
          </button>
        )}
      </section>

      {/* Step 2: Config */}
      {(paso === 'config' || paso === 'resultados') && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <ConfigPanel onNext={handleCalcular} />
          {cargando && <p className="mt-2 text-slate-600 text-sm">Calculando proyecciones...</p>}
        </section>
      )}

      {/* Step 3: Results */}
      {paso === 'resultados' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <ResultsTable />
          <ExportButton />
        </section>
      )}
    </main>
  );
}
