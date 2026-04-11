# Diagramas de Secuencia: Estimador de Crecimiento Estudiantil

Los diagramas usan sintaxis Mermaid. Actores participantes:

- **Usuario** — navegador web
- **UI** — componentes React (cliente)
- **API** — Next.js Route Handlers (servidor)
- **Lib** — modulos de logica de negocio (Importador, Procesador, Exportador, Validators)
- **DB** — PostgreSQL en Neon Tech

---

## Secuencia 1: Carga del Archivo Historico

El usuario sube el archivo Excel con el historico de rendimiento academico.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (UploadPanel)
    participant API as POST /api/upload/historico
    participant Lib as Importador (parseHistorico)

    Usuario->>UI: Selecciona archivo .xlsx/.xls
    UI->>UI: Crea FormData con el archivo
    UI->>API: POST multipart/form-data { file }
    API->>API: Extrae buffer del archivo
    API->>Lib: parseHistorico(buffer)
    Lib->>Lib: XLSX.read(buffer)
    Lib->>Lib: Detecta columnas requeridas
    alt Columnas faltantes
        Lib-->>API: { rows:[], errores:["Columnas faltantes: ..."] }
        API-->>UI: 400 { error, details }
        UI-->>Usuario: Muestra error inline (sin recargar pagina)
    else Archivo valido
        Lib->>Lib: Mapea filas, omite nulos en Sigla/Gestion/CodigoPlan
        Lib-->>API: { rows: HistoricoRow[], omitidas, resumen, errores:[] }
        API-->>UI: 200 ImportResult<HistoricoRow>
        UI->>UI: dispatch SET_HISTORICO (store)
        UI-->>Usuario: Muestra resumen (N registros, M carreras, rango gestiones)
    end
```

---

## Secuencia 2: Carga del Archivo de Malla Curricular

El usuario sube el archivo Excel con la malla curricular. Los datos se persisten en BD.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (UploadPanel)
    participant API as POST /api/upload/malla
    participant Lib as Importador (parseMalla)
    participant DB as PostgreSQL (tabla mallas)

    Usuario->>UI: Selecciona archivo .xlsx/.xls
    UI->>API: POST multipart/form-data { file }
    API->>API: Extrae buffer del archivo
    API->>Lib: parseMalla(buffer)
    Lib->>Lib: XLSX.read(buffer)
    Lib->>Lib: Detecta columnas requeridas
    alt Columnas faltantes
        Lib-->>API: { rows:[], errores:["Columnas faltantes: ..."] }
        API-->>UI: 400 { error, details }
        UI-->>Usuario: Muestra error inline
    else Archivo valido
        Lib->>Lib: Mapea filas, expande prerrequisitos multiples
        Lib->>Lib: Marca requiereIngresoManual=true si prerreq no estructurado
        Lib->>Lib: Usa "ADMISION" si no hay prerrequisito
        Lib-->>API: { rows: MallaRow[], omitidas, resumen, errores:[] }
        loop Por cada MallaRow
            API->>DB: INSERT INTO mallas ... ON CONFLICT (carrera, sigla) DO UPDATE
        end
        API-->>UI: 200 ImportResult<MallaRow>
        UI->>UI: dispatch SET_MALLA (store)
        UI-->>Usuario: Muestra resumen (N materias, M carreras)
    end
```

---

## Secuencia 3: Configuracion del Calculo

El usuario ingresa la gestion actual, gestiones atipicas y metodo de proyeccion.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (ConfigPanel)
    participant Lib as Validators

    Usuario->>UI: Ingresa gestion actual (ej: 1/2024)
    UI->>Lib: validarFormatoGestion("1/2024")
    Lib-->>UI: true
    UI->>Lib: calcularGestionSiguiente("1/2024")
    Lib-->>UI: "2/2024"
    UI-->>Usuario: Muestra "Gestion siguiente: 2/2024"

    Usuario->>UI: Ingresa gestiones atipicas (ej: "1/2020, 2/2020")
    UI->>Lib: parsearGestionesAtipicas("1/2020, 2/2020")
    alt Formato invalido en alguna gestion
        Lib-->>UI: throws Error("Gestion atipica con formato invalido: ...")
        UI-->>Usuario: Muestra error inline en el campo
    else Todas validas
        Lib-->>UI: ["1/2020", "2/2020"]
    end

    Usuario->>UI: Selecciona metodo (promedio_simple | regresion_lineal)
    Usuario->>UI: Click "Calcular Proyeccion"
    UI->>UI: Valida todos los campos
    alt Validacion falla
        UI-->>Usuario: Muestra errores inline
    else Validacion OK
        UI->>UI: dispatch SET_CONFIG { gestionActual, gestionSiguiente, gestionesAtipicas, metodo }
        UI->>UI: Llama onNext() -> inicia calculo
    end
