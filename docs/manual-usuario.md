# Manual de Usuario
# Estimador de Crecimiento Estudiantil

---

## ¿Qué hace este sistema?

El Estimador de Crecimiento Estudiantil te permite **proyectar cuántos estudiantes se inscribirán en cada materia** durante el próximo semestre. Para hacerlo, el sistema analiza el historial académico de gestiones anteriores y la estructura curricular de cada carrera.

El resultado es una tabla descargable en Excel lista para planificar apertura de grupos y asignación de docentes.

---

## Paso 1 — Preparar los archivos Excel

Necesitas **dos archivos** antes de usar el sistema.

---

### Archivo 1: Histórico de Rendimiento

Este archivo contiene los registros académicos por materia, carrera y semestre.

**Formato:** `.xlsx` o `.xls`

**Columnas requeridas (exactamente con estos nombres):**

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `Código Plan Estudio` | Código interno del programa académico | `ING-SIS-001` |
| `Plan Estudio` | Nombre completo del programa | `Ingeniería de Sistemas` |
| `Código Gestión` | Código interno del semestre | `G-2024-1` |
| `Gestión` | Semestre en formato **N/AAAA** | `1/2024` |
| `Turno` | Turno de la materia | `Mañana` |
| `Grupo` | Identificador del grupo | `A` |
| `Código Materia` | Código interno de la materia | `MAT-101` |
| `Materia` | Nombre completo de la materia | `Matemáticas I` |
| `Sigla` | Sigla corta de la materia | `MAT101` |
| `Abandono` | Número de estudiantes que abandonaron | `5` |
| `Reprobados` | Número de estudiantes que reprobaron | `12` |
| `Aprobados` | Número de estudiantes que aprobaron | `28` |
| `Total Alumnos` | Total de inscritos en ese grupo | `45` |

> **Importante:** Los nombres de columna deben ser exactos, incluyendo tildes y mayúsculas.
> El sistema omite automáticamente las filas donde `Sigla`, `Gestión` o `Código Plan Estudio` estén vacíos.

**Ejemplo de filas válidas:**

```
Código Plan Estudio | Plan Estudio              | Gestión | Sigla  | Abandono | Reprobados | Aprobados | Total Alumnos
ING-SIS-001         | Ingeniería de Sistemas    | 1/2023  | MAT101 | 3        | 8          | 24        | 35
ING-SIS-001         | Ingeniería de Sistemas    | 2/2023  | MAT101 | 2        | 6          | 27        | 35
ING-SIS-001         | Ingeniería de Sistemas    | 1/2024  | MAT101 | 4        | 10         | 21        | 35
```

---

### Archivo 2: Malla Curricular

Este archivo describe la estructura de materias de cada carrera: en qué semestre se cursa cada materia y cuál es su prerrequisito.

**Formato:** `.xlsx` o `.xls`

**Columnas requeridas:**

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `Carrera` | Nombre del programa académico | `Ingeniería de Sistemas` |
| `Semestre` | Número de semestre en que se cursa | `2` |
| `Sigla` | Sigla de la materia | `MAT201` |
| `Nombre Asignatura` | Nombre completo de la materia | `Matemáticas II` |
| `Requisito` | Sigla del prerrequisito (vacío si no tiene) | `MAT101` |

**Reglas para la columna Requisito:**

| Caso | Qué escribir | Resultado |
|------|-------------|-----------|
| Materia de primer semestre (sin prerrequisito) | Dejar vacío o en blanco | El sistema usa el promedio histórico de inscritos |
| Un prerrequisito | Sigla del prerrequisito | `MAT101` |
| Varios prerrequisitos | Siglas separadas por coma | `MAT101, FIS101` |
| Prerrequisito complejo (ej: "todas hasta X aprobadas") | Escribir la descripción | El sistema la marca como **ingreso manual** |

> **Nota:** La malla se guarda en la base de datos. Solo necesitas subirla una vez; en sesiones futuras ya estará disponible.

---

## Paso 2 — Subir los archivos

1. Abre la aplicación en el navegador
2. En la sección **Carga de Archivos**:
   - Click en **Elegir archivo** junto a "Archivo Histórico" → selecciona tu archivo
   - Click en **Elegir archivo** junto a "Archivo de Malla Curricular" → selecciona tu archivo
3. El sistema procesa cada archivo y muestra un resumen:
   - ✓ Cuántos registros se cargaron
   - ✓ Cuántas carreras se detectaron
   - ✓ Rango de gestiones encontradas
4. Si hay un error (columna faltante, formato incorrecto), aparece un mensaje en rojo indicando exactamente qué falta. Puedes corregir el archivo y volver a subirlo **sin recargar la página**.
5. Cuando ambos archivos estén cargados correctamente, aparece el botón **Continuar a Configuración →**

---

## Paso 3 — Configurar el cálculo

En la sección **Configuración del Cálculo** debes completar tres campos:

### Gestión Actual

Ingresa el semestre para el cual tienes datos y quieres proyectar el siguiente.

**Formato obligatorio:** `N/AAAA` donde N es 1 o 2.

| Ejemplo | Significado |
|---------|-------------|
| `1/2024` | Primer semestre del año 2024 |
| `2/2024` | Segundo semestre del año 2024 |

El sistema calcula automáticamente la **Gestión Siguiente**:
- Si ingresas `1/2024` → proyecta para `2/2024`
- Si ingresas `2/2024` → proyecta para `1/2025`

