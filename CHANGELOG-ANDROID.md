# Changelog Android — BimestManager App

App nativa Android (Kotlin) que embebe el backend Node vía WebView.

Repositorio del proyecto Android: `C:\Users\danoa\AndroidStudioProjects\BimestManager`

## Características implementadas

- **WebView fullscreen** con cookies HttpOnly del JWT `bimest_token`.
- **JavaScript + DOM Storage + DB** habilitados para EJS dinámico y firmas digitales.
- **Pull-to-refresh** con SwipeRefreshLayout y colores brand teal/naranja.
- **Back navigation**: el botón físico navega dentro del WebView; sale de la app sólo cuando no hay historia.
- **File chooser** habilitado para `<input type="file">` (firmas, fotos de incidencias).
- **Permisos web**: cámara + micrófono on-demand para QR y captura.
- **HTTPS con cert autofirmado** aceptado vía `onReceivedSslError → handler.proceed()`.
- **NetworkSecurityConfig** que confía en LAN privada + cert dev + cert prod.
- **ngrok-friendly**: User-Agent custom sin "Mozilla" + interceptor que añade
  `ngrok-skip-browser-warning: true` a TODOS los sub-recursos para evitar la página
  intersticial de advertencia de ngrok-free.
- **Cookies persistentes** (`CookieManager`) — el login se conserva entre arranques.
- **Limpieza HSTS** al inicio: `clearCache(true)` + `removeSessionCookies` para
  evitar redirects HTTPS atrapados en cache de sesiones anteriores.
- **Pantalla de error** con botón Reintentar y mensaje localizado.
- **Barra de progreso** superior naranja durante cargas.
- **Theme Material3** con status bar `bm_teal_900` y navigation bar `bm_teal_800`.
- **Launcher icon adaptive**: logo BimestManager (anillos teal+naranja) con fondo
  teal sólido + foreground con 18% de padding para safe area circular.

## Configuración

URL del backend en `app/src/main/res/values/strings.xml`:

```xml
<string name="server_url">https://desecrate-untwist-smoky.ngrok-free.dev</string>
```

| Escenario | URL recomendada |
|---|---|
| Emulador AVD | `http://10.0.2.2:4000` o `https://10.0.2.2:4443` |
| Celular físico en LAN | `https://<IP-WiFi>:4443` |
| Demo fuera de red local | URL pública de `ngrok http 4000` |
| Producción | Dominio real con cert válido |

## Permisos necesarios

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Stack técnico

- **Kotlin** 2.0.21 (built-in en AGP 9.1.1)
- **minSdk** 24 (Android 7.0)
- **targetSdk** 36
- **AndroidX**: appcompat, core-ktx, activity, constraintlayout, swiperefreshlayout 1.1.0
- **Material3** para temas

## Distribución APK

- Debug: `app/build/outputs/apk/debug/app-debug.apk` (Build → Generate APK)
- Release firmado: requiere keystore propio (Build → Generate Signed APK)
