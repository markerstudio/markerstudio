// Marker Studio desktop shell.
//
// What the native layer adds on top of the hosted site:
//   • System notifications + a Dock badge, driven by the site's notification
//     bell through the `__MARKER_NATIVE__` bridge injected below.
//   • Working links: `target="_blank"` / `window.open` used to be swallowed by
//     WKWebView (the "PDF preview does nothing" bug). Same-site pages and PDFs
//     now open in a native preview window; external links open in the browser.
//   • Remembered sign-in: credentials can be saved to the macOS Keychain and
//     autofilled on the login page behind a Touch ID / Face ID check — the
//     biometric now guards something real instead of gating every launch.
//
// The old launch-time biometric gate is gone: it locked a window that held no
// secrets while the actual session cookie lived on regardless.

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            notify,
            set_badge,
            open_external,
            open_preview,
            save_credentials,
            get_credentials,
            has_credentials,
            clear_credentials
        ])
        .setup(|app| {
            use tauri::{WebviewUrl, WebviewWindowBuilder};

            // Shared entry point: /login routes admins to /admin and clients to
            // /portal after sign-in, so one app works for the studio and clients.
            let url = "https://marker.ps/login".parse().expect("valid url");

            #[allow(unused_mut)]
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Marker Studio")
                .inner_size(1280.0, 832.0)
                .min_inner_size(960.0, 600.0)
                .center()
                // Keep the page content clear of the macOS traffic-light buttons,
                // which sit over the top-left with the Overlay title bar.
                .initialization_script(NATIVE_CHROME_CSS)
                // Let the web page know it's running inside the native app, so it
                // can switch to the native credential/notification paths.
                .initialization_script("window.__MARKER_DESKTOP__ = true;")
                // The `__MARKER_NATIVE__` bridge + new-window/link handling.
                .initialization_script(BRIDGE_JS)
                .initialization_script(LINKS_JS);

            // Native, transparent macOS title bar so the page runs to the top
            // edge as one surface (traffic lights inset over the content).
            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true);
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Marker Studio");
}

// ---------------------------------------------------------------------------
// Notifications + badge
// ---------------------------------------------------------------------------

#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: Option<String>) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    let mut n = app.notification().builder().title(title);
    if let Some(b) = body {
        n = n.body(b);
    }
    n.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_badge(app: tauri::AppHandle, count: i64) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let value = if count > 0 { Some(count) } else { None };
        // Unsupported on some platforms — never surface that to the page.
        let _ = w.set_badge_count(value);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Links & preview windows
// ---------------------------------------------------------------------------

#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:") || url.starts_with("tel:")) {
        return Err("blocked url scheme".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

// A separate native window for same-site pages, invoices and PDFs — WKWebView
// renders PDFs inline, so "preview" finally works in the app.
#[tauri::command]
fn open_preview(app: tauri::AppHandle, url: String, title: Option<String>) -> Result<(), String> {
    use std::sync::atomic::{AtomicU32, Ordering};
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    static SEQ: AtomicU32 = AtomicU32::new(0);

    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("blocked url scheme".into());
    }
    let parsed: tauri::Url = url.parse().map_err(|_| "invalid url".to_string())?;
    let label = format!("preview-{}", SEQ.fetch_add(1, Ordering::Relaxed));
    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed))
        .title(title.unwrap_or_else(|| "Marker Studio".into()))
        .inner_size(1100.0, 800.0)
        .initialization_script("window.__MARKER_DESKTOP__ = true;")
        .initialization_script(BRIDGE_JS)
        .initialization_script(LINKS_JS)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Remembered sign-in (macOS Keychain, Touch ID-guarded on read)
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
const KEYCHAIN_SERVICE: &str = "ps.marker.studio";
#[cfg(target_os = "macos")]
const KEYCHAIN_USER: &str = "marker-login";

#[tauri::command]
fn save_credentials(email: String, password: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).map_err(|e| e.to_string())?;
        let blob = serde_json::json!({ "email": email, "password": password }).to_string();
        entry.set_password(&blob).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (email, password);
        Err("unsupported platform".into())
    }
}

#[tauri::command]
fn has_credentials() -> bool {
    #[cfg(target_os = "macos")]
    {
        keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER)
            .and_then(|e| e.get_password())
            .is_ok()
    }
    #[cfg(not(target_os = "macos"))]
    false
}

#[derive(serde::Serialize)]
struct Credentials {
    email: String,
    password: String,
}

// Reading the saved password asks the Mac to confirm it's really the owner —
// Touch ID / Face ID with the device passcode as fallback. This is the ONLY
// place the app prompts for biometrics.
#[tauri::command]
async fn get_credentials() -> Result<Credentials, String> {
    #[cfg(target_os = "macos")]
    {
        let authed = tauri::async_runtime::spawn_blocking(biometric_check)
            .await
            .map_err(|e| e.to_string())?;
        if !authed {
            return Err("cancelled".into());
        }
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER).map_err(|e| e.to_string())?;
        let blob = entry.get_password().map_err(|_| "none saved".to_string())?;
        let v: serde_json::Value = serde_json::from_str(&blob).map_err(|_| "corrupt entry".to_string())?;
        Ok(Credentials {
            email: v["email"].as_str().unwrap_or_default().to_string(),
            password: v["password"].as_str().unwrap_or_default().to_string(),
        })
    }
    #[cfg(not(target_os = "macos"))]
    Err("unsupported platform".into())
}

