# Documento de Requerimientos

## Introducción

El **Estimador de Crecimiento Estudiantil** es una aplicación web que permite proyectar la cantidad de estudiantes que se inscribirán en cada materia por carrera durante la siguiente gestión académica (semestre). El sistema procesa archivos Excel con históricos de rendimiento académico y mallas curriculares, aplica métodos estadísticos para estimar tasas de reprobación y abandono, y genera un reporte de proyección exportable en Excel. La aplicación se despliega en Vercel con base de datos PostgreSQL serverless en Neon Tech.

---

## Glosario

- **Gestión**: Semestre académico, identificado con el formato `N/AAAA` (ej: `1/2026` = primer semestre del año 2026).
- **Gestión Actual**: La gestión para la cual se tienen datos de inscritos y se desea proyectar la siguiente.
- **Gestión Siguiente**: El semestre inmediatamente posterior a la gestión actual.
- **Carrera**: Programa académico identificado por un código y nombre de plan de estudio.
- **Materia**: Asignatura académica identificada por una sigla y nombre, perteneciente a una carrera.
- **Malla Curricular**: Estructura de materias de una carrera, incluyendo semestre, prerrequisitos y secuencia.
- **Prerrequisito**: Materia que debe haberse aprobado para poder inscribirse en otra materia.
- **Tasa de Reprobación**: Porcentaje histórico de estudiantes que reprueban una materia en una carrera.
- **Tasa de Abandono**: Porcentaje histórico de estudiantes que abandonan una materia en una carrera.
- **Repitentes**: Estudiantes que reprobaron o abandonaron una materia en la gestión anterior y se vuelven a inscribir.
- **Gestión Atípica**: Gestión excluida del cálculo estadístico por datos no representativos (ej: pandemia).
- **Archivo Histórico**: Archivo Excel con registros de aprobados, reprobados y abandonos por materia, carrera y gestión.
- **Archivo de Malla**: Archivo Excel con la estructura curricular de las carreras.
- **Proyección**: Estimación del número de estudiantes que se inscribirán en una materia en la gestión siguiente.
- **Sistema**: La aplicación web Estimador de Crecimiento Estudiantil.
- **Procesador**: Módulo del sistema encargado de calcular proyecciones.
- **Importador**: Módulo del sistema encargado de leer y validar archivos Excel.
- **Exportador**: Módulo del sistema encargado de generar el archivo Excel de resultados.
- **Repositorio**: Base de datos PostgreSQL en Neon Tech donde se persisten mallas y resultados.

---

## Requerimientos

### Requerimiento 1: Carga del Archivo Histórico

**User Story:** Como usuario académico, quiero subir el archivo Excel con el histórico de rendimiento, para que el sistema pueda calcular las tasas estadísticas de cada materia por carrera.

#### Criterios de Aceptación

1. THE Importador SHALL aceptar archivos en formato `.xlsx` y `.xls` para el histórico de rendimiento académico.
2. WHEN el usuario sube el archivo histórico, THE Importador SHALL leer las columnas: Código Plan Estudio, Plan Estudio, Código Gestión, Gestión, Turno, Grupo, Código Materia, Materia, Sigla, Abandono, Reprobados, Aprobados y Total Alumnos.
3. IF el archivo histórico no contiene alguna de las columnas requeridas, THEN THE Importador SHALL mostrar un mensaje de error indicando las columnas faltantes y rechazar el archivo.
4. IF el archivo histórico contiene filas con valores nulos en Sigla, Gestión o Código Plan Estudio, THEN THE Importador SHALL omitir esas filas y registrar la cantidad de filas omitidas en un resumen de validación.
5. WHEN el archivo histórico es procesado exitosamente, THE Importador SHALL mostrar un resumen con la cantidad de registros cargados, carreras detectadas y rango de gestiones encontradas.

---

### Requerimiento 2: Carga del Archivo de Malla Curricular

**User Story:** Como usuario académico, quiero subir el archivo Excel con las mallas curriculares, para que el sistema conozca la secuencia de materias y sus prerrequisitos.

#### Criterios de Aceptación

1. THE Importador SHALL aceptar archivos en formato `.xlsx` y `.xls` para la malla curricular.
2. WHEN el usuario sube el archivo de malla, THE Importador SHALL leer las columnas: Carrera, Semestre, Sigla, Nombre Asignatura y Requisito (sigla del prerrequisito).
3. THE Importador SHALL soportar que una materia tenga cero, uno o múltiples prerrequisitos.
4. WHEN el archivo de malla es procesado exitosamente, THE Repositorio SHALL persistir las mallas curriculares para su reutilización en gestiones futuras.
5. IF el archivo de malla contiene una materia con la indicación de prerrequisitos múltiples no estructurados (ej: "todas hasta X aprobadas"), THEN THE Importador SHALL marcar esa materia como "requiere ingreso manual" y excluirla del cálculo automático.
6. IF el archivo de malla no contiene alguna de las columnas requeridas, THEN THE Importador SHALL mostrar un mensaje de error indicando las columnas faltantes y rechazar el archivo.

