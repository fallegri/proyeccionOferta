# Diseño Técnico: Estimador de Crecimiento Estudiantil

## Descripción General

El Estimador de Crecimiento Estudiantil es una aplicación web que procesa archivos Excel con históricos académicos y mallas curriculares para proyectar la cantidad de estudiantes que se inscribirán en cada materia por carrera en la siguiente gestión académica. El sistema aplica dos métodos estadísticos (promedio simple o regresión lineal), permite ajuste manual de proyecciones y exporta los resultados a Excel.

### Stack Tecnológico

- **Frontend**: Next.js (React) desplegado en Vercel
- **Backend**: API Routes de Next.js (serverless functions en Vercel)
- **Base de datos**: PostgreSQL serverless en Neon Tech (acceso vía `@neondatabase/serverless`)
- **Procesamiento Excel**: `xlsx` (SheetJS) para lectura y escritura de archivos `.xlsx`/`.xls`
- **Estadística**: cálculo propio para promedio simple; regresión lineal mínimos cuadrados implementada en el servidor
- **ORM / Query Builder**: `drizzle-orm` con driver Neon para tipado seguro y migraciones

---

## Arquitectura

La aplicación sigue una arquitectura de tres capas dentro de un monorepo Next.js:

```
┌─────────────────────────────────────────────────────────┐
│                     Navegador (Cliente)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Página de   │  │  Tabla de    │  │  Exportación  │  │
│  │  Carga/Config│  │  Resultados  │  │  Excel        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │  HTTP / fetch   │                  │
┌─────────▼─────────────────▼──────────────────▼──────────┐
│               API Routes (Next.js / Vercel)              │
│  POST /api/upload/historico                              │
│  POST /api/upload/malla                                  │
│  POST /api/proyeccion/calcular                           │
│  GET  /api/proyeccion/[gestion]                          │
│  POST /api/proyeccion/guardar                            │
│  GET  /api/export/[gestion]                              │
└─────────────────────────┬────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌────────────┐ ┌─────────────┐
   │  Importador │ │ Procesador │ │ Exportador  │
   │  (xlsx)     │ │ (stats)    │ │ (xlsx)      │
   └─────────────┘ └────────────┘ └─────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PostgreSQL (Neon)    │
              │  - mallas            │
              │  - proyecciones      │
              └───────────────────────┘
```

### Flujo Principal

1. El usuario sube el archivo histórico → el Importador valida y parsea → devuelve resumen.
2. El usuario sube el archivo de malla → el Importador valida y parsea → persiste en BD.
3. El usuario configura gestión actual, gestiones atípicas y método de proyección.
4. El usuario inicia el cálculo → el Procesador calcula tasas y proyecciones → devuelve tabla.
5. El usuario revisa, edita manualmente y exporta → el Exportador genera el `.xlsx`.
6. Al confirmar exportación, el Repositorio persiste los resultados.

---

## Componentes e Interfaces

### Importador (`src/lib/importer.ts`)

Responsable de leer y validar archivos Excel.

```typescript
interface HistoricoRow {
  codigoPlanEstudio: string;
  planEstudio: string;
  codigoGestion: string;
  gestion: string;          // formato "N/AAAA"
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

interface MallaRow {
  carrera: string;
  semestre: number;
  sigla: string;
  nombreAsignatura: string;
  requisito: string;  // sigla del prerrequisito; "ADMISIÓN" si no tiene prerrequisito
}

interface ImportResult<T> {
  rows: T[];
  omitidas: number;
  resumen: string;
  errores: string[];
}

function parseHistorico(buffer: Buffer): ImportResult<HistoricoRow>;
function parseMalla(buffer: Buffer): ImportResult<MallaRow>;
```

### Procesador (`src/lib/processor.ts`)

Responsable de calcular tasas estadísticas y proyecciones.