```

---

## Secuencia 4: Calculo de Proyecciones

El sistema calcula tasas estadisticas y proyecciones de inscritos.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (page.tsx)
    participant API as POST /api/proyeccion/calcular
    participant Proc as Procesador

    Usuario->>UI: Click "Calcular Proyeccion"
    UI->>UI: dispatch SET_CARGANDO true
    UI->>API: POST { historico: HistoricoRow[], malla: MallaRow[], config: ConfigCalculo }

    API->>API: Valida precondiciones
    alt Falta historico
        API-->>UI: 400 { error: "Falta el archivo historico" }
        UI-->>Usuario: Muestra error
    else Falta malla
        API-->>UI: 400 { error: "Falta el archivo de malla curricular" }
        UI-->>Usuario: Muestra error
    else Falta gestionActual
        API-->>UI: 400 { error: "Falta la gestion actual" }
        UI-->>Usuario: Muestra error
    else Precondiciones OK
        API->>Proc: calcularTasas(historico, config)
        Note over Proc: Agrupa por (sigla, carrera)<br/>Excluye gestiones atipicas<br/>Aplica promedio simple o regresion lineal<br/>Marca datos_insuficientes si < 2 gestiones
        Proc-->>API: TasaMateria[]

        API->>Proc: calcularProyecciones(historico, malla, tasas, config)
        Note over Proc: Por cada MallaRow:<br/>- requiereIngresoManual -> proyeccion null<br/>- datos_insuficientes -> proyeccion null<br/>- ADMISION -> promedio ultimas 4 gestiones<br/>- con prereq -> floor(inscritos*tasaPromocion)+reprobados+abandonos
        Proc-->>API: FilaProyeccion[]

        API-->>UI: 200 FilaProyeccion[]
        UI->>UI: dispatch SET_RESULTADOS
        UI->>UI: dispatch SET_PASO "resultados"
        UI->>UI: dispatch SET_CARGANDO false
        UI-->>Usuario: Muestra tabla de resultados
    end
```

---

## Secuencia 5: Visualizacion y Edicion de Resultados

El usuario revisa la tabla de proyecciones y edita valores manualmente.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (ResultsTable)
    participant Store as AppStore (React Context)

    UI-->>Usuario: Renderiza tabla con FilaProyeccion[]
    Note over UI: Columnas: Carrera, Asignatura, Codigo,<br/>Requisito, Inscritos Req, Proyeccion Reprobados,<br/>Proyeccion Abandonos, Promueven,<br/>Inscritos Ant, Reprobados Ant, Abandonos Ant,<br/>Repitentes Ant, Proyeccion Inscritos, Estado

    Usuario->>UI: Selecciona carrera en filtro
    UI->>UI: Filtra resultados por carrera seleccionada
    UI-->>Usuario: Muestra solo filas de esa carrera

    Usuario->>UI: Edita celda "Proyeccion Inscritos" de una materia
    UI->>Store: dispatch UPDATE_PROYECCION { sigla, carrera, valor }
    Store->>Store: Actualiza fila: proyeccionInscritos=valor, editadoManualmente=true
    Store-->>UI: Estado actualizado
    UI-->>Usuario: Celda resaltada en azul (editadoManualmente=true)

    Note over UI: Materias con estadoEspecial:<br/>- "requiere_ingreso_manual" -> fondo amarillo, badge "Manual"<br/>- "datos_insuficientes" -> fondo amarillo, badge "Sin datos"
