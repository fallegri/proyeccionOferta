import { pgTable, serial, text, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';

export const mallas = pgTable('mallas', {
  id: serial('id').primaryKey(),
  carrera: text('carrera').notNull(),
  semestre: integer('semestre').notNull(),
  sigla: text('sigla').notNull(),
  nombre: text('nombre').notNull(),
  requisito: text('requisito'),
  requiereIngresoManual: boolean('requiere_ingreso_manual').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ uniq: unique().on(t.carrera, t.sigla) }));

export const proyecciones = pgTable('proyecciones', {
  id: serial('id').primaryKey(),
  gestionProyectada: text('gestion_proyectada').notNull(),
  carrera: text('carrera').notNull(),
  sigla: text('sigla').notNull(),
  nombreAsignatura: text('nombre_asignatura').notNull(),
  requisito: text('requisito'),
  nombreRequisito: text('nombre_requisito'),
  codigoRequisito: text('codigo_requisito'),
  semestre: integer('semestre'),
  grupo: text('grupo'),
  totalInscritosRequisito: integer('total_inscritos_requisito'),
  proyReprobadosRequisito: integer('proy_reprobados_requisito'),
  proyAbandonosRequisito: integer('proy_abandonos_requisito'),
  proyAlumnosPromueven: integer('proy_alumnos_promueven'),
  inscritosGestionAnterior: integer('inscritos_gestion_anterior'),
  reprobadosGestionAnterior: integer('reprobados_gestion_anterior'),
  abandonosGestionAnterior: integer('abandonos_gestion_anterior'),
  totalRepitentesGestionAnt: integer('total_repitentes_gestion_ant'),
  proyeccionInscritos: integer('proyeccion_inscritos'),
  editadoManualmente: boolean('editado_manualmente').notNull().default(false),
  estadoEspecial: text('estado_especial'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ uniq: unique().on(t.gestionProyectada, t.carrera, t.sigla) }));
