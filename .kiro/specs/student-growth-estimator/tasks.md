# Plan de Implementación: Estimador de Crecimiento Estudiantil

## Descripción General

Implementación incremental del Estimador de Crecimiento Estudiantil en Next.js + TypeScript, siguiendo la arquitectura de tres capas: Importador → Procesador → Exportador, con API Routes serverless y persistencia en PostgreSQL (Neon) vía Drizzle ORM.

## Tareas

- [x] 1. Configurar estructura del proyecto y esquema de base de datos
  - Instalar dependencias: `xlsx`, `drizzle-orm`, `@neondatabase/serverless`, `fast-check`, `drizzle-kit`
  - Crear `src/db/schema.ts` con las tablas `mallas` y `proyecciones` usando Drizzle ORM
  - Crear `src/db/index.ts` con la conexión a Neon y la instancia de Drizzle
  - Crear `drizzle.config.ts` y ejecutar la migración inicial
  - Definir todos los tipos e interfaces en `src/lib/types.ts`: `HistoricoRow`, `MallaRow`, `ImportResult`, `ConfigCalculo`, `TasaMateria`, `FilaProyeccion`, `AppState`
  - _Requerimientos: 1.2, 2.2, 8.1_

- [x] 2. Implementar el Importador
  - [x] 2.1 Implementar `parseHistorico` en `src/lib/importer.ts`
    - Leer buffer con SheetJS, mapear columnas requeridas, omitir filas con Sigla/Gestión/CódigoPlanEstudio nulos, retornar `ImportResult<HistoricoRow>`
    - _Requerimientos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Escribir test de propiedad para `parseHistorico` — Propiedad 1
    - **Propiedad 1: Validación de formato de archivo**
    - **Valida: Requerimientos 1.1, 2.1**

  - [x] 2.3 Escribir test de propiedad para `parseHistorico` — Propiedad 2
    - **Propiedad 2: Detección de columnas faltantes**
    - **Valida: Requerimientos 1.3, 2.6**

  - [x] 2.4 Escribir test de propiedad para `parseHistorico` — Propiedad 3
    - **Propiedad 3: Omisión de filas con valores nulos en campos clave**
    - **Valida: Requerimiento 1.4**

  - [x] 2.5 Escribir test de propiedad para `parseHistorico` — Propiedad 4
    - **Propiedad 4: Corrección del resumen de importación**
    - **Valida: Requerimiento 1.5**

  - [x] 2.6 Implementar `parseMalla` en `src/lib/importer.ts`
    - Leer buffer con SheetJS, mapear columnas requeridas, soportar cero/uno/múltiples prerrequisitos, marcar materias con prerrequisitos no estructurados como `requiereIngresoManual = true`, usar `"ADMISIÓN"` como valor por defecto cuando no hay prerrequisito
    - _Requerimientos: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 2.7 Escribir test de propiedad para `parseMalla` — Propiedad 5
    - **Propiedad 5: Soporte de múltiples prerrequisitos**
    - **Valida: Requerimiento 2.3**

  - [x] 2.8 Escribir test de propiedad para `parseMalla` — Propiedad 6
    - **Propiedad 6: Marcado de prerrequisitos no estructurados**
    - **Valida: Requerimiento 2.5**

  - [x] 2.9 Escribir tests unitarios para el Importador
    - Casos borde: archivo vacío, una sola fila, todas las filas omitidas, columnas en orden distinto
    - _Requerimientos: 1.1–1.5, 2.1–2.6_

- [x] 3. Checkpoint — Asegurarse de que todos los tests del Importador pasen, consultar al usuario si surgen dudas.