```typescript
type MetodoProyeccion = 'promedio_simple' | 'regresion_lineal';

interface ConfigCalculo {
  gestionActual: string;          // "N/AAAA"
  gestionesSiguiente: string;     // calculada automáticamente
  gestionesAtipicas: string[];
  metodo: MetodoProyeccion;
}

interface TasaMateria {
  sigla: string;
  carrera: string;
  tasaReprobacion: number;        // 0..1
  tasaAbandono: number;           // 0..1
  tasaPromocion: number;          // 1 - reprobacion - abandono
  estado: 'ok' | 'datos_insuficientes' | 'ingreso_manual';
}

interface FilaProyeccion {
  carrera: string;
  nombreAsignatura: string;
  sigla: string;
  requisito: string;           // sigla del prerrequisito; "ADMISIÓN" si no tiene prerrequisito
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
  estadoEspecial: string | null;  // "requiere_ingreso_manual" | "datos_insuficientes" | null
}

function calcularTasas(
  historico: HistoricoRow[],
  config: ConfigCalculo
): TasaMateria[];

function calcularProyecciones(
  historico: HistoricoRow[],
  malla: MallaRow[],
  tasas: TasaMateria[],
  config: ConfigCalculo
): FilaProyeccion[];
```

### Exportador (`src/lib/exporter.ts`)

Responsable de generar el archivo Excel de resultados.

```typescript
function generarExcel(
  filas: FilaProyeccion[],
  gestionSiguiente: string
): Buffer;  // buffer del .xlsx listo para descarga
```

### API Routes (`src/app/api/`)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/upload/historico` | POST | Recibe multipart, valida y retorna `ImportResult` |
| `/api/upload/malla` | POST | Recibe multipart, valida, persiste malla en BD |
| `/api/proyeccion/calcular` | POST | Recibe config + datos en memoria, retorna `FilaProyeccion[]` |
| `/api/proyeccion/guardar` | POST | Persiste `FilaProyeccion[]` en BD |
| `/api/proyeccion/[gestion]` | GET | Recupera proyección histórica de BD |
| `/api/export/[gestion]` | GET | Genera y descarga Excel de proyección guardada |

---

## Modelos de Datos

### Esquema PostgreSQL (Neon)

```sql
-- Mallas curriculares persistidas
CREATE TABLE mallas (
  id          SERIAL PRIMARY KEY,
  carrera     TEXT NOT NULL,
  semestre    INTEGER NOT NULL,
  sigla       TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  requisito   TEXT,                    -- sigla del prerrequisito, NULL si no tiene
  requiere_ingreso_manual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (carrera, sigla)
);

-- Proyecciones guardadas (una fila por materia/carrera/gestión)
CREATE TABLE proyecciones (
  id                              SERIAL PRIMARY KEY,
  gestion_proyectada              TEXT NOT NULL,   -- "N/AAAA"
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
  UNIQUE (gestion_proyectada, carrera, sigla)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_proyecciones_gestion ON proyecciones(gestion_proyectada);
CREATE INDEX idx_mallas_carrera ON mallas(carrera);
```

### Modelos Drizzle ORM (`src/db/schema.ts`)

```typescript
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
  codigoRequisito: text('codigo_requisito'),
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
```

### Estado en Cliente (React Context / Zustand)

```typescript
interface AppState {
  // Datos cargados en memoria (no persisten entre sesiones)
  historicoRows: HistoricoRow[];
  mallaRows: MallaRow[];
  config: ConfigCalculo | null;
  resultados: FilaProyeccion[];
  // UI
  paso: 'carga' | 'config' | 'resultados';
  cargando: boolean;
  errores: string[];
}
```


---

## Propiedades de Corrección

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas de un sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquinas.*

### Propiedad 1: Validación de formato de archivo

*Para cualquier* buffer de archivo, el Importador debe aceptarlo si y solo si su extensión es `.xlsx` o `.xls`, y rechazar cualquier otro formato con un error descriptivo.

**Valida: Requerimientos 1.1, 2.1**

---

### Propiedad 2: Detección de columnas faltantes

*Para cualquier* archivo Excel que omita una o más columnas requeridas, el Importador debe retornar un error que mencione exactamente las columnas faltantes, y no retornar ninguna fila procesada.

**Valida: Requerimientos 1.3, 2.6**