#[tauri::command]
fn clear_credentials() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    Ok(())
}

// True when the device owner confirmed via Touch ID / Face ID / passcode. If
// this Mac has no biometrics at all, the Keychain's own protection is all we
// have — allow, rather than locking the owner out of their saved login.
#[cfg(target_os = "macos")]
fn biometric_check() -> bool {
    use robius_authentication::{AndroidText, BiometricStrength, Context, Error, PolicyBuilder, Text, WindowsText};

    let policy = PolicyBuilder::new()
        .biometrics(Some(BiometricStrength::Strong))
        .password(true)
        .build();
    let Some(policy) = policy else { return true };

    let text = Text {
        android: AndroidText { title: "Marker Studio", subtitle: None, description: None },
        // Shown as "Marker Studio is trying to fill your saved sign-in".
        apple: "fill your saved sign-in",
        windows: WindowsText::new("Marker Studio", "Fill your saved sign-in").expect("static prompt text fits"),
    };

    match Context::new(()).blocking_authenticate(text, &policy) {
        Ok(()) => true,
        Err(Error::Authentication)
        | Err(Error::UserCanceled)
        | Err(Error::AppCanceled)
        | Err(Error::SystemCanceled)
        | Err(Error::Exhausted)
        | Err(Error::Busy)
        | Err(Error::Timeout) => false,
        // No biometrics enrolled / unavailable — don't lock the owner out.
        Err(_) => true,
    }
}

// ---------------------------------------------------------------------------
// Injected scripts
// ---------------------------------------------------------------------------

// Nudges sticky top-bar content right so the macOS window buttons never overlap
// the wordmark/nav. No-op on pages without a matching header.
const NATIVE_CHROME_CSS: &str = r#"
(function () {
  function inject() {
    if (document.getElementById('marker-native-chrome')) return;
    var s = document.createElement('style');
    s.id = 'marker-native-chrome';
    s.textContent =
      'header.sticky > div > div:first-child{padding-left:78px}' +
      '@media (min-width:1240px){header.sticky > div > div:first-child{padding-left:0}}';
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
"#;

// The stable API the site talks to. Every method resolves quietly when the IPC
// isn't available so the site can call it unconditionally.
const BRIDGE_JS: &str = r#"
(function () {
  function inv(cmd, args) {
    try {
      var i = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
              (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
      return i ? Promise.resolve(i(cmd, args || {})) : Promise.reject('no ipc');
    } catch (e) { return Promise.reject(e); }
  }
  window.__MARKER_NATIVE__ = {
    notify: function (title, body) { return inv('notify', { title: title, body: body }); },
    setBadge: function (count) { return inv('set_badge', { count: count || 0 }); },
    openExternal: function (url) { return inv('open_external', { url: url }); },
    openPreview: function (url, title) { return inv('open_preview', { url: url, title: title }); },
    saveCredentials: function (email, password) { return inv('save_credentials', { email: email, password: password }); },
    getCredentials: function () { return inv('get_credentials'); },
    hasCredentials: function () { return inv('has_credentials'); },
    clearCredentials: function () { return inv('clear_credentials'); }
  };
})();
"#;

// Make links behave like an app: same-site pop-outs and PDFs open in a native
// preview window, everything external opens in the default browser. Without
// this, WKWebView silently ignores target="_blank" — the old "can't preview a
// PDF" bug.
const LINKS_JS: &str = r#"
(function () {
  function native() { return window.__MARKER_NATIVE__ || {}; }
  function isPdf(url) {
    return /\.pdf(\?|#|$)/i.test(url) || /vercel-storage\.com/i.test(url);
  }
  function route(url, wantsNewWindow) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return false; }
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') {
      (native().openExternal || function(){ return Promise.reject(); })(u.href).catch(function () { location.href = u.href; });
      return true;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    var sameSite = u.origin === location.origin;
    if (sameSite && !wantsNewWindow) return false; // normal navigation
    var open = sameSite || isPdf(u.href) ? native().openPreview : native().openExternal;
    if (!open) { if (sameSite) { location.href = u.href; return true; } return false; }
    open(u.href).catch(function () { if (sameSite) location.href = u.href; });
    return true;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.href;
    var blank = a.target === '_blank' || e.metaKey || e.ctrlKey;
    var u; try { u = new URL(href, location.href); } catch (err) { return; }
    var external = u.origin !== location.origin;
    if (!blank && !external) return; // in-app navigation stays native
    if (route(href, true)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  var realOpen = window.open;
  window.open = function (url) {
    if (url && route(String(url), true)) return null;
    return realOpen ? realOpen.apply(window, arguments) : null;
  };
})();
"#;
