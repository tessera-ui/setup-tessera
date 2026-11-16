# setup-tessera

Set up Rust, Tessera, and platform toolchains.

```yaml
- uses: actions/checkout@v4
- uses: tessera-ui/setup-tessera@v1.0.0
```

Defaults to stable Rust, host and Web support, with caching enabled.
Android and iOS are opt-in through `platforms`.
Tessera's own CI should set `tessera-version: workspace`.

See [`action.yml`](action.yml) for inputs and defaults.

[MIT](LICENSE). Installed tools retain their own licenses.
