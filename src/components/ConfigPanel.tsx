'use client';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { validarFormatoGestion, calcularGestionSiguiente, parsearGestionesAtipicas } from '@/lib/validators';

export function ConfigPanel({ onNext }: { onNext: () => void }) {
  const { dispatch } = useAppStore();
  const [gestionActual, setGestionActual] = useState('');
  const [gestionesAtipicasStr, setGestionesAtipicasStr] = useState('');
  const [metodo, setMetodo] = useState<'promedio_simple' | 'regresion_lineal'>('promedio_simple');
  const [errors, setErrors] = useState<{ gestion?: string; atipicas?: string }>({});

  const gestionSiguiente = validarFormatoGestion(gestionActual) ? calcularGestionSiguiente(gestionActual) : '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!validarFormatoGestion(gestionActual)) {
      newErrors.gestion = 'Formato inválido. Use N/AAAA (ej: 1/2024)';
    }
    let gestionesAtipicas: string[] = [];
    try {
      gestionesAtipicas = parsearGestionesAtipicas(gestionesAtipicasStr);
    } catch (err) {
      newErrors.atipicas = err instanceof Error ? err.message : 'Formato inválido';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    dispatch({
      type: 'SET_CONFIG',
      payload: { gestionActual, gestionSiguiente, gestionesAtipicas, metodo },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">Configuración del Cálculo</h2>
      <div>
        <label className="block font-medium">Gestión Actual</label>
        <input
          type="text" value={gestionActual} onChange={e => setGestionActual(e.target.value)}
          placeholder="ej: 1/2024" className="border rounded px-2 py-1 w-40"
        />
        {gestionSiguiente && <p className="text-sm text-gray-600 mt-1">Gestión siguiente: <strong>{gestionSiguiente}</strong></p>}
        {errors.gestion && <p className="text-sm text-red-600">{errors.gestion}</p>}
      </div>
      <div>
        <label className="block font-medium">Gestiones Atípicas (separadas por coma)</label>
        <input
          type="text" value={gestionesAtipicasStr} onChange={e => setGestionesAtipicasStr(e.target.value)}
          placeholder="ej: 1/2020, 2/2020" className="border rounded px-2 py-1 w-64"
        />
        {errors.atipicas && <p className="text-sm text-red-600">{errors.atipicas}</p>}
      </div>
      <div>
        <label className="block font-medium">Método de Proyección</label>
        <select value={metodo} onChange={e => setMetodo(e.target.value as typeof metodo)} className="border rounded px-2 py-1">
          <option value="promedio_simple">Promedio Simple (últimas 4 gestiones)</option>
          <option value="regresion_lineal">Regresión Lineal</option>
        </select>
      </div>
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Calcular Proyección
      </button>
    </form>
  );
}
