# Despliegue de BimestManager en Coolify (nube)

Esta guía explica cómo subir BimestManager a **Coolify** corriendo en una
instancia, con la **base de datos MySQL gestionada por el propio Coolify** en
otra instancia/recurso. El proyecto sigue funcionando igual en local (rama
`main`); esta rama `nube` solo agrega lo necesario para contenedores.

> **Idea clave:** Coolify usa Docker. El contenedor de la app corre en HTTP
> interno y **Traefik** (incluido en Coolify) le pone HTTPS público con
> certificado Let's Encrypt automático. Por eso desactivamos el HTTPS
> autofirmado del código con `HTTPS_ENABLED=false`.

---

## Arquitectura

```
                 Internet (HTTPS, Let's Encrypt)
                            │
                    ┌───────▼────────┐
                    │ Traefik (Coolify)│  termina TLS
                    └───────┬────────┘
                            │ HTTP interno (red Docker privada)
                  ┌─────────▼──────────┐        ┌──────────────────┐
                  │  App BimestManager │◄──────►│  MySQL (Coolify)  │
                  │  contenedor :4000  │  red    │  recurso :3306    │
                  └────────────────────┘ privada └──────────────────┘
```

La app y la base se comunican por la **red interna de Docker**, así que el
tráfico DB no sale a internet y no necesita TLS (`DB_SSL=false`).

---

## Requisitos previos

- Una instancia de Coolify ya instalada y accesible (panel web).
- Un dominio o subdominio apuntando a la IP del servidor de Coolify
  (ej: `bimest.tudominio.com` → A record a la IP). Sin dominio puedes usar la
  URL `sslip.io` que Coolify genera, pero con dominio obtienes HTTPS válido.
- El repo público: `https://github.com/413xkur4y4m1/BimestManager.git`,
  rama **`nube`**.

---

## Paso 1 — Crear la base de datos MySQL en Coolify

1. En Coolify entra a tu **Proyecto** → **+ New** → **Database** → **MySQL**
   (o **MariaDB**, compatible con `mysql2`).
2. Configura:
   - **Name:** `bimest-db` (o el que prefieras).
   - **Version:** MySQL 8.x.
   - **Database / DB name:** Coolify suele dejar `default`. Puedes dejarlo así
     (en ese caso usa `DB_NAME=default`) o ponerle `labs` (`DB_NAME=labs`).
   - **Username:** `bimest_app`
   - **Password:** genera una fuerte y **guárdala**.
3. **Deploy** la base.
4. Una vez desplegada, abre el recurso y copia el **hostname interno** que
   Coolify muestra (algo como `mysql-xxxxxxxx` o el nombre del servicio).
   Ese valor es tu `DB_HOST`. **No uses la IP pública**: usa el hostname interno
   para que la conexión viaje por la red privada de Docker.

> Si quieres administrar la base desde tu PC, en el recurso activa
> **"Public Port"** temporalmente y conéctate con Workbench/DBeaver al
> `IP:puerto` que te dé Coolify. Desactívalo cuando termines.

---

## Paso 2 — Cargar el esquema de la base

> **No uses `creacionTabs.sql` tal cual en la nube.** Ese archivo trae
> `SET PERSIST require_secure_transport = ON` (forzaría TLS y rompería la
> conexión interna), un `use labs` que no coincide con la base `default`, y
> `SELECT`/`UPDATE` con datos reales. En su lugar usa **`sql/schema_cloud.sql`**,
> que es el mismo esquema pero limpio y seguro para una base nueva.

El **hostname interno** de la base (ej. `j0kw8wskcscgw4k8s8sogsgg`) **solo es
alcanzable desde dentro de la red de Coolify**, no desde tu PC. Por eso la forma
más simple es cargar el esquema desde el contenedor de la app, que sí lo ve:

**Opción A (recomendada) — script `db:init` desde el contenedor de la app:**

1. Primero completa los Pasos 3 y 4 (crear la app y sus variables de entorno).
2. Despliega la app una vez.
3. En Coolify abre la app → pestaña **Terminal** (shell del contenedor) y corre:
   ```bash
   npm run db:init
   ```
   El script `scripts/init-db.js` usa las mismas variables (`DB_HOST`, etc.),
   ejecuta `sql/schema_cloud.sql` y al final lista las tablas creadas.
   Es idempotente (`CREATE TABLE IF NOT EXISTS`): puedes volver a correrlo sin
   romper nada.

**Opción B — desde tu PC con puerto público temporal:**

