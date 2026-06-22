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
                .initialization_script(NATIVE_CHROME_CSS);

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
