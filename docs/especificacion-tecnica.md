# Modelo de Base de Datos: Estimador de Crecimiento Estudiantil

## Motor y Plataforma

- **Motor**: PostgreSQL (serverless)
- **Proveedor**: Neon Tech
- **Acceso**: `@neondatabase/serverless` + `drizzle-orm`
- **Migraciones**: `drizzle-kit`

---

## Diagrama Entidad-Relacion

```
+-------------------------------------+
|              mallas                 |
+-------------------------------------+
| PK  id                  SERIAL      |
|     carrera             TEXT         |
|     semestre            INTEGER      |
|     sigla               TEXT         |
|     nombre              TEXT         |
|     requisito           TEXT NULL    |
|     requiere_ingreso_manual BOOLEAN  |
|     created_at          TIMESTAMPTZ  |
+-------------------------------------+
| UNIQUE (carrera, sigla)              |
+-------------------------------------+

+------------------------------------------+
|              proyecciones                |
+------------------------------------------+
| PK  id                      SERIAL       |
|     gestion_proyectada       TEXT         |
|     carrera                  TEXT         |
|     sigla                    TEXT         |
|     nombre_asignatura        TEXT         |
|     requisito                TEXT NULL    |
|     codigo_requisito         TEXT NULL    |
|     grupo                    TEXT NULL    |
|     total_inscritos_requisito    INT NULL  |
|     proy_reprobados_requisito    INT NULL  |
|     proy_abandonos_requisito     INT NULL  |
|     proy_alumnos_promueven       INT NULL  |
|     inscritos_gestion_anterior   INT NULL  |
|     reprobados_gestion_anterior  INT NULL  |
|     abandonos_gestion_anterior   INT NULL  |
|     total_repitentes_gestion_ant INT NULL  |
|     proyeccion_inscritos         INT NULL  |
|     editado_manualmente      BOOLEAN      |
|     estado_especial          TEXT NULL    |
|     created_at               TIMESTAMPTZ  |
+------------------------------------------+
| UNIQUE (gestion_proyectada, carrera, sigla)|
+------------------------------------------+
```
---

## Tabla: mallas

Almacena la estructura curricular de cada carrera. Se persiste al subir el archivo de malla para reutilizarla en gestiones futuras.

| Columna | Tipo | Nulable | Default | Descripcion |
|---------|------|---------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Clave primaria autoincremental |
| `carrera` | `TEXT` | NO | - | Nombre del programa academico |
| `semestre` | `INTEGER` | NO | - | Semestre en que se cursa la materia (1, 2, 3...) |
| `sigla` | `TEXT` | NO | - | Codigo unico de la materia dentro de la carrera |
| `nombre` | `TEXT` | NO | - | Nombre completo de la asignatura |
| `requisito` | `TEXT` | SI | NULL | Sigla del prerrequisito. NULL si no tiene prerrequisito |
| `requiere_ingreso_manual` | `BOOLEAN` | NO | `false` | true si el prerrequisito es no estructurado |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha/hora de insercion |

### Restricciones

- `PRIMARY KEY (id)`
- `UNIQUE (carrera, sigla)` — una materia es unica por carrera; el upsert usa esta clave

### Indices

```sql
CREATE INDEX idx_mallas_carrera ON mallas(carrera);
```

### Notas de negocio

- Una materia con multiples prerrequisitos genera **multiples filas** (una por prerrequisito), todas con el mismo `(carrera, sigla)`.
- Cuando `requisito` es NULL, la materia no tiene prerrequisito. En la capa de aplicacion se representa como `"ADMISION"`.
- `requiere_ingreso_manual = true` excluye la materia del calculo automatico de proyecciones.

---

## Tabla: proyecciones

Almacena los resultados de proyeccion calculados y confirmados por el usuario. Una fila por materia x carrera x gestion proyectada.

