import type { HistoricoRow, MallaRow, ConfigCalculo, TasaMateria, FilaProyeccion } from './types';

function sortGestiones(gestiones: string[]): string[] {
  return [...gestiones].sort((a, b) => {
    const [na, ya] = a.split('/').map(Number);
    const [nb, yb] = b.split('/').map(Number);
    return ya !== yb ? ya - yb : na - nb;
  });
}

function linearRegression(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - meanX) * (values[i] - meanY), 0);
  const den = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (den === 0) return meanY;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const predicted = slope * n + intercept;
  return Math.max(0, Math.min(1, predicted));
}

function calcularGestionAnterior(gestion: string): string {
  const [n, anio] = gestion.split('/').map(Number);
  if (n === 1) return `2/${anio - 1}`;
  return `1/${anio}`;
}

// Normaliza strings para comparación: minúsculas, sin tildes, sin espacios extra
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Construye un mapa normalizado de planEstudio -> valor original
// para resolver el mismatch de mayúsculas/tildes entre histórico y malla
function buildCarreraMap(historico: HistoricoRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of historico) {
    map.set(norm(r.planEstudio), r.planEstudio);
  }
  return map;
}

export function calcularTasas(
  historico: HistoricoRow[],
  config: ConfigCalculo
): TasaMateria[] {
  const { gestionesAtipicas, metodo } = config;
  const atipicasSet = new Set(gestionesAtipicas);

  // Group by (sigla_norm, carrera_norm) — case/accent insensitive
  const groups = new Map<string, HistoricoRow[]>();
  for (const row of historico) {
    const key = `${norm(row.sigla)}|||${norm(row.planEstudio)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const result: TasaMateria[] = [];

  for (const [key, rows] of groups) {
    // Use original values from first row for output
    const sigla = rows[0].sigla;
    const carrera = rows[0].planEstudio;
    const filtered = rows.filter(r => !atipicasSet.has(r.gestion));

    if (filtered.length < 2) {
      result.push({ sigla, carrera, tasaReprobacion: 0, tasaAbandono: 0, tasaPromocion: 1, estado: 'datos_insuficientes' });
      continue;
    }

    const sorted = sortGestiones([...new Set(filtered.map(r => r.gestion))]);
    const gestionesUsadas = metodo === 'promedio_simple' ? sorted.slice(-4) : sorted;
    const gestionesSet = new Set(gestionesUsadas);
    const rowsUsados = filtered.filter(r => gestionesSet.has(r.gestion));

    const byGestion = new Map<string, { reprobados: number; abandono: number; total: number }>();
    for (const r of rowsUsados) {
      const prev = byGestion.get(r.gestion) ?? { reprobados: 0, abandono: 0, total: 0 };
      byGestion.set(r.gestion, {
        reprobados: prev.reprobados + r.reprobados,
        abandono: prev.abandono + r.abandono,
        total: prev.total + r.totalAlumnos,
      });
    }

    const gestionesSorted = sortGestiones([...byGestion.keys()]);
    const repRates = gestionesSorted.map(g => { const d = byGestion.get(g)!; return d.total > 0 ? d.reprobados / d.total : 0; });
    const abaRates = gestionesSorted.map(g => { const d = byGestion.get(g)!; return d.total > 0 ? d.abandono / d.total : 0; });

    let tasaReprobacion: number;
    let tasaAbandono: number;

    if (metodo === 'promedio_simple') {
      tasaReprobacion = repRates.reduce((a, b) => a + b, 0) / repRates.length;
      tasaAbandono = abaRates.reduce((a, b) => a + b, 0) / abaRates.length;
    } else {
      tasaReprobacion = linearRegression(repRates);
      tasaAbandono = linearRegression(abaRates);
    }

    tasaReprobacion = Math.max(0, Math.min(1, tasaReprobacion));
    tasaAbandono = Math.max(0, Math.min(1, tasaAbandono));
    const tasaPromocion = Math.max(0, 1 - tasaReprobacion - tasaAbandono);

    result.push({ sigla, carrera, tasaReprobacion, tasaAbandono, tasaPromocion, estado: 'ok' });
  }

  return result;
}

export function calcularProyecciones(
  historico: HistoricoRow[],
  malla: MallaRow[],
  tasas: TasaMateria[],
  config: ConfigCalculo
): FilaProyeccion[] {
  const { gestionActual, gestionesAtipicas } = config;
  const atipicasSet = new Set(gestionesAtipicas);
  const gestionAnterior = calcularGestionAnterior(gestionActual);

  // Build normalized lookup for tasas
  const tasaMap = new Map<string, TasaMateria>();
  for (const t of tasas) {
    tasaMap.set(`${norm(t.sigla)}|||${norm(t.carrera)}`, t);
  }

  const result: FilaProyeccion[] = [];

  for (const mallaRow of malla) {
    const { carrera, sigla, nombreAsignatura, requisito, requiereIngresoManual } = mallaRow;
    const carreraNorm = norm(carrera);
    const siglaNorm = norm(sigla);

    // Case 1: requires manual entry
    if (requiereIngresoManual) {
      result.push({
        carrera, nombreAsignatura, sigla, requisito,
        codigoRequisito: null, grupo: '',
        totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
        proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
        inscritosAsignaturaGestionAnterior: null, reprobadosAsignaturaGestionAnterior: null,
        abandonosAsignaturaGestionAnterior: null, totalRepitentesGestionAnterior: null,
        proyeccionInscritos: null, editadoManualmente: false, estadoEspecial: 'requiere_ingreso_manual',
      });
      continue;
    }

    // Find tasa — normalized match
    const tasa = tasaMap.get(`${siglaNorm}|||${carreraNorm}`);

    // Case 2: datos_insuficientes
    if (tasa?.estado === 'datos_insuficientes') {
      result.push({
        carrera, nombreAsignatura, sigla, requisito,
        codigoRequisito: null, grupo: '',
        totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
        proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
        inscritosAsignaturaGestionAnterior: null, reprobadosAsignaturaGestionAnterior: null,
        abandonosAsignaturaGestionAnterior: null, totalRepitentesGestionAnterior: null,
        proyeccionInscritos: null, editadoManualmente: false, estadoEspecial: 'datos_insuficientes',
      });
      continue;
    }

    // Case 3: ADMISIÓN (no prerequisite)
    if (requisito === 'ADMISIÓN') {
      const rowsForMateria = historico.filter(
        r => norm(r.sigla) === siglaNorm && norm(r.planEstudio) === carreraNorm && !atipicasSet.has(r.gestion)
      );
      const byGestion = new Map<string, number>();
      for (const r of rowsForMateria) {
        byGestion.set(r.gestion, (byGestion.get(r.gestion) ?? 0) + r.totalAlumnos);
      }
      const sortedGestiones = sortGestiones([...byGestion.keys()]).slice(-4);
      const base = sortedGestiones.length > 0
        ? sortedGestiones.reduce((sum, g) => sum + byGestion.get(g)!, 0) / sortedGestiones.length
        : 0;

      const rowsAnt = historico.filter(r => norm(r.sigla) === siglaNorm && norm(r.planEstudio) === carreraNorm && r.gestion === gestionAnterior);
      const inscritosAnt = rowsAnt.length > 0 ? rowsAnt.reduce((s, r) => s + r.totalAlumnos, 0) : null;
      const reprobadosAnt = rowsAnt.length > 0 ? rowsAnt.reduce((s, r) => s + r.reprobados, 0) : null;
      const abandonosAnt = rowsAnt.length > 0 ? rowsAnt.reduce((s, r) => s + r.abandono, 0) : null;
      const totalRepitentes = reprobadosAnt !== null && abandonosAnt !== null ? reprobadosAnt + abandonosAnt : null;

      result.push({
        carrera, nombreAsignatura, sigla, requisito,
        codigoRequisito: null, grupo: '',
        totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
        proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
        inscritosAsignaturaGestionAnterior: inscritosAnt,
        reprobadosAsignaturaGestionAnterior: reprobadosAnt,
        abandonosAsignaturaGestionAnterior: abandonosAnt,
        totalRepitentesGestionAnterior: totalRepitentes,
        proyeccionInscritos: Math.round(base),
        editadoManualmente: false, estadoEspecial: null,
      });
      continue;
    }

    // Case 4: has prerequisite
    const requisitoNorm = norm(requisito);
    const tasaPrereq = tasaMap.get(`${requisitoNorm}|||${carreraNorm}`);
    const tasaPromocionPrereq = tasaPrereq?.tasaPromocion ?? 0;
    const tasaReprobacionPrereq = tasaPrereq?.tasaReprobacion ?? 0;
    const tasaAbandonoPrereq = tasaPrereq?.tasaAbandono ?? 0;

    const rowsPrereqActual = historico.filter(
      r => norm(r.sigla) === requisitoNorm && norm(r.planEstudio) === carreraNorm && r.gestion === gestionActual
    );
    const inscritosPrereq = rowsPrereqActual.reduce((s, r) => s + r.totalAlumnos, 0);

    const proyeccionAlumnosPromueven = Math.floor(inscritosPrereq * tasaPromocionPrereq);
    const proyeccionReprobadosRequisito = Math.floor(inscritosPrereq * tasaReprobacionPrereq);
    const proyeccionAbandonosRequisito = Math.floor(inscritosPrereq * tasaAbandonoPrereq);

    const rowsAnt = historico.filter(r => norm(r.sigla) === siglaNorm && norm(r.planEstudio) === carreraNorm && r.gestion === gestionAnterior);
    const inscritosAnt = rowsAnt.length > 0 ? rowsAnt.reduce((s, r) => s + r.totalAlumnos, 0) : null;
    const reprobadosAnt = rowsAnt.reduce((s, r) => s + r.reprobados, 0);
    const abandonosAnt = rowsAnt.reduce((s, r) => s + r.abandono, 0);
    const totalRepitentes = reprobadosAnt + abandonosAnt;
    const proyeccionInscritos = proyeccionAlumnosPromueven + reprobadosAnt + abandonosAnt;

    result.push({
      carrera, nombreAsignatura, sigla, requisito,
      codigoRequisito: null, grupo: '',
      totalInscritosRequisito: inscritosPrereq,
      proyeccionReprobadosRequisito,
      proyeccionAbandonosRequisito,
      proyeccionAlumnosPromueven,
      inscritosAsignaturaGestionAnterior: inscritosAnt,
      reprobadosAsignaturaGestionAnterior: reprobadosAnt,
      abandonosAsignaturaGestionAnterior: abandonosAnt,
      totalRepitentesGestionAnterior: totalRepitentes,
      proyeccionInscritos,
      editadoManualmente: false, estadoEspecial: null,
    });
  }

  return result;
}
