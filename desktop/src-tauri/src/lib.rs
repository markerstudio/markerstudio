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

// The brand cream (--marker-cream #F5F2EC): windows paint this while loading
// instead of flashing white — the single biggest "cheap web view" tell.
const WINDOW_BG: tauri::webview::Color = tauri::webview::Color(245, 242, 236, 255);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // The main window remembers its size & position across launches.
        // Preview windows are transient (fresh labels every session) — keeping
        // them out stops the state file accumulating dead entries.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_filter(|label| label == "main")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            notify,
            set_badge,
            open_external,
            open_preview,
            print_page,
            save_text_file,
            save_file,
            save_credentials,
            get_credentials,
            has_credentials,
            clear_credentials
        ])
        // A real menu bar — File/Edit/View/Window with the shortcuts a Mac
        // user's hands already know (⌘P, ⌘R, ⌘[ ⌘], ⌘+/−/0, ⌘W…).
        .menu(build_menu)
        .on_menu_event(|app, event| handle_menu(app, event))
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
                .background_color(WINDOW_BG)
                // Keep the page content clear of the macOS traffic-light buttons,
                // which sit over the top-left with the Overlay title bar.
                .initialization_script(NATIVE_CHROME_CSS)
                // Let the web page know it's running inside the native app, so it
                // can switch to the native credential/notification paths.
                .initialization_script("window.__MARKER_DESKTOP__ = true;")
                // The `__MARKER_NATIVE__` bridge + new-window/link handling.
                .initialization_script(BRIDGE_JS)
                .initialization_script(LINKS_JS)
                // App-like behaviours: no image dragging, no browser context
                // menu on chrome (kept where text is edited or selected).
                .initialization_script(POLISH_JS);

            // Native, transparent macOS title bar so the page runs to the top
            // edge as one surface (traffic lights inset over the content).
            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true);
            }

            builder.build()?;

            // Quietly look for a newer build once the window is up. Dormant
            // until the updater pubkey is set in tauri.conf.json.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Marker Studio");
}

// ---------------------------------------------------------------------------
// Auto-update
// ---------------------------------------------------------------------------

// Checks marker.ps for a newer signed build and offers to install it. The
// whole path is a no-op while the updater pubkey in tauri.conf.json is empty,
// so shipping this wired-but-dormant is safe. Every failure exits silently —
// an update check must never get in the way of using the app.
async fn check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    use tauri_plugin_updater::UpdaterExt;

    let configured = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v.get("pubkey"))
        .and_then(|v| v.as_str())
        .is_some_and(|s| !s.is_empty());
    if !configured {
        return;
    }

    let Ok(updater) = app.updater() else { return };
    let Ok(Some(update)) = updater.check().await else { return };

    let install = app
        .dialog()
        .message(format!(
            "Marker Studio {} is available (you have {}).\nInstall it now? The app restarts when it's done.",
            update.version,
            app.package_info().version
        ))
        .title("Update available")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Install & Relaunch".to_string(),
            "Later".to_string(),
        ))
        .blocking_show();
    if !install {
        return;
    }

    // Re-check right before downloading: the feed serves short-lived signed
    // artifact URLs, and the user may have sat on the dialog past expiry.
    let fresh = match updater.check().await {
        Ok(Some(u)) => u,
        _ => update,
    };
    // A failed install must SAY so — a silent "nothing happened" after
    // "Install & Relaunch" is worse than any error text.
    match fresh.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => app.restart(),
        Err(e) => {
            app.dialog()
                .message(format!(
                    "The update couldn't be installed:\n\n{e}\n\nYou can try again on the next launch, or download the latest version from the releases page."
                ))
                .title("Update failed")
                .blocking_show();
        }
    }
}

// ---------------------------------------------------------------------------
// Menu bar
// ---------------------------------------------------------------------------

// ⌘1–⌘9 jumps — mirrors the admin sidebar's order. Paths are static strings
// the shell owns; the handler interpolates them into a location.assign().
const GO_SECTIONS: [(&str, &str); 9] = [
    ("Today", "/admin"),
    ("Agenda", "/admin/agenda"),
    ("Clients", "/admin/clients"),
    ("Tasks", "/admin/deliverables"),
    ("Notes", "/admin/notes"),
    ("Invoices", "/admin/invoices"),
    ("Finance", "/admin/finance"),
    ("Proposals", "/admin/proposals"),
    ("Inquiries", "/admin/inquiries"),
];

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    use tauri::menu::{AboutMetadata, Menu, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder};

    #[cfg(target_os = "macos")]
    let app_menu = {
        let pkg = app.package_info();
        let about = AboutMetadata {
            name: Some(pkg.name.clone()),
            version: Some(pkg.version.to_string()),
            ..Default::default()
        };
        Submenu::with_items(
            app,
            pkg.name.clone(),
            true,
            &[
                &PredefinedMenuItem::about(app, None, Some(about))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?
    };

    let file = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItemBuilder::with_id("print", "Print…")
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItemBuilder::with_id("back", "Back")
                .accelerator("CmdOrCtrl+[")
                .build(app)?,
            &MenuItemBuilder::with_id("forward", "Forward")
                .accelerator("CmdOrCtrl+]")
                .build(app)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItemBuilder::with_id("zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
            &MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
            &MenuItemBuilder::with_id("zoom-reset", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let mut go_builder = SubmenuBuilder::new(app, "Go");
    for (i, (label, path)) in GO_SECTIONS.iter().enumerate() {
        go_builder = go_builder.item(
            &MenuItemBuilder::with_id(format!("go:{path}"), *label)
                .accelerator(format!("CmdOrCtrl+{}", i + 1))
                .build(app)?,
        );
    }
    let go = go_builder.build()?;

    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &app_menu,
            &file,
            &edit,
            &view,
            &go,
            &window,
        ],
    )
}

// Custom menu items act on whichever window is focused — main or a preview.
fn handle_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event: tauri::menu::MenuEvent) {
    let focused = app
        .webview_windows()
        .into_values()
        .find(|w| w.is_focused().unwrap_or(false))
        .or_else(|| app.get_webview_window("main"));
    let Some(w) = focused else { return };
    match event.id().as_ref() {
        "print" => {
            let _ = w.print();
        }
        "reload" => {
            let _ = w.reload();
        }
        "back" => {
            let _ = w.eval("history.back()");
        }
        "forward" => {
            let _ = w.eval("history.forward()");
        }
        id @ ("zoom-in" | "zoom-out" | "zoom-reset") => {
            let _ = w.set_zoom(zoom_step(w.label(), id));
        }
        // Section jumps always drive the MAIN window — navigating a preview
        // window (an invoice, a print doc) to /admin would be surprising.
        id if id.starts_with("go:") => {
            if let Some(main) = app.get_webview_window("main") {
                let path = &id[3..];
                let _ = main.eval(format!("location.assign('{path}')"));
                let _ = main.set_focus();
            }
        }
        _ => {}
    }
}

