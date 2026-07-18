fn main() {
    // Declare the app's IPC commands in the ACL. Without this manifest, newer
    // Tauri releases reject every custom command invoked from REMOTE content
    // ("Command X not allowed by ACL") — and this shell's whole UI is the
    // hosted marker.ps site, so the bridge (notifications, preview windows,
    // printing, native saves, the update banner) depends on these grants
    // paired with capabilities/default.json.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "notify",
            "set_badge",
            "open_external",
            "open_preview",
            "print_page",
            "save_text_file",
            "save_file",
            "install_update",
            "pet_expand",
            "save_credentials",
            "get_credentials",
            "has_credentials",
            "clear_credentials",
        ])),
    )
    .expect("failed to run tauri-build");
}