### Gestiones Atípicas (opcional)

Si algún semestre tuvo datos no representativos (pandemia, huelga, etc.), puedes excluirlo del cálculo estadístico.

Escribe las gestiones separadas por coma:
```
1/2020, 2/2020
```

Deja este campo vacío si no hay gestiones a excluir.

### Método de Proyección

| Método | Cuándo usarlo |
|--------|--------------|
| **Promedio Simple** | Cuando los datos son estables. Usa las últimas 4 gestiones disponibles. |
| **Regresión Lineal** | Cuando hay una tendencia clara de crecimiento o decrecimiento. Usa todas las gestiones disponibles. |

Una vez completados los campos, click en **Calcular Proyección**.

---

## Paso 4 — Revisar los resultados

El sistema muestra una tabla con la proyección de inscritos para cada materia.

### Columnas de la tabla

| Columna | Descripción |
|---------|-------------|
| Carrera | Programa académico |
| Nombre Asignatura | Nombre de la materia |
| Código | Sigla de la materia |
| Requisito | Sigla del prerrequisito |
| Grupo | Grupo o turno |
| Total Inscritos en el Requisito | Inscritos en el prerrequisito en la gestión actual |
| Proyección Reprobados Requisito | Estimación de reprobados del prerrequisito |
| Proyección Abandonos Requisito | Estimación de abandonos del prerrequisito |
| Proyección Alumnos que Promueven | Estimación de alumnos que aprueban el prerrequisito |
| Inscritos Ant. | Inscritos en esta materia en la gestión anterior |
| Reprobados Ant. | Reprobados en esta materia en la gestión anterior |
| Abandonos Ant. | Abandonos en esta materia en la gestión anterior |
| Repitentes Ant. | Total de repitentes (reprobados + abandonos) |
| **Proyección de Inscritos** | **Estimación final de inscritos para el próximo semestre** |
| Estado | Indicador si la materia requiere atención especial |

### Filtrar por carrera

Usa el selector **"Todas las carreras"** para ver solo las materias de un programa específico.

### Editar valores manualmente

Si necesitas ajustar la proyección de una materia:
1. Haz click en el número en la columna **Proyección de Inscritos**
2. Escribe el nuevo valor
3. La celda se resalta en **azul** para indicar que fue editada manualmente

### Indicadores de estado

| Indicador | Significado | Qué hacer |
|-----------|-------------|-----------|
| **Manual** (fondo amarillo) | El prerrequisito es complejo y no se puede calcular automáticamente | Ingresa el valor manualmente en la columna Proyección de Inscritos |
| **Sin datos** (fondo amarillo) | La materia tiene menos de 2 semestres de historial disponible | Ingresa el valor manualmente o deja en blanco |

---

## Paso 5 — Exportar y guardar

### Exportar a Excel

Click en **↓ Exportar Excel** para descargar el archivo.

El archivo se llama automáticamente `proyeccion_N_AAAA.xlsx` (ej: `proyeccion_2_2024.xlsx`) y contiene **una hoja por carrera** con todos los datos de la tabla, incluyendo los valores que editaste manualmente.

### Guardar en el sistema

Click en **Guardar Proyección** para almacenar los resultados en la base de datos.

Esto te permite consultar esta proyección en el futuro sin necesidad de recalcularla.

> Si la conexión falla al guardar, aparece un botón **Reintentar**. Los resultados en pantalla no se pierden.

---

## Preguntas frecuentes

**¿Qué pasa si mi archivo tiene columnas en otro orden?**
No importa el orden de las columnas, solo que estén todas presentes con los nombres exactos.

**¿Puedo subir el archivo histórico con datos de varias carreras a la vez?**
Sí. El sistema detecta automáticamente todas las carreras presentes en el archivo y calcula las tasas de forma independiente para cada una.

**¿Cuántas gestiones necesito en el histórico?**
Mínimo 2 gestiones por materia para que el sistema pueda calcular tasas. Con menos de 2, la materia aparece como "Sin datos" y debes ingresar el valor manualmente.

**¿Qué pasa si una materia no tiene prerrequisito?**
El sistema usa el promedio de inscritos de las últimas 4 gestiones disponibles como base de proyección.

**¿Puedo volver a consultar una proyección anterior?**
Sí, siempre que hayas usado el botón **Guardar Proyección** antes de cerrar la sesión.

**¿Tengo que subir la malla cada vez?**
No. La malla se guarda en la base de datos la primera vez. En sesiones futuras ya estará disponible.

**El sistema me dice "Columnas faltantes: Gestión". ¿Qué hago?**
Verifica que la columna en tu archivo se llame exactamente `Gestión` (con tilde). Los nombres de columna son sensibles a tildes y mayúsculas.

---

## Resumen rápido

```
1. Prepara dos archivos Excel:
   - Histórico: columnas Código Plan Estudio, Plan Estudio, Código Gestión,
     Gestión, Turno, Grupo, Código Materia, Materia, Sigla,
     Abandono, Reprobados, Aprobados, Total Alumnos
   - Malla: columnas Carrera, Semestre, Sigla, Nombre Asignatura, Requisito

2. Sube ambos archivos en la sección "Carga de Archivos"

3. Ingresa la gestión actual (ej: 1/2024), gestiones atípicas (opcional)
   y elige el método de proyección

4. Revisa la tabla, edita valores si es necesario

5. Exporta a Excel y/o guarda en el sistema
```