En el recurso MySQL activa **"Public Port"**, y desde tu máquina (con cliente
`mysql` instalado):
```bash
mysql -h <IP_PUBLICA_COOLIFY> -P <PUERTO_PUBLICO> -u bimest_app -p default < sql/schema_cloud.sql
```
Desactiva el puerto público al terminar.

> Cambia `default` por `labs` si así nombraste la base en el Paso 1.

---

## Paso 3 — Crear la aplicación en Coolify

1. En el mismo proyecto: **+ New** → **Application** → **Public Repository**.
2. **Repository URL:** `https://github.com/413xkur4y4m1/BimestManager.git`
3. **Branch:** `nube`
4. **Build Pack:** selecciona **Dockerfile** (el repo ya incluye uno en la raíz).
5. **Port (Ports Exposes):** `4000`
6. **Healthcheck (opcional):** path `/salud`, puerto `4000`. El Dockerfile ya
   trae un `HEALTHCHECK` de respaldo.

---

## Paso 4 — Variables de entorno de la app

En la app, ve a **Environment Variables** y agrega (ver `.env.cloud.example`):

```
PORT=4000
HTTPS_ENABLED=false
NODE_ENV=production
LOG_LEVEL=info

DB_HOST=<hostname_interno_de_la_base_del_Paso_1>
DB_PORT=3306
DB_USER=bimest_app
DB_PASSWORD=<password_de_la_base>
DB_NAME=default
DB_SSL=false

JWT_SECRET=<genera: openssl rand -hex 48>
JWT_REFRESH_SECRET=<genera otro distinto>
AUTH_COOKIE_MAX_AGE_MS=7200000

MONITOR_URL=
MONITOR_REDIRECT=false
```

> Deja `MONITOR_URL` **vacío** para desactivar el envío de logs a Tailscale
> (eso es para el modo on-premise). Los secretos JWT deben ser largos y únicos.

---

## Paso 5 — Dominio y HTTPS

1. En la app → **Domains**, pon tu dominio: `https://bimest.tudominio.com`.
2. Coolify genera el certificado Let's Encrypt automáticamente (Traefik).
3. No toques nada de certificados en el código: el HTTPS autofirmado queda
   apagado por `HTTPS_ENABLED=false`.

---

## Paso 6 — (Recomendado) Volúmenes persistentes

La app escribe en dos carpetas que se borran al recrear el contenedor. Para no
perder datos, en la app → **Storages / Persistent Volumes** monta:

| Ruta en el contenedor | Para qué |
|-----------------------|----------|
| `/app/imageFirma`     | Firmas digitales de alumnos (datos personales) |
| `/app/logs`           | Logs de winston (rotación diaria) |

Si no montas `imageFirma`, las firmas subidas se perderán en cada redeploy.

---

## Paso 7 — Desplegar y verificar

1. Pulsa **Deploy**. Coolify clona la rama `nube`, construye el Dockerfile y
   levanta el contenedor.
2. Revisa **Logs**: deberías ver
   `HTTP escuchando en http://localhost:4000` y
   `Conexion a MySQL verificada correctamente (sin TLS) ...`.
3. Prueba el healthcheck:
   ```bash
   curl https://bimest.tudominio.com/salud
   # {"ok":true,"ts":"..."}
   ```
4. Abre `https://bimest.tudominio.com/login` en el navegador.

---

## Modelo dual: nube vs. on-premise

- **Plan plataforma (nube):** este flujo. Rama `nube`, MySQL gestionado por
  Coolify, HTTPS por Traefik.
- **Plan personalizado (on-premise):** rama `main`, con HTTPS autofirmado
  (`HTTPS_ENABLED=true`), MySQL local y monitoreo Tailscale activo
  (`MONITOR_URL=...`). Nada de esto cambia: `main` sigue intacta.

La única diferencia operativa es **qué variables de entorno** se inyectan.
El mismo código sirve para ambos modos.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `No se pudo verificar la conexión con la base de datos` | `DB_HOST` mal o base no lista | Usa el hostname **interno** de Coolify; confirma que el recurso MySQL esté "Running". |
| Falla el build en `npm ci` por bcrypt | Toolchain de compilación | El Dockerfile ya instala `python3 make g++`. Revisa que el build use el **Dockerfile** y no Nixpacks. |
| HTTPS no carga | Dominio mal apuntado | Verifica el A record y espera la emisión de Let's Encrypt. |
| Estilos/CSS no cargan | CSP en producción | Está pensado: `NODE_ENV=production` activa Helmet. Sirve todo bajo el mismo dominio HTTPS. |
| Firmas desaparecen tras redeploy | Sin volumen persistente | Monta `/app/imageFirma` (Paso 6). |
