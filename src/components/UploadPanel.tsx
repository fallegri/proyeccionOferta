'use client';
import { useState, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import type { ImportResult, HistoricoRow, MallaRow } from '@/lib/types';

export function UploadPanel() {
  const { dispatch } = useAppStore();
  const [historicoStatus, setHistoricoStatus] = useState<{ resumen?: string; error?: string } | null>(null);
  const [mallaStatus, setMallaStatus] = useState<{ resumen?: string; error?: string } | null>(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingMalla, setLoadingMalla] = useState(false);
  const historicoRef = useRef<HTMLInputElement>(null);
  const mallaRef = useRef<HTMLInputElement>(null);

  async function handleHistorico(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingHistorico(true);
    setHistoricoStatus(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/historico', { method: 'POST', body: fd });
      const data = await res.json() as ImportResult<HistoricoRow> & { error?: string };
      if (!res.ok) {
        setHistoricoStatus({ error: data.error ?? 'Error al procesar el archivo' });
      } else {
        dispatch({ type: 'SET_HISTORICO', payload: data.rows });
        setHistoricoStatus({ resumen: data.resumen });
      }
    } catch {
      setHistoricoStatus({ error: 'Error de red al subir el archivo' });
    } finally {
      setLoadingHistorico(false);
    }
  }

  async function handleMalla(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingMalla(true);
    setMallaStatus(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/malla', { method: 'POST', body: fd });
      const data = await res.json() as ImportResult<MallaRow> & { error?: string };
      if (!res.ok) {
        setMallaStatus({ error: data.error ?? 'Error al procesar el archivo' });
      } else {
        dispatch({ type: 'SET_MALLA', payload: data.rows });
        setMallaStatus({ resumen: data.resumen });
      }
    } catch {
      setMallaStatus({ error: 'Error de red al subir el archivo' });
    } finally {
      setLoadingMalla(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Carga de Archivos</h2>
      <div className="space-y-2">
        <label className="block font-medium">Archivo Histórico (.xlsx / .xls)</label>
        <input ref={historicoRef} type="file" accept=".xlsx,.xls" onChange={handleHistorico} disabled={loadingHistorico} className="block" />
        {loadingHistorico && <p className="text-sm text-gray-500">Procesando...</p>}
        {historicoStatus?.resumen && <p className="text-sm text-green-600">{historicoStatus.resumen}</p>}
        {historicoStatus?.error && <p className="text-sm text-red-600">{historicoStatus.error}</p>}
      </div>
      <div className="space-y-2">
        <label className="block font-medium">Archivo de Malla Curricular (.xlsx / .xls)</label>
        <input ref={mallaRef} type="file" accept=".xlsx,.xls" onChange={handleMalla} disabled={loadingMalla} className="block" />
        {loadingMalla && <p className="text-sm text-gray-500">Procesando...</p>}
        {mallaStatus?.resumen && <p className="text-sm text-green-600">{mallaStatus.resumen}</p>}
        {mallaStatus?.error && <p className="text-sm text-red-600">{mallaStatus.error}</p>}
      </div>
    </div>
  );
}
