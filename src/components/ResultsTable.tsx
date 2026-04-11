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

  if (resultados.length === 0) return <p className="text-slate-500">No hay resultados para mostrar.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-800">Resultados de Proyección</h2>
        <select
          value={filtroCarrera}
          onChange={e => setFiltroCarrera(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las carreras</option>
          {carreras.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Carrera</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">Nombre Asignatura</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Código</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Requisito</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Grupo</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Inscritos Req.</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Proy. Reprobados</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Proy. Abandonos</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Proy. Promueven</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Inscritos Ant.</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Reprobados Ant.</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Abandonos Ant.</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Repitentes Ant.</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Proyección Inscritos</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.carrera}-${r.sigla}-${i}`}
                className={`${r.estadoEspecial ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} text-slate-800`}
              >
                <td className="border-b border-slate-100 px-3 py-2">{r.carrera}</td>
                <td className="border-b border-slate-100 px-3 py-2">{r.nombreAsignatura}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center font-mono text-xs">{r.sigla}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center font-mono text-xs">{r.requisito}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.grupo}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.totalInscritosRequisito ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.proyeccionReprobadosRequisito ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.proyeccionAbandonosRequisito ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.proyeccionAlumnosPromueven ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.inscritosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.reprobadosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.abandonosAsignaturaGestionAnterior ?? '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-center">{r.totalRepitentesGestionAnterior ?? '—'}</td>
                <td className={`border-b border-slate-100 px-3 py-2 text-center ${r.editadoManualmente ? 'bg-blue-50' : ''}`}>
                  {r.estadoEspecial ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <input
                      type="number" min={0}
                      value={r.proyeccionInscritos ?? ''}
                      onChange={e => handleEdit(r.sigla, r.carrera, e.target.value)}
                      className={`w-20 text-center border rounded-md px-1 py-0.5 text-slate-900 ${r.editadoManualmente ? 'border-blue-400 bg-blue-50 font-semibold' : 'border-slate-300'}`}
                    />
                  )}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-center text-xs">
                  {r.estadoEspecial === 'requiere_ingreso_manual' && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Manual</span>
                  )}
                  {r.estadoEspecial === 'datos_insuficientes' && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Sin datos</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