```

---

## Secuencia 6: Exportacion a Excel

El usuario exporta los resultados a un archivo .xlsx con descarga automatica.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (ExportButton)
    participant Lib as Exportador (generarExcel)
    participant Browser as Navegador

    Usuario->>UI: Click "Exportar Excel"
    UI->>Lib: generarExcel(resultados, config.gestionSiguiente)
    Note over Lib: Agrupa FilaProyeccion[] por carrera<br/>Crea una hoja por carrera<br/>Incluye valores editados manualmente<br/>Nombre: proyeccion_N_AAAA.xlsx
    Lib-->>UI: { buffer: Buffer, filename: "proyeccion_2_2024.xlsx" }
    UI->>Browser: new Blob([buffer]) -> URL.createObjectURL
    UI->>Browser: <a href=url download=filename>.click()
    Browser-->>Usuario: Descarga automatica del archivo .xlsx
    UI->>Browser: URL.revokeObjectURL(url)
```

---

## Secuencia 7: Guardado de Proyeccion en Base de Datos

El usuario guarda la proyeccion para consulta futura.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (ExportButton)
    participant API as POST /api/proyeccion/guardar
    participant DB as PostgreSQL (tabla proyecciones)

    Usuario->>UI: Click "Guardar Proyeccion"
    UI->>UI: setSaving(true)
    UI->>API: POST { filas: FilaProyeccion[], gestion: "2/2024" }

    alt Faltan datos requeridos
        API-->>UI: 400 { error: "Faltan datos requeridos" }
        UI-->>Usuario: Muestra error con boton "Reintentar"
    else Datos OK
        loop Por cada FilaProyeccion
            API->>DB: INSERT INTO proyecciones ... ON CONFLICT DO UPDATE
            Note over DB: Actualiza proyeccion_inscritos,<br/>editado_manualmente, estado_especial
        end
        API-->>UI: 200 { ok: true, guardadas: N }
        UI->>UI: setSaved(true)
        UI-->>Usuario: Boton muestra "Guardado ✓"
    end

    alt Error de conexion a BD
        DB-->>API: Error de conexion
        API-->>UI: 500 { error: "..." }
        UI->>UI: setSaveError(mensaje)
        UI-->>Usuario: Muestra error + boton "Reintentar"
        Note over UI: Los resultados en pantalla se conservan
    end
```

---

## Secuencia 8: Consulta de Proyeccion Historica

El usuario consulta una proyeccion guardada en una gestion anterior.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (page.tsx)
    participant API as GET /api/proyeccion/[gestion]
    participant DB as PostgreSQL (tabla proyecciones)

    Usuario->>UI: Selecciona gestion pasada (ej: "1/2024")
    UI->>API: GET /api/proyeccion/1%2F2024
    API->>API: decodeURIComponent("1%2F2024") -> "1/2024"
    API->>DB: SELECT * FROM proyecciones WHERE gestion_proyectada = '1/2024'

    alt No hay proyecciones para esa gestion
        DB-->>API: []
        API-->>UI: 404 { error: "No se encontraron proyecciones para esta gestion" }
        UI-->>Usuario: Muestra mensaje informativo
    else Proyecciones encontradas
        DB-->>API: proyecciones[]
        API->>API: Mapea filas DB -> FilaProyeccion[]
        API-->>UI: 200 FilaProyeccion[]
        UI->>UI: dispatch SET_RESULTADOS
        UI->>UI: dispatch SET_PASO "resultados"
        UI-->>Usuario: Muestra tabla con proyeccion historica
    end
```

---

## Secuencia 9: Descarga de Excel de Proyeccion Historica

El usuario descarga el Excel de una proyeccion ya guardada en BD.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI (ExportButton)
    participant API as GET /api/export/[gestion]
    participant DB as PostgreSQL (tabla proyecciones)
    participant Lib as Exportador (generarExcel)
    participant Browser as Navegador

    Usuario->>UI: Click "Exportar Excel" (proyeccion historica)
    UI->>API: GET /api/export/2%2F2024
    API->>API: decodeURIComponent -> "2/2024"
    API->>DB: SELECT * FROM proyecciones WHERE gestion_proyectada = '2/2024'

    alt No hay datos
        DB-->>API: []
        API-->>UI: 404 { error: "No se encontraron proyecciones" }
        UI-->>Usuario: Muestra error
    else Datos encontrados
        DB-->>API: proyecciones[]
        API->>API: Mapea filas DB -> FilaProyeccion[]
        API->>Lib: generarExcel(filas, "2/2024")
        Lib-->>API: { buffer, filename: "proyeccion_2_2024.xlsx" }
        API-->>Browser: 200 Response(buffer) con headers:
        Note over API: Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        Note over API: Content-Disposition: attachment; filename="proyeccion_2_2024.xlsx"
        Browser-->>Usuario: Descarga automatica del archivo
    end