// Per-window zoom factor, stepped by the View menu. WKWebView doesn't expose
// its zoom level, so the shell keeps the ledger.
fn zoom_step(label: &str, direction: &str) -> f64 {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    static ZOOM: OnceLock<Mutex<HashMap<String, f64>>> = OnceLock::new();
    let mut map = ZOOM
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .expect("zoom ledger poisoned");
    let z = map.entry(label.to_string()).or_insert(1.0);
    *z = match direction {
        "zoom-in" => (*z * 1.1).min(3.0),
        "zoom-out" => (*z / 1.1).max(0.5),
        _ => 1.0,
    };
    *z
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
        .background_color(WINDOW_BG)
        .initialization_script("window.__MARKER_DESKTOP__ = true;")
        .initialization_script(BRIDGE_JS)
        .initialization_script(LINKS_JS)
        .initialization_script(POLISH_JS)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// WKWebView implements the page's window.print() as a silent no-op, so every
// "Save as PDF" button in the app did nothing. The injected bridge reroutes
// window.print() here instead: the native print panel for whichever window
// asked (main or a preview), where "Save as PDF" works like any Mac app.
#[tauri::command]
fn print_page(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    webview_window.print().map_err(|e| e.to_string())
}

// WKWebView also can't do `<a download>` blob downloads — the site's .txt
// export hands the text here instead: a native save panel, then a plain write.
// Returns false when the user cancels (not an error). Async so the blocking
// dialog runs off the main thread (the plugin hops back internally).
#[tauri::command]
async fn save_text_file(app: tauri::AppHandle, filename: String, content: String) -> Result<bool, String> {
    write_via_save_panel(&app, &filename, content.into_bytes()).await
}

// Binary sibling of save_text_file: the site's PDF / image exports arrive as
// base64 and go out through the same native save panel.
#[tauri::command]
async fn save_file(app: tauri::AppHandle, filename: String, data: String) -> Result<bool, String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| e.to_string())?;
    write_via_save_panel(&app, &filename, bytes).await
}

async fn write_via_save_panel(app: &tauri::AppHandle, filename: &str, bytes: Vec<u8>) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    let name: String = filename
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':') { '-' } else { c })
        .collect();
    let name = if name.trim().is_empty() { "download".to_string() } else { name };
    let Some(picked) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(false);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(true)
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
    printPage: function () { return inv('print_page'); },
    saveText: function (filename, content) { return inv('save_text_file', { filename: filename, content: content }); },
    saveFile: function (filename, base64) { return inv('save_file', { filename: filename, data: base64 }); },
    saveCredentials: function (email, password) { return inv('save_credentials', { email: email, password: password }); },
    getCredentials: function () { return inv('get_credentials'); },
    hasCredentials: function () { return inv('has_credentials'); },
    clearCredentials: function () { return inv('clear_credentials'); }
  };
})();
"#;

// The web tells that make a wrapped site feel like a wrapped site, removed:
// draggable images and the browser context menu on plain chrome. The menu
// stays wherever it's genuinely useful — text fields and real selections —
// so copy/paste and spellcheck still behave.
const POLISH_JS: &str = r#"
(function () {
  function addCss() {
    if (document.getElementById('marker-native-polish')) return;
    var s = document.createElement('style');
    s.id = 'marker-native-polish';
    s.textContent = 'img, a { -webkit-user-drag: none; }';
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCss);
  } else {
    addCss();
  }
  window.addEventListener('contextmenu', function (e) {
    var el = e.target;
    var editable = el && el.closest ? el.closest('input, textarea, [contenteditable], [contenteditable=""], [contenteditable="true"]') : null;
    var sel = window.getSelection ? String(window.getSelection()) : '';
    if (!editable && !sel.trim()) e.preventDefault();
  });
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
  // WKWebView's window.print() is a silent no-op — route it to the native
  // print panel so every "Save as PDF" button in the app actually works.
  var realPrint = typeof window.print === 'function' ? window.print.bind(window) : null;
  window.print = function () {
    var p = native().printPage;
    if (p) {
      p().catch(function () { if (realPrint) { try { realPrint(); } catch (e) {} } });
      return;
    }
    if (realPrint) realPrint();
  };
})();
"#;