| Columna | Tipo | Nulable | Default | Descripcion |
|---------|------|---------|---------|-------------|
| `id` | `SERIAL` | NO | auto | Clave primaria autoincremental |
| `gestion_proyectada` | `TEXT` | NO | - | Gestion para la que se proyecta, formato `N/AAAA` (ej: `2/2024`) |
| `carrera` | `TEXT` | NO | - | Nombre del programa academico |
| `sigla` | `TEXT` | NO | - | Codigo de la materia |
| `nombre_asignatura` | `TEXT` | NO | - | Nombre completo de la asignatura |
| `requisito` | `TEXT` | SI | NULL | Sigla del prerrequisito usado en el calculo |
| `codigo_requisito` | `TEXT` | SI | NULL | Codigo interno del prerrequisito (reservado) |
| `grupo` | `TEXT` | SI | NULL | Grupo o turno de la materia |
| `total_inscritos_requisito` | `INTEGER` | SI | NULL | Inscritos en el prerrequisito en la gestion actual |
| `proy_reprobados_requisito` | `INTEGER` | SI | NULL | floor(inscritos_prereq x tasa_reprobacion_prereq) |
| `proy_abandonos_requisito` | `INTEGER` | SI | NULL | floor(inscritos_prereq x tasa_abandono_prereq) |
| `proy_alumnos_promueven` | `INTEGER` | SI | NULL | floor(inscritos_prereq x tasa_promocion_prereq) |
| `inscritos_gestion_anterior` | `INTEGER` | SI | NULL | Total inscritos en esta materia en la gestion anterior |
| `reprobados_gestion_anterior` | `INTEGER` | SI | NULL | Reprobados en esta materia en la gestion anterior |
| `abandonos_gestion_anterior` | `INTEGER` | SI | NULL | Abandonos en esta materia en la gestion anterior |
| `total_repitentes_gestion_ant` | `INTEGER` | SI | NULL | reprobados_ant + abandonos_ant |
| `proyeccion_inscritos` | `INTEGER` | SI | NULL | Proyeccion final. NULL si estado_especial != NULL |
| `editado_manualmente` | `BOOLEAN` | NO | `false` | true si el usuario modifico proyeccion_inscritos manualmente |
| `estado_especial` | `TEXT` | SI | NULL | `requiere_ingreso_manual` o `datos_insuficientes` o NULL |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Fecha/hora de insercion |

### Restricciones

- `PRIMARY KEY (id)`
- `UNIQUE (gestion_proyectada, carrera, sigla)` — el upsert usa esta clave para actualizar proyecciones existentes

### Indices

```sql
CREATE INDEX idx_proyecciones_gestion ON proyecciones(gestion_proyectada);
```

### Notas de negocio

- `proyeccion_inscritos` es NULL cuando `estado_especial` tiene valor — la materia requiere intervencion manual.
- `editado_manualmente = true` indica que el valor exportado al Excel difiere del calculado automaticamente.
- El upsert actualiza solo `proyeccion_inscritos`, `editado_manualmente` y `estado_especial` en conflicto, preservando el resto de los campos calculados.

---

## DDL Completo

```sql
-- Tabla de mallas curriculares
CREATE TABLE mallas (
  id                      SERIAL PRIMARY KEY,
  carrera                 TEXT NOT NULL,
  semestre                INTEGER NOT NULL,
  sigla                   TEXT NOT NULL,
  nombre                  TEXT NOT NULL,
  requisito               TEXT,
  requiere_ingreso_manual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mallas_carrera_sigla_unique UNIQUE (carrera, sigla)
);

CREATE INDEX idx_mallas_carrera ON mallas(carrera);

-- Tabla de proyecciones guardadas
CREATE TABLE proyecciones (
  id                              SERIAL PRIMARY KEY,
  gestion_proyectada              TEXT NOT NULL,
  carrera                         TEXT NOT NULL,
  sigla                           TEXT NOT NULL,
  nombre_asignatura               TEXT NOT NULL,
  requisito                       TEXT,
  codigo_requisito                TEXT,
  grupo                           TEXT,
  total_inscritos_requisito       INTEGER,
  proy_reprobados_requisito       INTEGER,
  proy_abandonos_requisito        INTEGER,
  proy_alumnos_promueven          INTEGER,
  inscritos_gestion_anterior      INTEGER,
  reprobados_gestion_anterior     INTEGER,
  abandonos_gestion_anterior      INTEGER,
  total_repitentes_gestion_ant    INTEGER,
  proyeccion_inscritos            INTEGER,
  editado_manualmente             BOOLEAN NOT NULL DEFAULT FALSE,
  estado_especial                 TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proyecciones_gestion_carrera_sigla_unique
    UNIQUE (gestion_proyectada, carrera, sigla)
);

CREATE INDEX idx_proyecciones_gestion ON proyecciones(gestion_proyectada);
```

