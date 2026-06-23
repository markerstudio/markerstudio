#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
                // can hide the web-passkey button (which the WKWebView can't use
                // unless the app is signed) in favour of the native unlock below.
                .initialization_script("window.__MARKER_DESKTOP__ = true;");

            // Native, transparent macOS title bar so the page runs to the top
            // edge as one surface (traffic lights inset over the content).
            #[cfg(target_os = "macos")]
            {
                builder = builder
                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                    .hidden_title(true)
                    // Start hidden; revealed only after Touch ID / Face ID unlock.
                    .visible(false);
            }

            builder.build()?;

            // Gate the app behind the Mac's own biometrics. The window stays
            // hidden until the device owner authenticates (or until we determine
            // the Mac has no biometrics set up, so nobody gets locked out).
            #[cfg(target_os = "macos")]
            require_biometric_unlock(app.handle().clone());

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Marker Studio");
}

// Prompt for Touch ID / Face ID on launch and reveal the window only on success.
// Runs on a background thread because the prompt blocks until the user responds;
// the LocalAuthentication reply is delivered off the main run loop, so this is
// safe to do before the event loop is pumping. All window/app calls hop back to
// the main thread, as macOS requires.
#[cfg(target_os = "macos")]
fn require_biometric_unlock(handle: tauri::AppHandle) {
    use robius_authentication::{
        AndroidText, BiometricStrength, Context, Error, PolicyBuilder, Text, WindowsText,
    };
    use tauri::Manager;

    let reveal = move |h: &tauri::AppHandle| {
        if let Some(w) = h.get_webview_window("main") {
            let _ = w.show();
            let _ = w.set_focus();
        }
    };

    std::thread::spawn(move || {
        // Give the app a moment to become the frontmost application so the
        // system biometric sheet attaches to it.
        std::thread::sleep(std::time::Duration::from_millis(250));

        // Biometrics, with the device passcode allowed as the fallback.
        let policy = PolicyBuilder::new()
            .biometrics(Some(BiometricStrength::Strong))
            .password(true)
            .build();
        let Some(policy) = policy else {
            on_main(&handle, reveal.clone());
            return;
        };

        let text = Text {
            android: AndroidText {
                title: "Marker Studio",
                subtitle: None,
                description: None,
            },
            // Shown as "Marker Studio is trying to unlock Marker Studio".
            apple: "unlock Marker Studio",
            windows: WindowsText::new("Marker Studio", "Unlock Marker Studio")
                .expect("static prompt text fits"),
        };

        match Context::new(()).blocking_authenticate(text, &policy) {
            // Authenticated — open the app.
            Ok(()) => on_main(&handle, reveal.clone()),

            // The user actively failed or dismissed the prompt — a locked door is
            // the whole point, so close the app.
            Err(Error::Authentication)
            | Err(Error::UserCanceled)
            | Err(Error::AppCanceled)
            | Err(Error::SystemCanceled)
            | Err(Error::Exhausted)
            | Err(Error::Busy)
            | Err(Error::Timeout) => {
                let h = handle.clone();
                let _ = handle.run_on_main_thread(move || h.exit(0));
            }

            // Anything else means this Mac can't actually do biometrics right now
            // (none enrolled, unsupported, disabled by policy, …). Don't lock the
            // owner out of their own app — just open it.
            Err(_) => on_main(&handle, reveal.clone()),
        }
    });
}

// Run a window action on the main thread, as AppKit requires.
#[cfg(target_os = "macos")]
fn on_main<F>(handle: &tauri::AppHandle, f: F)
where
    F: Fn(&tauri::AppHandle) + Send + 'static,
{
    let h = handle.clone();
    let _ = handle.run_on_main_thread(move || f(&h));
}

// Injected into the loaded page: nudges sticky top-bar content right so the
// macOS window buttons never overlap the wordmark/nav. No-op on pages without
// a matching header (e.g. the login screen), so it's safe everywhere.
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
