'use client';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { UploadPanel } from '@/components/UploadPanel';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ResultsTable } from '@/components/ResultsTable';
import { ExportButton } from '@/components/ExportButton';
import type { FilaProyeccion } from '@/lib/types';

export default function Home() {
  const { state, dispatch } = useAppStore();
  const { paso, historicoRows, mallaRows, cargando, errores } = state;
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);

  async function handleCalcular() {
    if (!state.config) return;
    dispatch({ type: 'SET_CARGANDO', payload: true });
    dispatch({ type: 'SET_ERRORES', payload: [] });
    setDiag(null);
    try {
      const res = await fetch('/api/proyeccion/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          historico: historicoRows,
          malla: mallaRows,
          config: state.config,
        }),
      });
      const data = await res.json() as { proyecciones?: FilaProyeccion[]; diag?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        dispatch({ type: 'SET_ERRORES', payload: [data.error ?? 'Error al calcular'] });
      } else {
        // Handle both old format (array) and new format ({proyecciones, diag})
        const proyecciones = Array.isArray(data) ? data : (data.proyecciones ?? []);
        if (data.diag) setDiag(data.diag);
        dispatch({ type: 'SET_RESULTADOS', payload: proyecciones });
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

      {/* DIAGNOSTIC PANEL — remove after debugging */}
      {diag && (
        <section className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs font-mono space-y-1">
          <p className="font-bold text-amber-800 text-sm">🔍 Diagnóstico</p>
          <p><strong>Histórico filas:</strong> {String(diag.historicoRows)}</p>
          <p><strong>Malla filas:</strong> {String(diag.mallaRows)}</p>
          <p><strong>Gestión actual:</strong> {String(diag.gestionActual)}</p>
          <p><strong>Gestiones en histórico:</strong> {JSON.stringify(diag.gestionesEnHistorico)}</p>
          <p><strong>planEstudio en histórico:</strong> {JSON.stringify(diag.planEstudiosEnHistorico)}</p>
          <p><strong>carrera en malla:</strong> {JSON.stringify(diag.carrerasEnMalla)}</p>
          <p><strong>Tasas OK / Insuficientes:</strong> {String(diag.tasasOk)} / {String(diag.tasasInsuficientes)}</p>
          <p><strong>Proyecciones con valor &gt; 0:</strong> {String(diag.proyeccionesConValor)} / {String(diag.proyeccionesTotal)}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-amber-700">Ver primer registro histórico</summary>
            <pre className="mt-1 text-xs overflow-auto">{JSON.stringify(diag.primerHistorico, null, 2)}</pre>
          </details>
          <details>
            <summary className="cursor-pointer text-amber-700">Ver primer registro malla</summary>
            <pre className="mt-1 text-xs overflow-auto">{JSON.stringify(diag.primerMalla, null, 2)}</pre>
          </details>
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