---

### Requerimiento 3: Selección de Gestión Actual y Configuración del Cálculo

**User Story:** Como usuario académico, quiero indicar la gestión actual y configurar parámetros del cálculo, para que el sistema proyecte correctamente la gestión siguiente.

#### Criterios de Aceptación

1. THE Sistema SHALL permitir al usuario ingresar la gestión actual en formato `N/AAAA` (ej: `1/2026`).
2. WHEN el usuario ingresa la gestión actual `N/AAAA`, THE Sistema SHALL determinar que la gestión siguiente es `(N+1)/AAAA` si N=1, o `1/(AAAA+1)` si N=2.
3. WHEN el usuario ingresa la gestión actual, THE Sistema SHALL validar que el archivo histórico contiene registros de la gestión inmediatamente anterior a la gestión actual.
4. IF el archivo histórico no contiene registros de la gestión inmediatamente anterior a la gestión actual, THEN THE Sistema SHALL mostrar una advertencia indicando la gestión faltante y solicitar confirmación para continuar.
5. THE Sistema SHALL permitir al usuario ingresar un listado de gestiones atípicas a excluir del cálculo estadístico, separadas por comas (ej: `1/2020, 2/2020`).
6. THE Sistema SHALL permitir al usuario elegir entre dos métodos de proyección: promedio simple de las últimas 4 gestiones disponibles, o regresión lineal sobre las últimas gestiones disponibles.
7. WHERE el método de regresión lineal es seleccionado, THE Procesador SHALL utilizar todas las gestiones disponibles no atípicas para calcular la tendencia.

---

### Requerimiento 4: Cálculo de Tasas Estadísticas por Materia y Carrera

**User Story:** Como usuario académico, quiero que el sistema calcule automáticamente las tasas de reprobación y abandono, para que las proyecciones reflejen el comportamiento histórico real de cada materia.

#### Criterios de Aceptación

1. THE Procesador SHALL calcular la tasa de reprobación y la tasa de abandono de forma independiente para cada combinación de Sigla y Carrera.
2. WHEN el método seleccionado es promedio simple, THE Procesador SHALL calcular las tasas usando las últimas 4 gestiones disponibles con datos para esa materia y carrera, excluyendo las gestiones atípicas configuradas.
3. WHEN el método seleccionado es regresión lineal, THE Procesador SHALL calcular las tasas proyectadas usando todas las gestiones disponibles no atípicas para esa materia y carrera.
4. IF una materia y carrera tiene menos de 2 gestiones disponibles después de excluir las atípicas, THEN THE Procesador SHALL marcar esa materia como "datos insuficientes" y excluirla del cálculo automático.
5. THE Procesador SHALL calcular las tasas por materia y carrera de forma independiente, aun cuando la misma materia exista en múltiples carreras con diferente sigla o semestre.

---

### Requerimiento 5: Proyección de Inscritos para la Gestión Siguiente

**User Story:** Como usuario académico, quiero que el sistema proyecte la cantidad de estudiantes que se inscribirán en cada materia, para poder planificar la apertura de grupos y asignación de docentes.

#### Criterios de Aceptación

1. WHEN una materia tiene prerrequisito definido, THE Procesador SHALL calcular la proyección de inscritos como: (inscritos en el prerrequisito en la gestión actual × tasa de promoción del prerrequisito) + (reprobados en la materia en la gestión anterior) + (abandonos en la materia en la gestión anterior).
2. WHEN una materia no tiene prerrequisito (primer semestre), THE Procesador SHALL usar como base el promedio de inscritos de esa materia en las últimas 4 gestiones disponibles no atípicas.
3. THE Procesador SHALL calcular la tasa de promoción del prerrequisito como: 1 - tasa de reprobación - tasa de abandono.
4. IF una materia está marcada como "requiere ingreso manual", THEN THE Procesador SHALL incluirla en el resultado con los campos de proyección vacíos para que el usuario los complete manualmente.
5. IF una materia está marcada como "datos insuficientes", THEN THE Procesador SHALL incluirla en el resultado con los campos de proyección vacíos e indicar el motivo.
6. THE Procesador SHALL generar la proyección de forma independiente para cada carrera, incluso cuando la misma materia exista en múltiples carreras.

