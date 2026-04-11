# Guia de Despliegue: Vercel + Neon Tech

Esta guia cubre el proceso completo para llevar el Estimador de Crecimiento Estudiantil
a produccion usando Vercel (hosting) y Neon Tech (PostgreSQL serverless).

---

## Requisitos Previos

- Node.js >= 18
- Cuenta en [vercel.com](https://vercel.com)
- Cuenta en [neon.tech](https://neon.tech)
- Git instalado y repositorio inicializado
- Vercel CLI (opcional, para despliegue desde terminal)

---

## Paso 1: Configurar la Base de Datos en Neon Tech

### 1.1 Crear el proyecto en Neon

1. Inicia sesion en [console.neon.tech](https://console.neon.tech)
2. Click en **New Project**
3. Completa los campos:
   - **Project name**: `student-growth-estimator`
   - **Database name**: `neondb` (default)
   - **Region**: elige la mas cercana a tu region de Vercel (ej: `us-east-1`)
4. Click en **Create Project**

### 1.2 Obtener la cadena de conexion

1. En el dashboard del proyecto, ve a **Connection Details**
2. Selecciona el rol `neondb_owner` y la base de datos `neondb`
3. Copia la **Connection string** en formato:
   ```
   postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require
   ```
4. Guarda este valor — lo necesitaras en los pasos siguientes

### 1.3 Crear las tablas en Neon

Tienes tres opciones equivalentes. Elige la que te resulte mas comoda:

---

#### Opcion A: SQL Editor de Neon (sin instalar nada — recomendada)

1. En el dashboard de Neon, click en **SQL Editor** en el menu lateral
2. Asegurate de que la base de datos seleccionada es `neondb`
3. Copia y pega el contenido del archivo `scripts/init-db.sql` del proyecto
4. Click en **Run** (o `Ctrl+Enter`)
5. Deberia mostrar una tabla de verificacion con `mallas` y `proyecciones` y el numero de columnas de cada una

---

#### Opcion B: drizzle-kit push (desde tu maquina local)

Requiere tener Node.js y el proyecto clonado localmente.

**En Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

**En Mac/Linux:**
```bash
export DATABASE_URL="postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require"
npx drizzle-kit push
```

---

#### Opcion C: psql (si tienes el cliente PostgreSQL instalado)

```bash
psql "postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require" \
  -f scripts/init-db.sql
```

---

#### Verificar que las tablas se crearon

En el dashboard de Neon, ve a **Tables** en el menu lateral. Deberia mostrar:

| Tabla | Columnas |
|-------|----------|
| `mallas` | 8 |
| `proyecciones` | 20 |

Si no aparecen, revisa la seccion **Resolucion de Problemas** al final de esta guia.

---

## Paso 2: Preparar el Repositorio

### 2.1 Inicializar Git (si no esta inicializado)

```bash
git init
git add .
git commit -m "feat: initial commit - student growth estimator"
```

### 2.2 Subir a GitHub / GitLab / Bitbucket

```bash
# Ejemplo con GitHub
git remote add origin https://github.com/<tu-usuario>/student-growth-estimator.git
git branch -M main
git push -u origin main
```

### 2.3 Verificar .gitignore

Asegurate de que `.env.local` esta en `.gitignore` para no exponer credenciales:

```
# .gitignore (debe incluir)
.env.local
.env*.local
```

---

## Paso 3: Desplegar en Vercel

### Opcion A: Despliegue desde el Dashboard de Vercel (recomendado)

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Click en **Import Git Repository**
3. Conecta tu cuenta de GitHub/GitLab/Bitbucket si no lo has hecho
4. Selecciona el repositorio `student-growth-estimator`
5. Vercel detectara automaticamente que es un proyecto Next.js
6. En la seccion **Environment Variables**, agrega:

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://neondb_owner:<password>@<host>.neon.tech/neondb?sslmode=require` |

7. Click en **Deploy**

### Opcion B: Despliegue desde la CLI de Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Iniciar sesion
vercel login

# Desplegar (primera vez)
vercel

# Agregar variable de entorno
vercel env add DATABASE_URL production
# Pega la cadena de conexion cuando se solicite

# Redesplegar con la variable configurada
vercel --prod
```

### 3.1 Verificar el despliegue

Una vez completado, Vercel asignara una URL del tipo:
```
https://student-growth-estimator-<hash>.vercel.app
```

Abre la URL y verifica que la aplicacion carga correctamente.

---

## Paso 4: Configurar Variables de Entorno en Vercel

### 4.1 Desde el Dashboard

1. Ve a tu proyecto en [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click en **Settings** > **Environment Variables**
3. Agrega la variable:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `DATABASE_URL` | `postgresql://...` | Production, Preview, Development |

4. Click en **Save**
5. Redespliega el proyecto para que tome efecto: **Deployments** > **Redeploy**

### 4.2 Variables requeridas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Cadena de conexion a Neon PostgreSQL | `postgresql://user:pass@host.neon.tech/db?sslmode=require` |

---

## Paso 5: Configurar Dominio Personalizado (Opcional)

1. En el dashboard de Vercel, ve a **Settings** > **Domains**
2. Click en **Add Domain**
3. Ingresa tu dominio (ej: `estimador.tuuniversidad.edu`)
4. Sigue las instrucciones para configurar los registros DNS en tu proveedor de dominio:
   - Tipo `A`: apunta a `76.76.21.21`
   - O tipo `CNAME`: apunta a `cname.vercel-dns.com`
5. Vercel emitira automaticamente un certificado SSL via Let's Encrypt

---

## Paso 6: Configurar Neon para Produccion

### 6.1 Connection Pooling (recomendado para serverless)

Neon ofrece un pooler de conexiones optimizado para funciones serverless. Para usarlo:

1. En el dashboard de Neon, ve a **Connection Details**
2. Activa el toggle **Connection pooling**
3. Copia la nueva cadena de conexion (incluye `-pooler` en el hostname):
   ```
   postgresql://neondb_owner:<password>@<host>-pooler.neon.tech/neondb?sslmode=require
   ```
4. Actualiza `DATABASE_URL` en Vercel con esta nueva cadena

### 6.2 Configurar ramas de base de datos (opcional)

Neon soporta ramas de BD similares a ramas de Git, util para preview deployments:

1. En Neon, ve a **Branches** > **New Branch**
2. Crea una rama `preview` desde `main`
3. En Vercel, configura `DATABASE_URL` para el entorno **Preview** con la cadena de la rama `preview`

---

## Paso 7: Despliegues Continuos

Una vez configurado, cada `git push` a `main` disparara automaticamente un nuevo despliegue en Vercel.

```bash
# Flujo de trabajo tipico
git add .
git commit -m "fix: correccion en calculo de tasas"
git push origin main
# Vercel despliega automaticamente en ~30 segundos
```

Para ramas de feature, Vercel crea **Preview Deployments** automaticamente con URLs unicas.

---

## Paso 8: Monitoreo y Logs

### Logs en tiempo real

```bash
# Ver logs de produccion con la CLI
vercel logs https://tu-proyecto.vercel.app --follow
```

### Dashboard de Vercel

- **Analytics**: metricas de uso y rendimiento
- **Functions**: logs de cada API Route serverless
- **Speed Insights**: Core Web Vitals

### Dashboard de Neon

- **Monitoring**: queries por segundo, latencia, conexiones activas
- **Query History**: historial de queries ejecutadas
- **Branches**: estado de cada rama de BD

---

## Resolucion de Problemas Comunes

### Error: `DATABASE_URL is not defined`

- Verifica que la variable esta configurada en Vercel para el entorno correcto (Production/Preview)
- Redespliega el proyecto despues de agregar la variable

### Error: `SSL connection required`

- Asegurate de que la cadena de conexion incluye `?sslmode=require`
- Neon requiere SSL en todas las conexiones

### Error: `Too many connections`

- Activa el **Connection Pooling** en Neon (ver Paso 6.1)
- Las funciones serverless de Vercel pueden abrir muchas conexiones simultaneas

### Error: `relation "mallas" does not exist`

- Las migraciones no se ejecutaron. Corre `npx drizzle-kit push` con `DATABASE_URL` apuntando a la BD de produccion

### Build falla en Vercel

- Verifica que `next build` pasa localmente: `npm run build`
- Revisa que no hay imports de modulos Node.js en componentes del cliente (ej: `xlsx` solo debe usarse en el servidor o en funciones de utilidad)

---

## Checklist de Despliegue

- [ ] Proyecto creado en Neon Tech
- [ ] Cadena de conexion obtenida y guardada de forma segura
- [ ] Migraciones ejecutadas (`npx drizzle-kit push`)
- [ ] Repositorio subido a GitHub/GitLab/Bitbucket
- [ ] `.env.local` en `.gitignore`
- [ ] Proyecto importado en Vercel
- [ ] Variable `DATABASE_URL` configurada en Vercel
- [ ] Primer despliegue exitoso
- [ ] URL de produccion verificada manualmente
- [ ] Connection Pooling activado en Neon (recomendado)
- [ ] Dominio personalizado configurado (opcional)