- [x] 4. Implementar validaciones y el Procesador
  - [x] 4.1 Implementar funciones de validación en `src/lib/validators.ts`
    - `validarFormatoGestion(s: string): boolean` — patrón `N/AAAA`, N ∈ {1,2}
    - `calcularGestionSiguiente(g: string): string` — `2/AAAA` si N=1, `1/(AAAA+1)` si N=2
    - `parsearGestionesAtipicas(s: string): string[]` — split por coma, trim, validar cada una
    - _Requerimientos: 3.1, 3.2, 3.5, 9.5_

  - [x] 4.2 Escribir test de propiedad para validaciones — Propiedad 7
    - **Propiedad 7: Validación del formato de gestión**
    - **Valida: Requerimientos 3.1, 9.5**

  - [x] 4.3 Escribir test de propiedad para `calcularGestionSiguiente` — Propiedad 8
    - **Propiedad 8: Cálculo correcto de la gestión siguiente**
    - **Valida: Requerimiento 3.2**

  - [x] 4.4 Escribir test de propiedad para `parsearGestionesAtipicas` — Propiedad 10
    - **Propiedad 10: Parsing correcto de gestiones atípicas**
    - **Valida: Requerimiento 3.5**

  - [x] 4.5 Implementar `calcularTasas` en `src/lib/processor.ts`
    - Filtrar histórico por (sigla, carrera), excluir gestiones atípicas, aplicar promedio simple (últimas 4) o regresión lineal (todas disponibles), marcar `datos_insuficientes` si < 2 gestiones disponibles
    - _Requerimientos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.6 Escribir test de propiedad para `calcularTasas` — Propiedad 11
    - **Propiedad 11: Exclusión de gestiones atípicas del cálculo estadístico**
    - **Valida: Requerimientos 3.7, 4.2, 4.3**

  - [x] 4.7 Escribir test de propiedad para `calcularTasas` — Propiedad 12
    - **Propiedad 12: Independencia de tasas por sigla y carrera**
    - **Valida: Requerimientos 4.1, 4.5, 5.6**

  - [x] 4.8 Escribir test de propiedad para `calcularTasas` — Propiedad 13
    - **Propiedad 13: Marcado de datos insuficientes**
    - **Valida: Requerimiento 4.4**

  - [x] 4.9 Implementar `calcularProyecciones` en `src/lib/processor.ts`
    - Para materias con prerrequisito: `floor(inscritos_prereq × tasa_promocion) + reprobados_ant + abandonos_ant`
    - Para materias sin prerrequisito (primer semestre): promedio de inscritos en últimas 4 gestiones no atípicas
    - Incluir materias con estado especial con `proyeccionInscritos: null`
    - Usar `"ADMISIÓN"` como valor del campo `requisito` cuando no hay prerrequisito
    - _Requerimientos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.10 Escribir test de propiedad para `calcularProyecciones` — Propiedad 9
    - **Propiedad 9: Validación de gestión anterior en el histórico**
    - **Valida: Requerimiento 3.3**

  - [x] 4.11 Escribir test de propiedad para `calcularProyecciones` — Propiedad 14
    - **Propiedad 14: Corrección de la fórmula de proyección con prerrequisito**
    - **Valida: Requerimientos 5.1, 5.3**

  - [x] 4.12 Escribir test de propiedad para `calcularProyecciones` — Propiedad 15
    - **Propiedad 15: Base de proyección para materias sin prerrequisito**
    - **Valida: Requerimiento 5.2**

  - [x] 4.13 Escribir test de propiedad para `calcularProyecciones` — Propiedad 16
    - **Propiedad 16: Materias con estado especial tienen proyección vacía**
    - **Valida: Requerimientos 5.4, 5.5, 6.5**

  - [x] 4.14 Escribir test de propiedad para `calcularProyecciones` — Propiedad 17
    - **Propiedad 17: Estructura completa de FilaProyeccion**
    - **Valida: Requerimiento 6.1**

  - [x] 4.15 Escribir tests unitarios para el Procesador
    - Ejemplos concretos con datos fijos, casos borde: una sola gestión disponible, tasa > 1 por datos corruptos, división por cero
    - _Requerimientos: 4.1–4.5, 5.1–5.6_

- [x] 5. Checkpoint — Asegurarse de que todos los tests del Procesador pasen, consultar al usuario si surgen dudas.

- [x] 6. Implementar el Exportador
  - [x] 6.1 Implementar `generarExcel` en `src/lib/exporter.ts`
    - Agrupar `FilaProyeccion[]` por carrera, crear una hoja por carrera con SheetJS, incluir todas las columnas del Requerimiento 6.1, nombrar el archivo `proyeccion_N_AAAA.xlsx`
    - _Requerimientos: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 6.2 Escribir test de propiedad para `generarExcel` — Propiedad 18
    - **Propiedad 18: Filtrado de resultados por carrera**
    - **Valida: Requerimiento 6.2**

  - [x] 6.3 Escribir test de propiedad para `generarExcel` — Propiedad 19
    - **Propiedad 19: Excel contiene todas las columnas requeridas**
    - **Valida: Requerimiento 7.1**

  - [x] 6.4 Escribir test de propiedad para `generarExcel` — Propiedad 20
    - **Propiedad 20: Excel incluye valores editados manualmente**
    - **Valida: Requerimiento 7.2**

  - [x] 6.5 Escribir test de propiedad para `generarExcel` — Propiedad 21
    - **Propiedad 21: Excel tiene una hoja por carrera**
    - **Valida: Requerimiento 7.3**

  - [x] 6.6 Escribir test de propiedad para `generarExcel` — Propiedad 22
    - **Propiedad 22: Nombre del archivo sigue el formato correcto**
    - **Valida: Requerimiento 7.5**

  - [x] 6.7 Escribir tests unitarios para el Exportador
    - Verificar estructura de hojas, columnas presentes, valores editados vs. calculados
    - _Requerimientos: 7.1–7.5_

