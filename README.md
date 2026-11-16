# setup-tessera

Set up Rust, Tessera, and the platform toolchains used by Tessera applications.

## Usage

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
```

The default setup installs stable Rust, `rustfmt`, `rust-src`, `rust-analyzer`,
the host target, WebAssembly support, the Tessera CLI, and the common Tessera
development tools. Cargo and Tessera caches are managed by this action.

The Rust setup is delegated to
[`actions-rust-lang/setup-rust-toolchain`](https://github.com/actions-rust-lang/setup-rust-toolchain),
with its cache disabled so this action can cache the complete Tessera toolchain.

## Tessera CLI source

`tessera-version` defaults to `auto`:

- `workspace` when the checkout contains `crates/cargo-tessera`
- the latest published crate otherwise

Use an explicit source for reproducible builds:

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
  with:
    tessera-version: workspace
```

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
  with:
    tessera-version: crates-io:0.5.0
```

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
  with:
    tessera-version: git:0123456789abcdef0123456789abcdef01234567
```

## Platform setup

The default setup prepares the host, WebAssembly, and WebAssembly optimization
toolchain. Android and iOS are opt-in because they require platform SDKs and
platform-specific runners.

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
  with:
    platforms: host,web,android
    android-java-version: "21"
    android-ndk-version: r28c
```

```yaml
- uses: tessera-ui/setup-tessera@v1.0.0
  with:
    platforms: host,web,ios
```

Android setup installs Java 21 by default, the requested NDK, and the
`aarch64-linux-android` and `x86_64-linux-android` Rust targets. iOS setup
requires macOS and Xcode, installs XcodeGen when needed, and prepares the
`aarch64-apple-ios`, `aarch64-apple-ios-sim`, and `x86_64-apple-ios` Rust targets.

## Inputs

Rust inputs named `toolchain`, `components`, `target`, `rustflags`, `matcher`,
`override`, and `rust-src-dir` are passed through to the upstream Rust setup
action. `targets` is retained as a compatibility alias for `target`. Tessera-
specific inputs select the CLI source, platform toolchains, common tools, and
cache namespace.

Use `cache-key` when two jobs use incompatible build configurations, such as
different feature sets or profiles.

## Caching

Build caches are separated by job, runner, Rust compiler, build environment, and
platform targets. Compatible dependency artifacts can be restored across source
revisions. For Git checkouts, unchanged files recover their cached timestamps
only after their SHA-256 hashes match, so checkout mtimes do not force rebuilds.
Directory signatures also cover watched templates. Changed files and directory
entries keep their new timestamps and are rebuilt by Cargo. A post-job step
snapshots the final inputs before the build cache is saved, including any source
changes made by workflow steps.

Workspace setup runs `cargo build --package cargo-tessera` with `tool-profile`
and copies the executable onto `PATH`. It keeps the workspace artifacts and does
not modify Cargo aliases. A matching development-profile `cargo run` alias can
therefore reuse those artifacts; changed features, profiles, or compiler inputs
can still require compilation.

## License

[MIT](LICENSE). Installed tools retain their respective licenses.