---

### Propiedad 3: Omisión de filas con valores nulos en campos clave

*Para cualquier* archivo histórico con N filas que tengan valores nulos en Sigla, Gestión o Código Plan Estudio, el resultado de importación debe contener exactamente N filas menos que el total, y el campo `omitidas` debe ser igual a N.

**Valida: Requerimiento 1.4**

---

### Propiedad 4: Corrección del resumen de importación

*Para cualquier* archivo histórico válido con un conjunto conocido de registros, el resumen retornado debe reportar exactamente la cantidad de registros cargados, el número de carreras distintas y el rango correcto de gestiones presentes.

**Valida: Requerimiento 1.5**

---

### Propiedad 5: Soporte de múltiples prerrequisitos

*Para cualquier* archivo de malla donde una materia tenga cero, uno o N prerrequisitos, el Importador debe parsear correctamente todos los prerrequisitos sin pérdida ni duplicación.

**Valida: Requerimiento 2.3**

---

### Propiedad 6: Marcado de prerrequisitos no estructurados

*Para cualquier* materia en la malla que contenga una indicación de prerrequisitos múltiples no estructurados, el Importador debe marcar esa materia con `requiereIngresoManual = true` y excluirla del cálculo automático.

**Valida: Requerimiento 2.5**

---

### Propiedad 7: Validación del formato de gestión

*Para cualquier* string ingresado como gestión, el sistema debe aceptarlo si y solo si cumple el patrón `N/AAAA` donde N ∈ {1, 2} y AAAA es un año de 4 dígitos, rechazando cualquier otro formato con un mensaje de error.

**Valida: Requerimientos 3.1, 9.5**

---

### Propiedad 8: Cálculo correcto de la gestión siguiente

*Para cualquier* gestión válida `N/AAAA`, la gestión siguiente calculada debe ser `2/AAAA` si N=1, o `1/(AAAA+1)` si N=2.

**Valida: Requerimiento 3.2**

---

### Propiedad 9: Validación de gestión anterior en el histórico

*Para cualquier* gestión actual ingresada, el sistema debe verificar que el histórico contiene registros de la gestión inmediatamente anterior; si no los contiene, debe emitir una advertencia (no un error fatal) y solicitar confirmación.

**Valida: Requerimiento 3.3**

---

### Propiedad 10: Parsing correcto de gestiones atípicas

*Para cualquier* string de gestiones atípicas separadas por comas, el sistema debe parsear exactamente las gestiones indicadas, ignorando espacios en blanco, y rechazar con error cualquier gestión que no cumpla el formato `N/AAAA`.

**Valida: Requerimiento 3.5**

---

### Propiedad 11: Exclusión de gestiones atípicas del cálculo estadístico

*Para cualquier* conjunto de gestiones históricas donde algunas están marcadas como atípicas, el Procesador no debe incluir ninguna gestión atípica al calcular tasas (ni en promedio simple ni en regresión lineal), independientemente del método seleccionado.

**Valida: Requerimientos 3.7, 4.2, 4.3**

---

### Propiedad 12: Independencia de tasas por sigla y carrera

*Para cualquier* par (sigla, carrera), las tasas de reprobación y abandono calculadas deben ser independientes de los datos de la misma sigla en otras carreras; modificar el histórico de una carrera no debe afectar las tasas de otra carrera para la misma sigla.

**Valida: Requerimientos 4.1, 4.5, 5.6**

---

### Propiedad 13: Marcado de datos insuficientes

*Para cualquier* combinación (sigla, carrera) que tenga menos de 2 gestiones disponibles después de excluir las atípicas, el Procesador debe marcar esa materia con `estado = 'datos_insuficientes'` y no calcular tasas para ella.

**Valida: Requerimiento 4.4**

---

### Propiedad 14: Corrección de la fórmula de proyección con prerrequisito

*Para cualquier* materia con prerrequisito definido, la proyección de inscritos calculada debe ser igual a `floor(inscritos_prereq × tasa_promocion_prereq) + reprobados_materia_ant + abandonos_materia_ant`, donde `tasa_promocion = 1 - tasa_reprobacion - tasa_abandono`.