---

### Requerimiento 6: Visualización de Resultados por Carrera

**User Story:** Como usuario académico, quiero ver los resultados de proyección en pantalla organizados por carrera, para revisar y ajustar los valores antes de exportar.

#### Criterios de Aceptación

1. WHEN el cálculo de proyección finaliza, THE Sistema SHALL mostrar los resultados en una tabla con las columnas: Carrera, Nombre Asignatura, Código, Requisito, Código Requisito, Grupo, Total Inscritos en el Requisito, Proyección Reprobados Requisito, Proyección Abandonos en el Requisito, Proyección Alumnos que Promueven, Alumnos Inscritos en la Asignatura en Gestión Anterior, Reprobados en la Asignatura en la Gestión Anterior, Abandonos en la Asignatura en la Gestión Anterior, Total Repitentes en la Asignatura de la Gestión Anterior, Proyección de Inscritos.
2. THE Sistema SHALL permitir filtrar la tabla de resultados por carrera.
3. THE Sistema SHALL permitir al usuario editar manualmente los valores de Proyección de Inscritos en la tabla antes de exportar.
4. WHEN el usuario modifica un valor de proyección manualmente, THE Sistema SHALL resaltar visualmente la celda modificada para distinguirla de los valores calculados automáticamente.
5. THE Sistema SHALL mostrar en la tabla las materias marcadas como "requiere ingreso manual" o "datos insuficientes" con una indicación visual del motivo.

---

### Requerimiento 7: Exportación del Resultado a Excel

**User Story:** Como usuario académico, quiero exportar los resultados de proyección a un archivo Excel, para compartirlos y utilizarlos en otros procesos administrativos.

#### Criterios de Aceptación

1. THE Exportador SHALL generar un archivo `.xlsx` con las columnas definidas en el Requerimiento 6, criterio 1.
2. WHEN el usuario solicita la exportación, THE Exportador SHALL incluir en el archivo tanto los valores calculados automáticamente como los valores modificados manualmente por el usuario.
3. THE Exportador SHALL organizar el archivo Excel con una hoja por carrera.
4. WHEN el archivo es generado, THE Sistema SHALL iniciar la descarga automática del archivo en el navegador del usuario.
5. THE Exportador SHALL nombrar el archivo con el formato `proyeccion_{gestión_siguiente}.xlsx` (ej: `proyeccion_2_2026.xlsx`).

---

### Requerimiento 8: Persistencia y Consulta de Resultados Históricos

**User Story:** Como usuario académico, quiero que los resultados de proyección queden guardados, para poder consultarlos en el futuro y compararlos con los datos reales.

#### Criterios de Aceptación

1. WHEN el usuario confirma y exporta una proyección, THE Repositorio SHALL persistir los resultados de proyección asociados a la gestión proyectada y a cada carrera.
2. THE Sistema SHALL permitir al usuario consultar proyecciones generadas anteriormente seleccionando una gestión pasada.
3. WHEN el usuario selecciona una gestión pasada, THE Sistema SHALL recuperar del Repositorio los resultados de esa gestión y mostrarlos en la tabla de resultados.
4. WHEN el usuario consulta una proyección pasada, THE Sistema SHALL permitir exportarla nuevamente a Excel.
5. THE Repositorio SHALL persistir las mallas curriculares cargadas para que estén disponibles en sesiones futuras sin necesidad de volver a subir el archivo de malla.

---

### Requerimiento 9: Manejo de Errores y Validaciones Generales

**User Story:** Como usuario académico, quiero que el sistema me informe claramente cuando algo falla o los datos son inconsistentes, para poder corregir los problemas sin perder trabajo.

#### Criterios de Aceptación

1. IF el usuario intenta iniciar el cálculo sin haber subido el archivo histórico o el archivo de malla, THEN THE Sistema SHALL mostrar un mensaje de error indicando cuál archivo falta.
2. IF el usuario intenta iniciar el cálculo sin haber ingresado la gestión actual, THEN THE Sistema SHALL mostrar un mensaje de error solicitando ese dato.
3. IF ocurre un error durante el procesamiento de un archivo Excel, THEN THE Sistema SHALL mostrar un mensaje descriptivo del error y permitir al usuario subir el archivo nuevamente sin recargar la página.
4. IF la conexión con el Repositorio falla durante la persistencia, THEN THE Sistema SHALL notificar al usuario y permitir reintentar la operación sin perder los resultados calculados en pantalla.
5. THE Sistema SHALL validar que el formato de la gestión ingresada sea `N/AAAA` donde N es 1 o 2 y AAAA es un año de 4 dígitos, y mostrar un error si el formato es incorrecto.
