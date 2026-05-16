# BimestManager

> Plataforma web para la gestión integral de laboratorios escolares — módulos de **Química** y **Turismo** — con control de inventario, préstamos, adeudos, incidencias y monitoreo en tiempo real.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](#licencia)

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso](#uso)
- [Endpoints clave](#endpoints-clave)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)
- [Monitoreo y logs](#monitoreo-y-logs)
- [Despliegue](#despliegue)
- [Documentación adicional](#documentación-adicional)
- [Equipo](#equipo)
- [Licencia](#licencia)

---

## Descripción

**BimestManager** es una aplicación web tipo SaaS desarrollada en Node.js que digitaliza por completo la gestión administrativa de los laboratorios escolares. Atiende dos áreas:

- **Química** — control de prácticas, kits de reactivos, equipos, responsivas firmadas digitalmente, adeudos e incidencias.
- **Turismo** — gestión de prácticas de campo, préstamos de material y sugerencias.

El sistema reemplaza las libretas físicas y hojas de cálculo dispersas por una plataforma centralizada, segura y accesible desde cualquier dispositivo. Reduce de **horas a segundos** el control diario de un laboratorio escolar.

---

## Características principales

- ✅ **Tres roles diferenciados:** Administrador, Maestro, Alumno — con permisos granulares por módulo (RBAC).
- ✅ **Doble módulo** Química + Turismo en una sola plataforma.
- ✅ **Autenticación JWT** con cookies httpOnly y refresh tokens.
- ✅ **Comunicación cifrada** HTTPS (TLS) con certificados autofirmados generados automáticamente.
- ✅ **Conexión MySQL con TLS obligatorio** (compatible con `require_secure_transport=ON`).
- ✅ **Logs persistentes** con rotación diaria (Winston + winston-daily-rotate-file).
- ✅ **Dashboard de monitoreo** en `/monitor` con CPU, RAM, disco, red y salud de la base de datos en tiempo real.
- ✅ **Healthcheck** público en `/salud` para sondas externas.
- ✅ **Arquitectura MVC** clara y mantenible (rutas → controladores → modelos).
- ✅ **Vistas EJS responsivas** que funcionan en escritorio, tablet y móvil.

---

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| **Runtime** | Node.js 20+ (CommonJS) |
| **Servidor web** | Express 5 |
| **Base de datos** | MySQL 8 con `mysql2/promise` |
| **Plantillas** | EJS + express-ejs-layouts |
| **Autenticación** | jsonwebtoken (JWT) + bcrypt + cookie-parser |
| **Seguridad HTTP** | helmet, cors, HTTPS con `selfsigned` |
| **Logging** | winston + winston-daily-rotate-file + morgan |
| **Monitoreo** | systeminformation |
| **Tooling dev** | nodemon, dotenv |

---

## Arquitectura

```
                        ┌───────────────────────────┐
                        │   DC  (Active Directory)  │
                        │   - DNS, Cuentas, GPO     │
                        └─────────────┬─────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
       ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
       │  WEB            │   │  DB             │   │  MON            │
       │  Node 20 + IIS  │   │  MySQL 8 + TLS  │   │  Métricas /     │
       │  HTTPS 4443     │   │  bimest_app     │   │  monitor        │
       └─────────────────┘   └─────────────────┘   └─────────────────┘
                │                     ▲
                └──── TLS 3306 ───────┘
```

**Patrón MVC estricto:**

```
rutas/<area>Ruta.js  →  controlador/<area>Controlador.js  →  modelo/<area>Modelo.js
```

Toda la lógica de acceso a base de datos vive en `modelo/`. Los controladores nunca hablan directo con MySQL.

---

## Requisitos previos

- **Node.js** 20.x o superior
- **MySQL** 8.x corriendo localmente o en un servidor accesible
- **npm** 10+
- (Opcional) **Git** para clonar el repositorio

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/413xkur4y4m1/BimestManager.git
cd BimestManager

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env (copiar desde el ejemplo)
cp .env.example .env
# o en Windows PowerShell:
# Copy-Item .env.example .env

# 4. Editar .env con tus credenciales reales
```

### Cargar la base de datos

Ejecuta los scripts SQL en este orden contra tu MySQL local:

```sql
SOURCE creacionTabs.sql;        -- crea el schema labs y todas las tablas
SOURCE labs_usuarios.sql;       -- seed de usuarios
SOURCE labs_grupos.sql;
SOURCE labs_materiales.sql;
SOURCE labs_practicas.sql;
-- ...y los demás labs_*.sql
SOURCE turismoDatos.sql;        -- seed del módulo Turismo
```

(Opcional — para producción) Crear usuario MySQL de permisos mínimos:

```sql
SOURCE sql/usuario_app.sql;
```

---

## Configuración

Variables de entorno principales (archivo `.env`):

| Variable | Valor típico | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto HTTP |
| `HTTPS_PORT` | `4443` | Puerto HTTPS |
| `HTTPS_ENABLED` | `true` | Habilita HTTPS con certificado autofirmado |
| `HTTPS_CN` | `localhost` | Common Name del certificado |
| `NODE_ENV` | `development` / `production` | Entorno |
| `LOG_LEVEL` | `info` | Nivel de winston (`error`, `warn`, `info`, `debug`) |
| `DB_HOST` | `localhost` | Host de MySQL |
| `DB_PORT` | `3306` | Puerto MySQL |
| `DB_USER` | `root` (dev) / `bimest_app` (prod) | Usuario MySQL |
| `DB_PASSWORD` | _(tu password)_ | Password MySQL |
| `DB_NAME` | `labs` | Schema de la base de datos |
| `DB_SSL` | `true` | TLS obligatorio si MySQL tiene `require_secure_transport=ON` |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` (dev) / `true` (prod) | Validación de cert MySQL |
| `JWT_SECRET` | _(string aleatorio largo)_ | Secret para firmar tokens de acceso |
| `JWT_REFRESH_SECRET` | _(string aleatorio largo)_ | Secret para refresh tokens |

> ⚠️ **Nunca subas el archivo `.env` al repositorio.** Ya está incluido en `.gitignore`.

---

## Uso

```bash
# Modo producción
npm start

# Modo desarrollo (auto-reload con nodemon)
npm run dev
```

En el primer arranque se generan automáticamente los certificados autofirmados en `certs/server.key` y `certs/server.crt`.

La aplicación estará disponible en:

- **HTTP:** http://localhost:4000
- **HTTPS:** https://localhost:4443 *(acepta la advertencia del navegador por cert autofirmado)*

---

## Endpoints clave

### Salud y monitoreo
- `GET /salud` — Healthcheck JSON: `{"ok": true}`
- `GET /monitor` — Dashboard web de monitoreo
- `GET /monitor/metricas` — Métricas en JSON (CPU, RAM, disco, red, DB)

### Autenticación
- `POST /auth/login` — Inicio de sesión
- `POST /auth/registro-alumno` — Registro de alumno (Química)
- `POST /auth/registro-alumno-turismo` — Registro de alumno (Turismo)
- `POST /auth/logout` — Cierre de sesión
- `GET /auth/yo` — Información del usuario autenticado

### Vistas (requieren rol)
- `GET /admin` — Panel administrador (Química)
- `GET /maestro` — Panel maestro (Química)
- `GET /estudiante` — Panel alumno (Química)
- `GET /turismo/admin` — Panel administrador (Turismo)
- `GET /turismo/estudiante` — Panel alumno (Turismo)

---

## Estructura del proyecto

```
BimestManager/
├── server.js                  ← Arranque HTTP + HTTPS
├── BDconex.js                 ← Pool MySQL con TLS opt-in
├── package.json
├── .env.example               ← Plantilla de variables
├── .gitignore
│
├── Middlewares/
│   ├── auth.js                ← JWT + RBAC (soloAdmin, soloMaestro, etc.)
│   ├── logger.js              ← Winston con rotación diaria
│   └── certificados.js        ← Genera cert autofirmado
│
├── controlador/               ← Lógica HTTP (un archivo por área)
├── modelo/                    ← Acceso a base de datos
├── rutas/                     ← Routers de Express
│
├── vista/                     ← Plantillas EJS
│   ├── auth/                  ← Login / Registro
│   ├── partials/              ← Header, nav, head, logo
│   ├── turismo/               ← Vistas del módulo Turismo
│   └── monitor.ejs            ← Dashboard de monitoreo
│
├── public/                    ← Assets estáticos (CSS, JS, img)
│
├── certs/                     ← Certificados HTTPS (autogenerados, ignorados por git)
├── logs/                      ← Logs rotados diariamente (ignorados por git)
│
├── sql/
│   ├── usuario_app.sql        ← Crea usuario MySQL con permisos mínimos
│   └── verificacion_evidencia.sql
│
├── docs/                      ← Documentación operativa
│   ├── DESPLIEGUE.md
│   ├── BITACORA_INCIDENTE.md
│   ├── OPERACION.md
│   └── CAMBIOS_PARCIAL2.md
│
├── creacionTabs.sql           ← Schema completo
└── labs_*.sql, turismoDatos.sql   ← Seeds
```

---

## Seguridad

BimestManager implementa **defensa en profundidad** con varias capas:

| Capa | Implementación |
|---|---|
| **Transporte** | HTTPS con TLS, certificados autofirmados o CA real en producción |
| **DB** | Conexión MySQL forzada con TLS (`require_secure_transport=ON`) |
| **Autenticación** | JWT firmados con HS256, expiración 2h, refresh tokens |
| **Cookies** | `httpOnly`, `sameSite=lax`, `secure: true` en producción |
| **Contraseñas** | Hash con bcrypt (cost factor 10+) |
| **Headers HTTP** | helmet con CSP, HSTS, X-Frame-Options |
| **RBAC** | Middlewares por rol: `soloAdmin`, `soloMaestro`, `soloAlumno`, `adminOMaestro`, etc. |
| **DB User** | Usuario `bimest_app` con permisos DML mínimos (SELECT/INSERT/UPDATE/DELETE) |
| **Logs de auditoría** | Todas las acciones quedan registradas con timestamp, usuario y IP |

---

## Monitoreo y logs

### Logs

Los logs se escriben en `logs/` con rotación diaria automática:

- `logs/app-YYYY-MM-DD.log` — Logs de aplicación (info/warn/error)
- `logs/error-YYYY-MM-DD.log` — Solo errores
- `logs/access-YYYY-MM-DD.log` — Logs de acceso HTTP (morgan)

### Monitoreo

El endpoint `/monitor` ofrece un dashboard web en vivo con:

- **CPU** — Uso global y por núcleo
- **Memoria** — RAM total, usada y disponible
- **Disco** — Espacio total, usado y libre
- **Red** — RX/TX por interfaz
- **Base de datos** — Latencia de ping y estado de conexiones

El endpoint `/monitor/metricas` devuelve el mismo dato en JSON, listo para ser scrapeado por Prometheus, Grafana o cualquier sistema externo de observabilidad.

---

## Despliegue

El proyecto está diseñado para una topología de **4 servidores**:

| Servidor | IP típica | Servicios |
|---|---|---|
| **DC** | 192.168.10.10 | Active Directory, DNS, GPO |
| **WEB** | 192.168.10.20 | Node.js + IIS (reverse proxy ARR) |
| **DB** | 192.168.10.30 | MySQL 8 con TLS |
| **MON** | 192.168.10.40 | Prometheus + Grafana |

Ver `docs/DESPLIEGUE.md` para la guía completa paso a paso.

---



## Equipo

BimestManager es resultado del trabajo conjunto de un equipo multidisciplinario:

### Desarrollo

- **Daniel Meza Sánchez** — Backend, base de datos, integración
- **Daniel Alejandro Pérez Esquivel** — Backend, seguridad, despliegue

### Diseño

- **Said Díaz Loya** — Diseño de interfaz y experiencia de usuario
- **Kevin Sandoval Nieves** — Diseño visual y prototipado Despliegue Servidor BD

### Infra estructura 

- **Juan Pablo Flores Varela - PO, Sysadmin e infrastructura**
- **Pérez Arzate Carlos Daniel -  Diseñador BD e infraestructura**

---

## Licencia

Distribuido bajo licencia **ISC**. Ver `package.json` para más detalles.

---

<p align="center">
  <strong>BimestManager</strong> — La gestión de laboratorios, como debería ser.
</p>