---

## Esquema Drizzle ORM (src/db/schema.ts)

```typescript
import {
  pgTable, serial, text, integer, boolean, timestamp, unique
} from 'drizzle-orm/pg-core';

export const mallas = pgTable('mallas', {
  id:                     serial('id').primaryKey(),
  carrera:                text('carrera').notNull(),
  semestre:               integer('semestre').notNull(),
  sigla:                  text('sigla').notNull(),
  nombre:                 text('nombre').notNull(),
  requisito:              text('requisito'),
  requiereIngresoManual:  boolean('requiere_ingreso_manual').notNull().default(false),
  createdAt:              timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.carrera, t.sigla),
}));

export const proyecciones = pgTable('proyecciones', {
  id:                         serial('id').primaryKey(),
  gestionProyectada:          text('gestion_proyectada').notNull(),
  carrera:                    text('carrera').notNull(),
  sigla:                      text('sigla').notNull(),
  nombreAsignatura:           text('nombre_asignatura').notNull(),
  requisito:                  text('requisito'),
  codigoRequisito:            text('codigo_requisito'),
  grupo:                      text('grupo'),
  totalInscritosRequisito:    integer('total_inscritos_requisito'),
  proyReprobadosRequisito:    integer('proy_reprobados_requisito'),
  proyAbandonosRequisito:     integer('proy_abandonos_requisito'),
  proyAlumnosPromueven:       integer('proy_alumnos_promueven'),
  inscritosGestionAnterior:   integer('inscritos_gestion_anterior'),
  reprobadosGestionAnterior:  integer('reprobados_gestion_anterior'),
  abandonosGestionAnterior:   integer('abandonos_gestion_anterior'),
  totalRepitentesGestionAnt:  integer('total_repitentes_gestion_ant'),
  proyeccionInscritos:        integer('proyeccion_inscritos'),
  editadoManualmente:         boolean('editado_manualmente').notNull().default(false),
  estadoEspecial:             text('estado_especial'),
  createdAt:                  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.gestionProyectada, t.carrera, t.sigla),
}));
```

---

## Configuracion Drizzle Kit (drizzle.config.ts)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

Ejecutar migracion:

```bash
npx drizzle-kit push
```

---

## Conexion a la Base de Datos (src/db/index.ts)

```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Variable de entorno requerida en `.env.local`:

```
DATABASE_URL=postgresql://user:password@host/dbname
```

---

## Patrones de Acceso

### Upsert de malla (POST /api/upload/malla)

```typescript
await db.insert(mallas).values({ ... })
  .onConflictDoUpdate({
    target: [mallas.carrera, mallas.sigla],
    set: {
      semestre:              sql`excluded.semestre`,
      nombre:                sql`excluded.nombre`,
      requisito:             sql`excluded.requisito`,
      requiereIngresoManual: sql`excluded.requiere_ingreso_manual`,
    },
  });
```

### Upsert de proyeccion (POST /api/proyeccion/guardar)

```typescript
await db.insert(proyecciones).values({ ... })
  .onConflictDoUpdate({
    target: [proyecciones.gestionProyectada, proyecciones.carrera, proyecciones.sigla],
    set: {
      proyeccionInscritos: sql`excluded.proyeccion_inscritos`,
      editadoManualmente:  sql`excluded.editado_manualmente`,
      estadoEspecial:      sql`excluded.estado_especial`,
    },
  });
```

### Consulta de proyeccion historica (GET /api/proyeccion/[gestion])

```typescript
const rows = await db.select()
  .from(proyecciones)
  .where(eq(proyecciones.gestionProyectada, gestion));
```

---

## Valores Especiales

| Campo | Valor | Significado |
|-------|-------|-------------|
| `mallas.requisito` | NULL | Materia sin prerrequisito. En la app se muestra como `ADMISION` |
| `proyecciones.proyeccion_inscritos` | NULL | Materia con estado especial; requiere ingreso manual |
| `proyecciones.estado_especial` | `requiere_ingreso_manual` | Prerrequisito no estructurado detectado en la malla |
| `proyecciones.estado_especial` | `datos_insuficientes` | Menos de 2 gestiones historicas disponibles para calcular tasas |
| `proyecciones.editado_manualmente` | `true` | El valor de proyeccion fue modificado por el usuario antes de exportar |
