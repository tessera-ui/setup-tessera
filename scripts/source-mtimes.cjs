const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function restoreSourceMtimes(root, target) {
  const files = execFileSync('git', ['ls-files', '--recurse-submodules', '-z'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);
  const statePath = path.resolve(root, target, '.setup-tessera-source-mtimes.json');
  const previous = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : {};
  const current = {};
  let restored = 0;
  for (const file of files) {
    const source = path.join(root, file);
    if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) continue;
    const hash = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const stat = fs.statSync(source);
    if (previous[file]?.hash === hash) {
      // Cargo compares source mtimes with dep-info even when the bytes are unchanged.
      fs.utimesSync(source, stat.atimeMs / 1000, previous[file].mtime / 1000);
      restored++;
    }
    current[file] = { hash, mtime: fs.statSync(source).mtimeMs };
  }
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(current));
  console.log(`Restored timestamps for ${restored}/${Object.keys(current).length} unchanged source files.`);
}

module.exports = { restoreSourceMtimes };

if (require.main === module) {
  restoreSourceMtimes(process.cwd(), process.argv[2]);
}
