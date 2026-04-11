-- =============================================================
-- Script de inicializacion de base de datos
-- Estimador de Crecimiento Estudiantil
-- Compatible con PostgreSQL 14+ / Neon Tech
-- =============================================================
-- Uso:
--   Opcion A (Neon SQL Editor): pega este script en el editor SQL
--   Opcion B (psql):  psql "$DATABASE_URL" -f scripts/init-db.sql
--   Opcion C (drizzle-kit): npx drizzle-kit push
-- =============================================================

-- Tabla de mallas curriculares
-- Persiste la estructura de materias y prerrequisitos por carrera.
-- Se actualiza via upsert cada vez que el usuario sube un archivo de malla.
CREATE TABLE IF NOT EXISTS mallas (
  id                      SERIAL PRIMARY KEY,
  carrera                 TEXT NOT NULL,
  semestre                INTEGER NOT NULL,
  sigla                   TEXT NOT NULL,
  nombre                  TEXT NOT NULL,
  requisito               TEXT,                        -- NULL = sin prerrequisito (primer semestre)
  requiere_ingreso_manual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mallas_carrera_sigla_unique UNIQUE (carrera, sigla)
);

-- Indice para consultas por carrera
CREATE INDEX IF NOT EXISTS idx_mallas_carrera ON mallas(carrera);

-- Tabla de proyecciones guardadas
-- Una fila por combinacion (gestion_proyectada, carrera, sigla).
-- Se actualiza via upsert cuando el usuario confirma y exporta una proyeccion.
CREATE TABLE IF NOT EXISTS proyecciones (
  id                              SERIAL PRIMARY KEY,
  gestion_proyectada              TEXT NOT NULL,        -- formato "N/AAAA", ej: "2/2024"
  carrera                         TEXT NOT NULL,
  sigla                           TEXT NOT NULL,
  nombre_asignatura               TEXT NOT NULL,
  requisito                       TEXT,                 -- sigla del prerrequisito usado
  codigo_requisito                TEXT,                 -- reservado para uso futuro
  grupo                           TEXT,
  total_inscritos_requisito       INTEGER,
  proy_reprobados_requisito       INTEGER,
  proy_abandonos_requisito        INTEGER,
  proy_alumnos_promueven          INTEGER,
  inscritos_gestion_anterior      INTEGER,
  reprobados_gestion_anterior     INTEGER,
  abandonos_gestion_anterior      INTEGER,
  total_repitentes_gestion_ant    INTEGER,
  proyeccion_inscritos            INTEGER,              -- NULL si estado_especial != NULL
  editado_manualmente             BOOLEAN NOT NULL DEFAULT FALSE,
  estado_especial                 TEXT,                 -- 'requiere_ingreso_manual' | 'datos_insuficientes' | NULL
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proyecciones_gestion_carrera_sigla_unique
    UNIQUE (gestion_proyectada, carrera, sigla)
);

-- Indice para consultas por gestion (el patron de acceso mas frecuente)
CREATE INDEX IF NOT EXISTS idx_proyecciones_gestion ON proyecciones(gestion_proyectada);

-- =============================================================
-- Verificacion: muestra las tablas creadas
-- =============================================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c
   WHERE c.table_name = t.table_name
   AND c.table_schema = 'public') AS columnas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('mallas', 'proyecciones')
ORDER BY table_name;