- [x] 7. Implementar las API Routes
  - [x] 7.1 Implementar `POST /api/upload/historico` en `src/app/api/upload/historico/route.ts`
    - Recibir multipart, llamar `parseHistorico`, retornar `ImportResult` o error 400
    - _Requerimientos: 1.1–1.5, 9.3_

  - [x] 7.2 Implementar `POST /api/upload/malla` en `src/app/api/upload/malla/route.ts`
    - Recibir multipart, llamar `parseMalla`, persistir en tabla `mallas` con Drizzle (upsert por carrera+sigla), retornar `ImportResult` o error 400
    - _Requerimientos: 2.1–2.6, 8.5_

  - [x] 7.3 Implementar `POST /api/proyeccion/calcular` en `src/app/api/proyeccion/calcular/route.ts`
    - Recibir `{ historico, malla, config }`, validar precondiciones, llamar `calcularTasas` y `calcularProyecciones`, retornar `FilaProyeccion[]`
    - _Requerimientos: 3.1–3.7, 4.1–4.5, 5.1–5.6, 9.1, 9.2_

  - [x] 7.4 Escribir test de propiedad para las API Routes — Propiedad 23
    - **Propiedad 23: Validación de precondiciones antes del cálculo**
    - **Valida: Requerimientos 9.1, 9.2**

  - [x] 7.5 Escribir test de propiedad para el Importador — Propiedad 24
    - **Propiedad 24: Errores de procesamiento son descriptivos**
    - **Valida: Requerimiento 9.3**

  - [x] 7.6 Implementar `POST /api/proyeccion/guardar` en `src/app/api/proyeccion/guardar/route.ts`
    - Recibir `FilaProyeccion[]` + gestión, persistir en tabla `proyecciones` con Drizzle (upsert por gestion+carrera+sigla), retornar confirmación o error
    - _Requerimientos: 8.1_

  - [x] 7.7 Implementar `GET /api/proyeccion/[gestion]` en `src/app/api/proyeccion/[gestion]/route.ts`
    - Consultar tabla `proyecciones` por `gestion_proyectada`, retornar `FilaProyeccion[]` o 404
    - _Requerimientos: 8.2, 8.3_

  - [x] 7.8 Implementar `GET /api/export/[gestion]` en `src/app/api/export/[gestion]/route.ts`
    - Recuperar proyección de BD, llamar `generarExcel`, retornar buffer con headers de descarga
    - _Requerimientos: 8.4, 7.4, 7.5_

- [x] 8. Checkpoint — Asegurarse de que todos los tests de API Routes pasen, consultar al usuario si surgen dudas.

- [x] 9. Implementar la interfaz de usuario
  - [x] 9.1 Crear el estado global de la aplicación en `src/store/appStore.ts`
    - Implementar store (Zustand o React Context) con `AppState`: `historicoRows`, `mallaRows`, `config`, `resultados`, `paso`, `cargando`, `errores`
    - _Requerimientos: 3.1–3.7, 6.1_

  - [x] 9.2 Crear el componente de carga de archivos en `src/components/UploadPanel.tsx`
    - Inputs para archivo histórico y archivo de malla, llamadas a `/api/upload/historico` y `/api/upload/malla`, mostrar resumen de importación y errores inline sin recargar la página
    - _Requerimientos: 1.1–1.5, 2.1–2.6, 9.3_

  - [x] 9.3 Crear el componente de configuración en `src/components/ConfigPanel.tsx`
    - Input de gestión actual con validación de formato `N/AAAA`, input de gestiones atípicas separadas por comas, selector de método (promedio simple / regresión lineal), mostrar gestión siguiente calculada automáticamente
    - _Requerimientos: 3.1–3.7, 9.5_

  - [x] 9.4 Crear el componente de tabla de resultados en `src/components/ResultsTable.tsx`
    - Mostrar `FilaProyeccion[]` con todas las columnas del Requerimiento 6.1, filtro por carrera, celdas editables para `proyeccionInscritos` con resaltado visual al editar, indicación visual para materias con estado especial
    - _Requerimientos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.5 Crear el componente de exportación en `src/components/ExportButton.tsx`
    - Botón que llama a `generarExcel` en cliente o a `/api/export/[gestion]`, inicia descarga automática, llama a `/api/proyeccion/guardar` al confirmar exportación, manejo de error de BD con botón de reintento
    - _Requerimientos: 7.1–7.5, 8.1, 9.4_

  - [x] 9.6 Ensamblar la página principal en `src/app/page.tsx`
    - Orquestar los pasos: `carga` → `config` → `resultados`, integrar todos los componentes, manejar transiciones de estado
    - _Requerimientos: 6.1, 8.2, 8.3, 9.1, 9.2_

- [x] 10. Checkpoint final — Asegurarse de que todos los tests pasen y la aplicación funcione de extremo a extremo, consultar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requerimientos específicos para trazabilidad
- Los tests de propiedades usan `fast-check` con mínimo 100 iteraciones (`numRuns: 100`)
- Los tests de propiedades deben usar la etiqueta: `Feature: student-growth-estimator, Property {N}: {texto}`
- El campo `requisito` en `MallaRow` y `FilaProyeccion` es siempre `string`, usando `"ADMISIÓN"` como valor por defecto cuando no hay prerrequisito