**Valida: Requerimientos 5.1, 5.3**

---

### Propiedad 15: Base de proyección para materias sin prerrequisito

*Para cualquier* materia de primer semestre (sin prerrequisito), la base de proyección debe ser el promedio aritmético de los inscritos en las últimas 4 gestiones disponibles no atípicas para esa materia y carrera.

**Valida: Requerimiento 5.2**

---

### Propiedad 16: Materias con estado especial tienen proyección vacía

*Para cualquier* materia marcada como `'datos_insuficientes'` o `'ingreso_manual'`, el campo `proyeccionInscritos` en el resultado debe ser `null`, y el campo `estadoEspecial` debe contener el motivo correspondiente.

**Valida: Requerimientos 5.4, 5.5, 6.5**

---

### Propiedad 17: Estructura completa de FilaProyeccion

*Para cualquier* resultado de proyección calculado, cada `FilaProyeccion` debe contener todos los campos definidos en el Requerimiento 6.1: carrera, nombre asignatura, sigla, requisito, código requisito, grupo, total inscritos en el requisito, proyección reprobados requisito, proyección abandonos requisito, proyección alumnos que promueven, inscritos en la asignatura en gestión anterior, reprobados en la asignatura en gestión anterior, abandonos en la asignatura en gestión anterior, total repitentes en gestión anterior, y proyección de inscritos.

**Valida: Requerimiento 6.1**

---

### Propiedad 18: Filtrado de resultados por carrera

*Para cualquier* conjunto de resultados y cualquier carrera C, filtrar los resultados por C debe retornar exactamente las filas cuyo campo `carrera` es igual a C, sin incluir filas de otras carreras.

**Valida: Requerimiento 6.2**

---

### Propiedad 19: Excel contiene todas las columnas requeridas

*Para cualquier* conjunto de `FilaProyeccion`, el archivo `.xlsx` generado por el Exportador debe contener exactamente las columnas definidas en el Requerimiento 6.1 en cada hoja.

**Valida: Requerimiento 7.1**

---

### Propiedad 20: Excel incluye valores editados manualmente

*Para cualquier* conjunto de `FilaProyeccion` donde algunas tienen `editadoManualmente = true`, el archivo Excel generado debe contener los valores modificados (no los calculados originalmente) para esas filas.

**Valida: Requerimiento 7.2**

---

### Propiedad 21: Excel tiene una hoja por carrera

*Para cualquier* conjunto de `FilaProyeccion` con K carreras distintas, el archivo `.xlsx` generado debe tener exactamente K hojas, una por cada carrera, y cada hoja debe contener solo las filas de esa carrera.

**Valida: Requerimiento 7.3**

---

### Propiedad 22: Nombre del archivo sigue el formato correcto

*Para cualquier* gestión siguiente válida `N/AAAA`, el nombre del archivo generado debe ser `proyeccion_N_AAAA.xlsx` (reemplazando `/` por `_`).

**Valida: Requerimiento 7.5**

---

### Propiedad 23: Validación de precondiciones antes del cálculo

*Para cualquier* intento de iniciar el cálculo sin archivo histórico, sin archivo de malla, o sin gestión actual configurada, el sistema debe retornar un error descriptivo que indique exactamente qué dato falta, sin iniciar el procesamiento.

**Valida: Requerimientos 9.1, 9.2**

---

### Propiedad 24: Errores de procesamiento son descriptivos

*Para cualquier* archivo Excel malformado o con datos inválidos, el Importador debe retornar un mensaje de error no vacío que describa el problema específico encontrado, sin lanzar excepciones no controladas.

**Valida: Requerimiento 9.3**

---

## Manejo de Errores

### Errores de Importación

| Situación | Respuesta del sistema |
|-----------|----------------------|
| Formato de archivo no soportado | Error 400 con mensaje: "Formato no soportado. Use .xlsx o .xls" |
| Columnas faltantes | Error 400 con lista de columnas faltantes |
| Archivo vacío o corrupto | Error 400 con descripción del problema |
| Filas con campos clave nulos | Omisión silenciosa + conteo en resumen |

