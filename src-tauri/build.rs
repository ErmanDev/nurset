fn main() {
    let mut attributes = tauri_build::Attributes::new();

    // On Windows, embed our own app manifest for *all* binaries (including
    // `cargo test` executables) instead of letting tauri-build add it to the
    // app binary only. See windows-app-manifest.xml.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        let manifest = std::env::current_dir()
            .expect("build dir")
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }

    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
