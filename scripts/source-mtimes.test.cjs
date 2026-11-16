const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { restoreSourceMtimes } = require('./source-mtimes.cjs');

test('unchanged checkout reuses Cargo artifacts; changed bytes still rebuild', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-tessera-cache-'));
  try {
    const run = (command, args) => execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, CARGO_TARGET_DIR: path.join(root, 'target') },
    });
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'Cargo.toml'), '[package]\nname = "cache-fixture"\nversion = "0.1.0"\nedition = "2021"\n');
    const source = path.join(root, 'src/main.rs');
    fs.writeFileSync(source, 'fn main() { println!("before"); }\n');
    run('git', ['init', '--quiet']);
    run('git', ['add', 'Cargo.toml', 'src/main.rs']);
    restoreSourceMtimes(root, 'target');
    const build = () => run('cargo', ['build', '--offline', '--message-format=json'])
      .trim().split('\n').map(line => JSON.parse(line))
      .find(message => message.reason === 'compiler-artifact');
    assert.equal(build().fresh, false);
    const originalMtime = fs.statSync(source).mtimeMs;

    // Reproduce checkout on a new runner without changing source bytes.
    const newer = new Date(Date.now() + 2000);
    fs.utimesSync(source, newer, newer);
    restoreSourceMtimes(root, 'target');
    assert.ok(Math.abs(fs.statSync(source).mtimeMs - originalMtime) < 1);
    assert.equal(build().fresh, true);

    // Same-length edits must not inherit the cached timestamp or stale executable.
    fs.writeFileSync(source, 'fn main() { println!("after!"); }\n');
    fs.utimesSync(source, newer, newer);
    restoreSourceMtimes(root, 'target');
    assert.equal(build().fresh, false);
    assert.equal(run(path.join(root, 'target/debug/cache-fixture' + (process.platform === 'win32' ? '.exe' : '')), []).trim(), 'after!');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
