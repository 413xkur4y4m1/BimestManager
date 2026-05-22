# Changelog iOS — BimestManager App

App nativa iOS (SwiftUI) que embebe el backend Node vía WKWebView.

## Arquitectura propuesta

```swift
import SwiftUI
import WebKit

struct BimestWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()            // cookies JWT persistentes
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = context.coordinator
        webView.customUserAgent = "BimestManagerIOSApp/1.0 (Mobile)"

        var req = URLRequest(url: url)
        req.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")
        webView.load(req)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate {
        // Acepta el cert autofirmado del backend dev
        func webView(_ webView: WKWebView,
                     didReceive challenge: URLAuthenticationChallenge,
                     completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
            if let trust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: trust))
            } else {
                completionHandler(.performDefaultHandling, nil)
            }
        }
    }
}

struct ContentView: View {
    var body: some View {
        BimestWebView(url: URL(string: "https://desecrate-untwist-smoky.ngrok-free.dev")!)
            .ignoresSafeArea()
    }
}
```

## Configuración necesaria — `Info.plist`

Para cert autofirmado en LAN (solo dev):

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>192.168.10.20</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key><true/>
            <key>NSIncludesSubdomains</key><true/>
            <key>NSExceptionRequiresForwardSecrecy</key><false/>
        </dict>
    </dict>
</dict>
```

Con **ngrok** no se necesita este bloque (el cert es válido por defecto).

## Stack técnico

- **Swift** 5.9+ con **SwiftUI**
- **WebKit / WKWebView**
- **Min iOS** 15.0
- **Cookies persistentes** con `WKWebsiteDataStore.default()`
- **Cert autofirmado** vía `didReceive challenge`

## Notas de implementación

- El `customUserAgent = "BimestManagerIOSApp/1.0 (Mobile)"` evita la página
  intersticial de ngrok-free (sin "Mozilla" en el UA).
- Si se usa la URL pública de ngrok, no se necesita configurar `NSAppTransportSecurity`.
- El gesto `allowsBackForwardNavigationGestures` activa el swipe-back nativo de iOS.
- Para subir el APK equivalente (IPA) se usa Xcode → Product → Archive.
