const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { restoreSourceMtimes, saveSourceMtimes } = require('../source-mtimes/source-mtimes.cjs');

for (const watchDirectory of [false, true]) {
test(`Cargo freshness survives checkout (explicit directory watch: ${watchDirectory})`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-tessera-cache-'));
  try {
    const env = { ...process.env, CARGO_TARGET_DIR: path.join(root, 'target'), CARGO_TERM_COLOR: 'never' };
    const run = (command, args) => execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      env,
    });
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, '.cargo'));
    fs.writeFileSync(path.join(root, '.cargo/config.toml'), '[alias]\ntessera = "run --package cache-fixture tessera"\n');
    fs.writeFileSync(path.join(root, 'Cargo.toml'), '[package]\nname = "cache-fixture"\nversion = "0.1.0"\nedition = "2021"\n');
    const source = path.join(root, 'src/main.rs');
    fs.writeFileSync(source, 'fn main() { println!("before"); }\n');
    fs.mkdirSync(path.join(root, 'templates'));
    fs.writeFileSync(path.join(root, 'templates/template.txt'), 'template\n');
    fs.writeFileSync(path.join(root, 'build.rs'), watchDirectory
      ? 'fn main() { println!("cargo:rerun-if-changed=templates"); }\n'
      : 'fn main() {}\n');
    run('git', ['init', '--quiet']);
    run('git', ['add', 'Cargo.toml', 'src/main.rs', '.cargo/config.toml', 'build.rs', 'templates']);
    restoreSourceMtimes(root, 'target');
    const build = () => run('cargo', ['build', '--offline', '--message-format=json'])
      .trim().split('\n').map(line => JSON.parse(line))
      .find(message => message.reason === 'compiler-artifact' && message.target.name === 'cache-fixture');
    assert.equal(build().fresh, false);

    const originalMtimeNs = fs.statSync(source, { bigint: true }).mtimeNs;

    // Reproduce checkout on a new runner without changing source bytes.
    const newer = new Date(Date.now() + 2000);
    for (const file of ['src/main.rs', 'templates/template.txt', 'templates']) {
      fs.utimesSync(path.join(root, file), newer, newer);
    }
    restoreSourceMtimes(root, 'target');
    assert.equal(fs.statSync(source, { bigint: true }).mtimeNs, originalMtimeNs);
    const freshBuild = run('cargo', ['build', '--offline', '--message-format=json']);
    assert.ok(freshBuild.trim().split('\n').map(line => JSON.parse(line))
      .filter(message => message.reason === 'compiler-artifact').every(message => message.fresh));
    const alias = spawnSync('cargo', ['--verbose', 'tessera', '--help'], {
      cwd: root,
      encoding: 'utf8',
      env,
    });
    assert.equal(alias.status, 0, alias.stderr);
    assert.match(alias.stderr, /Fresh cache-fixture/);
    assert.doesNotMatch(alias.stderr, /Compiling cache-fixture/);
    assert.equal(alias.stdout.trim(), 'before');

    // Adding an untracked directory entry must invalidate a directory-watching build script.
    fs.writeFileSync(path.join(root, 'templates/added.txt'), 'added\n');
    fs.utimesSync(path.join(root, 'templates'), newer, newer);
    restoreSourceMtimes(root, 'target');
    assert.ok(Math.abs(fs.statSync(path.join(root, 'templates')).mtimeMs - newer.getTime()) < 1);
    assert.equal(build().fresh, false);

    fs.writeFileSync(path.join(root, 'templates/added.txt'), 'edited\n');
    fs.utimesSync(path.join(root, 'templates'), newer, newer);
    restoreSourceMtimes(root, 'target');
    assert.ok(Math.abs(fs.statSync(path.join(root, 'templates')).mtimeMs - newer.getTime()) < 1);

    // Same-length edits must not inherit the cached timestamp or stale executable.
    fs.writeFileSync(source, 'fn main() { println!("after!"); }\n');
    fs.utimesSync(source, newer, newer);
    restoreSourceMtimes(root, 'target');
    assert.equal(build().fresh, false);
    assert.equal(run(path.join(root, 'target/debug/cache-fixture' + (process.platform === 'win32' ? '.exe' : '')), []).trim(), 'after!');

    // Snapshot after workflow builds: the next checkout must not mistake edited artifacts for original ones.
    saveSourceMtimes(root, 'target');
    fs.writeFileSync(source, 'fn main() { println!("before"); }\n');
    const nextCheckout = new Date(newer.getTime() + 2000);
    fs.utimesSync(source, nextCheckout, nextCheckout);
    restoreSourceMtimes(root, 'target');
    assert.equal(build().fresh, false);
    assert.equal(run(path.join(root, 'target/debug/cache-fixture' + (process.platform === 'win32' ? '.exe' : '')), []).trim(), 'before');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
}