```

---

## Secuencia 10: Flujo Completo de Extremo a Extremo

Vision general del flujo principal de uso del sistema.

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as UI
    participant API as API Routes
    participant Lib as Lib (Importador/Procesador/Exportador)
    participant DB as PostgreSQL

    Note over Usuario,DB: PASO 1 - Carga de archivos
    Usuario->>UI: Sube archivo historico
    UI->>API: POST /api/upload/historico
    API->>Lib: parseHistorico(buffer)
    Lib-->>API: ImportResult<HistoricoRow>
    API-->>UI: 200 OK
    UI-->>Usuario: Resumen de importacion

    Usuario->>UI: Sube archivo de malla
    UI->>API: POST /api/upload/malla
    API->>Lib: parseMalla(buffer)
    Lib-->>API: ImportResult<MallaRow>
    API->>DB: UPSERT mallas
    API-->>UI: 200 OK
    UI-->>Usuario: Resumen de importacion

    Note over Usuario,DB: PASO 2 - Configuracion
    Usuario->>UI: Ingresa gestion actual + atipicas + metodo
    UI->>Lib: validarFormatoGestion / calcularGestionSiguiente
    Lib-->>UI: Validacion OK, gestion siguiente calculada
    UI-->>Usuario: Muestra gestion siguiente

    Note over Usuario,DB: PASO 3 - Calculo
    Usuario->>UI: Click "Calcular Proyeccion"
    UI->>API: POST /api/proyeccion/calcular
    API->>Lib: calcularTasas(historico, config)
    Lib-->>API: TasaMateria[]
    API->>Lib: calcularProyecciones(historico, malla, tasas, config)
    Lib-->>API: FilaProyeccion[]
    API-->>UI: 200 FilaProyeccion[]
    UI-->>Usuario: Tabla de resultados

    Note over Usuario,DB: PASO 4 - Revision y edicion
    Usuario->>UI: Edita valores de proyeccion manualmente
    UI->>UI: UPDATE_PROYECCION (store local)
    UI-->>Usuario: Celdas editadas resaltadas en azul

    Note over Usuario,DB: PASO 5 - Exportacion y guardado
    Usuario->>UI: Click "Exportar Excel"
    UI->>Lib: generarExcel(resultados, gestionSiguiente)
    Lib-->>UI: buffer .xlsx
    UI-->>Usuario: Descarga automatica proyeccion_2_2024.xlsx

    Usuario->>UI: Click "Guardar Proyeccion"
    UI->>API: POST /api/proyeccion/guardar
    API->>DB: UPSERT proyecciones
    DB-->>API: OK
    API-->>UI: 200 { ok: true }
    UI-->>Usuario: "Guardado ✓"
```

---

## Resumen de Actores y Responsabilidades

| Actor | Responsabilidad |
|-------|----------------|
| **Usuario** | Sube archivos, configura parametros, revisa/edita resultados, exporta |
| **UI** | Gestiona estado local (AppStore), valida inputs, llama a APIs, renderiza componentes |
| **API Routes** | Valida precondiciones, orquesta llamadas a Lib y DB, retorna errores estructurados |
| **Importador** | Parsea buffers Excel, valida columnas, omite filas invalidas, retorna ImportResult |
| **Procesador** | Calcula tasas estadisticas (promedio/regresion) y proyecciones de inscritos |
| **Exportador** | Genera archivo .xlsx con una hoja por carrera |
| **Validators** | Valida formato de gestion, calcula gestion siguiente, parsea gestiones atipicas |
| **DB** | Persiste mallas curriculares y proyecciones; soporta upsert por clave natural |