### Errores de Configuración

| Situación | Respuesta del sistema |
|-----------|----------------------|
| Formato de gestión inválido | Error de validación inline en el campo |
| Gestión anterior no encontrada en histórico | Advertencia con opción de continuar |
| Gestiones atípicas con formato inválido | Error de validación inline |

### Errores de Procesamiento

| Situación | Respuesta del sistema |
|-----------|----------------------|
| Materia con < 2 gestiones disponibles | Marcada como "datos insuficientes", incluida en resultado |
| Materia con prerrequisitos no estructurados | Marcada como "requiere ingreso manual", incluida en resultado |
| División por cero en tasas | Tasa = 0, materia marcada como "datos insuficientes" |

### Errores de Persistencia

| Situación | Respuesta del sistema |
|-----------|----------------------|
| Fallo de conexión a Neon | Notificación al usuario + botón de reintento; resultados en pantalla se conservan |
| Timeout de query | Reintento automático hasta 3 veces, luego notificación manual |

### Estrategia General

- Todas las API Routes retornan errores en formato `{ error: string, details?: string[] }`.
- Los errores de validación de archivos no recargan la página; el usuario puede subir un nuevo archivo sin perder la configuración.
- Los errores de BD no borran los resultados calculados en memoria del cliente.

---

## Estrategia de Testing

### Enfoque Dual

Se utilizan dos tipos de tests complementarios:

1. **Tests unitarios**: verifican ejemplos concretos, casos borde y condiciones de error.
2. **Tests de propiedades**: verifican propiedades universales sobre rangos amplios de entradas generadas aleatoriamente.

### Tests Unitarios

Cubren:
- Ejemplos concretos de parsing de archivos Excel con datos conocidos.
- Casos borde: archivo vacío, una sola fila, gestión límite (2/9999 → 1/10000).
- Integración entre Importador → Procesador → Exportador con datos de prueba fijos.
- Round-trips de persistencia: guardar proyección → consultar → verificar igualdad.
- Comportamiento ante fallos de BD simulados con mocks.

### Tests de Propiedades

**Librería**: `fast-check` (TypeScript/JavaScript).

**Configuración**: mínimo 100 iteraciones por propiedad (`numRuns: 100`).

**Formato de etiqueta**:
```
Feature: student-growth-estimator, Property {N}: {texto_de_la_propiedad}
```

Cada propiedad de corrección definida en este documento debe ser implementada por exactamente un test de propiedades. Los generadores de `fast-check` deben producir:
- Buffers de Excel sintéticos con `xlsx` para tests del Importador.
- Arrays de `HistoricoRow` y `MallaRow` con valores aleatorios válidos para tests del Procesador.
- Arrays de `FilaProyeccion` para tests del Exportador.

**Ejemplo de estructura de test de propiedad**:

```typescript
// Feature: student-growth-estimator, Property 8: Cálculo correcto de la gestión siguiente
it('gestión siguiente es correcta para cualquier gestión válida', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer({ min: 2000, max: 2099 }).map(y => `1/${y}`),
        fc.integer({ min: 2000, max: 2099 }).map(y => `2/${y}`)
      ),
      (gestion) => {
        const siguiente = calcularGestionSiguiente(gestion);
        const [n, anio] = gestion.split('/').map(Number);
        if (n === 1) expect(siguiente).toBe(`2/${anio}`);
        else expect(siguiente).toBe(`1/${anio + 1}`);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Cobertura Objetivo

| Módulo | Tests unitarios | Tests de propiedades |
|--------|----------------|---------------------|
| Importador | Ejemplos concretos + casos borde | Propiedades 1–6 |
| Procesador | Ejemplos con datos fijos | Propiedades 7–16 |
| Exportador | Verificación de estructura | Propiedades 17–22 |
| Validaciones | Casos borde de formato | Propiedades 7, 10, 23, 24 |
| Persistencia (BD) | Round-trips con BD de test | Ejemplos E1–E4 |
