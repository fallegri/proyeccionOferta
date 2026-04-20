export type MetodoProyeccion = 'promedio_simple' | 'regresion_lineal';
export type Turno = 'Mañana' | 'Tarde' | 'Noche';

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

/** Fila del archivo de oferta actual (gestión en curso, sin datos de resultado) */
export interface OfertaActualRow {
  codigoPlanEstudio: string;
  planEstudio: string;
  codigoGestion: string;
  gestion: string;
  nsem: number;           // semestre del grupo según el archivo de oferta (columna Nsem)
  turno: Turno;           // normalizado: Mañana | Tarde | Noche
  grupo: string;          // grupo original limpio, ej: "1AM", "2AT"
  codigoMateria: string;
  materia: string;
  sigla: string;
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
  /** Mapeo de nombre de carrera en histórico -> nombre de carrera en malla. */
  carreraMap?: Record<string, string>;
  /** Turnos a excluir de la proyección. Si vacío o undefined, se proyectan todos. */
  turnosExcluidos?: Turno[];
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
  /** Sigla del prerrequisito o "ADMISIÓN" */
  requisito: string;
  /** Nombre completo de la materia prerrequisito (viene de la malla) */
  nombreRequisito: string | null;
  codigoRequisito: string | null;
  /** Semestre de la materia a programar (viene de la malla) */
  semestre: number | null;
  /** Turno proyectado: Mañana, Tarde o Noche */
  turno: Turno | null;
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
  ofertaActualRows: OfertaActualRow[];
  config: ConfigCalculo | null;
  resultados: FilaProyeccion[];
  paso: 'carga' | 'config' | 'resultados';
  cargando: boolean;
  errores: string[];
}
