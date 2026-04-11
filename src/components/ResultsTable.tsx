'use client';
import { useState } from 'react';
import { useAppStore } from '@/store/appStore';

export function ResultsTable() {
  const { state, dispatch } = useAppStore();
  const { resultados } = state;
  const [filtroCarrera, setFiltroCarrera] = useState('');

  const carreras = [...new Set(resultados.map(r => r.carrera))].sort();
  const filtered = filtroCarrera ? resultados.filter(r => r.carrera === filtroCarrera) : resultados;

  function handleEdit(sigla: string, carrera: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      dispatch({ type: 'UPDATE_PROYECCION', payload: { sigla, carrera, valor: num } });
    }
  }

  if (resultados.length === 0) return <p className="text-gray-500">No hay resultados para mostrar.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Resultados de Proyección</h2>
        <select value={filtroCarrera} onChange={e => setFiltroCarrera(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Todas las carreras</option>
          {carreras.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Carrera</th>
              <th className="border px-2 py-1 text-left">Nombre Asignatura</th>
              <th className="border px-2 py-1">Código</th>
              <th className="border px-2 py-1">Requisito</th>
              <th className="border px-2 py-1">Grupo</th>
              <th className="border px-2 py-1">Inscritos Req.</th>
              <th className="border px-2 py-1">Proy. Reprobados Req.</th>
              <th className="border px-2 py-1">Proy. Abandonos Req.</th>
              <th className="border px-2 py-1">Proy. Promueven</th>
              <th className="border px-2 py-1">Inscritos Ant.</th>
              <th className="border px-2 py-1">Reprobados Ant.</th>
              <th className="border px-2 py-1">Abandonos Ant.</th>
              <th className="border px-2 py-1">Repitentes Ant.</th>
              <th className="border px-2 py-1">Proyección Inscritos</th>
              <th className="border px-2 py-1">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.carrera}-${r.sigla}-${i}`} className={r.estadoEspecial ? 'bg-yellow-50' : ''}>
                <td className="border px-2 py-1">{r.carrera}</td>
                <td className="border px-2 py-1">{r.nombreAsignatura}</td>
                <td className="border px-2 py-1 text-center">{r.sigla}</td>
                <td className="border px-2 py-1 text-center">{r.requisito}</td>
                <td className="border px-2 py-1 text-center">{r.grupo}</td>
                <td className="border px-2 py-1 text-center">{r.totalInscritosRequisito ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.proyeccionReprobadosRequisito ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.proyeccionAbandonosRequisito ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.proyeccionAlumnosPromueven ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.inscritosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.reprobadosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.abandonosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border px-2 py-1 text-center">{r.totalRepitentesGestionAnterior ?? '—'}</td>
                <td className={`border px-2 py-1 text-center ${r.editadoManualmente ? 'bg-blue-100 font-semibold' : ''}`}>
                  {r.estadoEspecial ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <input
                      type="number" min={0}
                      value={r.proyeccionInscritos ?? ''}
                      onChange={e => handleEdit(r.sigla, r.carrera, e.target.value)}
                      className={`w-20 text-center border rounded ${r.editadoManualmente ? 'border-blue-400' : 'border-gray-300'}`}
                    />
                  )}
                </td>
                <td className="border px-2 py-1 text-center text-xs">
                  {r.estadoEspecial === 'requiere_ingreso_manual' && <span className="text-orange-600">Manual</span>}
                  {r.estadoEspecial === 'datos_insuficientes' && <span className="text-red-600">Sin datos</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
