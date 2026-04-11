'use client';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { generarExcel } from '@/lib/exporter';

export function ExportButton() {
  const { state } = useAppStore();
  const { resultados, config } = state;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!config || resultados.length === 0) return null;

  function handleExport() {
    const { buffer, filename } = generarExcel(resultados, config!.gestionSiguiente);
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/proyeccion/guardar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: resultados, gestion: config!.gestionSiguiente }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Error al guardar');
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-200">
      <button
        onClick={handleExport}
        className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
      >
        ↓ Exportar Excel
      </button>
      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Proyección'}
      </button>
      {saveError && (
        <div className="flex items-center gap-2">
          <span className="text-red-600 text-sm font-medium">{saveError}</span>
          <button onClick={handleSave} className="text-sm underline text-blue-600 hover:text-blue-800">
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
