'use client';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { validarFormatoGestion, calcularGestionSiguiente, parsearGestionesAtipicas } from '@/lib/validators';

export function ConfigPanel({ onNext }: { onNext: () => void }) {
  const { state, dispatch } = useAppStore();
  const { historicoRows, mallaRows, ofertaActualRows } = state;

  const [gestionActual, setGestionActual] = useState('');
  const [gestionesAtipicasStr, setGestionesAtipicasStr] = useState('');
  const [metodo, setMetodo] = useState<'promedio_simple' | 'regresion_lineal'>('promedio_simple');
  const [errors, setErrors] = useState<{ gestion?: string; atipicas?: string }>({});

  // Carrera mapping
  const planEstudiosHistorico = [...new Set(historicoRows.map(r => r.planEstudio))].sort();
  const carrerasMalla = [...new Set(mallaRows.map(r => r.carrera))].sort();
  const [carreraMap, setCarreraMap] = useState<Record<string, string>>({});

  // Turnos disponibles en la oferta actual
  const turnosDisponibles = [...new Set(ofertaActualRows.map(r => r.turno))].sort() as ('Mañana' | 'Tarde' | 'Noche')[];
  const [turnosExcluidos, setTurnosExcluidos] = useState<Set<string>>(new Set());

  const toggleTurno = (turno: string) => {
    setTurnosExcluidos(prev => {
      const next = new Set(prev);
      if (next.has(turno)) next.delete(turno); else next.add(turno);
      return next;
    });
  };

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
    // Only include non-empty mappings
    const filteredMap = Object.fromEntries(
      Object.entries(carreraMap).filter(([, v]) => v.trim() !== '')
    );
    dispatch({
      type: 'SET_CONFIG',
      payload: {
        gestionActual,
        gestionSiguiente,
        gestionesAtipicas,
        metodo,
        carreraMap: Object.keys(filteredMap).length > 0 ? filteredMap : undefined,
        turnosExcluidos: turnosExcluidos.size > 0 ? ([...turnosExcluidos] as ('Mañana' | 'Tarde' | 'Noche')[]) : undefined,
      },
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Configuración del Cálculo</h2>

      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">Gestión Actual</label>
        <input
          type="text" value={gestionActual} onChange={e => setGestionActual(e.target.value)}
          placeholder="ej: 1/2024"
          className="border border-slate-300 rounded-lg px-3 py-2 w-40 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {gestionSiguiente && (
          <p className="text-sm text-slate-600 mt-1">
            Gestión siguiente: <strong className="text-slate-800">{gestionSiguiente}</strong>
          </p>
        )}
        {errors.gestion && <p className="text-sm text-red-600 font-medium">{errors.gestion}</p>}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">Gestiones Atípicas (separadas por coma)</label>
        <input
          type="text" value={gestionesAtipicasStr} onChange={e => setGestionesAtipicasStr(e.target.value)}
          placeholder="ej: 1/2020, 2/2020"
          className="border border-slate-300 rounded-lg px-3 py-2 w-72 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.atipicas && <p className="text-sm text-red-600 font-medium">{errors.atipicas}</p>}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-semibold text-slate-700">Método de Proyección</label>
        <select
          value={metodo} onChange={e => setMetodo(e.target.value as typeof metodo)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="promedio_simple">Promedio Simple (últimas 4 gestiones)</option>
          <option value="regresion_lineal">Regresión Lineal</option>
        </select>
      </div>

      {/* Carrera mapping — only shown when names differ */}
      {planEstudiosHistorico.length > 0 && carrerasMalla.length > 0 && (
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700">
              Mapeo de Carreras
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Asocia cada nombre de carrera del histórico con el nombre correspondiente en la malla.
              Deja en blanco las que no apliquen.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left text-slate-600 font-medium w-1/2">Carrera en Histórico</th>
                  <th className="px-3 py-2 text-left text-slate-600 font-medium w-1/2">Carrera en Malla</th>
                </tr>
              </thead>
              <tbody>
                {planEstudiosHistorico.map(plan => (
                  <tr key={plan} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700 text-xs">{plan}</td>
                    <td className="px-3 py-2">
                      <select
                        value={carreraMap[plan] ?? ''}
                        onChange={e => setCarreraMap(prev => ({ ...prev, [plan]: e.target.value }))}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">— no mapear —</option>
                        {carrerasMalla.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Turno filter — only shown when oferta actual has data */}
      {turnosDisponibles.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">Turnos a proyectar</label>
          <p className="text-xs text-slate-500">Desmarca los turnos que NO deseas incluir en la proyección.</p>
          <div className="flex gap-4">
            {turnosDisponibles.map(turno => (
              <label key={turno} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!turnosExcluidos.has(turno)}
                  onChange={() => toggleTurno(turno)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-slate-700">{turno}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
        Calcular Proyección
      </button>
    </form>
  );
}
