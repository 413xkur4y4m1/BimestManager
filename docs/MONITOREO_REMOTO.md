# Monitoreo y logs en servidor separado (`proy`)

A partir de esta versión, BimestManager **delega los logs y el monitoreo en un
servidor externo** llamado `proy`, que corre en la PC del compañero de equipo
dentro de la misma red privada **Tailscale**.

```
   ┌──────────────────────────────┐         ┌──────────────────────────────┐
   │  BimestManager (esta PC)     │         │  proy (la PC del amigo)      │
   │  Tailscale IP: 100.74.178.5  │  HTTPS  │  Tailscale IP: 100.115.7.108 │
   │  Node + MySQL + EJS          │ ──POST─▶│  Node + winston + dashboard  │
   │  /monitor → redirige a proy  │         │  :3000  /api/ingesta/{log,…} │
   └──────────────────────────────┘         └──────────────────────────────┘
```

## Por qué

- **Aislamiento**: si BimestManager se cae, los logs y métricas siguen
  visibles en proy.
- **Una sola consola**: el amigo opera el dashboard de monitoreo desde su
  PC sin necesidad de meterse en BimestManager.
- **Sin perder los logs locales**: BimestManager sigue escribiendo `logs/`
  en disco como fallback — si la red Tailscale falla, no se pierde nada.

## Configuración

Editar `.env` de BimestManager:

```env
MONITOR_URL=http://100.115.7.108:3000
MONITOR_TOKEN=<el mismo token que en proy/.env como TOKEN_INGESTA>
MONITOR_ORIGEN=bimest
MONITOR_INTERVAL_MS=5000
MONITOR_REDIRECT=true
```

Si `MONITOR_URL` o `MONITOR_TOKEN` están vacíos, BimestManager se comporta
como antes: logs sólo a disco, dashboard local en `/monitor`.

## Pasos del amigo

> El dispositivo del amigo ya está dado de alta en **la misma cuenta de
> Tailscale**, así que no hay invitaciones que aceptar — basta con que
> Tailscale esté corriendo.

Ver `proy/README.md`. Resumen:

1. Abrir el cliente Tailscale (que ya está instalado) y comprobar que
   está conectado: `tailscale status` y `tailscale ip -4` debe dar `100.115.7.108`.
2. `npm install` en `proy/` y crear `.env` desde `.env.example`.
3. Generar token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Pegar el token en `proy/.env` (`TOKEN_INGESTA`) **y también** decírselo a
   danoa para pegarlo en `BimestManager/.env` (`MONITOR_TOKEN`).
5. Arrancar con `npm start` o doble-click a `arrancar.bat`.

## Verificación de un extremo a otro

Desde la PC de BimestManager:

```bash
# 1. Tailscale ve la otra PC
tailscale ping 100.115.7.108

# 2. proy responde
curl http://100.115.7.108:3000/api/estado

# 3. Arrancar BimestManager
npm start

# 4. Generar tráfico (login, etc.) y verificar en proy:
curl http://100.115.7.108:3000/api/ingesta/origenes
# → debería listar "bimest"

curl http://100.115.7.108:3000/api/ingesta/origenes/bimest/metricas
# → última muestra de CPU/RAM/disco/red de esta PC
```

## Endpoints que cambian de comportamiento

| Antes | Ahora |
|---|---|
| `GET /monitor` (vista local) | Si `MONITOR_REDIRECT=true`: redirige a `http://100.115.7.108:3000/`. Si `false`: muestra la vista local como fallback. |
| `GET /monitor/metricas` | Sigue funcionando, **además** se envía la misma muestra periódicamente a proy. |
| Logs en `logs/` | Siguen escribiéndose como antes **y** se POSTean a `proy/api/ingesta/log` en lotes de hasta 50 entradas cada 5s. |

## Troubleshooting

**No llegan logs a proy:**
- Activá `MONITOR_DEBUG=true` en `.env` y reiniciá. Aparecerá el error
  exacto (timeout, 401, etc.) en `logs/error-YYYY-MM-DD.log`.

**`AbortSignal.timeout is not a function`:**
- Estás en Node < 18. Actualizar a Node 20+.

**Token rechazado (401):**
- Los strings `MONITOR_TOKEN` y `TOKEN_INGESTA` no coinciden exactamente
  (espacios, comillas, etc.). Copiar uno y pegar literal.

**`proy` no responde al ping de Tailscale:**
- El amigo apagó la PC o cerró Tailscale. `tailscale status` desde tu PC
  muestra a qué nodos podés alcanzar.
