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
            install_update,
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

// The pending update, parked between "found one" and the user clicking
// Install in the banner. Cleared by install_update.
fn pending_update() -> &'static std::sync::Mutex<Option<tauri_plugin_updater::Update>> {
    use std::sync::{Mutex, OnceLock};
    static PENDING: OnceLock<Mutex<Option<tauri_plugin_updater::Update>>> = OnceLock::new();
    PENDING.get_or_init(|| Mutex::new(None))
}

// Checks marker.ps for a newer signed build. When one exists, a branded glass
// banner slides into the main window (injected DOM — no site deploy needed)
// with an Install button and a live progress bar; the plain system dialog is
// the fallback if the injection fails. The whole path is a no-op while the
// updater pubkey in tauri.conf.json is empty.
async fn check_for_updates(app: tauri::AppHandle) {
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
    let version = update.version.clone();
    let current = app.package_info().version.to_string();

    if let Ok(mut slot) = pending_update().lock() {
        *slot = Some(update.clone());
    }

    let injected = app
        .get_webview_window("main")
        .map(|w| {
            w.eval(
                UPDATE_BANNER_JS
                    .replace("__NEW_VERSION__", &version)
                    .replace("__OLD_VERSION__", &current),
            )
            .is_ok()
        })
        .unwrap_or(false);

    if !injected {
        // Fallback: the plain dialog + immediate install.
        use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
        let install = app
            .dialog()
            .message(format!(
                "Marker Studio {version} is available (you have {current}).\nInstall it now? The app restarts when it's done."
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
        match update.download_and_install(|_, _| {}, || {}).await {
            Ok(()) => app.restart(),
            Err(e) => {
                app.dialog()
                    .message(format!("The update couldn't be installed:\n\n{e}"))
                    .title("Update failed")
                    .blocking_show();
            }
        }
    }
}

// The banner's Install button lands here. Re-checks for a fresh manifest
// (the feed's signed artifact URLs are short-lived and the user may have sat
// on the banner), streams progress back into the page, restarts on success,
// and reports the REAL error text on failure — never silence.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let parked = pending_update().lock().map_err(|_| "update state poisoned")?.take();
    let Some(parked) = parked else { return Err("no update pending".to_string()) };

    let update = match app.updater().ok() {
        Some(u) => match u.check().await {
            Ok(Some(fresh)) => fresh,
            _ => parked,
        },
        None => parked,
    };

    let progress_window = app.get_webview_window("main");
    let mut downloaded: usize = 0;
    let result = update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk;
                if let (Some(w), Some(t)) = (&progress_window, total) {
                    if t > 0 {
                        let pct = ((downloaded as f64 / t as f64) * 100.0).min(100.0);
                        let _ = w.eval(format!(
                            "window.__MARKER_UPDATE_PROGRESS__&&window.__MARKER_UPDATE_PROGRESS__({pct:.0})"
                        ));
                    }
                }
            },
            || {},
        )
        .await;

    match result {
        Ok(()) => app.restart(),
        Err(e) => {
            let msg = e.to_string();
            if let Some(w) = app.get_webview_window("main") {
                let json = serde_json::to_string(&msg).unwrap_or_else(|_| "\"update failed\"".into());
                let _ = w.eval(format!(
                    "window.__MARKER_UPDATE_FAILED__&&window.__MARKER_UPDATE_FAILED__({json})"
                ));
            }
            Err(msg)
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

// The update banner — brand-styled, injected straight into the main window so
// it needs no site deploy. Self-contained: styles inline, buttons talk to the
// install_update command through the global Tauri IPC (withGlobalTauri).
// __NEW_VERSION__ / __OLD_VERSION__ are replaced before eval with values the
// shell controls (release version strings), never user input.
const UPDATE_BANNER_JS: &str = r#"
(function () {
  if (document.getElementById('marker-update-banner')) return;
  var css = document.createElement('style');
  css.textContent =
    '#marker-update-banner{position:fixed;z-index:2147483000;right:18px;bottom:18px;width:330px;padding:18px 18px 16px;border-radius:22px;' +
    'background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(250,248,244,.92));-webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);' +
    'border:1px solid rgba(255,255,255,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 24px 60px -18px rgba(48,48,48,.35);' +
    'font-family:Poppins,-apple-system,system-ui,sans-serif;color:#303030;animation:mub-in .5s cubic-bezier(.2,.9,.25,1.2) both}' +
    '@keyframes mub-in{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}' +
    '#marker-update-banner .mub-k{display:flex;align-items:center;gap:8px;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a8a8a}' +
    '#marker-update-banner .mub-dot{width:8px;height:8px;border-radius:99px;background:linear-gradient(135deg,#FFA226,#F57F00);box-shadow:0 0 0 3px rgba(255,145,0,.18)}' +
    '#marker-update-banner h3{margin:10px 0 2px;font-size:16.5px;font-weight:800;letter-spacing:-.01em}' +
    '#marker-update-banner p{margin:0 0 14px;font-size:12.5px;line-height:1.5;color:#6f6f6f}' +
    '#marker-update-banner .mub-row{display:flex;gap:8px;align-items:center}' +
    '#marker-update-banner .mub-go{flex:1;border:0;cursor:pointer;padding:10px 14px;border-radius:999px;font:700 13px Poppins,sans-serif;color:#fff;' +
    'background:linear-gradient(135deg,#FFA226,#F57F00);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 10px 22px -8px rgba(255,145,0,.65)}' +
    '#marker-update-banner .mub-go:active{transform:scale(.97)}' +
    '#marker-update-banner .mub-later{border:0;cursor:pointer;background:none;padding:10px 12px;border-radius:999px;font:600 12.5px Poppins,sans-serif;color:#8a8a8a}' +
    '#marker-update-banner .mub-later:hover{color:#303030}' +
    '#marker-update-banner .mub-bar{display:none;height:8px;border-radius:99px;background:rgba(48,48,48,.08);overflow:hidden;margin:4px 0 6px}' +
    '#marker-update-banner .mub-fill{height:100%;width:0%;border-radius:99px;background:linear-gradient(90deg,#FFA226,#F57F00);transition:width .25s ease}' +
    '#marker-update-banner .mub-note{display:none;font-size:11.5px;color:#8a8a8a;margin:0}' +
    '#marker-update-banner .mub-err{display:none;font-size:11.5px;line-height:1.45;color:#b01d31;margin:6px 0 0}';
  document.documentElement.appendChild(css);

  var el = document.createElement('div');
  el.id = 'marker-update-banner';
  el.innerHTML =
    '<div class="mub-k"><span class="mub-dot"></span>Update ready</div>' +
    '<h3>Marker Studio __NEW_VERSION__</h3>' +
    '<p>You have __OLD_VERSION__. Installing takes seconds — the app relaunches by itself. ✨</p>' +
    '<div class="mub-bar"><div class="mub-fill"></div></div>' +
    '<p class="mub-note">Downloading…</p>' +
    '<div class="mub-row"><button type="button" class="mub-go">Install &amp; relaunch</button>' +
    '<button type="button" class="mub-later">Later</button></div>' +
    '<p class="mub-err"></p>';
  document.documentElement.appendChild(el);

  var bar = el.querySelector('.mub-bar');
  var fill = el.querySelector('.mub-fill');
  var note = el.querySelector('.mub-note');
  var row = el.querySelector('.mub-row');
  var err = el.querySelector('.mub-err');
  var go = el.querySelector('.mub-go');

  window.__MARKER_UPDATE_PROGRESS__ = function (pct) {
    bar.style.display = 'block';
    note.style.display = 'block';
    fill.style.width = pct + '%';
    note.textContent = pct >= 100 ? 'Installing… the app will relaunch.' : 'Downloading… ' + pct + '%';
  };
  window.__MARKER_UPDATE_FAILED__ = function (message) {
    row.style.display = 'flex';
    go.disabled = false;
    go.textContent = 'Try again';
    bar.style.display = 'none';
    note.style.display = 'none';
    err.style.display = 'block';
    err.textContent = 'The update couldn’t be installed: ' + message;
  };

  el.querySelector('.mub-later').addEventListener('click', function () { el.remove(); });
  go.addEventListener('click', function () {
    var invFn = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
                (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
    if (!invFn) { window.__MARKER_UPDATE_FAILED__('the app bridge is unavailable'); return; }
    go.disabled = true;
    err.style.display = 'none';
    row.style.display = 'none';
    bar.style.display = 'block';
    note.style.display = 'block';
    note.textContent = 'Starting download…';
    Promise.resolve(invFn('install_update')).catch(function (e) {
      window.__MARKER_UPDATE_FAILED__(String(e));
    });
  });
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
