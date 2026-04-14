export type MetodoProyeccion = 'promedio_simple' | 'regresion_lineal';

export interface HistoricoRow {
  codigoPlanEstudio: string;
  planEstudio: string;
  codigoGestion: string;
  gestion: string;
  turno: string;
  grupo: string;
  codigoMateria: string;
  materia: string;
  sigla: string;
  abandono: number;
  reprobados: number;
  aprobados: number;
  totalAlumnos: number;
}

export interface MallaRow {
  carrera: string;
  semestre: number;
  sigla: string;
  nombreAsignatura: string;
  requisito: string;
  requiereIngresoManual: boolean;
}

export interface ImportResult<T> {
  rows: T[];
  omitidas: number;
  resumen: string;
  errores: string[];
}

export interface ConfigCalculo {
  gestionActual: string;
  gestionSiguiente: string;
  gestionesAtipicas: string[];
  metodo: MetodoProyeccion;
  /** Mapeo de nombre de carrera en histórico -> nombre de carrera en malla.
   *  Ej: { "DISEÑO GRAFICO": "Lic. En Diseño Gráfico", "Ingenieria de Sistemas": "INGESIS" }
   */
  carreraMap?: Record<string, string>;
}

export interface TasaMateria {
  sigla: string;
  carrera: string;
  tasaReprobacion: number;
  tasaAbandono: number;
  tasaPromocion: number;
  estado: 'ok' | 'datos_insuficientes' | 'ingreso_manual';
}

export interface FilaProyeccion {
  carrera: string;
  nombreAsignatura: string;
  sigla: string;
  requisito: string;
  codigoRequisito: string | null;
  grupo: string;
  totalInscritosRequisito: number | null;
  proyeccionReprobadosRequisito: number | null;
  proyeccionAbandonosRequisito: number | null;
  proyeccionAlumnosPromueven: number | null;
  inscritosAsignaturaGestionAnterior: number | null;
  reprobadosAsignaturaGestionAnterior: number | null;
  abandonosAsignaturaGestionAnterior: number | null;
  totalRepitentesGestionAnterior: number | null;
  proyeccionInscritos: number | null;
  editadoManualmente: boolean;
  estadoEspecial: string | null;
}

export interface AppState {
  historicoRows: HistoricoRow[];
  mallaRows: MallaRow[];
  config: ConfigCalculo | null;
  resultados: FilaProyeccion[];
  paso: 'carga' | 'config' | 'resultados';
  cargando: boolean;
  errores: string[];
}
