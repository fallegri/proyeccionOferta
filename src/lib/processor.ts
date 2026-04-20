import type { HistoricoRow, MallaRow, OfertaActualRow, ConfigCalculo, TasaMateria, FilaProyeccion, Turno } from './types';

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

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function calcularTasas(
  historico: HistoricoRow[],
  config: ConfigCalculo
): TasaMateria[] {
  const { gestionesAtipicas, metodo, carreraMap } = config;
  const atipicasSet = new Set(gestionesAtipicas);

  const resolveCarrera = (planEstudio: string): string => {
    if (!carreraMap) return planEstudio;
    if (carreraMap[planEstudio]) return carreraMap[planEstudio];
    const normPlan = norm(planEstudio);
    for (const [k, v] of Object.entries(carreraMap)) {
      if (norm(k) === normPlan) return v;
    }
    return planEstudio;
  };

  const groups = new Map<string, { rows: HistoricoRow[]; sigla: string; carrera: string }>();
  for (const row of historico) {
    const carreraResolved = resolveCarrera(row.planEstudio);
    const key = `${norm(row.sigla)}|||${norm(carreraResolved)}`;
    if (!groups.has(key)) groups.set(key, { rows: [], sigla: row.sigla, carrera: carreraResolved });
    groups.get(key)!.rows.push(row);
  }

  const result: TasaMateria[] = [];

  for (const { rows, sigla, carrera } of groups.values()) {
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

/** Genera una FilaProyeccion para una materia + turno dado */
function buildFila(
  mallaRow: MallaRow,
  turno: Turno | null,
  inscritosPrereq: number,
  tasaPrereq: TasaMateria | undefined,
  nombreRequisito: string | null,
  rowsAnt: HistoricoRow[],
  estadoEspecial: string | null,
  baseAdmision?: number
): FilaProyeccion {
  const { carrera, sigla, nombreAsignatura, requisito } = mallaRow;

  if (estadoEspecial) {
    return {
      carrera, nombreAsignatura, sigla, requisito,
      nombreRequisito: estadoEspecial === 'requiere_ingreso_manual' ? null : null,
      codigoRequisito: null, grupo: '',
      semestre: mallaRow.semestre, turno,
      totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
      proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
      inscritosAsignaturaGestionAnterior: null, reprobadosAsignaturaGestionAnterior: null,
      abandonosAsignaturaGestionAnterior: null, totalRepitentesGestionAnterior: null,
      proyeccionInscritos: null, editadoManualmente: false, estadoEspecial,
    };
  }

  const inscritosAnt = rowsAnt.length > 0 ? rowsAnt.reduce((s, r) => s + r.totalAlumnos, 0) : null;
  const reprobadosAnt = rowsAnt.reduce((s, r) => s + r.reprobados, 0);
  const abandonosAnt = rowsAnt.reduce((s, r) => s + r.abandono, 0);
  const totalRepitentes = reprobadosAnt + abandonosAnt;

  // ADMISIÓN: use historical average
  if (requisito === 'ADMISIÓN') {
    return {
      carrera, nombreAsignatura, sigla, requisito,
      nombreRequisito: 'ADMISIÓN',
      codigoRequisito: null, grupo: '',
      semestre: mallaRow.semestre, turno,
      totalInscritosRequisito: null, proyeccionReprobadosRequisito: null,
      proyeccionAbandonosRequisito: null, proyeccionAlumnosPromueven: null,
      inscritosAsignaturaGestionAnterior: inscritosAnt,
      reprobadosAsignaturaGestionAnterior: rowsAnt.length > 0 ? reprobadosAnt : null,
      abandonosAsignaturaGestionAnterior: rowsAnt.length > 0 ? abandonosAnt : null,
      totalRepitentesGestionAnterior: rowsAnt.length > 0 ? totalRepitentes : null,
      proyeccionInscritos: Math.round(baseAdmision ?? 0),
      editadoManualmente: false, estadoEspecial: null,
    };
  }

  // Has prerequisite
  const tasaPromocion = tasaPrereq?.tasaPromocion ?? 0;
  const tasaReprobacion = tasaPrereq?.tasaReprobacion ?? 0;
  const tasaAbandono = tasaPrereq?.tasaAbandono ?? 0;

  const proyeccionAlumnosPromueven = Math.floor(inscritosPrereq * tasaPromocion);
  const proyeccionReprobadosRequisito = Math.floor(inscritosPrereq * tasaReprobacion);
  const proyeccionAbandonosRequisito = Math.floor(inscritosPrereq * tasaAbandono);
  const proyeccionInscritos = proyeccionAlumnosPromueven + reprobadosAnt + abandonosAnt;

  return {
    carrera, nombreAsignatura, sigla, requisito,
    nombreRequisito: nombreRequisito ?? requisito,
    codigoRequisito: null, grupo: '',
    semestre: mallaRow.semestre, turno,
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
  };
}

export function calcularProyecciones(
  historico: HistoricoRow[],
  malla: MallaRow[],
  tasas: TasaMateria[],
  config: ConfigCalculo,
  ofertaActual: OfertaActualRow[] = []
): FilaProyeccion[] {
  const { gestionActual, gestionesAtipicas, carreraMap, turnosExcluidos } = config;
  const atipicasSet = new Set(gestionesAtipicas);
  const gestionAnterior = calcularGestionAnterior(gestionActual);
  const turnosExcluidosSet = new Set(turnosExcluidos ?? []);

  const resolveCarrera = (planEstudio: string): string => {
    if (!carreraMap) return planEstudio;
    if (carreraMap[planEstudio]) return carreraMap[planEstudio];
    const normPlan = norm(planEstudio);
    for (const [k, v] of Object.entries(carreraMap)) {
      if (norm(k) === normPlan) return v;
    }
    return planEstudio;
  };

  const tasaMap = new Map<string, TasaMateria>();
  for (const t of tasas) {
    tasaMap.set(`${norm(t.sigla)}|||${norm(t.carrera)}`, t);
  }

  const mallaMap = new Map<string, MallaRow>();
  for (const m of malla) {
    mallaMap.set(`${norm(m.sigla)}|||${norm(m.carrera)}`, m);
  }

  const historicoMapped = historico.map(r => ({
    ...r,
    carreraMapped: resolveCarrera(r.planEstudio),
  }));

  // Build oferta lookup: (sigla_norm, carrera_norm) -> Map<turno, totalAlumnos>
  const ofertaMap = new Map<string, Map<Turno, number>>();
  for (const o of ofertaActual) {
    const carreraResolved = resolveCarrera(o.planEstudio);
    const key = `${norm(o.sigla)}|||${norm(carreraResolved)}`;
    if (!ofertaMap.has(key)) ofertaMap.set(key, new Map());
    const turnoMap = ofertaMap.get(key)!;
    turnoMap.set(o.turno, (turnoMap.get(o.turno) ?? 0) + o.totalAlumnos);
  }

  /**
   * Semestres proyectados por carrera:
   * Si la oferta actual tiene semestres {1,3,5,7} para una carrera,
   * la siguiente gestión proyecta {2,4,6,8} (impares avanzan al siguiente).
   * Los semestres pares se mantienen (8→8, 9→9 si existen en la oferta).
   * Si no hay oferta cargada, se proyectan todos los semestres de la malla.
   *
   * Regla: semestre_proyectado = semestre_actual % 2 === 1
   *          ? semestre_actual + 1   (impar → siguiente par)
   *          : semestre_actual        (par → se repite)
   */
  const semestresProyectadosPorCarrera = new Map<string, Set<number>>();
  if (ofertaActual.length > 0) {
    // Collect semestres present in oferta per carrera (using malla to get semestre number)
    const semestresActualesPorCarrera = new Map<string, Set<number>>();
    for (const o of ofertaActual) {
      const carreraResolved = resolveCarrera(o.planEstudio);
      const carreraNormKey = norm(carreraResolved);
      const mallaEntry = mallaMap.get(`${norm(o.sigla)}|||${carreraNormKey}`);
      if (!mallaEntry) continue;
      const sem = mallaEntry.semestre;
      if (!semestresActualesPorCarrera.has(carreraNormKey)) {
        semestresActualesPorCarrera.set(carreraNormKey, new Set());
      }
      semestresActualesPorCarrera.get(carreraNormKey)!.add(sem);
    }
    // Calculate projected semesters
    for (const [carreraNormKey, semsActuales] of semestresActualesPorCarrera) {
      const semsProyectados = new Set<number>();
      for (const s of semsActuales) {
        semsProyectados.add(s % 2 === 1 ? s + 1 : s);
      }
      semestresProyectadosPorCarrera.set(carreraNormKey, semsProyectados);
    }
  }

  const result: FilaProyeccion[] = [];

  for (const mallaRow of malla) {
    const { carrera, sigla, requisito, requiereIngresoManual } = mallaRow;
    const carreraNorm = norm(carrera);
    const siglaNorm = norm(sigla);

    // Filter by projected semesters — only include if oferta is loaded and this
    // materia's semester is in the projected set for this carrera
    if (semestresProyectadosPorCarrera.size > 0) {
      const semsProyectados = semestresProyectadosPorCarrera.get(carreraNorm);
      if (!semsProyectados || !semsProyectados.has(mallaRow.semestre)) {
        continue; // skip — this semester is not being offered next gestión
      }
    }

    // Determine turnos to generate
    const ofertaKey = `${siglaNorm}|||${carreraNorm}`;
    const turnoInscritos = ofertaMap.get(ofertaKey);
    const turnosActivos: Array<{ turno: Turno | null; inscritosActuales: number }> =
      turnoInscritos && turnoInscritos.size > 0
        ? [...turnoInscritos.entries()]
            .filter(([t]) => !turnosExcluidosSet.has(t))
            .map(([t, ins]) => ({ turno: t, inscritosActuales: ins }))
        : [{ turno: null, inscritosActuales: 0 }];

    // Common data for all turnos of this materia
    const rowsAnt = historicoMapped.filter(
      r => norm(r.sigla) === siglaNorm && norm(r.carreraMapped) === carreraNorm && r.gestion === gestionAnterior
    );

    for (const { turno, inscritosActuales: _ins } of turnosActivos) {

      // Case 1: requires manual entry
      if (requiereIngresoManual) {
        result.push(buildFila(mallaRow, turno, 0, undefined, null, [], 'requiere_ingreso_manual'));
        continue;
      }

      const tasa = tasaMap.get(`${siglaNorm}|||${carreraNorm}`);

      // Case 2: datos_insuficientes
      if (tasa?.estado === 'datos_insuficientes') {
        result.push(buildFila(mallaRow, turno, 0, undefined, null, [], 'datos_insuficientes'));
        continue;
      }

      // Case 3: ADMISIÓN
      if (requisito === 'ADMISIÓN') {
        const rowsForMateria = historicoMapped.filter(
          r => norm(r.sigla) === siglaNorm && norm(r.carreraMapped) === carreraNorm && !atipicasSet.has(r.gestion)
        );
        const byGestion = new Map<string, number>();
        for (const r of rowsForMateria) {
          byGestion.set(r.gestion, (byGestion.get(r.gestion) ?? 0) + r.totalAlumnos);
        }
        const sortedG = sortGestiones([...byGestion.keys()]).slice(-4);
        const base = sortedG.length > 0
          ? sortedG.reduce((sum, g) => sum + byGestion.get(g)!, 0) / sortedG.length
          : 0;
        result.push(buildFila(mallaRow, turno, 0, undefined, 'ADMISIÓN', rowsAnt, null, base));
        continue;
      }

      // Case 4: has prerequisite
      const requisitoNorm = norm(requisito);
      const tasaPrereq = tasaMap.get(`${requisitoNorm}|||${carreraNorm}`);
      const mallaPrereq = mallaMap.get(`${requisitoNorm}|||${carreraNorm}`);
      const nombreRequisito = mallaPrereq?.nombreAsignatura ?? requisito;

      // Use oferta inscritos for this turno if available, else fall back to historico
      let inscritosPrereq: number;
      if (turno && ofertaMap.has(`${requisitoNorm}|||${carreraNorm}`)) {
        inscritosPrereq = ofertaMap.get(`${requisitoNorm}|||${carreraNorm}`)!.get(turno) ?? 0;
      } else {
        inscritosPrereq = historicoMapped
          .filter(r => norm(r.sigla) === requisitoNorm && norm(r.carreraMapped) === carreraNorm && r.gestion === gestionActual)
          .reduce((s, r) => s + r.totalAlumnos, 0);
      }

      result.push(buildFila(mallaRow, turno, inscritosPrereq, tasaPrereq, nombreRequisito, rowsAnt, null));
    }
  }

  return result;
}
